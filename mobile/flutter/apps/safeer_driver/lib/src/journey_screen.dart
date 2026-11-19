import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'boarding_controller.dart';

/// D122: the journey step by step. The driver starts the trip (passengers may still be
/// missing), marks each stop reached, marks the destination, then closes the trip.
/// The server checks the order; this screen only offers the next sensible steps.
class JourneyScreen extends StatelessWidget {
  const JourneyScreen({super.key, required this.trip, required this.controller});
  final DriverTrip trip;
  final BoardingController controller;

  Future<void> _step(BuildContext context, String question, Future<bool> Function() action) async {
    final s = SafeerStrings.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(question),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(s.cancel)),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: Text(s.confirm)),
        ],
      ),
    );
    if (ok == true) await action();
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final c = controller;
    return Scaffold(
      appBar: AppBar(title: Text(s.journeyTitle)),
      body: ListenableBuilder(
        listenable: c,
        builder: (context, _) {
          final m = c.manifest;
          final p = m?.progress;
          final f = SafeerFormat.of(context);
          final t = Theme.of(context).textTheme;
          String at(DateTime? v) => v == null ? '' : f.time(SafeerFormat.inZone(v, trip.timezone));
          final busy = c.journeyBusy;
          final live = trip.status == 'published';
          return RefreshIndicator(
            onRefresh: c.load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (DriverScope.of(context).session.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
              Text(trip.route.pick(s.isArabic), style: t.titleMedium),
              const SizedBox(height: 8),
              if (p != null)
                StatusBadge(
                  icon: p.closed ? Icons.task_alt : p.arrived ? Icons.flag_outlined : p.started ? Icons.directions_bus : Icons.schedule,
                  label: p.closed ? s.tripClosed : p.arrived ? s.journeyAtDestination : p.started ? s.journeyOnTheWay : s.journeyNotStarted,
                  tone: p.closed ? StatusTone.success : p.started ? StatusTone.info : StatusTone.neutral,
                ),
              if (c.journeyError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: StatusBadge(icon: Icons.error_outline, label: driverError(s, c.journeyError!), tone: StatusTone.error),
                ),
              const SizedBox(height: 16),
              if (m == null && c.loadError != null)
                MessageState(icon: Icons.cloud_off_outlined, title: driverError(s, c.loadError!), onAction: c.load)
              else if (p == null)
                LoadingCards(label: s.loadingTrip, count: 3, height: 72)
              else ...[
                for (final stop in p.stops)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: SolidCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Row(children: [
                          Icon(stop.reached ? Icons.check_circle : Icons.radio_button_unchecked, color: stop.reached ? Colors.green.shade700 : null),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(stop.place.pick(s.isArabic), style: t.titleSmall),
                              Text(
                                [
                                  if (stop.plannedAt != null) s.plannedAt(at(stop.plannedAt)),
                                  if (stop.reached) stop.index == 0 ? s.startedAt(at(stop.reachedAt)) : s.reachedAt(at(stop.reachedAt)),
                                ].join(' · '),
                                style: t.bodySmall,
                              ),
                            ]),
                          ),
                        ]),
                        if (live && !stop.reached && stop.index == 0) ...[
                          const SizedBox(height: 10),
                          PrimaryButton(
                            label: s.startTrip,
                            icon: Icons.play_arrow,
                            busy: busy,
                            onPressed: busy ? null : () => _step(context, s.startTripConfirm(c.expectedCount - c.boardedCount), () => c.recordEvent('departed')),
                          ),
                        ] else if (live && p.canReach(stop)) ...[
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: busy ? null : () => _step(context, s.stopConfirm, () => c.reachStop(stop.index)),
                            icon: const Icon(Icons.place_outlined),
                            label: Text(s.arrivedAtStop),
                            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 52)),
                          ),
                        ] else if (live && p.started && !p.arrived && stop.index == p.lastIndex) ...[
                          const SizedBox(height: 10),
                          PrimaryButton(
                            label: s.destinationReached,
                            icon: Icons.flag_outlined,
                            busy: busy,
                            onPressed: busy ? null : () => _step(context, s.destinationConfirm, () => c.recordEvent('arrived')),
                          ),
                        ],
                      ]),
                    ),
                  ),
                if (live && p.arrived && !p.closed) ...[
                  const SizedBox(height: 8),
                  PrimaryButton(
                    label: s.closeTrip,
                    icon: Icons.lock_outline,
                    busy: busy,
                    onPressed: busy ? null : () => _step(context, s.closeConfirm, () => c.recordEvent('closed')),
                  ),
                ],
                if (p.closed) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${s.tripClosed} · ${at(p.closedAt)}', style: t.titleSmall)),
              ],
            ]),
          );
        },
      ),
    );
  }
}
