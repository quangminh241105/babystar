const express = require('express');
const router = express.Router();

// Placeholder route(s) for admin area
router.get('/', (req, res) => {
  res.send('Admin area');
});

module.exports = router;
