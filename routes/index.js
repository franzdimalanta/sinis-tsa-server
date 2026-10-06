const express = require('express');
const categoryRoutes = require('./categoryRoutes');
const menuItemRoutes = require('./menuItemRoutes');
const ingredientRoutes = require('./ingredientRoutes');
const recipeRoutes = require('./recipeRoutes');
const orderRoutes = require('./orderRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'BrewLogic API' });
});

router.use('/categories', categoryRoutes);
router.use('/menu-items', menuItemRoutes);
router.use('/ingredients', ingredientRoutes);
router.use('/recipes', recipeRoutes);
router.use('/orders', orderRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
