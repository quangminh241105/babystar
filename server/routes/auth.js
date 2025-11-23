const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('pages/auth/login', { title: 'Login' });
});

router.get('/register', (req, res) => {
  res.render('pages/auth/register', { title: 'Register' });
});

module.exports = router;
