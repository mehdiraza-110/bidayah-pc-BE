const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/order.controller');
const { upload } = require('../../config/multer.config');
const AuthGuard = require('../../middlewares/jwt.middleware');

// Public checkout endpoints (no authentication required)
// Create order with bank transfer payment
router.post(
  '/bank-transfer',
  upload.single('payment_screenshot'),
  orderController.createBankTransferOrder.bind(orderController)
);

// Create order with agent payment
router.post(
  '/agent',
  orderController.createAgentOrder.bind(orderController)
);

// Admin endpoints (authentication required)
// Get all orders (with optional filters)
router.get('/', orderController.getAllOrders.bind(orderController));

// Get order by ID
router.get('/:id', orderController.getOrderById.bind(orderController));

// Update order status
router.patch('/:id/status', orderController.updateOrderStatus.bind(orderController));
router.put('/:id/status', orderController.updateOrderStatus.bind(orderController));

module.exports = router;
