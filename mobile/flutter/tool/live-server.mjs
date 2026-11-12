// Disposable Safeer server for the Flutter live-API tests (D74). Fictional data in a throwaway
// database from SAFEER_TEST_DATABASE_URL; never runtime/ or the hosted site.
// Usage: node mobile/flutter/tool/live-server.mjs <configOut> <stopFile> (run-live-tests.mjs does this).
import {existsSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {join} from 'node:path';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const [configOut, stopFile] = process.argv.slice(2);
const load = (p) => import(pathToFileURL(join(repo, p)).href);
const {identityFixture} = await load('tests/support/identity-db.mjs');
const {setup, staff, ok} = await load('tests/support/boarding-fixture.mjs');
const {startServer} = await load('server.mjs');

const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
});
const webPort = await freePort();
const webOrigin = `http://127.0.0.1:${webPort}`;
const khartoumDay = (at) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Khartoum'}).format(at);

await identityFixture(async (f) => {
  const s = await setup(f, 'flutter-live');
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  // Same coach and driver: the trips must not overlap (the server refuses double assignment).
  const trip1 = await s.trip([day(10)]), trip2 = await s.trip([day(11)]);
  // Departures one and four hours from now: boarding is open (it opens 24 hours before).
  const move = async (id, offset) => {
    await f.migration.query('SET session_replication_role=replica');
    try { await f.migration.query("UPDATE safeer.trips SET departure_at=clock_timestamp()+$2::interval,arrival_at=clock_timestamp()+$2::interval+interval '120 minutes' WHERE id=$1", [id, offset]); }
    finally { await f.migration.query('SET session_replication_role=DEFAULT'); }
  };
  await move(trip1, '1 hour');
  await move(trip2, '4 hours');

  // A paid ticket on each trip, booked through the public route with a key we keep.
  const paid = async (tripId, seat) => {
    const key = randomUUID();
    const hold = ok(await f.client().request('public/holds', 'POST', {tripId, seats: [seat], key, mobile: '0912345678', travelers: [{seat, name: 'Fictional Traveller ' + seat}]}));
    const bid = (await f.migration.query('SELECT id FROM safeer.bookings WHERE reference=$1', [hold.reference])).rows[0].id;
    ok(await f.admin.request(`${s.base}/bookings/${bid}/pay`, 'POST', {method: 'cash', key: randomUUID()}));
    const row = ok(await f.admin.request(`${s.base}/bookings/${bid}`), 200);
    const printed = ok(await f.admin.request(`${s.base}/bookings/${bid}/print`, 'POST', {document: 'tickets'}));
    return {reference: hold.reference, key, ticket: row.tickets[0].number, token: printed.codes[0].token, seat};
  };
  const t1 = await paid(trip1, '1'), t2 = await paid(trip2, '1');

  // A driver account linked to the company driver assigned to both trips.
  const driver = await staff(f, s, ['company.driver.operate']);
  const login = (await driver.c.request('auth/me')).data.login;
  const member = (await f.migration.query('SELECT id FROM safeer.company_users WHERE user_id=(SELECT id FROM safeer.users WHERE normalized_login=$1)', [login])).rows[0].id;
  await f.migration.query('UPDATE safeer.drivers SET member_id=$1 WHERE company_id=$2', [member, s.cid]);
  await driver.c.request('auth/logout', 'POST', {});

  const cities = ok(await f.client().request('public/cities'), 200).items;
  const departure = (await f.migration.query('SELECT departure_at FROM safeer.trips WHERE id=$1', [trip1])).rows[0].departure_at;

  const web = await startServer({port: webPort, identityApiUrl: f.api.origin});
  try {
    writeFileSync(configOut, JSON.stringify({
      origin: webOrigin, companyId: s.cid, trip1, trip2,
      from: cities.find((c) => c.code.endsWith('_AA')).code, to: cities.find((c) => c.code.endsWith('_BB')).code,
      date: khartoumDay(departure), paid1: t1, paid2: t2, driver: {email: login, password: driver.pass},
    }, null, 2));
    console.log('READY ' + webOrigin);
    while (!existsSync(stopFile)) await new Promise((r) => setTimeout(r, 500));
  } finally {
    await web.close();
  }
}, {webOrigin});
console.log('STOPPED');
