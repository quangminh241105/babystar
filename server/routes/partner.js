const express = require('express');
const router = express.Router();
const User = require('../models/user');
const HealthLog = require('../models/healthlogs');

// Placeholder route(s) for "parner" area
router.get('/', (req, res) => {
  res.redirect('/link-account');
});

router.get('/weekly-report', async (req, res) => {
  const partnerId = req.query.partnerId;
  
  try {
    const partner = await User.findById(partnerId);
    
    res.render('pages/partner-weekly-report', {
      title: 'Weekly Report',
      partnerId: partnerId,
      partner: partner
    });
  } catch (error) {
    console.error('Error loading weekly report:', error);
    res.redirect('/link-account');
  }
});

router.get('/weekly-advice', async (req, res) => {
  const partnerId = req.query.partnerId;
  
  try {
    const partner = await User.findById(partnerId);
    
    res.render('pages/partner-weekly-advice', {
      title: 'Weekly Advice',
      partnerId: partnerId,
      partner: partner
    });
  } catch (error) {
    console.error('Error loading weekly advice:', error);
    res.redirect('/link-account');
  }
});

router.get('/diet-plan', async (req, res) => {
  res.render('pages/dietplanner', { title: 'Diet Planner', isPartnerView: true });
});

router.get('/exercise-plan', async (req, res) => {
  res.render('pages/exerciseplanner', { title: 'Exercise Planner' });
});

router.get('/past-health-records', async (req, res) => {
  const partnerId = req.query.partnerId;
  
  try {
      if (!partnerId || partnerId.trim() === '') {
        return res.redirect('/link-account');
      }
      const logs = await HealthLog.getAllLogs(partnerId);
      res.render('pages/past-health-log', { title: 'Past Health Records', logs, canDelete: false });
    } catch (err) {
      console.error('Error loading past health records:', err);
      res.redirect('/link-account');
    }
});

// Route for viewing partner progress 
router.get('/:id', async (req, res) => {
  const partnerId = req.params.id;
  
  try {
    const partner = await User.findById(partnerId);

    // Get pregnancy week and days until due date
    const pregnancyWeek = partner?.currentPregnancyWeek;
    const daysUntilDueDate = partner?.daysUntilDueDate;

    // Render the partner progress home page with the partner ID
    res.render('pages/partner-progress-home', {
      title: 'Partner Progress',
      partnerId: partnerId,
      partner: partner,
      pregnancyWeek: pregnancyWeek,
      daysUntilDueDate: daysUntilDueDate
    });
  } catch (error) {
    console.error('Error loading partner progress:', error);
    res.render('pages/partner-progress-home', {
      title: 'Partner Progress',
      partnerId: null,
      pregnancyWeek: null,
      daysUntilDueDate: null
    });
  }
});



module.exports = router;
