import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:safeer_core/safeer_core.dart';

import 'scanner_screen.dart' show CameraBuilder;
import 'session.dart';
import 'sign_in_screen.dart';
import 'trips_screen.dart';

// Shown in Settings; keep it equal to the version line in pubspec.yaml (D78).
const driverVersion = '0.19.0 (19000)';

class DriverScope extends InheritedWidget {
  const DriverScope({super.key, required this.session, required this.settings, required this.config, this.camera, required super.child});
  final DriverSession session;

  /// Replaces the camera view in tests and previews.
  final CameraBuilder? camera;
  final AppSettings settings;
  final SafeerConfig config;
  static DriverScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<DriverScope>()!;
  @override
  bool updateShouldNotify(DriverScope old) => false;
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key, required this.session, required this.settings, required this.config, this.camera});
  final DriverSession session;
  final CameraBuilder? camera;
  final AppSettings settings;
  final SafeerConfig config;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: settings,
        builder: (context, _) {
          final locale = AppSettings.resolve(settings.locale, WidgetsBinding.instance.platformDispatcher.locales);
          final arabic = locale.languageCode == 'ar';
          return DriverScope(
            session: session,
            settings: settings,
            config: config,
            camera: camera,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              onGenerateTitle: (c) => SafeerStrings.of(c).appDriver,
              locale: locale,
              supportedLocales: SafeerStrings.supportedLocales,
              localizationsDelegates: const [SafeerStrings.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
              theme: safeerTheme(Brightness.light, arabic: arabic),
              darkTheme: safeerTheme(Brightness.dark, arabic: arabic),
              themeMode: settings.themeMode,
              home: ListenableBuilder(
                listenable: session,
                builder: (context, _) => session.account == null ? const SignInScreen() : const TripsScreen(),
              ),
            ),
          );
        },
      );
}

String driverError(SafeerStrings s, Object error) {
  if (error is NetworkException) return s.networkError;
  if (error is ApiException) {
    return switch (error.code) {
      'INVALID_CREDENTIALS' => s.invalidCredentials,
      'RATE_LIMITED' => s.rateLimited,
      'PASSWORD_CHANGE_REQUIRED' => s.passwordChangeNeeded,
      'UNAUTHENTICATED' => s.sessionExpired,
      _ => s.serverError,
    };
  }
  return s.serverError;
}
