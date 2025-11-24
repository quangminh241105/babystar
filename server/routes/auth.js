const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');

router.get('/login', (req, res) => {
  res.render('pages/auth/login', { title: 'Login' });
});

router.get('/register', (req, res) => {
  res.render('pages/auth/register', { title: 'Register' });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullname, email, password, password2, user } = req.body || {};
    const errors = {};

    if (!fullname || !fullname.trim()) errors.fullname = 'Full name is required';
    if (!email || !email.trim()) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    if (!password2) errors.password2 = 'Please confirm password';
    if (password && password2 && password !== password2) errors.password2 = 'Passwords do not match';

    if (Object.keys(errors).length) return res.status(400).json({ success: false, errors });

    // ensure unique email
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ success: false, errors: { email: 'Email already in use' }});

    const passwordHash = await bcrypt.hash(password, 10);
    const role = (user === 'Other') ? 'partner' : 'user'; // map radio selection to schema role
    const newUser = new User({
      name: fullname.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role
    });

    await newUser.save();

    // store minimal user in session to avoid extra DB fetches
    req.session.user = { id: newUser._id, name: newUser.name, email: newUser.email };

    return res.json({ success: true });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, errors: { general: 'Email and password required' }});

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' }});

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' }});

    // save minimal user info in session (small payload, reduces DB hits)
    req.session.user = { id: user._id, name: user.name, email: user.email };

    // NOTE: no token/session library used beyond express-session
    return res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      // ignore errors; redirect to home
      return res.redirect('/');
    });
  } else {
    return res.redirect('/');
  }
});

module.exports = router;
