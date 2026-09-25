process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_lock_unlock_98765';
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { EventEmitter } from 'events';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Subscription = (await import('./src/models/Subscription.js')).default;
const errorMiddleware = (await import('./src/middlewares/errorMiddleware.js')).default;

Subscription.findOne = () => makeQuery(null);

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// In-memory collections
const db = {
  users: new Map(),
  progress: new Map(),
  subscriptions: new Map(),
};

function invokeRequest(app, { method, url, token, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.ip = '127.0.0.1';
    req.socket = { remoteAddress: '127.0.0.1' };
    req.headers = {
      'content-type': 'application/json',
    };
    if (token) {
      req.headers['authorization'] = `Bearer ${token}`;
    }
    req.cookies = {};

    let responseData = '';
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (k, v) => {
      res.headers[k.toLowerCase()] = v;
    };
    res.removeHeader = (k) => {
      delete res.headers[k.toLowerCase()];
    };
    res.getHeader = (k) => res.headers[k.toLowerCase()];
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      resolve({ status: res.statusCode, body: data, headers: res.headers });
    };
    res.send = (data) => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
      } catch {
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      }
    };
    res.end = (chunk) => {
      if (chunk) responseData += chunk;
      try {
        resolve({ status: res.statusCode, body: JSON.parse(responseData), headers: res.headers });
      } catch {
        resolve({ status: res.statusCode, body: responseData, headers: res.headers });
      }
    };

    if (body) {
      req.body = body;
    }

    try {
      app.handle(req, res, (err) => {
        if (err) {
          errorMiddleware(err, req, res, () => {});
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

const makeQuery = (result) => ({
  populate: function () {
    return makeQuery(result);
  },
  sort: function () {
    return makeQuery(result);
  },
  limit: function () {
    return makeQuery(result);
  },
  skip: function () {
    return makeQuery(result);
  },
  select: function () {
    return makeQuery(result);
  },
  lean: function () {
    return makeQuery(result);
  },
  then: function (resolve, reject) {
    return Promise.resolve(result).then(resolve, reject);
  },
  catch: function (reject) {
    return Promise.resolve(result).catch(reject);
  },
});

test('=== USER LOCK / UNLOCK COMPLETE SPECIFICATION TEST SUITE ===', async (t) => {
  const adminId = new mongoose.Types.ObjectId().toString();
  const admin2Id = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const lockedUserId = new mongoose.Types.ObjectId().toString();

  const createMockUser = (data) => {
    const userDoc = {
      _id: new mongoose.Types.ObjectId(data._id),
      id: data._id.toString(),
      name: data.name,
      username: data.username,
      email: data.email,
      password: data.password || '$2b$10$hashedPasswordHere1234567890',
      role: data.role || 'user',
      status: data.status || 'active',
      isActive: data.status === 'locked' ? false : (data.isActive !== undefined ? data.isActive : true),
      lockReason: data.lockReason || null,
      lockedAt: data.lockedAt || null,
      lockedBy: data.lockedBy || null,
      isEmailVerified: true,
      emailVerified: true,
      avatar: null,
      matchPassword: async function (p) {
        return p === 'Password123!';
      },
      save: async function () {
        if (this.status === 'active') {
          this.isActive = true;
          this.lockReason = null;
          this.lockedAt = null;
          this.lockedBy = null;
        } else if (this.status === 'locked') {
          this.isActive = false;
        }
        db.users.set(this._id.toString(), this);
        return this;
      },
      populate: async function (field) {
        if (this.lockedBy) {
          const lUser = db.users.get(this.lockedBy.toString());
          if (lUser) {
            this.lockedBy = {
              _id: lUser._id,
              name: lUser.name,
              email: lUser.email,
              role: lUser.role,
            };
          }
        }
        return this;
      },
      toObject: function () {
        return {
          _id: this._id,
          id: this._id.toString(),
          name: this.name,
          username: this.username,
          email: this.email,
          role: this.role,
          status: this.status,
          isActive: this.isActive,
          lockReason: this.lockReason,
          lockedAt: this.lockedAt,
          lockedBy: this.lockedBy,
          isEmailVerified: this.isEmailVerified,
          emailVerified: this.emailVerified,
          avatar: this.avatar,
        };
      },
    };
    return userDoc;
  };

  const adminUser = createMockUser({
    _id: adminId,
    name: 'Main Admin',
    username: 'admin1',
    email: 'admin1@deutschup.de',
    role: 'admin',
  });

  const admin2User = createMockUser({
    _id: admin2Id,
    name: 'Secondary Admin',
    username: 'admin2',
    email: 'admin2@deutschup.de',
    role: 'admin',
  });

  const regularUser = createMockUser({
    _id: userId,
    name: 'Active User',
    username: 'useractive',
    email: 'useractive@deutschup.de',
    role: 'user',
    status: 'active',
  });

  const lockedUser = createMockUser({
    _id: lockedUserId,
    name: 'Locked User',
    username: 'userlocked',
    email: 'userlocked@deutschup.de',
    role: 'user',
    status: 'locked',
    lockReason: 'Vi phạm quy định diễn đàn',
    lockedAt: new Date('2026-09-20T10:00:00.000Z'),
    lockedBy: new mongoose.Types.ObjectId(adminId),
  });

  db.users.set(adminId, adminUser);
  db.users.set(admin2Id, admin2User);
  db.users.set(userId, regularUser);
  db.users.set(lockedUserId, lockedUser);

  // Hook User mongoose model methods
  const origFindById = User.findById;
  const origFindOne = User.findOne;
  const origFind = User.find;
  const origCount = User.countDocuments;

  User.findById = (id) => {
    const u = db.users.get(id?.toString()) || null;
    return makeQuery(u);
  };

  User.findOne = (query) => {
    let match = null;
    for (const u of db.users.values()) {
      if (query?.$or) {
        for (const cond of query.$or) {
          if (cond.email && u.email.toLowerCase() === cond.email.toLowerCase()) match = u;
          if (cond.username && u.username && u.username.toLowerCase() === cond.username.toLowerCase()) match = u;
        }
      } else if (query?.email && u.email.toLowerCase() === query.email.toLowerCase()) {
        match = u;
      } else if (query?.username && u.username && u.username.toLowerCase() === query.username.toLowerCase()) {
        match = u;
      }
    }
    return makeQuery(match);
  };

  User.find = () => {
    return makeQuery(Array.from(db.users.values()));
  };

  User.countDocuments = () => {
    return Promise.resolve(db.users.size);
  };

  const adminToken = generateToken(adminId);
  const userToken = generateToken(userId);
  const lockedToken = generateToken(lockedUserId);

  t.after(() => {
    User.findById = origFindById;
    User.findOne = origFindOne;
    User.find = origFind;
    User.countDocuments = origCount;
  });

  // CASE 1: User active login -> login thành công
  await t.test('CASE 1: User active login -> login thành công', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: {
        email: 'useractive@deutschup.de',
        password: 'Password123!',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Token must be present');
    assert.equal(res.body.user.status, 'active');
    assert.equal(res.body.user.lockReason, null);
    assert.equal(res.body.user.lockedAt, null);
    assert.equal(res.body.user.lockedBy, undefined, 'lockedBy should not be in user payload');
  });

  // CASE 2: User locked login -> login vẫn thành công & response chứa status = locked
  await t.test('CASE 2: User locked login -> login vẫn thành công & response chứa status = locked', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: {
        email: 'userlocked@deutschup.de',
        password: 'Password123!',
      },
    });

    assert.equal(res.status, 200, 'Locked user MUST be able to login');
    assert.equal(res.body.success, true);
    assert.ok(res.body.token, 'Token must still be issued');
    assert.equal(res.body.user.status, 'locked');
    assert.equal(res.body.user.lockReason, 'Vi phạm quy định diễn đàn');
    assert.ok(res.body.user.lockedAt);
    assert.equal(res.body.user.lockedBy, undefined, 'lockedBy must NOT be exposed to user');
    assert.equal(res.body.data.user.status, 'locked');
  });

  // CASE 3: Admin khóa User -> status = locked, lockReason, lockedAt, lockedBy được lưu
  await t.test('CASE 3: Admin khóa User -> status = locked, lockReason, lockedAt, lockedBy được lưu', async () => {
    const res = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${userId}/status`,
      token: adminToken,
      body: {
        status: 'locked',
        lockReason: 'Spam nội dung không phù hợp',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.status, 'locked');
    assert.equal(res.body.data.user.lockReason, 'Spam nội dung không phù hợp');
    assert.ok(res.body.data.user.lockedAt);
    assert.ok(res.body.data.user.lockedBy);

    // Verify DB update
    const updated = db.users.get(userId);
    assert.equal(updated.status, 'locked');
    assert.equal(updated.isActive, false);
    assert.equal(updated.lockReason, 'Spam nội dung không phù hợp');
    assert.ok(updated.lockedAt);
    assert.equal((updated.lockedBy?._id || updated.lockedBy).toString(), adminId);
  });

  // CASE 4: Admin mở khóa User -> status = active, lockReason/lockedAt/lockedBy = null
  await t.test('CASE 4: Admin mở khóa User -> status = active, lockReason/lockedAt/lockedBy = null', async () => {
    const res = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${userId}/status`,
      token: adminToken,
      body: {
        status: 'active',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.status, 'active');
    assert.equal(res.body.data.user.lockReason, null);
    assert.equal(res.body.data.user.lockedAt, null);
    assert.equal(res.body.data.user.lockedBy, null);

    // Verify DB update
    const updated = db.users.get(userId);
    assert.equal(updated.status, 'active');
    assert.equal(updated.isActive, true);
    assert.equal(updated.lockReason, null);
    assert.equal(updated.lockedAt, null);
    assert.equal(updated.lockedBy, null);
  });

  // CASE 5: User locked gọi protected API -> 403, code = ACCOUNT_LOCKED
  await t.test('CASE 5: User locked gọi protected API -> 403, code = ACCOUNT_LOCKED', async () => {
    // 5.1 Test PUT /api/users/profile
    const resProfile = await invokeRequest(app, {
      method: 'PUT',
      url: '/api/users/profile',
      token: lockedToken,
      body: { name: 'Attempt Update' },
    });
    assert.equal(resProfile.status, 403);
    assert.equal(resProfile.body.success, false);
    assert.equal(resProfile.body.code, 'ACCOUNT_LOCKED');
    assert.equal(resProfile.body.data.lockReason, 'Vi phạm quy định diễn đàn');
    assert.ok(resProfile.body.data.lockedAt);

    // 5.2 Test GET /api/progress
    const resProgress = await invokeRequest(app, {
      method: 'GET',
      url: '/api/progress',
      token: lockedToken,
    });
    assert.equal(resProgress.status, 403);
    assert.equal(resProgress.body.code, 'ACCOUNT_LOCKED');

    // 5.3 Test GET /api/quizzes
    const resQuiz = await invokeRequest(app, {
      method: 'GET',
      url: '/api/quizzes',
      token: lockedToken,
    });
    assert.equal(resQuiz.status, 403);
    assert.equal(resQuiz.body.code, 'ACCOUNT_LOCKED');
  });

  // CASE 6: User locked gọi API lấy current user/status -> vẫn có thể lấy thông tin cần thiết
  await t.test('CASE 6: User locked gọi GET /api/auth/me & GET /api/users/profile -> HTTP 200 status = locked', async () => {
    // 6.1 GET /api/auth/me
    const resMe = await invokeRequest(app, {
      method: 'GET',
      url: '/api/auth/me',
      token: lockedToken,
    });
    assert.equal(resMe.status, 200, 'Locked user MUST be able to get their status via /api/auth/me');
    assert.equal(resMe.body.success, true);
    assert.equal(resMe.body.user.status, 'locked');
    assert.equal(resMe.body.user.lockReason, 'Vi phạm quy định diễn đàn');
    assert.ok(resMe.body.user.lockedAt);
    assert.equal(resMe.body.user.lockedBy, undefined, 'lockedBy must not be exposed');

    // 6.2 GET /api/users/profile
    const resProfile = await invokeRequest(app, {
      method: 'GET',
      url: '/api/users/profile',
      token: lockedToken,
    });
    assert.equal(resProfile.status, 200);
    assert.equal(resProfile.body.data.user.status, 'locked');
    assert.equal(resProfile.body.data.user.lockReason, 'Vi phạm quy định diễn đàn');
    assert.equal(resProfile.body.data.user.lockedBy, undefined);
  });

  // CASE 7: User locked gọi login -> vẫn login thành công
  await t.test('CASE 7: User locked gọi login lặp lại -> vẫn login thành công', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: {
        email: 'userlocked@deutschup.de',
        password: 'Password123!',
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    assert.equal(res.body.user.status, 'locked');
  });

  // CASE 8: User thường gọi API admin lock user -> bị từ chối
  await t.test('CASE 8: User thường gọi API admin lock user -> bị từ chối', async () => {
    const res = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${lockedUserId}/status`,
      token: userToken,
      body: { status: 'active' },
    });
    assert.equal(res.status, 403, 'Regular user must be forbidden from admin lock endpoint');
    assert.equal(res.body.success, false);
  });

  // CASE 9: Admin tự khóa chính mình & Admin khóa Admin khác -> bị từ chối
  await t.test('CASE 9: Admin tự khóa chính mình & Admin khóa Admin khác -> bị từ chối', async () => {
    // 9.1 Admin tự khóa chính mình
    const resSelf = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${adminId}/status`,
      token: adminToken,
      body: { status: 'locked', lockReason: 'Self lock test' },
    });
    assert.equal(resSelf.status, 400, 'Admin locking own account must be rejected with 400');
    assert.equal(resSelf.body.success, false);

    // 9.2 Admin khóa Admin khác
    const resOtherAdmin = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${admin2Id}/status`,
      token: adminToken,
      body: { status: 'locked', lockReason: 'Lock other admin test' },
    });
    assert.equal(resOtherAdmin.status, 403, 'Admin locking another admin must be rejected with 403');
    assert.equal(resOtherAdmin.body.success, false);
  });

  // CASE 10: Khóa User không làm mất các dữ liệu học tập và subscription
  await t.test('CASE 10: Khóa User không làm mất dữ liệu học tập, subscription, profile', async () => {
    // Mock user with study data and subscription
    const studentId = new mongoose.Types.ObjectId().toString();
    const studentUser = createMockUser({
      _id: studentId,
      name: 'Nguyen Van A',
      username: 'studentA',
      email: 'studentA@deutschup.de',
      role: 'user',
      status: 'active',
    });
    studentUser.xp = 500;
    studentUser.level = 'B1';
    studentUser.studyStreak = 15;
    db.users.set(studentId, studentUser);

    // Lock student
    const resLock = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${studentId}/status`,
      token: adminToken,
      body: { status: 'locked', lockReason: 'Vi phạm chính sách' },
    });

    assert.equal(resLock.status, 200);

    const lockedStudent = db.users.get(studentId);
    assert.equal(lockedStudent.status, 'locked');
    // Ensure all other profile/data fields are preserved!
    assert.equal(lockedStudent.xp, 500);
    assert.equal(lockedStudent.level, 'B1');
    assert.equal(lockedStudent.studyStreak, 15);
    assert.equal(lockedStudent.name, 'Nguyen Van A');
    assert.equal(lockedStudent.email, 'studentA@deutschup.de');
  });

  // CASE 11: Mở khóa User -> các dữ liệu cũ vẫn còn nguyên
  await t.test('CASE 11: Mở khóa User -> các dữ liệu cũ vẫn còn nguyên', async () => {
    const studentId = Array.from(db.users.keys()).find((k) => db.users.get(k).username === 'studentA');
    assert.ok(studentId);

    const resUnlock = await invokeRequest(app, {
      method: 'PATCH',
      url: `/api/admin/users/${studentId}/status`,
      token: adminToken,
      body: { status: 'active' },
    });

    assert.equal(resUnlock.status, 200);

    const unlockedStudent = db.users.get(studentId);
    assert.equal(unlockedStudent.status, 'active');
    assert.equal(unlockedStudent.lockReason, null);
    assert.equal(unlockedStudent.lockedAt, null);
    assert.equal(unlockedStudent.lockedBy, null);
    // Data remains intact!
    assert.equal(unlockedStudent.xp, 500);
    assert.equal(unlockedStudent.level, 'B1');
    assert.equal(unlockedStudent.studyStreak, 15);
    assert.equal(unlockedStudent.name, 'Nguyen Van A');
    assert.equal(unlockedStudent.email, 'studentA@deutschup.de');
  });
});
