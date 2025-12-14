const { NutritionSuggestionService } = require('../personalized_suggestion');
const HealthLog = require('../models/healthlogs');
const User = require('../models/user');
const WeeklyReport = require('../models/weeklyreports');

/**
 * Controller for nutrition suggestion endpoints
 */

/**
 * Generate nutrition suggestions for a user
 * POST /api/nutrition/generate
 */
async function generateNutritionSuggestions(req, res) {
	try {
		const userId = req.user?.id || req.session?.userId;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		// Get user data
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found'
			});
		}

		// Calculate pregnancy week
		const dueDate = user.pregnancyProfile?.dueDate;
		if (!dueDate) {
			return res.status(400).json({
				success: false,
				message: 'Due date not set. Please update your profile.'
			});
		}

		const today = new Date();
		const due = new Date(dueDate);
		const gestationalDays = 280 - Math.ceil((due - today) / (1000 * 60 * 60 * 24));
		const pregnancyWeek = Math.min(42, Math.max(1, Math.ceil(gestationalDays / 7)));
		const trimester = pregnancyWeek <= 12 ? 1 : pregnancyWeek <= 27 ? 2 : 3;

		// Get recent health logs (last 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const healthLogs = await HealthLog.find({
			userId,
			logDate: { $gte: sevenDaysAgo },
			deletedAt: null
		}).sort({ logDate: -1 });

		// Generate suggestions
		const nutritionService = new NutritionSuggestionService();
		const suggestions = await nutritionService.generateNutritionSuggestions({
			userId,
			pregnancyWeek,
			trimester,
			healthLogs,
			dueDate,
			userProfile: {
				name: user.name || user.username,
				email: user.email
			}
		});

		return res.status(200).json({
			success: true,
			message: 'Nutrition suggestions generated successfully',
			data: {
				pregnancyWeek,
				trimester,
				suggestions
			}
		});

	} catch (error) {
		console.error('Error in generateNutritionSuggestions:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to generate nutrition suggestions',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

/**
 * Get quick nutrition advice
 * GET /api/nutrition/quick-advice
 */
async function getQuickAdvice(req, res) {
	try {
		const userId = req.user?.id || req.session?.userId;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found'
			});
		}

		// Calculate pregnancy week
		const dueDate = user.pregnancyProfile?.dueDate;
		if (!dueDate) {
			return res.status(400).json({
				success: false,
				message: 'Due date not set'
			});
		}

		const today = new Date();
		const due = new Date(dueDate);
		const gestationalDays = 280 - Math.ceil((due - today) / (1000 * 60 * 60 * 24));
		const pregnancyWeek = Math.min(42, Math.max(1, Math.ceil(gestationalDays / 7)));

		// Get recent symptoms
		const recentLog = await HealthLog.findOne({
			userId,
			deletedAt: null
		}).sort({ logDate: -1 });

		const symptoms = recentLog?.symptoms?.map(s => s.symptom) || [];

		// Generate quick advice
		const nutritionService = new NutritionSuggestionService();
		const advice = await nutritionService.generateQuickAdvice(pregnancyWeek, symptoms);

		return res.status(200).json({
			success: true,
			data: {
				pregnancyWeek,
				advice
			}
		});

	} catch (error) {
		console.error('Error in getQuickAdvice:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to generate quick advice',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

/**
 * Get nutrition plan from latest weekly report
 * GET /api/nutrition/weekly-plan
 */
async function getWeeklyNutritionPlan(req, res) {
	try {
		const userId = req.user?.id || req.session?.userId;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		// Get latest weekly report with nutrition plan
		const latestReport = await WeeklyReport.findOne({
			userId,
			deletedAt: null,
			'dietPlan': { $exists: true, $ne: null }
		}).sort({ createdAt: -1 });

		if (!latestReport) {
			return res.status(404).json({
				success: false,
				message: 'No weekly nutrition plan found. Weekly reports are generated automatically.'
			});
		}

		return res.status(200).json({
			success: true,
			data: {
				weekNumber: latestReport.weekNumber,
				trimester: latestReport.trimester,
				startDate: latestReport.startDate,
				endDate: latestReport.endDate,
				dietPlan: latestReport.dietPlan
			}
		});

	} catch (error) {
		console.error('Error in getWeeklyNutritionPlan:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve weekly nutrition plan',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

/**
 * Search foods from nutrition database
 * GET /api/nutrition/search-foods?q=chicken
 */
async function searchFoods(req, res) {
	try {
		const { q, limit = 10 } = req.query;

		if (!q || q.trim().length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Search query is required'
			});
		}

		const nutritionService = new NutritionSuggestionService();
		await nutritionService.initialize();

		const results = nutritionService.nutritionLoader.searchFoodsByName(q, parseInt(limit));

		return res.status(200).json({
			success: true,
			data: {
				query: q,
				count: results.length,
				foods: results
			}
		});

	} catch (error) {
		console.error('Error in searchFoods:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to search foods',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

/**
 * Get foods rich in specific nutrient
 * GET /api/nutrition/foods-by-nutrient?nutrient=iron&limit=15
 */
async function getFoodsByNutrient(req, res) {
	try {
		const { nutrient, limit = 15 } = req.query;

		const validNutrients = ['iron', 'calcium', 'protein', 'folicAcid', 'fiber', 'vitaminC', 'vitaminD'];

		if (!nutrient || !validNutrients.includes(nutrient)) {
			return res.status(400).json({
				success: false,
				message: `Invalid nutrient. Valid options: ${validNutrients.join(', ')}`
			});
		}

		const nutritionService = new NutritionSuggestionService();
		await nutritionService.initialize();

		const results = nutritionService.nutritionLoader.getFoodsRichIn(nutrient, parseInt(limit));

		return res.status(200).json({
			success: true,
			data: {
				nutrient,
				count: results.length,
				foods: results
			}
		});

	} catch (error) {
		console.error('Error in getFoodsByNutrient:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve foods',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

module.exports = {
	generateNutritionSuggestions,
	getQuickAdvice,
	getWeeklyNutritionPlan,
	searchFoods,
	getFoodsByNutrient
};
