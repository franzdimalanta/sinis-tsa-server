const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    validate: {
      validator: (quantity) => quantity > 0,
      message: 'Ingredient quantity must be greater than 0.',
    },
  },
}, { _id: false });

const recipeSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  size: {
    type: String,
    required: true,
    enum: ['small', 'medium', 'large'],
  },
  ingredients: {
    type: [recipeIngredientSchema],
    required: true,
    validate: {
      validator: (ingredients) => {
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
          return false;
        }

        // Compare ObjectIds by their string values, not object identity.
        const ingredientIds = ingredients.map((entry) => entry?.ingredient?.toString());
        return new Set(ingredientIds).size === ingredientIds.length;
      },
      message: 'A recipe must have at least one ingredient, with no duplicate ingredients.',
    },
  },
}, { timestamps: true });

recipeSchema.index({ menuItem: 1, size: 1 }, { unique: true });

module.exports = mongoose.model('Recipe', recipeSchema);
