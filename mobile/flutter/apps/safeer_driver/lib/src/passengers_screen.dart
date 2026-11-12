import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'boarding_controller.dart';
import 'scan_feedback.dart';

enum _Filter { all, waiting, boarded }

/// Expected and boarded passengers with seat numbers and totals, searchable by name, ticket
/// number or booking reference. Pending scans and their later answers are listed too.
class PassengersScreen extends StatefulWidget {
  const PassengersScreen({super.key, required this.trip, required this.controller});
  final DriverTrip trip;
  final BoardingController controller;
  @override
  State<PassengersScreen> createState() => _PassengersScreenState();
}

class _PassengersScreenState extends State<PassengersScreen> {
  String _query = '';
  _Filter _filter = _Filter.all;

  bool _matches(ManifestPassenger p) {
    final q = _query.trim().toLowerCase();
    if (_filter == _Filter.waiting && (p.boarded || !p.valid)) return false;
    if (_filter == _Filter.boarded && !p.boarded) return false;
    if (q.isEmpty) return true;
    return (p.name ?? '').toLowerCase().contains(q) || p.ticket.toLowerCase().contains(q) || p.bookingReference.toLowerCase().contains(q) || p.seat.toLowerCase() == q;
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final c = widget.controller;
    return Scaffold(
      appBar: AppBar(title: Text(s.passengers)),
      body: ListenableBuilder(
        listenable: c,
        builder: (context, _) {
          final m = c.manifest;
          final waiting = c.waiting;
          final list = m?.passengers.where(_matches).toList() ?? const <ManifestPassenger>[];
          final pendingNumbers = {for (final w in waiting) w.credential.ticketNumber};
          return RefreshIndicator(
            onRefresh: () async {
              await c.syncPending();
              await c.load();
            },
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (DriverScope.of(context).session.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
              Text(widget.trip.route.pick(s.isArabic), style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _Totals(expected: c.expectedCount, boarded: c.boardedCount, pending: waiting.length),
              const SizedBox(height: 16),
              TextField(
                decoration: InputDecoration(labelText: s.searchPassengers, prefixIcon: const Icon(Icons.search)),
                onChanged: (v) => setState(() => _query = v),
              ),
              const SizedBox(height: 12),
              SegmentedButton<_Filter>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(value: _Filter.all, label: Text(s.all)),
                  ButtonSegment(value: _Filter.waiting, label: Text(s.notBoarded)),
                  ButtonSegment(value: _Filter.boarded, label: Text(s.boarded)),
                ],
                selected: {_filter},
                onSelectionChanged: (v) => setState(() => _filter = v.first),
              ),
              const SizedBox(height: 16),
              if (waiting.isNotEmpty) ...[
                SectionLabel(s.pendingSection),
                for (final w in waiting)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: SolidCard(
                      child: Row(children: [
                        const Icon(Icons.hourglass_top),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(w.credential.ticketNumber ?? s.ticket, textDirection: w.credential.isNumber ? TextDirection.ltr : null, style: Theme.of(context).textTheme.titleSmall),
                            Text(s.scannedAt(SafeerFormat.of(context).time(w.scannedAt)), style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: 4),
                            StatusBadge(icon: Icons.hourglass_top, label: s.resPending, tone: StatusTone.info, dense: true),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                const SizedBox(height: 8),
              ],
              if (c.settled.isNotEmpty) ...[
                SectionLabel(s.checkedLater),
                for (final r in c.settled.take(10)) Padding(padding: const EdgeInsets.only(bottom: 8), child: ScanResultPanel(result: r, timezone: widget.trip.timezone)),
                const SizedBox(height: 8),
              ],
              if (m == null && c.loadError != null)
                MessageState(icon: Icons.cloud_off_outlined, title: driverError(s, c.loadError!), onAction: c.load)
              else if (m == null)
                LoadingCards(label: s.loadingTrip, count: 4, height: 72)
              else if (m.passengers.isEmpty)
                MessageState(icon: Icons.groups_outlined, title: s.noPassengersYet)
              else if (list.isEmpty)
                MessageState(icon: Icons.search_off, title: s.noMatches)
              else
                for (final p in list)
                  Padding(padding: const EdgeInsets.only(bottom: 8), child: _PassengerRow(passenger: p, timezone: widget.trip.timezone, pending: pendingNumbers.contains(p.ticket))),
            ]),
          );
        },
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.expected, required this.boarded, required this.pending});
  final int expected, boarded, pending;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    Widget tile(IconData icon, String label, int value, StatusTone tone) {
      final (bg, ink) = toneColors(SafeerPalette.of(context), tone);
      return Expanded(
        child: Semantics(
          label: '$label: $value',
          excludeSemantics: true,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: ink.withValues(alpha: 0.35))),
            child: Column(children: [
              Icon(icon, color: ink, size: 20),
              Text('$value', style: TextStyle(color: ink, fontSize: 22, fontWeight: FontWeight.w700, fontFamily: interFamily)),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: ink, fontSize: 13, fontWeight: FontWeight.w500)),
            ]),
          ),
        ),
      );
    }

    return Row(children: [
      tile(Icons.groups_outlined, s.expected, expected, StatusTone.neutral),
      const SizedBox(width: 8),
      tile(Icons.how_to_reg, s.boarded, boarded, StatusTone.success),
      const SizedBox(width: 8),
      tile(Icons.person_outline, s.notBoarded, expected - boarded, StatusTone.warning),
      if (pending > 0) ...[
        const SizedBox(width: 8),
        tile(Icons.hourglass_top, s.pendingShort, pending, StatusTone.info),
      ],
    ]);
  }
}

class _PassengerRow extends StatelessWidget {
  const _PassengerRow({required this.passenger, required this.timezone, required this.pending});
  final ManifestPassenger passenger;
  final String timezone;
  final bool pending;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final x = passenger;
    final (IconData icon, String label, StatusTone tone) = !x.valid
        ? (Icons.block, s.notValid, StatusTone.error)
        : x.boarded
            ? (Icons.check_circle, s.boardedAt(f.time(SafeerFormat.inZone(x.boardedAt!, timezone))), StatusTone.success)
            : pending
                ? (Icons.hourglass_top, s.resPending, StatusTone.info)
                : (Icons.radio_button_unchecked, s.notBoarded, StatusTone.neutral);
    return SolidCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: p.raised, borderRadius: BorderRadius.circular(12), border: Border.all(color: p.border)),
          child: FittedBox(child: Padding(padding: const EdgeInsets.all(4), child: Text(x.seat, textDirection: TextDirection.ltr, style: t.titleMedium?.copyWith(fontFamily: interFamily)))),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(x.name ?? s.nameRemoved, style: t.titleSmall?.copyWith(fontStyle: x.name == null ? FontStyle.italic : null)),
            Text('${ltr(x.ticket)} · ${ltr(x.bookingReference)}', style: t.bodySmall),
            const SizedBox(height: 4),
            StatusBadge(icon: icon, label: label, tone: tone, dense: true),
          ]),
        ),
      ]),
    );
  }
}
