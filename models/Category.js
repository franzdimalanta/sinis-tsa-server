const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 2,
    maxlength: 50,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
    default: '',
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
