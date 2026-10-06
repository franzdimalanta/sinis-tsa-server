const mongoose = require('mongoose');
const Order = require('../models/Order');
const orderService = require('../services/orderService');

async function previewOrder(req, res, next) {
  try {
    const { order, ingredientRequirements } = await orderService.prepareOrder(req.body);
    res.status(200).json({ ...order.toObject(), ingredientRequirements, stockAvailable: true });
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

async function getOrders(req, res, next) {
  const filter = {};
  if (req.query.status !== undefined) {
    if (typeof req.query.status !== 'string' ||
        !Object.prototype.hasOwnProperty.call(orderService.statusTransitions, req.query.status)) {
      return res.status(400).json({ message: 'Invalid order status filter' });
    }
    filter.status = req.query.status;
  }
  try {
    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate('items.menuItem');
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID' });
  }
  try {
    const order = await Order.findById(req.params.id).populate('items.menuItem');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid order ID' });
  }
  const status = req.body?.status;
  if (typeof status !== 'string') {
    return res.status(400).json({ message: 'Order status is required' });
  }
  try {
    const order = await orderService.updateOrderStatus(req.params.id, status);
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
}

module.exports = { previewOrder, createOrder, getOrders, getOrderById, updateOrderStatus };
