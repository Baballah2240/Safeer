# Notifications

## Staff (in place, D98)

- The bell beside the menu button shows the number of unread events. It checks the server every 30 seconds while the page is open and visible, and at once when you return to the tab.
- An event that arrives while the page is open also shows a pop-up for 10 seconds with **View** (opens Notifications) and **×**.
- Notifications lists events from the last 90 days. **Mark read** marks one event; **Mark all as read** marks everything you can see.
- Each person sees only events their access in that company allows:

| Event | Who sees it |
|---|---|
| Company registered or status changed, listing changed | Super Administrators and the company |
| Contract issued or accepted, invoice issued or paid | Company profile managers |
| Trip canceled | Trip readers, and the trip's driver |
| Journey incident | Journey managers |
| Cash difference at session close | Finance readers for that station |
| Luggage problem | Luggage resolvers |
| Bank transfer to check (new) | Finance readers for that station |
| Shipment problem reported (new) | Shipment resolvers |
| Booking refunded (new) | Finance readers for that station |

Staff alerts appear only in the web workspace. They do not reach a closed browser or a phone.

Not yet: a trip close to departure without a driver. It depends on time passing rather than on a change, so it needs a scheduled check; the Overview's Needs attention list already shows it.

## Passengers (plan, not built)

Goal: tell passengers when their **trip is canceled** and when a **parcel has arrived** for them to collect, then later booking confirmed, hold about to expire and trip delayed.

### Channels

| Channel | Reaches | Cost | Needs from the owner |
|---|---|---|---|
| App push (Firebase Cloud Messaging) | Passengers with the Safeer Passenger app | Free | A Firebase project with the two Android apps, and the service account key added to the hosting as a secret |
| SMS | Every passenger with a mobile number | Per message | An SMS provider that delivers in Sudan, and its key added to the hosting as a secret |

Recommended: send app push when the passenger's phone has the app registered for that booking, and SMS otherwise, but only for the two important messages (trip canceled, parcel arrived) so SMS cost stays small.

### How a message finds the passenger

- Bookings and shipments already hold a mobile number. That is enough for SMS.
- For app push, the Passenger app registers its device with the bookings it holds (it already keeps their references) and with the signed-in Google account. The server keeps device tokens per booking and per account and removes them when Firebase reports them invalid or the passenger signs out.
- Shipment receivers have no app link; they get SMS.

### Rules

- Messages are written in the language of the booking (Arabic or English) and carry only what is needed: company, route, date and the booking or tracking code. No passenger names.
- Each message is sent once (an outbox table with a unique key per event and recipient), from a background worker after the change is saved, with retries. A failed send never blocks a booking, payment or refund.
- Passengers can turn app notifications off in the app's Settings. SMS for a canceled trip is a service message and is always sent.
- Sends and failures are counted for the company and the platform; message text is not stored longer than needed.

### Work, in order

1. Outbox and worker on the server, with a fake sender in tests.
2. Trip canceled and parcel arrived events written to the outbox.
3. SMS sender, once a provider is chosen.
4. Firebase in both Flutter apps (permission prompt, token registration, opening the right screen), and a new app release.
5. Booking confirmed, hold about to expire and trip delayed.
