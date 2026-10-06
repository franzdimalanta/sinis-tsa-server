const express = require('express');
const { getSummary, getBestSellers, getSales, getOrderStatus } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/summary', getSummary);
router.get('/best-sellers', getBestSellers);
router.get('/sales', getSales);
router.get('/order-status', getOrderStatus);

module.exports = router;
