import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSourceBlob, dataUrlToFile, shareCompositeFile } from './shareComposite.js';

const TINY_PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('dataUrlToFile builds a named PNG file', () => {
	const file = dataUrlToFile(TINY_PNG, 'snap.png');
	assert.ok(file);
	assert.equal(file.name, 'snap.png');
	assert.equal(file.type, 'image/png');
	assert.ok(file.size > 0);
});

test('dataUrlToFile rejects non-data URLs', () => {
	assert.equal(dataUrlToFile('https://example.com/a.png'), null);
	assert.equal(dataUrlToFile(''), null);
});

test('captureSourceBlob returns the data-URL bytes', async () => {
	const blob = await captureSourceBlob(TINY_PNG);
	assert.ok(blob);
	assert.equal(blob.type, 'image/png');
	assert.ok(blob.size > 0);
});

test('captureSourceBlob rejects empty and http URLs', async () => {
	assert.equal(await captureSourceBlob(''), null);
	assert.equal(await captureSourceBlob(null), null);
	assert.equal(await captureSourceBlob('https://example.com/a.png'), null);
});

test('shareCompositeFile is unsupported without navigator.share', async () => {
	const result = await shareCompositeFile(TINY_PNG);
	assert.equal(result, 'unsupported');
});
