const mongoose = require('mongoose');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');

const allowedFields = ["name","unit","stockQuantity","reorderLevel","isActive"];

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

async function getIngredients(req, res, next) {
  try {
    const records = await Ingredient.find().sort({ name: 1 });
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}

async function getIngredientById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ingredient ID' });
  }
  try {
    const record = await Ingredient.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function createIngredient(req, res, next) {
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = new Ingredient(data);
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

async function updateIngredient(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ingredient ID' });
  }
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  if (Object.prototype.hasOwnProperty.call(data, 'stockQuantity')) {
    return res.status(400).json({
      message: 'Stock quantity must be changed through inventory operations',
    });
  }
  try {
    const record = await Ingredient.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    record.set(data);
    // Saving the document runs the complete schema validation.
    await record.save();
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function deleteIngredient(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid ingredient ID' });
  }
  try {
    const record = await Ingredient.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    if (await Recipe.exists({ 'ingredients.ingredient': req.params.id })) {
      return res.status(400).json({ message: 'Cannot delete ingredient because it is used by recipes' });
    }
    await record.deleteOne();
    res.status(200).json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
};
