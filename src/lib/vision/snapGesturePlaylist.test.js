import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapGesturePlaylist, SNAP_GESTURE_CYCLE } from './snapGesturePlaylist.js';

test('one canvas picks a single pose from the cycle', () => {
	let i = 0;
	const seq = [0.0, 0.4, 0.9];
	const rand = () => seq[i++] ?? 0;
	assert.deepEqual(buildSnapGesturePlaylist(1, rand), ['Victory']);
	assert.deepEqual(buildSnapGesturePlaylist(1, rand), ['Open_Palm']);
	assert.deepEqual(buildSnapGesturePlaylist(1, rand), ['Thumb_Up']);
});

test('two canvases pick two unique poses in shuffled order', () => {
	const rand = () => 0;
	const pair = buildSnapGesturePlaylist(2, rand);
	assert.equal(pair.length, 2);
	assert.notEqual(pair[0], pair[1]);
	for (const kind of pair) {
		assert.equal(SNAP_GESTURE_CYCLE.includes(kind), true);
	}
});

test('three canvases use the canonical cycle', () => {
	assert.deepEqual(buildSnapGesturePlaylist(3), [...SNAP_GESTURE_CYCLE]);
});

test('four canvases wrap Victory after the trio', () => {
	assert.deepEqual(buildSnapGesturePlaylist(4), [...SNAP_GESTURE_CYCLE, 'Victory']);
});

test('invalid count falls back to one random pose', () => {
	assert.equal(buildSnapGesturePlaylist(0, () => 0).length, 1);
	assert.equal(buildSnapGesturePlaylist(-2, () => 0).length, 1);
});
