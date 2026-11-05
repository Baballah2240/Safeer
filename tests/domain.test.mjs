import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../src/demo.mjs';
import {workspaceFor, reserveSeat, occupiedSeats, expireReservations, cancelReservation, setHoldMinutes} from '../src/domain.mjs';

const now = Date.parse('2026-10-28T08:00:00Z');
const passenger = {tripId:'nile-01', seat:1, passengerName:'Invented passenger'};

test('unpaid reservations use company policy, prevent duplicate seats and release at the exact deadline', () => {
  const state=createDemo(now), row=reserveSeat(state,'nile-demo',passenger,now);
  assert.equal(row.status,'reserved'); assert.equal(row.expiresAt,now+30*60000);
  assert.ok(occupiedSeats(state,'nile-01',now).has(1));
  assert.throws(()=>reserveSeat(state,'nile-demo',passenger,now),/unavailable/);
  assert.equal(expireReservations(state,row.expiresAt-1),false);
  assert.equal(expireReservations(state,row.expiresAt),true);
  assert.equal(row.status,'expired'); assert.equal(occupiedSeats(state,'nile-01',row.expiresAt).has(1),false);
  assert.equal(reserveSeat(state,'nile-demo',passenger,row.expiresAt).seat,1);
});

test('company workspaces and mutations cannot accidentally address another company records', () => {
  const state=createDemo(now), own=workspaceFor(state,'coast-demo');
  assert.ok(own.trips.every(row=>row.companyId==='coast-demo'));
  assert.equal(own.reservations.length,0); assert.equal(Object.hasOwn(own,'freightRequests'),false);
  assert.throws(()=>reserveSeat(state,'coast-demo',passenger,now),/this company/);
  assert.throws(()=>cancelReservation(state,'coast-demo','sample-reservation',now),/this company/);
  assert.throws(()=>workspaceFor(state,'unknown'),/Choose a company/);
  assert.equal(state.reservations[0].status,'reserved');
});

test('policy changes affect only new holds; departure caps a hold and past trips reject booking', () => {
  const state=createDemo(now), first=reserveSeat(state,'nile-demo',passenger,now);
  setHoldMinutes(state,'nile-demo',60);
  const next=reserveSeat(state,'nile-demo',{...passenger,seat:4},now);
  assert.equal(first.expiresAt,now+30*60000); assert.equal(next.expiresAt,now+60*60000);
  assert.equal(state.companies[1].holdMinutes,45);
  state.trips[0].departureAt=now+120000;
  assert.equal(reserveSeat(state,'nile-demo',{...passenger,seat:6},now).expiresAt,now+120000);
  assert.throws(()=>reserveSeat(state,'nile-demo',{...passenger,seat:9},now+120000),/departed/);
  for(const minutes of [0,4,1441,1.5,NaN])assert.throws(()=>setHoldMinutes(state,'nile-demo',minutes));
});

test('cancellation releases only the intended active seat and malformed reservations are rejected', () => {
  const state=createDemo(now), row=reserveSeat(state,'nile-demo',passenger,now);
  cancelReservation(state,'nile-demo',row.id,now); assert.equal(row.status,'cancelled');
  assert.equal(occupiedSeats(state,'nile-01',now).has(1),false); assert.equal(occupiedSeats(state,'nile-01',now).has(2),true);
  assert.throws(()=>cancelReservation(state,'nile-demo',row.id,now),/active/);
  for(const seat of [0,41,1.5,'1'])assert.throws(()=>reserveSeat(state,'nile-demo',{...passenger,seat},now));
  for(const passengerName of ['',null,'x'.repeat(81)])assert.throws(()=>reserveSeat(state,'nile-demo',{...passenger,passengerName},now));
});

test('luggage declarations require a bounded description only when luggage is selected, before allocating a seat', () => {
  const state=createDemo(now), count=state.reservations.length;
  for(const luggageDescription of ['', '   ', null, {}, 'x'.repeat(301)]) {
    assert.throws(()=>reserveSeat(state,'nile-demo',{...passenger,hasLuggage:true,luggageDescription},now),/Describe the luggage/);
  }
  for(const hasLuggage of ['yes', 1, null]) {
    assert.throws(()=>reserveSeat(state,'nile-demo',{...passenger,hasLuggage},now),/whether the passenger/);
  }
  assert.equal(state.reservations.length,count);
  assert.equal(occupiedSeats(state,'nile-01',now).has(1),false);
  const row=reserveSeat(state,'nile-demo',{...passenger,hasLuggage:true,luggageDescription:'  حقيبة زرقاء <b>Demo</b>\nحزام أحمر  '},now);
  assert.equal(row.hasLuggage,true);
  assert.equal(row.luggageDescription,'حقيبة زرقاء <b>Demo</b>\nحزام أحمر');
  const maximum=reserveSeat(state,'nile-demo',{...passenger,seat:4,hasLuggage:true,luggageDescription:'x'.repeat(300)},now);
  assert.equal(maximum.luggageDescription.length,300);
  const without=reserveSeat(state,'nile-demo',{...passenger,seat:6,hasLuggage:false,luggageDescription:'old draft'},now);
  assert.equal(without.hasLuggage,false); assert.equal(without.luggageDescription,'');
  const legacy=reserveSeat(state,'nile-demo',{...passenger,seat:9},now);
  assert.equal(legacy.hasLuggage,false); assert.equal(legacy.luggageDescription,'');
  cancelReservation(state,'nile-demo',row.id,now);
  assert.equal(row.luggageDescription,'حقيبة زرقاء <b>Demo</b>\nحزام أحمر');
  assert.equal(workspaceFor(state,'coast-demo').reservations.some(item=>item.id===row.id),false);
});
