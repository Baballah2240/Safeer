import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'confirmation_screen.dart';

enum ReviewResult { seatsChanged }

/// Trip summary, seat numbers, fare and boarding point, then traveller names and a mobile
/// number (required by POST /public/holds). The booking key is made once per review, so a
/// retry after a lost answer returns the same booking instead of a second one.
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.map, required this.seats});
  final SeatMap map;
  final List<String> seats;
  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _names = {for (final s in widget.seats) s: TextEditingController()};
  final _mobile = TextEditingController();
  final String _key = uuidV4();
  bool _busy = false;
  String? _problem, _mobileProblem;

  @override
  void dispose() {
    for (final c in _names.values) {
      c.dispose();
    }
    _mobile.dispose();
    super.dispose();
  }

  static final _mobilePattern = RegExp(r'^(\+|00)?[0-9]{9,15}$');

  Future<void> _submit() async {
    if (_busy) return;
    final s = SafeerStrings.of(context);
    setState(() {
      _problem = null;
      _mobileProblem = null;
    });
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final scope = PassengerScope.of(context);
    final request = ReservationRequest(
      tripId: widget.map.trip.id,
      seats: widget.seats,
      key: _key,
      mobile: _mobile.text.replaceAll(RegExp(r'[\s\-()]'), ''),
      travellers: [for (final e in _names.entries) Traveller(e.key, e.value.text.trim())],
    );
    try {
      final booking = await scope.repository.reserve(request);
      await scope.myTrips.add(_key, booking);
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ConfirmationScreen(booking: booking, holdMinutes: widget.map.holdMinutes),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (const {'SEATS_UNAVAILABLE', 'SEATS_HELD', 'INVALID_SEATS'}.contains(e.code)) {
        Navigator.of(context).pop(ReviewResult.seatsChanged);
        return;
      }
      setState(() {
        _busy = false;
        if (e.code == 'INVALID_MOBILE') {
          _mobileProblem = s.mobileInvalid;
        } else if (e.code == 'TRIP_NOT_BOOKABLE') {
          _problem = s.tripNotBookable;
        } else if (e.code == 'RATE_LIMITED') {
          _problem = s.rateLimited;
        } else if (e.status == 400) {
          _problem = s.reservationFailed;
        } else {
          _problem = s.serverError;
        }
      });
    } on NetworkException {
      if (mounted) {
        setState(() {
          _busy = false;
          _problem = s.networkError;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final t = Theme.of(context).textTheme;
    final d = widget.map.trip;
    final ar = s.isArabic;
    final total = d.fareMinor * widget.seats.length;
    return Scaffold(
      appBar: AppBar(title: Text(s.review)),
      body: Column(
        children: [
          Expanded(
            child: Form(
              key: _form,
              // A column, not a lazy list: every traveller field stays built, so all are validated.
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (PassengerScope.of(context).repository.isDemo) const Padding(padding: EdgeInsets.only(bottom: 12), child: DemoBanner()),
                    SolidCard(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SectionLabel(s.trip),
                          RouteLine(from: d.fromName.pick(ar), to: d.toName.pick(ar), style: t.titleLarge),
                          Text(d.company.pick(ar), style: t.bodySmall),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 24,
                            runSpacing: 12,
                            children: [
                              InfoPair(label: s.departure, value: '${f.day(SafeerFormat.calendarDay(d.date))}${f.comma}${d.time}', large: true),
                              InfoPair(label: s.boardingPoint, value: d.pickup.pick(ar)),
                              InfoPair(label: widget.seats.length == 1 ? s.seat : s.seats, value: widget.seats.join(', '), ltrValue: true, large: true),
                            ],
                          ),
                          const SizedBox(height: 14),
                          const Divider(),
                          const SizedBox(height: 10),
                          Wrap(
                            alignment: WrapAlignment.spaceBetween,
                            spacing: 12,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text('${s.fare}: ${f.money(d.fareMinor, d.currency)} × ${widget.seats.length}', style: t.bodyMedium),
                              Text('${s.total}: ${f.money(total, d.currency)}', style: t.titleMedium),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SectionLabel(s.travellers),
                    for (final seat in widget.seats)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: TextFormField(
                          controller: _names[seat],
                          enabled: !_busy,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          maxLength: 100,
                          decoration: InputDecoration(labelText: s.passengerName(ltr(seat)), prefixIcon: const Icon(Icons.person_outline), counterText: ''),
                          validator: (v) => (v ?? '').trim().length < 2 ? s.nameRequired : null,
                        ),
                      ),
                    TextFormField(
                      controller: _mobile,
                      enabled: !_busy,
                      keyboardType: TextInputType.phone,
                      textDirection: TextDirection.ltr,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: InputDecoration(labelText: s.mobile, hintText: s.mobileHint, prefixIcon: const Icon(Icons.phone_outlined), errorText: _mobileProblem),
                      validator: (v) => _mobilePattern.hasMatch((v ?? '').replaceAll(RegExp(r'[\s\-()]'), '')) ? null : s.mobileInvalid,
                    ),
                    const SizedBox(height: 16),
                    StatusPanel(icon: Icons.storefront_outlined, tone: StatusTone.info, title: s.payAtStation(widget.map.holdMinutes > 0 ? widget.map.holdMinutes : 30), liveRegion: false),
                    if (_problem != null) ...[const SizedBox(height: 12), StatusPanel(icon: Icons.error_outline, tone: StatusTone.error, title: _problem!)],
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
          Material(
            color: p.paper,
            elevation: 8,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: PrimaryButton(label: s.reserveSeats, busyLabel: s.reserving, icon: Icons.check, busy: _busy, onPressed: _submit),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
