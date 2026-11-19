import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// A published app version, read from the website's /mobile/releases (D126).
class AppRelease {
  const AppRelease({required this.versionName, required this.versionCode, required this.url, required this.sha256, required this.bytes});
  final String versionName, url, sha256;
  final int versionCode, bytes;

  static const _base = 'https://github.com/Baballah2240/Safeer/releases/download/';

  /// Same rules as src/app-update-data.js: only Safeer's own GitHub release files.
  static AppRelease? parse(Object? json, String flavor) {
    if (json is! Map || json['apps'] is! Map) return null;
    final app = (json['apps'] as Map)[flavor];
    if (app is! Map) return null;
    final name = app['versionName'], code = app['versionCode'], url = app['url'], sum = app['sha256'], bytes = app['bytes'];
    if (name is! String || !RegExp(r'^\d+\.\d+\.\d+$').hasMatch(name)) return null;
    if (code is! int || code < 1 || bytes is! int || bytes < 1000 || bytes > 100 * 1024 * 1024) return null;
    if (sum is! String || !RegExp(r'^[a-f0-9]{64}$').hasMatch(sum)) return null;
    final file = 'Safeer-${flavor == 'driver' ? 'Driver' : 'Booking'}-$name.apk';
    if (url != '${_base}v$name/$file') return null;
    return AppRelease(versionName: name, versionCode: code, url: url as String, sha256: sum, bytes: bytes);
  }
}

/// The Android side (MainActivity): a private download folder and the system installer.
abstract class UpdateInstaller {
  Future<String> folder();

  /// 'started' when the installer opened, 'permission' when Android first asks to allow
  /// installs from this app (the user allows it and taps Update again).
  Future<String> install(String path);
}

class AndroidUpdateInstaller implements UpdateInstaller {
  static const _channel = MethodChannel('safeer/update');
  @override
  Future<String> folder() async => (await _channel.invokeMethod<String>('folder'))!;
  @override
  Future<String> install(String path) async => (await _channel.invokeMethod<String>('install', {'path': path})) ?? 'failed';
}

enum UpdateState { idle, checking, upToDate, available, downloading, ready, failed }

/// Checks the website for a newer version of this app, downloads it, checks its SHA-256 and
/// opens Android's installer, which installs it over this app (same app ID and signing key).
class AppUpdater extends ChangeNotifier {
  AppUpdater({required this.flavor, required this.versionCode, required this.origin, http.Client? client, UpdateInstaller? installer})
      : _client = client ?? http.Client(),
        _installer = installer ?? AndroidUpdateInstaller();

  /// 'driver' or 'booking', as in /mobile/releases.
  final String flavor;
  final int versionCode;
  final Uri origin;
  final http.Client _client;
  final UpdateInstaller _installer;

  UpdateState state = UpdateState.idle;
  AppRelease? release;
  double progress = 0;
  bool dismissed = false;
  bool needsPermission = false;
  String? _file;

  bool get busy => state == UpdateState.checking || state == UpdateState.downloading;
  bool get hasUpdate => release != null && [UpdateState.available, UpdateState.downloading, UpdateState.ready, UpdateState.failed].contains(state);

  void _set(UpdateState value) {
    state = value;
    notifyListeners();
  }

  Future<void> check() async {
    if (busy) return;
    _set(UpdateState.checking);
    try {
      final r = await _client.get(origin.replace(path: '/mobile/releases'), headers: {'Accept': 'application/json'}).timeout(const Duration(seconds: 15));
      final found = r.statusCode == 200 ? AppRelease.parse(jsonDecode(utf8.decode(r.bodyBytes)), flavor) : null;
      if (found == null && r.statusCode != 200) return _set(UpdateState.failed);
      if (found != null && found.versionCode > versionCode) {
        release = found;
        _set(UpdateState.available);
      } else {
        release = null;
        _set(UpdateState.upToDate);
      }
    } catch (_) {
      release = null;
      _set(UpdateState.failed);
    }
  }

  /// Downloads (once) and opens the installer.
  Future<void> update() async {
    final r = release;
    if (r == null || busy) return;
    needsPermission = false;
    if (_file == null) {
      _set(UpdateState.downloading);
      progress = 0;
      try {
        _file = await _download(r);
      } catch (_) {
        _file = null;
        return _set(UpdateState.failed);
      }
    }
    try {
      final result = await _installer.install(_file!);
      needsPermission = result == 'permission';
      _set(result == 'started' || needsPermission ? UpdateState.ready : UpdateState.failed);
    } catch (_) {
      _set(UpdateState.failed);
    }
  }

  Future<String> _download(AppRelease r) async {
    final dir = Directory(await _installer.folder());
    await dir.create(recursive: true);
    // Only the newest download is kept.
    await for (final old in dir.list()) {
      if (old is File) await old.delete();
    }
    final file = File('${dir.path}/Safeer-${r.versionName}.apk');
    final response = await _client.send(http.Request('GET', Uri.parse(r.url))).timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) throw HttpException('HTTP ${response.statusCode}');
    final sink = file.openWrite();
    final hash = AccumulatorSink<Digest>();
    final hasher = sha256.startChunkedConversion(hash);
    var received = 0;
    try {
      await for (final chunk in response.stream.timeout(const Duration(seconds: 30))) {
        received += chunk.length;
        if (received > r.bytes) throw const FormatException('too large');
        sink.add(chunk);
        hasher.add(chunk);
        progress = received / r.bytes;
        notifyListeners();
      }
    } finally {
      await sink.close();
    }
    hasher.close();
    if (received != r.bytes || hash.events.single.toString() != r.sha256) {
      await file.delete();
      throw const FormatException('checksum');
    }
    return file.path;
  }

  void dismiss() {
    dismissed = true;
    notifyListeners();
  }
}

/// Collects the digest from a chunked hash.
class AccumulatorSink<T> implements Sink<T> {
  final events = <T>[];
  @override
  void add(T event) => events.add(event);
  @override
  void close() {}
}
