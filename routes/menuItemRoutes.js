const express = require('express');
const {
  getMenuItems,
  getMenuItemAvailability,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuItemController');

const router = express.Router();

router.get('/', getMenuItems);
router.get('/:id/availability', getMenuItemAvailability);
router.get('/:id', getMenuItemById);
router.post('/', createMenuItem);
router.put('/:id', updateMenuItem);
router.delete('/:id', deleteMenuItem);

module.exports = router;
