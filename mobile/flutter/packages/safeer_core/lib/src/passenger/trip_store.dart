import 'dart:convert';

import '../storage.dart';

import '../models/passenger.dart';

/// A booking this phone made: its private key and the last copy the server sent.
class SavedBooking {
  SavedBooking({required this.reference, required this.key, required this.savedAt, required this.booking, this.gone = false});
  final String reference, key;
  final DateTime savedAt;
  final Booking booking;

  /// The server no longer knows this booking (erased after the retention period).
  final bool gone;

  Map<String, Object?> toJson() => {'reference': reference, 'key': key, 'savedAt': savedAt.toUtc().toIso8601String(), 'booking': booking.json, 'gone': gone};

  static SavedBooking? fromJson(Object? j) {
    if (j is! Map) return null;
    final m = j.cast<String, Object?>();
    final booking = m['booking'];
    if (m['reference'] is! String || m['key'] is! String || booking is! Map) return null;
    return SavedBooking(
      reference: m['reference'] as String,
      key: m['key'] as String,
      savedAt: DateTime.tryParse('${m['savedAt']}')?.toLocal() ?? DateTime.now(),
      booking: Booking(booking.cast<String, Object?>()),
      gone: m['gone'] == true,
    );
  }
}

/// Bookings saved in the app's private storage (excluded from backup, D74) so tickets
/// reopen after a restart without internet.
class TripStore {
  TripStore(this._store);
  final KeyValueStore _store;
  static const _key = 'safeer.passenger.bookings.v1';

  Future<List<SavedBooking>> all() async {
    final raw = await _store.read(_key);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw);
      return list is List ? list.map(SavedBooking.fromJson).whereType<SavedBooking>().toList() : [];
    } on FormatException {
      return [];
    }
  }

  Future<void> save(String key, Booking booking, {DateTime? at}) async {
    final list = await all();
    list.removeWhere((b) => b.reference == booking.reference);
    list.add(SavedBooking(reference: booking.reference, key: key, savedAt: at ?? DateTime.now(), booking: booking));
    await _write(list);
  }

  Future<void> markGone(String reference) async {
    final list = [
      for (final b in await all())
        b.reference == reference ? SavedBooking(reference: b.reference, key: b.key, savedAt: b.savedAt, booking: b.booking, gone: true) : b,
    ];
    await _write(list);
  }

  Future<void> remove(String reference) async => _write((await all())..removeWhere((b) => b.reference == reference));

  Future<void> _write(List<SavedBooking> list) => _store.write(_key, jsonEncode(list.map((b) => b.toJson()).toList()));
}
