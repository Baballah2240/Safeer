import 'package:flutter/widgets.dart';

/// English and Arabic text for both apps. Each entry keeps both languages side by side so
/// a missing translation is visible in review. Codes (references, seats, ticket numbers)
/// are never translated and are shown in left-to-right isolates.
class SafeerStrings {
  SafeerStrings(this.locale);
  final Locale locale;
  bool get isArabic => locale.languageCode == 'ar';
  String _t(String en, String ar) => isArabic ? ar : en;

  static SafeerStrings of(BuildContext context) => Localizations.of<SafeerStrings>(context, SafeerStrings)!;
  static const LocalizationsDelegate<SafeerStrings> delegate = _Delegate();
  static const supportedLocales = [Locale('en'), Locale('ar')];

  // Shared
  String get brand => _t('Safeer', 'سفير');
  String get appPassenger => _t('Safeer Passenger', 'سفير المسافر');
  String get appDriver => _t('Safeer Driver', 'سفير السائق');
  String get demoData => _t('Demo data', 'بيانات تجريبية');
  String get demoBanner => _t('Demo data: sample trips and tickets, not real bookings', 'بيانات تجريبية: رحلات وتذاكر نموذجية وليست حجوزات حقيقية');
  String get retry => _t('Retry', 'إعادة المحاولة');
  String get cancel => _t('Cancel', 'إلغاء');
  String get close => _t('Close', 'إغلاق');
  String get continueLabel => _t('Continue', 'متابعة');
  String get refresh => _t('Refresh', 'تحديث');
  String get settings => _t('Settings', 'الإعدادات');
  String get language => _t('Language', 'اللغة');
  String get appearance => _t('Appearance', 'المظهر');
  String get dark => _t('Dark', 'داكن');
  String get light => _t('Light', 'فاتح');
  String get phoneSetting => _t('Phone setting', 'حسب الهاتف');
  String get english => 'English';
  String get arabic => 'العربية';
  String get version => _t('Version', 'الإصدار');
  String get dataSource => _t('Data source', 'مصدر البيانات');
  String liveSite(String origin) => _t('Live: $origin', 'مباشر: $origin');
  String get signOut => _t('Sign out', 'تسجيل الخروج');
  String get networkError => _t("Can't reach Safeer. Check your internet connection and try again.", 'تعذر الاتصال بسفير. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
  String get serverError => _t('Something went wrong on our side. Try again in a moment.', 'حدث خطأ من جهتنا. أعد المحاولة بعد قليل.');
  String get rateLimited => _t('Too many attempts. Wait a few minutes and try again.', 'محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة.');
  String savedCopy(String time) => _t('Saved copy from $time', 'نسخة محفوظة من $time');
  String get offline => _t('Offline', 'غير متصل');
  String get today => _t('Today', 'اليوم');
  String get tomorrow => _t('Tomorrow', 'غداً');

  // Passenger: Explore
  String get explore => _t('Explore', 'استكشف');
  String get myTrips => _t('My Trips', 'رحلاتي');
  String get heroTitle => _t('Where are you travelling?', 'إلى أين تسافر؟');
  String get heroSubtitle => _t('Intercity coaches across Sudan', 'حافلات بين المدن في أنحاء السودان');
  String get from => _t('From', 'من');
  String get to => _t('To', 'إلى');
  String get travelDate => _t('Travel date', 'تاريخ السفر');
  String get chooseCity => _t('Choose a city', 'اختر مدينة');
  String get swapRoute => _t('Swap departure and destination', 'تبديل مدينة المغادرة والوصول');
  String get findDepartures => _t('Find departures', 'ابحث عن الرحلات');
  String get sameCity => _t('Departure and destination must be different cities.', 'يجب أن تختلف مدينة المغادرة عن مدينة الوصول.');
  String get pickBoth => _t('Choose where you leave from and where you are going.', 'اختر مدينة المغادرة ومدينة الوصول.');
  String get searchCities => _t('Search cities', 'ابحث عن مدينة');
  String get noCities => _t('No cities with trips yet.', 'لا توجد مدن بها رحلات بعد.');
  String get noCityMatch => _t('No city matches your search.', 'لا توجد مدينة مطابقة.');

  // Passenger: Departures
  String get departures => _t('Departures', 'الرحلات');
  String get change => _t('Change', 'تغيير');
  String get loadingDepartures => _t('Loading departures', 'جارٍ تحميل الرحلات');
  String get noDepartures => _t('No departures on this date', 'لا توجد رحلات في هذا التاريخ');
  String get noDeparturesHint => _t('Try the next day or another route.', 'جرّب اليوم التالي أو مساراً آخر.');
  String get nextDay => _t('Next day', 'اليوم التالي');
  String seatsLeft(int n) => _t(n == 1 ? '1 seat left' : '$n seats left', 'المقاعد المتاحة: $n');
  String get soldOut => _t('Full', 'ممتلئة');
  String get pickup => _t('Pickup', 'نقطة الصعود');
  String get operator => _t('Operator', 'الشركة');
  String get fare => _t('Fare', 'السعر');
  String get perSeat => _t('per seat', 'للمقعد');
  /// Hours and minutes joined by no-break spaces, so a duration never splits across lines.
  String duration(int minutes) {
    final nb = String.fromCharCode(0xA0), h = minutes ~/ 60, m = minutes % 60;
    final hours = _t('$h${nb}h', '$h$nbس'), mins = _t('$m${nb}min', '$m$nbد');
    return h == 0 ? mins : (m == 0 ? hours : '$hours$nb$mins');
  }
  String arrives(String time) => _t('Arrives $time', 'الوصول $time');
  String departureSummary(String time, String operator, String pickup, String seats, String fare) =>
      _t('Departs $time, $operator, pickup $pickup, $seats, $fare per seat', 'المغادرة $time، $operator، الصعود من $pickup، $seats، $fare للمقعد');

  // Passenger: Seats and review
  String get chooseSeats => _t('Choose seats', 'اختر المقاعد');
  String get seatAvailable => _t('Available', 'متاح');
  String get seatSelected => _t('Selected', 'مختار');
  String get seatTaken => _t('Taken', 'محجوز');
  String seatSemantics(String label, String state) => _t('Seat $label, $state', 'المقعد $label، $state');
  String get maxSeats => _t('You can book up to 10 seats at a time.', 'يمكنك حجز 10 مقاعد كحد أقصى في المرة الواحدة.');
  String get noSeatSelected => _t('Tap a seat to select it.', 'اضغط على مقعد لاختياره.');
  String seatsChanged(String list) => _t('Seat $list was just taken by someone else. Choose another seat.', 'حُجز المقعد $list للتو من شخص آخر. اختر مقعداً آخر.');
  String get front => _t('Front of coach', 'مقدمة الحافلة');
  String get total => _t('Total', 'الإجمالي');
  String get review => _t('Review booking', 'مراجعة الحجز');
  String get trip => _t('Trip', 'الرحلة');
  String get seat => _t('Seat', 'المقعد');
  String get seats => _t('Seats', 'المقاعد');
  String get boardingPoint => _t('Boarding point', 'نقطة الصعود');
  String get departure => _t('Departure', 'المغادرة');
  String passengerName(String seat) => _t('Passenger name, seat $seat', 'اسم المسافر، المقعد $seat');
  String get nameRequired => _t('Enter the full name (at least 2 letters).', 'أدخل الاسم كاملاً (حرفان على الأقل).');
  String get mobile => _t('Mobile number', 'رقم الجوال');
  String get mobileHint => '0912345678';
  String get mobileInvalid => _t('Enter a valid mobile number, for example 0912345678.', 'أدخل رقم جوال صحيحاً، مثل 0912345678.');
  String get travellers => _t('Travellers', 'المسافرون');
  String payAtStation(int minutes) => _t('Your seats are held for $minutes minutes. Pay at the company station to receive your ticket.', 'تُحجز مقاعدك لمدة $minutes دقيقة. ادفع في محطة الشركة لتستلم تذكرتك.');
  String get reserveSeats => _t('Reserve seats', 'احجز المقاعد');
  String get reserving => _t('Reserving', 'جارٍ الحجز');
  String get tripNotBookable => _t('This trip can no longer be booked.', 'لم يعد بالإمكان حجز هذه الرحلة.');
  String get reservationFailed => _t('The reservation was not completed. Check the details and try again.', 'لم يكتمل الحجز. راجع البيانات وأعد المحاولة.');
  String get reserved => _t('Seats reserved', 'تم حجز المقاعد');
  String get reference => _t('Booking reference', 'رقم الحجز');
  String payBy(String time) => _t('Pay at the station before $time', 'ادفع في المحطة قبل $time');
  String get viewMyTrips => _t('View in My Trips', 'عرض في رحلاتي');

  // Passenger: My Trips and tickets
  String get nextDepartureLabel => _t('Next departure', 'الرحلة القادمة');
  String get showTicket => _t('Show ticket', 'عرض التذكرة');
  String get upcoming => _t('Upcoming', 'القادمة');
  String get past => _t('Past and closed', 'السابقة والمغلقة');
  String get noTrips => _t('No trips yet', 'لا توجد رحلات بعد');
  String get noTripsHint => _t('Bookings you make on this phone appear here, even without internet.', 'تظهر هنا الحجوزات التي تجريها من هذا الهاتف، حتى دون إنترنت.');
  String get statusHeld => _t('Reserved, pay at station', 'محجوز، ادفع في المحطة');
  String get statusConfirmed => _t('Paid ticket', 'تذكرة مدفوعة');
  String get statusExpired => _t('Reservation expired', 'انتهت مهلة الحجز');
  String get statusReleased => _t('Reservation released', 'أُلغي الحجز');
  String get statusRefunded => _t('Refunded', 'مسترد');
  String get statusCanceled => _t('Trip cancelled', 'أُلغيت الرحلة');
  String get ticket => _t('Ticket', 'التذكرة');
  String get ticketNumber => _t('Ticket number', 'رقم التذكرة');
  String get noQrYet => _t('Your QR ticket appears here after you pay at the station.', 'تظهر تذكرتك برمز QR هنا بعد الدفع في المحطة.');
  String get noQrClosed => _t('This booking has no valid ticket.', 'لا توجد تذكرة صالحة لهذا الحجز.');
  String qrSemantics(String number) => _t('Ticket QR code for $number', 'رمز QR للتذكرة $number');
  String get showAtBoarding => _t('Show this code to the driver when boarding.', 'اعرض هذا الرمز على السائق عند الصعود.');
  String get demoTicket => _t('Demo ticket, not valid for travel', 'تذكرة تجريبية، غير صالحة للسفر');
  String get passenger => _t('Passenger', 'المسافر');
  String get bookingGone => _t('Safeer no longer has this booking. You can remove it from this phone.', 'لم يعد هذا الحجز موجوداً لدى سفير. يمكنك إزالته من هذا الهاتف.');
  String get remove => _t('Remove from this phone', 'إزالة من هذا الهاتف');
  String ticketOf(int i, int n) => _t('Ticket $i of $n', 'التذكرة $i من $n');
  String get updatedNow => _t('Up to date', 'محدّث');

  // Driver: sign-in
  String get signInTitle => _t('Driver sign-in', 'تسجيل دخول السائق');
  String get signInNote => _t('Use the account your company created for you.', 'استخدم الحساب الذي أنشأته لك شركتك.');
  String get email => _t('Email', 'البريد الإلكتروني');
  String get password => _t('Password', 'كلمة المرور');
  String get showPassword => _t('Show password', 'إظهار كلمة المرور');
  String get hidePassword => _t('Hide password', 'إخفاء كلمة المرور');
  String get signIn => _t('Sign in', 'تسجيل الدخول');
  String get demoSignIn => _t('Continue as demo driver', 'المتابعة كسائق تجريبي');
  String get invalidCredentials => _t('Email or password is incorrect.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  String get fillCredentials => _t('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.');
  String get passwordChangeNeeded => _t('Your password must be changed first. Sign in on the Safeer website once, then try again.', 'يجب تغيير كلمة المرور أولاً. سجّل الدخول في موقع سفير مرة واحدة ثم أعد المحاولة.');
  String get sessionExpired => _t('Your session ended. Sign in again.', 'انتهت الجلسة. سجّل الدخول مرة أخرى.');

  // Driver: trips
  String get todaysTrips => _t("Today's Trips", 'رحلات اليوم');
  String get activeAssignment => _t('Active assignment', 'الرحلة الحالية');
  String get laterTrips => _t('Later trips', 'رحلات لاحقة');
  String get coach => _t('Coach', 'الحافلة');
  String get boarded => _t('Boarded', 'صعدوا');
  String boardedOf(int b, int e) => _t('$b of $e boarded', 'صعد $b من $e');
  String get scanTicket => _t('Scan ticket', 'مسح التذكرة');
  String get passengers => _t('Passengers', 'المسافرون');
  String get noAssignedTrips => _t('No assigned trips', 'لا توجد رحلات مسندة');
  String get noAssignedTripsHint => _t('Trips your company assigns to you appear here.', 'تظهر هنا الرحلات التي تسندها إليك شركتك.');
  String get boardingOpen => _t('Boarding open', 'الصعود مفتوح');
  String get boardingNotOpen => _t('Boarding opens 24 hours before departure', 'يبدأ الصعود قبل 24 ساعة من المغادرة');
  String get departed => _t('Departed', 'غادرت');
  String get arrived => _t('Arrived', 'وصلت');
  String get pendingShort => _t('Pending', 'معلّقة');
  String pendingCount(int n) => _t('$n pending verification', 'بانتظار التحقق: $n');
  String get retryNow => _t('Check now', 'تحقق الآن');
  String get loadingTrip => _t('Loading trip', 'جارٍ تحميل الرحلة');

  // Driver: scanner and results
  String get aimAtQr => _t('Point the camera at the ticket QR code', 'وجّه الكاميرا نحو رمز QR في التذكرة');
  String get torchOn => _t('Turn light on', 'تشغيل الضوء');
  String get torchOff => _t('Turn light off', 'إطفاء الضوء');
  String get typeTicketNumber => _t('Type ticket number', 'اكتب رقم التذكرة');
  String get ticketNumberHint => 'TKT-12345678';
  String get ticketNumberInvalid => _t('Use the number printed on the ticket, like TKT-12345678.', 'استخدم الرقم المطبوع على التذكرة، مثل TKT-12345678.');
  String get checkTicket => _t('Check ticket', 'تحقق من التذكرة');
  String get boardPassenger => _t('Board passenger', 'تسجيل صعود المسافر');
  String get cameraDenied => _t('Camera access is off', 'الوصول إلى الكاميرا متوقف');
  String get cameraDeniedHint => _t('Allow the camera for Safeer Driver in Android Settings > Apps, or type the ticket number.', 'اسمح بالكاميرا لتطبيق سفير السائق من إعدادات أندرويد > التطبيقات، أو اكتب رقم التذكرة.');
  String get cameraUnavailable => _t("The camera can't start. Type the ticket number instead.", 'تعذر تشغيل الكاميرا. اكتب رقم التذكرة بدلاً من ذلك.');
  String get checking => _t('Checking ticket', 'جارٍ التحقق من التذكرة');
  String get scanNext => _t('Scan next', 'امسح التالية');
  String get resBoarded => _t('Valid, boarded', 'صالحة، تم الصعود');
  String get resVerified => _t('Valid ticket, not boarded yet', 'تذكرة صالحة، لم يُسجّل الصعود بعد');
  String get resAlready => _t('Already scanned', 'مُسحت من قبل');
  String resAlreadyHint(String time) => _t('Boarded at $time. Not counted again.', 'صعد الساعة $time. لن يُحتسب مرة أخرى.');
  String get resWrongTrip => _t('Wrong trip', 'رحلة خاطئة');
  String get resWrongTripHint => _t('This ticket is for a different trip. Boarding was not recorded.', 'هذه التذكرة لرحلة أخرى. لم يُسجّل الصعود.');
  String get resInvalid => _t('Invalid ticket', 'تذكرة غير صالحة');
  String get resInvalidHint => _t('Not a valid ticket for this trip, or it was refunded or cancelled.', 'ليست تذكرة صالحة لهذه الرحلة، أو تم استردادها أو إلغاؤها.');
  String get resNotSafeer => _t('This code is not a Safeer ticket.', 'هذا الرمز ليس تذكرة سفير.');
  String get resPending => _t('Pending verification', 'بانتظار التحقق');
  String get resPendingHint => _t('No connection. The scan is saved and will be checked when the connection returns. It is not counted as boarded.', 'لا يوجد اتصال. حُفظ المسح وسيُتحقق منه عند عودة الاتصال. لم يُحتسب كصعود.');
  String get resClosed => _t('Boarding closed', 'الصعود مغلق');
  String get resClosedHint => _t('Boarding opens 24 hours before departure and closes at departure or arrival.', 'يبدأ الصعود قبل 24 ساعة من المغادرة ويُغلق عند المغادرة أو الوصول.');

  // Driver: passengers
  String get expected => _t('Expected', 'المتوقعون');
  String get notBoarded => _t('Not boarded', 'لم يصعدوا');
  String get all => _t('All', 'الكل');
  String get searchPassengers => _t('Search name or ticket reference', 'ابحث بالاسم أو رقم التذكرة');
  String get noMatches => _t('No passengers match.', 'لا يوجد مسافرون مطابقون.');
  String get noPassengersYet => _t('No tickets for this trip yet.', 'لا توجد تذاكر لهذه الرحلة بعد.');
  String get nameRemoved => _t('Name removed', 'تم حذف الاسم');
  String get notValid => _t('Not valid', 'غير صالحة');
  String boardedAt(String time) => _t('Boarded $time', 'صعد $time');
  String get pendingSection => _t('Pending verification', 'بانتظار التحقق');
  String scannedAt(String time) => _t('Scanned $time, waiting for connection', 'مُسحت $time، بانتظار الاتصال');
  String get checkedLater => _t('Checked after reconnecting', 'تم التحقق بعد عودة الاتصال');
  String get simulateOffline => _t('Simulate no connection (demo)', 'محاكاة انقطاع الاتصال (تجريبي)');
  String get demoCodes => _t('Demo ticket numbers', 'أرقام تذاكر تجريبية');
  String get demoValid => _t('valid for the active trip', 'صالحة للرحلة الحالية');
  String get demoWrongTrip => _t('ticket for another trip', 'تذكرة لرحلة أخرى');
  String get demoRefunded => _t('refunded ticket', 'تذكرة مستردة');
}

class _Delegate extends LocalizationsDelegate<SafeerStrings> {
  const _Delegate();
  @override
  bool isSupported(Locale locale) => ['en', 'ar'].contains(locale.languageCode);
  @override
  Future<SafeerStrings> load(Locale locale) async => SafeerStrings(locale);
  @override
  bool shouldReload(_Delegate old) => false;
}
