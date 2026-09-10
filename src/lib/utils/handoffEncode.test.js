import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFF_MAX_LONG_EDGE, handoffOutputSize } from './handoffEncode.js';

test('handoff cap is 3200', () => {
	assert.equal(HANDOFF_MAX_LONG_EDGE, 3200);
});

test('leaves already-small images unchanged', () => {
	assert.deepEqual(handoffOutputSize(1280, 960), { width: 1280, height: 960 });
	assert.deepEqual(handoffOutputSize(3200, 2400), { width: 3200, height: 2400 });
});

test('scales the long edge down to the cap', () => {
	assert.deepEqual(handoffOutputSize(4096, 3072), { width: 3200, height: 2400 });
	assert.deepEqual(handoffOutputSize(3072, 4096), { width: 2400, height: 3200 });
});

test('uses custom maxLong when passed', () => {
	assert.deepEqual(handoffOutputSize(2000, 1000, 1000), { width: 1000, height: 500 });
});

test('guards missing dimensions', () => {
	assert.deepEqual(handoffOutputSize(0, 100), { width: 1, height: 1 });
	assert.deepEqual(handoffOutputSize(100, 0), { width: 1, height: 1 });
});
