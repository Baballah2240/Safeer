import '../api/api_client.dart';
import '../models/driver.dart';

class DriverAccount {
  const DriverAccount({required this.name, required this.email});
  final String name, email;
}

/// Everything the Driver app needs. Boarding rules stay on the server (D66/D74): this
/// interface only reports what the server decided.
abstract class DriverRepository {
  bool get isDemo;
  Future<DriverAccount> signIn(String email, String password);
  Future<void> signOut();
  Future<List<DriverTrip>> trips();
  Future<Manifest> manifest(DriverTrip trip);

  /// Checks a ticket without recording boarding (typed ticket numbers).
  Future<ScanResult> verify(DriverTrip trip, Credential credential);

  /// Rechecks and boards exactly once; a repeat returns alreadyBoarded.
  Future<ScanResult> board(DriverTrip trip, Credential credential);
}

class LiveDriverRepository implements DriverRepository {
  LiveDriverRepository(this.api);
  final SafeerApi api;

  @override
  bool get isDemo => false;

  @override
  Future<DriverAccount> signIn(String email, String password) async {
    api.clearSession();
    // Reply: {user:{id, login, displayName, mustChangePassword, ...}, csrfToken}.
    final data = await api.post('auth/login', {'login': email.trim(), 'password': password}) as Map;
    final user = data['user'] is Map ? data['user'] as Map : const {};
    if (user['mustChangePassword'] == true) {
      await signOut();
      throw ApiException(403, 'PASSWORD_CHANGE_REQUIRED');
    }
    return DriverAccount(name: '${user['displayName'] ?? ''}', email: '${user['login'] ?? email.trim()}');
  }

  @override
  Future<void> signOut() async {
    try {
      if (api.hasSession) await api.post('auth/logout', {});
    } finally {
      api.clearSession();
    }
  }

  @override
  Future<List<DriverTrip>> trips() async {
    final data = await api.get('driver/trips') as Map;
    final items = data['items'] is List ? data['items'] as List : const [];
    return items.whereType<Map>().map((m) => DriverTrip.fromJson(m.cast())).toList()..sort((a, b) => a.departureAt.compareTo(b.departureAt));
  }

  String _path(DriverTrip t) => 'driver/companies/${Uri.encodeComponent(t.companyId)}/trips/${Uri.encodeComponent(t.id)}';

  @override
  Future<Manifest> manifest(DriverTrip trip) async => Manifest.fromJson((await api.get(_path(trip)) as Map).cast());

  @override
  Future<ScanResult> verify(DriverTrip trip, Credential credential) async =>
      ScanResult.fromReply((await api.post('${_path(trip)}/verify', credential.toJson()) as Map).cast(), board: false, credential: credential);

  @override
  Future<ScanResult> board(DriverTrip trip, Credential credential) async =>
      ScanResult.fromReply((await api.post('${_path(trip)}/board', credential.toJson()) as Map).cast(), board: true, credential: credential);
}
