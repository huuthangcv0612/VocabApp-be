import express from 'express';
import {
  createOrder,
  getOrderById,
  getUserOrders,
  cancelOrder,
  getAllOrdersAdmin,
} from '../controllers/orderController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/admin/all', isAdmin, getAllOrdersAdmin);
router.get('/:id', getOrderById);
router.post('/:id/cancel', cancelOrder);

export default router;
