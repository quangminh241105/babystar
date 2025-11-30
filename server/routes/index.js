const express = require('express');
const router = express.Router();
const { requireAuth, requireAuthRedirect } = require('../middleware');
const User = require('../models/user');

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

// GET /link-account - page to display and share invitation code
router.get('/link-account', requireAuthRedirect, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.redirect('/auth/login');
    }
    
    // Expire old pending associations
    await user.expirePendingAssociations();
    
    // Get valid invitation code (regenerates if expired)
    const invitationCode = await user.getValidInvitationCode();
    const expiresAt = user.invitationCodeExpiresAt;
    const expiresIn = Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000));
    
    // Populate associated users for display
    await user.populate('associatedUsers.userId', 'firstName lastName email profileImageUrl');
    
    // Get invitations where this user is the receiver (others invited them)
    const receivedInvitations = await User.findAssociationsForUser(req.session.user.id);
    
    res.render('pages/linkaccount', { 
      title: 'Link Account',
      invitationCode,
      expiresAt: expiresAt.toISOString(),
      expiresIn,
      // Associations where this user is the SENDER (others used their code)
      linkedAccounts: user.associatedUsers || [],
      // Associations where this user is the RECEIVER (they used others' code)
      receivedInvitations: receivedInvitations.map(u => {
        const assoc = u.associatedUsers.find(a => a.userId.toString() === req.session.user.id);
        return {
          ownerId: u._id,
          ownerName: u.fullName || u.email,
          ownerEmail: u.email,
          ownerImage: u.profileImageUrl,
          relationship: assoc?.relationship,
          status: assoc?.status,
          associationId: assoc?._id
        };
      })
    });
  } catch (err) {
    console.error('Link account error:', err);
    res.redirect('/');
  }
});

// POST /link-account/refresh - force regenerate invitation code
router.post('/link-account/refresh', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    user.generateInvitationCode();
    await user.save();
    
    res.json({ 
      success: true, 
      invitationCode: user.invitationCode,
      expiresAt: user.invitationCodeExpiresAt,
      expiresIn: 300
    });
  } catch (err) {
    console.error('Refresh invitation code error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /link-account/connect - connect to another user via invitation code
router.post('/link-account/connect', requireAuth, async (req, res) => {
  try {
    const { code, relationship } = req.body;
    
    if (!code || !relationship) {
      return res.status(400).json({ success: false, error: 'Code and relationship are required' });
    }
    
    // Find user by invitation code (only valid, non-expired codes)
    const targetUser = await User.findByInvitationCode(code);
    
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Invalid or expired invitation code' });
    }
    
    if (targetUser._id.toString() === req.session.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot link to yourself' });
    }
    
    // Add current user as associated user to target
    await targetUser.addAssociatedUser(req.session.user.id, relationship);
    
    res.json({ success: true, message: 'Link request sent successfully' });
  } catch (err) {
    console.error('Connect account error:', err);
    if (err.message === 'User is already associated') {
      return res.status(400).json({ success: false, error: 'Already linked to this user' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
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

// POST /link-account/accept/:associationId - SENDER accepts a pending request
router.post('/link-account/accept/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.acceptAssociation(req.params.associationId);
    res.json({ success: true, message: 'Association accepted' });
  } catch (err) {
    console.error('Accept association error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /link-account/reject/:associationId - SENDER rejects a pending request
router.post('/link-account/reject/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.rejectAssociation(req.params.associationId);
    res.json({ success: true, message: 'Association rejected' });
  } catch (err) {
    console.error('Reject association error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /link-account/revoke/:associationId - SENDER revokes an accepted link
router.post('/link-account/revoke/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.revokeAssociation(req.params.associationId);
    res.json({ success: true, message: 'Association revoked' });
  } catch (err) {
    console.error('Revoke association error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /link-account/remove/:associationId - SENDER removes association completely
router.delete('/link-account/remove/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.removeAssociation(req.params.associationId);
    res.json({ success: true, message: 'Association removed' });
  } catch (err) {
    console.error('Remove association error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /link-account/permissions/:associationId - SENDER updates permissions
router.put('/link-account/permissions/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.updateAssociationPermissions(req.params.associationId, req.body);
    res.json({ success: true, message: 'Permissions updated' });
  } catch (err) {
    console.error('Update permissions error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /link-account/cancel/:ownerId - RECEIVER cancels/withdraws their request
router.post('/link-account/cancel/:ownerId', requireAuth, async (req, res) => {
  try {
    const owner = await User.findById(req.params.ownerId);
    if (!owner) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const association = owner.associatedUsers.find(
      a => a.userId.toString() === req.session.user.id && a.status === 'pending'
    );
    
    if (!association) {
      return res.status(404).json({ success: false, error: 'Pending association not found' });
    }
    
    // Remove the association since receiver is cancelling their own request
    association.deleteOne();
    await owner.save();
    
    res.json({ success: true, message: 'Request cancelled' });
  } catch (err) {
    console.error('Cancel request error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /link-account/leave/:ownerId - RECEIVER leaves an accepted association
router.post('/link-account/leave/:ownerId', requireAuth, async (req, res) => {
  try {
    const owner = await User.findById(req.params.ownerId);
    if (!owner) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const association = owner.associatedUsers.find(
      a => a.userId.toString() === req.session.user.id && a.status === 'accepted'
    );
    
    if (!association) {
      return res.status(404).json({ success: false, error: 'Active association not found' });
    }
    
    // Mark as revoked (from receiver side)
    association.status = 'revoked';
    association.respondedAt = new Date();
    await owner.save();
    
    res.json({ success: true, message: 'Left association' });
  } catch (err) {
    console.error('Leave association error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// health log page
router.get('/log-health', requireAuthRedirect, (req, res) => {
  res.render('pages/health-log', { title: 'Health Log' });
});

module.exports = router;
