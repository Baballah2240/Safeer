import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:safeer_core/safeer_core.dart';

class FakeInstaller implements UpdateInstaller {
  FakeInstaller(this.dir);
  final Directory dir;
  final installed = <String>[];
  String answer = 'started';
  @override
  Future<String> folder() async => dir.path;
  @override
  Future<String> install(String path) async {
    installed.add(path);
    return answer;
  }
}

final apk = List<int>.generate(5000, (i) => i % 251);

Map<String, Object?> releases({int code = 23000, String name = '0.23.0', String? sum, int? bytes, String? url}) => {
      'apps': {
        'driver': {
          'versionName': name,
          'versionCode': code,
          'url': url ?? 'https://github.com/Baballah2240/Safeer/releases/download/v$name/Safeer-Driver-$name.apk',
          'sha256': sum ?? sha256.convert(apk).toString(),
          'bytes': bytes ?? apk.length,
        },
      },
    };

AppUpdater updater(Map<String, Object?> info, FakeInstaller installer, {List<int>? body}) => AppUpdater(
      flavor: 'driver',
      versionCode: 22000,
      origin: Uri.parse('https://safeer.example'),
      installer: installer,
      client: MockClient((request) async {
        if (request.url.path == '/mobile/releases') return http.Response(jsonEncode(info), 200);
        if (request.url.host == 'github.com') return http.Response.bytes(body ?? apk, 200);
        return http.Response('', 404);
      }),
    );

void main() {
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('safeer-update-'));
  tearDown(() => dir.deleteSync(recursive: true));

  test('only Safeer GitHub release files with a checksum are accepted (D126)', () {
    expect(AppRelease.parse(releases(), 'driver')?.versionCode, 23000);
    expect(AppRelease.parse(releases(url: 'https://evil.example/Safeer-Driver-0.23.0.apk'), 'driver'), isNull);
    expect(AppRelease.parse(releases(sum: 'abc'), 'driver'), isNull);
    expect(AppRelease.parse(releases(), 'booking'), isNull);
  });

  test('a newer version downloads, matches its SHA-256 and opens the installer', () async {
    final installer = FakeInstaller(dir);
    final u = updater(releases(), installer);
    await u.check();
    expect(u.state, UpdateState.available);
    await u.update();
    expect(u.state, UpdateState.ready);
    expect(installer.installed.single, endsWith('Safeer-0.23.0.apk'));
    expect(File(installer.installed.single).readAsBytesSync(), apk);

    // First time Android asks to allow installs from the app; Update again reuses the file.
    installer.answer = 'permission';
    await u.update();
    expect(u.needsPermission, isTrue);
  });

  test('same or older version: up to date; a changed file is refused and deleted', () async {
    final installer = FakeInstaller(dir);
    final same = updater(releases(code: 22000, name: '0.22.0'), installer);
    await same.check();
    expect(same.state, UpdateState.upToDate);

    final tampered = updater(releases(), installer, body: [...apk.take(4999), 7]);
    await tampered.check();
    await tampered.update();
    expect(tampered.state, UpdateState.failed);
    expect(installer.installed, isEmpty);
    expect(dir.listSync(), isEmpty);
  });

  testWidgets('the prompt offers the update and can be closed', (tester) async {
    final u = updater(releases(), FakeInstaller(dir));
    await tester.runAsync(u.check);
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: const [SafeerStrings.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate],
      supportedLocales: SafeerStrings.supportedLocales,
      theme: safeerTheme(Brightness.light, arabic: false),
      builder: (context, child) => UpdatePrompt(updater: u, child: child!),
      home: const Scaffold(body: Text('Home')),
    ));
    await tester.pump();
    expect(find.text('Version 0.23.0 is available'), findsOneWidget);
    expect(find.byKey(const ValueKey('app-update')), findsOneWidget);
    await tester.tap(find.text('Later'));
    await tester.pump();
    expect(find.text('Version 0.23.0 is available'), findsNothing);
  });
}
