const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');
const { requireAuth, redirectIfLoggedIn } = require('../middleware');

// Google OAuth client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// GET /auth - redirect based on login status
router.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.redirect('/auth/login');
});

// GET /auth/login - render login page
router.get('/login', redirectIfLoggedIn, (req, res) => {
  // Pass redirect URL to the view so the form can use it
  const redirect = req.query.redirect || '/';
  res.render('pages/auth/login', { title: 'Login', redirect });
});

// GET /auth/register - render register page
router.get('/register', redirectIfLoggedIn, (req, res) => {
  const redirect = req.query.redirect || '/';
  res.render('pages/auth/register', { title: 'Register', redirect });
});

// POST /auth/register - create new account
router.post('/register', async (req, res) => {
  try {
    const { fullname, email, password, password2 } = req.body || {};
    const errors = {};

    // Validate fullname
    if (!fullname?.trim()) {
      errors.fullname = 'Full name is required';
    } else if (fullname.trim().length < 2) {
      errors.fullname = 'Name must be at least 2 characters';
    }
    
    // Validate email
    if (!email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email';
    }
    
    // Validate password
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    // Validate password confirmation
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
      return res.status(400).json({ success: false, errors: { email: 'Email already in use' }});
    }

    // Parse name
    const nameParts = fullname.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user
    const newUser = new User({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      authProvider: 'email',
      firstName,
      lastName,
      role: 'user',
      isActive: true,
      termsAcceptedAt: new Date()
    });

    await newUser.save();

    // Set session
    req.session.user = { 
      id: newUser._id, 
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    };

    req.session.save((err) => {
      if (err) return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      res.json({ success: true, redirect: '/' });
    });
    
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, errors: { email: 'Email already in use' }});
    }
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// POST /auth/login - authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password, redirect } = req.body || {};
    
    // Validate inputs are strings
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, errors: { general: 'Email and password required' }});
    }

    // Find user with password hash
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      authProvider: 'email'
    }).select('+passwordHash');
    
    if (!user) {
      return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' }});
    }

    // Check account status
    if (user.isLocked) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success: false, errors: { general: `Account locked. Try again in ${mins} minutes.` }});
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, errors: { general: 'Account is deactivated' }});
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await user.incLoginAttempts();
      return res.status(400).json({ success: false, errors: { general: 'Invalid email or password' }});
    }

    // Reset attempts and update login info
    if (user.resetLoginAttempts) await user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save();

    // Set session
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
      if (err) return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      // Return the redirect URL (sanitize to prevent open redirect)
      const safeRedirect = (redirect && redirect.startsWith('/')) ? redirect : '/';
      res.json({ success: true, redirect: safeRedirect });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// POST /auth/google - authenticate with Google ID token
router.post('/google', async (req, res) => {
  try {
    const { credential, redirect } = req.body || {};
    
    // Check if Google OAuth is configured
    if (!googleClient) {
      return res.status(501).json({ success: false, errors: { general: 'Google login not configured' }});
    }
    
    if (!credential) {
      return res.status(400).json({ success: false, errors: { general: 'Google credential required' }});
    }

    // Verify the Google ID token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('Google token verification failed:', err);
      return res.status(401).json({ success: false, errors: { general: 'Invalid Google credential' }});
    }

    const { sub: googleId, email, given_name, family_name, picture, email_verified } = payload;

    // Ensure email is verified
    if (!email_verified) {
      return res.status(400).json({ success: false, errors: { general: 'Google email not verified' }});
    }

    // Find existing user by Google ID or email
    let user = await User.findOne({
      $or: [
        { googleId: googleId },
        { email: email.toLowerCase() }
      ]
    });

    if (user) {
      // Existing user - update Google info if needed
      if (!user.googleId) {
        // Link Google account to existing email account
        user.googleId = googleId;
        user.authProvider = user.authProvider === 'email' ? 'email' : 'google';
      }
      // Update profile image if not set
      if (!user.profileImageUrl && picture) {
        user.profileImageUrl = picture;
      }
      user.lastLoginAt = new Date();
      user.lastLoginIP = req.ip;
      await user.save();
    } else {
      // New user - create account
      user = new User({
        email: email.toLowerCase(),
        googleId: googleId,
        authProvider: 'google',
        firstName: given_name || '',
        lastName: family_name || '',
        profileImageUrl: picture || '',
        role: 'user',
        isActive: true,
        emailVerified: true,
        termsAcceptedAt: new Date()
      });
      await user.save();
    }

    // Set session
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
      if (err) return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      const safeRedirect = (redirect && redirect.startsWith('/')) ? redirect : '/';
      res.json({ success: true, redirect: safeRedirect });
    });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/logout - destroy session
router.get('/logout', (req, res) => {
  req.session?.destroy(() => {});
  res.clearCookie('connect.sid');
  res.redirect('/');
});

// GET /auth/me - get current user info
router.get('/me', async (req, res) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ success: false, errors: { general: 'Not authenticated' }});
  }

  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ success: false, errors: { general: 'User not found' }});
    }
    res.json({ success: true, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/profile - render profile page
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select('-passwordHash');
    if (!user) return res.redirect('/auth/login');
    res.render('pages/auth/profile', { title: 'Profile', user });
  } catch (err) {
    res.redirect('/');
  }
});

// PUT /auth/profile - update profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, bio, phone, dueDate, profileImage } = req.body || {};
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ success: false, errors: { general: 'User not found' }});

    // Update fields
    if (name?.trim()) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (dueDate !== undefined) user.dueDate = dueDate ? new Date(dueDate) : null;
    if (profileImage !== undefined) user.profileImage = profileImage.trim();

    await user.save();
    req.session.user.name = user.name;

    res.json({ success: true, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// DELETE /auth/profile - delete account
router.delete('/profile', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.session.user.id);
    req.session.destroy(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// POST /auth/forgot-password - request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, errors: { email: 'Email is required' }});

    const user = await User.findOne({ email: email.toLowerCase().trim(), authProvider: 'email' });
    
    // Always return success to prevent email enumeration
    if (user) {
      const resetToken = user.generatePasswordResetToken();
      await user.save();
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// POST /auth/reset-password - reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, password2 } = req.body || {};
    const errors = {};

    if (!token) errors.token = 'Reset token is required';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!password2) errors.password2 = 'Please confirm password';
    if (password && password2 && password !== password2) errors.password2 = 'Passwords do not match';

    if (Object.keys(errors).length) return res.status(400).json({ success: false, errors });

    // Find user by hashed token
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) return res.status(400).json({ success: false, errors: { token: 'Invalid or expired token' }});

    // Update password and clear reset fields
    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

module.exports = router;
