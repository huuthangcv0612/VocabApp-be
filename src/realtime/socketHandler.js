import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import InteractiveSession from '../models/InteractiveSession.js';
import ClassMember from '../models/ClassMember.js';
import { ROLES } from '../utils/constants.js';
import { allowedOrigins } from '../config/cors.js';

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

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Realtime authentication failed: ' + err.message));
    }
  });

  // Connection Handler
  ioInstance.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 [Socket.IO] Client connected: ${user.name} (${user._id})`);

    // Student joins a session room
    socket.on('student:join-session', async (payload, callback) => {
      try {
        const { session_id } = payload || {};
        if (!session_id) return callback?.({ success: false, message: 'session_id required' });

        const session = await InteractiveSession.findById(session_id);
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

        const room = `session:${session_id}`;
        socket.join(room);

        // Notify room (teacher) that student joined
        socket.to(room).emit('student:joined', {
          user_id: user._id,
          name: user.name,
          avatar: user.avatar,
        });

        callback?.({ success: true, message: 'Joined session room successfully' });
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
        const { session_id } = payload || {};
        if (!session_id) return callback?.({ success: false, message: 'session_id required' });

        const isHost = await verifySessionHost(session_id);
        if (!isHost) {
          return callback?.({ success: false, message: 'Not authorized as teacher for this session' });
        }

        const room = `session:${session_id}`;
        socket.join(room);

        callback?.({ success: true, message: 'Teacher joined session room' });
      } catch (error) {
        callback?.({ success: false, message: error.message });
      }
    });

    // Teacher starts session
    socket.on('teacher:start-session', async (payload, callback) => {
      const { session_id } = payload || {};
      if (session_id) {
        const isHost = await verifySessionHost(session_id);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${session_id}`).emit('session:started', { session_id });
        callback?.({ success: true });
      }
    });

    // Teacher starts activity
    socket.on('teacher:start-activity', async (payload, callback) => {
      const { session_id, activity } = payload || {};
      if (session_id) {
        const isHost = await verifySessionHost(session_id);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${session_id}`).emit('activity:started', { activity });
        callback?.({ success: true });
      }
    });

    // Teacher moves to next item
    socket.on('teacher:next', async (payload, callback) => {
      const { session_id, current_item } = payload || {};
      if (session_id) {
        const isHost = await verifySessionHost(session_id);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${session_id}`).emit('session:next-item', { current_item });
        callback?.({ success: true });
      }
    });

    // Teacher shows answer
    socket.on('teacher:show-answer', async (payload, callback) => {
      const { session_id, answer_data } = payload || {};
      if (session_id) {
        const isHost = await verifySessionHost(session_id);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${session_id}`).emit('session:show-answer', { answer_data });
        callback?.({ success: true });
      }
    });

    // Student submits answer
    socket.on('student:submit-answer', async (payload, callback) => {
      try {
        const { session_id, item_id, answer, activity_type } = payload || {};
        if (!session_id) return callback?.({ success: false, message: 'session_id required' });

        const room = `session:${session_id}`;
        socket.to(room).emit('student:answered', {
          user_id: user._id,
          name: user.name,
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

    // Teacher ends session
    socket.on('teacher:end-session', async (payload, callback) => {
      const { session_id } = payload || {};
      if (session_id) {
        const isHost = await verifySessionHost(session_id);
        if (!isHost) return callback?.({ success: false, message: 'Forbidden' });
        ioInstance.to(`session:${session_id}`).emit('session:ended', { session_id });
        callback?.({ success: true });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${user.name}`);
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
