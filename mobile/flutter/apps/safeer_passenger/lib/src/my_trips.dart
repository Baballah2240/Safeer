import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'ticket_screen.dart';

/// Saved bookings first, then a refresh from the server. When the phone is offline the
/// saved copies stay on screen, marked with the time they were saved.
class MyTripsController extends ChangeNotifier {
  MyTripsController(this.repository, this.store, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  final PassengerRepository repository;
  final TripStore store;
  final DateTime Function() _clock;

  List<SavedBooking> saved = [];
  bool loaded = false, refreshing = false, offline = false;
  final Set<String> _fresh = {};

  bool isFresh(String reference) => _fresh.contains(reference);

  Future<void> load() async {
    saved = await store.all();
    loaded = true;
    notifyListeners();
    await refresh();
  }

  Future<void> refresh() async {
    if (refreshing) return;
    refreshing = true;
    notifyListeners();
    var reachable = true;
    for (final b in List.of(saved)) {
      if (b.gone) continue;
      try {
        final fresh = await repository.booking(b.reference, b.key);
        await store.save(b.key, fresh, at: _clock());
        _fresh.add(b.reference);
      } on NetworkException {
        reachable = false;
        break;
      } on ApiException catch (e) {
        if (e.status == 404) await store.markGone(b.reference);
      }
    }
    offline = !reachable;
    saved = await store.all();
    refreshing = false;
    notifyListeners();
  }

  Future<void> add(String key, Booking booking) async {
    await store.save(key, booking, at: _clock());
    _fresh.add(booking.reference);
    saved = await store.all();
    notifyListeners();
  }

  Future<void> remove(String reference) async {
    await store.remove(reference);
    saved = await store.all();
    notifyListeners();
  }

  List<SavedBooking> get upcoming {
    final now = _clock();
    return saved.where((b) => !b.gone && b.booking.isUpcoming(now)).toList()..sort((a, b) => a.booking.localDeparture.compareTo(b.booking.localDeparture));
  }

  List<SavedBooking> get closed {
    final now = _clock();
    return saved.where((b) => b.gone || !b.booking.isUpcoming(now)).toList()..sort((a, b) => b.booking.localDeparture.compareTo(a.booking.localDeparture));
  }
}

class MyTripsScreen extends StatelessWidget {
  const MyTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = PassengerScope.of(context);
    final s = SafeerStrings.of(context);
    return SafeArea(
      child: ListenableBuilder(
        listenable: scope.myTrips,
        builder: (context, _) {
          final c = scope.myTrips;
          final upcoming = c.upcoming, closed = c.closed;
          return RefreshIndicator(
            onRefresh: c.refresh,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
              if (scope.repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
              Semantics(header: true, child: Text(s.myTrips, style: Theme.of(context).textTheme.headlineSmall)),
              const SizedBox(height: 12),
              if (!c.loaded)
                LoadingCards(label: s.myTrips, count: 2, height: 160)
              else if (c.saved.isEmpty)
                MessageState(icon: Icons.confirmation_number_outlined, title: s.noTrips, message: s.noTripsHint)
              else ...[
                if (c.offline) Padding(padding: const EdgeInsets.only(bottom: 12), child: StatusBadge(icon: Icons.cloud_off, label: s.offline, tone: StatusTone.warning)),
                if (upcoming.isNotEmpty) ...[
                  SectionLabel(s.nextDepartureLabel),
                  TripCard(saved: upcoming.first, primary: true),
                  if (upcoming.length > 1) ...[
                    const SizedBox(height: 16),
                    SectionLabel(s.upcoming),
                    for (final b in upcoming.skip(1)) Padding(padding: const EdgeInsets.only(bottom: 12), child: TripCard(saved: b)),
                  ],
                ],
                if (closed.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SectionLabel(s.past),
                  for (final b in closed) Padding(padding: const EdgeInsets.only(bottom: 12), child: TripCard(saved: b)),
                ],
              ],
            ]),
          );
        },
      ),
    );
  }
}

(IconData, String, StatusTone) bookingStatus(SafeerStrings s, Booking b) {
  if (b.tripCanceled) return (Icons.cancel_outlined, s.statusCanceled, StatusTone.error);
  return switch (b.statusAt(DateTime.now())) {
    BookingStatus.confirmed => (Icons.verified_outlined, s.statusConfirmed, StatusTone.success),
    BookingStatus.held => (Icons.schedule, s.statusHeld, StatusTone.warning),
    BookingStatus.expired => (Icons.timer_off_outlined, s.statusExpired, StatusTone.neutral),
    BookingStatus.released => (Icons.remove_circle_outline, s.statusReleased, StatusTone.neutral),
    BookingStatus.refunded => (Icons.undo, s.statusRefunded, StatusTone.neutral),
    BookingStatus.unknown => (Icons.help_outline, s.statusHeld, StatusTone.neutral),
  };
}

class TripCard extends StatelessWidget {
  const TripCard({super.key, required this.saved, this.primary = false});
  final SavedBooking saved;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final scope = PassengerScope.of(context);
    final b = saved.booking;
    final ar = s.isArabic;
    final (icon, label, tone) = bookingStatus(s, b);
    final fresh = scope.myTrips.isFresh(b.reference);
    final when = f.dayTime(b.localDeparture);
    final showable = b.showable;
    return SolidCard(
      highlight: primary,
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        RouteLine(from: b.fromName.pick(ar), to: b.toName.pick(ar), style: primary ? t.titleLarge : t.titleMedium),
        const SizedBox(height: 4),
        Text(b.company.pick(ar), style: t.bodySmall),
        const SizedBox(height: 8),
        StatusBadge(icon: icon, label: label, tone: tone, dense: true),
        const SizedBox(height: 14),
        Wrap(spacing: 24, runSpacing: 12, children: [
          InfoPair(label: s.departure, value: when, large: primary),
          InfoPair(label: s.boardingPoint, value: b.boardingPoint.pick(ar)),
          InfoPair(label: b.seats.length == 1 ? s.seat : s.seats, value: b.seats.join(', '), ltrValue: true),
          InfoPair(label: s.reference, value: b.reference, ltrValue: true),
        ]),
        const SizedBox(height: 12),
        if (saved.gone)
          Text(s.bookingGone, style: t.bodySmall)
        else if (b.statusAt(DateTime.now()) == BookingStatus.held && b.expiresAt != null)
          Text(s.payBy(f.dayTime(b.expiresAt!.toLocal())), style: t.bodyMedium?.copyWith(color: p.warning, fontWeight: FontWeight.w600)),
        Row(children: [
          Icon(fresh ? Icons.cloud_done_outlined : Icons.cloud_off_outlined, size: 16, color: p.muted),
          const SizedBox(width: 6),
          Expanded(child: Text(fresh ? s.updatedNow : s.savedCopy(f.dayTime(saved.savedAt)), style: t.bodySmall)),
        ]),
        if (primary || showable.isNotEmpty) ...[
          const SizedBox(height: 14),
          if (showable.isNotEmpty)
            PrimaryButton(label: s.showTicket, icon: Icons.qr_code_2, onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => TicketScreen(saved: saved))))
          else if (b.openAt(DateTime.now()))
            Text(s.noQrYet, style: t.bodyMedium?.copyWith(color: p.muted)),
        ],
        if (saved.gone)
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(onPressed: () => scope.myTrips.remove(b.reference), icon: const Icon(Icons.delete_outline), label: Text(s.remove)),
          ),
      ]),
    );
  }
}
