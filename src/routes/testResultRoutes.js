import express from 'express';
import {
  submitTestResult,
  getUserTestHistory,
  getAllTestResults,
} from '../controllers/testResultController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// User submit test & view own history
router.post('/', submitTestResult);
router.get('/my-results', getUserTestHistory);

// Admin view all test results
router.get('/', isAdmin, getAllTestResults);

export default router;
