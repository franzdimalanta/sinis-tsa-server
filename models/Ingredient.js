const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 2,
    maxlength: 100,
  },
  unit: {
    type: String,
    required: true,
    enum: ['g', 'ml', 'pcs'],
  },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  reorderLevel: { type: Number, required: true, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

for (const field of ['stockQuantity', 'reorderLevel']) {
  ingredientSchema.path(field).validate(Number.isFinite, `${field} must be a finite number.`);
}

module.exports = mongoose.model('Ingredient', ingredientSchema);
