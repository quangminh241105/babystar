const cron = require('node-cron');
const { generateWeeklyReportsForAllUsers } = require('../services/weeklyReportService');

/**
 * Initialize the weekly report scheduler
 * Runs every Sunday at 23:59
 */
function initializeWeeklyReportScheduler() {
	// Cron: minute hour dayOfMonth month dayOfWeek
	// '59 23 * * 0' = At 23:59 on Sunday
	cron.schedule('59 23 * * 0', async () => {
		console.log('Weekly Report Scheduler triggered at:', new Date().toISOString());
		
		try {
			const results = await generateWeeklyReportsForAllUsers();
			console.log(`Results - Success: ${results.success.length}, Failed: ${results.failed.length}`);
		} catch (error) {
			console.error('Weekly report scheduler error:', error);
		}
	}, {
		scheduled: true,
		timezone: 'Asia/Ho_Chi_Minh'
	});

	console.log('Weekly report scheduler initialized - runs every Sunday at 23:59');
}

module.exports = {
	initializeWeeklyReportScheduler
};
