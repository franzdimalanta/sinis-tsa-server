const express = require('express');
const { getLowStock, getTransactions, stockIn } = require('../controllers/inventoryController');

const router = express.Router();

router.get('/low-stock', getLowStock);
router.get('/transactions', getTransactions);
router.post('/stock-in', stockIn);

module.exports = router;
