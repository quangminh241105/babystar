const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { Quiz } = require('../models/quizzes');
const { requireAdmin } = require('../middleware/auth');
const { 
  generateAndSaveQuiz, 
  addQuestionsToQuiz 
} = require('../services/quizGeneratorService');

// Render main admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  res.render('pages/admin-main', { title: 'Admin Dashboard' });
});

// Render the admin user management page
router.get('/users', requireAdmin, async (req, res) => {
  res.render('pages/admin-users', { title: 'Admin: Manage Users' });
});

// API: List all users (for frontend JS)
router.get('/api/users', requireAdmin, async (req, res) => {
  try {
    // Load all users except deleted, sorted by name
    const users = await User.find({ deletedAt: null })
      .select('fullName email role isActive')
      .sort({ fullName: 1, email: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// API: Activate user
router.put('/users/:id/activate', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('fullName email role isActive');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to activate user' });
  }
});

// API: Deactivate user
router.put('/users/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('fullName email role isActive');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to deactivate user' });
  }
});

// ============================================================================
// QUIZ MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /admin/quizzes
 * Render quiz management page
 */
router.get('/quizzes', requireAdmin, (req, res) => {
  res.render('pages/quiz-list', { 
    title: 'Manage Quizzes'
  });
});

/**
 * GET /admin/quiz-generator
 * Render AI quiz generator page
 */
router.get('/quiz-generator', requireAdmin, (req, res) => {
  res.render('pages/quiz-generator', { 
    title: 'AI Quiz Generator' 
  });
});

/**
 * GET /admin/api/quizzes
 * API endpoint to get all quizzes as JSON
 */
router.get('/api/quizzes', requireAdmin, async (req, res) => {
  try {
    const quizzes = await Quiz.find()
      .sort({ createdAt: -1 })
      .select('title description category questions isActive createdAt');

    const quizData = quizzes.map(q => ({
      _id: q._id,
      title: q.title,
      description: q.description,
      category: q.category,
      questionCount: q.questions.length,
      isActive: q.isActive,
      createdAt: q.createdAt
    }));

    res.json({
      success: true,
      quizzes: quizData
    });

  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load quizzes'
    });
  }
});

/**
 * POST /admin/generate-quiz
 * Generate quiz using AI and save to database
 */
router.post('/generate-quiz', requireAdmin, async (req, res) => {
  try {
    const { category, numQuestions, difficulty } = req.body;

    // Validate input
    if (!category || !['nutrition', 'exercise', 'baby_development'].includes(category)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid category required: nutrition, exercise, or baby_development' 
      });
    }

    const num = parseInt(numQuestions) || 10;
    if (num < 5 || num > 15) {
      return res.status(400).json({ 
        success: false, 
        error: 'Number of questions must be between 5 and 15' 
      });
    }

    const diff = difficulty || 'medium';
    if (!['easy', 'medium', 'hard'].includes(diff)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Difficulty must be: easy, medium, or hard' 
      });
    }

    // Generate and save quiz
    const result = await generateAndSaveQuiz({
      category,
      numQuestions: num,
      difficulty: diff
    });

    res.json({
      success: true,
      message: result.isNew ? 'Quiz generated and saved!' : 'Quiz updated!',
      quiz: {
        id: result.quiz._id,
        title: result.quiz.title,
        category: result.quiz.category,
        questionCount: result.quiz.questions.length
      }
    });

  } catch (error) {
    console.error('Error in generate-quiz:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate quiz' 
    });
  }
});

/**
 * POST /admin/add-questions/:quizId
 * Add more questions to existing quiz using AI
 */
router.post('/add-questions/:quizId', requireAdmin, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { numQuestions, difficulty } = req.body;

    const num = parseInt(numQuestions) || 5;
    const diff = difficulty || 'medium';

    const result = await addQuestionsToQuiz(quizId, num, diff);

    res.json({
      success: true,
      message: `Added ${result.addedQuestions} questions!`,
      quiz: {
        id: result.quiz._id,
        title: result.quiz.title,
        totalQuestions: result.quiz.questions.length
      }
    });

  } catch (error) {
    console.error('Error in add-questions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to add questions' 
    });
  }
});

/**
 * DELETE /admin/quiz/:quizId
 * Delete a quiz
 */
router.delete('/quiz/:quizId', requireAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.quizId);
    
    if (!quiz) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quiz not found' 
      });
    }

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete quiz' 
    });
  }
});

/**
 * PUT /admin/quiz/:quizId/toggle
 * Toggle quiz active status
 */
router.put('/quiz/:quizId/toggle', requireAdmin, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    
    if (!quiz) {
      return res.status(404).json({ 
        success: false, 
        error: 'Quiz not found' 
      });
    }

    quiz.isActive = !quiz.isActive;
    await quiz.save();

    res.json({
      success: true,
      message: `Quiz ${quiz.isActive ? 'activated' : 'deactivated'}`,
      isActive: quiz.isActive
    });

  } catch (error) {
    console.error('Error toggling quiz:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to toggle quiz status' 
    });
  }
});


module.exports = router;
