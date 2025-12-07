const express = require('express');
const router = express.Router();
const { requireAuthRedirect } = require('../middleware');

// Main quiz page - displays all quiz categories
router.get('/', requireAuthRedirect, (req, res) => {
  res.render('pages/quiz', { title: 'Learning Quizzes' });
});

// Nutrition quiz
router.get('/nutrition', requireAuthRedirect, (req, res) => {
  res.render('pages/question', { 
    title: 'Nutrition Quiz',
    quizType: 'nutrition'
  });
});

// Baby Development quiz
router.get('/development', requireAuthRedirect, (req, res) => {
  res.render('pages/question', { 
    title: 'Baby Development Quiz',
    quizType: 'development'
  });
});

// Exercise quiz
router.get('/exercise', requireAuthRedirect, (req, res) => {
  res.render('pages/question', { 
    title: 'Exercise Quiz',
    quizType: 'exercise'
  });
});

module.exports = router;
