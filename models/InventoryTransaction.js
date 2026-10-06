const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['stock-in', 'stock-out', 'adjustment'],
  },
  quantity: {
    type: Number,
    required: true,
    validate: {
      validator: (quantity) => quantity > 0,
      message: 'Transaction quantity must be greater than 0.',
    },
  },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
