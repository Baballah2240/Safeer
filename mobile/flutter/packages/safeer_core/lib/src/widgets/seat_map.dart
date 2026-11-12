import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../models/passenger.dart';
import '../theme/palette.dart';

/// Solid seat map. Columns follow the reading direction, as on the website. Every seat is
/// at least 44 px and announces its number and state.
class SeatMapView extends StatelessWidget {
  const SeatMapView({super.key, required this.map, required this.selected, required this.onToggle});
  final SeatMap map;
  final Set<String> selected;
  final ValueChanged<SeatCell> onToggle;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final byPosition = {for (final seat in map.seats) (seat.row, seat.column): seat};
    final columns = map.columns <= 0 ? 4 : map.columns;
    return LayoutBuilder(builder: (context, box) {
      final cell = ((box.maxWidth - 8 * (columns - 1)) / columns).clamp(44.0, 64.0);
      return Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 8),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(color: p.raised, borderRadius: BorderRadius.circular(12), border: Border.all(color: p.border)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.airline_seat_recline_extra, size: 18, color: p.muted),
            const SizedBox(width: 6),
            Flexible(child: Text(s.front, textAlign: TextAlign.center, style: TextStyle(color: p.muted, fontWeight: FontWeight.w600))),
          ]),
        ),
        for (var r = 1; r <= map.rows; r++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var c = 1; c <= columns; c++) ...[
                if (c > 1) const SizedBox(width: 8),
                SizedBox.square(
                  dimension: cell,
                  child: byPosition[(r, c)] == null
                      ? null
                      : _Seat(seat: byPosition[(r, c)]!, selected: selected.contains(byPosition[(r, c)]!.label), onTap: () => onToggle(byPosition[(r, c)]!)),
                ),
              ],
            ]),
          ),
      ]);
    });
  }
}

class _Seat extends StatelessWidget {
  const _Seat({required this.seat, required this.selected, required this.onTap});
  final SeatCell seat;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    final taken = !seat.available && !selected;
    final state = selected ? s.seatSelected : (taken ? s.seatTaken : s.seatAvailable);
    final bg = selected ? SafeerBrand.skyDeep : (taken ? p.seatTaken : p.seatFree);
    final ink = selected ? Colors.white : (taken ? p.seatTakenInk : p.ink);
    return Semantics(
      button: true,
      enabled: !taken,
      selected: selected,
      label: s.seatSemantics(seat.label, state),
      onTap: taken ? null : onTap,
      excludeSemantics: true,
      child: Material(
        color: bg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: selected ? Colors.white : (taken ? p.seatTaken : SafeerBrand.sky), width: selected ? 2 : 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: taken ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: FittedBox(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(selected ? Icons.check_circle : (taken ? Icons.close : Icons.event_seat_outlined), size: 18, color: ink),
                Text(seat.label, textDirection: TextDirection.ltr, style: TextStyle(color: ink, fontWeight: FontWeight.w700, fontSize: 14, fontFamily: 'packages/safeer_core/Inter', decoration: taken ? TextDecoration.lineThrough : null)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class SeatLegend extends StatelessWidget {
  const SeatLegend({super.key});
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final p = SafeerPalette.of(context);
    Widget item(Color bg, Color edge, IconData icon, Color ink, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8), border: Border.all(color: edge, width: 1.5)),
            child: Icon(icon, size: 16, color: ink),
          ),
          const SizedBox(width: 6),
          Flexible(child: Text(label, style: Theme.of(context).textTheme.labelMedium)),
        ]);
    return Wrap(spacing: 16, runSpacing: 8, alignment: WrapAlignment.center, children: [
      item(p.seatFree, SafeerBrand.sky, Icons.event_seat_outlined, p.ink, s.seatAvailable),
      item(SafeerBrand.skyDeep, Colors.white, Icons.check_circle, Colors.white, s.seatSelected),
      item(p.seatTaken, p.seatTaken, Icons.close, p.seatTakenInk, s.seatTaken),
    ]);
  }
}
