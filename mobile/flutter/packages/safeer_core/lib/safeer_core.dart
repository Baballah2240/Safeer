/// Shared Safeer code for the Flutter Passenger and Driver apps (D74).
library;

import 'package:intl/date_symbol_data_local.dart';

export 'src/api/api_client.dart';
export 'src/config.dart';
export 'src/demo_qr.dart';
export 'src/driver/demo.dart';
export 'src/driver/pending_store.dart';
export 'src/driver/repository.dart';
export 'src/format.dart';
export 'src/l10n/strings.dart';
export 'src/models/driver.dart';
export 'src/models/passenger.dart';
export 'src/models/qr.dart';
export 'src/passenger/demo.dart';
export 'src/passenger/repository.dart';
export 'src/passenger/trip_store.dart';
export 'src/settings.dart';
export 'src/storage.dart';
export 'src/theme/palette.dart';
export 'src/theme/theme.dart';
export 'src/widgets/brand.dart';
export 'src/widgets/controls.dart';
export 'src/widgets/qr_view.dart';
export 'src/widgets/seat_map.dart';
export 'src/widgets/settings_view.dart';
export 'src/widgets/status.dart';
export 'src/widgets/surfaces.dart';

/// Loads English and Arabic date names before the first screen.
Future<void> prepareSafeerFormats() async {
  await initializeDateFormatting('en_GB');
  await initializeDateFormatting('ar');
}
