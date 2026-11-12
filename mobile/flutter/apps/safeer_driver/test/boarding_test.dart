import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/boarding_controller.dart';

const demo = Credential.demoPrefix;

/// Counts board calls and can hold them open, to test suppression of repeat reads.
class CountingRepository extends DemoDriverRepository {
  CountingRepository() : super(latency: Duration.zero);
  int boards = 0;
  Completer<void>? gate;
  @override
  Future<ScanResult> board(DriverTrip trip, Credential credential) async {
    boards++;
    if (gate != null) await gate!.future;
    return super.board(trip, credential);
  }
}

Future<(CountingRepository, BoardingController, PendingScans, MemoryStore)> setUpTrip() async {
  final repo = CountingRepository();
  await repo.signIn('demo@example.invalid', 'demo');
  final trip = (await repo.trips()).firstWhere((t) => t.id == 'demo-trip-1');
  final disk = MemoryStore();
  final pending = PendingScans(disk);
  await pending.load();
  final c = BoardingController(repository: repo, trip: trip, pending: pending);
  await c.load();
  return (repo, c, pending, disk);
}

Future<void> settle(BoardingController c) async {
  // Reloads after boarding run in the background; wait until the list is current.
  for (var i = 0; i < 5 && c.loading; i++) {
    await Future<void>.delayed(Duration.zero);
  }
  await c.load();
}

void main() {
  test('a valid ticket boards once; scanning it again does not change the count', () async {
    final (repo, c, _, _) = await setUpTrip();
    final before = c.boardedCount;
    final first = await c.scan('$demo${DemoDriverRepository.sampleValid}');
    expect(first!.status, ScanStatus.boarded);
    await settle(c);
    expect(c.boardedCount, before + 1);

    c.resetCooldown();
    final second = await c.scan('$demo${DemoDriverRepository.sampleValid}');
    expect(second!.status, ScanStatus.alreadyBoarded);
    await settle(c);
    expect(c.boardedCount, before + 1);
    expect(repo.boards, 2);
  });

  test('repeat camera reads are ignored while a scan is processed and during the cooldown', () async {
    final (repo, c, _, _) = await setUpTrip();
    repo.gate = Completer<void>();
    final code = '$demo${DemoDriverRepository.sampleValid}';
    final first = c.scan(code);
    expect(c.processing, isTrue);
    expect(await c.scan(code), isNull);
    expect(await c.scan('$demo${DemoDriverRepository.passengerDemoTicket}'), isNull);
    repo.gate!.complete();
    expect((await first)!.status, ScanStatus.boarded);
    expect(await c.scan(code), isNull, reason: 'same code inside the cooldown');
    expect(repo.boards, 1);
  });

  test('a ticket for another trip or a refunded ticket never registers boarding', () async {
    final (repo, c, _, _) = await setUpTrip();
    final before = c.boardedCount;
    final wrong = await c.scan('$demo${DemoDriverRepository.sampleWrongTrip}');
    expect(wrong!.status, ScanStatus.wrongTrip);
    final refunded = await c.scan('$demo${DemoDriverRepository.sampleRefunded}');
    expect(refunded!.status, ScanStatus.invalid);
    await settle(c);
    expect(c.boardedCount, before);
    final other = (await repo.trips()).firstWhere((t) => t.id == 'demo-trip-2');
    final otherList = await repo.manifest(other);
    expect(otherList.boardedCount, 0);
  });

  test('codes that are not Safeer tickets are refused without asking the server', () async {
    final (repo, c, _, _) = await setUpTrip();
    final r = await c.scan('https://example.com/not-a-ticket');
    expect(r!.status, ScanStatus.notSafeer);
    expect(repo.boards, 0);
  });

  test('offline scans are pending, never counted, kept across a restart and boarded once on reconnect', () async {
    final (repo, c, pending, disk) = await setUpTrip();
    final before = c.boardedCount;
    repo.offline = true;
    final code = '$demo${DemoDriverRepository.sampleValid}';
    expect((await c.scan(code))!.status, ScanStatus.pending);
    c.resetCooldown();
    expect((await c.scan(code))!.status, ScanStatus.pending);
    expect(c.waiting, hasLength(1), reason: 'the same ticket is queued once');
    expect(c.boardedCount, before);

    final afterRestart = PendingScans(disk);
    await afterRestart.load();
    expect(afterRestart.items, hasLength(1));

    expect(await c.syncPending(), 0, reason: 'still offline');
    repo.offline = false;
    expect(await c.syncPending(), 1);
    await settle(c);
    expect(c.waiting, isEmpty);
    expect(c.settled.single.status, ScanStatus.boarded);
    expect(c.boardedCount, before + 1);
    expect(await c.syncPending(), 0);
    await settle(c);
    expect(c.boardedCount, before + 1);
    expect(pending.items, isEmpty);
  });

  test('a pending wrong-trip scan is answered as wrong trip and not counted', () async {
    final (repo, c, _, _) = await setUpTrip();
    final before = c.boardedCount;
    repo.offline = true;
    await c.scan('$demo${DemoDriverRepository.sampleWrongTrip}');
    repo.offline = false;
    await c.syncPending();
    await settle(c);
    expect(c.settled.single.status, ScanStatus.wrongTrip);
    expect(c.boardedCount, before);
  });

  test('a typed number is checked first and boarded only on confirmation', () async {
    final (_, c, _, _) = await setUpTrip();
    final before = c.boardedCount;
    final checked = await c.check(DemoDriverRepository.sampleValid.toLowerCase());
    expect(checked!.status, ScanStatus.verified);
    await settle(c);
    expect(c.boardedCount, before);
    final boarded = await c.boardChecked(checked.credential!);
    expect(boarded!.status, ScanStatus.boarded);
    await settle(c);
    expect(c.boardedCount, before + 1);
    // Like the server, a typed number from another trip is simply invalid here.
    expect((await c.check(DemoDriverRepository.sampleWrongTrip))!.status, ScanStatus.invalid);
  });
}
