import 'package:flutter_test/flutter_test.dart';
import 'package:safeer_core/safeer_core.dart';
import 'package:safeer_driver/src/boarding_controller.dart';

// D122: start the trip with passengers still missing, reach the destination, then close it.
void main() {
  test('journey: start without everyone, destination, close; out-of-order steps are refused', () async {
    final repo = DemoDriverRepository(latency: Duration.zero);
    await repo.signIn('demo@example.invalid', 'demo');
    final trip = (await repo.trips()).firstWhere((t) => t.id == 'demo-trip-1');
    final pending = PendingScans(MemoryStore());
    await pending.load();
    final c = BoardingController(repository: repo, trip: trip, pending: pending);
    await c.load();

    var p = c.manifest!.progress!;
    expect(p.started, isFalse);
    expect(c.boardedCount < c.expectedCount, isTrue, reason: 'nobody has boarded yet');
    expect(await c.recordEvent('closed'), isFalse, reason: 'cannot close before the destination');
    expect(await c.recordEvent('arrived'), isFalse, reason: 'cannot arrive before starting');

    expect(await c.recordEvent('departed'), isTrue);
    p = c.manifest!.progress!;
    expect(p.started, isTrue);
    expect(p.stops.first.reached, isTrue);
    expect(await c.reachStop(p.lastIndex), isFalse, reason: 'the destination uses its own button');

    expect(await c.recordEvent('arrived'), isTrue);
    p = c.manifest!.progress!;
    expect(p.arrived, isTrue);
    expect(p.stops.last.reached, isTrue);
    expect(p.closed, isFalse);

    expect(await c.recordEvent('closed'), isTrue);
    expect(c.manifest!.progress!.closed, isTrue);
    c.dispose();
  });

  test('canReach offers only stops after the last one reached', () {
    final now = DateTime.utc(2026, 11, 19, 8);
    JourneyStop stop(int i, {bool reached = false}) => JourneyStop(index: i, place: const Bilingual('x', 'x'), plannedAt: now, reachedAt: reached ? now : null);
    final p = JourneyProgress(departedAt: now, stops: [stop(0, reached: true), stop(1), stop(2, reached: true), stop(3), stop(4)]);
    expect(p.canReach(p.stops[1]), isFalse, reason: 'already passed stop 2');
    expect(p.canReach(p.stops[3]), isTrue);
    expect(p.canReach(p.stops[4]), isFalse, reason: 'destination');
    expect(JourneyProgress(stops: [stop(0), stop(1), stop(2)]).canReach(stop(1)), isFalse, reason: 'not started');
  });
}
