import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'settings_screen.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _hidden = true, _busy = false;
  String? _problem;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit({bool demo = false}) async {
    if (_busy) return;
    final s = SafeerStrings.of(context);
    final email = demo ? 'demo.driver@example.invalid' : _email.text.trim();
    final password = demo ? 'demo' : _password.text;
    if (email.isEmpty || password.isEmpty) return setState(() => _problem = s.fillCredentials);
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      await DriverScope.of(context).session.signIn(email, password);
    } catch (e) {
      if (mounted) {
        setState(() {
          _problem = driverError(s, e);
          _password.clear();
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final t = Theme.of(context).textTheme;
    final session = DriverScope.of(context).session;
    final demo = session.repository.isDemo;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        actions: [
          IconButton(tooltip: s.settings, icon: const Icon(Icons.settings_outlined), onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const DriverSettingsScreen()))),
        ],
      ),
      body: SafeArea(
        child: AutofillGroup(
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
            SafeerWordmark(caption: s.appDriver),
            if (demo) const Padding(padding: EdgeInsets.only(top: 16), child: DemoBanner()),
            const SizedBox(height: 28),
            Semantics(header: true, child: Text(s.signInTitle, style: t.headlineSmall)),
            const SizedBox(height: 4),
            Text(s.signInNote, style: t.bodySmall),
            const SizedBox(height: 20),
            if (session.sessionExpired) Padding(padding: const EdgeInsets.only(bottom: 16), child: StatusPanel(icon: Icons.lock_clock, tone: StatusTone.warning, title: s.sessionExpired)),
            TextField(
              controller: _email,
              enabled: !_busy,
              keyboardType: TextInputType.emailAddress,
              textDirection: TextDirection.ltr,
              autofillHints: const [AutofillHints.username, AutofillHints.email],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: s.email, prefixIcon: const Icon(Icons.alternate_email)),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _password,
              enabled: !_busy,
              obscureText: _hidden,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: s.password,
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  tooltip: _hidden ? s.showPassword : s.hidePassword,
                  icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                  onPressed: () => setState(() => _hidden = !_hidden),
                ),
              ),
            ),
            if (_problem != null) Padding(padding: const EdgeInsets.only(top: 16), child: StatusPanel(icon: Icons.error_outline, tone: StatusTone.error, title: _problem!)),
            const SizedBox(height: 20),
            PrimaryButton(label: s.signIn, icon: Icons.login, busy: _busy, onPressed: _submit),
            if (demo) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: _busy ? null : () => _submit(demo: true), icon: const Icon(Icons.science_outlined), label: Text(s.demoSignIn)),
            ],
          ]),
        ),
      ),
    );
  }
}
