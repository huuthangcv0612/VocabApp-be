import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.OPENAI_API_KEY = 'test_openai_key';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Vocabulary = (await import('./src/models/Vocabulary.js')).default;

// Generate test JWT tokens
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

test('Admin Vocabulary API Permissions & Validation Flow', async (t) => {
  const server = app.listen(0);
  await once(server, 'listening');

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const mockAdminId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockVocabId = new mongoose.Types.ObjectId().toString();
  const mockLektionId = new mongoose.Types.ObjectId().toString();

  const adminToken = generateToken(mockAdminId);
  const userToken = generateToken(mockUserId);

  // Mock User.findById for authentication middleware
  const originalFindById = User.findById;
  const originalVocabFindById = Vocabulary.findById;
  const originalVocabCreate = Vocabulary.create;
  const originalVocabFindByIdAndUpdate = Vocabulary.findByIdAndUpdate;

  User.findById = (id) => {
    const idStr = id.toString();
    if (idStr === mockAdminId) {
      return Promise.resolve({ _id: mockAdminId, name: 'Admin User', role: 'admin' });
    }
    if (idStr === mockUserId) {
      return Promise.resolve({ _id: mockUserId, name: 'Regular User', role: 'user' });
    }
    return Promise.resolve(null);
  };

  try {
    await t.test('1. Reject POST /api/vocabularies without Token -> 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/vocabularies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: 'Buch', meaning: 'Sách' }),
      });
      assert.equal(res.status, 401);
    });

    await t.test('2. Reject POST /api/vocabularies with Regular User Token -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/vocabularies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ word: 'Buch', meaning: 'Sách' }),
      });
      assert.equal(res.status, 403);
    });

    await t.test('3. Reject POST /api/vocabularies with Invalid Article -> 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/vocabularies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ word: 'Buch', meaning: 'Sách', article: 'invalid_article' }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.message.includes('Article'));
    });

    await t.test('4. Allow POST /api/vocabularies with Admin Token & Valid Data -> 201 Created', async () => {
      Vocabulary.create = async (doc) => ({
        _id: mockVocabId,
        ...doc,
        createdAt: new Date(),
      });
      Vocabulary.findById = () => ({
        populate: () => ({
          populate: () => Promise.resolve({
            _id: mockVocabId,
            word: 'Buch',
            article: 'das',
            plural: 'die Bücher',
            meaning: 'Quyển sách',
            type: 'noun',
            createdBy: { name: 'Admin User' },
          }),
        }),
      });

      const res = await fetch(`${baseUrl}/api/vocabularies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          word: 'Buch',
          article: 'das',
          plural: 'die Bücher',
          type: 'noun',
          meaning: 'Quyển sách',
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.vocabulary.word, 'Buch');
    });

    await t.test('5. Allow PUT /api/vocabularies/:id (Partial Update as Admin) -> 200 OK', async () => {
      Vocabulary.findById = (id) => Promise.resolve({ _id: mockVocabId, word: 'Buch', lektionId: mockLektionId });
      Vocabulary.findByIdAndUpdate = (id, updateQuery) => {
        assert.ok(updateQuery.$set);
        assert.equal(updateQuery.$set.article, 'das');
        assert.equal(updateQuery.$set.plural, 'die Bücher');
        return {
          populate: () => ({
            populate: () => Promise.resolve({
              _id: mockVocabId,
              word: 'Buch',
              article: 'das',
              plural: 'die Bücher',
              lektionId: { _id: mockLektionId, title: 'Bài 1' },
            }),
          }),
        };
      };

      const res = await fetch(`${baseUrl}/api/vocabularies/${mockVocabId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          article: 'das',
          plural: 'die Bücher',
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.vocabulary.plural, 'die Bücher');
    });

  } finally {
    User.findById = originalFindById;
    Vocabulary.findById = originalVocabFindById;
    Vocabulary.create = originalVocabCreate;
    Vocabulary.findByIdAndUpdate = originalVocabFindByIdAndUpdate;
    server.close();
  }
});
