const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const InventoryTransaction = require('../models/InventoryTransaction');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');

function inventoryError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getLowStock() {
  const ingredients = await Ingredient.find({
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$reorderLevel'] },
  }).sort({ name: 1 }).lean();
  return ingredients.map((ingredient) => ({ ...ingredient,
    shortage: Math.max(ingredient.reorderLevel - ingredient.stockQuantity, 0) }));
}

async function getTransactions(query) {
  const filter = {};
  if (query.type !== undefined) {
    const types = InventoryTransaction.schema.path('type').enumValues;
    if (typeof query.type !== 'string' || !types.includes(query.type)) {
      throw inventoryError('Invalid inventory transaction type');
    }
    filter.type = query.type;
  }
  if (query.ingredient !== undefined) {
    if (typeof query.ingredient !== 'string' || !mongoose.isValidObjectId(query.ingredient)) {
      throw inventoryError('Invalid ingredient ObjectId filter');
    }
    filter.ingredient = query.ingredient;
  }
  return InventoryTransaction.find(filter).sort({ createdAt: -1 })
    .populate('ingredient').populate('order');
}

async function stockIn(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw inventoryError('Request body must be a JSON object');
  }
  if (typeof body.ingredient !== 'string' || !mongoose.isValidObjectId(body.ingredient)) {
    throw inventoryError('A valid ingredient ObjectId is required');
  }
  if (typeof body.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity <= 0) {
    throw inventoryError('Quantity must be a finite number greater than 0');
  }
  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    throw inventoryError('Reason must be a non-empty string');
  }
  const reason = body.reason.trim();
  if (reason.length > 300) throw inventoryError('Reason must not exceed 300 characters');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const ingredient = await Ingredient.findById(body.ingredient).session(session);
      if (!ingredient) throw inventoryError('Ingredient not found', 404);
      if (!ingredient.isActive) throw inventoryError('Cannot add stock to an inactive ingredient');
      if (!Number.isFinite(ingredient.stockQuantity + body.quantity)) {
        throw inventoryError('Resulting stock quantity is too large');
      }
      const updatedIngredient = await Ingredient.findOneAndUpdate(
        { _id: ingredient._id, isActive: true },
        { $inc: { stockQuantity: body.quantity } },
        { new: true, runValidators: true, session });
      if (!updatedIngredient) throw inventoryError('Ingredient is no longer active or does not exist');
        const [transaction] = await InventoryTransaction.create([{
          ingredient: ingredient._id,
          type: 'stock-in',
          quantity: body.quantity,
          reason,
          order: null,
        }], {
          session,
          ordered: true,
        });
      result = { ingredient: updatedIngredient, transaction };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function getSizeAvailability(menuItemId, size) {
  const recipe = await Recipe.findOne({ menuItem: menuItemId, size });
  if (!recipe) return { available: false, maxServings: 0, reason: 'No recipe configured' };
  if (recipe.ingredients.length === 0) {
    return { available: false, maxServings: 0, reason: 'Recipe has no ingredients configured' };
  }
  let maxServings = Infinity;
  for (const entry of recipe.ingredients) {
    const ingredient = await Ingredient.findById(entry.ingredient);
    if (!ingredient) {
      return { available: false, maxServings: 0,
        reason: `Referenced ingredient ${entry.ingredient} does not exist` };
    }
    if (!ingredient.isActive) {
      return { available: false, maxServings: 0, reason: `Ingredient ${ingredient.name} is inactive` };
    }
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0 ||
        !Number.isFinite(ingredient.stockQuantity) || ingredient.stockQuantity < 0) {
      return { available: false, maxServings: 0, reason: `Invalid recipe or stock quantity for ${ingredient.name}` };
    }
    const servings = Math.floor(ingredient.stockQuantity / entry.quantity);
    if (!Number.isFinite(servings)) {
      return { available: false, maxServings: 0, reason: `Invalid serving quantity for ${ingredient.name}` };
    }
    maxServings = Math.min(maxServings, servings);
  }
  return maxServings > 0 ? { available: true, maxServings }
    : { available: false, maxServings: 0, reason: 'Insufficient ingredient stock' };
}

async function getMenuItemAvailability(id) {
  if (!mongoose.isValidObjectId(id)) throw inventoryError('Invalid menu item ID');
  const menuItem = await MenuItem.findById(id);
  if (!menuItem) throw inventoryError('Menu item not found', 404);
  const sizes = [];
  for (const entry of menuItem.sizes) {
    const availability = menuItem.isActive
      ? await getSizeAvailability(menuItem._id, entry.size)
      : { available: false, maxServings: 0, reason: 'Menu item is inactive' };
    sizes.push({ size: entry.size, price: entry.price, ...availability });
  }
  return { menuItem: { _id: menuItem._id, name: menuItem.name, isActive: menuItem.isActive }, sizes };
}

module.exports = { getLowStock, getTransactions, stockIn, getMenuItemAvailability };
