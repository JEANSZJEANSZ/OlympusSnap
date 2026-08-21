import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPointInRect } from './hitTest.js';

const rect = { left: 100, right: 200, top: 400, bottom: 500 };

test('hits the center of a rect', () => {
	assert.equal(isPointInRect(150, 450, rect), true);
});

test('misses outside a rect', () => {
	assert.equal(isPointInRect(10, 10, rect), false);
});

test('pad expands the hit area', () => {
	assert.equal(isPointInRect(90, 450, rect, 0), false);
	assert.equal(isPointInRect(90, 450, rect, 16), true);
});

test('rejects missing rects', () => {
	assert.equal(isPointInRect(1, 1, null), false);
	assert.equal(isPointInRect(1, 1, undefined), false);
});
