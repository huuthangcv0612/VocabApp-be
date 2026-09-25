import express from 'express';
import {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  joinClass,
  getMyClasses,
  getClassStudents,
  removeStudentFromClass,
} from '../controllers/classController.js';
import { verifyToken, requireActiveUser } from '../middlewares/authMiddleware.js';
import { requireCustomPlan, isTeacherOrAdmin } from '../middlewares/planMiddleware.js';

const router = express.Router();

// All class endpoints require authentication and active account
router.use(verifyToken, requireActiveUser);

// Student membership endpoints (accessible by Free / Premium students)
router.post('/join', joinClass);
router.get('/my', getMyClasses);

// Teacher class management endpoints
router.post('/', requireCustomPlan, createClass);
router.get('/', isTeacherOrAdmin, getClasses);

// Single class operations (Authorization checked inside controller)
router.get('/:id', getClassById);
router.put('/:id', updateClass);
router.delete('/:id', deleteClass);

// Student roster operations
router.get('/:id/students', getClassStudents);
router.delete('/:id/students/:studentId', removeStudentFromClass);

export default router;
