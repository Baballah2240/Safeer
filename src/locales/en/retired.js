// English text: notice shown by the retired Android apps (moved from src/app-retired.js).
// passenger: true for the old booking app, false for the old driver app.
export default passenger=>({
  old:passenger?'Safeer Booking app':'Safeer Driver app',
  title:'This app has been replaced',
  lead:passenger?'Safeer has a new app for passengers, Safeer Passenger. This version no longer opens Safeer.':'Safeer has a new app for drivers, Safeer Driver. This version no longer opens Safeer.',
  download:passenger?'Download Safeer Passenger':'Download Safeer Driver',
  meta:(version,size)=>`Android 8 or later · version <bdi>${version}</bdi>${size?` · <bdi>${size}</bdi>&nbsp;MB`:''}`,
  steps:['Tap Download.','Open the downloaded file and tap Update. The new app installs over this one.',passenger?'Open Safeer Passenger.':'Open Safeer Driver and sign in with your driver account.'],
  note:passenger?'Booked with this app before? In your phone’s browser, open <bdi dir="ltr">safeer.mohbaba.online/booking</bdi> and use Find your booking with the booking reference and mobile number.':'Your trips and boarding records stay on Safeer.',
  other:'العربية',otherLang:'ar',otherLabel:'التبديل إلى العربية'
 });
