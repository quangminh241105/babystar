const { ExerciseSuggestionService } = require('../personalized_suggestion/exerciseIndex');
const HealthLog = require('../models/healthlogs');
const WeeklyReport = require('../models/weeklyreports');
const User = require('../models/user');
const ExercisePlan = require('../models/exerciseplan');

// Initialize service
const exerciseService = new ExerciseSuggestionService();

/**
 * Parse duration string to number (e.g., "20min" -> 20, "5" -> 5)
 */
function parseDuration(value) {
	if (typeof value === 'number') return value;
	if (!value) return 0;
	
	// Convert to string and extract numbers
	const str = String(value);
	const match = str.match(/(\d+)/);
	return match ? parseInt(match[1], 10) : 0;
}

/**
 * Normalize intensity values to match schema enum ['low', 'moderate', 'high']
 */
function normalizeIntensity(value) {
	if (!value) return 'moderate';
	
	const str = String(value).toLowerCase().trim();
	
	// Map variations to valid enum values
	if (str.includes('light') || str === 'low') return 'low';
	if (str.includes('moderate') || str === 'medium') return 'moderate';
	if (str.includes('high') || str === 'intense' || str === 'vigorous') return 'high';
	
	// Default to moderate if unrecognized
	return 'moderate';
}

/**
 * Generate exercise suggestions for authenticated user
 */
exports.generateExerciseSuggestions = async (req, res) => {
	try {
		const userId = req.session?.user?.id;
		const { forceRegenerate = false } = req.body;

		if (!userId) {
			return res.status(401).json({ 
				success: false, 
				message: 'User not authenticated' 
			});
		}

		// Check for existing active exercise plan (unless force regenerate)
		if (!forceRegenerate) {
			console.log(`🔍 Checking for existing exercise plan for user: ${userId}`);
			const existingPlan = await ExercisePlan.getActivePlan(userId);
			if (existingPlan) {
				console.log(`📋 Found exercise plan: ${existingPlan._id}, Valid: ${existingPlan.isValid()}`);
				if (existingPlan.isValid()) {
					console.log('✅ Returning existing valid exercise plan');
					return res.status(200).json({
						success: true,
						message: 'Retrieved existing exercise plan',
						fromCache: true,
						data: existingPlan.toObject(),
						generatedAt: existingPlan.createdAt
					});
				} else {
					console.log('⚠️ Exercise plan found but expired or invalid');
				}
			} else {
				console.log('❌ No existing exercise plan found');
			}
		}

		// Fetch user, health logs and weekly report in parallel with lean() and field selection
		const [user, healthLogs, weeklyReport] = await Promise.all([
			User.findById(userId).select('pregnancyProfile currentWeightKg currentPregnancyWeek currentTrimester'),
			HealthLog.find({ userId, deletedAt: null })
				.sort({ logDate: -1 })
				.limit(7)
				.select('exercises symptoms energyLevel logDate')
				.lean(),
			WeeklyReport.findOne({ userId, deletedAt: null })
				.sort({ startDate: -1 })
				.select('activities summary weekNumber')
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
		const aiPlan = await exerciseService.generateExerciseSuggestions(userData);

		// Deactivate old plans if regenerating
		if (forceRegenerate) {
			await ExercisePlan.deactivateOldPlans(userId);
		}

		// Transform daily exercise plan to ensure proper data structure
		const transformedDailyPlan = (aiPlan.dailyExercisePlan || []).map(day => ({
			day: day.day,
			restDay: day.restDay || false,
			exercises: (day.exercises || []).map(ex => ({
				name: ex.name || ex.exercise || 'Unnamed Exercise',
				type: ex.type || 'general',
				durationMinutes: parseDuration(ex.durationMinutes || ex.duration),
				intensity: normalizeIntensity(ex.intensity),
				targetAreas: ex.targetAreas || [],
				instructions: ex.instructions || '',
				modifications: ex.modifications || '',
				benefits: ex.benefits || [],
				equipmentNeeded: ex.equipmentNeeded || ex.equipment || []
			})),
			notes: day.notes || ''
		}));

		// Save exercise plan to database
		const exercisePlan = new ExercisePlan({
			userId,
			pregnancyWeek: pregnancyWeek.weeks,
			trimester: trimester,
			summary: aiPlan.summary || {},
			dailyExercisePlan: transformedDailyPlan,
			exercisesToAvoid: aiPlan.exercisesToAvoid || [],
			safetyNotes: aiPlan.safetyNotes || [],
			generalTips: aiPlan.generalTips || [],
			isActive: true
		});

		await exercisePlan.save();
		console.log('✅ Exercise plan saved to database');

		// Also save to weekly report for backward compatibility
		if (weeklyReport) {
			await WeeklyReport.findByIdAndUpdate(
				weeklyReport._id,
				{ 
					'aiOutputs.exercisePlan': aiPlan,
					'aiOutputs.generatedAt': new Date()
				}
			);
		}

		res.json({
			success: true,
			message: 'Exercise plan generated and saved successfully',
			fromCache: false,
			data: exercisePlan.toObject(),
			generatedAt: exercisePlan.createdAt
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
 * Get weekly exercise plan from database or generate if needed
 * Can fetch for current user or another user (if userId provided in query)
 */
exports.getWeeklyExercisePlan = async (req, res) => {
	try {
		const sessionUserId = req.session?.user?.id;

		if (!sessionUserId) {
			return res.status(401).json({ 
				success: false, 
				message: 'User not authenticated' 
			});
		}

		// Allow fetching for another user via query param, default to session user
		const targetUserId = req.query.userId || sessionUserId;

		// Try to get from database first
		let exercisePlan = await ExercisePlan.getActivePlan(targetUserId);

		if (exercisePlan && exercisePlan.isValid()) {
			return res.json({
				success: true,
				data: exercisePlan.toObject(),
				generatedAt: exercisePlan.createdAt,
				fromCache: true,
				userId: targetUserId
			});
		}

		// If no plan found, try weekly report (backward compatibility)
		const weeklyReport = await WeeklyReport.findOne({ 
			userId: targetUserId,
			'aiOutputs.exercisePlan': { $exists: true }
		})
		.sort({ startDate: -1 })
		.lean();

		if (weeklyReport && weeklyReport.aiOutputs?.exercisePlan) {
			return res.json({
				success: true,
				data: weeklyReport.aiOutputs.exercisePlan,
				generatedAt: weeklyReport.aiOutputs.generatedAt,
				reportWeek: {
					start: weeklyReport.startDate,
					end: weeklyReport.endDate
				},
				fromCache: true,
				userId: targetUserId
			});
		}

		// No plan found at all
		return res.status(404).json({
			success: false,
			message: 'No exercise plan found. Generate one first.',
			hasExercisePlan: false,
			userId: targetUserId
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
 * Get current week's exercise plan - auto-generates if not found
 * This is the main endpoint for the /exercise-plan page
 */
exports.getCurrentExercisePlan = async (req, res) => {
	try {
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({ 
				success: false, 
				message: 'User not authenticated' 
			});
		}

		// Try to get existing valid plan
		console.log(`🔍 Checking for existing exercise plan for user: ${userId}`);
		let exercisePlan = await ExercisePlan.getActivePlan(userId);

		if (exercisePlan && exercisePlan.isValid()) {
			console.log('✅ Returning existing valid exercise plan');
			return res.json({
				success: true,
				data: exercisePlan.toObject(),
				generatedAt: exercisePlan.createdAt,
				fromCache: true
			});
		}

		console.log('📝 No valid exercise plan found, generating new one...');

		// No valid plan found, generate new one
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

		// Check for pregnancy data
		const pregnancyWeek = user.currentPregnancyWeek;
		const trimester = user.currentTrimester;
		
		if (!pregnancyWeek || !trimester) {
			return res.status(400).json({
				success: false,
				message: 'Pregnancy information not found. Please update your profile.',
				redirectTo: '/profile'
			});
		}

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
		const aiPlan = await exerciseService.generateExerciseSuggestions(userData);

		// Transform daily exercise plan
		const transformedDailyPlan = (aiPlan.dailyExercisePlan || []).map(day => ({
			day: day.day,
			restDay: day.restDay || false,
			exercises: (day.exercises || []).map(ex => ({
				name: ex.name || ex.exercise || 'Unnamed Exercise',
				type: ex.type || 'general',
				durationMinutes: parseDuration(ex.durationMinutes || ex.duration),
				intensity: normalizeIntensity(ex.intensity),
				targetAreas: ex.targetAreas || [],
				instructions: ex.instructions || '',
				modifications: ex.modifications || '',
				benefits: ex.benefits || [],
				equipmentNeeded: ex.equipmentNeeded || ex.equipment || []
			})),
			notes: day.notes || ''
		}));

		// Save to database
		exercisePlan = new ExercisePlan({
			userId,
			pregnancyWeek: pregnancyWeek.weeks,
			trimester: trimester,
			summary: aiPlan.summary || {},
			dailyExercisePlan: transformedDailyPlan,
			exercisesToAvoid: aiPlan.exercisesToAvoid || [],
			safetyNotes: aiPlan.safetyNotes || [],
			generalTips: aiPlan.generalTips || [],
			isActive: true
		});

		await exercisePlan.save();
		console.log('✅ New exercise plan generated and saved');

		// Also save to weekly report
		if (weeklyReport) {
			await WeeklyReport.findByIdAndUpdate(
				weeklyReport._id,
				{ 
					'aiOutputs.exercisePlan': aiPlan,
					'aiOutputs.generatedAt': new Date()
				}
			);
		}

		return res.json({
			success: true,
			message: 'Exercise plan generated successfully',
			data: exercisePlan.toObject(),
			generatedAt: exercisePlan.createdAt,
			fromCache: false
		});

	} catch (error) {
		console.error('❌ Error getting/generating exercise plan:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to get exercise plan',
			error: error.message
		});
	}
};

/**
 * Get user's exercise plan history
 */
exports.getExercisePlanHistory = async (req, res) => {
	try {
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'User not authenticated'
			});
		}

		const limit = parseInt(req.query.limit) || 10;
		const history = await ExercisePlan.getUserHistory(userId, limit);

		return res.status(200).json({
			success: true,
			data: {
				count: history.length,
				plans: history.map(plan => ({
					id: plan._id,
					pregnancyWeek: plan.pregnancyWeek,
					trimester: plan.trimester,
					weeklyTotals: plan.weeklyTotals,
					validFrom: plan.validFrom,
					validUntil: plan.validUntil,
					isActive: plan.isActive,
					createdAt: plan.createdAt
				}))
			}
		});
	} catch (error) {
		console.error('❌ Error retrieving exercise plan history:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve exercise plan history',
			error: error.message
		});
	}
};

/**
 * Get a specific exercise plan by ID
 */
exports.getExercisePlanById = async (req, res) => {
	try {
		const userId = req.session?.user?.id;
		const { planId } = req.params;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'User not authenticated'
			});
		}

		const exercisePlan = await ExercisePlan.findOne({
			_id: planId,
			userId
		});

		if (!exercisePlan) {
			return res.status(404).json({
				success: false,
				message: 'Exercise plan not found'
			});
		}

		return res.status(200).json({
			success: true,
			data: exercisePlan.toObject()
		});
	} catch (error) {
		console.error('❌ Error retrieving exercise plan:', error);
		return res.status(500).json({
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
