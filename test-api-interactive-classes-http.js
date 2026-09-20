import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { EventEmitter } from 'events';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

const app = (await import('./src/app.js')).default;
const User = (await import('./src/models/User.js')).default;
const Subscription = (await import('./src/models/Subscription.js')).default;
const Class = (await import('./src/models/Class.js')).default;
const ClassMember = (await import('./src/models/ClassMember.js')).default;
const Vocabulary = (await import('./src/models/Vocabulary.js')).default;
const InteractiveLesson = (await import('./src/models/InteractiveLesson.js')).default;
const InteractiveActivity = (await import('./src/models/InteractiveActivity.js')).default;
const InteractiveSession = (await import('./src/models/InteractiveSession.js')).default;
const errorMiddleware = (await import('./src/middlewares/errorMiddleware.js')).default;

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Mock in-memory DB collections
const db = {
  users: new Map(),
  subscriptions: new Map(),
  classes: new Map(),
  classMembers: new Map(),
  vocabularies: new Map(),
  interactiveLessons: new Map(),
  interactiveActivities: new Map(),
  interactiveSessions: new Map(),
};

// Helper to simulate HTTP requests into Express app.handle
function invokeRequest(app, { method, url, token, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
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

test('=== HTTP API INTEGRATION TESTS FOR CUSTOM PLAN & INTERACTIVE CLASSES ===', async (t) => {
  // 1. Setup mock users - ALL ARE role: 'user' except admin
  const adminId = new mongoose.Types.ObjectId().toString();
  const userCustomAId = new mongoose.Types.ObjectId().toString();
  const userCustomBId = new mongoose.Types.ObjectId().toString();
  const userPremiumId = new mongoose.Types.ObjectId().toString();
  const userFreeId = new mongoose.Types.ObjectId().toString();

  const adminUser = { _id: new mongoose.Types.ObjectId(adminId), id: adminId, name: 'Admin', email: 'admin@vocab.de', role: 'admin' };
  const userCustomA = { _id: new mongoose.Types.ObjectId(userCustomAId), id: userCustomAId, name: 'Host Müller', email: 'mueller@vocab.de', role: 'user' };
  const userCustomB = { _id: new mongoose.Types.ObjectId(userCustomBId), id: userCustomBId, name: 'Host Schmidt', email: 'schmidt@vocab.de', role: 'user' };
  const userPremium = { _id: new mongoose.Types.ObjectId(userPremiumId), id: userPremiumId, name: 'Student Anna', email: 'anna@vocab.de', role: 'user' };
  const userFree = { _id: new mongoose.Types.ObjectId(userFreeId), id: userFreeId, name: 'Student Hans', email: 'hans@vocab.de', role: 'user' };

  db.users.set(adminId, adminUser);
  db.users.set(userCustomAId, userCustomA);
  db.users.set(userCustomBId, userCustomB);
  db.users.set(userPremiumId, userPremium);
  db.users.set(userFreeId, userFree);

  // Setup mock subscriptions
  db.subscriptions.set(userCustomAId, {
    userId: userCustomA._id,
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 86400000),
    planId: {
      name: 'Custom Organization Plan',
      code: 'CUSTOM_TEACHER',
      planType: 'CUSTOM',
      permissions: ['basic_learning', 'ai_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
    },
  });

  db.subscriptions.set(userCustomBId, {
    userId: userCustomB._id,
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 86400000),
    planId: {
      name: 'Custom Organization Plan',
      code: 'CUSTOM_TEACHER',
      planType: 'CUSTOM',
      permissions: ['basic_learning', 'ai_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
    },
  });

  db.subscriptions.set(userPremiumId, {
    userId: userPremium._id,
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 86400000),
    planId: {
      name: 'Premium Personal Plan',
      code: 'PREMIUM_1_MONTH',
      planType: 'PREMIUM',
      permissions: ['basic_learning', 'ai_learning'],
    },
  });

  // userFree has no active subscription (FREE plan)

  // Seed sample vocabulary
  const vocabMutter = {
    _id: new mongoose.Types.ObjectId(),
    word: 'Mutter',
    article: 'die',
    meaning: 'người mẹ',
    level: 'A1',
    difficultyLevel: 'A1',
  };
  db.vocabularies.set(vocabMutter._id.toString(), vocabMutter);

  // Hook User.findById
  const origUserFindById = User.findById;
  User.findById = (id) => {
    const user = db.users.get(id?.toString()) || null;
    return makeQuery(user);
  };

  // Hook Subscription.findOne
  const origSubFindOne = Subscription.findOne;
  Subscription.findOne = (query) => {
    const sub = db.subscriptions.get(query.userId?.toString());
    return {
      populate: () => Promise.resolve(sub || null),
    };
  };

  // Hook Vocabulary methods
  const origVocabFind = Vocabulary.find;
  const origVocabFindOne = Vocabulary.findOne;
  const origVocabCreate = Vocabulary.create;
  const origVocabFindById = Vocabulary.findById;

  Vocabulary.find = (query) => {
    const list = Array.from(db.vocabularies.values());
    if (query.$or) {
      const regex = query.$or[0].word;
      const filtered = list.filter((v) => regex.test(v.word) || regex.test(v.meaning));
      return {
        limit: () => ({
          populate: () => Promise.resolve(filtered),
        }),
      };
    }
    return Promise.resolve(list);
  };

  Vocabulary.findOne = async (query) => {
    const list = Array.from(db.vocabularies.values());
    if (query.word?.$regex) {
      const regex = query.word.$regex;
      return list.find((v) => regex.test(v.word)) || null;
    }
    return null;
  };

  Vocabulary.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      populate: () => Promise.resolve(doc),
    };
    db.vocabularies.set(doc._id.toString(), doc);
    return doc;
  };

  Vocabulary.findById = (id) => {
    const doc = db.vocabularies.get(id?.toString()) || null;
    return {
      populate: () => ({
        populate: () => Promise.resolve(doc),
      }),
    };
  };

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
    then: function (resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
    catch: function (reject) {
      return Promise.resolve(result).catch(reject);
    },
  });

  // Hook Class methods
  const origClassCreate = Class.create;
  const origClassFind = Class.find;
  const origClassFindOne = Class.findOne;
  const origClassFindById = Class.findById;
  const origClassFindByIdAndDelete = Class.findByIdAndDelete;

  Class.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      teacher_id: data.teacher_id,
      toObject: function () {
        return { ...this };
      },
      save: async function () {
        db.classes.set(this._id.toString(), this);
        return this;
      },
    };
    db.classes.set(doc._id.toString(), doc);
    return doc;
  };

  Class.findOne = (query) => {
    const list = Array.from(db.classes.values());
    if (query.class_code) {
      const found = list.find(
        (c) => c.class_code === query.class_code && (!query.status || c.status === query.status)
      );
      if (found) {
        const teacherObj = db.users.get(found.teacher_id?.toString()) || found.teacher_id;
        return makeQuery({
          ...found,
          teacher_id: teacherObj,
          toObject: function () {
            return { ...this };
          },
          save: async function () {
            db.classes.set(this._id.toString(), this);
            return this;
          },
        });
      }
      return makeQuery(null);
    }
    return makeQuery(null);
  };

  Class.findById = (id) => {
    const c = db.classes.get(id?.toString()) || null;
    if (c) {
      const teacherObj = db.users.get(c.teacher_id?.toString()) || c.teacher_id;
      return makeQuery({
        ...c,
        teacher_id: teacherObj,
        toObject: function () {
          return { ...this };
        },
        save: async function () {
          db.classes.set(this._id.toString(), this);
          return this;
        },
      });
    }
    return makeQuery(null);
  };

  Class.find = (query) => {
    const list = Array.from(db.classes.values())
      .filter((c) => {
        if (query.teacher_id && c.teacher_id?.toString() !== query.teacher_id.toString()) return false;
        return true;
      })
      .map((c) => {
        const teacherObj = db.users.get(c.teacher_id?.toString()) || c.teacher_id;
        return { ...c, teacher_id: teacherObj };
      });
    return makeQuery(list);
  };

  Class.findByIdAndDelete = async (id) => {
    const c = db.classes.get(id?.toString()) || null;
    db.classes.delete(id?.toString());
    return c;
  };

  // Hook ClassMember methods
  const origMemberCreate = ClassMember.create;
  const origMemberFindOne = ClassMember.findOne;
  const origMemberFind = ClassMember.find;
  const origMemberCount = ClassMember.countDocuments;
  const origMemberDeleteMany = ClassMember.deleteMany;

  ClassMember.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      class_id: data.class_id,
      user_id: data.user_id,
      save: async function () {
        return this;
      },
    };
    const key = `${data.class_id.toString()}_${data.user_id.toString()}`;
    db.classMembers.set(key, doc);
    return doc;
  };

  ClassMember.findOne = (query) => {
    const list = Array.from(db.classMembers.values());
    const qClassId = (query.class_id?._id || query.class_id)?.toString();
    const qUserId = (query.user_id?._id || query.user_id)?.toString();
    const found = list.find((m) => {
      const mClassId = (m.class_id?._id || m.class_id)?.toString();
      const mUserId = (m.user_id?._id || m.user_id)?.toString();
      if (qClassId && mClassId !== qClassId) return false;
      if (qUserId && mUserId !== qUserId) return false;
      if (query.status && m.status !== query.status) return false;
      if (query.role && m.role !== query.role) return false;
      return true;
    });
    return makeQuery(found || null);
  };

  ClassMember.find = (query) => {
    const qClassId = (query.class_id?._id || query.class_id)?.toString();
    const qUserId = (query.user_id?._id || query.user_id)?.toString();
    const list = Array.from(db.classMembers.values())
      .filter((m) => {
        const mClassId = (m.class_id?._id || m.class_id)?.toString();
        const mUserId = (m.user_id?._id || m.user_id)?.toString();
        if (qClassId && mClassId !== qClassId) return false;
        if (qUserId && mUserId !== qUserId) return false;
        if (query.status && m.status !== query.status) return false;
        if (query.role && m.role !== query.role) return false;
        return true;
      })
      .map((m) => {
        const userObj = db.users.get(m.user_id?.toString()) || m.user_id;
        const classDoc = db.classes.get(m.class_id?.toString()) || m.class_id;
        const teacherObj = classDoc ? db.users.get(classDoc.teacher_id?.toString()) || classDoc.teacher_id : null;
        const classObj = classDoc
          ? {
              ...classDoc,
              teacher_id: teacherObj,
              toObject: () => ({ ...classDoc, teacher_id: teacherObj }),
            }
          : null;
        return {
          ...m,
          user_id: userObj,
          class_id: classObj,
        };
      });
    return makeQuery(list);
  };

  ClassMember.countDocuments = async (query) => {
    return Array.from(db.classMembers.values()).filter((m) => {
      if (query.class_id && m.class_id?.toString() !== query.class_id.toString()) return false;
      if (query.status && m.status !== query.status) return false;
      return true;
    }).length;
  };

  ClassMember.deleteMany = async (query) => {
    for (const [key, m] of db.classMembers.entries()) {
      if (query.class_id && m.class_id?.toString() === query.class_id.toString()) {
        db.classMembers.delete(key);
      }
    }
    return { acknowledged: true };
  };

  // Hook InteractiveLesson methods
  const origLessonCreate = InteractiveLesson.create;
  const origLessonFindById = InteractiveLesson.findById;
  const origLessonFind = InteractiveLesson.find;

  InteractiveLesson.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      save: async function () {
        return this;
      },
    };
    db.interactiveLessons.set(doc._id.toString(), doc);
    return doc;
  };

  InteractiveLesson.findById = (id) => {
    const doc = db.interactiveLessons.get(id?.toString()) || null;
    if (!doc) return makeQuery(null);
    const targetClass = db.classes.get(doc.class_id?.toString());
    const populated = {
      ...doc,
      class_id: targetClass || { _id: doc.class_id },
      vocabulary_ids: (doc.vocabulary_ids || []).map((vid) => db.vocabularies.get(vid.toString()) || vid),
      save: async function () {
        return this;
      },
    };
    return makeQuery(populated);
  };

  InteractiveLesson.find = (query) => {
    const list = Array.from(db.interactiveLessons.values()).filter((l) => {
      if (query.class_id && l.class_id?.toString() !== query.class_id.toString()) return false;
      if (query.teacher_id && l.teacher_id?.toString() !== query.teacher_id.toString()) return false;
      return true;
    });
    return makeQuery(list);
  };

  // Hook InteractiveActivity methods
  const origActivityCreate = InteractiveActivity.create;
  const origActivityFind = InteractiveActivity.find;
  const origActivityFindById = InteractiveActivity.findById;

  InteractiveActivity.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      save: async function () {
        return this;
      },
    };
    db.interactiveActivities.set(doc._id.toString(), doc);
    return doc;
  };

  InteractiveActivity.find = (query) => {
    const list = Array.from(db.interactiveActivities.values()).filter((a) => {
      if (query.interactive_lesson_id && a.interactive_lesson_id?.toString() !== query.interactive_lesson_id.toString())
        return false;
      return true;
    });
    return makeQuery(list);
  };

  InteractiveActivity.findById = (id) => {
    const act = db.interactiveActivities.get(id?.toString()) || null;
    if (!act) return makeQuery(null);
    const lesson = db.interactiveLessons.get(act.interactive_lesson_id?.toString());
    const populated = {
      ...act,
      interactive_lesson_id: {
        ...lesson,
        vocabulary_ids: (lesson?.vocabulary_ids || []).map((vid) => db.vocabularies.get(vid.toString()) || vid),
      },
      save: async function () {
        return this;
      },
    };
    return makeQuery(populated);
  };

  // Hook InteractiveSession methods
  const origSessionCreate = InteractiveSession.create;
  const origSessionFindById = InteractiveSession.findById;

  InteractiveSession.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      ...data,
      responses: [],
      toObject: function () {
        return JSON.parse(JSON.stringify(this));
      },
      save: async function () {
        db.interactiveSessions.set(this._id.toString(), this);
        return this;
      },
    };
    db.interactiveSessions.set(doc._id.toString(), doc);
    return doc;
  };

  InteractiveSession.findById = (id) => {
    const s = db.interactiveSessions.get(id?.toString()) || null;
    if (!s) return makeQuery(null);
    const rawClassId = s.class_id?._id || s.class_id;
    const targetClass = db.classes.get(rawClassId?.toString());
    const rawLessonId = s.interactive_lesson_id?._id || s.interactive_lesson_id;
    const lesson = db.interactiveLessons.get(rawLessonId?.toString());
    const populated = {
      ...s,
      class_id: targetClass || { _id: rawClassId },
      interactive_lesson_id: {
        ...lesson,
        vocabulary_ids: (lesson?.vocabulary_ids || []).map((vid) => db.vocabularies.get(vid.toString()) || vid),
      },
      toObject: function () {
        return JSON.parse(JSON.stringify(this));
      },
      save: async function () {
        db.interactiveSessions.set(this._id.toString(), {
          ...this,
          class_id: rawClassId,
          interactive_lesson_id: rawLessonId,
        });
        return this;
      },
    };
    return makeQuery(populated);
  };

  t.after(() => {
    User.findById = origUserFindById;
    Subscription.findOne = origSubFindOne;
    Vocabulary.find = origVocabFind;
    Vocabulary.findOne = origVocabFindOne;
    Vocabulary.create = origVocabCreate;
    Vocabulary.findById = origVocabFindById;
    Class.create = origClassCreate;
    Class.find = origClassFind;
    Class.findOne = origClassFindOne;
    Class.findById = origClassFindById;
    Class.findByIdAndDelete = origClassFindByIdAndDelete;
    ClassMember.create = origMemberCreate;
    ClassMember.findOne = origMemberFindOne;
    ClassMember.find = origMemberFind;
    ClassMember.countDocuments = origMemberCount;
    ClassMember.deleteMany = origMemberDeleteMany;
    InteractiveLesson.create = origLessonCreate;
    InteractiveLesson.findById = origLessonFindById;
    InteractiveLesson.find = origLessonFind;
    InteractiveActivity.create = origActivityCreate;
    InteractiveActivity.find = origActivityFind;
    InteractiveActivity.findById = origActivityFindById;
    InteractiveSession.create = origSessionCreate;
    InteractiveSession.findById = origSessionFindById;
  });

  const adminToken = generateToken(adminId);
  const userCustomAToken = generateToken(userCustomAId);
  const userCustomBToken = generateToken(userCustomBId);
  const userPremiumToken = generateToken(userPremiumId);
  const userFreeToken = generateToken(userFreeId);

  let classAId = null;
  let classACode = null;
  let lessonAId = null;
  let activityAId = null;
  let sessionAId = null;

  // --- SECTION A: USER PROFILE / AUTH ME PERMISSIONS ---
  await t.test('Auth & Profile: GET /api/auth/me returns plan, permissions & flags', async () => {
    const resCustom = await invokeRequest(app, {
      method: 'GET',
      url: '/api/auth/me',
      token: userCustomAToken,
    });
    assert.equal(resCustom.status, 200);
    assert.equal(resCustom.body.user.plan, 'CUSTOM');
    assert.equal(resCustom.body.user.hasCustomPlan, true);
    assert.equal(resCustom.body.user.canManageClasses, true);
    assert.equal(resCustom.body.user.can_create_class, true);
    assert.equal(resCustom.body.user.isTeacher, true);
    assert.ok(resCustom.body.user.permissions.includes('class_management'));

    const resFree = await invokeRequest(app, {
      method: 'GET',
      url: '/api/auth/me',
      token: userFreeToken,
    });
    assert.equal(resFree.status, 200);
    assert.equal(resFree.body.user.plan, 'FREE');
    assert.equal(resFree.body.user.hasCustomPlan, false);
    assert.equal(resFree.body.user.canManageClasses, false);
    assert.equal(resFree.body.user.can_create_class, false);
  });

  await t.test('Auth & Profile: GET /api/users/profile returns planInfo', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/users/profile',
      token: userPremiumToken,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.plan, 'PREMIUM');
    assert.equal(res.body.data.user.hasCustomPlan, false);
    assert.equal(res.body.data.user.canManageClasses, false);
    assert.ok(res.body.data.user.permissions.includes('ai_learning'));
  });

  // --- 13 MANDATORY TEST CASES ---

  // TEST CASE 4: User FREE tạo class: Bị chặn (403)
  await t.test('Case 4: User FREE tạo class: Bị chặn (403)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes',
      token: userFreeToken,
      body: { name: 'Free User Class' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Custom plan is required/i);
  });

  // TEST CASE 5: User PREMIUM tạo class: Bị chặn (403)
  await t.test('Case 5: User PREMIUM tạo class: Bị chặn (403)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes',
      token: userPremiumToken,
      body: { name: 'Premium User Class' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Custom plan is required/i);
  });

  // TEST CASE 6: User CUSTOM tạo class: Thành công (201)
  await t.test('Case 6: User CUSTOM (role: user) tạo class: Thành công (201)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes',
      token: userCustomAToken,
      body: { name: 'Deutsch A1 Live Class', class_code: 'DEUTSCHA1' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.class._id);
    assert.equal(res.body.data.class.class_code, 'DEUTSCHA1');
    classAId = res.body.data.class._id.toString();
    classACode = res.body.data.class.class_code;
  });

  // TEST CASE 1: User FREE join class: Thành công (200)
  await t.test('Case 1: User FREE join class bằng class_code: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes/join',
      token: userFreeToken,
      body: { class_code: classACode },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.membership.role, 'student');
  });

  // TEST CASE 2: User PREMIUM join class: Thành công (200)
  await t.test('Case 2: User PREMIUM join class bằng class_code: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes/join',
      token: userPremiumToken,
      body: { class_code: classACode },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.membership.role, 'student');
  });

  // TEST CASE 3: User CUSTOM (không phải owner) join class: Thành công (200)
  await t.test('Case 3: User CUSTOM B (không phải owner) join class A: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes/join',
      token: userCustomBToken,
      body: { class_code: classACode },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.membership.role, 'student');
  });

  // Owner cannot join their own class as student
  await t.test('Host cannot join their own class as a student (400)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/classes/join',
      token: userCustomAToken,
      body: { class_code: classACode },
    });
    assert.equal(res.status, 400);
  });

  // TEST CASE 7: User CUSTOM A sửa class của mình: Thành công (200)
  await t.test('Case 7: User CUSTOM A sửa class của mình: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/classes/${classAId}`,
      token: userCustomAToken,
      body: { name: 'Deutsch A1 Live Class Updated', description: 'New description' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.class.name, 'Deutsch A1 Live Class Updated');
  });

  // TEST CASE 8: User CUSTOM B sửa class của A: Bị chặn (403)
  await t.test('Case 8: User CUSTOM B sửa class của A: Bị chặn (403)', async () => {
    const res = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/classes/${classAId}`,
      token: userCustomBToken,
      body: { name: 'Hacked by B' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /not authorized/i);
  });

  // TEST CASE 9: User CUSTOM tạo interactive lesson: Thành công (201)
  await t.test('Case 9: User CUSTOM A tạo interactive lesson trong class của mình: Thành công (201)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/interactive-lessons',
      token: userCustomAToken,
      body: {
        class_id: classAId,
        title: 'Lektion 1: Die Familie',
        vocabulary_ids: [vocabMutter._id.toString()],
        status: 'published',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    lessonAId = res.body.data.lesson._id.toString();
  });

  // TEST CASE 10: Học sinh (hoặc user thường không sở hữu class) gọi API tạo lesson/activity: Bị chặn (403)
  await t.test('Case 10: Học sinh Free cố tình gọi API tạo lesson trong class: Bị chặn (403)', async () => {
    const resLesson = await invokeRequest(app, {
      method: 'POST',
      url: '/api/interactive-lessons',
      token: userFreeToken,
      body: {
        class_id: classAId,
        title: 'Student Unauthorized Lesson',
      },
    });
    assert.equal(resLesson.status, 403);

    const resActivity = await invokeRequest(app, {
      method: 'POST',
      url: '/api/interactive-activities',
      token: userFreeToken,
      body: {
        interactive_lesson_id: lessonAId,
        type: 'quiz',
      },
    });
    assert.equal(resActivity.status, 403);
  });

  // Create an Activity for testing Live Session
  await t.test('Setup Activity: Host tạo Quiz Activity thành công (201)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/interactive-activities',
      token: userCustomAToken,
      body: {
        interactive_lesson_id: lessonAId,
        type: 'quiz',
        config: { question_count: 5 },
      },
    });
    assert.equal(res.status, 201);
    activityAId = res.body.data.activity._id.toString();
  });

  // TEST CASE 11: User CUSTOM bắt đầu live session: Thành công (201)
  await t.test('Case 11: User CUSTOM A bắt đầu live session: Thành công (201)', async () => {
    const res = await invokeRequest(app, {
      method: 'POST',
      url: '/api/interactive-sessions',
      token: userCustomAToken,
      body: {
        class_id: classAId,
        interactive_lesson_id: lessonAId,
        activity_id: activityAId,
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.session.status, 'active');
    sessionAId = res.body.data.session._id.toString();
  });

  // TEST CASE 12: Học sinh join live session: Thành công (200)
  await t.test('Case 12: Học sinh đã ghi danh join / fetch live session: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/interactive-sessions/${sessionAId}`,
      token: userFreeToken,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isTeacher, false);
    assert.ok(res.body.data.session);
  });

  // TEST CASE 13: Học sinh cố tình điều khiển live session: Bị chặn (403)
  await t.test('Case 13: Học sinh cố tình điều khiển live session (next, spin, activity, end): Bị chặn (403)', async () => {
    // 13.1 Học sinh gọi next
    const resNext = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/interactive-sessions/${sessionAId}/next`,
      token: userFreeToken,
      body: { current_item: { id: 'test' } },
    });
    assert.equal(resNext.status, 403);

    // 13.2 Học sinh gọi spin
    const resSpin = await invokeRequest(app, {
      method: 'POST',
      url: `/api/interactive-sessions/${sessionAId}/spin`,
      token: userFreeToken,
    });
    assert.equal(resSpin.status, 403);

    // 13.3 Học sinh đổi activity
    const resActivity = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/interactive-sessions/${sessionAId}/activity`,
      token: userFreeToken,
      body: { activity_id: activityAId },
    });
    assert.equal(resActivity.status, 403);

    // 13.4 Học sinh kết thúc session
    const resEnd = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/interactive-sessions/${sessionAId}/end`,
      token: userFreeToken,
    });
    assert.equal(resEnd.status, 403);
  });

  // Host can successfully control session
  await t.test('Host controls session: spin, submit response, and end session', async () => {
    const resSpin = await invokeRequest(app, {
      method: 'POST',
      url: `/api/interactive-sessions/${sessionAId}/spin`,
      token: userCustomAToken,
    });
    assert.equal(resSpin.status, 200);
    assert.ok(resSpin.body.data.selected_item.word);

    // Student submits answer
    const resResp = await invokeRequest(app, {
      method: 'POST',
      url: `/api/interactive-sessions/${sessionAId}/response`,
      token: userFreeToken,
      body: {
        activity_type: 'quiz',
        item_id: 'q1',
        answer: 'die',
      },
    });
    assert.equal(resResp.status, 201);

    // Host ends session
    const resEnd = await invokeRequest(app, {
      method: 'PUT',
      url: `/api/interactive-sessions/${sessionAId}/end`,
      token: userCustomAToken,
    });
    assert.equal(resEnd.status, 200);
    assert.equal(resEnd.body.data.session.status, 'ended');
  });

  // Additional: Host deletes class A
  await t.test('Host deletes class A: Thành công (200)', async () => {
    const res = await invokeRequest(app, {
      method: 'DELETE',
      url: `/api/classes/${classAId}`,
      token: userCustomAToken,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deletedId, classAId);
  });
});
