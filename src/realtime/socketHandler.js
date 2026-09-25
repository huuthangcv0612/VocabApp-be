import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import InteractiveSession from '../models/InteractiveSession.js';
import ClassMember from '../models/ClassMember.js';
import { ROLES } from '../utils/constants.js';
import { allowedOrigins } from '../config/cors.js';
import {
  addOnlineStudent,
  removeOnlineStudent,
  removeSocketFromAllSessions,
  getOnlineStudents,
} from './sessionPresence.js';

let ioInstance = null;

/**
 * Initialize Socket.IO server
 *
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Socket Authentication Middleware
  ioInstance.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;

      if (!token) {
        return next(new Error('Authentication token required for realtime'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your_jwt_secret'
      );
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.status === 'locked' || user.isActive === false) {
        return next(new Error('ACCOUNT_LOCKED: Tài khoản của bạn đã bị khóa'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Realtime authentication failed: ' + err.message));
    }
  });

  // Connection Handler
  ioInstance.on('connection', (socket) => {
    const user = socket.user;
    socket.sessionRooms = new Set();
    console.log(`🔌 [Socket.IO] Client connected: ${user.name} (${user._id})`);

    const handleStudentLeave = (targetSessionId) => {
      if (!targetSessionId) return;
      const sId = targetSessionId.toString();
      const room = `session:${sId}`;
      socket.leave(room);
      socket.sessionRooms.delete(sId);
      if (socket.currentSessionId === sId) {
        socket.currentSessionId = null;
      }

      const { removed, student } = removeOnlineStudent(sId, user._id.toString(), socket.id);
      if (removed && student) {
        socket.to(room).emit('student:left', {
          id: student.id,
          _id: student._id,
          user_id: student.user_id,
          student_id: student.student_id,
        });
      }
    };

    // Student joins a session room
    socket.on('student:join-session', async (payload, callback) => {
      try {
        const sessionId = payload?.session_id || payload?.sessionId;
        if (!sessionId) return callback?.({ success: false, message: 'session_id required' });

        const session = await InteractiveSession.findById(sessionId);
        if (!session) return callback?.({ success: false, message: 'Session not found' });

        // Check if student is an active member of this class
        const membership = await ClassMember.findOne({
          class_id: session.class_id,
          user_id: user._id,
          status: 'active',
        });

        if (!membership && user.role !== ROLES.ADMIN) {
          return callback?.({ success: false, message: 'Not authorized for this session' });
        }

        const room = `session:${sessionId}`;
        socket.join(room);
        socket.currentSessionId = sessionId.toString();
        socket.sessionRooms.add(sessionId.toString());

        const studentData = {
          id: user._id.toString(),
          _id: user._id.toString(),
          student_id: user._id.toString(),
          user_id: user._id.toString(),
          name: user.name,
          avatar: user.avatar,
        };

        const { isFirstSocket } = addOnlineStudent(sessionId.toString(), studentData, socket.id);

        // Notify room (teacher & peers) that student joined
        if (isFirstSocket) {
          socket.to(room).emit('student:joined', studentData);
        }

        const onlineList = getOnlineStudents(sessionId.toString());
        socket.emit('session:connected-students', { students: onlineList });

        callback?.({ success: true, message: 'Joined session room successfully', students: onlineList });
      } catch (error) {
        callback?.({ success: false, message: error.message });
      }
    });

    const verifySessionHost = async (sessionId) => {
      if (user.role === ROLES.ADMIN) return true;
      const session = await InteractiveSession.findById(sessionId);
      if (!session) return false;
      const teacherId = (session.teacher_id?._id || session.teacher_id).toString();
      return teacherId === user._id.toString();
    };

    // Teacher joins session room
    socket.on('teacher:join-session', async (payload, callback) => {
      try {
        const sessionId = payload?.session_id || payload?.sessionId;
        if (!sessionId) return callback?.({ success: false, message: 'session_id required' });

        const isHost = await verifySessionHost(sessionId);
        if (!isHost) {
          return callback?.({ success: false, message: 'Not authorized as teacher for this session' });
        }

        const room = `session:${sessionId}`;
        socket.join(room);
        socket.currentSessionId = sessionId.toString();
        socket.sessionRooms.add(sessionId.toString());

        const onlineList = getOnlineStudents(sessionId.toString());
        socket.emit('session:connected-students', { students: onlineList });

        callback?.({ success: true, message: 'Teacher joined session room', students: onlineList });
      } catch (error) {
        callback?.({ success: false, message: error.message });
      }
    });

    // Teacher starts session
    socket.on('teacher:start-session', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('session:started', {
          session_id: sessionId,
          sessionId,
        });
        callback?.({ success: true });
      }
    });

    // Teacher starts activity
    socket.on('teacher:start-activity', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      const activity = payload?.activity || payload;
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('activity:started', {
          activity,
          activity_id: payload?.activity_id || activity?._id || activity?.id,
          type: payload?.type || activity?.type,
        });
        callback?.({ success: true });
      }
    });

    // Teacher moves to next item
    socket.on('teacher:next', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      const { current_item } = payload || {};
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('session:next-item', { current_item });
        callback?.({ success: true });
      }
    });

    // Teacher shows answer
    socket.on('teacher:show-answer', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      const { answer_data } = payload || {};
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('session:show-answer', { answer_data });
        callback?.({ success: true });
      }
    });

    // Teacher spin
    socket.on('teacher:spin', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('session:spun', payload?.spin_result || payload);
        callback?.({ success: true });
      }
    });

    // Student submits answer
    socket.on('student:submit-answer', async (payload, callback) => {
      try {
        const sessionId = payload?.session_id || payload?.sessionId;
        const { item_id, answer, activity_type } = payload || {};
        if (!sessionId) return callback?.({ success: false, message: 'session_id required' });

        const room = `session:${sessionId}`;
        socket.to(room).emit('student:answered', {
          id: user._id.toString(),
          _id: user._id.toString(),
          student_id: user._id.toString(),
          userId: user._id.toString(),
          user_id: user._id.toString(),
          name: user.name,
          student_name: user.name,
          item_id,
          answer,
          activity_type,
          submitted_at: new Date(),
        });

        callback?.({ success: true, message: 'Answer received' });
      } catch (error) {
        callback?.({ success: false, message: error.message });
      }
    });

    // Student/client leaves session room
    socket.on('leave-room', (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      if (sessionId) {
        handleStudentLeave(sessionId);
        callback?.({ success: true });
      }
    });

    socket.on('student:leave-session', (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      if (sessionId) {
        handleStudentLeave(sessionId);
        callback?.({ success: true });
      }
    });

    // Teacher ends session
    socket.on('teacher:end-session', async (payload, callback) => {
      const sessionId = payload?.session_id || payload?.sessionId;
      if (sessionId) {
        const isHost = await verifySessionHost(sessionId);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${sessionId}`).emit('session:ended', {
          session_id: sessionId,
          sessionId,
        });
        callback?.({ success: true });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${user.name} (${user._id})`);
      try {
        const leftSessions = removeSocketFromAllSessions(socket.id);
        for (const { sessionId, student } of leftSessions) {
          socket.to(`session:${sessionId}`).emit('student:left', {
            id: student.id,
            _id: student._id,
            user_id: student.user_id,
            student_id: student.student_id,
          });
        }
      } catch (err) {
        console.error('Error handling socket disconnect presence:', err);
      }
    });
  });

  return ioInstance;
};

/**
 * Emit event to a live session room from controllers
 *
 * @param {String} sessionId
 * @param {String} event
 * @param {Object} data
 */
export const emitSessionEvent = (sessionId, event, data) => {
  if (ioInstance && sessionId) {
    ioInstance.to(`session:${sessionId}`).emit(event, data);
  }
};

/**
 * Get Socket.IO instance
 */
export const getIO = () => ioInstance;

export default {
  initSocket,
  emitSessionEvent,
  getIO,
};
