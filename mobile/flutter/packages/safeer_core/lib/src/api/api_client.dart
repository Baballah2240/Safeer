import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// The server answered with an error envelope {error:{code,message}}.
class ApiException implements Exception {
  ApiException(this.status, this.code, [this.message]);
  final int status;
  final String code;
  final String? message;
  @override
  String toString() => 'ApiException($status, $code)';
}

/// The request may not have reached the server, or its answer was lost. The result is
/// unknown, so callers must not treat it as success or failure (D74 pending verification).
class NetworkException implements Exception {
  NetworkException([this.cause]);
  final Object? cause;
  @override
  String toString() => 'NetworkException($cause)';
}

/// Client for the existing Safeer API under /api/v1 (no new routes, D74).
///
/// Browsers send Origin automatically; this native client sends the site's own origin,
/// because the API refuses writes from any other origin. The staff session cookie and its
/// CSRF value stay in memory only.
class SafeerApi {
  SafeerApi({required this.origin, http.Client? client, this.timeout = const Duration(seconds: 15)})
      : _client = client ?? http.Client() {
    if (origin.path.isNotEmpty && origin.path != '/') throw ArgumentError('Use an origin without a path.');
  }

  final Uri origin;
  final Duration timeout;
  final http.Client _client;
  String? _session;
  String _csrf = '';

  bool get hasSession => _session != null;

  void clearSession() {
    _session = null;
    _csrf = '';
  }

  Uri _uri(String path, [Map<String, String>? query]) =>
      origin.replace(path: '/api/v1/$path', queryParameters: query == null || query.isEmpty ? null : query);

  Map<String, String> _headers({bool json = false, bool write = false, Map<String, String>? extra}) => {
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (write) 'Origin': origin.origin,
        if (write && _csrf.isNotEmpty) 'X-CSRF-Token': _csrf,
        if (_session != null) 'Cookie': 'safeer_session=$_session',
        ...?extra,
      };

  Future<dynamic> get(String path, {Map<String, String>? query, Map<String, String>? headers}) =>
      _send(() => _client.get(_uri(path, query), headers: _headers(extra: headers)));

  Future<dynamic> post(String path, Map<String, Object?> body, {Map<String, String>? headers}) => _send(
      () => _client.post(_uri(path), headers: _headers(json: true, write: true, extra: headers), body: jsonEncode(body)));

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    final http.Response response;
    try {
      response = await request().timeout(timeout);
    } on TimeoutException catch (e) {
      throw NetworkException(e);
    } on SocketException catch (e) {
      throw NetworkException(e);
    } on HttpException catch (e) {
      throw NetworkException(e);
    } on http.ClientException catch (e) {
      throw NetworkException(e);
    } on HandshakeException catch (e) {
      throw NetworkException(e);
    }
    _readCookie(response.headers['set-cookie']);
    Object? decoded;
    try {
      decoded = response.body.isEmpty ? null : jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      decoded = null;
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded is! Map || !decoded.containsKey('data')) throw ApiException(response.statusCode, 'BAD_REPLY');
      final data = decoded['data'];
      if (data is Map && data['csrfToken'] is String) _csrf = data['csrfToken'] as String;
      return data;
    }
    final error = decoded is Map ? decoded['error'] : null;
    final code = error is Map && error['code'] is String ? error['code'] as String : 'HTTP_${response.statusCode}';
    if (response.statusCode == 401) clearSession();
    // Gateways and an overloaded server are not answers about the request itself.
    if (response.statusCode == 502 || response.statusCode == 504) throw NetworkException('HTTP ${response.statusCode}');
    throw ApiException(response.statusCode, code, error is Map ? error['message'] as String? : null);
  }

  void _readCookie(String? header) {
    if (header == null) return;
    final match = RegExp(r'safeer_session=([^;,]*)').firstMatch(header);
    if (match == null) return;
    final value = match.group(1)!;
    _session = value.isEmpty ? null : value;
    if (_session == null) _csrf = '';
  }
}
