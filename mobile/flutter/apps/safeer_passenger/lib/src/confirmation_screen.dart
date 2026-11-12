import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';

class ConfirmationScreen extends StatelessWidget {
  const ConfirmationScreen({super.key, required this.booking, required this.holdMinutes});
  final Booking booking;
  final int holdMinutes;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final ar = s.isArabic;
    final scope = PassengerScope.of(context);
    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false, title: Text(s.reserved)),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (scope.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
          StatusPanel(icon: Icons.check_circle_outline, tone: StatusTone.success, title: s.reserved, message: booking.expiresAt == null ? null : s.payBy(f.dayTime(booking.expiresAt!.toLocal()))),
          const SizedBox(height: 16),
          SolidCard(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              InfoPair(label: s.reference, value: booking.reference, ltrValue: true, large: true),
              const SizedBox(height: 16),
              RouteLine(from: booking.fromName.pick(ar), to: booking.toName.pick(ar)),
              const SizedBox(height: 12),
              Wrap(spacing: 24, runSpacing: 12, children: [
                InfoPair(label: s.departure, value: f.dayTime(booking.localDeparture)),
                InfoPair(label: s.boardingPoint, value: booking.boardingPoint.pick(ar)),
                InfoPair(label: booking.seats.length == 1 ? s.seat : s.seats, value: booking.seats.join(', '), ltrValue: true),
                InfoPair(label: s.total, value: f.money(booking.amountMinor, booking.currency)),
              ]),
            ]),
          ),
          const SizedBox(height: 16),
          StatusPanel(icon: Icons.storefront_outlined, tone: StatusTone.info, title: s.payAtStation(holdMinutes > 0 ? holdMinutes : 30), message: s.noQrYet, liveRegion: false),
          const SizedBox(height: 20),
          PrimaryButton(label: s.viewMyTrips, icon: Icons.confirmation_number_outlined, onPressed: () => scope.openTab(1)),
        ]),
      ),
    );
  }
}
