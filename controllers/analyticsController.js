const analyticsService = require('../services/analyticsService');

async function getSummary(req, res, next) {
  try {
    res.status(200).json(await analyticsService.getSummary());
  } catch (error) {
    next(error);
  }
}

async function getBestSellers(req, res, next) {
  try {
    res.status(200).json(await analyticsService.getBestSellers(req.query));
  } catch (error) {
    next(error);
  }
}

async function getSales(req, res, next) {
  try {
    res.status(200).json(await analyticsService.getSales(req.query));
  } catch (error) {
    next(error);
  }
}

async function getOrderStatus(req, res, next) {
  try {
    res.status(200).json(await analyticsService.getOrderStatus());
  } catch (error) {
    next(error);
  }
}

module.exports = { getSummary, getBestSellers, getSales, getOrderStatus };
