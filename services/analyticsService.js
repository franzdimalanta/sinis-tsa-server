const Order = require('../models/Order');

const reportingTimezone = 'Asia/Manila';

function queryError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Sum item quantities within each order so order-level revenue is counted once.
function summaryGroup() {
  return {
    $group: {
      _id: null,
      totalRevenue: { $sum: '$total' },
      totalOrders: { $sum: 1 },
      totalItemsSold: { $sum: { $sum: '$items.quantity' } },
      totalDiscounts: { $sum: '$discountAmount' },
    },
  };
}

function formatSummary(result = {}) {
  const revenue = result.totalRevenue || 0;
  const orders = result.totalOrders || 0;
  return {
    totalRevenue: roundMoney(revenue),
    totalOrders: orders,
    totalItemsSold: result.totalItemsSold || 0,
    averageOrderValue: orders ? roundMoney(revenue / orders) : 0,
    totalDiscounts: roundMoney(result.totalDiscounts || 0),
  };
}

async function getSummary() {
  const [result] = await Order.aggregate([
    { $match: { status: 'completed' } },
    summaryGroup(),
  ]);
  return formatSummary(result);
}

function parseLimit(value) {
  if (value === undefined) return 5;
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw queryError('Limit must be a positive integer between 1 and 100');
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw queryError('Limit must be a positive integer between 1 and 100');
  }
  return limit;
}

async function getBestSellers(query = {}) {
  const limit = parseLimit(query.limit);
  const results = await Order.aggregate([
    { $match: { status: 'completed' } },
    // Use the most recent historical name if a menu item has been renamed.
    { $sort: { createdAt: -1, _id: -1 } },
    { $unwind: '$items' },
    { $group: {
      _id: '$items.menuItem',
      name: { $first: '$items.name' },
      quantitySold: { $sum: '$items.quantity' },
      revenue: { $sum: '$items.lineTotal' },
    } },
    { $sort: { quantitySold: -1, revenue: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return results.map((result) => ({ menuItem: result._id, name: result.name,
    quantitySold: result.quantitySold, revenue: roundMoney(result.revenue) }));
}

function parseDate(value, field) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw queryError(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  // Compare the normalized date to reject impossible dates such as February 30.
  const calendarDate = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value) {
    throw queryError(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return new Date(`${value}T00:00:00.000+08:00`);
}

async function getSales(query = {}) {
  const start = parseDate(query.start, 'start');
  const end = parseDate(query.end, 'end');
  if (start && end && start > end) throw queryError('Start date must not be after end date');
  const match = { status: 'completed' };
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = start;
    // An exclusive next-day boundary includes every instant of the end date.
    if (end) match.createdAt.$lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  const [result] = await Order.aggregate([
    { $match: match },
    { $facet: {
      summary: [summaryGroup()],
      dailySales: [
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: reportingTimezone } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          itemsSold: { $sum: { $sum: '$items.quantity' } },
        } },
        { $sort: { _id: 1 } },
      ],
    } },
  ]);
  const { totalDiscounts, ...summary } = formatSummary(result?.summary?.[0]);
  return {
    start: query.start ?? null,
    end: query.end ?? null,
    ...summary,
    dailySales: (result?.dailySales || []).map((day) => ({ date: day._id,
      revenue: roundMoney(day.revenue), orders: day.orders, itemsSold: day.itemsSold })),
  };
}

async function getOrderStatus() {
  const breakdown = Object.fromEntries(Order.schema.path('status').enumValues.map((status) => [status, 0]));
  const results = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  for (const result of results) {
    if (Object.prototype.hasOwnProperty.call(breakdown, result._id)) {
      breakdown[result._id] = result.count;
    }
  }
  return breakdown;
}

module.exports = { getSummary, getBestSellers, getSales, getOrderStatus };
