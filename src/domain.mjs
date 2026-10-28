// Local prototype rules only. Browser scoping does not replace production authentication.
export const cities = ['Khartoum', 'Atbara', 'Port Sudan', 'Wad Madani'];
export const categories = ['General goods', 'Parcels', 'Agricultural goods'];
const reference = prefix => `DEMO-${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

function companyFor(state, companyId) {
  const company = state.companies.find(row => row.id === companyId);
  if (!company) throw Error('Choose a company.');
  return company;
}

export function workspaceFor(state, companyId) {
  const company = companyFor(state, companyId);
  const own = rows => rows.filter(row => row.companyId === companyId);
  return {company, trips: own(state.trips), reservations: own(state.reservations), freightRequests: own(state.freightRequests)};
}

export function expireReservations(state, now = Date.now()) {
  let changed = false;
  for (const reservation of state.reservations) {
    if (reservation.status === 'reserved' && now >= reservation.expiresAt) {
      reservation.status = 'expired'; changed = true;
    }
  }
  return changed;
}

export function occupiedSeats(state, tripId, now = Date.now()) {
  const trip = state.trips.find(row => row.id === tripId);
  if (!trip) throw Error('Trip not found.');
  return new Set([...trip.blockedSeats, ...state.reservations.filter(row => row.tripId === tripId && row.status === 'reserved' && row.expiresAt > now).map(row => row.seat)]);
}

export function reserveSeat(state, companyId, {tripId, seat, passengerName}, now = Date.now()) {
  const company = companyFor(state, companyId);
  const trip = state.trips.find(row => row.id === tripId && row.companyId === companyId);
  if (!trip) throw Error('Trip not found in this company.');
  if (trip.departureAt <= now) throw Error('This trip has departed.');
  if (typeof passengerName !== 'string' || !passengerName.trim() || passengerName.trim().length > 80) throw Error('Enter a demo passenger name, up to 80 characters.');
  if (!Number.isInteger(seat) || seat < 1 || seat > trip.capacity) throw Error('Choose a valid seat.');
  expireReservations(state, now);
  if (occupiedSeats(state, tripId, now).has(seat)) throw Error('This seat is unavailable. Choose another.');
  const reservation = {id: crypto.randomUUID(), reference: reference('SF'), companyId, tripId, seat, passengerName: passengerName.trim(), status: 'reserved', createdAt: now, expiresAt: Math.min(now + company.holdMinutes * 60000, trip.departureAt)};
  state.reservations.unshift(reservation);
  return reservation;
}

export function cancelReservation(state, companyId, id, now = Date.now()) {
  companyFor(state, companyId); expireReservations(state, now);
  const reservation = state.reservations.find(row => row.id === id && row.companyId === companyId);
  if (!reservation) throw Error('Reservation not found in this company.');
  if (reservation.status !== 'reserved') throw Error('Only an active reservation can be cancelled.');
  reservation.status = 'cancelled';
}

export function setHoldMinutes(state, companyId, minutes) {
  const company = companyFor(state, companyId);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) throw Error('Choose a whole number from 5 to 1440 minutes.');
  company.holdMinutes = minutes; // Existing reservations keep their original agreed deadline.
}

export function requestFreight(state, companyId, values, now = Date.now()) {
  companyFor(state, companyId);
  if (typeof values.customerName !== 'string' || !values.customerName.trim() || values.customerName.trim().length > 80) throw Error('Enter a demo customer name, up to 80 characters.');
  if (!cities.includes(values.from) || !cities.includes(values.to) || values.from === values.to) throw Error('Choose different origin and destination cities.');
  if (!categories.includes(values.category)) throw Error('Choose a cargo category.');
  if (!Number.isInteger(values.packages) || values.packages < 1 || values.packages > 10000) throw Error('Enter a valid package count.');
  if (!Number.isFinite(values.weightKg) || values.weightKg <= 0 || values.weightKg > 1000000) throw Error('Enter a valid weight in kilograms.');
  const row = {id: crypto.randomUUID(), reference: reference('CG'), companyId, customerName: values.customerName.trim(), from: values.from, to: values.to, category: values.category, packages: values.packages, weightKg: values.weightKg, status: 'requested', createdAt: now};
  state.freightRequests.unshift(row);
  return row;
}
