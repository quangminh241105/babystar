const { ExerciseSuggestionService } = require('../personalized_suggestion/exerciseIndex');
const HealthLog = require('../models/healthlogs');
const WeeklyReport = require('../models/weeklyreports');
const User = require('../models/user');

// Initialize service
const exerciseService = new ExerciseSuggestionService();

/**
 * Generate exercise suggestions for authenticated user
 */
exports.generateExerciseSuggestions = async (req, res) => {
	try {
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({ 
				success: false, 
				message: 'User not authenticated' 
			});
		}

		// Fetch user, health logs and weekly report in parallel
		const [user, healthLogs, weeklyReport] = await Promise.all([
			User.findById(userId),
			HealthLog.find({ userId })
				.sort({ date: -1 })
				.limit(7)
				.lean(),
			WeeklyReport.findOne({ userId })
				.sort({ startDate: -1 })
				.lean()
		]);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found'
			});
		}

		// Check for pregnancy data using virtuals
		const pregnancyWeek = user.currentPregnancyWeek;
		const trimester = user.currentTrimester;
		
		if (!pregnancyWeek || !trimester) {
			return res.status(400).json({
				success: false,
				message: 'Pregnancy information not found. Please update your profile.'
			});
		}

		console.log(`📊 Retrieved ${healthLogs.length} health logs for exercise generation`);

		// Prepare data for AI
		const userData = {
			userId,
			pregnancyWeek: pregnancyWeek.weeks,
			trimester: trimester,
			currentWeight: user.currentWeightKg,
			healthLogs,
			weeklyReport
		};

		// Generate suggestions using AI
		const exercisePlan = await exerciseService.generateExerciseSuggestions(userData);

		// Save to database (integrate with weekly report)
		if (weeklyReport) {
			await WeeklyReport.findByIdAndUpdate(
				weeklyReport._id,
				{ 
					'aiOutputs.exercisePlan': exercisePlan,
					'aiOutputs.generatedAt': new Date()
				}
			);
		}

		res.json({
			success: true,
			data: exercisePlan,
			generatedAt: new Date()
		});
	} catch (error) {
		console.error('❌ Error generating exercise suggestions:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to generate exercise suggestions',
			error: error.message
		});
	}
};

/**
 * Get weekly exercise plan from latest report
 */
exports.getWeeklyExercisePlan = async (req, res) => {
	try {
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({ 
				success: false, 
				message: 'User not authenticated' 
			});
		}

		// Get latest weekly report with exercise plan
		const weeklyReport = await WeeklyReport.findOne({ 
			userId,
			'aiOutputs.exercisePlan': { $exists: true }
		})
		.sort({ startDate: -1 })
		.lean();

		if (!weeklyReport || !weeklyReport.aiOutputs?.exercisePlan) {
			return res.status(404).json({
				success: false,
				message: 'No exercise plan found. Generate one first.',
				hasExercisePlan: false
			});
		}

		res.json({
			success: true,
			data: weeklyReport.aiOutputs.exercisePlan,
			generatedAt: weeklyReport.aiOutputs.generatedAt,
			reportWeek: {
				start: weeklyReport.startDate,
				end: weeklyReport.endDate
			}
		});
	} catch (error) {
		console.error('❌ Error retrieving exercise plan:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to retrieve exercise plan',
			error: error.message
		});
	}
};

/**
 * Get exercise data from dataset (for reference)
 */
exports.getExerciseData = async (req, res) => {
	try {
		const user = req.session.user;
		
		if (!user?.trimester) {
			return res.status(400).json({
				success: false,
				message: 'Trimester information required'
			});
		}

		await exerciseService.initialize();
		
		const trimester = user.trimester;
		const pregnancyWeek = user.pregnancyWeek || 1;

		// Get exercises from dataset
		const context = exerciseService.exerciseLoader.getExerciseContext(trimester, pregnancyWeek);

		res.json({
			success: true,
			data: {
				trimester,
				pregnancyWeek,
				recommended: context.trimesterExercises.slice(0, 15),
				toAvoid: context.exercisesToAvoid.slice(0, 10),
				weeklyGuidance: context.weeklyGuidance
			}
		});
	} catch (error) {
		console.error('❌ Error getting exercise data:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to retrieve exercise data',
			error: error.message
		});
	}
};

/**
 * Search exercises by name or category
 */
exports.searchExercises = async (req, res) => {
	try {
		const { query, category } = req.query;

		if (!query && !category) {
			return res.status(400).json({
				success: false,
				message: 'Query or category required'
			});
		}

		await exerciseService.initialize();

		let results = [];

		if (category) {
			results = exerciseService.exerciseLoader.getExercisesByCategory(category);
		} else if (query) {
			results = exerciseService.exerciseLoader.searchExercises(query);
		}

		res.json({
			success: true,
			data: results.slice(0, 20),
			count: results.length
		});
	} catch (error) {
		console.error('❌ Error searching exercises:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to search exercises',
			error: error.message
		});
	}
};

/**
 * Get exercises to avoid for current trimester
 */
exports.getExercisesToAvoid = async (req, res) => {
	try {
		const user = req.session.user;
		
		if (!user?.trimester) {
			return res.status(400).json({
				success: false,
				message: 'Trimester information required'
			});
		}

		await exerciseService.initialize();

		const exercisesToAvoid = exerciseService.exerciseLoader.getExercisesToAvoid(user.trimester);

		res.json({
			success: true,
			data: exercisesToAvoid,
			trimester: user.trimester
		});
	} catch (error) {
		console.error('❌ Error getting exercises to avoid:', error);
		res.status(500).json({
			success: false,
			message: 'Failed to retrieve exercises to avoid',
			error: error.message
		});
	}
};
