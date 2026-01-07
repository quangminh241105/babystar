const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');
const { Notification } = require('../models/notification');
const { requireAuth, redirectIfLoggedIn } = require('../middleware');

// Google OAuth client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Helper to emit real-time notification via Socket.IO
function emitNotification(req, userId, notification) {
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit('notification', {
      type: 'new',
      notification: {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category: notification.category,
        priority: notification.priority,
        actionUrl: notification.actionUrl,
        actionLabel: notification.actionLabel,
        createdAt: notification.createdAt,
        read: notification.read
      }
    });

    Notification.getUnreadCount(userId).then(count => {
      io.to(`user:${userId}`).emit('notification', { type: 'count', count });
    }).catch(err => console.error('Failed to emit count:', err));
  }
}

// Helper to check if profile is incomplete
function isProfileIncomplete(user) {
  const profile = user.pregnancyProfile;
  // Profile is considered incomplete if missing key pregnancy info
  return !profile?.lastMenstrualPeriod && !profile?.dueDate;
}

// Helper to send profile completion reminder on first login after signup
async function sendProfileCompletionReminder(req, user) {
  try {
    // Check if user's profile is incomplete
    if (!isProfileIncomplete(user)) {
      return; // Profile already complete
    }

    // Check if this is effectively first login (no lastLoginAt before this session)
    // or if we haven't sent this type of notification in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReminder = await Notification.findOne({
      userId: user._id,
      type: 'system_announcement',
      'metadata.reminderType': 'profile_completion',
      createdAt: { $gte: sevenDaysAgo }
    });

    if (recentReminder) {
      return; // Already sent recently
    }

    // Create profile completion notification
    const notification = await Notification.create({
      userId: user._id,
      title: '📝 Complete Your Profile',
      message: 'Set up your pregnancy details to get personalized health advice, weekly updates, and track your journey!',
      type: 'system_announcement',
      category: 'system',
      priority: 'high',
      actionUrl: '/auth/profile',
      actionLabel: 'Complete Profile',
      metadata: {
        reminderType: 'profile_completion'
      },
      createdBy: { type: 'system' }
    });

    // Emit real-time notification
    emitNotification(req, user._id.toString(), notification);

  } catch (err) {
    console.error('Error sending profile completion reminder:', err);
  }
}

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
    const { fullname, email, phoneNumber, password, password2 } = req.body || {};
    const errors = {};

    // Validate fullname
    if (!fullname?.trim()) {
      errors.fullname = 'Full name is required';
    } else if (fullname.trim().length < 2) {
      errors.fullname = 'Name must be at least 2 characters';
    }
    
    // Validate email or phone - at least one required
    if (!email && !phoneNumber) {
      errors.emailOrPhone = 'Email or phone number is required';
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.emailOrPhone = 'Please enter a valid email';
    }
    
    if (phoneNumber && !/^\+?[0-9]{8,15}$/.test(phoneNumber.replace(/[\s\-\(\)\.]/g, ''))) {
      errors.emailOrPhone = 'Please enter a valid phone number';
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

    // Check for existing user by email or phone
    const normalizedEmail = email?.toLowerCase().trim() || null;
    const normalizedPhone = phoneNumber?.replace(/[\s\-\(\)\.]/g, '') || null;
    
    const existingQuery = [];
    if (normalizedEmail) existingQuery.push({ email: normalizedEmail });
    if (normalizedPhone) existingQuery.push({ phoneNumber: normalizedPhone });
    
    const existing = await User.findOne({ $or: existingQuery });
    if (existing) {
      if (existing.email === normalizedEmail) {
        return res.status(400).json({ success: false, errors: { emailOrPhone: 'Email already in use' }});
      }
      if (existing.phoneNumber === normalizedPhone) {
        return res.status(400).json({ success: false, errors: { emailOrPhone: 'Phone number already in use' }});
      }
    }

    // Parse name
    const nameParts = fullname.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user - email can be null if only phone provided
    const newUser = new User({
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      passwordHash: await bcrypt.hash(password, 12),
      authProvider: 'email',
      googleId: null,
      role: 'user',
      isActive: true,
      isEmailVerified: false,
      firstName,
      lastName,
      dateOfBirth: null,
      currentWeightKg: null,
      profileImageUrl: null,
      pregnancyProfile: {
        lastMenstrualPeriod: null, dueDate: null, deliveryDate: null,
        heightCm: null, prePregnancyWeightKg: null, bloodType: null,
        allergies: [], medicalConditions: [], isHighRisk: false,
        gravida: 1, para: 0, primaryPhysician: null, hospitalName: null, status: 'active'
      },
      associatedUsers: [],
      notificationPreferences: {
        email: true, push: true, sms: false, dailyReminders: true,
        weeklyReportReady: true, appointmentReminders: true,
        partnerUpdates: true, healthAlerts: true, tipsAndArticles: false
      },
      preferredLanguage: 'en', language: 'en', timezone: 'UTC',
      loginAttempts: 0, termsAcceptedAt: new Date()
    });

    newUser.markModified('pregnancyProfile');
    newUser.markModified('notificationPreferences');
    await newUser.save();

    // Create welcome notification with profile completion reminder
    try {
      await Notification.create({
        userId: newUser._id,
        title: 'Welcome to BabyStar! 👶',
        message: 'Complete your profile to get personalized health advice and track your pregnancy journey.',
        type: 'system_announcement',
        category: 'system',
        priority: 'high',
        actionUrl: '/auth/profile?welcome=true',
        actionLabel: 'Complete Profile',
        createdBy: { type: 'system' }
      });
    } catch (notifErr) {
      console.error('Failed to create welcome notification:', notifErr);
    }

    // Set session
    req.session.user = { 
      id: newUser._id, 
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role
    };

    // Save session BEFORE sending response
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      }
      // Redirect new users to profile page with welcome flag
      return res.json({ success: true, redirect: '/auth/profile?welcome=true' });
    });
    
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, errors: { emailOrPhone: 'Account already exists' }});
    }
    res.status(500).json({ success: false, errors: { general: 'Server error: ' + err.message }});
  }
});

// POST /auth/login - authenticate user
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password, redirect } = req.body || {};
    
    if (!emailOrPhone || typeof emailOrPhone !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, errors: { general: 'Email/phone and password required' }});
    }

    const input = emailOrPhone.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    const cleanedPhone = input.replace(/[\s\-\(\)\.]/g, '');
    
    // Find user by email or phone
    let user;
    if (isEmail) {
      user = await User.findOne({ email: input.toLowerCase(), authProvider: 'email' }).select('+passwordHash');
    } else {
      user = await User.findOne({ phoneNumber: cleanedPhone, authProvider: 'email' }).select('+passwordHash');
    }
    
    if (!user) {
      return res.status(400).json({ success: false, errors: { general: 'Invalid credentials' }});
    }

    // Check account status
    if (user.isLocked) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success: false, errors: { general: `Account locked. Try again in ${mins} minutes.` }});
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, errors: { general: 'Account is deactivated' }});
    }

    if (!user.passwordHash) {
      return res.status(400).json({ success: false, errors: { general: 'Please login with Google or set a password first' }});
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await user.incLoginAttempts();
      return res.status(400).json({ success: false, errors: { general: 'Invalid credentials' }});
    }

    // Reset attempts and update login info
    if (user.resetLoginAttempts) await user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save();

    // Send profile completion reminder if needed (async, don't block login)
    sendProfileCompletionReminder(req, user);

    // REGENERATE SESSION to prevent session fixation and clear old user data
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      }

      // Set NEW session with fresh user data
      req.session.user = { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ success: false, errors: { general: 'Session error' }});
        }
        // Redirect admin to admin page, others to their redirect/home
        let safeRedirect = (redirect && redirect.startsWith('/')) ? redirect : '/';
        if (user.role === 'admin') {
          safeRedirect = '/admin';
        }
        res.json({ success: true, redirect: safeRedirect });
      });
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

    if (!email_verified) {
      return res.status(400).json({ success: false, errors: { general: 'Google email not verified' }});
    }

    let user = await User.findOne({
      $or: [{ googleId: googleId }, { email: email.toLowerCase() }]
    });

    if (user) {
      // Existing user - update and ensure all fields exist
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.profileImageUrl && picture) {
        user.profileImageUrl = picture;
      }
      
      // ENSURE pregnancyProfile exists with all fields
      if (!user.pregnancyProfile || Object.keys(user.pregnancyProfile).length === 0) {
        user.pregnancyProfile = {
          lastMenstrualPeriod: null,
          dueDate: null,
          deliveryDate: null,
          heightCm: null,
          prePregnancyWeightKg: null,
          bloodType: null,
          allergies: [],
          medicalConditions: [],
          isHighRisk: false,
          gravida: 1,
          para: 0,
          primaryPhysician: null,
          hospitalName: null,
          status: 'active'
        };
        user.markModified('pregnancyProfile');
      }
      
      // Ensure personal info fields exist
      if (user.phoneNumber === undefined) user.phoneNumber = null;
      if (user.dateOfBirth === undefined) user.dateOfBirth = null;
      if (user.currentWeightKg === undefined) user.currentWeightKg = null;
      
      user.lastLoginAt = new Date();
      user.lastLoginIP = req.ip;
      await user.save();
    } else {
      // New user - create with ALL fields
      user = new User({
        email: email.toLowerCase(),
        googleId: googleId,
        authProvider: 'google',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        
        // Personal Info
        firstName: given_name || '',
        lastName: family_name || '',
        phoneNumber: null,
        profileImageUrl: picture || null,
        dateOfBirth: null,
        currentWeightKg: null,
        
        // Pregnancy Profile - FULLY POPULATED
        pregnancyProfile: {
          lastMenstrualPeriod: null,
          dueDate: null,
          deliveryDate: null,
          heightCm: null,
          prePregnancyWeightKg: null,
          bloodType: null,
          allergies: [],
          medicalConditions: [],
          isHighRisk: false,
          gravida: 1,
          para: 0,
          primaryPhysician: null,
          hospitalName: null,
          status: 'active'
        },
        
        associatedUsers: [],
        
        notificationPreferences: {
          email: true,
          push: true,
          sms: false,
          dailyReminders: true,
          weeklyReportReady: true,
          appointmentReminders: true,
          partnerUpdates: true,
          healthAlerts: true,
          tipsAndArticles: false
        },
        
        preferredLanguage: 'en',
        language: 'en',
        timezone: 'UTC',
        invitationCode: null,
        lastLoginAt: new Date(),
        lastLoginIP: req.ip,
        loginAttempts: 0,
        lockUntil: null,
        termsAcceptedAt: new Date(),
        privacyPolicyAcceptedAt: null,
        deletedAt: null
      });
      
      user.markModified('pregnancyProfile');
      user.markModified('notificationPreferences');
      await user.save();
    }

    // Send profile completion reminder if needed (async, don't block login)
    sendProfileCompletionReminder(req, user);

    // REGENERATE SESSION for security and to clear old data
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.status(500).json({ success: false, errors: { general: 'Session error' }});
      }

      req.session.user = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ success: false, errors: { general: 'Session error' }});
        }
        const safeRedirect = (redirect && redirect.startsWith('/')) ? redirect : '/';
        res.json({ success: true, redirect: safeRedirect });
      });
    });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/logout - destroy session
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.clearCookie('connect.sid', { path: '/' });
      res.redirect('/');
    });
  } else {
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/');
  }
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

// GET /auth/user-edit
router.get('/user-edit', requireAuth, async (req, res) => {
  try {
    // Prevent browser caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const user = await User.findById(req.session.user.id).select('-passwordHash');
    if (!user) return res.redirect('/auth/login');
    res.render('pages/auth/user-edit', { title: 'Edit Profile', user });
  } catch (err) {
    res.redirect('/');
  }
});

// PUT /auth/user-edit - update user profile and pregnancy data
router.put('/user-edit', requireAuth, async (req, res) => {
  try {
    const {
      // Personal Info
      fullName,
      email,
      phoneNumber,
      dateOfBirth,
      currentWeightKg,
      // Pregnancy Profile (nested)
      pregnancyProfile,
      // Preferences
      preferredLanguage,
      timezone,
      // Notifications
      notificationPreferences
    } = req.body || {};

    const errors = {};

    // Validation
    if (fullName !== undefined && fullName.trim() && fullName.trim().length < 2) {
      errors.fullName = 'Name must be at least 2 characters';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email';
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, errors: { general: 'User not found' }});
    }

    // ===== UPDATE PERSONAL INFO =====
    if (fullName?.trim()) {
      const nameParts = fullName.trim().split(/\s+/);
      user.firstName = nameParts[0] || '';
      user.lastName = nameParts.slice(1).join(' ') || '';
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ success: false, errors: { email: 'Email already in use' }});
      }
      user.email = normalizedEmail;
    }

    if (phoneNumber !== undefined) {
      user.phoneNumber = phoneNumber.trim() || null;
    }
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (currentWeightKg !== undefined) {
      user.currentWeightKg = currentWeightKg ? parseFloat(currentWeightKg) : null;
    }
    if (preferredLanguage !== undefined) {
      user.preferredLanguage = preferredLanguage;
    }
    if (timezone !== undefined) {
      user.timezone = timezone;
    }

    // ===== UPDATE PREGNANCY PROFILE =====
    if (pregnancyProfile && typeof pregnancyProfile === 'object') {
      if (!user.pregnancyProfile) {
        user.pregnancyProfile = {};
      }

      const pp = pregnancyProfile;

      // Dates with validation and auto-calculation
      if (pp.lastMenstrualPeriod !== undefined) {
        if (pp.lastMenstrualPeriod) {
          const lmpDate = new Date(pp.lastMenstrualPeriod);
          const now = new Date();
          
          // Validate LMP is not in the future
          if (lmpDate > now) {
            return res.status(400).json({ 
              success: false, 
              error: 'Last Menstrual Period cannot be in the future' 
            });
          }
          
          // Validate LMP is within reasonable range (not more than 42 weeks ago)
          const weeksSinceLMP = Math.floor((now - lmpDate) / (1000 * 60 * 60 * 24 * 7));
          if (weeksSinceLMP > 42) {
            return res.status(400).json({ 
              success: false, 
              error: 'Last Menstrual Period is too far in the past (over 42 weeks ago). Please update your pregnancy status.' 
            });
          }
          
          user.pregnancyProfile.lastMenstrualPeriod = lmpDate;
          
          // Auto-calculate due date if not provided (LMP + 280 days)
          if (!pp.dueDate) {
            const calculatedDueDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
            user.pregnancyProfile.dueDate = calculatedDueDate;
          }
        } else {
          user.pregnancyProfile.lastMenstrualPeriod = undefined;
        }
      }
      
      if (pp.dueDate !== undefined) {
        if (pp.dueDate) {
          const dueDateObj = new Date(pp.dueDate);
          const now = new Date();
          
          // If due date is significantly in the past, warn about pregnancy status
          const daysPastDue = Math.floor((now - dueDateObj) / (1000 * 60 * 60 * 24));
          if (daysPastDue > 14 && user.pregnancyProfile.status === 'active') {
            return res.status(400).json({ 
              success: false, 
              error: 'Due date is more than 2 weeks past. Please update your pregnancy status to "completed".' 
            });
          }
          
          // If both dates provided, ensure they're consistent (within ±14 days of 280-day calculation)
          if (user.pregnancyProfile.lastMenstrualPeriod) {
            const lmpDate = new Date(user.pregnancyProfile.lastMenstrualPeriod);
            const expectedDueDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
            const daysDiff = Math.abs((dueDateObj - expectedDueDate) / (1000 * 60 * 60 * 24));
            
            // Allow up to 14 days difference from calculated due date
            if (daysDiff > 14) {
              return res.status(400).json({ 
                success: false, 
                error: `Due date and LMP are inconsistent. Expected due date around ${expectedDueDate.toISOString().split('T')[0]} based on LMP (±14 days allowed)` 
              });
            }
          }
          
          user.pregnancyProfile.dueDate = dueDateObj;
          
          // Auto-calculate LMP if not provided (Due Date - 280 days)
          if (!pp.lastMenstrualPeriod && !user.pregnancyProfile.lastMenstrualPeriod) {
            const calculatedLMP = new Date(dueDateObj.getTime() - 280 * 24 * 60 * 60 * 1000);
            user.pregnancyProfile.lastMenstrualPeriod = calculatedLMP;
          }
        } else {
          user.pregnancyProfile.dueDate = undefined;
        }
      }
      if (pp.deliveryDate !== undefined) {
        user.pregnancyProfile.deliveryDate = pp.deliveryDate ? new Date(pp.deliveryDate) : undefined;
      }

      // Physical measurements
      if (pp.heightCm !== undefined) {
        user.pregnancyProfile.heightCm = pp.heightCm ? parseFloat(pp.heightCm) : undefined;
      }
      if (pp.prePregnancyWeightKg !== undefined) {
        user.pregnancyProfile.prePregnancyWeightKg = pp.prePregnancyWeightKg ? parseFloat(pp.prePregnancyWeightKg) : undefined;
      }

      // Medical info
      if (pp.bloodType !== undefined) {
        user.pregnancyProfile.bloodType = pp.bloodType || null;
      }
      if (pp.allergies !== undefined) {
        user.pregnancyProfile.allergies = Array.isArray(pp.allergies) 
          ? pp.allergies.filter(a => a?.trim()) 
          : (typeof pp.allergies === 'string' ? pp.allergies.split(',').map(a => a.trim()).filter(Boolean) : []);
      }
      if (pp.medicalConditions !== undefined) {
        user.pregnancyProfile.medicalConditions = Array.isArray(pp.medicalConditions)
          ? pp.medicalConditions.filter(m => m?.trim())
          : (typeof pp.medicalConditions === 'string' ? pp.medicalConditions.split(',').map(m => m.trim()).filter(Boolean) : []);
      }
      if (pp.isHighRisk !== undefined) {
        user.pregnancyProfile.isHighRisk = pp.isHighRisk === true || pp.isHighRisk === 'true';
      }

      // Pregnancy history
      if (pp.gravida !== undefined) {
        user.pregnancyProfile.gravida = pp.gravida ? parseInt(pp.gravida, 10) : 1;
      }
      if (pp.para !== undefined) {
        user.pregnancyProfile.para = pp.para ? parseInt(pp.para, 10) : 0;
      }

      // Healthcare provider
      if (pp.primaryPhysician !== undefined) {
        user.pregnancyProfile.primaryPhysician = pp.primaryPhysician?.trim() || undefined;
      }
      if (pp.hospitalName !== undefined) {
        user.pregnancyProfile.hospitalName = pp.hospitalName?.trim() || undefined;
      }

      // Status
      if (pp.status !== undefined) {
        user.pregnancyProfile.status = pp.status || 'active';
      }

      user.markModified('pregnancyProfile');
    }

    // ===== UPDATE NOTIFICATION PREFERENCES =====
    if (notificationPreferences && typeof notificationPreferences === 'object') {
      if (!user.notificationPreferences) {
        user.notificationPreferences = {};
      }
      const validKeys = ['email', 'push', 'sms', 'dailyReminders', 'weeklyReportReady', 
                         'appointmentReminders', 'partnerUpdates', 'healthAlerts', 'tipsAndArticles'];
      validKeys.forEach(key => {
        if (notificationPreferences[key] !== undefined) {
          user.notificationPreferences[key] = notificationPreferences[key] === true || notificationPreferences[key] === 'true';
        }
      });
      user.markModified('notificationPreferences');
    }

    await user.save();

    // Update session
    req.session.user.firstName = user.firstName;
    req.session.user.lastName = user.lastName;
    req.session.user.fullName = user.fullName;
    req.session.user.email = user.email;

    res.json({ success: true, user: user.toPublic(), message: 'Profile updated successfully' });

  } catch (err) {
    console.error('User edit error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error: ' + err.message }});
  }
});

// GET /auth/user-edit/data - get current user data for form
router.get('/user-edit/data', requireAuth, async (req, res) => {
  try {
    // Prevent caching of user data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const user = await User.findById(req.session.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, errors: { general: 'User not found' }});
    }

    const formatDate = (date) => date ? new Date(date).toISOString().split('T')[0] : '';

    res.json({
      success: true,
      data: {
        // Personal Info
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        dateOfBirth: formatDate(user.dateOfBirth),
        currentWeightKg: user.currentWeightKg || '',
        profileImageUrl: user.profileImageUrl || '',
        
        // Pregnancy Profile (as nested object)
        pregnancyProfile: {
          lastMenstrualPeriod: formatDate(user.pregnancyProfile?.lastMenstrualPeriod),
          dueDate: formatDate(user.pregnancyProfile?.dueDate),
          deliveryDate: formatDate(user.pregnancyProfile?.deliveryDate),
          heightCm: user.pregnancyProfile?.heightCm || '',
          prePregnancyWeightKg: user.pregnancyProfile?.prePregnancyWeightKg || '',
          bloodType: user.pregnancyProfile?.bloodType || '',
          allergies: user.pregnancyProfile?.allergies || [],
          medicalConditions: user.pregnancyProfile?.medicalConditions || [],
          isHighRisk: user.pregnancyProfile?.isHighRisk || false,
          gravida: user.pregnancyProfile?.gravida || 1,
          para: user.pregnancyProfile?.para || 0,
          primaryPhysician: user.pregnancyProfile?.primaryPhysician || '',
          hospitalName: user.pregnancyProfile?.hospitalName || '',
          status: user.pregnancyProfile?.status || 'active'
        },
        
        // Notification Preferences
        notificationPreferences: user.notificationPreferences || {},
        
        // Preferences
        preferredLanguage: user.preferredLanguage || 'en',
        timezone: user.timezone || 'UTC',
        
        // Computed fields
        currentWeek: user.currentPregnancyWeek,
        trimester: user.currentTrimester,
        daysUntilDue: user.daysUntilDueDate,
        age: user.age
      }
    });
  } catch (err) {
    console.error('Get user data error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// DELETE /auth/user-edit/pregnancy - clear pregnancy data
router.delete('/user-edit/pregnancy', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, errors: { general: 'User not found' }});
    }

    // Clear pregnancy profile
    user.pregnancyProfile = {};
    await user.save();

    res.json({ success: true, message: 'Pregnancy data cleared' });

  } catch (err) {
    console.error('Clear pregnancy data error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/user-edit/export - export user profile as JSON
router.get('/user-edit/export', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, errors: { general: 'User not found' }});
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: {
        name: user.fullName,
        email: user.email,
        phone: user.phoneNumber
      },
      pregnancy: user.pregnancyProfile || {},
      preferences: {
        language: user.preferredLanguage,
        timezone: user.timezone,
        notifications: user.notificationPreferences
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="babystar-profile-${Date.now()}.json"`);
    res.json(exportData);

  } catch (err) {
    console.error('Export profile error:', err);
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

    const dueDateChanged = dueDate !== undefined && 
      ((!user.dueDate && dueDate) || 
       (user.dueDate && dueDate && new Date(dueDate).getTime() !== new Date(user.dueDate).getTime()));

    // Update fields
    if (name?.trim()) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (dueDate !== undefined) user.dueDate = dueDate ? new Date(dueDate) : null;
    if (profileImage !== undefined) user.profileImage = profileImage.trim();

    await user.save();
    req.session.user.name = user.name;

    // Emit real-time update to linked partners if due date changed
    const io = req.app.get('io');
    if (io && dueDateChanged && user.linkedAccounts?.length > 0) {
      user.linkedAccounts.forEach(link => {
        if (link.status === 'accepted') {
          io.to(`user:${link.userId}`).emit('partnerUpdate', {
            type: 'profile-updated',
            partnerId: req.session.user.id,
            partnerName: user.fullName || user.firstName
          });
        }
      });
    }

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

    // Find user with valid token
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

// PUT /auth/change-password - change or set password
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, newPassword2 } = req.body || {};
    const errors = {};

    // Get user with password
    const user = await User.findById(req.session.user.id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, errors: { general: 'User not found' }});
    }

    // If user has a password (not Google-only), require current password
    if (user.passwordHash) {
      if (!currentPassword) {
        errors.currentPassword = 'Current password is required';
      } else {
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          errors.currentPassword = 'Current password is incorrect';
        }
      }
    }

    // Validate new password
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }

    if (!newPassword2) {
      errors.newPassword2 = 'Please confirm new password';
    } else if (newPassword !== newPassword2) {
      errors.newPassword2 = 'Passwords do not match';
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, errors });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    
    // If user was Google-only, now they can also login with email/password
    if (user.authProvider === 'google' && !user.email) {
      // They need an email to use password login
      return res.status(400).json({ success: false, errors: { general: 'Please add an email first to use password login' }});
    }

    await user.save();

    res.json({ success: true, message: user.authProvider === 'google' ? 'Password set successfully! You can now also login with email/password.' : 'Password changed successfully' });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, errors: { general: 'Server error' }});
  }
});

// GET /auth/has-password - check if user has a password set
router.get('/has-password', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, hasPassword: !!user.passwordHash, authProvider: user.authProvider });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
