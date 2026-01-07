const cron = require('node-cron');
const { generateWeeklyReportsForAllUsers } = require('../services/weeklyReportService');

// Store io instance for socket emissions
let socketIO = null;

/**
 * Initialize the weekly report scheduler
 * Runs every Sunday at 23:59
 * @param {Object} io - Socket.IO instance (optional)
 */
function initializeWeeklyReportScheduler(io) {
	if (io) {
		socketIO = io;
	}
	
	// Cron: minute hour dayOfMonth month dayOfWeek
	// '59 23 * * 0' = At 23:59 on Sunday
	cron.schedule('59 23 * * 0', async () => {
		console.log('Weekly Report Scheduler triggered at:', new Date().toISOString());
		
		try {
			const results = await generateWeeklyReportsForAllUsers();
			console.log(`Results - Success: ${results.success.length}, Failed: ${results.failed.length}`);
			
			// Emit real-time updates for successful report generations
			if (socketIO && results.success.length > 0) {
				results.success.forEach(({ userId }) => {
					socketIO.to(`user:${userId}`).emit('reportUpdate', {
						type: 'new-report',
						userId: userId.toString()
					});
				});
				console.log(`Sent real-time updates to ${results.success.length} users`);
			}
		} catch (error) {
			console.error('Weekly report scheduler error:', error);
		}
	}, {
		scheduled: true,
		timezone: 'UTC'
	});

	console.log('Weekly report scheduler initialized - runs every Sunday at 23:59 UTC');
}

module.exports = {
	initializeWeeklyReportScheduler
};
