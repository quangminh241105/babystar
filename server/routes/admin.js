const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { requireAdmin } = require('../middleware/auth');

// Render main admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  res.render('pages/admin-main', { title: 'Admin Dashboard' });
});

// Render the admin user management page
router.get('/users', requireAdmin, async (req, res) => {
  res.render('pages/admin-users', { title: 'Admin: Manage Users' });
});

// API: List all users (for frontend JS)
router.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // Load all users except deleted, sorted by name
    const users = await User.find({ deletedAt: null })
      .select('fullName email role isActive')
      .sort({ fullName: 1, email: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// API: Activate user
router.put('/users/:id/activate', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('fullName email role isActive');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to activate user' });
  }
});

// API: Deactivate user
router.put('/users/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('fullName email role isActive');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate user' });
  }
});


module.exports = router;
