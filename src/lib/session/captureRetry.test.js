import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetryCaptureAsPng } from './captureRetry.js';

test('retries JPEG only on 415', () => {
	assert.equal(shouldRetryCaptureAsPng(415, 'image/jpeg'), true);
});

test('does not retry PNG, or JPEG on other failures', () => {
	assert.equal(shouldRetryCaptureAsPng(415, 'image/png'), false);
	assert.equal(shouldRetryCaptureAsPng(400, 'image/jpeg'), false);
	assert.equal(shouldRetryCaptureAsPng(500, 'image/jpeg'), false);
	assert.equal(shouldRetryCaptureAsPng(408, 'image/jpeg'), false);
	assert.equal(shouldRetryCaptureAsPng(200, 'image/jpeg'), false);
});
