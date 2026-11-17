import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_lock.dart';
import '../l10n/strings.dart';
import '../theme/palette.dart';
import 'brand.dart';
import 'surfaces.dart';

/// Covers the app with the lock screen while [AppLock.locked], and locks the app when it
/// leaves the screen (D113). Put it in MaterialApp.builder so it has text and theme.
class AppLockGate extends StatefulWidget {
  const AppLockGate({super.key, required this.lock, required this.child});
  final AppLock lock;
  final Widget child;
  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Only "paused" (the app is in the background): the fingerprint dialog itself makes
  // the app briefly inactive, which must not lock it again.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) widget.lock.lock();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.lock,
        builder: (context, _) {
          final locked = widget.lock.locked;
          return Stack(fit: StackFit.expand, children: [
            Offstage(offstage: locked, child: TickerMode(enabled: !locked, child: widget.child)),
            if (locked) LockScreen(lock: widget.lock),
          ]);
        },
      );
}

/// Full-screen PIN keypad, with a fingerprint/face button when that is turned on.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key, required this.lock});
  final AppLock lock;
  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  bool _asked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_asked && widget.lock.mode == LockMode.biometric) {
      _asked = true;
      final reason = SafeerStrings.of(context).unlockReason;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.lock.unlockWithBiometrics(reason));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final lock = widget.lock;
    return Material(
      color: SafeerPalette.of(context).page,
      child: SafeArea(
        child: PinPad(
          key: const ValueKey('lock-pad'),
          header: const Padding(padding: EdgeInsets.only(bottom: 12), child: SafeerLogo(size: 56)),
          title: s.enterPin,
          footer: s.forgotPin,
          wait: () => lock.wait,
          onBiometric: lock.mode == LockMode.biometric ? () => lock.unlockWithBiometrics(s.unlockReason) : null,
          onSubmit: (pin) async => lock.unlockWithPin(pin) ? null : (lock.wait == null ? s.wrongPin : s.tryAgainIn(lock.wait!.inSeconds + 1)),
        ),
      ),
    );
  }
}

/// Number pad for 4-6 digit PINs. [onSubmit] returns an error to show, or null when done.
class PinPad extends StatefulWidget {
  const PinPad({super.key, required this.title, required this.onSubmit, this.subtitle, this.header, this.footer, this.onBiometric, this.wait});
  final String title;
  final String? subtitle, footer;
  final Widget? header;
  final FutureOr<String?> Function(String pin) onSubmit;
  final VoidCallback? onBiometric;
  final Duration? Function()? wait;
  @override
  State<PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<PinPad> {
  String _pin = '';
  String? _error;
  bool _busy = false;
  Timer? _tick;

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _press(String digit) {
    if (_busy || _pin.length >= AppLock.maxDigits) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pin += digit;
      _error = null;
    });
  }

  void _delete() {
    if (_busy || _pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    if (_busy || _pin.length < AppLock.minDigits || widget.wait?.call() != null) return;
    setState(() => _busy = true);
    final error = await widget.onSubmit(_pin);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _pin = '';
      _error = error;
    });
    if (error != null) {
      HapticFeedback.heavyImpact();
      _watchWait();
    }
  }

  // Re-paints the countdown while the keypad is waiting after too many wrong PINs.
  void _watchWait() {
    _tick?.cancel();
    if (widget.wait?.call() == null) return;
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      final left = widget.wait?.call();
      setState(() => _error = left == null ? null : SafeerStrings.of(context).tryAgainIn(left.inSeconds + 1));
      if (left == null) t.cancel();
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final theme = Theme.of(context);
    final waiting = widget.wait?.call() != null;
    Widget key(String digit) => _Key(label: digit, onTap: waiting ? null : () => _press(digit));
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: box.maxHeight),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 340),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  ?widget.header,
                  Semantics(header: true, child: Text(widget.title, textAlign: TextAlign.center, style: theme.textTheme.titleLarge)),
                  if (widget.subtitle != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(widget.subtitle!, textAlign: TextAlign.center, style: TextStyle(color: p.muted))),
                  const SizedBox(height: 20),
                  Semantics(
                    label: '${_pin.length}',
                    excludeSemantics: true,
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      for (var i = 0; i < AppLock.maxDigits; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 120),
                          margin: const EdgeInsets.symmetric(horizontal: 7),
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: i < _pin.length ? theme.colorScheme.primary : Colors.transparent,
                            border: Border.all(color: i < _pin.length ? theme.colorScheme.primary : (i < AppLock.minDigits ? p.muted : p.border), width: 1.5),
                          ),
                        ),
                    ]),
                  ),
                  SizedBox(
                    height: 44,
                    child: Center(
                      child: _error == null ? null : Semantics(liveRegion: true, child: Text(_error!, textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.error))),
                    ),
                  ),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Column(children: [
                      for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]) Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [for (final d in row) key(d)]),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                        widget.onBiometric == null
                            ? const SizedBox(width: 72, height: 72)
                            : _Key(icon: Icons.fingerprint, tooltip: s.useBiometrics, onTap: widget.onBiometric),
                        key('0'),
                        _Key(icon: Icons.backspace_outlined, tooltip: s.deleteDigit, onTap: _pin.isEmpty ? null : _delete),
                      ]),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      key: const ValueKey('pin-continue'),
                      onPressed: _pin.length >= AppLock.minDigits && !_busy && !waiting ? _submit : null,
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                      child: Text(s.continueLabel),
                    ),
                  ),
                  if (widget.footer != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(widget.footer!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(color: p.muted))),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({this.label, this.icon, this.tooltip, required this.onTap});
  final String? label, tooltip;
  final IconData? icon;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    final child = SizedBox(
      width: 72,
      height: 72,
      child: Material(
        color: label == null ? Colors.transparent : p.paper,
        shape: CircleBorder(side: BorderSide(color: label == null ? Colors.transparent : p.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Center(child: label != null ? Text(label!, style: Theme.of(context).textTheme.headlineSmall) : Icon(icon, size: 28)),
        ),
      ),
    );
    return Padding(
      padding: const EdgeInsets.all(5),
      child: Semantics(button: true, label: tooltip ?? label, excludeSemantics: true, child: child),
    );
  }
}

/// Settings section: Off, PIN or Biometrics, and Change PIN.
class AppLockSettings extends StatefulWidget {
  const AppLockSettings({super.key, required this.lock});
  final AppLock lock;
  @override
  State<AppLockSettings> createState() => _AppLockSettingsState();
}

class _AppLockSettingsState extends State<AppLockSettings> {
  late final Future<bool> _biometrics = widget.lock.biometrics.available();

  Future<String?> _page(Widget Function(BuildContext context, void Function(String?) finish) build) =>
      Navigator.of(context).push<String>(MaterialPageRoute(fullscreenDialog: true, builder: (context) {
        void finish(String? value) => Navigator.of(context).pop(value);
        return Scaffold(appBar: AppBar(title: Text(SafeerStrings.of(context).appLock)), body: SafeArea(child: build(context, finish)));
      }));

  Future<String?> _newPin() => _page((context, finish) => _NewPin(onDone: finish));

  Future<bool> _currentPin() async {
    final lock = widget.lock;
    final ok = await _page((context, finish) {
      final s = SafeerStrings.of(context);
      return PinPad(
        title: s.currentPin,
        wait: () => lock.wait,
        onSubmit: (pin) {
          if (lock.checkPin(pin)) {
            finish('ok');
            return null;
          }
          return lock.wait == null ? s.wrongPin : s.tryAgainIn(lock.wait!.inSeconds + 1);
        },
      );
    });
    return ok == 'ok';
  }

  Future<void> _choose(LockMode next) async {
    final lock = widget.lock;
    final s = SafeerStrings.of(context);
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (next == lock.mode) return;
    if (next == LockMode.off) {
      if (await _currentPin()) await lock.turnOff();
      return;
    }
    if (next == LockMode.biometric) {
      if (!await _biometrics) {
        messenger?.showSnackBar(SnackBar(content: Text(s.biometricUnavailable)));
        return;
      }
      String? pin;
      if (!lock.enabled) {
        pin = await _newPin();
        if (pin == null) return;
      }
      if (!await lock.biometrics.confirm(s.confirmBiometricReason)) return;
      if (pin != null) {
        await lock.setPin(pin, newMode: LockMode.biometric);
      } else {
        await lock.setMode(LockMode.biometric);
      }
      return;
    }
    if (lock.enabled) {
      await lock.setMode(LockMode.pin);
    } else {
      final pin = await _newPin();
      if (pin != null) await lock.setPin(pin);
    }
  }

  Future<void> _changePin() async {
    if (!await _currentPin()) return;
    final pin = await _newPin();
    if (pin != null) await widget.lock.setPin(pin, newMode: widget.lock.mode);
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    return ListenableBuilder(
      listenable: widget.lock,
      builder: (context, _) => FutureBuilder<bool>(
        future: _biometrics,
        builder: (context, bio) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SectionLabel(s.appLock),
          SegmentedButton<LockMode>(
            key: const ValueKey('app-lock-mode'),
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: LockMode.off, icon: const Icon(Icons.lock_open_outlined), label: Text(s.lockOff)),
              ButtonSegment(value: LockMode.pin, icon: const Icon(Icons.pin_outlined), label: Text(s.lockPin)),
              ButtonSegment(value: LockMode.biometric, icon: const Icon(Icons.fingerprint), label: Text(s.lockBiometric), enabled: bio.data != false),
            ],
            selected: {widget.lock.enabled ? widget.lock.mode : LockMode.off},
            onSelectionChanged: (v) => _choose(v.first),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(bio.data == false ? '${s.lockHint} ${s.biometricUnavailable}' : s.lockHint, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: p.muted)),
          ),
          if (widget.lock.enabled)
            ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.password), title: Text(s.changePin), onTap: _changePin),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}

/// Choose a PIN, then type it again.
class _NewPin extends StatefulWidget {
  const _NewPin({required this.onDone});
  final void Function(String?) onDone;
  @override
  State<_NewPin> createState() => _NewPinState();
}

class _NewPinState extends State<_NewPin> {
  String? _first;
  bool _mismatch = false;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    return PinPad(
      key: ValueKey(_first == null ? 'new-pin' : 'confirm-pin'),
      title: _first == null ? s.createPin : s.confirmPin,
      subtitle: _mismatch && _first == null ? s.pinMismatch : s.createPinHint,
      onSubmit: (pin) {
        if (_first == null) {
          setState(() {
            _first = pin;
            _mismatch = false;
          });
          return null;
        }
        if (pin == _first) {
          widget.onDone(pin);
          return null;
        }
        setState(() {
          _first = null;
          _mismatch = true;
        });
        return null;
      },
    );
  }
}
