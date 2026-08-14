import express from 'express';
import {
  createTestConfig,
  getTests,
  getTestById,
  updateTestConfig,
  deleteTestConfig,
  generateUserTest,
} from '../controllers/testController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// User test generator endpoints
router.get('/quick-test', generateUserTest);
router.get('/:id/start', generateUserTest);

// List and detail endpoints
router.get('/', getTests);
router.get('/:id', getTestById);

// Admin-only test configuration endpoints
router.post('/', isAdmin, createTestConfig);
router.put('/:id', isAdmin, updateTestConfig);
router.delete('/:id', isAdmin, deleteTestConfig);

export default router;
