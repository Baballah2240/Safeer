import test from 'node:test';
import assert from 'node:assert/strict';
import {inRange} from '../src/list-page.js';

// D94: list presets count days in the company's time zone, back from today.
test('list date presets use the company calendar', () => {
  const now = Date.parse('2026-11-16T22:30:00Z'); // 00:30 on 17 Nov in Khartoum (UTC+2)
  const zone = 'Africa/Khartoum';
  assert.equal(inRange('2026-11-16T22:10:00Z', 'today', zone, now), true);
  assert.equal(inRange('2026-11-16T20:00:00Z', 'today', zone, now), false);
  assert.equal(inRange('2026-11-11T00:00:00Z', '7', zone, now), true);
  assert.equal(inRange('2026-11-10T20:00:00Z', '7', zone, now), false);
  assert.equal(inRange('2026-11-18T12:00:00Z', '30', zone, now), false);
  assert.equal(inRange('2020-01-01T00:00:00Z', 'all', zone, now), true);
  assert.equal(inRange(null, '7', zone, now), true);
});
