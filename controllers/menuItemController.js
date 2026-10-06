const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Recipe = require('../models/Recipe');

const allowedFields = ["name","description","category","sizes","isActive"];

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
  if (!mongoose.isValidObjectId(data.category)) {
    return 'A valid category ObjectId is required';
  }
  if (!(await Category.exists({ _id: data.category }))) {
    return 'Referenced category does not exist';
  }
  return null;
}

async function getMenuItems(req, res, next) {
  try {
    const records = await MenuItem.find().sort({ name: 1 }).populate('category');
    res.status(200).json(records);
  } catch (error) {
    next(error);
  }
}

async function getMenuItemById(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid menu item ID' });
  }
  try {
    const record = await MenuItem.findById(req.params.id).populate('category');
    if (!record) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.status(200).json(record);
  } catch (error) {
    next(error);
  }
}

async function createMenuItem(req, res, next) {
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = new MenuItem(data);
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

async function updateMenuItem(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid menu item ID' });
  }
  const data = getInput(req.body);
  if (!data) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  try {
    const record = await MenuItem.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    if (Object.prototype.hasOwnProperty.call(data, 'sizes')) {
      const requestedSizes = Array.isArray(data.sizes)
        ? data.sizes.map((entry) => entry?.size)
        : [];
      const removedSizes = record.sizes
        .map((entry) => entry.size)
        .filter((size) => !requestedSizes.includes(size));

      if (removedSizes.length > 0 && await Recipe.exists({
        menuItem: req.params.id,
        size: { $in: removedSizes },
      })) {
        return res.status(400).json({
          message: 'Cannot remove a menu item size that is used by a recipe',
        });
      }
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

async function deleteMenuItem(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid menu item ID' });
  }
  try {
    const record = await MenuItem.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    if (await Recipe.exists({ menuItem: req.params.id })) {
      return res.status(400).json({ message: 'Cannot delete menu item because it is used by recipes' });
    }
    await record.deleteOne();
    res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
