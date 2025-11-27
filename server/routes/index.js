const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/home', { title: 'Home' });
});

router.get('/chatbot', (req, res) => {
  res.render('pages/chatbot', { title: 'Chatbot' });
});

router.get('/weekly-report', (req, res) => {
  res.render('pages/weekly-report', { title: 'Weekly Report' });
});

router.get('/link-account', (req, res) => {
  res.render('pages/linkaccount', { title: 'Link Account' });
});

router.get('/diet-plan', (req, res) => {
  res.render('pages/dietplanner', { title: 'Diet Planner' });
});

router.get('/exercise-plan', (req, res) => {
  res.render('pages/exerciseplanner', { title: 'Diet Planner' });
});

module.exports = router;
