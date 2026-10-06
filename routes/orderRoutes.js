const express = require('express');
const { getOrders, previewOrder, createOrder, getOrderById,
  updateOrderStatus } = require('../controllers/orderController');

const router = express.Router();

router.get('/', getOrders);
router.post('/preview', previewOrder);
router.post('/', createOrder);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
