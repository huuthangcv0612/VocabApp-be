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
const InteractiveSession = (await import('./src/models/InteractiveSession.js')).default;
const {
  addOnlineStudent,
  removeOnlineStudent,
  getOnlineStudents,
  getOnlineStudentsCount,
  removeSocketFromAllSessions,
  clearAllPresence,
} = await import('./src/realtime/sessionPresence.js');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// In-memory mock database
const db = {
  users: new Map(),
  subscriptions: new Map(),
  classes: new Map(),
  classMembers: new Map(),
  interactiveSessions: new Map(),
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

function invokeRequest(app, { method, url, token, body = null }) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = { 'content-type': 'application/json' };
    if (token) req.headers['authorization'] = `Bearer ${token}`;
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

    if (body) req.body = body;

    try {
      app.handle(req, res, (err) => {
        if (err) resolve({ status: 500, body: { error: err.message } });
      });
    } catch (err) {
      reject(err);
    }
  });
}

test('=== COMPREHENSIVE VERIFICATION: STUDENT COUNT IN INTERACTIVE CLASSES & ROOM ===', async (t) => {
  // Setup mock Mongoose hooks
  const origUserFindById = User.findById;
  const origSubFindOne = Subscription.findOne;
  const origClassFind = Class.find;
  const origClassFindById = Class.findById;
  const origMemberFind = ClassMember.find;
  const origMemberFindOne = ClassMember.findOne;
  const origMemberCount = ClassMember.countDocuments;
  const origMemberAggregate = ClassMember.aggregate;
  const origSessionFindById = InteractiveSession.findById;

  User.findById = (id) => makeQuery(db.users.get(id?.toString()) || null);
  Subscription.findOne = (query) => {
    const sub = db.subscriptions.get(query.userId?.toString());
    return { populate: () => Promise.resolve(sub || null) };
  };

  Class.find = (query) => {
    const list = Array.from(db.classes.values()).filter((c) => {
      const cTeacherId = (c.teacher_id?._id || c.teacher_id)?.toString();
      const qTeacherId = (query.teacher_id?._id || query.teacher_id)?.toString();
      if (qTeacherId && cTeacherId !== qTeacherId) return false;
      return true;
    }).map((c) => ({
      ...c,
      toObject: () => ({ ...c }),
    }));
    return makeQuery(list);
  };

  Class.findById = (id) => {
    const c = db.classes.get(id?.toString()) || null;
    if (!c) return makeQuery(null);
    return makeQuery({
      ...c,
      toObject: () => ({ ...c }),
    });
  };

  ClassMember.find = (query) => {
    const qClassId = (query.class_id?._id || query.class_id)?.toString();
    const qUserId = (query.user_id?._id || query.user_id)?.toString();
    const list = Array.from(db.classMembers.values()).filter((m) => {
      if (qClassId && m.class_id?.toString() !== qClassId) return false;
      if (qUserId && m.user_id?.toString() !== qUserId) return false;
      if (query.role && m.role !== query.role) return false;
      if (query.status && m.status !== query.status) return false;
      return true;
    }).map((m) => {
      const userObj = db.users.get(m.user_id?.toString()) || { _id: m.user_id };
      const classDoc = db.classes.get(m.class_id?.toString()) || { _id: m.class_id };
      return {
        ...m,
        user_id: userObj,
        class_id: { ...classDoc, toObject: () => ({ ...classDoc }) },
      };
    });
    return makeQuery(list);
  };

  ClassMember.findOne = (query) => {
    const qClassId = (query.class_id?._id || query.class_id)?.toString();
    const qUserId = (query.user_id?._id || query.user_id)?.toString();
    const found = Array.from(db.classMembers.values()).find((m) => {
      if (qClassId && m.class_id?.toString() !== qClassId) return false;
      if (qUserId && m.user_id?.toString() !== qUserId) return false;
      if (query.role && m.role !== query.role) return false;
      if (query.status && m.status !== query.status) return false;
      return true;
    });
    return makeQuery(found || null);
  };

  ClassMember.countDocuments = async (query) => {
    return Array.from(db.classMembers.values()).filter((m) => {
      if (query.class_id && m.class_id?.toString() !== query.class_id.toString()) return false;
      if (query.role && m.role !== query.role) return false;
      if (query.status && m.status !== query.status) return false;
      return true;
    }).length;
  };

  ClassMember.aggregate = async (pipeline) => {
    const match = pipeline[0]?.$match || {};
    const classIdIn = match.class_id?.$in?.map((id) => id.toString()) || [];
    const role = match.role;
    const status = match.status;

    const grouped = new Map();
    for (const m of db.classMembers.values()) {
      const mClassId = m.class_id?.toString();
      if (classIdIn.length > 0 && !classIdIn.includes(mClassId)) continue;
      if (role && m.role !== role) continue;
      if (status && m.status !== status) continue;

      grouped.set(mClassId, (grouped.get(mClassId) || 0) + 1);
    }

    return Array.from(grouped.entries()).map(([classId, count]) => ({
      _id: classId,
      count,
    }));
  };

  InteractiveSession.findById = (id) => {
    const s = db.interactiveSessions.get(id?.toString()) || null;
    if (!s) return makeQuery(null);
    return makeQuery({
      ...s,
      toObject: () => JSON.parse(JSON.stringify(s)),
    });
  };

  t.after(() => {
    User.findById = origUserFindById;
    Subscription.findOne = origSubFindOne;
    Class.find = origClassFind;
    Class.findById = origClassFindById;
    ClassMember.find = origMemberFind;
    ClassMember.findOne = origMemberFindOne;
    ClassMember.countDocuments = origMemberCount;
    ClassMember.aggregate = origMemberAggregate;
    InteractiveSession.findById = origSessionFindById;
    clearAllPresence();
  });

  // Setup sample users
  const teacherId = new mongoose.Types.ObjectId().toString();
  const studentAId = new mongoose.Types.ObjectId().toString();
  const studentBId = new mongoose.Types.ObjectId().toString();
  const studentCId = new mongoose.Types.ObjectId().toString();
  const classId = new mongoose.Types.ObjectId().toString();
  const sessionId = new mongoose.Types.ObjectId().toString();

  const teacher = {
    _id: new mongoose.Types.ObjectId(teacherId),
    name: 'Teacher Schmidt',
    email: 'schmidt@vocab.de',
    role: 'user',
  };
  const studentA = {
    _id: new mongoose.Types.ObjectId(studentAId),
    name: 'Student Anna',
    email: 'anna@vocab.de',
    role: 'user',
    avatar: 'https://avatar.com/anna.png',
  };
  const studentB = {
    _id: new mongoose.Types.ObjectId(studentBId),
    name: 'Student Ben',
    email: 'ben@vocab.de',
    role: 'user',
    avatar: 'https://avatar.com/ben.png',
  };
  const studentC = {
    _id: new mongoose.Types.ObjectId(studentCId),
    name: 'Student Clara',
    email: 'clara@vocab.de',
    role: 'user',
    avatar: 'https://avatar.com/clara.png',
  };

  db.users.set(teacherId, teacher);
  db.users.set(studentAId, studentA);
  db.users.set(studentBId, studentB);
  db.users.set(studentCId, studentC);

  // Teacher has Custom Plan
  db.subscriptions.set(teacherId, {
    userId: teacher._id,
    status: 'ACTIVE',
    endDate: new Date(Date.now() + 86400000),
    planId: {
      name: 'Custom Teacher Plan',
      code: 'CUSTOM_TEACHER',
      planType: 'CUSTOM',
      permissions: ['basic_learning', 'ai_learning', 'class_management', 'interactive_classes', 'teacher_dashboard'],
    },
  });

  // Setup Class
  const classDoc = {
    _id: new mongoose.Types.ObjectId(classId),
    name: 'Deutsch B1 Meisterklasse',
    description: 'B1 Intensive Room',
    class_code: 'DEUTSCHB1',
    teacher_id: teacher,
    status: 'active',
  };
  db.classes.set(classId, classDoc);

  // Setup Interactive Session
  const sessionDoc = {
    _id: new mongoose.Types.ObjectId(sessionId),
    class_id: classDoc,
    teacher_id: teacher,
    status: 'active',
    responses: [],
  };
  db.interactiveSessions.set(sessionId, sessionDoc);

  const teacherToken = generateToken(teacherId);
  const studentAToken = generateToken(studentAId);
  const studentBToken = generateToken(studentBId);

  // -------------------------------------------------------------
  // TEST 1 — Class count (Teacher T, Student A, B, C -> count = 3, NOT 4)
  // -------------------------------------------------------------
  await t.test('Test 1 — Class count: teacher T + 3 active students -> studentCount = 3 (Not 4)', async () => {
    // Populate classmembers: 1 teacher + 3 active students
    db.classMembers.clear();
    db.classMembers.set(`${classId}_${teacherId}`, {
      _id: new mongoose.Types.ObjectId(),
      class_id: classDoc._id,
      user_id: teacher._id,
      role: 'teacher',
      status: 'active',
    });
    db.classMembers.set(`${classId}_${studentAId}`, {
      _id: new mongoose.Types.ObjectId(),
      class_id: classDoc._id,
      user_id: studentA._id,
      role: 'student',
      status: 'active',
    });
    db.classMembers.set(`${classId}_${studentBId}`, {
      _id: new mongoose.Types.ObjectId(),
      class_id: classDoc._id,
      user_id: studentB._id,
      role: 'student',
      status: 'active',
    });
    db.classMembers.set(`${classId}_${studentCId}`, {
      _id: new mongoose.Types.ObjectId(),
      class_id: classDoc._id,
      user_id: studentC._id,
      role: 'student',
      status: 'active',
    });

    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/classes/${classId}`,
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.studentCount, 3, 'Root studentCount must be 3');
    assert.equal(res.body.data.students_count, 3, 'Root students_count must be 3');
    assert.equal(res.body.data.class.studentCount, 3, 'Inside class.studentCount must be 3');
    assert.equal(res.body.data.class.students_count, 3, 'Inside class.students_count must be 3');
  });

  // -------------------------------------------------------------
  // TEST 2 — Inactive student (Student C inactive -> count = 2)
  // -------------------------------------------------------------
  await t.test('Test 2 — Inactive student: student A active, student B active, student C inactive -> count = 2', async () => {
    db.classMembers.set(`${classId}_${studentCId}`, {
      _id: new mongoose.Types.ObjectId(),
      class_id: classDoc._id,
      user_id: studentC._id,
      role: 'student',
      status: 'removed', // Inactive
    });

    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/classes/${classId}`,
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.studentCount, 2);
    assert.equal(res.body.data.students_count, 2);
    assert.equal(res.body.data.class.studentCount, 2);
    assert.equal(res.body.data.class.students_count, 2);
  });

  // -------------------------------------------------------------
  // TEST 3 — GET /api/classes (Each class has students_count & studentCount)
  // -------------------------------------------------------------
  await t.test('Test 3 — GET /api/classes returns both students_count and studentCount', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/classes',
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.classes.length, 1);
    const cls = res.body.data.classes[0];
    assert.equal(cls.students_count, 2);
    assert.equal(cls.studentCount, 2);
    assert.equal(cls.name, 'Deutsch B1 Meisterklasse');
  });

  // -------------------------------------------------------------
  // TEST 4 — GET /api/classes/my (Each class has students_count & studentCount)
  // -------------------------------------------------------------
  await t.test('Test 4 — GET /api/classes/my returns both students_count and studentCount', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: '/api/classes/my',
      token: studentAToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.classes.length, 1);
    const cls = res.body.data.classes[0];
    assert.equal(cls.students_count, 2);
    assert.equal(cls.studentCount, 2);
  });

  // -------------------------------------------------------------
  // TEST 5 — GET /api/classes/:id (All 4 count fields exist)
  // -------------------------------------------------------------
  await t.test('Test 5 — GET /api/classes/:id contains all 4 count fields', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/classes/${classId}`,
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.data.studentCount, 'number');
    assert.equal(typeof res.body.data.students_count, 'number');
    assert.equal(typeof res.body.data.class.studentCount, 'number');
    assert.equal(typeof res.body.data.class.students_count, 'number');
    assert.equal(res.body.data.studentCount, res.body.data.class.students_count);
  });

  // -------------------------------------------------------------
  // TEST 6 — getClassStudents (Top-level fields + backward-compatible user)
  // -------------------------------------------------------------
  await t.test('Test 6 — getClassStudents has top-level student fields and user object', async () => {
    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/classes/${classId}/students`,
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.students.length, 2); // Anna and Ben (Clara removed)

    for (const student of res.body.data.students) {
      assert.ok(student._id, 'Must have _id at top-level');
      assert.ok(student.name, 'Must have name at top-level');
      assert.ok(student.email, 'Must have email at top-level');
      assert.ok(student.avatar, 'Must have avatar at top-level');
      assert.ok(student.status, 'Must have status at top-level');
      assert.ok(student.user, 'Must preserve user object for backward compatibility');
      assert.equal(student.user._id.toString(), student._id.toString());
    }
  });

  // -------------------------------------------------------------
  // TEST 7 & 8 — Socket presence: sessionId and legacy session_id
  // -------------------------------------------------------------
  await t.test('Test 7 & 8 — Presence tracker supports sessionId and legacy session_id', () => {
    clearAllPresence();

    // 7. Join with camelCase sessionId
    const resA = addOnlineStudent(
      sessionId,
      { id: studentAId, name: studentA.name, avatar: studentA.avatar },
      'socket_a1'
    );
    assert.equal(resA.isFirstSocket, true);
    assert.equal(getOnlineStudentsCount(sessionId), 1);

    // 8. Join with snake_case session_id (legacy)
    const resB = addOnlineStudent(
      sessionId,
      { _id: studentBId, name: studentB.name, avatar: studentB.avatar },
      'socket_b1'
    );
    assert.equal(resB.isFirstSocket, true);
    assert.equal(getOnlineStudentsCount(sessionId), 2);
  });

  // -------------------------------------------------------------
  // TEST 9 — Duplicate join (Same user join twice from 2 tabs)
  // -------------------------------------------------------------
  await t.test('Test 9 — Duplicate join: same user joins twice -> only 1 record in online students', () => {
    const countBefore = getOnlineStudentsCount(sessionId);
    assert.equal(countBefore, 2);

    // Student A opens a 2nd tab (different socketId, same userId)
    const resA2 = addOnlineStudent(
      sessionId,
      { id: studentAId, name: studentA.name, avatar: studentA.avatar },
      'socket_a2'
    );

    assert.equal(resA2.isFirstSocket, false, 'Second socket of same user is not first socket');
    assert.equal(getOnlineStudentsCount(sessionId), 2, 'Online count must still be 2');

    const onlineList = getOnlineStudents(sessionId);
    const studentAOccurrences = onlineList.filter((s) => s.id === studentAId);
    assert.equal(studentAOccurrences.length, 1, 'Student A must only appear once');
  });

  // -------------------------------------------------------------
  // TEST 10 — Leave room (Student B leaves room)
  // -------------------------------------------------------------
  await t.test('Test 10 — Leave room: student B leaves -> removed from online list', () => {
    const leaveRes = removeOnlineStudent(sessionId, studentBId, 'socket_b1');
    assert.equal(leaveRes.removed, true);
    assert.equal(leaveRes.student.id, studentBId);

    assert.equal(getOnlineStudentsCount(sessionId), 1);
    const onlineList = getOnlineStudents(sessionId);
    assert.equal(onlineList[0].id, studentAId);
  });

  // -------------------------------------------------------------
  // TEST 11 — Disconnect (Student A closes tab 2, then tab 1)
  // -------------------------------------------------------------
  await t.test('Test 11 — Disconnect: multi-tab disconnect only removes user when last socket disconnects', () => {
    // Close tab 2 (socket_a2)
    const leftSessions1 = removeSocketFromAllSessions('socket_a2');
    assert.equal(leftSessions1.length, 0, 'User is still online on tab 1');
    assert.equal(getOnlineStudentsCount(sessionId), 1);

    // Close tab 1 (socket_a1)
    const leftSessions2 = removeSocketFromAllSessions('socket_a1');
    assert.equal(leftSessions2.length, 1, 'User completely left the session');
    assert.equal(leftSessions2[0].student.id, studentAId);
    assert.equal(getOnlineStudentsCount(sessionId), 0, 'Session is now empty');
  });

  // -------------------------------------------------------------
  // TEST 12 — Refresh: Teacher fetches session and gets connected_students
  // -------------------------------------------------------------
  await t.test('Test 12 — Refresh: GET /api/interactive-sessions/:id returns connected_students', async () => {
    clearAllPresence();

    // Student A and Student B are online in the session
    addOnlineStudent(sessionId, { id: studentAId, name: studentA.name, avatar: studentA.avatar }, 'socket_a1');
    addOnlineStudent(sessionId, { id: studentBId, name: studentB.name, avatar: studentB.avatar }, 'socket_b1');

    // Teacher refreshes / fetches session
    const res = await invokeRequest(app, {
      method: 'GET',
      url: `/api/interactive-sessions/${sessionId}`,
      token: teacherToken,
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.session, 'Session must exist');
    assert.ok(Array.isArray(res.body.data.session.connected_students), 'connected_students array must exist');
    assert.equal(res.body.data.session.connected_students.length, 2, 'Must have 2 connected students');
    assert.equal(res.body.data.session.connected_students_count, 2, 'Must report count 2');

    const ids = res.body.data.session.connected_students.map((s) => s.id);
    assert.ok(ids.includes(studentAId));
    assert.ok(ids.includes(studentBId));
  });
});
