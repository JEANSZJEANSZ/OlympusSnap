// src/lib/session/sesCodec.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSes, decodeSes } from './sesCodec.js';

test('round-trips id and key', () => {
	const ses = encodeSes({ id: '550e8400-e29b-41d4-a716-446655440000', key: 'abcd'.repeat(8) });
	assert.equal(decodeSes(ses)?.id, '550e8400-e29b-41d4-a716-446655440000');
	assert.equal(decodeSes(ses)?.key.length, 32);
});

test('returns null for garbage', () => {
	assert.equal(decodeSes('%%%'), null);
	assert.equal(decodeSes(encodeSes({ id: 'a', key: 'b' }).slice(1)), null);
});

test('rejects missing separator', () => {
	const bad = Buffer.from('noidkey', 'utf8').toString('base64url');
	assert.equal(decodeSes(bad), null);
});
