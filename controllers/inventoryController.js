const inventoryService = require('../services/inventoryService');

async function getLowStock(req, res, next) {
  try {
    res.status(200).json(await inventoryService.getLowStock());
  } catch (error) {
    next(error);
  }
}

async function getTransactions(req, res, next) {
  try {
    res.status(200).json(await inventoryService.getTransactions(req.query));
  } catch (error) {
    next(error);
  }
}

async function stockIn(req, res, next) {
  try {
    res.status(201).json(await inventoryService.stockIn(req.body));
  } catch (error) {
    next(error);
  }
}

module.exports = { getLowStock, getTransactions, stockIn };
