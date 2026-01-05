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
			keySymptoms: [],
			mostFrequentSymptoms: [],
			avgEnergyLevel: null,
			avgStressLevel: null,
			dominantMoods: [],
			aiFlags: [],
			daysLogged: 0,
			avgCompletionPercentage: 0
		};
	}

	const daysLogged = healthLogs.length;

	// Collect all symptoms with frequency and severity
	const symptomData = {};
	healthLogs.forEach(log => {
		log.symptoms?.forEach(s => {
			if (!symptomData[s.symptom]) {
				symptomData[s.symptom] = {
					symptom: s.symptom,
					frequency: 0,
					totalSeverity: 0,
					count: 0
				};
			}
			symptomData[s.symptom].frequency++;
			symptomData[s.symptom].totalSeverity += s.severity || 0;
			symptomData[s.symptom].count++;
		});
	});

	// Calculate average severity and sort by frequency
	const mostFrequentSymptoms = Object.values(symptomData)
		.map(s => ({
			symptom: s.symptom,
			frequency: s.frequency,
			avgSeverity: s.count > 0 ? Math.round((s.totalSeverity / s.count) * 10) / 10 : 0
		}))
		.sort((a, b) => b.frequency - a.frequency)
		.slice(0, 10);

	const keySymptoms = mostFrequentSymptoms.map(s => s.symptom);

	// Energy and stress level averages
	const energyLevels = healthLogs.map(l => l.energyLevel).filter(e => e != null);
	const avgEnergyLevel = energyLevels.length > 0 
		? Math.round((energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length) * 10) / 10
		: null;

	const stressLevels = healthLogs.map(l => l.stressLevel).filter(s => s != null);
	const avgStressLevel = stressLevels.length > 0 
		? Math.round((stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length) * 10) / 10
		: null;

	// Aggregate moods from moodLog arrays
	const moodCounts = {};
	healthLogs.forEach(log => {
		log.moodLog?.forEach(m => {
			moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
		});
	});

	const dominantMoods = Object.entries(moodCounts)
		.map(([mood, frequency]) => ({ mood, frequency }))
		.sort((a, b) => b.frequency - a.frequency)
		.slice(0, 5);

	// Aggregate AI flags from health logs
	const aiFlagsMap = {};
	healthLogs.forEach(log => {
		log.aiFlags?.forEach(flag => {
			const key = `${flag.type}_${flag.category}_${flag.severity}`;
			if (!aiFlagsMap[key]) {
				aiFlagsMap[key] = {
					type: flag.type,
					message: flag.message,
					severity: flag.severity,
					category: flag.category,
					count: 0
				};
			}
			aiFlagsMap[key].count++;
		});
	});

	const aiFlags = Object.values(aiFlagsMap)
		.sort((a, b) => {
			const severityOrder = { high: 3, medium: 2, low: 1 };
			return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
		});

	// Completion percentage
	const completionPercentages = healthLogs.map(l => l.completionPercentage || 0);
	const avgCompletionPercentage = completionPercentages.length > 0
		? Math.round(completionPercentages.reduce((a, b) => a + b, 0) / completionPercentages.length)
		: 0;

	return {
		keySymptoms,
		mostFrequentSymptoms,
		avgEnergyLevel,
		avgStressLevel,
		dominantMoods,
		aiFlags,
		daysLogged,
		avgCompletionPercentage
	};
}

/**
 * Calculate vitals summary from health logs
 */
function calculateVitalsSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {};
	}

	// Blood Pressure
	const bpReadings = healthLogs
		.filter(l => l.bloodPressure?.systolic != null && l.bloodPressure?.diastolic != null)
		.map(l => l.bloodPressure);

	const avgSystolic = bpReadings.length > 0
		? Math.round(bpReadings.reduce((sum, bp) => sum + bp.systolic, 0) / bpReadings.length)
		: null;
	const avgDiastolic = bpReadings.length > 0
		? Math.round(bpReadings.reduce((sum, bp) => sum + bp.diastolic, 0) / bpReadings.length)
		: null;
	const maxSystolic = bpReadings.length > 0 ? Math.max(...bpReadings.map(bp => bp.systolic)) : null;
	const maxDiastolic = bpReadings.length > 0 ? Math.max(...bpReadings.map(bp => bp.diastolic)) : null;
	const minSystolic = bpReadings.length > 0 ? Math.min(...bpReadings.map(bp => bp.systolic)) : null;
	const minDiastolic = bpReadings.length > 0 ? Math.min(...bpReadings.map(bp => bp.diastolic)) : null;

	// Weight
	const weights = healthLogs.map(l => l.weightKg).filter(w => w != null);
	const avgWeightKg = weights.length > 0 
		? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10 
		: null;
	const minWeightKg = weights.length > 0 ? Math.min(...weights) : null;
	const maxWeightKg = weights.length > 0 ? Math.max(...weights) : null;
	const weightChangeKg = (weights.length > 0 && maxWeightKg && minWeightKg) 
		? Math.round((maxWeightKg - minWeightKg) * 10) / 10 
		: null;

	// Heart Rate
	const heartRates = healthLogs.map(l => l.heartRateBpm).filter(h => h != null);
	const avgHeartRateBpm = heartRates.length > 0 
		? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) 
		: null;
	const maxHeartRateBpm = heartRates.length > 0 ? Math.max(...heartRates) : null;
	const minHeartRateBpm = heartRates.length > 0 ? Math.min(...heartRates) : null;

	// Blood Sugar
	const bloodSugarReadings = healthLogs
		.filter(l => l.bloodSugar?.value != null)
		.map(l => l.bloodSugar);

	const avgBloodSugarValue = bloodSugarReadings.length > 0
		? Math.round((bloodSugarReadings.reduce((sum, bs) => sum + bs.value, 0) / bloodSugarReadings.length) * 10) / 10
		: null;
	const maxBloodSugarValue = bloodSugarReadings.length > 0 
		? Math.max(...bloodSugarReadings.map(bs => bs.value))
		: null;
	const minBloodSugarValue = bloodSugarReadings.length > 0 
		? Math.min(...bloodSugarReadings.map(bs => bs.value))
		: null;
	const bloodSugarUnit = bloodSugarReadings.length > 0 ? bloodSugarReadings[0].unit : 'mg/dL';

	// Fetal Movement
	const fetalMovements = healthLogs
		.filter(l => l.fetalMovement?.count != null)
		.map(l => l.fetalMovement);

	const avgFetalMovementCount = fetalMovements.length > 0
		? Math.round((fetalMovements.reduce((sum, fm) => sum + fm.count, 0) / fetalMovements.length) * 10) / 10
		: null;
	const totalFetalMovements = fetalMovements.reduce((sum, fm) => sum + (fm.count || 0), 0);
	const fetalMovementSessions = fetalMovements.length;

	return {
		avgSystolic,
		avgDiastolic,
		maxSystolic,
		maxDiastolic,
		minSystolic,
		minDiastolic,
		avgWeightKg,
		weightChangeKg,
		minWeightKg,
		maxWeightKg,
		avgHeartRateBpm,
		maxHeartRateBpm,
		minHeartRateBpm,
		avgBloodSugarValue,
		maxBloodSugarValue,
		minBloodSugarValue,
		bloodSugarUnit,
		bloodSugarReadings: bloodSugarReadings.length,
		avgFetalMovementCount,
		totalFetalMovements,
		fetalMovementSessions
	};
}

/**
 * Calculate activities summary from health logs
 */
function calculateActivitiesSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {
			totalExerciseMinutes: 0,
			avgExerciseMinutesPerDay: 0,
			exercisesByType: [],
			avgSleepHours: null,
			totalSleepHours: 0,
			avgSleepQuality: null,
			avgWaterIntakeLiters: null,
			totalWaterIntakeLiters: 0,
			avgCaffeineIntakeMg: null,
			totalCaffeineIntakeMg: 0,
			daysWithCaffeine: 0,
			totalMealsLogged: 0,
			avgMealsPerDay: 0,
			mealsByType: []
		};
	}

	// Exercise summary
	let totalExerciseMinutes = 0;
	const exerciseTypes = {};

	healthLogs.forEach(log => {
		log.exercises?.forEach(ex => {
			const duration = ex.durationMinutes || 0;
			totalExerciseMinutes += duration;

			if (!exerciseTypes[ex.type]) {
				exerciseTypes[ex.type] = {
					type: ex.type,
					totalMinutes: 0,
					sessionsCount: 0,
					intensities: []
				};
			}
			exerciseTypes[ex.type].totalMinutes += duration;
			exerciseTypes[ex.type].sessionsCount++;
			if (ex.intensity) {
				exerciseTypes[ex.type].intensities.push(ex.intensity);
			}
		});
	});

	const exercisesByType = Object.values(exerciseTypes).map(et => ({
		type: et.type,
		totalMinutes: et.totalMinutes,
		sessionsCount: et.sessionsCount,
		avgIntensity: et.intensities.length > 0 
			? et.intensities.sort((a, b) => 
				et.intensities.filter(v => v === a).length - et.intensities.filter(v => v === b).length
			).pop()
			: null
	}));

	const avgExerciseMinutesPerDay = healthLogs.length > 0 
		? Math.round((totalExerciseMinutes / healthLogs.length) * 10) / 10
		: 0;

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
	const waterIntakes = healthLogs.map(l => l.hydration?.waterLiters || 0);
	const avgWaterIntakeLiters = waterIntakes.length > 0 
		? Math.round((waterIntakes.reduce((a, b) => a + b, 0) / waterIntakes.length) * 10) / 10 
		: null;
	const totalWaterIntakeLiters = Math.round(waterIntakes.reduce((a, b) => a + b, 0) * 10) / 10;

	// Caffeine summary
	const caffeineIntakes = healthLogs.map(l => l.caffeineIntakeMg || 0);
	const daysWithCaffeine = caffeineIntakes.filter(c => c > 0).length;
	const totalCaffeineIntakeMg = Math.round(caffeineIntakes.reduce((a, b) => a + b, 0));
	const avgCaffeineIntakeMg = daysWithCaffeine > 0
		? Math.round(totalCaffeineIntakeMg / daysWithCaffeine)
		: null;

	// Nutrition summary
	const mealTypeCounts = {};
	let totalMealsLogged = 0;

	healthLogs.forEach(log => {
		log.foodIntake?.forEach(meal => {
			totalMealsLogged++;
			mealTypeCounts[meal.mealType] = (mealTypeCounts[meal.mealType] || 0) + 1;
		});
	});

	const mealsByType = Object.entries(mealTypeCounts).map(([mealType, count]) => ({
		mealType,
		count
	}));

	const avgMealsPerDay = healthLogs.length > 0
		? Math.round((totalMealsLogged / healthLogs.length) * 10) / 10
		: 0;

	return {
		totalExerciseMinutes,
		avgExerciseMinutesPerDay,
		exercisesByType,
		avgSleepHours,
		totalSleepHours,
		avgSleepQuality,
		avgWaterIntakeLiters,
		totalWaterIntakeLiters,
		avgCaffeineIntakeMg,
		totalCaffeineIntakeMg,
		daysWithCaffeine,
		totalMealsLogged,
		avgMealsPerDay,
		mealsByType
	};
}

/**
 * Calculate contractions summary from health logs
 */
function calculateContractionsSummary(healthLogs) {
	if (!healthLogs || healthLogs.length === 0) {
		return {
			totalContractions: 0,
			avgDurationSeconds: null,
			avgIntervalMinutes: null,
			avgIntensity: null,
			contractionsByType: []
		};
	}

	// Note: The current healthlogs schema doesn't have a contractions field
	// This function is prepared for future implementation
	// For now, return empty data
	return {
		totalContractions: 0,
		avgDurationSeconds: null,
		avgIntervalMinutes: null,
		avgIntensity: null,
		contractionsByType: []
	};
}

/**
 * Generate weekly report for a specific user
 */
async function generateWeeklyReportForUser(userId) {
	try {
		// Parallel fetch: user and check existing report
		const [user, existingReport] = await Promise.all([
			User.findById(userId).select('pregnancyProfile').lean(),
			WeeklyReport.findOne({ userId, deletedAt: null }).sort({ weekNumber: -1 }).select('weekNumber').lean()
		]);
		
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
		if (existingReport && existingReport.weekNumber === weekNumber) {
			console.log(`Report already exists for user ${userId}, week ${weekNumber}`);
			return await WeeklyReport.findById(existingReport._id);
		}

		// Get health logs for the calendar week with lean() and field selection
		const healthLogs = await HealthLog.find({
			userId,
			logDate: { $gte: startDate, $lte: endDate },
			deletedAt: null
		})
		.sort({ logDate: 1 })
		.select('symptoms energyLevel stressLevel moodLog bloodPressure weightKg heartRateBpm bloodSugar fetalMovement exercises sleep hoursSleept hydration caffeineIntakeMg foodIntake completionPercentage aiFlags logDate')
		.lean();

		const healthLogIds = healthLogs.map(log => log._id);

		// Calculate summaries
		const summary = calculateSummary(healthLogs);
		const vitalsSummary = calculateVitalsSummary(healthLogs);
		const activities = calculateActivitiesSummary(healthLogs);
		const contractions = calculateContractionsSummary(healthLogs);

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
			contractions,
			healthLogIds,
			status: 'complete'
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
		
		// Find users with active pregnancy with lean query and only needed fields
		const pregnantUsers = await User.find({
			role: 'user',
			isActive: { $ne: false },
			'pregnancyProfile.dueDate': { $exists: true, $ne: null },
			'pregnancyProfile.status': 'active'
		})
		.select('_id pregnancyProfile.dueDate')
		.lean();

		console.log(`Found ${pregnantUsers.length} pregnant users`);

		const results = {
			success: [],
			failed: []
		};

		// Process in batches of 5 for better performance without overwhelming the system
		const batchSize = 5;
		for (let i = 0; i < pregnantUsers.length; i += batchSize) {
			const batch = pregnantUsers.slice(i, i + batchSize);
			const batchResults = await Promise.allSettled(
				batch.map(user => generateWeeklyReportForUser(user._id))
			);
			
			batchResults.forEach((result, idx) => {
				const user = batch[idx];
				if (result.status === 'fulfilled') {
					results.success.push({
						userId: user._id,
						weekNumber: result.value?.weekNumber
					});
				} else {
					results.failed.push({
						userId: user._id,
						error: result.reason?.message || 'Unknown error'
					});
				}
			});
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
	calculateActivitiesSummary,
	calculateContractionsSummary
};
