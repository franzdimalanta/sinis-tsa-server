const express = require('express');
const categoryRoutes = require('./categoryRoutes');
const menuItemRoutes = require('./menuItemRoutes');
const ingredientRoutes = require('./ingredientRoutes');
const recipeRoutes = require('./recipeRoutes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'BrewLogic API' });
});

router.use('/categories', categoryRoutes);
router.use('/menu-items', menuItemRoutes);
router.use('/ingredients', ingredientRoutes);
router.use('/recipes', recipeRoutes);

module.exports = router;
