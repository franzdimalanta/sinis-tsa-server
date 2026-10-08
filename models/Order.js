const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true,
  },
  // Preserve the menu item name as it was when the order was placed.
  name: { type: String, required: true, trim: true, maxlength: 100 },
  size: {
    type: String,
    required: true,
    enum: ['small', 'medium', 'large'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Order item quantity must be an integer.',
    },
  },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  orderType: {
    type: String,
    required: true,
    enum: ['dine-in', 'takeout'],
    default: 'takeout',
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0,
      message: 'An order must have at least one item.',
    },
  },
  subtotal: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
  },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

for (const field of ['quantity', 'unitPrice', 'lineTotal']) {
  orderItemSchema.path(field).validate(Number.isFinite, `${field} must be a finite number.`);
}
for (const field of ['subtotal', 'discountAmount', 'total']) {
  orderSchema.path(field).validate(Number.isFinite, `${field} must be a finite number.`);
}

module.exports = mongoose.model('Order', orderSchema);
