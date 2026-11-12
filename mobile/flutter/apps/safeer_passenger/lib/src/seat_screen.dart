import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'review_screen.dart';

class SeatScreen extends StatefulWidget {
  const SeatScreen({super.key, required this.departure});
  final Departure departure;
  @override
  State<SeatScreen> createState() => _SeatScreenState();
}

class _SeatScreenState extends State<SeatScreen> {
  SeatMap? _map;
  Object? _error;
  final List<String> _selected = [];
  List<String> _lost = [];
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _load();
    }
  }

  /// Reloads availability. Seats picked here that someone else took meanwhile are removed
  /// from the selection and named in a notice.
  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final map = await PassengerScope.of(context).repository.seatMap(widget.departure.id);
      if (!mounted) return;
      final free = {for (final s in map.seats) if (s.available) s.label};
      setState(() {
        _map = map;
        final gone = _selected.where((s) => !free.contains(s)).toList();
        if (gone.isNotEmpty) _lost = gone;
        _selected.removeWhere(gone.contains);
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  void _toggle(SeatCell seat) {
    final s = SafeerStrings.of(context);
    setState(() {
      if (_selected.contains(seat.label)) {
        _selected.remove(seat.label);
      } else if (_selected.length >= 10) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.maxSeats)));
      } else {
        _selected.add(seat.label);
      }
    });
  }

  Future<void> _continue() async {
    final map = _map!;
    final result = await Navigator.of(context).push<ReviewResult>(MaterialPageRoute(builder: (_) => ReviewScreen(map: map, seats: List.of(_selected))));
    if (result == ReviewResult.seatsChanged && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final t = Theme.of(context).textTheme;
    final d = widget.departure;
    final ar = s.isArabic;
    final map = _map;
    return Scaffold(
      appBar: AppBar(title: Text(s.chooseSeats)),
      body: Column(children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (PassengerScope.of(context).repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
              RouteLine(from: d.fromName.pick(ar), to: d.toName.pick(ar)),
              Text('${f.day(SafeerFormat.calendarDay(d.date))}${f.comma}${d.time} · ${d.company.pick(ar)}', style: t.bodySmall),
              const SizedBox(height: 12),
              if (_lost.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: StatusPanel(icon: Icons.event_busy, tone: StatusTone.warning, title: s.seatsChanged(_lost.join(', '))),
                ),
              if (_error != null)
                MessageState(icon: Icons.cloud_off_outlined, title: friendlyError(s, _error!), onAction: _load)
              else if (map == null)
                LoadingCards(label: s.chooseSeats, count: 1, height: 420)
              else ...[
                const SeatLegend(),
                const SizedBox(height: 16),
                SolidCard(padding: const EdgeInsets.all(12), child: SeatMapView(map: map, selected: _selected.toSet(), onToggle: _toggle)),
              ],
            ]),
          ),
        ),
        if (map != null) _SeatBar(selected: _selected, fareMinor: d.fareMinor, currency: d.currency, onContinue: _selected.isEmpty ? null : _continue),
      ]),
    );
  }
}

/// Selection summary and Continue, kept at the bottom within thumb reach.
class _SeatBar extends StatelessWidget {
  const _SeatBar({required this.selected, required this.fareMinor, required this.currency, required this.onContinue});
  final List<String> selected;
  final int fareMinor;
  final String currency;
  final VoidCallback? onContinue;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    return Material(
      color: p.paper,
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Semantics(
              liveRegion: true,
              child: Wrap(alignment: WrapAlignment.spaceBetween, spacing: 12, runSpacing: 4, children: [
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width - 32),
                  child: Text(
                    selected.isEmpty ? s.noSeatSelected : '${selected.length == 1 ? s.seat : s.seats}: ${selected.map(ltr).join(', ')}',
                    style: t.bodyMedium,
                  ),
                ),
                if (selected.isNotEmpty) Text('${s.total}: ${f.money(fareMinor * selected.length, currency)}', style: t.titleSmall),
              ]),
            ),
            const SizedBox(height: 10),
            PrimaryButton(label: s.continueLabel, icon: Icons.arrow_forward, onPressed: onContinue),
          ]),
        ),
      ),
    );
  }
}
