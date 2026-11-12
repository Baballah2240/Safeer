import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:safeer_core/safeer_core.dart';

import 'explore_screen.dart';
import 'my_trips.dart';
import 'settings_screen.dart';

const passengerVersion = '0.1.0 (1)';

/// Shared services for the Passenger screens.
class PassengerScope extends InheritedWidget {
  const PassengerScope({super.key, required this.repository, required this.trips, required this.settings, required this.config, required this.myTrips, required this.openTab, required super.child});
  final PassengerRepository repository;
  final TripStore trips;
  final AppSettings settings;
  final SafeerConfig config;
  final MyTripsController myTrips;
  final ValueChanged<int> openTab;

  static PassengerScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<PassengerScope>()!;
  @override
  bool updateShouldNotify(PassengerScope old) => false;
}

class PassengerApp extends StatefulWidget {
  const PassengerApp({super.key, required this.repository, required this.trips, required this.settings, required this.config, this.initialTab = 0});
  final PassengerRepository repository;
  final TripStore trips;
  final AppSettings settings;
  final SafeerConfig config;
  final int initialTab;
  @override
  State<PassengerApp> createState() => _PassengerAppState();
}

class _PassengerAppState extends State<PassengerApp> {
  late final MyTripsController _myTrips = MyTripsController(widget.repository, widget.trips)..load();
  final _navigator = GlobalKey<NavigatorState>();
  late final ValueNotifier<int> _tab = ValueNotifier(widget.initialTab);

  @override
  void dispose() {
    _myTrips.dispose();
    _tab.dispose();
    super.dispose();
  }

  void _openTab(int index) {
    _navigator.currentState?.popUntil((r) => r.isFirst);
    _tab.value = index;
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.settings,
        builder: (context, _) {
          final locale = AppSettings.resolve(widget.settings.locale, WidgetsBinding.instance.platformDispatcher.locales);
          final arabic = locale.languageCode == 'ar';
          return PassengerScope(
            repository: widget.repository,
            trips: widget.trips,
            settings: widget.settings,
            config: widget.config,
            myTrips: _myTrips,
            openTab: _openTab,
            child: MaterialApp(
              navigatorKey: _navigator,
              debugShowCheckedModeBanner: false,
              onGenerateTitle: (c) => SafeerStrings.of(c).appPassenger,
              locale: locale,
              supportedLocales: SafeerStrings.supportedLocales,
              localizationsDelegates: const [SafeerStrings.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
              theme: safeerTheme(Brightness.light, arabic: arabic),
              darkTheme: safeerTheme(Brightness.dark, arabic: arabic),
              themeMode: widget.settings.themeMode,
              home: _Home(tab: _tab),
            ),
          );
        },
      );
}

class _Home extends StatelessWidget {
  const _Home({required this.tab});
  final ValueNotifier<int> tab;
  @override
  Widget build(BuildContext context) {
    final s = SafeerStrings.of(context);
    return ValueListenableBuilder<int>(
      valueListenable: tab,
      builder: (context, index, _) => Scaffold(
        body: IndexedStack(index: index, children: const [ExploreScreen(), MyTripsScreen(), PassengerSettingsScreen()]),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (i) => tab.value = i,
          destinations: [
            NavigationDestination(icon: const Icon(Icons.travel_explore_outlined), selectedIcon: const Icon(Icons.travel_explore), label: s.explore),
            NavigationDestination(icon: const Icon(Icons.confirmation_number_outlined), selectedIcon: const Icon(Icons.confirmation_number), label: s.myTrips),
            NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: s.settings),
          ],
        ),
      ),
    );
  }
}

/// Maps errors to text the passenger can act on.
String friendlyError(SafeerStrings s, Object error) {
  if (error is NetworkException) return s.networkError;
  if (error is ApiException) {
    if (error.code == 'RATE_LIMITED') return s.rateLimited;
    if (error.code == 'TRIP_NOT_BOOKABLE') return s.tripNotBookable;
  }
  return s.serverError;
}
