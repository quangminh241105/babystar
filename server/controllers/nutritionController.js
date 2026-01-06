const { NutritionSuggestionService } = require('../personalized_suggestion');
const HealthLog = require('../models/healthlogs');
const User = require('../models/user');
const WeeklyReport = require('../models/weeklyreports');
const DietPlan = require('../models/dietplan');

/**
 * Controller for nutrition suggestion endpoints
 */

/**
 * Generate nutrition suggestions for a user
 * POST /api/nutrition/generate
 */
async function generateNutritionSuggestions(req, res) {
	try {
		const userId = req.session?.user?.id;
		const { forceRegenerate = false } = req.body;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		// Check for existing active diet plan (unless force regenerate)
		if (!forceRegenerate) {
			const existingPlan = await DietPlan.getActivePlan(userId);
			if (existingPlan && existingPlan.isValid()) {
				console.log('✅ Returning existing valid diet plan');
				return res.status(200).json({
					success: true,
					message: 'Retrieved existing nutrition plan',
					fromCache: true,
					data: transformDietPlanForResponse(existingPlan)
				});
			}
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

		// Analyze nutrition intake BEFORE AI generation
		const nutritionService = new NutritionSuggestionService();
		const healthSummary = nutritionService.extractHealthLogSummary(healthLogs);
		
		// Generate suggestions with intake analysis context
		const suggestions = await nutritionService.generateNutritionSuggestions({
			userId,
			pregnancyWeek,
			trimester,
			healthLogs,
			healthSummary,
			dueDate,
			userProfile: {
				name: user.name || user.username,
				email: user.email
			}
		});

		// Analyze intake against generated targets
		const intakeAnalysis = nutritionService.analyzeNutritionIntake(
			healthSummary,
			suggestions.dailyTargets || {}
		);

		// Deactivate old plans if regenerating
		if (forceRegenerate) {
			await DietPlan.deactivateOldPlans(userId);
		}

		// Save diet plan to database
		const dietPlan = new DietPlan({
			userId,
			pregnancyWeek,
			trimester,
			dailyTargets: suggestions.dailyTargets || {},
			weeklyMeals: transformWeeklyMealsForDB(suggestions.dailyMealRecommendations || []),
			nutrientFocus: transformNutrientFocusForDB(suggestions),
			intakeSummary: {
				analyzedPeriod: `Last ${healthLogs.length} days`,
				totalDaysAnalyzed: healthSummary.daysWithNutritionData || 0,
				averageDailyIntake: {
					calories: healthSummary.averageNutrition?.calories || 0,
					proteinGrams: healthSummary.averageNutrition?.protein || 0,
					calciumMg: healthSummary.averageNutrition?.calcium || 0,
					ironMg: healthSummary.averageNutrition?.iron || 0,
					folicAcidMcg: healthSummary.averageNutrition?.folicAcid || 0,
					omega3Grams: healthSummary.averageNutrition?.omega3 || 0,
					fiberGrams: healthSummary.averageNutrition?.fiber || 0
				},
				performanceAnalysis: intakeAnalysis
			},
			generalAdvice: suggestions.mealPrepTips || [],
			warnings: suggestions.foodsToAvoid || [],
			isActive: true
		});

		await dietPlan.save();
		console.log('✅ Diet plan saved to database');

		return res.status(200).json({
			success: true,
			message: 'Nutrition plan generated and saved successfully',
			fromCache: false,
			data: transformDietPlanForResponse(dietPlan)
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
 * Transform weekly meals for database storage
 */
function transformWeeklyMealsForDB(dailyMealRecommendations) {
	return dailyMealRecommendations.map(day => {
		const transformMeal = (meal) => {
			if (!meal) return null;
			
			// Extract nutrient values from AI response or use defaults
			const nutrients = meal.nutrients || {};
			
			return {
				food: meal.meal || '',
				portion: meal.portion || '',
				calories: meal.estimatedCalories || 0,
				reason: meal.reason || '',
				keyNutrients: meal.keyNutrients || [],
				alternatives: meal.alternatives || [],
				// Add detailed nutrients in nutritionInfo object (matches schema)
				nutritionInfo: {
					proteinGrams: nutrients.proteinGrams || meal.proteinGrams || 0,
					calciumMg: nutrients.calciumMg || meal.calciumMg || 0,
					ironMg: nutrients.ironMg || meal.ironMg || 0,
					folicAcidMcg: nutrients.folicAcidMcg || meal.folicAcidMcg || 0,
					omega3Grams: nutrients.omega3Grams || meal.omega3Grams || 0,
					fiberGrams: nutrients.fiberGrams || meal.fiberGrams || 0
				}
			};
		};

		const breakfast = day.breakfast ? [transformMeal(day.breakfast)].filter(m => m) : [];
		const lunch = day.lunch ? [transformMeal(day.lunch)].filter(m => m) : [];
		const dinner = day.dinner ? [transformMeal(day.dinner)].filter(m => m) : [];
		const snacks = (day.snacks || []).map(snack => {
			const nutrients = snack.nutrients || {};
			return {
				food: snack.name || snack.meal || '',
				portion: snack.portion || snack.time || '',
				calories: snack.estimatedCalories || 0,
				reason: snack.reason || '',
				keyNutrients: snack.keyNutrients || [],
				alternatives: snack.alternatives || [],
				// Add detailed nutrients in nutritionInfo object (matches schema)
				nutritionInfo: {
					proteinGrams: nutrients.proteinGrams || snack.proteinGrams || 0,
					calciumMg: nutrients.calciumMg || snack.calciumMg || 0,
					ironMg: nutrients.ironMg || snack.ironMg || 0,
					folicAcidMcg: nutrients.folicAcidMcg || snack.folicAcidMcg || 0,
					omega3Grams: nutrients.omega3Grams || snack.omega3Grams || 0,
					fiberGrams: nutrients.fiberGrams || snack.fiberGrams || 0
				}
			};
		});

		// Calculate daily totals from nutritionInfo
		const allMeals = [...breakfast, ...lunch, ...dinner, ...snacks];
		const dailyTotals = {
			calories: allMeals.reduce((sum, m) => sum + (m?.calories || 0), 0),
			proteinGrams: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.proteinGrams || 0), 0),
			calciumMg: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.calciumMg || 0), 0),
			ironMg: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.ironMg || 0), 0),
			folicAcidMcg: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.folicAcidMcg || 0), 0),
			omega3Grams: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.omega3Grams || 0), 0),
			fiberGrams: allMeals.reduce((sum, m) => sum + (m?.nutritionInfo?.fiberGrams || 0), 0)
		};

		return {
			day: day.day,
			breakfast,
			lunch,
			dinner,
			snacks,
			dailyTotals
		};
	});
}

/**
 * Transform nutrient focus for database storage
 */
function transformNutrientFocusForDB(suggestions) {
	let nutrientFocusArray = suggestions.nutrientFocus || [];
	
	// Ensure nutrientFocus is an array
	if (!Array.isArray(nutrientFocusArray)) {
		console.warn('⚠️ nutrientFocus is not an array:', typeof nutrientFocusArray);
		nutrientFocusArray = [];
	}
	
	return nutrientFocusArray.map(nutrient => {
		const recommended = (suggestions.recommendedFoods || []).find(
			item => item.nutrient === nutrient
		);
		
		return {
			nutrient: nutrient,
			reason: `Important for pregnancy development`,
			sources: recommended?.foods || []
		};
	});
}

/**
 * Transform diet plan from DB to response format
 */
function transformDietPlanForResponse(dietPlan) {
	const dailyTargets = {};
	if (dietPlan.dailyTargets) {
		const targets = dietPlan.dailyTargets;
		if (targets.calories) dailyTargets.calories = targets.calories;
		if (targets.proteinGrams) dailyTargets.protein = `${targets.proteinGrams}g`;
		if (targets.calciumMg) dailyTargets.calcium = `${targets.calciumMg}mg`;
		if (targets.ironMg) dailyTargets.iron = `${targets.ironMg}mg`;
		if (targets.folicAcidMcg) dailyTargets.folate = `${targets.folicAcidMcg}mcg`;
		if (targets.omega3Grams) dailyTargets.dha = `${targets.omega3Grams}g`;
		if (targets.fiberGrams) dailyTargets.fiber = `${targets.fiberGrams}g`;
	}

	return {
		pregnancyWeek: dietPlan.pregnancyWeek,
		trimester: dietPlan.trimester,
		dailyTargets,
		weeklyMeals: dietPlan.weeklyMeals || [],
		nutrientFocus: dietPlan.nutrientFocus || [],
		intakeSummary: dietPlan.intakeSummary || null,
		generalAdvice: dietPlan.generalAdvice || [],
		warnings: dietPlan.warnings || [],
		validUntil: dietPlan.validUntil,
		createdAt: dietPlan.createdAt
	};
}

/**
 * Get current diet plan (auto-generates if none exists)
 * GET /api/nutrition/current?userId=<userId>
 * Can fetch for current user or another user (if userId provided in query)
 */
async function getCurrentDietPlan(req, res) {
	try {
		const sessionUserId = req.session?.user?.id;

		if (!sessionUserId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		// Allow fetching for another user via query param, default to session user
		const targetUserId = req.query.userId || sessionUserId;
		const isViewingOther = targetUserId !== sessionUserId;

		// Check for existing active diet plan
		console.log(`🔍 Checking for existing diet plan for user: ${targetUserId}`);
		const existingPlan = await DietPlan.getActivePlan(targetUserId);
		
		if (existingPlan && existingPlan.isValid()) {
			console.log('✅ Found valid existing diet plan');
			return res.status(200).json({
				success: true,
				message: 'Retrieved existing nutrition plan',
				fromCache: true,
				data: transformDietPlanForResponse(existingPlan),
				userId: targetUserId
			});
		}

		// No valid plan exists
		// Only auto-generate for own plan, not for viewing others
		if (isViewingOther) {
			console.log('⚠️ No plan found for other user, cannot auto-generate');
			return res.status(404).json({
				success: false,
				message: 'No nutrition plan found for this user.',
				userId: targetUserId
			});
		}

		console.log('📝 No valid plan found, auto-generating...');
		
		// Get user data
		const user = await User.findById(targetUserId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found',
				userId: targetUserId
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
			userId:targetUserId,
			logDate: { $gte: sevenDaysAgo },
			deletedAt: null
		}).sort({ logDate: -1 });

		// Analyze nutrition intake BEFORE AI generation
		const nutritionService = new NutritionSuggestionService();
		const healthSummary = nutritionService.extractHealthLogSummary(healthLogs);
		
		// Generate suggestions with intake analysis context
		const suggestions = await nutritionService.generateNutritionSuggestions({
			userId: targetUserId,
			pregnancyWeek,
			trimester,
			healthLogs,
			healthSummary,
			dueDate,
			userProfile: {
				name: user.name || user.username,
				email: user.email
			}
		});

		// Analyze intake against generated targets
		const intakeAnalysis = nutritionService.analyzeNutritionIntake(
			healthSummary,
			suggestions.dailyTargets || {}
		);

		// Save diet plan to database
		const dietPlan = new DietPlan({
			userId: targetUserId,
			pregnancyWeek,
			trimester,
			dailyTargets: suggestions.dailyTargets || {},
			weeklyMeals: transformWeeklyMealsForDB(suggestions.dailyMealRecommendations || []),
			nutrientFocus: transformNutrientFocusForDB(suggestions),
			intakeSummary: {
				analyzedPeriod: `Last ${healthLogs.length} days`,
				totalDaysAnalyzed: healthSummary.daysWithNutritionData || 0,
				averageDailyIntake: {
					calories: healthSummary.averageNutrition?.calories || 0,
					proteinGrams: healthSummary.averageNutrition?.protein || 0,
					calciumMg: healthSummary.averageNutrition?.calcium || 0,
					ironMg: healthSummary.averageNutrition?.iron || 0,
					folicAcidMcg: healthSummary.averageNutrition?.folicAcid || 0,
					omega3Grams: healthSummary.averageNutrition?.omega3 || 0,
					fiberGrams: healthSummary.averageNutrition?.fiber || 0
				},
				performanceAnalysis: intakeAnalysis
			},
			generalAdvice: suggestions.mealPrepTips || [],
			warnings: suggestions.foodsToAvoid || [],
			isActive: true
		});

		await dietPlan.save();
		console.log('✅ New diet plan auto-generated and saved');

		return res.status(200).json({
			success: true,
			message: 'Nutrition plan auto-generated successfully',
			fromCache: false,
			data: transformDietPlanForResponse(dietPlan),
			userId: targetUserId
		});

	} catch (error) {
		console.error('Error in getCurrentDietPlan:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to get diet plan',
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
		const userId = req.session?.user?.id;

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
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		// Check if user has due date set
		const user = await User.findById(userId);
		if (!user?.pregnancyProfile?.dueDate) {
			return res.status(404).json({
				success: false,
				message: 'Due date not set. Please update your profile.'
			});
		}

		// Get latest weekly report with nutrition plan
		const latestReport = await WeeklyReport.findOne({
			userId,
			deletedAt: null,
			'dietPlan': { $exists: true, $ne: null }
		}).sort({ createdAt: -1 });

		if (!latestReport || !latestReport.dietPlan) {
			return res.status(404).json({
				success: false,
				message: 'No weekly nutrition plan found. Weekly reports are generated automatically.'
			});
		}

		const dietPlan = latestReport.dietPlan;

		// Transform AI response to match frontend expectations
		const weeklyMeals = (dietPlan.dailyMealRecommendations || []).map(day => {
			const transformMeal = (meal) => meal ? {
				food: meal.meal || '',
				portion: meal.portion || '',
				calories: meal.estimatedCalories || 0,
				reason: meal.reason || '',
				keyNutrients: meal.keyNutrients || [],
				alternatives: meal.alternatives || []
			} : null;

			return {
				day: day.day,
				breakfast: day.breakfast ? [transformMeal(day.breakfast)] : [],
				lunch: day.lunch ? [transformMeal(day.lunch)] : [],
				dinner: day.dinner ? [transformMeal(day.dinner)] : [],
				snacks: (day.snacks || []).map(snack => ({
					food: snack.name || snack.meal || '',
					portion: snack.portion || snack.time || '',
					calories: snack.estimatedCalories || 0,
					reason: snack.reason || '',
					keyNutrients: snack.keyNutrients || [],
					alternatives: snack.alternatives || []
				}))
			};
		});

		// Transform nutrient focus from string array to object array
		const nutrientFocusArray = dietPlan.nutrientFocus || [];
		const nutrientFocus = nutrientFocusArray.map(nutrient => {
			// Get food sources from recommendedFoods if available
			const recommended = (dietPlan.recommendedFoods || []).find(
				item => item.nutrient === nutrient
			);
			
			return {
				nutrient: nutrient,
				reason: `Important for ${latestReport.trimester === 1 ? 'early' : latestReport.trimester === 2 ? 'mid' : 'late'} pregnancy development`,
				sources: recommended?.foods || []
			};
		});

		// Transform daily targets
		const dailyTargets = {};
		if (dietPlan.dailyTargets) {
			const targets = dietPlan.dailyTargets;
			if (targets.calories) dailyTargets.calories = targets.calories;
			if (targets.proteinGrams) dailyTargets.protein = `${targets.proteinGrams}g`;
			if (targets.calciumMg) dailyTargets.calcium = `${targets.calciumMg}mg`;
			if (targets.ironMg) dailyTargets.iron = `${targets.ironMg}mg`;
			if (targets.folicAcidMcg) dailyTargets.folate = `${targets.folicAcidMcg}mcg`;
			if (targets.omega3Grams) dailyTargets.dha = `${targets.omega3Grams}g`;
		}

		// Return diet plan with proper structure
		return res.status(200).json({
			success: true,
			data: {
				pregnancyWeek: latestReport.weekNumber,
				trimester: latestReport.trimester,
				dailyTargets,
				weeklyMeals,
				nutrientFocus
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

/**
 * Get user's diet plan history
 * GET /api/nutrition/history
 */
async function getDietPlanHistory(req, res) {
	try {
		const userId = req.session?.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		const limit = parseInt(req.query.limit) || 10;
		const history = await DietPlan.getUserHistory(userId, limit);

		return res.status(200).json({
			success: true,
			data: {
				count: history.length,
				plans: history.map(plan => ({
					id: plan._id,
					pregnancyWeek: plan.pregnancyWeek,
					trimester: plan.trimester,
					dailyTargets: plan.dailyTargets,
					validFrom: plan.validFrom,
					validUntil: plan.validUntil,
					isActive: plan.isActive,
					createdAt: plan.createdAt
				}))
			}
		});

	} catch (error) {
		console.error('Error in getDietPlanHistory:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve diet plan history',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

/**
 * Get a specific diet plan by ID
 * GET /api/nutrition/plan/:planId
 */
async function getDietPlanById(req, res) {
	try {
		const userId = req.session?.user?.id;
		const { planId } = req.params;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized. Please login.'
			});
		}

		const dietPlan = await DietPlan.findOne({
			_id: planId,
			userId
		});

		if (!dietPlan) {
			return res.status(404).json({
				success: false,
				message: 'Diet plan not found'
			});
		}

		return res.status(200).json({
			success: true,
			data: transformDietPlanForResponse(dietPlan)
		});

	} catch (error) {
		console.error('Error in getDietPlanById:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to retrieve diet plan',
			error: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
}

module.exports = {
	generateNutritionSuggestions,
	getCurrentDietPlan,
	getQuickAdvice,
	getWeeklyNutritionPlan,
	searchFoods,
	getFoodsByNutrient,
	getDietPlanHistory,
	getDietPlanById
};
