const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true,
    enum: ['small', 'medium', 'large'],
  },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 2,
    maxlength: 100,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  sizes: {
    type: [sizeSchema],
    required: true,
    validate: {
      validator: (sizes) => {
        if (!Array.isArray(sizes) || sizes.length === 0) {
          return false;
        }

        const sizeNames = sizes.map((entry) => entry?.size);
        return new Set(sizeNames).size === sizeNames.length;
      },
      message: 'A menu item must have at least one size, with no duplicate sizes.',
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

sizeSchema.path('price').validate(Number.isFinite, 'Price must be a finite number.');

module.exports = mongoose.model('MenuItem', menuItemSchema);
