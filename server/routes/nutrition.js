const express = require('express');
const router = express.Router();
const nutritionController = require('../controllers/nutritionController');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @route   POST /api/nutrition/generate
 * @desc    Generate personalized nutrition suggestions using AI and RAG
 * @access  Private
 */
router.post('/generate', nutritionController.generateNutritionSuggestions);

/**
 * @route   GET /api/nutrition/current
 * @desc    Get current week's diet plan (auto-generates if none exists)
 * @access  Private
 */
router.get('/current', nutritionController.getCurrentDietPlan);

/**
 * @route   GET /api/nutrition/quick-advice
 * @desc    Get quick nutrition advice based on current pregnancy week
 * @access  Private
 */
router.get('/quick-advice', nutritionController.getQuickAdvice);

/**
 * @route   GET /api/nutrition/weekly-plan
 * @desc    Get nutrition plan from latest weekly report
 * @access  Private
 */
router.get('/weekly-plan', nutritionController.getWeeklyNutritionPlan);

/**
 * @route   GET /api/nutrition/search-foods
 * @desc    Search foods from nutrition database
 * @query   q (required) - search term
 * @query   limit (optional) - number of results (default: 10)
 * @access  Private
 */
router.get('/search-foods', nutritionController.searchFoods);

/**
 * @route   GET /api/nutrition/foods-by-nutrient
 * @desc    Get foods rich in specific nutrient
 * @query   nutrient (required) - iron, calcium, protein, folicAcid, fiber, vitaminC, vitaminD
 * @query   limit (optional) - number of results (default: 15)
 * @access  Private
 */
router.get('/foods-by-nutrient', nutritionController.getFoodsByNutrient);

/**
 * @route   GET /api/nutrition/history
 * @desc    Get user's diet plan history
 * @query   limit (optional) - number of results (default: 10)
 * @access  Private
 */
router.get('/history', nutritionController.getDietPlanHistory);

/**
 * @route   GET /api/nutrition/plan/:planId
 * @desc    Get a specific diet plan by ID
 * @access  Private
 */
router.get('/plan/:planId', nutritionController.getDietPlanById);

module.exports = router;
