import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'seat_screen.dart';

class DeparturesScreen extends StatefulWidget {
  const DeparturesScreen({super.key, required this.from, required this.to, required this.date});
  final City from, to;
  final DateTime date;
  @override
  State<DeparturesScreen> createState() => _DeparturesScreenState();
}

class _DeparturesScreenState extends State<DeparturesScreen> {
  late DateTime _date = widget.date;
  List<Departure>? _items;
  Object? _error;
  bool _started = false;
  int _request = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _load();
    }
  }

  Future<void> _load() async {
    final id = ++_request;
    setState(() {
      _items = null;
      _error = null;
    });
    try {
      final list = await PassengerScope.of(context).repository.departures(from: widget.from.code, to: widget.to.code, date: _date);
      if (mounted && id == _request) setState(() => _items = list);
    } catch (e) {
      if (mounted && id == _request) setState(() => _error = e);
    }
  }

  void _nextDay() {
    _date = _date.add(const Duration(days: 1));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final ar = s.isArabic;
    final scope = PassengerScope.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(s.departures)),
      body: Column(children: [
        // The chosen route and date stay visible above the results.
        Material(
          color: p.paper,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  RouteLine(from: widget.from.name.pick(ar), to: widget.to.name.pick(ar)),
                  Text(f.dayLong(_date), style: Theme.of(context).textTheme.bodySmall),
                ]),
              ),
              TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(s.change)),
            ]),
          ),
        ),
        const Divider(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              if (scope.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
              if (_error != null)
                MessageState(icon: Icons.cloud_off_outlined, title: friendlyError(s, _error!), onAction: _load)
              else if (_items == null)
                LoadingCards(label: s.loadingDepartures, count: 3, height: 150)
              else if (_items!.isEmpty)
                MessageState(
                  icon: Icons.event_busy_outlined,
                  title: s.noDepartures,
                  message: s.noDeparturesHint,
                  secondary: Padding(padding: const EdgeInsets.only(top: 12), child: OutlinedButton.icon(onPressed: _nextDay, icon: const Icon(Icons.arrow_forward), label: Text(s.nextDay))),
                )
              else
                for (final d in _items!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: DepartureCard(
                      departure: d,
                      onTap: d.seatsLeft <= 0 ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SeatScreen(departure: d))),
                    ),
                  ),
            ]),
          ),
        ),
      ]),
    );
  }
}

class DepartureCard extends StatelessWidget {
  const DepartureCard({super.key, required this.departure, required this.onTap});
  final Departure departure;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final d = departure;
    final ar = s.isArabic;
    final full = d.seatsLeft <= 0;
    final fare = f.money(d.fareMinor, d.currency);
    final seats = full ? s.soldOut : s.seatsLeft(d.seatsLeft);
    return SolidCard(
      onTap: onTap,
      semanticLabel: s.departureSummary(d.time, d.company.pick(ar), d.pickup.pick(ar), seats, fare),
      child: Opacity(
        opacity: full ? 0.6 : 1,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(d.time, textDirection: TextDirection.ltr, style: t.displaySmall?.copyWith(fontFamily: interFamily, height: 1.1)),
                Text('${s.arrives(d.arrivalTime)} · ${s.duration(d.durationMinutes)}', style: t.bodySmall),
              ]),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(fare, textAlign: TextAlign.end, style: t.titleLarge?.copyWith(color: Theme.of(context).colorScheme.primary)),
                Text(s.perSeat, style: t.bodySmall),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Icon(Icons.directions_bus_outlined, size: 18, color: p.muted),
            const SizedBox(width: 6),
            Expanded(child: Text(d.company.pick(ar), style: t.titleSmall)),
          ]),
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.place_outlined, size: 18, color: p.muted),
            const SizedBox(width: 6),
            Expanded(child: Text('${s.pickup}: ${d.pickup.pick(ar)}', style: t.bodyMedium)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: StatusBadge(
                  icon: full ? Icons.block : Icons.event_seat_outlined,
                  label: seats,
                  tone: full ? StatusTone.neutral : (d.seatsLeft <= 5 ? StatusTone.warning : StatusTone.success),
                  dense: true,
                ),
              ),
            ),
            if (!full) Icon(Icons.chevron_right, color: p.muted, textDirection: Directionality.of(context)),
          ]),
        ]),
      ),
    );
  }
}
