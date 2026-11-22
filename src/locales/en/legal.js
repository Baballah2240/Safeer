// English text: privacy policy and account deletion pages (moved from src/legal.js).
// contact is the support e-mail link (HTML) or a placeholder.
// contact is null until a support address is configured.
export default contact=>{
 contact=contact??"(contact address is added before publishing)";
 const T=({
  privacy:'Privacy policy',terms:'Terms of use',cardsHeading:'Card payments',deletion:'Delete your account and data',updated:'Last updated 12 November 2026',
  back:'Back',other:'العربية',
  privacyBody:[
   ['Who we are','Safeer is a bus booking and station management service used by approved bus companies. The Safeer Booking and Safeer Driver apps show the same Safeer service.'],
   ['What we collect',`<ul><li><b>Passengers:</b> each traveler's full name, one mobile number per booking, an optional luggage description, chosen seats, booking reference, tickets, payments recorded at the station and bag tags.</li><li><b>Passenger accounts (optional):</b> if you choose Sign in with Google, Google gives us your Google account ID, email address and name. You can change the name and add a mobile number and up to ten people you travel with. We also keep which bookings are saved to your account and your sign-in sessions. We never receive your Google password, and we do not keep your Google profile photo or use your contacts or any other Google data.</li><li><b>Shipments:</b> the sender's and receiver's names and mobile numbers, the destination office, item types, weights and optional descriptions, the fee paid and the tracking code. Public tracking shows only the status and offices, never names or numbers.</li><li><b>Staff and drivers:</b> name, work email, password (stored only as a one-way hash), role, company, sign-in sessions with device type, and an audit history of actions.</li><li><b>Technical:</b> session cookies needed to stay signed in (staff and passenger accounts use separate ones) and your theme, language and sidebar choices stored on your device.</li></ul>We do not collect location, contacts, photos or microphone data, and we show no advertising.`],
   ['How we use it','To hold seats, issue tickets and receipts, track luggage, let drivers check tickets and board passengers, keep financial records, keep a signed-in passenger\'s details and bookings together, and protect accounts from misuse.'],
   ['Who receives it','Your booking details go only to the bus company operating your trip. Safeer does not sell personal data or share it with advertisers. Payments are recorded by the company at its station, or made by card where the company offers it.'],
   ['Google sign-in','Safeer asks Google only for basic sign-in information: your Google account ID, email address and name. We use it to create and protect your passenger account, fill in your details at checkout and show the bookings saved to your account on any device. Your Google email and account ID are not shared with bus companies; a booking carries only the traveler names and mobile number entered at checkout. We do not sell this information or use it for advertising. Safeer\'s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.'],
   ['Card payments','Where a bus company accepts cards, you pay on the secure card page of Paymob, a licensed payment provider. Safeer never sees or stores your card number, expiry date or security code. Paymob tells Safeer only whether the payment succeeded, the amount, a transaction number and the last four digits of the card. A refund for a card payment goes back to the same card through Paymob.'],
   ['Crash reports','When the Safeer Driver or Safeer Passenger app crashes, it sends a crash report to Google Firebase Crashlytics: the error, the app version, the phone model and Android version, and a random installation ID. Reports never include names, phone numbers, tickets or sign-in details. We use them only to fix crashes.'],
   ['How long we keep it','Passenger names, mobile numbers and luggage notes, and shipment sender and receiver details and item descriptions, are erased automatically 90 days after the trip ends. Financial records (amounts, receipt and ticket numbers) are kept as required for accounting. Staff accounts stay until the company or the platform administrator removes them. Service contracts and invoices between Safeer and a transport company, including the contact email, phone and address of the company and the names of the people who issued and accepted them, are kept as business and tax records for as long as the law requires, even after the company stops using Safeer. A passenger account and the details saved in it stay until you delete the account; deleting it does not cancel your bookings. Sign-in sessions stop working after 30 days or when you sign out.'],
   ['Security','Data travels over encrypted connections. Passwords are hashed, access follows each person\'s company and role, and sensitive actions require the current password.'],
   ['Your choices',`You can ask to see, correct or delete your data. If you have a passenger account, you can change your details or delete the account yourself in Profile. See <a href="/account-deletion?lang=en">Delete your account and data</a>. Contact: ${contact}.`],
  ],
  deletionBody:[
   ['Staff and driver accounts',`Ask your company manager to deactivate and delete your account, or send a deletion request from your work email to ${contact}. We confirm your identity, delete the account and its sessions within 30 days, and tell you when it is done.`],
   ['Passenger accounts',`If you signed in with Google, open <a href="/marketplace?view=profile&amp;lang=en">Profile</a> on the Safeer website, sign in and choose Delete account. This immediately removes your account, saved details and travelers, the links to your bookings and your sign-in sessions. Your bookings are not canceled: they stay as guest bookings, and their passenger details are erased 90 days after the trip like every booking. You can also remove Safeer's access in your Google Account at <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a>.`],
   ['Passenger bookings',`Booking details are erased automatically 90 days after the trip, with or without an account. To have them erased sooner, send your booking reference and mobile number to ${contact} or ask the bus company at its station.`],
   ['What is kept','Financial records that the law or accounting requires (amounts, ticket and receipt numbers) are kept without your name and mobile number. Audit entries keep the action but not your personal details after deletion.'],
  ]});
 T.privacyBody.push(['Driver camera','Camera access in the Driver app is optional for scanning ticket QR codes. Frames are processed on your device and are never uploaded or saved. Only the ticket code is sent over the encrypted connection for validation and boarding. We do not request microphone permission or record audio. You can enter a printed ticket number instead.']);
 return T;
};

// D139: what changes by country. name: the country's name; c: its entry in src/legal-countries.js; contact as above.
export const countryText=(name,c,contact)=>{
 contact=contact??"(contact address is added before publishing)";
 const law=c.law?.[0],regulator=c.regulator?.[0],consumer=c.consumer?.[0];
 return {
  country:'Country',
  draft:`Safeer is not yet available in ${name}. This page shows what will apply there; it will be checked by a local lawyer before Safeer launches in ${name}.`,
  privacy:[`Your rights in ${name}`,law
   ?`In ${name}, your personal data is handled in line with the ${law}. You can ask to see, correct or delete your data and object to its use by writing to ${contact}.${regulator?` If you are not satisfied with our answer, you can complain to ${regulator}.`:''}`
   :`${name} has no general personal data law yet. Safeer gives the same protections described on this page in every country, and you keep all the choices listed above. Write to ${contact}.`],
  deletion:[`Requests from ${name}`,`Requests from ${name} are handled the same way and answered within 30 days.${law?` This page does not limit your rights under the ${law}.`:''}`],
  terms:[
   ['What Safeer is','Safeer is a booking and ticketing service. The bus company named on your booking runs the trip and is responsible for the journey, the bus, the driver and its own rules. Safeer holds the seats, issues the tickets and keeps the records for that company.'],
   ['Holding and paying','A hold keeps your seats for the time shown when you book (between one and three hours). If it is not paid in time, the seats are released automatically. A booking is confirmed only when the bus company records your payment at its station'+(c.cards?' or your card payment succeeds':'')+'.'],
   ['Prices','The bus company sets the fares. You pay the price shown when you hold the seats, in the currency shown.'],
   ['Changes, cancellations and refunds','Each bus company sets its own change, cancellation and refund rules; ask at the station or contact the company. If the company cancels your trip, you are entitled to a refund.'+(c.cards?' Card payments are refunded to the same card through '+c.provider+'.':'')],
   ['Tickets and boarding','Show your ticket QR code or ticket number to the driver. Each ticket boards once. Arrive at the station in good time; the bus company decides how early.'],
   ['Luggage and shipments','Describe your luggage and shipments truthfully. The bus company decides what it carries, including size, weight and forbidden items.'],
   ['Your account','Keep your sign-in safe. Safeer may suspend an account that is used for misuse, fraud or to harm others.'],
   [`The law in ${name}`,`These terms do not remove any right you have under the law of ${name}${consumer?`, including the ${consumer}`:''}. If something goes wrong, first ask the bus company; if it is not solved, write to ${contact}.`],
   ['Changes to these terms','We may update these terms. The date at the top shows the latest version; a booking keeps the terms that applied when it was made.'],
  ],
 };
};
