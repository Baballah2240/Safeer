import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'boarding_controller.dart';
import 'passengers_screen.dart';
import 'scanner_screen.dart';
import 'session.dart';
import 'settings_screen.dart';

/// Today's Trips: the active assignment first, Scan ticket as the main action in a bottom
/// bar within thumb reach, and Passengers beside it.
class TripsScreen extends StatelessWidget {
  const TripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final session = DriverScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final active = session.active;
        final controller = active == null ? null : session.controllerFor(active);
        final others = session.trips.where((t) => t.id != active?.id).toList();
        return Scaffold(
          appBar: AppBar(
            title: Text(s.todaysTrips),
            actions: [
              IconButton(tooltip: s.refresh, icon: const Icon(Icons.refresh), onPressed: session.loadTrips),
              IconButton(tooltip: s.settings, icon: const Icon(Icons.settings_outlined), onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const DriverSettingsScreen()))),
            ],
          ),
          body: Column(children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  await session.loadTrips();
                  await controller?.load();
                },
                child: ListView(padding: const EdgeInsets.all(16), children: [
                  if (session.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
                  if (session.loadingTrips && session.trips.isEmpty)
                    LoadingCards(label: s.loadingTrip, count: 2, height: 180)
                  else if (session.tripsError != null && session.trips.isEmpty)
                    MessageState(icon: Icons.cloud_off_outlined, title: driverError(s, session.tripsError!), onAction: session.loadTrips)
                  else if (active == null)
                    MessageState(icon: Icons.event_available_outlined, title: s.noAssignedTrips, message: s.noAssignedTripsHint, onAction: session.loadTrips, actionLabel: s.refresh)
                  else ...[
                    SectionLabel(s.activeAssignment),
                    ActiveTripCard(trip: active, controller: controller!),
                    ListenableBuilder(
                      listenable: session.pending,
                      builder: (context, _) => session.pending.items.isEmpty ? const SizedBox.shrink() : Padding(padding: const EdgeInsets.only(top: 12), child: _PendingNotice(session: session)),
                    ),
                    if (others.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      SectionLabel(s.laterTrips),
                      for (final t in others) Padding(padding: const EdgeInsets.only(bottom: 10), child: _TripRow(trip: t, onTap: () => session.select(t))),
                    ],
                  ],
                ]),
              ),
            ),
            if (active != null) _ActionBar(trip: active, controller: controller!),
          ]),
        );
      },
    );
  }
}

class _PendingNotice extends StatelessWidget {
  const _PendingNotice({required this.session});
  final DriverSession session;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final (bg, ink) = toneColors(SafeerPalette.of(context), StatusTone.info);
    // Compact, so the active assignment stays first; the full explanation is on the scan result.
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 6, 6, 6),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: ink.withValues(alpha: 0.4))),
        child: Row(children: [
          Icon(Icons.hourglass_top, color: ink),
          const SizedBox(width: 10),
          Expanded(child: Text(s.pendingCount(session.pending.items.length), style: TextStyle(color: ink, fontWeight: FontWeight.w600))),
          TextButton.icon(onPressed: session.syncAll, icon: const Icon(Icons.sync), label: Text(s.retryNow)),
        ]),
      ),
    );
  }
}

(IconData, String, StatusTone) journeyBadge(SafeerStrings s, DriverTrip t, Manifest? m) {
  if (t.journey == 'arrived') return (Icons.flag_outlined, s.arrived, StatusTone.neutral);
  if (t.journey == 'departed') return (Icons.directions_bus, s.departed, StatusTone.neutral);
  if (m != null && m.boardingOpen) return (Icons.how_to_reg_outlined, s.boardingOpen, StatusTone.success);
  return (Icons.schedule, s.boardingNotOpen, StatusTone.warning);
}

class ActiveTripCard extends StatelessWidget {
  const ActiveTripCard({super.key, required this.trip, required this.controller});
  final DriverTrip trip;
  final BoardingController controller;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final ar = s.isArabic;
    final departs = SafeerFormat.inZone(trip.departureAt, trip.timezone);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final m = controller.manifest;
        final (icon, label, tone) = journeyBadge(s, trip, m);
        final boarded = controller.boardedCount, expected = controller.expectedCount;
        return SolidCard(
          highlight: true,
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(trip.route.pick(ar), style: t.titleLarge),
            Text(trip.company.pick(ar), style: t.bodySmall),
            const SizedBox(height: 10),
            StatusBadge(icon: icon, label: label, tone: tone, dense: true),
            const SizedBox(height: 14),
            Wrap(spacing: 24, runSpacing: 12, children: [
              InfoPair(label: s.departure, value: '${f.time(departs)} · ${f.day(departs)}', large: true),
              InfoPair(label: s.coach, value: trip.bus.isEmpty ? '-' : trip.bus, ltrValue: true, large: true),
              InfoPair(label: s.boardingPoint, value: m?.boardingPoint?.pick(ar) ?? '-'),
            ]),
            const SizedBox(height: 16),
            if (m == null && controller.loadError != null)
              MessageState(icon: Icons.cloud_off_outlined, title: driverError(s, controller.loadError!), onAction: controller.load)
            else if (m == null)
              LoadingCards(label: s.loadingTrip, count: 1, height: 48)
            else
              Semantics(
                label: s.boardedOf(boarded, expected),
                excludeSemantics: true,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(Icons.how_to_reg, color: p.successInk),
                    const SizedBox(width: 8),
                    Expanded(child: Text(s.boardedOf(boarded, expected), style: t.titleMedium)),
                  ]),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(value: expected == 0 ? 0 : boarded / expected, minHeight: 10, backgroundColor: p.raised, color: SafeerBrand.sky),
                  ),
                ]),
              ),
          ]),
        );
      },
    );
  }
}

class _TripRow extends StatelessWidget {
  const _TripRow({required this.trip, required this.onTap});
  final DriverTrip trip;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final t = Theme.of(context).textTheme;
    final departs = SafeerFormat.inZone(trip.departureAt, trip.timezone);
    return SolidCard(
      onTap: onTap,
      semanticLabel: '${trip.route.pick(s.isArabic)}${f.comma}${f.dayTime(departs)}${f.comma}${s.coach} ${trip.bus}',
      child: Row(children: [
        // Only the short time sits beside the route; the date wraps with the details.
        Text(f.time(departs), textDirection: TextDirection.ltr, style: t.titleLarge?.copyWith(fontFamily: interFamily)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(trip.route.pick(s.isArabic), style: t.titleSmall),
            Text('${f.day(departs)} · ${s.coach} ${ltr(trip.bus)}', style: t.bodySmall),
          ]),
        ),
        const Icon(Icons.chevron_right),
      ]),
    );
  }
}

class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.trip, required this.controller});
  final DriverTrip trip;
  final BoardingController controller;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final passengers = OutlinedButton.icon(
      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PassengersScreen(trip: trip, controller: controller))),
      icon: const Icon(Icons.groups_outlined),
      label: Text(s.passengers, textAlign: TextAlign.center),
      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 56), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
    );
    final scan = PrimaryButton(
      label: s.scanTicket,
      icon: Icons.qr_code_scanner,
      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ScannerScreen(trip: trip, controller: controller, camera: DriverScope.of(context).camera))),
    );
    // Side by side normally; stacked for large text or narrow phones, with Scan ticket lowest
    // (closest to the thumb) and no word broken across lines.
    final stacked = MediaQuery.textScalerOf(context).scale(16) > 20 || MediaQuery.sizeOf(context).width < 340;
    return Material(
      color: p.paper,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: stacked
              ? Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [passengers, const SizedBox(height: 10), scan])
              : Row(children: [Expanded(child: passengers), const SizedBox(width: 12), Expanded(child: scan)]),
        ),
      ),
    );
  }
}
