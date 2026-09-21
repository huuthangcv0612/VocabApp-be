import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import 'dotenv/config';

process.env.SKIP_DB_CONNECT = 'true';

const app = (await import('./src/app.js')).default;
const azureTTSService = await import('./src/services/azureTTSService.js');

test('AI Conversation Azure TTS Feature Test Suite', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await t.test('CASE 1: Live Azure TTS - "Hallo! Wie geht es dir?"', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hallo! Wie geht es dir?' }),
      });

      assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      assert.ok(buffer.length > 100, `Expected MP3 buffer length > 100 bytes, got ${buffer.length}`);
    });

    await t.test('CASE 2: Live Azure TTS - "Guten Morgen! Heute lernen wir Deutsch."', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Guten Morgen! Heute lernen wir Deutsch.' }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');

      const buffer = Buffer.from(await res.arrayBuffer());
      assert.ok(buffer.length > 100);
    });

    await t.test('CASE 3: Alias route /api/ai/conversations/tts also works', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversations/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Auf Wiedersehen!' }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    });

    await t.test('CASE 4: Validation error - Empty body {}', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /field "text" is required/i);
    });

    await t.test('CASE 5: Validation error - Empty string {"text": ""}', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /cannot be empty/i);
    });

    await t.test('CASE 6: Validation error - Whitespace string {"text": "   "}', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '     ' }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /cannot be empty/i);
    });

    await t.test('CASE 7: Validation error - Invalid type {"text": 123}', async () => {
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 123 }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /must be a string/i);
    });

    await t.test('CASE 8: Validation error - Text exceeding max length (>2000 chars)', async () => {
      const longText = 'A'.repeat(2001);
      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: longText }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /exceeds maximum allowed length/i);
    });

    await t.test('CASE 9: Mock provider error does not expose secrets', async () => {
      azureTTSService.setMockTTSProvider(async () => {
        const error = new Error('Azure Speech authentication or connection failed. Please check credentials.');
        error.statusCode = 500;
        throw error;
      });

      const res = await fetch(`${baseUrl}/api/ai/conversation/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Test mock error' }),
      });

      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(!JSON.stringify(data).includes(process.env.AZURE_SPEECH_KEY));

      azureTTSService.resetMockTTSProvider();
    });

  } finally {
    azureTTSService.resetMockTTSProvider();
    server.close();
  }
});
