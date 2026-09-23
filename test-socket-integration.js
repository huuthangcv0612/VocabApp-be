import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { io as Client } from '../VocabApp-fe/node_modules/socket.io-client/build/esm/index.js';

process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';

const { default: app } = await import('./src/app.js');
const { initSocket } = await import('./src/realtime/socketHandler.js');
const { clearAllPresence, getOnlineStudentsCount } = await import('./src/realtime/sessionPresence.js');
const User = (await import('./src/models/User.js')).default;
const Class = (await import('./src/models/Class.js')).default;
const ClassMember = (await import('./src/models/ClassMember.js')).default;
const InteractiveSession = (await import('./src/models/InteractiveSession.js')).default;

test('=== REAL SOCKET.IO INTEGRATION TEST ===', async (t) => {
  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const socketUrl = `http://localhost:${port}`;

  const teacherId = new mongoose.Types.ObjectId().toString();
  const studentAId = new mongoose.Types.ObjectId().toString();
  const studentBId = new mongoose.Types.ObjectId().toString();
  const classId = new mongoose.Types.ObjectId().toString();
  const sessionId = new mongoose.Types.ObjectId().toString();

  const teacherUser = { _id: new mongoose.Types.ObjectId(teacherId), name: 'Teacher T', role: 'user' };
  const studentAUser = { _id: new mongoose.Types.ObjectId(studentAId), name: 'Student A', role: 'user', avatar: 'a.png' };
  const studentBUser = { _id: new mongoose.Types.ObjectId(studentBId), name: 'Student B', role: 'user', avatar: 'b.png' };

  const dbUsers = new Map([
    [teacherId, teacherUser],
    [studentAId, studentAUser],
    [studentBId, studentBUser],
  ]);

  const origUserFindById = User.findById;
  const origSessionFindById = InteractiveSession.findById;
  const origMemberFindOne = ClassMember.findOne;

  const makeQuery = (res) => ({
    populate: () => makeQuery(res),
    then: (resolve, reject) => Promise.resolve(res).then(resolve, reject),
  });

  User.findById = (id) => makeQuery(dbUsers.get(id?.toString()) || null);
  InteractiveSession.findById = (id) => {
    if (id?.toString() === sessionId) {
      return makeQuery({
        _id: new mongoose.Types.ObjectId(sessionId),
        class_id: new mongoose.Types.ObjectId(classId),
        teacher_id: new mongoose.Types.ObjectId(teacherId),
        status: 'active',
      });
    }
    return makeQuery(null);
  };
  ClassMember.findOne = (query) => {
    // Both studentA and studentB are active members
    const uid = query.user_id?.toString();
    if (uid === studentAId || uid === studentBId) {
      return makeQuery({
        _id: new mongoose.Types.ObjectId(),
        class_id: new mongoose.Types.ObjectId(classId),
        user_id: new mongoose.Types.ObjectId(uid),
        role: 'student',
        status: 'active',
      });
    }
    return makeQuery(null);
  };

  const teacherToken = jwt.sign({ id: teacherId }, process.env.JWT_SECRET);
  const studentAToken = jwt.sign({ id: studentAId }, process.env.JWT_SECRET);
  const studentBToken = jwt.sign({ id: studentBId }, process.env.JWT_SECRET);

  const createSocketClient = (token) => {
    return new Promise((resolve) => {
      const client = Client(socketUrl, {
        auth: { token },
        transports: ['websocket'],
      });
      client.on('connect', () => resolve(client));
    });
  };

  let teacherClient;
  let studentAClient;
  let studentBClient;

  t.after(async () => {
    teacherClient?.disconnect();
    studentAClient?.disconnect();
    studentBClient?.disconnect();
    User.findById = origUserFindById;
    InteractiveSession.findById = origSessionFindById;
    ClassMember.findOne = origMemberFindOne;
    clearAllPresence();
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('Connect teacher socket and join session with sessionId', async () => {
    teacherClient = await createSocketClient(teacherToken);
    assert.ok(teacherClient.connected);

    const joinRes = await new Promise((resolve) => {
      teacherClient.emit('teacher:join-session', { sessionId }, (res) => resolve(res));
    });

    assert.equal(joinRes.success, true);
    assert.equal(joinRes.message, 'Teacher joined session room');
    assert.ok(Array.isArray(joinRes.students));
  });

  await t.test('Student A joins session with camelCase sessionId and triggers student:joined on teacher', async () => {
    studentAClient = await createSocketClient(studentAToken);
    assert.ok(studentAClient.connected);

    // Teacher listens for student:joined
    const teacherReceivedPromise = new Promise((resolve) => {
      teacherClient.once('student:joined', (data) => resolve(data));
    });

    const joinRes = await new Promise((resolve) => {
      studentAClient.emit('student:join-session', { sessionId }, (res) => resolve(res));
    });

    assert.equal(joinRes.success, true);
    assert.equal(joinRes.students.length, 1);
    assert.equal(joinRes.students[0].id, studentAId);

    const teacherReceived = await teacherReceivedPromise;
    assert.equal(teacherReceived.id, studentAId);
    assert.equal(teacherReceived.name, 'Student A');
    assert.equal(getOnlineStudentsCount(sessionId), 1);
  });

  await t.test('Student B joins session with legacy snake_case session_id', async () => {
    studentBClient = await createSocketClient(studentBToken);
    assert.ok(studentBClient.connected);

    const joinRes = await new Promise((resolve) => {
      studentBClient.emit('student:join-session', { session_id: sessionId }, (res) => resolve(res));
    });

    assert.equal(joinRes.success, true);
    assert.equal(joinRes.students.length, 2);
    assert.equal(getOnlineStudentsCount(sessionId), 2);
  });

  await t.test('Student B leaves room via leave-room -> teacher receives student:left', async () => {
    const teacherLeftPromise = new Promise((resolve) => {
      teacherClient.once('student:left', (data) => resolve(data));
    });

    studentBClient.emit('leave-room', { sessionId });

    const leftData = await teacherLeftPromise;
    assert.equal(leftData.id, studentBId);
    assert.equal(getOnlineStudentsCount(sessionId), 1);
  });

  await t.test('Student A disconnects -> teacher receives student:left and count becomes 0', async () => {
    const teacherLeftPromise = new Promise((resolve) => {
      teacherClient.once('student:left', (data) => resolve(data));
    });

    studentAClient.disconnect();

    const leftData = await teacherLeftPromise;
    assert.equal(leftData.id, studentAId);
    assert.equal(getOnlineStudentsCount(sessionId), 0);
  });
});
