import 'package:flutter/material.dart';
import 'package:safeer_core/safeer_core.dart';

import 'app.dart';
import 'departures_screen.dart';

/// Coach photo behind a frosted search card; the card sits low so its action is within
/// thumb reach.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});
  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  List<City>? _cities;
  Object? _loadError;
  City? _from, _to;
  DateTime _date = DateUtils.dateOnly(DateTime.now());
  String? _problem;
  int _turns = 0;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_started) {
      _started = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final list = await PassengerScope.of(context).repository.cities();
      if (!mounted) return;
      setState(() {
        _cities = list;
        _from ??= list.isNotEmpty ? list.first : null;
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = e);
    }
  }

  void _check() {
    final s = SafeerStrings.of(context);
    setState(() => _problem = _from != null && _to != null && _from == _to ? s.sameCity : null);
  }

  Future<void> _pick(bool from) async {
    final cities = _cities;
    if (cities == null) return;
    final chosen = await showCityPicker(context, cities, from ? _from : _to);
    if (chosen == null || !mounted) return;
    setState(() => from ? _from = chosen : _to = chosen);
    _check();
  }

  void _swap() {
    setState(() {
      final a = _from;
      _from = _to;
      _to = a;
      _turns++;
    });
    _check();
  }

  Future<void> _pickDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(context: context, initialDate: _date.isBefore(today) ? today : _date, firstDate: today, lastDate: today.add(const Duration(days: 120)));
    if (picked != null) setState(() => _date = picked);
  }

  void _find() {
    final s = SafeerStrings.of(context);
    if (_from == null || _to == null) return setState(() => _problem = s.pickBoth);
    if (_from == _to) return setState(() => _problem = s.sameCity);
    setState(() => _problem = null);
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DeparturesScreen(from: _from!, to: _to!, date: _date)));
  }

  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final f = SafeerFormat.of(context);
    final p = SafeerPalette.of(context);
    final scope = PassengerScope.of(context);
    final size = MediaQuery.sizeOf(context);
    final reduce = MediaQuery.disableAnimationsOf(context);
    final ar = s.isArabic;
    final today = DateUtils.dateOnly(DateTime.now());
    final dateText = _date == today ? '${s.today}${f.comma}${f.day(_date)}' : (_date == today.add(const Duration(days: 1)) ? '${s.tomorrow}${f.comma}${f.day(_date)}' : f.day(_date));
    return Stack(children: [
      Positioned(
        top: 0,
        left: 0,
        right: 0,
        height: size.height * 0.52,
        child: ExcludeSemantics(
          child: DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [const Color(0xB305142B), const Color(0x6605142B), p.page]),
            ),
            child: Image.asset('assets/coach-journey.jpg', fit: BoxFit.cover, alignment: const Alignment(0.2, 0)),
          ),
        ),
      ),
      SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
          // Compact header so the search card and its action fit a 360x640 phone without scrolling.
          Row(children: [
            Expanded(child: SafeerWordmark(onDark: true, caption: s.appPassenger)),
            if (scope.repository.isDemo)
              Flexible(child: Semantics(label: s.demoBanner, excludeSemantics: true, child: StatusBadge(icon: Icons.science_outlined, label: s.demoData, tone: StatusTone.warning, dense: true))),
          ]),
          SizedBox(height: ((size.height - 640) * 0.5).clamp(12.0, 120.0)),
          Semantics(header: true, child: Text(s.heroTitle, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white))),
          const SizedBox(height: 2),
          Text(s.heroSubtitle, style: const TextStyle(color: Color(0xE6FFFFFF), fontSize: 16, fontWeight: FontWeight.w500)),
          const SizedBox(height: 14),
          GlassPanel(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (_loadError != null)
                MessageState(icon: Icons.cloud_off_outlined, title: friendlyError(s, _loadError!), onAction: _load)
              else ...[
                // Swap sits beside From and To, so it costs no extra height.
                Row(children: [
                  Expanded(
                    child: Column(children: [
                      _PickerField(label: s.from, icon: Icons.trip_origin, value: _from?.name.pick(ar), hint: s.chooseCity, onTap: _cities == null ? null : () => _pick(true)),
                      const SizedBox(height: 10),
                      _PickerField(label: s.to, icon: Icons.place_outlined, value: _to?.name.pick(ar), hint: s.chooseCity, onTap: _cities == null ? null : () => _pick(false)),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    tooltip: s.swapRoute,
                    onPressed: _cities == null ? null : _swap,
                    icon: AnimatedRotation(turns: _turns / 2, duration: reduce ? Duration.zero : const Duration(milliseconds: 250), child: const Icon(Icons.swap_vert)),
                  ),
                ]),
                const SizedBox(height: 10),
                _PickerField(label: s.travelDate, icon: Icons.calendar_today_outlined, value: dateText, hint: '', onTap: _pickDate),
                const SizedBox(height: 6),
                Wrap(spacing: 8, children: [
                  for (final (label, day) in [(s.today, today), (s.tomorrow, today.add(const Duration(days: 1)))])
                    ChoiceChip(visualDensity: VisualDensity.compact, label: Text(label), selected: _date == day, onSelected: (_) => setState(() => _date = day)),
                ]),
                if (_cities != null && _cities!.isEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text(s.noCities, style: Theme.of(context).textTheme.bodySmall)),
                if (_problem != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Semantics(
                      liveRegion: true,
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(Icons.error_outline, color: p.errorInk, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(_problem!, style: TextStyle(color: p.errorInk, fontWeight: FontWeight.w600))),
                      ]),
                    ),
                  ),
                const SizedBox(height: 12),
                PrimaryButton(label: s.findDepartures, icon: Icons.search, busy: _cities == null, busyLabel: s.findDepartures, onPressed: _find),
              ],
            ]),
          ),
        ]),
      ),
    ]);
  }
}

class _PickerField extends StatelessWidget {
  const _PickerField({required this.label, required this.icon, required this.value, required this.hint, required this.onTap});
  final String label, hint;
  final String? value;
  final IconData icon;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final p = SafeerPalette.of(context);
    return Semantics(
      button: true,
      label: '$label: ${value ?? hint}',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon), suffixIcon: const Icon(Icons.expand_more)),
          child: Text(value ?? hint, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: value == null ? p.muted : p.ink)),
        ),
      ),
    );
  }
}

Future<City?> showCityPicker(BuildContext context, List<City> cities, City? current) => showModalBottomSheet<City>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _CityPicker(cities: cities, current: current),
    );

class _CityPicker extends StatefulWidget {
  const _CityPicker({required this.cities, required this.current});
  final List<City> cities;
  final City? current;
  @override
  State<_CityPicker> createState() => _CityPickerState();
}

class _CityPickerState extends State<_CityPicker> {
  String _query = '';
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    final ar = s.isArabic;
    final q = _query.trim().toLowerCase();
    final list = widget.cities.where((c) => q.isEmpty || c.name.en.toLowerCase().contains(q) || c.name.ar.contains(q)).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              autofocus: false,
              decoration: InputDecoration(labelText: s.searchCities, prefixIcon: const Icon(Icons.search)),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: list.isEmpty
                ? MessageState(icon: Icons.location_off_outlined, title: s.noCityMatch)
                : ListView(children: [
                    for (final c in list)
                      ListTile(
                        title: Text(c.name.pick(ar), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                        subtitle: Text(ar ? c.name.en : c.name.ar),
                        trailing: c == widget.current ? const Icon(Icons.check, color: SafeerBrand.sky) : null,
                        selected: c == widget.current,
                        onTap: () => Navigator.of(context).pop(c),
                      ),
                  ]),
          ),
        ]),
      ),
    );
  }
}
