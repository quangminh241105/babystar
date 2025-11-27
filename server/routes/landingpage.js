const express = require('express');
const router = express.Router();

// GET /landingpage - Public landing page
router.get('/', (req, res) => {
  // If user is already logged in, redirect to dashboard
  if (req.session && req.session.user) {
    return res.redirect('/'); // redirect to dashboard
  }
  // Use 'Home' as title to match breadcrumb exclusion
  res.render('pages/index', { title: 'Home' });
});

module.exports = router;
