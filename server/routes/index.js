const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/home', { title: 'Home' });
});

router.get('/chatbot', (req, res) => {
  res.render('pages/chatbot', { title: 'Chatbot' });
});

module.exports = router;
