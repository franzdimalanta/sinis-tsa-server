function roundMoney(amount) {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(rounded) || rounded < 0) {
    const error = new Error('Order amount is invalid or too large');
    error.statusCode = 400;
    throw error;
  }
  return rounded;
}

function calculateLineTotal(unitPrice, quantity) {
  return roundMoney(unitPrice * quantity);
}

function calculateTotals(items) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const discountAmount = subtotal >= 1000 ? roundMoney(subtotal * 0.1) : 0;
  return { subtotal, discountAmount, total: roundMoney(subtotal - discountAmount) };
}

module.exports = { roundMoney, calculateLineTotal, calculateTotals };
