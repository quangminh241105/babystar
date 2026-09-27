const cron = require('node-cron');
const User = require('../models/user');
const HealthLog = require('../models/healthlogs');
const { Notification } = require('../models/notification');

// Store io instance for socket emissions
let socketIO = null;

/**
 * Emit real-time notification via Socket.IO
 */
function emitNotification(userId, notification) {
	if (socketIO) {
		socketIO.to(`user:${userId}`).emit('notification', {
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
			socketIO.to(`user:${userId}`).emit('notification', {
				type: 'count',
				count
			});
		}).catch(err => console.error('Failed to emit count:', err));
	}
}

/**
 * Check if user has an active streak (logged yesterday or has consecutive days)
 * @param {string} userId - User ID
 * @returns {Promise<{hasStreak: boolean, streakCount: number, loggedToday: boolean}>}
 */
async function checkUserStreak(userId) {
	const logs = await HealthLog.find({ userId, deletedAt: null })
		.sort({ logDate: -1 })
		.select('logDate')
		.lean();

	if (logs.length === 0) {
		return { hasStreak: false, streakCount: 0, loggedToday: false };
	}

	// Get unique dates
	const uniqueDates = [...new Set(logs.map(log => {
		const d = new Date(log.logDate);
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}))].sort((a, b) => b - a);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayTimestamp = today.getTime();

	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayTimestamp = yesterday.getTime();

	const loggedToday = uniqueDates.includes(todayTimestamp);
	const loggedYesterday = uniqueDates.includes(yesterdayTimestamp);

	// Calculate current streak
	let streakCount = 0;
	let checkDate = new Date(today);

	// If not logged today, check from yesterday
	if (!loggedToday && loggedYesterday) {
		checkDate = new Date(yesterday);
	}

	for (let i = 0; i < uniqueDates.length; i++) {
		const expectedTimestamp = checkDate.getTime();
		if (uniqueDates[i] === expectedTimestamp) {
			streakCount++;
			checkDate.setDate(checkDate.getDate() - 1);
		} else {
			break;
		}
	}

	// User has an active streak if they logged yesterday (streak at risk) or have a streak > 0
	const hasStreak = loggedYesterday && streakCount > 0;

	return { hasStreak, streakCount, loggedToday };
}

/**
 * Send streak reminder notifications to users who haven't logged today
 * but have an active streak at risk
 */
async function sendStreakReminders() {
	console.log('🔔 Streak Reminder Job started at:', new Date().toISOString());

	try {
		// Find all active users with daily reminders enabled
		const users = await User.find({
			isActive: true,
			deletedAt: null,
			'notificationPreferences.dailyReminders': true
		}).select('_id firstName email').lean();

		console.log(`Found ${users.length} users with daily reminders enabled`);

		let sentCount = 0;
		let skippedCount = 0;

		for (const user of users) {
			try {
				const { hasStreak, streakCount, loggedToday } = await checkUserStreak(user._id);

				// Skip if user already logged today or has no streak at risk
				if (loggedToday || !hasStreak) {
					skippedCount++;
					continue;
				}

				// Check if we already sent a streak reminder today
				const todayStart = new Date();
				todayStart.setHours(0, 0, 0, 0);

				const existingReminder = await Notification.findOne({
					userId: user._id,
					type: 'daily_log_reminder',
					createdAt: { $gte: todayStart },
					'metadata.reminderType': 'streak_protection'
				});

				if (existingReminder) {
					skippedCount++;
					continue;
				}

				// Create streak reminder notification
				const streakEmoji = streakCount >= 7 ? '🔥' : streakCount >= 3 ? '✨' : '⚡';
				const notification = await Notification.create({
					userId: user._id,
					title: `${streakEmoji} Don't lose your ${streakCount}-day streak!`,
					message: `You haven't logged your health today. Log now to keep your ${streakCount}-day streak alive!`,
					type: 'daily_log_reminder',
					category: 'health',
					priority: 'high',
					actionUrl: '/log-health',
					actionLabel: 'Log Now',
					metadata: {
						reminderType: 'streak_protection',
						streakCount
					},
					createdBy: { type: 'system' }
				});

				// Emit real-time notification
				emitNotification(user._id.toString(), notification);
				sentCount++;

			} catch (err) {
				console.error(`Error processing streak reminder for user ${user._id}:`, err.message);
			}
		}

		console.log(`✅ Streak reminders sent: ${sentCount}, skipped: ${skippedCount}`);

	} catch (error) {
		console.error('❌ Streak reminder job error:', error);
	}
}

/**
 * Initialize the streak reminder scheduler
 * Runs daily at 6:00 PM (18:00)
 * @param {Object} io - Socket.IO instance
 */
function initializeStreakReminderScheduler(io) {
	if (io) {
		socketIO = io;
	}

	// Cron: minute hour dayOfMonth month dayOfWeek
	// '0 18 * * *' = At 18:00 (6:00 PM) every day
	cron.schedule('0 18 * * *', async () => {
		await sendStreakReminders();
	}, {
		scheduled: true,
		timezone: 'Asia/Ho_Chi_Minh'
	});

	console.log('🔔 Streak reminder scheduler initialized - runs daily at 6:00 PM');
}

module.exports = {
	initializeStreakReminderScheduler,
	sendStreakReminders, // Export for manual testing
	checkUserStreak
};
