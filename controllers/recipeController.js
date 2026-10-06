const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');

const allowedFields = ["menuItem","size","ingredients"];

// Only accept editable schema fields, never IDs, timestamps, or query operators.
function getInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const data = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }
  return data;
}

async function validateReferences(data) {
  if (!mongoose.isValidObjectId(data.menuItem)) {
    return 'A valid menu item ObjectId is required';
  }
  const menuItem = await MenuItem.findById(data.menuItem);
  if (!menuItem) {
    return 'Referenced menu item does not exist';
  }
  if (!menuItem.sizes.some((entry) => entry.size === data.size)) {
    return 'Recipe size must exist in the menu item sizes';
  }
  if (Array.isArray(data.ingredients)) {
    for (const entry of data.ingredients) {
      if (!mongoose.isValidObjectId(entry?.ingredient)) {
        return 'Each recipe ingredient must have a valid ObjectId';
      }
      if (!(await Ingredient.exists({ _id: entry.ingredient }))) {
        return 'Referenced ingredient does not exist';
      }
    }
  }
  return null;
}

async function getRecipes(req, res, next) {
  try {
    const records = await Recipe.find().populate('menuItem').populate('ingredients.ingredient');
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}

async function getRecipeById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid recipe ID' });
  }
  try {
    const record = await Recipe.findById(req.params.id).populate('menuItem').populate('ingredients.ingredient');
    if (!record) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function createRecipe(req, res, next) {
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = new Recipe(data);
    const referenceError = await validateReferences(record);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

async function updateRecipe(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid recipe ID' });
  }
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = await Recipe.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    record.set(data);
    const referenceError = await validateReferences(record);
    if (referenceError) {
      return res.status(400).json({ message: referenceError });
    }
    // Saving the document runs the complete schema validation.
    await record.save();
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function deleteRecipe(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid recipe ID' });
  }
  try {
    const record = await Recipe.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    await record.deleteOne();
    res.status(200).json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};

