import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.SKIP_DB_CONNECT = 'true';
process.env.OPENAI_API_KEY = 'test-key';

const app = (await import('./src/app.js')).default;

test('learning endpoints require authentication', async () => {
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/api/lektions`);
    assert.equal(response.status, 401, 'Expected unauthenticated lesson requests to return 401');
  } finally {
    server.close();
  }
});
