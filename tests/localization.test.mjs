import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../src/demo.mjs';
import {translate} from '../src/i18n.js';

test('Arabic translates runtime city/status values, not only literal UI labels', () => {
  const values = new Set(createDemo().trips.flatMap(trip => [trip.from, trip.to]));
  for (const value of [...values, 'reserved', 'expired', 'cancelled', 'Section 01', 'Sudan']) {
    assert.notEqual(translate(value, 'ar'), value, 'Missing dynamic translation: ' + value);
    assert.equal(translate(value, 'en'), value);
  }
});
