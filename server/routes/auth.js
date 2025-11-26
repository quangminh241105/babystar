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
    const { fullname, email, password, password2 } = req.body || {};
    
    const errors = {};

    // Validation
    if (!fullname || !fullname.trim()) {
      errors.fullname = 'Full name is required';
    } else if (fullname.trim().length < 2) {
      errors.fullname = 'Name must be at least 2 characters';
    }
    
    if (!email || !email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (!password2) {
      errors.password2 = 'Please confirm password';
    } else if (password !== password2) {
      errors.password2 = 'Passwords do not match';
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, errors });
    }

    // Check for existing user
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, errors: { email: 'Email already in use' } });
    }

    // Parse fullname into firstName and lastName
    const nameParts = fullname.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create new user with basic info (other details can be added later via profile)
    const newUser = new User({
      email: normalizedEmail,
      passwordHash,
      authProvider: 'email',
      firstName: firstName,
      lastName: lastName,
      role: 'user',
      isActive: true,
      termsAcceptedAt: new Date()
    });

    // Save new user
    await newUser.save();

    // Store user info in session
    req.session.user = { 
      id: newUser._id, 
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    };

    // Save session and respond
    req.session.save((err) => {
      if (err) {
        console.error('[REGISTER] Session save error:', err);
        return res.status(500).json({ success: false, errors: { general: 'Session error' } });
      }
      return res.json({ success: true, redirect: '/' });
    });
    
  } catch (err) {
    console.error('Register error:', err);
    
    // Handle MongoDB duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ success: false, errors: { email: 'Email already in use' } });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = {};
      for (const field in err.errors) {
        errors[field] = err.errors[field].message;
      }
      return res.status(400).json({ success: false, errors });
    }
    
    return res.status(500).json({ success: false, errors: { general: 'Server error. Please try again.' } });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, errors: { general: 'Email and password required' } });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('[LOGIN] Attempting login for:', normalizedEmail);

    // Find user and explicitly include passwordHash (since it has select: false)
    const user = await User.findOne({ 
      email: normalizedEmail,
      authProvider: 'email' // Only allow email login for email auth users
    }).select('+passwordHash');

    console.log('[LOGIN] User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' } });
    }

    console.log('[LOGIN] User details:', {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      hasPasswordHash: !!user.passwordHash
    });

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        success: false, 
        errors: { general: `Account locked. Try again in ${lockTimeRemaining} minutes.` } 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, errors: { general: 'Account is deactivated' } });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log('[LOGIN] Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      await user.incLoginAttempts();
      return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' } });
    }

    // Reset login attempts on successful login
    if (user.resetLoginAttempts) {
      await user.resetLoginAttempts();
    }

    // Update last login info
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip || req.connection?.remoteAddress;
    await user.save();

    // Store user info in session
    req.session.user = { 
      id: user._id, 
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl
    };

    console.log('[LOGIN] Session user set:', req.session.user);

    // Explicitly save session before responding
    req.session.save((err) => {
      if (err) {
        console.error('[LOGIN] Session save error:', err);
        return res.status(500).json({ success: false, errors: { general: 'Session error' } });
      }
      console.log('[LOGIN] Session saved successfully');
      return res.json({ success: true });
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error. Please try again.' } });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.clearCookie('connect.sid'); // Clear session cookie
      return res.redirect('/');
    });
  } else {
    return res.redirect('/');
  }
});

// GET /auth/debug-session - Debug endpoint to see session contents
router.get('/debug-session', (req, res) => {
  return res.json({
    sessionExists: !!req.session,
    sessionUser: req.session?.user || null,
    sessionID: req.sessionID,
    resLocalsUser: res.locals.user || null
  });
});

// GET /auth/me - Get current user info
router.get('/me', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ success: false, errors: { general: 'Not authenticated' } });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ success: false, errors: { general: 'User not found' } });
    }

    return res.json({ 
      success: true, 
      user: user.toPublic() 
    });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' } });
  }
});

// PUT /auth/profile - Update user profile
router.put('/profile', async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ success: false, errors: { general: 'Not authenticated' } });
    }

    const { firstName, lastName, phone, dateOfBirth, profileImageUrl } = req.body || {};
    const errors = {};

    // Validation
    if (firstName !== undefined) {
      if (!firstName || !firstName.trim()) {
        errors.firstName = 'First name is required';
      } else if (firstName.trim().length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
      }
    }
    
    if (lastName !== undefined) {
      if (!lastName || !lastName.trim()) {
        errors.lastName = 'Last name is required';
      } else if (lastName.trim().length < 2) {
        errors.lastName = 'Last name must be at least 2 characters';
      }
    }
    
    if (phone && !/^[+]?[\d\s()-]{7,20}$/.test(phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (isNaN(dob.getTime()) || age < 13 || age > 100) {
        errors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, errors });
    }

    // Find and update user
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ success: false, errors: { general: 'User not found' } });
    }

    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone !== undefined) user.phone = phone ? phone.trim() : undefined;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
    if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl || undefined;

    await user.save();

    // Update session with new info
    req.session.user = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl
    };

    req.session.save((err) => {
      if (err) {
        console.error('[PROFILE] Session save error:', err);
      }
      return res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        user: user.toPublic()
      });
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' } });
  }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ success: false, errors: { email: 'Email is required' } });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      authProvider: 'email'
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // TODO: Send email with reset link
    // For now, just log the token (in production, send via email)
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' } });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, password2 } = req.body || {};
    const errors = {};

    if (!token) errors.token = 'Reset token is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!password2) errors.password2 = 'Please confirm password';
    if (password && password2 && password !== password2) errors.password2 = 'Passwords do not match';

    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, errors });
    }

    // Hash the token to compare with stored hash
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ success: false, errors: { token: 'Invalid or expired reset token' } });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, errors: { general: 'Server error' } });
  }
});

module.exports = router;
