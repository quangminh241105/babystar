const express = require('express');
const router = express.Router();
const { requireAuth, requireAuthRedirect } = require('../middleware');
const { Quiz, QuizAttempt } = require('../models/quizzes');

// Get overall quiz page
router.get('/', requireAuthRedirect, (req, res) => {
  res.render('pages/quiz', { title: 'Quiz' });
});

// ============================================================================
// QUIZ MANAGEMENT APIs
// ============================================================================

// POST /quiz - Create a new quiz
router.post('/', async (req, res) => {
	try {
		const { title, description, category, questions } = req.body;
		
		// Validate required fields
		if (!title || !category) {
			return res.status(400).json({ error: 'Title and category are required' });
		}
		
		const quiz = new Quiz({
			title,
			description,
			category,
			questions: questions || []
		});
		
		await quiz.save();
		
		res.status(201).json({
			success: true,
			message: 'Quiz created successfully',
			quiz
		});
	} catch (error) {
		console.error('Error creating quiz:', error);
		res.status(500).json({ error: 'Server error', details: error.message });
	}
});

// GET /quiz - Get all quizzes
router.get('/', async (req, res) => {
	try {
		const { category } = req.query;
		
		let quizzes;
		if (category) {
			quizzes = await Quiz.getByCategory(category);
		} else {
			quizzes = await Quiz.find({ isActive: true });
		}
		
		res.json({ success: true, quizzes });
	} catch (error) {
		console.error('Error fetching quizzes:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// PUT /quiz/:quizId - Update a quiz
router.put('/:quizId', async (req, res) => {
	try {
		const { quizId } = req.params;
		const { title, description, category, isActive } = req.body;
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		if (title) quiz.title = title;
		if (description) quiz.description = description;
		if (category) quiz.category = category;
		if (typeof isActive === 'boolean') quiz.isActive = isActive;
		
		await quiz.save();
		
		res.json({
			success: true,
			message: 'Quiz updated successfully',
			quiz
		});
	} catch (error) {
		console.error('Error updating quiz:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// DELETE /quiz/:quizId - Delete a quiz
router.delete('/:quizId', async (req, res) => {
	try {
		const { quizId } = req.params;
		
		const quiz = await Quiz.findByIdAndDelete(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		// Also delete all attempts for this quiz
		await QuizAttempt.deleteMany({ quizId });
		
		res.json({
			success: true,
			message: 'Quiz deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting quiz:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// ============================================================================
// QUESTION MANAGEMENT APIs
// ============================================================================

// POST /quiz/:quizId/questions - Add a question to a quiz
router.post('/:quizId/questions', async (req, res) => {
	try {
		const { quizId } = req.params;
		const { questionText, options, correctAnswer, explanation } = req.body;
		
		// Validate required fields
		if (!questionText || !options || correctAnswer === undefined) {
			return res.status(400).json({ 
				error: 'questionText, options, and correctAnswer are required' 
			});
		}
		
		// Validate options array
		if (!Array.isArray(options) || options.length !== 4) {
			return res.status(400).json({ 
				error: 'Options must be an array of exactly 4 items (A, B, C, D)' 
			});
		}
		
		// Validate correctAnswer
		if (correctAnswer < 0 || correctAnswer > 3) {
			return res.status(400).json({ 
				error: 'correctAnswer must be 0 (A), 1 (B), 2 (C), or 3 (D)' 
			});
		}
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		// Add the question
		quiz.questions.push({
			questionText,
			options,
			correctAnswer,
			explanation: explanation || ''
		});
		
		await quiz.save();
		
		const addedQuestion = quiz.questions[quiz.questions.length - 1];
		
		res.status(201).json({
			success: true,
			message: 'Question added successfully',
			question: addedQuestion,
			totalQuestions: quiz.questions.length
		});
	} catch (error) {
		console.error('Error adding question:', error);
		res.status(500).json({ error: 'Server error', details: error.message });
	}
});

// POST /quiz/:quizId/questions/bulk - Add multiple questions to a quiz
router.post('/:quizId/questions/bulk', async (req, res) => {
	try {
		const { quizId } = req.params;
		const { questions } = req.body;
		
		if (!Array.isArray(questions) || questions.length === 0) {
			return res.status(400).json({ error: 'Questions array is required' });
		}
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		// Validate each question
		for (let i = 0; i < questions.length; i++) {
			const q = questions[i];
			if (!q.questionText || !q.options || q.correctAnswer === undefined) {
				return res.status(400).json({ 
					error: `Question ${i + 1}: questionText, options, and correctAnswer are required` 
				});
			}
			if (!Array.isArray(q.options) || q.options.length !== 4) {
				return res.status(400).json({ 
					error: `Question ${i + 1}: options must be an array of exactly 4 items` 
				});
			}
			if (q.correctAnswer < 0 || q.correctAnswer > 3) {
				return res.status(400).json({ 
					error: `Question ${i + 1}: correctAnswer must be 0, 1, 2, or 3` 
				});
			}
		}
		
		// Add all questions
		quiz.questions.push(...questions);
		await quiz.save();
		
		res.status(201).json({
			success: true,
			message: `${questions.length} questions added successfully`,
			totalQuestions: quiz.questions.length
		});
	} catch (error) {
		console.error('Error adding questions:', error);
		res.status(500).json({ error: 'Server error', details: error.message });
	}
});

// GET /quiz/:quizId/questions - Get all questions for a quiz
router.get('/:quizId/questions', async (req, res) => {
	try {
		const { quizId } = req.params;
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		res.json({
			success: true,
			quizTitle: quiz.title,
			totalQuestions: quiz.questions.length,
			questions: quiz.questions
		});
	} catch (error) {
		console.error('Error fetching questions:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// PUT /quiz/:quizId/questions/:questionId - Update a specific question
router.put('/:quizId/questions/:questionId', async (req, res) => {
	try {
		const { quizId, questionId } = req.params;
		const { questionText, options, correctAnswer, explanation } = req.body;
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		const question = quiz.questions.id(questionId);
		if (!question) {
			return res.status(404).json({ error: 'Question not found' });
		}
		
		// Update fields if provided
		if (questionText) question.questionText = questionText;
		if (options) {
			if (!Array.isArray(options) || options.length !== 4) {
				return res.status(400).json({ error: 'Options must be an array of 4 items' });
			}
			question.options = options;
		}
		if (correctAnswer !== undefined) {
			if (correctAnswer < 0 || correctAnswer > 3) {
				return res.status(400).json({ error: 'correctAnswer must be 0, 1, 2, or 3' });
			}
			question.correctAnswer = correctAnswer;
		}
		if (explanation !== undefined) question.explanation = explanation;
		
		await quiz.save();
		
		res.json({
			success: true,
			message: 'Question updated successfully',
			question
		});
	} catch (error) {
		console.error('Error updating question:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// DELETE /quiz/:quizId/questions/:questionId - Delete a specific question
router.delete('/:quizId/questions/:questionId', async (req, res) => {
	try {
		const { quizId, questionId } = req.params;
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).json({ error: 'Quiz not found' });
		}
		
		const question = quiz.questions.id(questionId);
		if (!question) {
			return res.status(404).json({ error: 'Question not found' });
		}
		
		question.deleteOne();
		await quiz.save();
		
		res.json({
			success: true,
			message: 'Question deleted successfully',
			totalQuestions: quiz.questions.length
		});
	} catch (error) {
		console.error('Error deleting question:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// ============================================================================
// QUIZ TAKING APIs
// ============================================================================

// GET /quiz/category/:category - Start quiz by category (e.g., /quiz/category/nutrition)
router.get('/category/:category', async (req, res) => {
	try {
		const { category } = req.params;
		const userId = req.session?.user?.id;
		
		if (!userId) {
			return res.redirect('/auth/login');
		}
		
		// Find quiz by category
		const quiz = await Quiz.findOne({ category, isActive: true });
		if (!quiz) {
			return res.status(404).render('pages/error', { 
				title: 'Quiz Not Found',
				message: `No quiz found for category: ${category}` 
			});
		}
		
		// Check if quiz has questions
		if (!quiz.questions || quiz.questions.length === 0) {
			return res.status(404).render('pages/error', { 
				title: 'No Questions',
				message: 'This quiz has no questions yet.' 
			});
		}
		
		// Check for existing in-progress attempt (to resume)
		let attempt = await QuizAttempt.findOne({ 
			userId, 
			quizId: quiz._id, 
			status: 'in_progress' 
		});
		
		// If no in-progress attempt, create a new one
		if (!attempt) {
			attempt = new QuizAttempt({
				userId,
				quizId: quiz._id,
				totalQuestions: quiz.questions.length,
				currentQuestionIndex: 0
			});
			await attempt.save();
		}
		
		// If attempt is already completed, redirect to results
		if (attempt.status === 'completed') {
			return res.redirect(`/quiz/${quiz._id}/results?attemptId=${attempt._id}`);
		}
		
		// Render the question page with quiz and attempt data
		res.render('pages/question', { title: quiz.title, quiz, attempt });
	} catch (error) {
		console.error('Error loading quiz by category:', error);
		res.status(500).render('pages/error', { 
			title: 'Error',
			message: 'Failed to load quiz' 
		});
	}
});

// GET /quiz/:quizId/start - Start or resume a quiz by ID
router.get('/:quizId/start', async (req, res) => {
	try {
		const { quizId } = req.params;
		const userId = req.user._id;
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).send('Quiz not found');
		}
		
		// Check for existing in-progress attempt (to resume)
		let attempt = await QuizAttempt.getInProgressAttempt(userId, quizId);
		
		// If no in-progress attempt, create a new one
		if (!attempt) {
			attempt = new QuizAttempt({
				userId,
				quizId,
				totalQuestions: quiz.questions.length,
				currentQuestionIndex: 0
			});
			await attempt.save();
		}
		
		// If attempt is already completed, redirect to results
		if (attempt.status === 'completed') {
			return res.redirect(`/quiz/${quizId}/results?attemptId=${attempt._id}`);
		}
		
		// Render the question page with quiz and attempt data
		res.render('pages/question', { title: quiz.title, quiz, attempt });
	} catch (error) {
		console.error('Error loading quiz:', error);
		res.status(500).render('pages/error', { title: 'Error', message: 'Failed to load quiz' });
	}
});

// POST /quiz/:quizId/answer - Submit an answer (JSON API)
router.post('/:quizId/answer', async (req, res) => {
	try {
		const { quizId } = req.params;
		const { attemptId, questionIndex, selectedAnswer } = req.body;
		
		// Find quiz and attempt
		const quiz = await Quiz.findById(quizId);
		const attempt = await QuizAttempt.findById(attemptId);
		
		if (!quiz || !attempt) {
			return res.status(404).json({ error: 'Quiz or attempt not found' });
		}
		
		// Get the question and check if answer is correct
		const question = quiz.questions[parseInt(questionIndex)];
		const isCorrect = parseInt(selectedAnswer) === question.correctAnswer;
		
		// Save the answer using the instance method from schema
		await attempt.answerQuestion(
			parseInt(questionIndex),
			parseInt(selectedAnswer),
			isCorrect
		);
		
		// Return JSON response
		res.json({ 
			success: true, 
			isCorrect,
			correctAnswer: question.correctAnswer,
			explanation: question.explanation,
			status: attempt.status,
			score: attempt.score
		});
	} catch (error) {
		console.error('Error saving answer:', error);
		res.status(500).json({ error: 'Server error' });
	}
});

// GET /quiz/:quizId/results - View quiz results
router.get('/:quizId/results', requireAuthRedirect, async (req, res) => {
	try {
		const { quizId } = req.params;
		const userId = req.session?.user?.id;
		
		if (!userId) {
			return res.redirect('/auth/login');
		}
		
		const quiz = await Quiz.findById(quizId);
		if (!quiz) {
			return res.status(404).render('pages/error', { title: 'Not Found', message: 'Quiz not found' });
		}
		
		// Fetch all attempts for this quiz by the current user
		const attempts = await QuizAttempt.find({ 
			quizId, 
			userId 
		}).sort({ startedAt: -1 }); // Most recent first
		
		res.render('pages/quiz-result', { title: 'Quiz Results', quiz, attempts });
	} catch (error) {
		console.error('Error loading results:', error);
		res.status(500).render('pages/error', { title: 'Error', message: 'Failed to load results' });
	}
});

module.exports = router;
