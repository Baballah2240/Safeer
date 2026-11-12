// The Driver boarding controller against a disposable local Safeer server (fictional data).
// Not part of `flutter test`; run once per fresh harness (it boards the second trip's ticket):
//   SAFEER_LIVE_CONFIG=<file> flutter test tool/live_boarding_test.dart
// Never point this at the hosted site.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/boarding_controller.dart';

void main() {
  test('live: scan boards once, repeats and wrong-trip codes change nothing, offline scans wait', () async {
    HttpOverrides.global = null;
    final path = Platform.environment['SAFEER_LIVE_CONFIG'];
    if (path == null) fail('Set SAFEER_LIVE_CONFIG to the harness config file.');
    final cfg = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
    final origin = Uri.parse(cfg['origin'] as String);
    expect(origin.host, '127.0.0.1', reason: 'local disposable server only');

    final repo = LiveDriverRepository(SafeerApi(origin: origin));
    final d = cfg['driver'] as Map<String, dynamic>;
    await repo.signIn(d['email'] as String, d['password'] as String);
    final trip = (await repo.trips()).firstWhere((t) => t.id == cfg['trip2']);
    final c = BoardingController(repository: repo, trip: trip, pending: PendingScans(MemoryStore()));
    await c.load();
    expect(c.expectedCount, 1);
    expect(c.boardedCount, 0);

    final own = (cfg['paid2'] as Map<String, dynamic>)['token'] as String;
    final other = (cfg['paid1'] as Map<String, dynamic>)['token'] as String;
    expect((await c.scan(own))!.status, ScanStatus.boarded);
    await c.load();
    expect(c.boardedCount, 1);
    expect(await c.scan(own), isNull, reason: 'same code within the cooldown is ignored');
    c.resetCooldown();
    expect((await c.scan(own))!.status, ScanStatus.alreadyBoarded);
    expect((await c.scan(other))!.status, ScanStatus.wrongTrip);
    expect((await c.scan('not a ticket'))!.status, ScanStatus.notSafeer);
    await c.load();
    expect(c.boardedCount, 1, reason: 'counted once, from the server list');

    // The same ticket through an unreachable server: pending, not counted, then the server answers.
    final offline = BoardingController(repository: LiveDriverRepository(SafeerApi(origin: Uri.parse('http://127.0.0.1:9'), timeout: const Duration(seconds: 3))), trip: trip, pending: c.pending);
    expect((await offline.scan(other))!.status, ScanStatus.pending);
    expect(c.waiting, hasLength(1));
    await c.syncPending();
    expect(c.waiting, isEmpty);
    expect(c.settled.single.status, ScanStatus.wrongTrip);
    await c.load();
    expect(c.boardedCount, 1);
    await repo.signOut();
  });
}
