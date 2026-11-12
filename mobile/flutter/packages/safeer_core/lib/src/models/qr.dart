/// Ticket QR geometry exactly as the server draws it (apps/api/src/ticket-qr.ts): one
/// "M{x} {y}h1v1h-1z" square per dark module. The app paints these squares; it never
/// encodes a ticket credential itself.
class TicketQr {
  TicketQr(this.size, this.path) : modules = _parse(path, size);

  final int size;
  final String path;
  final List<(int, int)> modules;

  static final _square = RegExp(r'M(\d+) (\d+)h1v1h-1z');

  static List<(int, int)> _parse(String path, int size) {
    final out = <(int, int)>[];
    for (final m in _square.allMatches(path)) {
      final x = int.parse(m.group(1)!), y = int.parse(m.group(2)!);
      if (x < size && y < size) out.add((x, y));
    }
    return out;
  }

  bool get valid => size >= 21 && size <= 177 && modules.isNotEmpty;

  factory TicketQr.fromJson(Map<String, Object?> json) =>
      TicketQr(json['size'] is int ? json['size'] as int : 0, json['path'] is String ? json['path'] as String : '');

  Map<String, Object?> toJson() => {'size': size, 'path': path};
}
