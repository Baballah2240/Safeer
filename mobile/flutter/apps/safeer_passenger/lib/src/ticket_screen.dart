import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';

/// QR, ticket number, reference, seat, departure and boarding point together, on a solid
/// surface. Works from the saved copy when the phone has no internet.
class TicketScreen extends StatefulWidget {
  const TicketScreen({super.key, required this.saved});
  final SavedBooking saved;
  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final scope = PassengerScope.of(context);
    final tickets = widget.saved.booking.showable;
    final demo = scope.repository.isDemo || widget.saved.booking.json['demo'] == true;
    return Scaffold(
      appBar: AppBar(title: Text(tickets.length > 1 ? s.ticketOf(_page + 1, tickets.length) : s.ticket)),
      body: SafeArea(
        child: tickets.isEmpty
            ? Padding(padding: const EdgeInsets.all(16), child: MessageState(icon: Icons.qr_code_2, title: s.noQrClosed))
            : PageView(
                onPageChanged: (i) => setState(() => _page = i),
                children: [for (final t in tickets) _TicketPage(saved: widget.saved, ticket: t, demo: demo)],
              ),
      ),
    );
  }
}

class _TicketPage extends StatelessWidget {
  const _TicketPage({required this.saved, required this.ticket, required this.demo});
  final SavedBooking saved;
  final PassengerTicket ticket;
  final bool demo;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final b = saved.booking;
    final ar = s.isArabic;
    final fresh = PassengerScope.of(context).myTrips.isFresh(b.reference);
    final width = MediaQuery.sizeOf(context).width;
    final qrSize = (width - 96).clamp(180.0, 300.0);
    final name = b.travellers[ticket.seat];
    return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
      SolidCard(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          RouteLine(from: b.fromName.pick(ar), to: b.toName.pick(ar), style: t.titleLarge),
          const SizedBox(height: 4),
          Text(b.company.pick(ar), style: t.bodySmall, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          if (demo)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: StatusBadge(icon: Icons.science_outlined, label: s.demoTicket, tone: StatusTone.warning),
            ),
          if (ticket.qr != null && ticket.qr!.valid) QrView(qr: ticket.qr!, size: qrSize, semanticLabel: s.qrSemantics(ticket.number)),
          const SizedBox(height: 10),
          Text(s.showAtBoarding, style: t.bodySmall, textAlign: TextAlign.center),
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: InfoPair(label: s.ticketNumber, value: ticket.number, ltrValue: true)),
            InfoPair(label: s.seat, value: ticket.seat, ltrValue: true, large: true),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: InfoPair(label: s.reference, value: b.reference, ltrValue: true)),
            if (name != null && name.isNotEmpty) Expanded(child: InfoPair(label: s.passenger, value: name)),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: InfoPair(label: s.departure, value: f.dayTime(b.localDeparture), large: true)),
          ]),
          const SizedBox(height: 14),
          Row(children: [Expanded(child: InfoPair(label: s.boardingPoint, value: b.boardingPoint.pick(ar)))]),
          const SizedBox(height: 16),
          Row(children: [
            Icon(fresh ? Icons.cloud_done_outlined : Icons.cloud_off_outlined, size: 16, color: p.muted),
            const SizedBox(width: 6),
            Expanded(child: Text(fresh ? s.updatedNow : s.savedCopy(f.dayTime(saved.savedAt)), style: t.bodySmall)),
          ]),
        ]),
      ),
    ]);
  }
}
