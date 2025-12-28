const express = require('express');
const router = express.Router();
const HealthLog = require('../models/healthlogs');

// Get user's current streak
router.get('/getStreak', async (req, res) => {
    try {
        // Check for user session - handle both req.session.userId and req.session.user.id
        const userId = req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        console.log('Fetching streak for userId:', userId);
        
        // Get all health logs sorted by date descending
        const logs = await HealthLog.find({ userId })
            .sort({ logDate: -1 })
            .select('logDate');

        console.log(`Found ${logs.length} health logs`);

        if (logs.length === 0) {
            return res.json({ currentStreak: 0, showPopup: false, loggedToday: false });
        }

        // Get unique dates only
        const uniqueDates = [...new Set(logs.map(log => {
            const d = new Date(log.logDate);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }))].sort((a, b) => b - a);

        console.log('Unique dates count:', uniqueDates.length);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        // Check if user logged today
        const loggedToday = uniqueDates.includes(todayTimestamp);
        console.log('Logged today:', loggedToday);

        // Calculate streak
        let currentStreak = 0;
        let checkDate = new Date(today);
    
        for (let i = 0; i < uniqueDates.length; i++) {
            const expectedTimestamp = checkDate.getTime();
            
            if (uniqueDates[i] === expectedTimestamp) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        console.log('Current streak:', currentStreak);

        // Check for streak loss
        let streakLost = false;
        let lastStreakCount = 0;
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTimestamp = yesterday.getTime();
        
        // If user didn't log today or yesterday, but has logs before that, streak was lost
        if (!loggedToday && uniqueDates.length > 0) {
            const mostRecentLog = uniqueDates[0];
            
            // Check if the most recent log is older than yesterday
            if (mostRecentLog < yesterdayTimestamp) {
                // Calculate what the streak was before it broke
                let tempCheckDate = new Date(mostRecentLog);
                lastStreakCount = 0;
                
                for (let i = 0; i < uniqueDates.length; i++) {
                    const expectedTimestamp = tempCheckDate.getTime();
                    
                    if (uniqueDates[i] === expectedTimestamp) {
                        lastStreakCount++;
                        tempCheckDate.setDate(tempCheckDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
                
                // Only show streak lost if there was actually a streak (2+ days)
                const lastLossPopupShown = req.session.lastStreakLossPopup || 0;
                const lastLogDate = mostRecentLog;
                
                // Show popup once per streak loss (when lastLossPopupShown is before the last log date)
                streakLost = lastStreakCount >= 2 && lastLossPopupShown < lastLogDate;
                
                if (streakLost) {
                    req.session.lastStreakLossPopup = todayTimestamp;
                    await req.session.save();
                    console.log('Streak lost detected. Last streak was:', lastStreakCount);
                }
            }
        }

        // Check if we should show popup
        const lastPopupShown = req.session.lastStreakPopup || 0;
        console.log('Last popup shown timestamp:', lastPopupShown);
        console.log('Today timestamp:', todayTimestamp);
        
        const showPopup = loggedToday && lastPopupShown < todayTimestamp && currentStreak > 2;
        console.log('Show popup:', showPopup);

        if (showPopup) {
            req.session.lastStreakPopup = todayTimestamp;
            await req.session.save(); // Ensure session is saved
            console.log('Updated lastStreakPopup in session');
        }

        res.json({ 
            currentStreak, 
            showPopup,
            loggedToday,
            streakLost,
            lastStreakCount
        });
    } catch (error) {
        console.error('Error calculating streak:', error);
        res.status(500).json({ error: 'Failed to calculate streak', details: error.message });
    }
});

module.exports = router;
