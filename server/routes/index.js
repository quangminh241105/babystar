const express = require('express');
const router = express.Router();
const { requireAuthRedirect } = require('../middleware');

// Homepage or Welcome page based on authentication
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
      res.render('pages/home', { title: 'Home' });
      return;
  }
  else {
      res.render('pages/index', { title: 'Welcome' });
      return;
  }
});

router.get('/weekly-report', requireAuthRedirect, (req, res) => {
  res.render('pages/weekly-report', { title: 'Weekly Report' });
});

router.get('/link-account', requireAuthRedirect, (req, res) => {
  res.render('pages/linkaccount', { title: 'Link Account' });
});

router.get('/diet-plan', requireAuthRedirect, (req, res) => {
  res.render('pages/dietplanner', { title: 'Diet Planner' });
});

router.get('/exercise-plan', requireAuthRedirect, (req, res) => {
  res.render('pages/exerciseplanner', { title: 'Exercise Planner' });
});

router.get('/share-records', requireAuthRedirect, (req, res) => {
  res.render('pages/sharerecords', { title: 'Share Records' });
});

router.get('/reminder', requireAuthRedirect, (req, res) => {
  res.render('pages/reminder', { title: 'Reminder' });
});

router.get('/past-health-records', requireAuthRedirect, (req, res) => {
  res.render('pages/pasthealthrecords', { title: 'Past Health Records' });
});

router.get('/learning-quizzes', requireAuthRedirect, (req, res) => {
  res.render('pages/learningquizzes', { title: 'Learning Quizzes' });
});

router.get('/nearby-healthcare', requireAuthRedirect, (req, res) => {
  res.render('pages/nearbyhealthcare', { title: 'Nearby Healthcare' });
});

module.exports = router;
