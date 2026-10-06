const path = require('node:path');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const Order = require('../models/Order');
const InventoryTransaction = require('../models/InventoryTransaction');
const { calculateLineTotal, calculateTotals } = require('../utils/orderPricing');

const categoryData = [
  { name: 'Coffee', description: 'Espresso-based coffee drinks' },
  { name: 'Non-Coffee', description: 'Milk-based drinks without coffee' },
  { name: 'Tea', description: 'Refreshing tea drinks' },
  { name: 'Pastries', description: 'Fresh pastries to pair with drinks' },
];

// Opening stock is generous enough for the historical demo orders.
const ingredientData = [
  ['Coffee Beans', 'g', 5000, 1000],
  ['Fresh Milk', 'ml', 30000, 5000],
  ['Condensed Milk', 'ml', 5000, 1000],
  ['Vanilla Syrup', 'ml', 3000, 500],
  ['Caramel Syrup', 'ml', 3000, 500],
  ['Chocolate Syrup', 'ml', 5000, 1000],
  ['Matcha Powder', 'g', 1000, 200],
  ['Tea Concentrate', 'ml', 5000, 1000],
  ['Water', 'ml', 50000, 10000],
  ['Ice', 'g', 20000, 5000],
  ['Chocolate Croissant Stock', 'pcs', 24, 20],
].map(([name, unit, stockQuantity, reorderLevel]) => ({
  name, unit, stockQuantity, reorderLevel, isActive: true,
}));

// Medium-size recipes; small/large portions scale to 80%/120%.
const menuData = [
  { name: 'Spanish Latte', category: 'Coffee', prices: [130, 150, 170],
    ingredients: { 'Coffee Beans': 18, 'Fresh Milk': 180, 'Condensed Milk': 30, Ice: 100 } },
  { name: 'Cafe Latte', category: 'Coffee', prices: [110, 130, 150],
    ingredients: { 'Coffee Beans': 18, 'Fresh Milk': 220, Ice: 100 } },
  { name: 'Americano', category: 'Coffee', prices: [90, 110, 130],
    ingredients: { 'Coffee Beans': 18, Water: 250, Ice: 100 } },
  { name: 'Caramel Macchiato', category: 'Coffee', prices: [140, 160, 180],
    ingredients: { 'Coffee Beans': 18, 'Fresh Milk': 200, 'Vanilla Syrup': 15, 'Caramel Syrup': 20, Ice: 100 } },
  { name: 'Matcha Latte', category: 'Non-Coffee', prices: [130, 150, 170],
    ingredients: { 'Matcha Powder': 5, 'Fresh Milk': 240, 'Vanilla Syrup': 15, Ice: 100 } },
  { name: 'Chocolate Latte', category: 'Non-Coffee', prices: [120, 140, 160],
    ingredients: { 'Chocolate Syrup': 35, 'Fresh Milk': 220, Ice: 100 } },
  { name: 'Iced Tea', category: 'Tea', prices: [70, 90, 110],
    ingredients: { 'Tea Concentrate': 50, Water: 220, Ice: 120 } },
  { name: 'Chocolate Croissant', category: 'Pastries', prices: [95],
    ingredients: { 'Chocolate Croissant Stock': 1 } },
];

const orderStatuses = [
  'completed', 'completed', 'completed', 'completed',
  'completed', 'completed', 'completed', 'completed',
  'cancelled', 'pending', 'preparing', 'ready',
];

function historicalDate(daysAgo, hour = 10) {
  const localNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const date = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(),
    localNow.getUTCDate() - daysAgo, hour - 8));
  return date;
}

async function seedRecords(session) {
  // Delete dependent records first. The whole reset is rolled back on failure.
  for (const Model of [InventoryTransaction, Order, Recipe, MenuItem, Ingredient, Category]) {
    await Model.deleteMany({}, { session });
  }
  const categories = await Category.create(categoryData, { session, ordered: true });
  const ingredients = await Ingredient.create(ingredientData, { session, ordered: true });
  const categoryMap = new Map(categories.map((doc) => [doc.name, doc]));
  const ingredientMap = new Map(ingredients.map((doc) => [doc.name, doc]));
  const sizes = ['small', 'medium', 'large'];
  const menuItems = await MenuItem.create(menuData.map((item) => ({
    name: item.name,
    description: item.category === 'Pastries' ? 'Buttery croissant with chocolate filling'
      : `Freshly prepared iced ${item.name.toLowerCase()}`,
    category: categoryMap.get(item.category)._id,
    sizes: item.prices.map((price, index) => ({ size: sizes[index], price })),
    isActive: true,
  })), { session, ordered: true });

  const recipeData = [];
  for (let index = 0; index < menuItems.length; index++) {
    for (const entry of menuItems[index].sizes) {
      const scale = menuData[index].category === 'Pastries' ? 1
        : { small: 0.8, medium: 1, large: 1.2 }[entry.size];
      recipeData.push({ menuItem: menuItems[index]._id, size: entry.size,
        ingredients: Object.entries(menuData[index].ingredients).map(([name, quantity]) => ({
          ingredient: ingredientMap.get(name)._id,
          quantity: Math.round(quantity * scale * 100) / 100,
        })) });
    }
  }
  const recipes = await Recipe.create(recipeData, { session, ordered: true });
  const recipeMap = new Map(recipes.map((recipe) => [`${recipe.menuItem}:${recipe.size}`, recipe]));

  // Supplier receipts establish opening stock; final stock is computed below.
  const transactions = ingredients.map((ingredient) => ({
    ingredient: ingredient._id, type: 'stock-in', quantity: ingredient.stockQuantity,
    reason: 'Demo opening supplier delivery', order: null,
    createdAt: historicalDate(14), updatedAt: historicalDate(14),
  }));
  const balances = new Map(ingredients.map((ingredient) => [String(ingredient._id), ingredient.stockQuantity]));
  const orders = [];
  for (let index = 0; index < orderStatuses.length; index++) {
    const selected = [menuItems[index % menuItems.length], menuItems[(index + 3) % menuItems.length]];
    const items = selected.map((item, position) => {
      const size = item.sizes.find((entry) => entry.size === 'medium') || item.sizes[0];
      const quantity = index === 0 ? 5 : (index + position) % 3 + 1;
      return { menuItem: item._id, name: item.name, size: size.size, quantity,
        unitPrice: size.price, lineTotal: calculateLineTotal(size.price, quantity) };
    });
    const date = historicalDate(13 - index);
    const order = new Order({ customerName: `Walk-in Customer ${index + 1}`,
      orderType: index % 2 === 0 ? 'takeout' : 'dine-in', items,
      ...calculateTotals(items), status: orderStatuses[index], notes: 'Demonstration order',
      createdAt: date, updatedAt: date });
    await order.save({ session });
    orders.push(order);

    const requirements = new Map();
    for (const item of items) {
      const recipe = recipeMap.get(`${item.menuItem}:${item.size}`);
      for (const entry of recipe.ingredients) {
        const id = String(entry.ingredient);
        requirements.set(id, (requirements.get(id) || 0) + entry.quantity * item.quantity);
      }
    }
    for (const [id, quantity] of requirements) {
      transactions.push({ ingredient: id, type: 'stock-out', quantity,
        reason: 'Order stock deduction', order: order._id, createdAt: date, updatedAt: date });
      balances.set(id, balances.get(id) - quantity);
      if (order.status === 'cancelled') {
        transactions.push({ ingredient: id, type: 'stock-in', quantity,
          reason: 'Order cancellation restock', order: order._id, createdAt: date, updatedAt: date });
        balances.set(id, balances.get(id) + quantity);
      }
    }
  }
  for (const ingredient of ingredients) {
    const balance = balances.get(String(ingredient._id));
    if (balance < 0) throw new Error('Demo orders exceed opening stock');
    ingredient.stockQuantity = balance;
    await ingredient.save({ session });
  }
  await InventoryTransaction.create(transactions, { session, ordered: true });
  return { Categories: categories.length, 'Menu items': menuItems.length,
    Ingredients: ingredients.length, Recipes: recipes.length,
    Orders: orders.length, 'Inventory transactions': transactions.length };
}

async function main() {
  if (!process.argv.slice(2).includes('--reset')) {
    console.log('No data changed. Reset requires: npm run seed -- --reset');
    console.log('Warning: --reset replaces all records in the six BrewLogic collections.');
    return;
  }
  let session;
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from the server environment');
    // Same MONGO_URI configuration as config/db.js; handle failures here for cleanup.
    await mongoose.connect(process.env.MONGO_URI);
    // Build collection indexes before entering a transaction (including unique indexes).
    for (const Model of [Category, MenuItem, Ingredient, Recipe, Order, InventoryTransaction]) {
      await Model.init();
    }
    session = await mongoose.startSession();
    let summary;
    await session.withTransaction(async () => { summary = await seedRecords(session); });
    console.log('BrewLogic seed completed:');
    for (const [label, count] of Object.entries(summary)) console.log(`${label}: ${count}`);
  } catch (error) {
    // Avoid logging connection errors that may contain credentials or a connection URI.
    console.error(`BrewLogic seed failed (${error.name || 'Error'}). Reset was not committed. Check connectivity, transaction support, and model validation.`);
    process.exitCode = 1;
  } finally {
    try {
      if (session) await session.endSession();
    } finally {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('BrewLogic seed cleanup failed.');
    process.exitCode = 1;
  });
}

module.exports = { categoryData, ingredientData, menuData, orderStatuses };
