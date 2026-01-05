require('dotenv').config();
const express = require('express');
const router = express.Router();
const { requireAuth, requireAuthRedirect } = require('../middleware');
const User = require('../models/user');
const HealthLog = require('../models/healthlogs');
const WeeklyReport = require('../models/weeklyreports');
const { Notification } = require('../models/notification');
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const { generateWeeklyReportForUser } = require('../services/weeklyReportService');

// Helper function to emit real-time notification via Socket.IO
function emitNotification(req, userId, notification) {
  const io = req.app.get('io');
  if (io) {
    // Emit to user's room
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
    
    // Also emit updated unread count
    Notification.getUnreadCount(userId).then(count => {
      io.to(`user:${userId}`).emit('notification', {
        type: 'count',
        count
      });
    }).catch(err => console.error('Failed to emit count:', err));
  }
}

// Helper to emit link-account updates
function emitLinkAccountUpdate(req, userId, data) {
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit('link-account', data);
  }
}

// Homepage or Welcome page based on authentication
router.get('/', async (req, res) => {
  if (req.session && req.session.user) {
      try {
        // Fetch user data to get pregnancy information
        const user = await User.findById(req.session.user.id);
        
        // Get pregnancy week and days until due date
        const pregnancyWeek = user?.currentPregnancyWeek;
        const daysUntilDueDate = user?.daysUntilDueDate;
        
        res.render('pages/home', { 
          title: 'Home',
          pregnancyWeek,
          daysUntilDueDate
        });
      } catch (error) {
        console.error('Error fetching user data for home:', error);
        res.render('pages/home', { 
          title: 'Home',
          pregnancyWeek: null,
          daysUntilDueDate: null
        });
      }
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
    
    // Get sender info for notification
    const sender = await User.findById(req.session.user.id);
    const senderName = sender?.fullName || sender?.email || 'Someone';
    
    // Create notification for target user (the one who shared the code)
    const notification = await Notification.create({
      userId: targetUser._id,
      title: 'New Partner Link Request',
      message: `${senderName} wants to link accounts with you as your ${relationship}. Review and accept or decline this request.`,
      type: 'partner_request',
      category: 'social',
      priority: 'high',
      actionUrl: '/link-account',
      actionLabel: 'View Request',
      relatedEntity: { type: 'user', id: req.session.user.id },
      createdBy: { type: 'system' }
    });
    
    // Emit real-time notification via Socket.IO
    emitNotification(req, targetUser._id.toString(), notification);
    
    // Emit link-account update to target user
    emitLinkAccountUpdate(req, targetUser._id.toString(), {
      type: 'new_request',
      from: {
        id: req.session.user.id,
        name: senderName,
        relationship
      }
    });
    
    res.json({ success: true, message: 'Link request sent successfully' });
  } catch (err) {
    console.error('Connect account error:', err);
    if (err.message === 'User is already associated') {
      return res.status(400).json({ success: false, error: 'Already linked to this user' });
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /link-account/accept/:associationId - SENDER accepts a pending request
router.post('/link-account/accept/:associationId', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Find the association to get the partner's userId
    const association = user.associatedUsers.id(req.params.associationId);
    if (!association) {
      return res.status(404).json({ success: false, error: 'Association not found' });
    }
    
    const partnerId = association.userId;
    
    await user.acceptAssociation(req.params.associationId);
    
    // Create notification for the partner (the one who sent the request)
    const acceptorName = user.fullName || user.email || 'User';
    const notification = await Notification.create({
      userId: partnerId,
      title: 'Partner Link Accepted! 🎉',
      message: `${acceptorName} has accepted your link request. You can now share health records and stay connected.`,
      type: 'partner_accepted',
      category: 'social',
      priority: 'normal',
      actionUrl: '/link-account',
      actionLabel: 'View Link',
      relatedEntity: { type: 'user', id: req.session.user.id },
      createdBy: { type: 'system' }
    });
    
    // Emit real-time notification via Socket.IO
    emitNotification(req, partnerId.toString(), notification);
    
    // Emit link-account update to both users
    emitLinkAccountUpdate(req, partnerId.toString(), {
      type: 'request_accepted',
      by: { id: req.session.user.id, name: acceptorName }
    });
    emitLinkAccountUpdate(req, req.session.user.id, {
      type: 'accepted',
      associationId: req.params.associationId
    });
    
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
    
    // Get the partner's userId before rejecting
    const association = user.associatedUsers.id(req.params.associationId);
    const partnerId = association?.userId;
    
    await user.rejectAssociation(req.params.associationId);
    
    // Emit link-account update to partner if exists
    if (partnerId) {
      emitLinkAccountUpdate(req, partnerId.toString(), {
        type: 'request_rejected',
        by: { id: req.session.user.id }
      });
    }
    
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
    
    // Get the partner's userId before revoking
    const association = user.associatedUsers.id(req.params.associationId);
    const partnerId = association?.userId;
    
    await user.revokeAssociation(req.params.associationId);
    
    // Emit link-account update to partner if exists
    if (partnerId) {
      emitLinkAccountUpdate(req, partnerId.toString(), {
        type: 'link_revoked',
        by: { id: req.session.user.id }
      });
    }
    
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

// AI-Powered Diet Planner
router.get('/diet-plan', requireAuthRedirect, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const pregnancyWeek = user?.currentPregnancyWeek?.weeks || null;
    const trimester = user?.currentTrimester || null;

    res.render('pages/dietplanner', { 
      title: 'AI Diet Planner',
      isPartnerView: false,
      pregnancyWeek,
      trimester,
      userName: user?.name || user?.username || 'there'
    });
  } catch (error) {
    console.error('Error loading diet planner:', error);
    res.render('pages/dietplanner', { 
      title: 'AI Diet Planner',
      pregnancyWeek: null,
      trimester: null,
      userName: 'there'
    });
  }
});

router.get('/nearby-healthcare', requireAuthRedirect, (req, res) => {
  res.render('pages/nearbyhealthcare', { title: 'Diet Planner' });
});

// ==================== NOTIFICATION ROUTES ====================

// GET /notifications - Render notifications page
router.get('/notifications', requireAuthRedirect, async (req, res) => {
  try {
    const limit = 50;
    const notifications = await Notification.getAll(req.session.user.id, { limit: limit + 1 });
    const unreadCount = await Notification.getUnreadCount(req.session.user.id);
    
    // Check if there are more notifications
    const hasMore = notifications.length > limit;
    if (hasMore) {
      notifications.pop(); // Remove the extra one
    }
    
    res.render('pages/notifications', { 
      title: 'Notifications',
      notifications,
      unreadCount,
      hasMore
    });
  } catch (err) {
    console.error('Get notifications page error:', err);
    res.render('pages/notifications', { 
      title: 'Notifications',
      notifications: [],
      unreadCount: 0,
      hasMore: false
    });
  }
});

// GET /api/notifications - Get user notifications (JSON)
router.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { category, read, limit = 20 } = req.query;
    const options = { limit: parseInt(limit) };
    
    if (category && category !== 'all') {
      options.category = category;
    }
    if (read !== undefined) {
      options.read = read === 'true';
    }
    
    const notifications = await Notification.getAll(req.session.user.id, options);
    
    res.json({ success: true, notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.session.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ success: false, error: 'Failed to get count' });
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    await notification.markAsRead();
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.session.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// POST /api/notifications/:id/dismiss - Dismiss a notification
router.post('/api/notifications/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    await notification.dismiss();
    res.json({ success: true });
  } catch (err) {
    console.error('Dismiss notification error:', err);
    res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
  }
});

// POST /api/notifications/:id/click - Mark notification as clicked
router.post('/api/notifications/:id/click', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    await notification.markAsClicked();
    res.json({ success: true, actionUrl: notification.actionUrl });
  } catch (err) {
    console.error('Click notification error:', err);
    res.status(500).json({ success: false, error: 'Failed to process click' });
  }
});

// ==================== END NOTIFICATION ROUTES ====================

router.get('/exercise-plan', requireAuthRedirect, (req, res) => {
  res.render('pages/exerciseplanner', { title: 'Exercise Planner' });
});

router.get('/share-records', requireAuthRedirect, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Fetch weekly reports for the user
    const reports = await WeeklyReport.find({
      userId,
      deletedAt: null,
      status: 'complete'
    })
    .sort({ weekNumber: -1 });

    
    res.render('pages/share-report', { 
      title: 'Share Records',
      reports: reports || [],
    });
  } catch (err) {
    console.error('Get share records error:', err);
    res.render('pages/share-report', { 
      title: 'Share Records',
      reports: [],
      currentPregnancyWeek: null,
      currentTrimester: null
    });
  }
});

// GET /download-report-pdf/:reportId - Generate and download PDF using Puppeteer
router.get('/download-report-pdf/:reportId', requireAuth, async (req, res) => {
  let browser;
  try {
    console.log('Starting PDF generation for report:', req.params.reportId);
    
    // Fetch the weekly report from database
    const report = await WeeklyReport.findOne({
      _id: req.params.reportId,
      userId: req.session.user.id,
      deletedAt: null
    }).populate('healthLogIds');
    
    
    console.log('Report found:', report._id, 'Week:', report.weekNumber);
    
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ 
      width: 1200, 
      height: 1600,
      deviceScaleFactor: 1
    });
    
    console.log('Rendering HTML template...');
    
    // Render the report-pdf.ejs template to HTML string with report data
    const html = await new Promise((resolve, reject) => {
      res.app.render('report-pdf', { 
        title: `Week ${report.weekNumber} Health Report`,
        report: report 
      }, (err, html) => {
        if (err) {
          console.error('Template render error:', err);
          reject(err);
        } else {
          resolve(html);
        }
      });
    });
    
    console.log('HTML template rendered successfully');
    
    // Get the full path to CSS file
    const cssPath = path.join(__dirname, '../../client/public/css/share-report.css');
    const fs = require('fs');
    let cssContent = '';
    
    try {
      cssContent = fs.readFileSync(cssPath, 'utf8');
      console.log('CSS file loaded successfully');
    } catch (cssErr) {
      console.warn('Could not load CSS file:', cssErr.message);
    }
    
    // Inject CSS directly into HTML
    const htmlWithCSS = html.replace(
      '<link rel="stylesheet" href="/css/share-report.css">',
      `<style>${cssContent}</style>`
    );
    
    // Set the HTML content directly
    await page.setContent(htmlWithCSS, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('Page content set, generating PDF...');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: false
    });
    
    await browser.close();
    browser = null;
    
    console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    
    // Set headers for PDF download
    const fileName = `pregnancy-report-week${report.weekNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.end(pdfBuffer, 'binary');
  } catch (err) {
    console.error('Generate PDF error:', err);
    console.error('Error stack:', err.stack);
    
    if (browser) {
      await browser.close().catch(e => console.error('Error closing browser:', e));
    }
    
    // Send proper error response
    if (!res.headersSent) {
      res.status(500).send(`
        <html>
          <body>
            <h1>PDF Generation Failed</h1>
            <p>Error: ${err.message}</p>
            <p><a href="/share-records">Go Back</a></p>
          </body>
        </html>
      `);
    }
  }
});

router.get('/reminder', requireAuthRedirect, (req, res) => {
  res.render('pages/reminder', { title: 'Reminder' });
});

router.get('/weekly-advice', requireAuthRedirect, (req, res) => {
  res.render('pages/weekly-advice', { title: 'Weekly Advice' });
});

router.get('/nearby-healthcare', requireAuthRedirect, (req, res) => {
  res.render('pages/nearbyhealthcare', { title: 'Nearby Healthcare' });
});

router.get('/log-health', requireAuthRedirect, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    
    // Check if user has set their Last Menstrual Period (LMP)
    if (!user.pregnancyProfile?.lastMenstrualPeriod) {
      // Redirect to profile page with message to set LMP
      return res.redirect('/auth/profile?error=lmp_required&message=Please+set+your+Last+Menstrual+Period+to+use+health+log+features');
    }
    
    const currentWeek = user?.currentPregnancyWeek?.weeks || null;
    const trimester = user?.currentTrimester || null;
    
    res.render('pages/health-log', { 
      title: 'Health Log',
      currentPregnancyWeek: currentWeek,
      currentTrimester: trimester
    });
  } catch (err) {
    console.error('Health log page error:', err);
    res.render('pages/health-log', { 
      title: 'Health Log',
      currentPregnancyWeek: null,
      currentTrimester: null
    });
  }
});

router.get('/past-health-records', requireAuthRedirect, async (req, res) => {
  try {
    const { startDate, endDate, range } = req.query;
    const userId = req.session.user.id;
    
    let start = null;
    let end = null;
    let activeFilter = 'all';
    
    // Handle quick filters (7 days, 30 days, all)
    if (range && range !== 'all') {
      const days = parseInt(range);
      if (!isNaN(days) && days > 0) {
        end = new Date();
        end.setHours(23, 59, 59, 999);
        
        start = new Date();
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);
        
        activeFilter = range;
      }
    } else if (range === 'all') {
      activeFilter = 'all';
    } else if (startDate || endDate) {
      // Handle custom date range
      activeFilter = 'custom';
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }
    }
    
    // Get filtered logs
    const logs = await HealthLog.getByDateRange(userId, start, end);
    
    res.render('pages/past-health-log', { 
      title: 'Past Health Records', 
      canDelete: true,
      logs,
      filters: {
        activeFilter,
        startDate: startDate || '',
        endDate: endDate || '',
        count: logs.length
      }
    });
  } catch (err) {
    console.error('Get past health records error:', err);
    res.render('pages/past-health-log', { 
      title: 'Past Health Records', 
      logs: [],
      filters: {
        activeFilter: 'all',
        startDate: '',
        endDate: '',
        count: 0
      }
    });
  }
});

// POST /past-health-records/:id/delete - Soft delete health log
router.post('/past-health-records/:id/delete', requireAuth, async (req, res) => {
  try {
    const log = await HealthLog.findOne({
      _id: req.params.id,
      userId: req.session.user.id,
      deletedAt: null
    });
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Health log not found' });
    }
    
    // Check if user owns this log
    if (log.userId.toString() !== req.session.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    log.deletedAt = new Date();
    await log.save();
    
    res.redirect('/past-health-records');
  } catch (err) {
    console.error('Delete health log error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete health log' });
  }
});

// ==================== HEALTH LOG API ROUTES ====================

// GET /api/health-log/today - Get or create today's health log
// SPECIFIC ROUTES FIRST
router.get('/api/health-log/today', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    
    // Validate user has set Last Menstrual Period
    if (!user.pregnancyProfile?.lastMenstrualPeriod) {
      return res.status(400).json({ 
        success: false, 
        error: 'Last Menstrual Period not set',
        requiresProfile: true,
        message: 'Please set your Last Menstrual Period in your profile to use health log features.',
        redirectUrl: '/auth/profile'
      });
    }
    
    const pregnancyWeek = user?.currentPregnancyWeek?.weeks || null;
    const trimester = user?.currentTrimester || null;
    
    // Create log with calculated pregnancy week
    const log = await HealthLog.getOrCreateToday(req.session.user.id, pregnancyWeek, trimester);
    
    res.json({ 
      success: true, 
      log,
      userContext: {
        pregnancyWeek,
        trimester,
        dueDate: user?.pregnancyProfile?.dueDate
      }
    });
  } catch (err) {
    console.error('Get today health log error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health log' });
  }
});

// GET /api/health-log/history/:days - Get recent health logs
// THIS MUST COME BEFORE /:date
router.get('/api/health-log/history/:days', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 7;
    const logs = await HealthLog.getRecent(req.session.user.id, days);
    
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Get health log history error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health log history' });
  }
});

// GET /api/health-log/week/:weekNumber - Get logs for specific pregnancy week
// THIS MUST COME BEFORE /:date
router.get('/api/health-log/week/:weekNumber', requireAuth, async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber);
    const logs = await HealthLog.getByPregnancyWeek(req.session.user.id, weekNumber);
    
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Get health log by week error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health logs' });
  }
});

// GET /api/health-log/:date - Get health log for specific date
// PARAMETERIZED ROUTE MUST BE LAST
router.get('/api/health-log/:date', requireAuth, async (req, res) => {
  try {
    // Add validation to prevent matching non-date strings
    const dateStr = req.params.date;
    
    // Skip if it looks like another route
    if (dateStr === 'today' || dateStr === 'history' || dateStr === 'week') {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date' });
    }
    
    const log = await HealthLog.getByDate(req.session.user.id, date);
    
    res.json({ success: true, log });
  } catch (err) {
    console.error('Get health log by date error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health log' });
  }
});

// POST /api/health-log - Create or update today's health log
router.post('/api/health-log', requireAuth, async (req, res) => {
  try {
    console.log('=== HEALTH LOG SAVE REQUEST ===');
    console.log('User ID:', req.session.user.id);
    console.log('Request body keys:', Object.keys(req.body));
    
    const user = await User.findById(req.session.user.id);
    
    // CRITICAL VALIDATION: Check if user has set Last Menstrual Period
    if (!user.pregnancyProfile?.lastMenstrualPeriod) {
      console.log('ERROR: User has not set LMP');
      return res.status(400).json({ 
        success: false, 
        error: 'Last Menstrual Period not set',
        requiresProfile: true,
        message: 'Please set your Last Menstrual Period in your profile before logging health data.',
        redirectUrl: '/auth/profile'
      });
    }
    
    // DEBUG: Check pregnancyProfile structure
    console.log('=== PREGNANCY PROFILE DEBUG ===');
    console.log('Full pregnancyProfile:', JSON.stringify(user.pregnancyProfile, null, 2));
    console.log('LMP:', user.pregnancyProfile.lastMenstrualPeriod);
    console.log('LMP type:', typeof user.pregnancyProfile.lastMenstrualPeriod);
    console.log('Due Date:', user.pregnancyProfile.dueDate);
    
    // Calculate pregnancy week and trimester from LMP
    console.log('=== CALCULATING PREGNANCY WEEK ===');
    console.log('Calling user.currentPregnancyWeek...');
    const currentPregnancyWeekObj = user.currentPregnancyWeek;
    console.log('currentPregnancyWeek result:', currentPregnancyWeekObj);
    
    // FIX: Use nullish coalescing (??) instead of || to handle week 0 correctly
    // Week 0 is a valid value, but 0 || null returns null (falsy issue)
    const pregnancyWeek = currentPregnancyWeekObj?.weeks ?? null;
    const trimester = user?.currentTrimester ?? null;
    
    console.log('Extracted pregnancyWeek (weeks):', pregnancyWeek);
    console.log('Calculated Trimester:', trimester);
    
    // Manual calculation for debugging
    if (user.pregnancyProfile.lastMenstrualPeriod) {
      const lmp = new Date(user.pregnancyProfile.lastMenstrualPeriod);
      const now = new Date();
      const diffTime = now - lmp;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const manualWeeks = Math.floor(diffDays / 7);
      console.log('=== MANUAL CALCULATION ===');
      console.log('LMP Date object:', lmp);
      console.log('Today:', now);
      console.log('Difference in ms:', diffTime);
      console.log('Difference in days:', diffDays);
      console.log('Manual weeks calculation:', manualWeeks);
    }
    
    // Get or create today's log with calculated pregnancy week
    let log = await HealthLog.getOrCreateToday(req.session.user.id, pregnancyWeek, trimester);
    
    console.log('Existing log ID:', log._id);
    console.log('Log date:', log.logDate);
    
    // SERVER-SIDE VALIDATION: Ensure log is from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = new Date(log.logDate);
    logDate.setHours(0, 0, 0, 0);
    
    if (logDate.getTime() !== today.getTime()) {
      console.log('ERROR: Trying to edit old log');
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot edit health logs from previous days. You can only edit today\'s log.' 
      });
    }
    
    // SERVER-SIDE VALIDATION: Validate numeric boundaries
    const validationErrors = [];
    
    // Validate weight (20-300 kg)
    if (req.body.weightKg !== undefined && req.body.weightKg !== null) {
      const weight = parseFloat(req.body.weightKg);
      if (weight < 20 || weight > 300) {
        validationErrors.push('Weight must be between 20-300 kg');
      }
    }
    
    // Validate heart rate (40-200 bpm)
    if (req.body.heartRateBpm !== undefined && req.body.heartRateBpm !== null) {
      const hr = parseInt(req.body.heartRateBpm);
      if (hr < 40 || hr > 200) {
        validationErrors.push('Heart rate must be between 40-200 bpm');
      }
    }
    
    // Validate blood pressure
    if (req.body.bloodPressure) {
      if (req.body.bloodPressure.systolic !== undefined && req.body.bloodPressure.systolic !== null) {
        const systolic = parseInt(req.body.bloodPressure.systolic);
        if (systolic < 70 || systolic > 200) {
          validationErrors.push('Systolic blood pressure must be between 70-200 mmHg');
        }
      }
      if (req.body.bloodPressure.diastolic !== undefined && req.body.bloodPressure.diastolic !== null) {
        const diastolic = parseInt(req.body.bloodPressure.diastolic);
        if (diastolic < 40 || diastolic > 130) {
          validationErrors.push('Diastolic blood pressure must be between 40-130 mmHg');
        }
      }
    }
    
    // Validate energy and stress levels (1-5)
    if (req.body.energyLevel !== undefined && req.body.energyLevel !== null) {
      const energy = parseInt(req.body.energyLevel);
      if (energy < 1 || energy > 5) {
        validationErrors.push('Energy level must be between 1-5');
      }
    }
    if (req.body.stressLevel !== undefined && req.body.stressLevel !== null) {
      const stress = parseInt(req.body.stressLevel);
      if (stress < 1 || stress > 5) {
        validationErrors.push('Stress level must be between 1-5');
      }
    }
    
    // Validate sleep (0-24 hours, quality 1-5)
    if (req.body.sleep) {
      if (req.body.sleep.totalHours !== undefined && req.body.sleep.totalHours !== null) {
        const sleepHours = parseFloat(req.body.sleep.totalHours);
        if (sleepHours < 0 || sleepHours > 24) {
          validationErrors.push('Sleep hours must be between 0-24');
        }
      }
      if (req.body.sleep.quality !== undefined && req.body.sleep.quality !== null) {
        const quality = parseInt(req.body.sleep.quality);
        if (quality < 1 || quality > 5) {
          validationErrors.push('Sleep quality must be between 1-5');
        }
      }
    }
    
    // Validate hydration (0-10 liters)
    if (req.body.hydration) {
      if (req.body.hydration.waterLiters !== undefined && req.body.hydration.waterLiters !== null) {
        const water = parseFloat(req.body.hydration.waterLiters);
        if (water < 0 || water > 10) {
          validationErrors.push('Water intake must be between 0-10 liters');
        }
      }
      if (req.body.hydration.otherFluidsLiters !== undefined && req.body.hydration.otherFluidsLiters !== null) {
        const fluids = parseFloat(req.body.hydration.otherFluidsLiters);
        if (fluids < 0 || fluids > 10) {
          validationErrors.push('Other fluids must be between 0-10 liters');
        }
      }
    }
    
    // Validate caffeine (>= 0)
    if (req.body.caffeineIntakeMg !== undefined && req.body.caffeineIntakeMg !== null) {
      const caffeine = parseInt(req.body.caffeineIntakeMg);
      if (caffeine < 0) {
        validationErrors.push('Caffeine cannot be negative');
      }
    }
    
    // Validate exercises
    if (req.body.exercises && Array.isArray(req.body.exercises)) {
      req.body.exercises.forEach((ex, i) => {
        if (ex.durationMinutes !== undefined && ex.durationMinutes !== null) {
          const duration = parseInt(ex.durationMinutes);
          if (duration < 0 || duration > 300) {
            validationErrors.push(`Exercise ${i + 1}: Duration must be 0-300 minutes`);
          }
        }
      });
    }
    
    // Validate symptoms
    if (req.body.symptoms && Array.isArray(req.body.symptoms)) {
      req.body.symptoms.forEach((sym, i) => {
        if (sym.severity !== undefined && sym.severity !== null) {
          const severity = parseInt(sym.severity);
          if (severity < 1 || severity > 10) {
            validationErrors.push(`Symptom ${i + 1}: Severity must be 1-10`);
          }
        }
      });
    }
    
    // Return validation errors if any
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed: ' + validationErrors.join('; '),
        validationErrors
      });
    }
    
    const {
      // Vitals
      weightKg,
      heartRateBpm,
      temperatureC,
      bloodPressure,
      bloodSugar,
      
      // Mood & Energy
      mood,
      moodLog,
      energyLevel,
      stressLevel,
      
      // Sleep
      sleep,
      
      // Symptoms
      symptoms,
      
      // Exercise
      exercises,
      
      // Nutrition
      foodIntake,
      hydration,
      caffeineIntakeMg,
      
      // Fetal Movement
      fetalMovement,
      kickCountSessions,
      
      // Contractions
      contractions,
      
      // Doctor Visit
      doctorVisit,
      
      // Notes
      notes,
      
      // Status
      isComplete
    } = req.body;
    
    // Update pregnancy week and trimester (ensure they're always current)
    log.pregnancyWeek = pregnancyWeek;
    log.trimester = trimester;
    
    // Update vitals
    if (weightKg !== undefined) log.weightKg = weightKg || null;
    if (heartRateBpm !== undefined) log.heartRateBpm = heartRateBpm || null;
    if (temperatureC !== undefined) log.temperatureC = temperatureC || null;
    if (bloodPressure !== undefined) log.bloodPressure = bloodPressure;
    if (bloodSugar !== undefined) {
      // Ensure measuredAt is null if it's a time string (not a valid Date)
      if (bloodSugar.measuredAt && typeof bloodSugar.measuredAt === 'string' && bloodSugar.measuredAt.includes(':')) {
        bloodSugar.measuredAt = null;
      }
      log.bloodSugar = bloodSugar;
    }
    
    // Update mood & energy
    if (mood !== undefined) log.mood = mood || null;
    if (moodLog !== undefined) {
      // Convert time strings to null for moodLog time field
      log.moodLog = (moodLog || []).map(entry => ({
        ...entry,
        time: (entry.time && typeof entry.time === 'string' && entry.time.includes(':')) 
          ? null 
          : entry.time
      }));
    }
    if (energyLevel !== undefined) log.energyLevel = energyLevel || null;
    if (stressLevel !== undefined) log.stressLevel = stressLevel || null;
    
    // Update sleep
    if (sleep !== undefined) {
      // Helper function to convert time string to Date object
      const parseTimeToDate = (timeString) => {
        if (!timeString) return null;
        if (timeString instanceof Date) return timeString;
        
        // If it's a time string like "22:51", convert to today's date with that time
        if (typeof timeString === 'string' && timeString.match(/^\d{1,2}:\d{2}$/)) {
          const [hours, minutes] = timeString.split(':');
          const date = new Date();
          date.setHours(parseInt(hours, 10));
          date.setMinutes(parseInt(minutes, 10));
          date.setSeconds(0);
          date.setMilliseconds(0);
          return date;
        }
        
        // Try to parse as ISO date string
        const parsed = new Date(timeString);
        return isNaN(parsed.getTime()) ? null : parsed;
      };
      
      log.sleep = {
        bedTime: parseTimeToDate(sleep.bedTime),
        wakeTime: parseTimeToDate(sleep.wakeTime),
        totalHours: sleep.totalHours || null,
        quality: sleep.quality || null,
        timesAwakened: sleep.timesAwakened || 0,
        awakeningReasons: sleep.awakeningReasons || [],
        primaryPosition: sleep.primaryPosition || null,
        usedPregnancyPillow: sleep.usedPregnancyPillow || null,
        naps: sleep.naps || [],
        notes: sleep.notes || null
      };
      // Also update legacy field
      if (sleep.totalHours) log.hoursSleept = sleep.totalHours;
    }
    
    // Update symptoms
    if (symptoms !== undefined) {
      // Convert time strings to null for occurredAt field
      log.symptoms = (symptoms || []).map(symptom => ({
        ...symptom,
        occurredAt: (symptom.occurredAt && typeof symptom.occurredAt === 'string' && symptom.occurredAt.includes(':')) 
          ? null 
          : symptom.occurredAt
      }));
    }
    
    // Update exercises
    if (exercises !== undefined) {
      // Convert time strings to null for exercise time field
      log.exercises = (exercises || []).map(exercise => ({
        ...exercise,
        time: (exercise.time && typeof exercise.time === 'string' && exercise.time.includes(':')) 
          ? null 
          : exercise.time
      }));
    }
    
    // Update nutrition
    if (foodIntake !== undefined) {
      // Convert time strings to null for foodIntake (meals) time field
      log.foodIntake = (foodIntake || []).map(meal => ({
        ...meal,
        time: (meal.time && typeof meal.time === 'string' && meal.time.includes(':')) 
          ? null 
          : meal.time
      }));
    }
    if (hydration !== undefined) {
      // Convert time strings to null for drinks time field
      if (hydration.drinks) {
        hydration.drinks = hydration.drinks.map(drink => ({
          ...drink,
          time: (drink.time && typeof drink.time === 'string' && drink.time.includes(':')) 
            ? null 
            : drink.time
        }));
      }
      log.hydration = hydration;
    }
    if (caffeineIntakeMg !== undefined) log.caffeineIntakeMg = caffeineIntakeMg || null;
    
    // Update fetal movement
    if (fetalMovement !== undefined) {
      // Convert time strings to null for startTime and endTime
      if (fetalMovement.startTime && typeof fetalMovement.startTime === 'string' && fetalMovement.startTime.includes(':')) {
        fetalMovement.startTime = null;
      }
      if (fetalMovement.endTime && typeof fetalMovement.endTime === 'string' && fetalMovement.endTime.includes(':')) {
        fetalMovement.endTime = null;
      }
      log.fetalMovement = fetalMovement;
    }
    if (kickCountSessions !== undefined) log.kickCountSessions = kickCountSessions || [];
    
    // Update contractions
    if (contractions !== undefined) log.contractions = contractions || [];
    
    // Update doctor visit
    if (doctorVisit !== undefined) log.doctorVisit = doctorVisit;
    
    // Update notes
    if (notes !== undefined) log.notes = notes || null;
    
    // Update completion status
    if (isComplete !== undefined) log.isComplete = isComplete;
    
    // Save and recalculate sections
    console.log('Saving log with data...');
    await log.save();
    
    console.log('Log saved successfully! ID:', log._id);
    console.log('Updated fields:', {
      pregnancyWeek: log.pregnancyWeek,
      trimester: log.trimester,
      weightKg: log.weightKg,
      heartRateBpm: log.heartRateBpm,
      bloodPressure: log.bloodPressure,
      energyLevel: log.energyLevel,
      sleepHours: log.sleep?.totalHours,
      symptomsCount: log.symptoms?.length,
      exercisesCount: log.exercises?.length,
      mealsCount: log.foodIntake?.length
    });
    console.log('=== PREGNANCY WEEK SAVED:', log.pregnancyWeek, '===');
    
    res.json({ success: true, log, message: isComplete ? 'Log saved and marked complete' : 'Log saved' });
  } catch (err) {
    console.error('Save health log error:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ success: false, error: 'Failed to save health log' });
  }
});

// PUT /api/health-log/:id - Update specific health log (with same-day check)
router.put('/api/health-log/:id', requireAuth, async (req, res) => {
  try {
    const log = await HealthLog.findOne({ 
      _id: req.params.id, 
      userId: req.session.user.id,
      deletedAt: null
    });
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Health log not found' });
    }
    
    // SERVER-SIDE VALIDATION: Ensure log is from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = new Date(log.logDate);
    logDate.setHours(0, 0, 0, 0);
    
    if (logDate.getTime() !== today.getTime()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot edit health logs from previous days. You can only edit today\'s log.' 
      });
    }
    
    // Update fields from request body
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'userId' && key !== 'logDate') {
        log[key] = req.body[key];
      }
    });
    
    await log.save();
    
    res.json({ success: true, log });
  } catch (err) {
    console.error('Update health log error:', err);
    res.status(500).json({ success: false, error: 'Failed to update health log' });
  }
});

// GET /api/health-log/history/:days - Get recent health logs
router.get('/api/health-log/history/:days', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 7;
    const logs = await HealthLog.getRecent(req.session.user.id, days);
    
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Get health log history error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health log history' });
  }
});

// GET /api/health-log/week/:weekNumber - Get logs for specific pregnancy week
router.get('/api/health-log/week/:weekNumber', requireAuth, async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber);
    const logs = await HealthLog.getByPregnancyWeek(req.session.user.id, weekNumber);
    
    res.json({ success: true, logs });
  } catch (err) {
    console.error('Get health log by week error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health logs' });
  }
});

// GET /api/health-log/:date - Get health log for specific date
router.get('/api/health-log/:date', requireAuth, async (req, res) => {
  try {
    // Add validation to prevent matching non-date strings
    const dateStr = req.params.date;
    
    // Skip if it looks like another route
    if (dateStr === 'today' || dateStr === 'history' || dateStr === 'week') {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date' });
    }
    
    const log = await HealthLog.getByDate(req.session.user.id, date);
    
    res.json({ success: true, log });
  } catch (err) {
    console.error('Get health log by date error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health log' });
  }
});

// DELETE /api/health-log/:id - Soft delete health log
router.delete('/api/health-log/:id', requireAuth, async (req, res) => {
  try {
    const log = await HealthLog.findOne({ 
      _id: req.params.id, 
      userId: req.session.user.id,
      deletedAt: null
    });
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Health log not found' });
    }
    
    log.deletedAt = new Date();
    await log.save();
    
    res.json({ success: true, message: 'Health log deleted' });
  } catch (err) {
    console.error('Delete health log error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete health log' });
  }
});

// ==================== WEEKLY REPORT API ROUTES ====================

// Helper function to get week date range
function getWeekDateRange(weekOffset = 0) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + mondayOffset - (weekOffset * 7));
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { startDate: startOfWeek, endDate: endOfWeek };
}

// Helper function to aggregate health logs into weekly stats
async function aggregateWeeklyStats(userId, startDate, endDate, pregnancyWeek, trimester) {
  const logs = await HealthLog.find({
    userId,
    logDate: { $gte: startDate, $lte: endDate },
    deletedAt: null
  }).sort({ logDate: 1 });

  const daysLogged = logs.length;
  const totalDaysInWeek = 7;

  // Weight stats
  const weights = logs.map(l => l.weightKg).filter(w => w != null);
  const avgWeight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  const startWeight = weights.length ? weights[0] : null;
  const endWeight = weights.length ? weights[weights.length - 1] : null;
  const weightChange = (startWeight && endWeight) ? endWeight - startWeight : null;

  // Sleep stats
  const sleepHours = logs.map(l => l.sleep?.totalHours || l.hoursSleept).filter(s => s != null);
  const avgSleep = sleepHours.length ? sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length : null;
  const sleepQualities = logs.map(l => l.sleep?.quality).filter(q => q != null);
  const avgSleepQuality = sleepQualities.length ? sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length : null;

  // Energy stats
  const energyLevels = logs.map(l => l.energyLevel).filter(e => e != null);
  const avgEnergy = energyLevels.length ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length : null;

  // Stress stats
  const stressLevels = logs.map(l => l.stressLevel).filter(s => s != null);
  const avgStress = stressLevels.length ? stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length : null;

  // Mood frequency
  const moodFrequency = {};
  logs.forEach(l => {
    if (l.mood) {
      moodFrequency[l.mood] = (moodFrequency[l.mood] || 0) + 1;
    }
    if (l.moodLog?.length) {
      l.moodLog.forEach(m => {
        if (m.mood) {
          moodFrequency[m.mood] = (moodFrequency[m.mood] || 0) + 1;
        }
      });
    }
  });
  const dominantMood = Object.keys(moodFrequency).length 
    ? Object.entries(moodFrequency).sort((a, b) => b[1] - a[1])[0][0] 
    : null;

  // Symptom frequency
  const symptomFrequency = {};
  logs.forEach(l => {
    if (l.symptoms?.length) {
      l.symptoms.forEach(s => {
        if (!symptomFrequency[s.symptom]) {
          symptomFrequency[s.symptom] = { count: 0, totalSeverity: 0 };
        }
        symptomFrequency[s.symptom].count++;
        symptomFrequency[s.symptom].totalSeverity += s.severity || 5;
      });
    }
  });
  const topSymptoms = Object.entries(symptomFrequency)
    .map(([symptom, data]) => ({
      symptom,
      count: data.count,
      avgSeverity: data.totalSeverity / data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Exercise stats
  const totalExerciseMinutes = logs.reduce((sum, l) => sum + (l.totalExerciseMinutes || 0), 0);
  const exerciseDays = logs.filter(l => l.exercises?.length > 0).length;
  const exerciseTypes = {};
  logs.forEach(l => {
    if (l.exercises?.length) {
      l.exercises.forEach(e => {
        if (!exerciseTypes[e.type]) {
          exerciseTypes[e.type] = { count: 0, totalMinutes: 0 };
        }
        exerciseTypes[e.type].count++;
        exerciseTypes[e.type].totalMinutes += e.durationMinutes || 0;
      });
    }
  });

  // Hydration stats
  const waterIntakes = logs.map(l => l.hydration?.waterLiters || 0);
  const avgWater = waterIntakes.length ? waterIntakes.reduce((a, b) => a + b, 0) / waterIntakes.length : 0;
  const totalWater = waterIntakes.reduce((a, b) => a + b, 0);

  // Heart rate stats
  const heartRates = logs.map(l => l.heartRateBpm).filter(h => h != null);
  const avgHeartRate = heartRates.length ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : null;

  // Fetal movement (if applicable)
  const fetalMovements = logs.map(l => l.fetalMovement?.count).filter(f => f != null);
  const avgFetalMovement = fetalMovements.length ? fetalMovements.reduce((a, b) => a + b, 0) / fetalMovements.length : null;

  // Doctor visits this week
  const doctorVisits = logs.filter(l => l.doctorVisit?.visited).length;

  // Determine overall status
  let overallStatus = 'Stable';
  let concernSeverity = 'none';
  const concerns = [];
  const positives = [];

  // Check for concerning symptoms
  const concerningSymptoms = ['bleeding', 'spotting', 'decreased_fetal_movement', 'contractions', 'fainting'];
  topSymptoms.forEach(s => {
    if (concerningSymptoms.includes(s.symptom)) {
      concerns.push(`Reported ${s.symptom} ${s.count} time(s)`);
      concernSeverity = 'moderate';
    }
    if (s.avgSeverity >= 7) {
      concerns.push(`High severity ${s.symptom} (avg ${s.avgSeverity.toFixed(1)})`);
      concernSeverity = concernSeverity === 'none' ? 'low' : concernSeverity;
    }
  });

  // Check sleep
  if (avgSleep && avgSleep < 6) {
    concerns.push('Low average sleep hours');
    concernSeverity = concernSeverity === 'none' ? 'low' : concernSeverity;
  } else if (avgSleep && avgSleep >= 7) {
    positives.push('Good sleep habits');
  }

  // Check hydration
  if (avgWater >= 2) {
    positives.push('Good hydration');
  } else if (avgWater < 1.5 && avgWater > 0) {
    concerns.push('Low water intake');
  }

  // Check exercise
  if (totalExerciseMinutes >= 150) {
    positives.push('Meeting exercise goals');
    overallStatus = 'Good';
  } else if (exerciseDays >= 3) {
    positives.push('Regular exercise routine');
  }

  // Check logging consistency
  const logCompletionRate = (daysLogged / totalDaysInWeek) * 100;
  if (logCompletionRate >= 80) {
    positives.push('Excellent logging consistency');
    if (overallStatus === 'Stable' && concerns.length === 0) overallStatus = 'Good';
  } else if (logCompletionRate >= 50) {
    positives.push('Good logging consistency');
  }

  if (concerns.length === 0 && positives.length >= 3) {
    overallStatus = 'Excellent';
  } else if (concernSeverity === 'moderate' || concernSeverity === 'high') {
    overallStatus = 'Needs Attention';
  }

  return {
    summary: {
      overallStatus,
      statusScore: overallStatus === 'Excellent' ? 9 : overallStatus === 'Good' ? 7 : overallStatus === 'Stable' ? 5 : 3,
      keySymptoms: topSymptoms.map(s => s.symptom),
      startWeightKg: startWeight,
      endWeightKg: endWeight,
      weightChangeKg: weightChange,
      avgEnergyLevel: avgEnergy ? Math.round(avgEnergy * 10) / 10 : null,
      avgMood: dominantMood,
      concernsDetected: concerns,
      concernSeverity,
      positiveHighlights: positives,
      logCompletionRate: Math.round(logCompletionRate),
      daysLogged
    },
    vitalsSummary: {
      avgWeightKg: avgWeight ? Math.round(avgWeight * 10) / 10 : null,
      avgHeartRateBpm: avgHeartRate ? Math.round(avgHeartRate) : null,
      avgFetalMovementCount: avgFetalMovement ? Math.round(avgFetalMovement) : null
    },
    activities: {
      totalExerciseMinutes,
      exerciseDaysCount: exerciseDays,
      exercisesByType: Object.entries(exerciseTypes).map(([type, data]) => ({
        type,
        totalMinutes: data.totalMinutes,
        sessionsCount: data.count
      })),
      exerciseGoalMet: totalExerciseMinutes >= 150,
      avgSleepHours: avgSleep ? Math.round(avgSleep * 10) / 10 : null,
      avgSleepQuality: avgSleepQuality ? Math.round(avgSleepQuality * 10) / 10 : null,
      avgWaterIntakeLiters: Math.round(avgWater * 10) / 10,
      totalWaterIntakeLiters: Math.round(totalWater * 10) / 10,
      hydrationGoalMet: avgWater >= 2
    },
    moodFrequency,
    symptomDetails: topSymptoms,
    dailyData: logs.map(l => ({
      date: l.logDate,
      weight: l.weightKg,
      sleep: l.sleep?.totalHours || l.hoursSleept,
      energy: l.energyLevel,
      mood: l.mood,
      water: l.hydration?.waterLiters || 0,
      exerciseMinutes: l.totalExerciseMinutes || 0,
      symptomCount: l.symptoms?.length || 0
    })),
    pregnancyWeek,
    trimester,
    healthLogIds: logs.map(l => l._id)
  };
}

// GET /api/weekly-report/current - Get current week's report
router.get('/api/weekly-report/current', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const pregnancyWeek = user?.currentPregnancyWeek?.weeks || null;
    const trimester = user?.currentTrimester || null;
    
    const { startDate, endDate } = getWeekDateRange(0);
    
    const stats = await aggregateWeeklyStats(
      req.session.user.id, 
      startDate, 
      endDate, 
      pregnancyWeek, 
      trimester
    );
    
    res.json({
      success: true,
      report: {
        weekNumber: pregnancyWeek,
        trimester,
        startDate,
        endDate,
        ...stats
      },
      userContext: {
        firstName: user?.firstName,
        pregnancyWeek,
        trimester,
        dueDate: user?.pregnancyProfile?.dueDate
      }
    });
  } catch (err) {
    console.error('Get current weekly report error:', err);
    res.status(500).json({ success: false, error: 'Failed to get weekly report' });
  }
});

// GET /api/weekly-report/week/:offset - Get report for specific week (0 = current, 1 = last week, etc.)
router.get('/api/weekly-report/week/:offset', requireAuth, async (req, res) => {
  try {
    const offset = parseInt(req.params.offset) || 0;
    
    const { startDate, endDate } = getWeekDateRange(offset);
    
    const report = await WeeklyReport.findOne({
      userId: req.session.user.id,
      startDate: { $gte: startDate, $lte: startDate },
      endDate: { $gte: endDate, $lte: endDate },
      deletedAt: null,
      status: 'complete'
    });
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No completed weekly report found for the requested week (offset: ${offset})',
        error: 'Weekly reports are generated at the end of each week on Sunday.'
      });
    }
    
    res.json({
      success: true,
      report
    });
  } catch (err) {
    console.error('Get weekly report error:', err);
    res.status(500).json({ success: false, error: 'Failed to get weekly report' });
  }
});

// GET /api/weekly-report/history - Get summary of past weeks
router.get('/api/weekly-report/history', requireAuth, async (req, res) => {
  try {
    const weeksToFetch = parseInt(req.query.weeks) || 4;
    const user = await User.findById(req.session.user.id);
    const currentPregnancyWeek = user?.currentPregnancyWeek?.weeks || null;
    
    const reports = [];
    
    for (let i = 0; i < weeksToFetch; i++) {
      const { startDate, endDate } = getWeekDateRange(i);
      
      // Quick count of logs for this week
      const logCount = await HealthLog.countDocuments({
        userId: req.session.user.id,
        logDate: { $gte: startDate, $lte: endDate },
        deletedAt: null
      });
      
      let pregnancyWeek = currentPregnancyWeek;
      if (pregnancyWeek && i > 0) {
        pregnancyWeek = Math.max(1, pregnancyWeek - i);
      }
      
      reports.push({
        weekOffset: i,
        weekLabel: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i} weeks ago`,
        startDate,
        endDate,
        pregnancyWeek,
        daysLogged: logCount,
        hasData: logCount > 0
      });
    }
    
    res.json({ success: true, reports });
  } catch (err) {
    console.error('Get weekly report history error:', err);
    res.status(500).json({ success: false, error: 'Failed to get report history' });
  }
});

// GET /api/weekly-report/trends - Get trends across multiple weeks
router.get('/api/weekly-report/trends', requireAuth, async (req, res) => {
  try {
    const weeksToAnalyze = parseInt(req.query.weeks) || 2;
    
    // Fetch completed weekly reports, sorted by week number descending, limit to requested weeks
    const reports = await WeeklyReport.find({
      userId: req.session.user.id,
      deletedAt: null,
      status: 'complete'
    })
    .sort({ weekNumber: -1 })
    .limit(weeksToAnalyze);
    
    if (!reports || reports.length === 0) {
      return res.json({ 
        success: true, 
        trends: [],
        count: 0,
        message: 'No completed weekly reports found. Reports are generated automatically every Sunday.'
      });
    }
    
    res.json({ 
      success: true, 
      trends: reports.reverse(), // Reverse to show oldest to newest
      count: reports.length
    });
  } catch (err) {
    console.error('Get trends error:', err);
    res.status(500).json({ success: false, error: 'Failed to get trends' });
  }
});

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
router.get('/api/nearby-healthcare', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        success: false, 
        error: 'Latitude and longitude are required' 
      });
    }

    // Geoapify Places API - searching for healthcare facilities
    // Categories: healthcare.hospital, healthcare.clinic, healthcare.doctor, etc.
    const categories = 'healthcare.hospital,healthcare.clinic_or_praxis,healthcare.dentist,healthcare.pharmacy';
    const radiusKm = Math.min(parseFloat(req.query.radius) || 200, 200);
    const radius = radiusKm * 1000; // Convert to meters
    const limit = 50; // Increased limit for larger search area

    const url = `https://api.geoapify.com/v2/places?` +
      `categories=${categories}` +
      `&filter=circle:${lon},${lat},${radius}` +
      `&bias=proximity:${lon},${lat}` +
      `&limit=${limit}` +
      `&apiKey=${GEOAPIFY_API_KEY}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Return the results
    res.json({
      success: true,
      places: data.features || [],
      count: data.features?.length || 0
    });

  } catch (error) {
    console.error('Error fetching nearby healthcare:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch nearby healthcare providers',
      details: error.message
    });
  }
});

// ==================== TEST ROUTE - Generate Weekly Report ====================
// POST /test/generate-weekly-report - Manually trigger weekly report generation
router.get('/test/generate-weekly-report', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[TEST] Manually generating weekly report for user: ${userId}`);
    
    const report = await generateWeeklyReportForUser(userId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No health logs found for this week. Cannot generate report.'
      });
    }
    
    res.json({
      success: true,
      message: 'Weekly report generated successfully!',
      report: {
        _id: report._id,
        weekNumber: report.weekNumber,
        trimester: report.trimester,
        startDate: report.startDate,
        endDate: report.endDate,
        status: report.status,
        daysLogged: report.summary?.daysLogged,
        avgWeight: report.vitalsSummary?.avgWeightKg,
        avgSleep: report.activities?.avgSleepHours,
        totalExercise: report.activities?.totalExerciseMinutes
      }
    });
  } catch (error) {
    console.error('[TEST] Error generating weekly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate weekly report',
      error: error.message
    });
  }
});

module.exports = router;