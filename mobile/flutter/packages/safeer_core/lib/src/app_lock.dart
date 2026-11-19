import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';

import 'storage.dart';

/// How the app is locked (D113). Biometrics always keeps a PIN as the fallback.
enum LockMode { off, pin, biometric }

/// The phone's fingerprint or face check. Replaced in tests.
abstract class BiometricCheck {
  Future<bool> available();
  Future<bool> confirm(String reason);
}

class DeviceBiometrics implements BiometricCheck {
  DeviceBiometrics([LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();
  final LocalAuthentication _auth;
  @override
  Future<bool> available() async {
    try {
      return await _auth.isDeviceSupported() && (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> confirm(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, biometricOnly: true, persistAcrossBackgrounding: true);
    } catch (_) {
      return false;
    }
  }
}

/// App lock with a 4-6 digit PIN, optionally unlocked with biometrics. The PIN is stored
/// only as a salted, stretched SHA-256 hash in the app's private storage. After five
/// wrong PINs the keypad waits 30 seconds, doubling after each further wrong PIN.
class AppLock extends ChangeNotifier {
  AppLock(this._store, {BiometricCheck? biometrics, DateTime Function()? clock})
      : biometrics = biometrics ?? DeviceBiometrics(),
        _now = clock ?? DateTime.now;
  final KeyValueStore _store;
  final BiometricCheck biometrics;
  final DateTime Function() _now;

  static const _modeKey = 'safeer.lock.mode', _pinKey = 'safeer.lock.pin', _afterKey = 'safeer.lock.after';

  /// Choices for [after] (D124).
  static const delays = [Duration.zero, Duration(seconds: 30), Duration(minutes: 1), Duration(minutes: 5), Duration(minutes: 15)];

  /// Auto-lock timer: how long the app may be away, or left untouched while open, before it
  /// locks. Zero locks as soon as the app leaves the screen (and never while it is in use).
  Duration after = Duration.zero;
  DateTime? _leftAt;
  static const minDigits = 4, maxDigits = 6;

  LockMode mode = LockMode.off;
  String? _pinRecord;
  bool locked = false;
  int _failures = 0;
  DateTime? _waitUntil;

  bool get enabled => mode != LockMode.off && _pinRecord != null;

  /// Time left before another PIN may be tried, or null.
  Duration? get wait {
    final until = _waitUntil;
    if (until == null) return null;
    final left = until.difference(_now());
    return left.isNegative ? null : left;
  }

  Future<void> load() async {
    _pinRecord = await _store.read(_pinKey);
    final saved = await _store.read(_modeKey);
    mode = LockMode.values.firstWhere((m) => m.name == saved, orElse: () => LockMode.off);
    if (_pinRecord == null) mode = LockMode.off;
    final seconds = int.tryParse(await _store.read(_afterKey) ?? '');
    after = delays.firstWhere((d) => d.inSeconds == seconds, orElse: () => Duration.zero);
    locked = enabled;
    notifyListeners();
  }

  static bool validPin(String pin) => RegExp('^[0-9]{$minDigits,$maxDigits}\$').hasMatch(pin);

  static String _hash(String salt, String pin) {
    List<int> digest = utf8.encode('$salt:$pin');
    for (var i = 0; i < 20000; i++) {
      digest = sha256.convert(digest).bytes;
    }
    return base64Url.encode(digest);
  }

  /// Turns the lock on with a new PIN (also used to change the PIN).
  Future<void> setPin(String pin, {LockMode newMode = LockMode.pin}) async {
    if (!validPin(pin)) throw ArgumentError('PIN must be $minDigits-$maxDigits digits');
    final random = Random.secure();
    final salt = base64Url.encode(List.generate(16, (_) => random.nextInt(256)));
    _pinRecord = '$salt:${_hash(salt, pin)}';
    await _store.write(_pinKey, _pinRecord!);
    await setMode(newMode == LockMode.off ? LockMode.pin : newMode);
  }

  Future<void> setMode(LockMode value) async {
    mode = _pinRecord == null ? LockMode.off : value;
    await _store.write(_modeKey, mode.name);
    notifyListeners();
  }

  Future<void> setAfter(Duration value) async {
    after = delays.contains(value) ? value : Duration.zero;
    await _store.write(_afterKey, '${after.inSeconds}');
    notifyListeners();
  }

  /// The app went to the background: lock now, or note the time for [returned].
  void leftApp() {
    if (after == Duration.zero) return lock();
    _leftAt ??= _now();
  }

  /// The app is back on screen: lock when it was away for [after] or longer.
  void returned() {
    final left = _leftAt;
    _leftAt = null;
    if (left != null && !_now().difference(left).isNegative && _now().difference(left) >= after) lock();
  }

  Future<void> turnOff() async {
    mode = LockMode.off;
    _pinRecord = null;
    locked = false;
    await _store.delete(_pinKey);
    await _store.delete(_modeKey);
    notifyListeners();
  }

  /// Checks a PIN without changing the lock state, counting wrong attempts.
  bool checkPin(String pin) {
    final record = _pinRecord;
    if (record == null || wait != null) return false;
    final split = record.indexOf(':');
    final ok = split > 0 && _hash(record.substring(0, split), pin) == record.substring(split + 1);
    if (ok) {
      _failures = 0;
      _waitUntil = null;
    } else {
      _failures++;
      if (_failures >= 5) _waitUntil = _now().add(Duration(seconds: 30 << min(_failures - 5, 6)));
      notifyListeners();
    }
    return ok;
  }

  bool unlockWithPin(String pin) {
    if (!checkPin(pin)) return false;
    locked = false;
    notifyListeners();
    return true;
  }

  Future<bool> unlockWithBiometrics(String reason) async {
    if (mode != LockMode.biometric || !locked) return false;
    if (!await biometrics.confirm(reason)) return false;
    _failures = 0;
    _waitUntil = null;
    locked = false;
    notifyListeners();
    return true;
  }

  /// Called when the app leaves the screen.
  void lock() {
    if (!enabled || locked) return;
    locked = true;
    notifyListeners();
  }
}
