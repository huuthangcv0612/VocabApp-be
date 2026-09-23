/**
 * Real-time In-Memory Presence Tracker for Live Interactive Sessions
 * 
 * Maps sessionId -> Map of userId -> { studentData, socketIds: Set<socketId> }
 * Guarantees distinct users by userId (preventing duplicate participants across multi-tab / reconnects)
 */

const sessionOnlineUsers = new Map();

/**
 * Add or update an online student in a live session
 *
 * @param {string} sessionId
 * @param {object} studentData - Must contain id / _id / user_id
 * @param {string} socketId
 * @returns {{ isFirstSocket: boolean, student: object }}
 */
export const addOnlineStudent = (sessionId, studentData, socketId) => {
  if (!sessionId || !studentData) return { isFirstSocket: false, student: studentData };

  const sId = sessionId.toString();
  const uId = (studentData.id || studentData._id || studentData.user_id || studentData.student_id || '').toString();
  if (!uId) return { isFirstSocket: false, student: studentData };

  if (!sessionOnlineUsers.has(sId)) {
    sessionOnlineUsers.set(sId, new Map());
  }

  const sessionMap = sessionOnlineUsers.get(sId);
  const existing = sessionMap.get(uId);

  const normalizedStudent = {
    id: uId,
    _id: uId,
    student_id: uId,
    user_id: uId,
    name: studentData.name || 'Học viên',
    avatar: studentData.avatar || '',
  };

  if (existing) {
    if (socketId) existing.socketIds.add(socketId);
    existing.studentData = normalizedStudent;
    return { isFirstSocket: false, student: normalizedStudent };
  }

  const socketSet = new Set();
  if (socketId) socketSet.add(socketId);

  sessionMap.set(uId, {
    studentData: normalizedStudent,
    socketIds: socketSet,
  });

  return { isFirstSocket: true, student: normalizedStudent };
};

/**
 * Remove a student (or one of their sockets) from a live session
 *
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} [socketId]
 * @returns {{ removed: boolean, student: object|null }}
 */
export const removeOnlineStudent = (sessionId, userId, socketId) => {
  if (!sessionId || !userId) return { removed: false, student: null };

  const sId = sessionId.toString();
  const uId = userId.toString();

  const sessionMap = sessionOnlineUsers.get(sId);
  if (!sessionMap || !sessionMap.has(uId)) {
    return { removed: false, student: null };
  }

  const entry = sessionMap.get(uId);

  if (socketId && entry.socketIds.has(socketId)) {
    entry.socketIds.delete(socketId);
  }

  // If no sockets left for this user (or socketId was not provided), remove user
  if (!socketId || entry.socketIds.size === 0) {
    const studentData = entry.studentData;
    sessionMap.delete(uId);

    if (sessionMap.size === 0) {
      sessionOnlineUsers.delete(sId);
    }

    return { removed: true, student: studentData };
  }

  return { removed: false, student: entry.studentData };
};

/**
 * Remove a socket from all sessions it is connected to (called on disconnect)
 *
 * @param {string} socketId
 * @returns {Array<{ sessionId: string, student: object }>} List of sessions from which the student was completely removed
 */
export const removeSocketFromAllSessions = (socketId) => {
  if (!socketId) return [];

  const leftSessions = [];

  for (const [sId, sessionMap] of sessionOnlineUsers.entries()) {
    for (const [uId, entry] of sessionMap.entries()) {
      if (entry.socketIds.has(socketId)) {
        entry.socketIds.delete(socketId);

        if (entry.socketIds.size === 0) {
          const studentData = entry.studentData;
          sessionMap.delete(uId);
          leftSessions.push({ sessionId: sId, student: studentData });
        }
      }
    }

    if (sessionMap.size === 0) {
      sessionOnlineUsers.delete(sId);
    }
  }

  return leftSessions;
};

/**
 * Get distinct online students for a session
 *
 * @param {string} sessionId
 * @returns {Array<object>}
 */
export const getOnlineStudents = (sessionId) => {
  if (!sessionId) return [];
  const sId = sessionId.toString();
  const sessionMap = sessionOnlineUsers.get(sId);
  if (!sessionMap) return [];
  return Array.from(sessionMap.values()).map((e) => e.studentData);
};

/**
 * Get count of distinct online students for a session
 *
 * @param {string} sessionId
 * @returns {number}
 */
export const getOnlineStudentsCount = (sessionId) => {
  if (!sessionId) return 0;
  const sId = sessionId.toString();
  const sessionMap = sessionOnlineUsers.get(sId);
  return sessionMap ? sessionMap.size : 0;
};

/**
 * Clear all presence state (utility for testing)
 */
export const clearAllPresence = () => {
  sessionOnlineUsers.clear();
};

export default {
  addOnlineStudent,
  removeOnlineStudent,
  removeSocketFromAllSessions,
  getOnlineStudents,
  getOnlineStudentsCount,
  clearAllPresence,
};
