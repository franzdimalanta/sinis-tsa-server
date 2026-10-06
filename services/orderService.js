const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const Order = require('../models/Order');
const InventoryTransaction = require('../models/InventoryTransaction');
const { roundMoney, calculateLineTotal, calculateTotals } = require('../utils/orderPricing');

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const statusTransitions = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

// Recipes determine requirements only for preview and order creation.
async function aggregateRequirements(items, session = null) {
  const requirements = new Map();
  for (const item of items) {
    const recipe = await Recipe.findOne({ menuItem: item.menuItem, size: item.size }).session(session);
    if (!recipe) {
      throw serviceError(`No recipe exists for menu item ${item.menuItem}, size ${item.size}`);
    }
    for (const entry of recipe.ingredients) {
      const key = entry.ingredient.toString();
      const quantity = entry.quantity * item.quantity;
      const total = (requirements.get(key) || 0) + quantity;
      if (!Number.isFinite(total) || total <= 0) {
        throw serviceError('Invalid ingredient requirement');
      }
      requirements.set(key, total);
    }
  }

  const result = [];
  for (const [id, quantity] of requirements) {
    const ingredient = await Ingredient.findById(id).session(session);
    if (!ingredient) {
      throw serviceError(`Referenced ingredient ${id} does not exist`);
    }
    result.push({ ingredient: ingredient._id, name: ingredient.name, unit: ingredient.unit,
      quantity, stockQuantity: ingredient.stockQuantity });
  }
  return result;
}

async function prepareOrder(body, session = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw serviceError('Request body must be a JSON object');
  }
  if (typeof body.customerName !== 'string') {
    throw serviceError('Customer name is required');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw serviceError('An order must have at least one item');
  }
  const items = [];
  for (const requested of body.items) {
    if (!requested || typeof requested.menuItem !== 'string' || !mongoose.isValidObjectId(requested.menuItem)) {
      throw serviceError('Each order item must have a valid menu item ObjectId');
    }
    if (!Number.isSafeInteger(requested.quantity) || requested.quantity < 1) {
      throw serviceError('Order item quantity must be a positive integer');
    }
    const menuItem = await MenuItem.findById(requested.menuItem).session(session);
    if (!menuItem) throw serviceError('Referenced menu item does not exist');
    if (!menuItem.isActive) throw serviceError(`${menuItem.name} is not active`);
    const size = menuItem.sizes.find((entry) => entry.size === requested.size);
    if (!size) throw serviceError(`Requested size is not available for ${menuItem.name}`);
    const unitPrice = roundMoney(size.price);
    items.push({ menuItem: menuItem._id, name: menuItem.name, size: size.size,
      quantity: requested.quantity, unitPrice,
      lineTotal: calculateLineTotal(unitPrice, requested.quantity) });
  }

  // Explicitly select fields so client prices, totals, and status are never trusted.
  const order = new Order({ customerName: body.customerName,
    orderType: body.orderType === undefined ? 'takeout' : body.orderType,
    notes: body.notes === undefined ? '' : body.notes,
    items, ...calculateTotals(items), status: 'pending' });
  await order.validate();
  const ingredientRequirements = await aggregateRequirements(items, session);
  for (const requirement of ingredientRequirements) {
    if (requirement.stockQuantity < requirement.quantity) {
      throw serviceError(`Insufficient stock for ${requirement.name}`);
    }
  }
  return { order, ingredientRequirements };
}

async function changeStock(requirements, orderId, restoring, session) {
  for (const requirement of requirements) {
    const filter = { _id: requirement.ingredient };
    if (!restoring) filter.stockQuantity = { $gte: requirement.quantity };
    const result = await Ingredient.updateOne(filter, {
      $inc: { stockQuantity: restoring ? requirement.quantity : -requirement.quantity },
    }, { session });
    if (result.matchedCount !== 1) {
      throw serviceError(restoring ? `Ingredient ${requirement.name} no longer exists`
        : `Insufficient stock for ${requirement.name}`);
    }
  }
  if (requirements.length > 0) {
    await InventoryTransaction.create(
  requirements.map((requirement) => ({
    ingredient: requirement.ingredient,
    type: restoring ? 'stock-in' : 'stock-out',
    quantity: requirement.quantity,
    reason: restoring
      ? 'Order cancellation restock'
      : 'Order stock deduction',
    order: orderId,
  })),
  {
    session,
    ordered: true,
  }
);
  }
}

async function createOrder(body) {
  const session = await mongoose.startSession();
  try {
    let created;
    await session.withTransaction(async () => {
      const { order, ingredientRequirements } = await prepareOrder(body, session);
      await order.save({ session });
      await changeStock(ingredientRequirements, order._id, false, session);
      created = order;
    });
    return created;
  } finally {
    await session.endSession();
  }
}

async function updateOrderStatus(id, status) {
  if (!Object.prototype.hasOwnProperty.call(statusTransitions, status)) {
    throw serviceError('Invalid order status');
  }
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      if (!order) throw serviceError('Order not found', 404);
      if (!statusTransitions[order.status]?.includes(status)) {
        throw serviceError(`Cannot change order status from ${order.status} to ${status}`);
      }
      // Claim the transition before restocking; concurrent updates conflict and retry.
      updated = await Order.findOneAndUpdate({ _id: id, status: order.status },
        { $set: { status } }, { new: true, runValidators: true, session });
      if (!updated) throw serviceError('Order status has changed; refresh and try again');
      if (status === 'cancelled') {
        const deductions = await InventoryTransaction.find({
          type: 'stock-out',
          reason: 'Order stock deduction',
          order: order._id,
        }).session(session);
        if (deductions.length === 0) {
          throw serviceError('Cannot cancel order because original stock deduction transactions are missing');
        }

        const requirements = [];
        for (const deduction of deductions) {
          if (!Number.isFinite(deduction.quantity) || deduction.quantity <= 0) {
            throw serviceError('Cannot cancel order because an original stock deduction quantity is invalid');
          }
          const ingredient = await Ingredient.findById(deduction.ingredient).session(session);
          if (!ingredient) {
            throw serviceError(`Cannot cancel order because ingredient ${deduction.ingredient} no longer exists`);
          }
          requirements.push({ ingredient: ingredient._id, name: ingredient.name,
            quantity: deduction.quantity });
        }
        await changeStock(requirements, order._id, true, session);
      }
    });
    return updated;
  } finally {
    await session.endSession();
  }
}

module.exports = { prepareOrder, createOrder, updateOrderStatus, statusTransitions };
