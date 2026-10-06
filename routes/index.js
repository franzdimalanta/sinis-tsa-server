const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'BrewLogic API' });
});

module.exports = router;
