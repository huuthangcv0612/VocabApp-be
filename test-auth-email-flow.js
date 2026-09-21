import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_flow_12345';
process.env.FRONTEND_URL = 'http://localhost:5173';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const EmailVerification = (await import('./src/models/EmailVerification.js')).default;

test('Auth Email Verification & Registration Flow', async (t) => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vocabapp');
  }

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const testEmail = `flowtest_${Date.now()}@example.com`;
  const testUsername = `flowtest_${Date.now()}`;
  const testPassword = 'Password123!';
  let capturedToken = null;

  try {
    // 1. Register new user
    await t.test('1. POST /api/auth/register -> 201 Created, NO JWT returned', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Verification User',
          username: testUsername,
          email: testEmail,
          password: testPassword,
          passwordConfirm: testPassword,
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.token, undefined, 'JWT must not be issued upon registration');
      assert.equal(data.user.email, testEmail);
      assert.equal(data.user.isEmailVerified, false);
      assert.equal(data.user.emailVerified, false);

      const cookie = res.headers.get('set-cookie');
      assert.ok(!cookie || !cookie.includes('token='), 'Cookie must not be set upon registration');

      // Verify in DB
      const userInDb = await User.findOne({ email: testEmail });
      assert.ok(userInDb, 'User must exist in DB');
      assert.equal(userInDb.isEmailVerified, false);
      assert.equal(userInDb.emailVerified, false);

      const verificationRecord = await EmailVerification.findOne({ userId: userInDb._id });
      assert.ok(verificationRecord, 'EmailVerification record must be created');
      assert.equal(verificationRecord.used, false);
      assert.ok(verificationRecord.expiresAt > new Date());
    });

    // 2. Login before verification -> 403 Forbidden
    await t.test('2. POST /api/auth/login before verification -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'Vui lòng xác nhận email trước khi đăng nhập.');
      assert.equal(data.token, undefined);
    });

    // 3. Resend verification email
    await t.test('3. POST /api/auth/resend-verification -> 200 OK', async () => {
      // Small wait to bypass 60s cooldown for the test if needed, or wait 1.1s if we update last token
      const userInDb = await User.findOne({ email: testEmail });
      // Fast forward last record createdAt by 65 seconds using raw collection to bypass Mongoose immutable flag
      await EmailVerification.collection.updateMany(
        { userId: userInDb._id },
        { $set: { createdAt: new Date(Date.now() - 65 * 1000) } }
      );

      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      const data = await res.json();
      if (res.status !== 200) {
        console.error('Test 3 Failed response:', res.status, data);
      }
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.equal(data.message, 'Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư của bạn.');
    });

    // 4. Resend verification email immediately -> 429 Too Many Requests (cooldown)
    await t.test('4. POST /api/auth/resend-verification within 60s cooldown -> 429 Cooldown', async () => {
      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      assert.equal(res.status, 429);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /Vui lòng đợi \d+ giây trước khi yêu cầu gửi lại email xác thực\./);
    });

    // 5. Verify email with invalid token -> 400
    await t.test('5. GET /api/auth/verify-email with invalid token -> 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=completely_invalid_token`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'Link xác thực không hợp lệ hoặc không tồn tại.');
    });

    // 6. Verify email with valid token -> 200 OK
    await t.test('6. GET /api/auth/verify-email with valid token -> 200 OK & user verified', async () => {
      const userInDb = await User.findOne({ email: testEmail });
      // Create a known plain token and hash it into DB
      const plainToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(plainToken).digest('hex');

      await EmailVerification.deleteMany({ userId: userInDb._id });
      await EmailVerification.create({
        userId: userInDb._id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used: false,
      });

      capturedToken = plainToken;

      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${capturedToken}`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.');

      // Check DB
      const updatedUser = await User.findById(userInDb._id);
      assert.equal(updatedUser.isEmailVerified, true);
      assert.equal(updatedUser.emailVerified, true);

      const record = await EmailVerification.findOne({ tokenHash: hash });
      assert.equal(record.used, true);
    });

    // 7. Reuse already used token -> 400 Bad Request
    await t.test('7. GET /api/auth/verify-email with used token -> 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/auth/verify-email?token=${capturedToken}`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'Link xác thực này đã được sử dụng.');
    });

    // 8. Login after verification -> 200 OK with JWT
    await t.test('8. POST /api/auth/login after verification -> 200 OK with JWT', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.token, 'Token must be returned');
      assert.equal(data.user.email, testEmail);
      assert.equal(data.user.isEmailVerified, true);
      assert.equal(data.user.emailVerified, true);
    });

    // 9. Resend verification for already verified user -> 400 Bad Request
    await t.test('9. POST /api/auth/resend-verification for verified user -> 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.message, 'Email này đã được xác thực. Bạn có thể đăng nhập ngay.');
    });
  } finally {
    // Cleanup
    const user = await User.findOne({ email: testEmail });
    if (user) {
      await EmailVerification.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
    server.close();
    await mongoose.disconnect();
  }
});
