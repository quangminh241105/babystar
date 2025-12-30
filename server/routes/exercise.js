const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exerciseController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/exercise/generate
 * Generate personalized exercise plan using AI
 */
router.post('/generate', exerciseController.generateExerciseSuggestions);

/**
 * GET /api/exercise/current
 * Get current week's exercise plan - auto-generates if not found
 * This is the main endpoint for the /exercise-plan page
 */
router.get('/current', exerciseController.getCurrentExercisePlan);

/**
 * GET /api/exercise/weekly-plan
 * Get current weekly exercise plan from latest report
 */
router.get('/weekly-plan', exerciseController.getWeeklyExercisePlan);

/**
 * GET /api/exercise/data
 * Get exercise data from dataset (recommended + avoid for current trimester)
 */
router.get('/data', exerciseController.getExerciseData);

/**
 * GET /api/exercise/search?query=walking&category=cardio
 * Search exercises by name or category
 */
router.get('/search', exerciseController.searchExercises);

/**
 * GET /api/exercise/avoid
 * Get exercises to avoid for current trimester
 */
router.get('/avoid', exerciseController.getExercisesToAvoid);

/**
 * GET /api/exercise/history
 * Get user's exercise plan history
 */
router.get('/history', exerciseController.getExercisePlanHistory);

/**
 * GET /api/exercise/plan/:planId
 * Get a specific exercise plan by ID
 */
router.get('/plan/:planId', exerciseController.getExercisePlanById);

module.exports = router;
