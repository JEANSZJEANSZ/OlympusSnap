import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFF_MAX_LONG_EDGE, handoffOutputSize } from './handoffEncode.js';

test('handoff cap is 1600', () => {
	assert.equal(HANDOFF_MAX_LONG_EDGE, 1600);
});

test('leaves already-small images unchanged', () => {
	assert.deepEqual(handoffOutputSize(1280, 960), { width: 1280, height: 960 });
});

test('scales the long edge down to the cap', () => {
	assert.deepEqual(handoffOutputSize(3200, 2400), { width: 1600, height: 1200 });
	assert.deepEqual(handoffOutputSize(2400, 3200), { width: 1200, height: 1600 });
});

test('uses custom maxLong when passed', () => {
	assert.deepEqual(handoffOutputSize(2000, 1000, 1000), { width: 1000, height: 500 });
});

test('guards missing dimensions', () => {
	assert.deepEqual(handoffOutputSize(0, 100), { width: 1, height: 1 });
	assert.deepEqual(handoffOutputSize(100, 0), { width: 1, height: 1 });
});
