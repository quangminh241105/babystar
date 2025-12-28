const mongoose = require('mongoose');
const WeeklyReport = require('../models/weeklyreports');
const HealthLog = require('../models/healthlogs');
const User = require('../models/user');
const { NutritionSuggestionService } = require('../personalized_suggestion');
const { ExerciseSuggestionService } = require('../personalized_suggestion/exerciseIndex');

/**
 * Calculate the start and end dates for the current week (Monday to Sunday)
 */
function getWeekDateRange(date = new Date()) {
	const current = new Date(date);
	const dayOfWeek = current.getDay();
	
	// Calculate Monday (start of week)
	const monday = new Date(current);
	const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	monday.setDate(current.getDate() - daysToMonday);
	monday.setHours(0, 0, 0, 0);
	
	// Calculate Sunday (end of week)
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	sunday.setHours(23, 59, 59, 999);
	
	return { startDate: monday, endDate: sunday };
}

/**
 * Calculate pregnancy week from due date
 * @param {Date} dueDate - The expected due date
 * @returns {number|null} - Pregnancy week (1-42) or null if invalid
 */
function calculatePregnancyWeek(dueDate) {
	if (!dueDate) return null;
	
	const today = new Date();
	const due = new Date(dueDate);
	const gestationalDays = 280 - Math.ceil((due - today) / (1000 * 60 * 60 * 24));
	return Math.min(42, Math.max(1, Math.ceil(gestationalDays / 7)));
}

/**
 * Calculate trimester from pregnancy week
 */
function getTrimester(weekNumber) {
	if (!weekNumber) return null;
	if (weekNumber <= 12) return 1;
	if (weekNumber <= 27) return 2;
	return 3;
}

/**
 * Calculate summary from health logs
 */
function calculateSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {
			overallStatus: 'Stable',
			statusScore: 5,
			daysLogged: 0,
			logCompletionRate: 0
		};
	}

	const daysLogged = healthLogs.length;
	const logCompletionRate = Math.round((daysLogged / 7) * 100);

	// Collect all symptoms
	const keySymptoms = [];
	const symptomCounts = {};
	healthLogs.forEach(log => {
		log.symptoms?.forEach(s => {
			symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1;
			// Add symptom if not already in list
			if (!keySymptoms.includes(s.symptom)) {
				keySymptoms.push(s.symptom);
			}
		});
	});

	// Weight tracking
	const weights = healthLogs.map(l => l.weightKg).filter(w => w != null);
	const startWeightKg = weights.length > 0 ? weights[0] : null;
	const endWeightKg = weights.length > 0 ? weights[weights.length - 1] : null;
	const weightChangeKg = startWeightKg && endWeightKg ? endWeightKg - startWeightKg : null;

	// Determine weight change status
	let weightChangeStatus = 'on_target';
	if (weightChangeKg !== null) {
		if (weightChangeKg > 1) weightChangeStatus = 'above_target';
		else if (weightChangeKg < -0.5) weightChangeStatus = 'below_target';
		else if (weightChangeKg < -1) weightChangeStatus = 'concerning';
	}

	// Energy level average
	const energyLevels = healthLogs.map(l => l.energyLevel).filter(e => e != null);
	const avgEnergyLevel = energyLevels.length > 0 
		? Math.round(energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length) 
		: null;

	// Mood analysis
	const moods = healthLogs.map(l => l.mood).filter(m => m != null);
	const moodCounts = {};
	moods.forEach(m => { moodCounts[m] = (moodCounts[m] || 0) + 1; });
	const avgMood = Object.keys(moodCounts).length > 0 
		? Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0] 
		: 'neutral';

	// Detect concerns
	const concernsDetected = [];
	const concerningSymptoms = ['bleeding', 'spotting', 'decreased_fetal_movement', 'contractions', 'fainting', 'severe_headache'];
	healthLogs.forEach(log => {
		log.symptoms?.forEach(s => {
			if (concerningSymptoms.includes(s.symptom) || s.severity >= 8) {
				const concern = `${s.symptom} (severity: ${s.severity})`;
				if (!concernsDetected.includes(concern)) {
					concernsDetected.push(concern);
				}
			}
		});
	});

	// Determine concern severity
	let concernSeverity = 'none';
	const hasHighSeverity = healthLogs.some(log => 
		log.symptoms?.some(s => s.severity >= 8 || concerningSymptoms.includes(s.symptom))
	);
	const hasModerateSeverity = healthLogs.some(log => 
		log.symptoms?.some(s => s.severity >= 6)
	);
	
	if (hasHighSeverity) concernSeverity = 'high';
	else if (hasModerateSeverity) concernSeverity = 'moderate';
	else if (concernsDetected.length > 0) concernSeverity = 'low';

	// Positive highlights
	const positiveHighlights = [];
	if (avgEnergyLevel >= 4) positiveHighlights.push('High energy levels maintained');
	if (avgMood === 'happy' || avgMood === 'very_happy') positiveHighlights.push('Positive mood throughout the week');
	if (logCompletionRate >= 80) positiveHighlights.push('Excellent logging consistency');

	// Calculate overall status
	let overallStatus = 'Stable';
	let statusScore = 5;
	
	if (concernSeverity === 'high') {
		overallStatus = 'Needs Attention';
		statusScore = 3;
	} else if (concernSeverity === 'moderate') {
		overallStatus = 'Stable';
		statusScore = 5;
	} else if (avgEnergyLevel >= 4 && (avgMood === 'happy' || avgMood === 'very_happy')) {
		overallStatus = 'Excellent';
		statusScore = 9;
	} else if (avgEnergyLevel >= 3) {
		overallStatus = 'Good';
		statusScore = 7;
	}

	return {
		overallStatus,
		statusScore,
		keySymptoms: keySymptoms.slice(0, 10),
		startWeightKg,
		endWeightKg,
		weightChangeKg,
		weightChangeStatus,
		avgEnergyLevel,
		avgMood,
		moodPattern: moods.length >= 3 ? 'Stable' : null, // Schema expects specific patterns or null
		concernsDetected,
		concernSeverity,
		positiveHighlights,
		logCompletionRate,
		daysLogged
	};
}

/**
 * Calculate vitals summary from health logs
 */
function calculateVitalsSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {};
	}

	// Blood pressure (if available from symptoms or notes - simplified)
	const weights = healthLogs.map(l => l.weightKg).filter(w => w != null);
	const heartRates = healthLogs.map(l => l.heartRateBpm).filter(h => h != null);
	const temperatures = healthLogs.map(l => l.temperatureC).filter(t => t != null);

	// Fetal movement
	const fetalMovements = healthLogs
		.map(l => l.fetalMovement?.count || 0)
		.filter(c => c > 0);
	const totalFetalMovements = fetalMovements.reduce((a, b) => a + b, 0);
	const avgFetalMovementCount = fetalMovements.length > 0 
		? Math.round(totalFetalMovements / fetalMovements.length) 
		: null;

	return {
		avgWeightKg: weights.length > 0 
			? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10 
			: null,
		avgHeartRateBpm: heartRates.length > 0 
			? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) 
			: null,
		maxHeartRateBpm: heartRates.length > 0 ? Math.max(...heartRates) : null,
		minHeartRateBpm: heartRates.length > 0 ? Math.min(...heartRates) : null,
		avgTemperatureC: temperatures.length > 0 
			? Math.round((temperatures.reduce((a, b) => a + b, 0) / temperatures.length) * 10) / 10 
			: null,
		avgFetalMovementCount,
		totalFetalMovements,
		fetalMovementTrend: fetalMovements.length >= 3 ? 'stable' : 'insufficient_data',
		bloodPressureStatus: 'normal'
	};
}

/**
 * Calculate activities summary from health logs
 */
function calculateActivitiesSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {
			totalExerciseMinutes: 0,
			exerciseDaysCount: 0,
			exerciseGoalMet: false,
			recommendedMinutes: 150
		};
	}

	// Exercise summary
	let totalExerciseMinutes = 0;
	let exerciseDaysCount = 0;
	const exerciseTypes = {};

	healthLogs.forEach(log => {
		if (log.exercises?.length > 0) {
			exerciseDaysCount++;
			log.exercises.forEach(ex => {
				totalExerciseMinutes += ex.durationMinutes || 0;
				exerciseTypes[ex.type] = (exerciseTypes[ex.type] || 0) + (ex.durationMinutes || 0);
			});
		}
	});

	const mostCommonExercise = Object.keys(exerciseTypes).length > 0 
		? Object.entries(exerciseTypes).sort((a, b) => b[1] - a[1])[0][0] 
		: null;

	const exercisesByType = Object.entries(exerciseTypes).map(([type, minutes]) => ({
		type,
		totalMinutes: minutes,
		sessionsCount: healthLogs.filter(l => l.exercises?.some(e => e.type === type)).length
	}));

	// Sleep summary
	const sleepHours = healthLogs
		.map(l => l.sleep?.totalHours || l.hoursSleept)
		.filter(h => h != null);
	const avgSleepHours = sleepHours.length > 0 
		? Math.round((sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length) * 10) / 10 
		: null;
	const totalSleepHours = sleepHours.reduce((a, b) => a + b, 0);

	const sleepQualities = healthLogs
		.map(l => l.sleep?.quality)
		.filter(q => q != null);
	const avgSleepQuality = sleepQualities.length > 0 
		? Math.round((sleepQualities.reduce((a, b) => a + b, 0) / sleepQualities.length) * 10) / 10 
		: null;

	// Hydration summary
	const waterIntakes = healthLogs
		.map(l => l.hydration?.waterLiters || 0)
		.filter(w => w > 0);
	const avgWaterIntakeLiters = waterIntakes.length > 0 
		? Math.round((waterIntakes.reduce((a, b) => a + b, 0) / waterIntakes.length) * 10) / 10 
		: null;
	const totalWaterIntakeLiters = waterIntakes.reduce((a, b) => a + b, 0);

	return {
		totalExerciseMinutes,
		exerciseDaysCount,
		mostCommonExercise,
		exercisesByType,
		exerciseGoalMet: totalExerciseMinutes >= 150,
		recommendedMinutes: 150,
		avgSleepHours,
		totalSleepHours,
		avgSleepQuality,
		sleepPattern: 'consistent',
		avgWaterIntakeLiters,
		totalWaterIntakeLiters,
		hydrationGoalMet: avgWaterIntakeLiters >= 2.0,
		recommendedWaterLiters: 2.5
	};
}

/**
 * Generate weekly report for a specific user
 */
async function generateWeeklyReportForUser(userId) {
	try {
		const user = await User.findById(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Calculate pregnancy week from user's due date (nested in pregnancyProfile)
		const dueDate = user.pregnancyProfile?.dueDate;
		const weekNumber = calculatePregnancyWeek(dueDate);
		if (!weekNumber) {
			throw new Error('Cannot determine pregnancy week - no due date set');
		}

		const trimester = getTrimester(weekNumber);
		const { startDate, endDate } = getWeekDateRange();

		// Check if report already exists for this pregnancy week
		const existingReport = await WeeklyReport.findOne({
			userId,
			weekNumber,
			deletedAt: null
		});

		if (existingReport) {
			console.log(`Report already exists for user ${userId}, week ${weekNumber}`);
			return existingReport;
		}

		// Get health logs for the calendar week
		const healthLogs = await HealthLog.find({
			userId,
			logDate: { $gte: startDate, $lte: endDate },
			deletedAt: null
		}).sort({ logDate: 1 });

		const healthLogIds = healthLogs.map(log => log._id);

		// Calculate summaries
		const summary = calculateSummary(healthLogs);
		const vitalsSummary = calculateVitalsSummary(healthLogs);
		const activities = calculateActivitiesSummary(healthLogs);

		// Create the weekly report
		const weeklyReport = new WeeklyReport({
			userId,
			weekNumber,
			trimester,
			startDate,
			endDate,
			summary,
			vitalsSummary,
			activities,
			healthLogIds,
			status: 'complete',
			sharingSettings: {
				isPublicToAssociated: true
			}
		});

		await weeklyReport.save();
		console.log(`Weekly report generated for user ${userId}, pregnancy week ${weekNumber}`);

		// Generate AI-based diet and exercise plans
		try {
			// Initialize services
			const nutritionService = new NutritionSuggestionService();
			const exerciseService = new ExerciseSuggestionService();

			// Prepare user data for AI
			const userData = {
				userId,
				pregnancyWeek: weekNumber,
				trimester,
				healthLogs,
				weeklyReport: weeklyReport.toObject()
			};

			// Generate diet plan
			console.log(`Generating diet plan for user ${userId}...`);
			try {
				const dietPlan = await nutritionService.generateNutritionSuggestions(userData);
				weeklyReport.aiOutputs = weeklyReport.aiOutputs || {};
				weeklyReport.aiOutputs.dietPlan = dietPlan;
				weeklyReport.aiOutputs.generatedAt = new Date();
				console.log(`✅ Diet plan generated for user ${userId}`);
			} catch (dietError) {
				console.error(`❌ Failed to generate diet plan for user ${userId}:`, dietError.message);
			}

			// Generate exercise plan
			console.log(`Generating exercise plan for user ${userId}...`);
			try {
				const exercisePlan = await exerciseService.generateExerciseSuggestions(userData);
				weeklyReport.aiOutputs = weeklyReport.aiOutputs || {};
				weeklyReport.aiOutputs.exercisePlan = exercisePlan;
				console.log(`✅ Exercise plan generated for user ${userId}`);
			} catch (exerciseError) {
				console.error(`❌ Failed to generate exercise plan for user ${userId}:`, exerciseError.message);
			}

			// Save updated report with AI plans
			await weeklyReport.save();
			console.log(`Weekly report with AI plans saved for user ${userId}`);
		} catch (aiError) {
			console.error(`❌ Error generating AI plans for user ${userId}:`, aiError.message);
			// Continue - report is still valid without AI plans
		}

		return weeklyReport;
	} catch (error) {
		console.error(`Error generating weekly report for user ${userId}:`, error);
		throw error;
	}
}

/**
 * Generate weekly reports for all active pregnant users
 */
async function generateWeeklyReportsForAllUsers() {
	try {
		console.log('Starting weekly report generation for all users...');
		
		// Find users with active pregnancy (dueDate is in pregnancyProfile)
		const pregnantUsers = await User.find({
			role: 'user', // Role is 'user', not 'pregnant'
			isActive: { $ne: false },
			'pregnancyProfile.dueDate': { $exists: true, $ne: null },
			'pregnancyProfile.status': 'active'
		});

		console.log(`Found ${pregnantUsers.length} pregnant users`);

		const results = {
			success: [],
			failed: []
		};

		for (const user of pregnantUsers) {
			try {
				const report = await generateWeeklyReportForUser(user._id);
				results.success.push({
					userId: user._id,
					weekNumber: report.weekNumber
				});
			} catch (error) {
				results.failed.push({
					userId: user._id,
					error: error.message
				});
			}
		}

		console.log(`Weekly report generation complete. Success: ${results.success.length}, Failed: ${results.failed.length}`);
		return results;
	} catch (error) {
		console.error('Error in generateWeeklyReportsForAllUsers:', error);
		throw error;
	}
}

module.exports = {
	generateWeeklyReportForUser,
	generateWeeklyReportsForAllUsers,
	getWeekDateRange,
	calculatePregnancyWeek,
	getTrimester,
	calculateSummary,
	calculateVitalsSummary,
	calculateActivitiesSummary
};
