const mongoose = require('mongoose');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');

const allowedFields = ["name","description","isActive"];

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

async function getCategories(req, res, next) {
  try {
    const records = await Category.find().sort({ name: 1 });
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}

async function getCategoryById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid category ID' });
  }
  try {
    const record = await Category.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = new Category(data);
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid category ID' });
  }
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = await Category.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Category not found' });
    }
    record.set(data);
    // Saving the document runs the complete schema validation.
    await record.save();
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid category ID' });
  }
  try {
    const record = await Category.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (await MenuItem.exists({ category: req.params.id })) {
      return res.status(400).json({ message: 'Cannot delete category because it is used by menu items' });
    }
    await record.deleteOne();
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

