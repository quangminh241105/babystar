const mongoose = require('mongoose');

// ============================================================================
// ANSWER OPTION SUB-SCHEMA
// [IMPROVED] Enhanced answer options with explanations
// ============================================================================
const answerOptionSchema = new mongoose.Schema({
	text: { 
		type: String, 
		required: [true, 'Answer text is required'],
		trim: true,
		maxlength: [500, 'Answer text cannot exceed 500 characters']
	},
	isCorrect: { type: Boolean, default: false },
	// [IMPROVED] Explanation for why this answer is correct/incorrect
	explanation: { type: String, trim: true, maxlength: 500 }
}, { _id: true });

// ============================================================================
// QUESTION SCHEMA
// ============================================================================
const questionSchema = new mongoose.Schema({
	// Question content
	questionText: { 
		type: String, 
		required: [true, 'Question text is required'],
		trim: true,
		maxlength: [1000, 'Question cannot exceed 1000 characters']
	},
	
	// [IMPROVED] Question type support
	questionType: {
		type: String,
		enum: ['multiple_choice', 'true_false', 'multiple_select'],
		default: 'multiple_choice'
	},
	
	// Answer options
	answers: {
		type: [answerOptionSchema],
		validate: {
			validator: function(v) {
				return v.length >= 2 && v.length <= 6;
			},
			message: 'Question must have between 2 and 6 answer options'
		}
	},
	
	// [IMPROVED] Correct answer index(es) - supports multiple correct answers
	correctAnswerIndex: { type: Number, min: 0 }, // For single answer questions
	correctAnswerIndexes: [{ type: Number, min: 0 }], // For multiple select
	
	// [IMPROVED] Detailed explanation shown after answering
	explanation: { 
		type: String, 
		trim: true,
		maxlength: [2000, 'Explanation cannot exceed 2000 characters']
	},
	
	// [IMPROVED] Source/reference for the information
	source: { type: String, trim: true, maxlength: 200 },
	sourceUrl: { type: String, trim: true },
	
	// [IMPROVED] Media support
	imageUrl: { type: String, trim: true },
	videoUrl: { type: String, trim: true },
	
	// [IMPROVED] Difficulty level
	difficulty: {
		type: String,
		enum: ['easy', 'medium', 'hard'],
		default: 'medium'
	},
	
	// [IMPROVED] Points value
	points: { type: Number, default: 10, min: 1, max: 100 },
	
	// [IMPROVED] Time limit for this question (in seconds)
	timeLimitSeconds: { type: Number, min: 5, max: 300 },
	
	// [IMPROVED] Hint available
	hint: { type: String, trim: true, maxlength: 300 },
	hintPenaltyPoints: { type: Number, default: 2, min: 0 },
	
	// Statistics
	timesAnswered: { type: Number, default: 0 },
	timesCorrect: { type: Number, default: 0 },
	
	// Status
	isActive: { type: Boolean, default: true }
	
}, { _id: true, timestamps: true });

// Virtual for correct answer percentage
questionSchema.virtual('correctPercentage').get(function() {
	if (this.timesAnswered === 0) return 0;
	return Math.round((this.timesCorrect / this.timesAnswered) * 100);
});

// ============================================================================
// QUIZ SCHEMA
// ============================================================================
const quizSchema = new mongoose.Schema({
	// Basic info
	title: { 
		type: String, 
		required: [true, 'Quiz title is required'],
		trim: true,
		maxlength: [200, 'Title cannot exceed 200 characters']
	},
	description: { 
		type: String, 
		trim: true,
		maxlength: [1000, 'Description cannot exceed 1000 characters']
	},
	
	// [IMPROVED] Quiz category with pregnancy-specific options
	category: {
		type: String,
		enum: [
			'trimester_1', 'trimester_2', 'trimester_3',
			'nutrition', 'exercise', 'baby_development',
			'labor_delivery', 'postpartum', 'breastfeeding',
			'mental_health', 'medical', 'safety',
			'newborn_care', 'parenting', 'general'
		],
		required: true,
		index: true
	},
	
	// [IMPROVED] Sub-category for more specific topics
	subCategory: { type: String, trim: true },
	
	// [IMPROVED] Tags for flexible categorization
	tags: [{ type: String, trim: true, lowercase: true }],
	
	// [IMPROVED] Target pregnancy week range
	targetWeekRange: {
		minWeek: { type: Number, min: 1, max: 42 },
		maxWeek: { type: Number, min: 1, max: 42 }
	},
	
	// [IMPROVED] Target trimester
	targetTrimester: {
		type: Number,
		enum: [1, 2, 3, null]
	},
	
	// Questions
	questions: [questionSchema],
	
	// [IMPROVED] Quiz settings
	settings: {
		// Time limit for entire quiz (in minutes)
		timeLimitMinutes: { type: Number, min: 1, max: 120 },
		// Randomize question order
		shuffleQuestions: { type: Boolean, default: false },
		// Randomize answer order
		shuffleAnswers: { type: Boolean, default: false },
		// Show correct answers after each question
		showCorrectAfterEach: { type: Boolean, default: true },
		// Show explanation after each question
		showExplanationAfterEach: { type: Boolean, default: true },
		// Allow skipping questions
		allowSkip: { type: Boolean, default: true },
		// Allow going back to previous questions
		allowBacktrack: { type: Boolean, default: true },
		// Passing score percentage
		passingScore: { type: Number, default: 70, min: 0, max: 100 },
		// Maximum attempts allowed (0 = unlimited)
		maxAttempts: { type: Number, default: 0, min: 0 },
		// Points for completing the quiz
		completionPoints: { type: Number, default: 50 }
	},
	
	// [IMPROVED] Quiz image/thumbnail
	thumbnailUrl: { type: String, trim: true },
	
	// [IMPROVED] Estimated completion time
	estimatedMinutes: { type: Number, min: 1 },
	
	// [IMPROVED] Difficulty level
	difficulty: {
		type: String,
		enum: ['beginner', 'intermediate', 'advanced', 'mixed'],
		default: 'intermediate'
	},
	
	// [IMPROVED] Quiz type
	quizType: {
		type: String,
		enum: ['educational', 'assessment', 'fun', 'daily_challenge'],
		default: 'educational'
	},
	
	// Statistics
	totalAttempts: { type: Number, default: 0 },
	totalCompletions: { type: Number, default: 0 },
	avgScore: { type: Number, default: 0 },
	avgCompletionTimeSeconds: { type: Number, default: 0 },
	
	// [IMPROVED] Ratings
	ratings: {
		totalRatings: { type: Number, default: 0 },
		sumRatings: { type: Number, default: 0 },
		avgRating: { type: Number, default: 0, min: 0, max: 5 }
	},
	
	// [IMPROVED] Featured/promoted quiz
	isFeatured: { type: Boolean, default: false },
	featuredUntil: { type: Date },
	
	// [IMPROVED] Daily quiz scheduling
	isDailyQuiz: { type: Boolean, default: false },
	dailyQuizDate: { type: Date },
	
	// Status
	isActive: { type: Boolean, default: true },
	isPublished: { type: Boolean, default: false },
	publishedAt: { type: Date },
	
	// [IMPROVED] Created by (admin or system)
	createdBy: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User'
	},
	
	// Soft delete
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// QUIZ ATTEMPT SCHEMA
// [IMPROVED] Track individual user attempts
// ============================================================================
const quizAttemptSchema = new mongoose.Schema({
	// References
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true,
		index: true
	},
	quizId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Quiz',
		required: true,
		index: true
	},
	
	// [IMPROVED] User's pregnancy context at time of attempt
	pregnancyContext: {
		week: { type: Number },
		trimester: { type: Number }
	},
	
	// Attempt details
	startedAt: { type: Date, default: Date.now },
	completedAt: { type: Date },
	
	// [IMPROVED] Time spent
	timeSpentSeconds: { type: Number, default: 0 },
	
	// Answers given
	answers: [{
		questionId: { type: mongoose.Schema.Types.ObjectId },
		questionIndex: { type: Number },
		selectedAnswerIndex: { type: Number }, // For single answer
		selectedAnswerIndexes: [{ type: Number }], // For multiple select
		isCorrect: { type: Boolean },
		pointsEarned: { type: Number, default: 0 },
		// [IMPROVED] Time spent on this question
		timeSpentSeconds: { type: Number },
		// [IMPROVED] Used hint
		usedHint: { type: Boolean, default: false },
		// [IMPROVED] Skipped
		skipped: { type: Boolean, default: false },
		answeredAt: { type: Date }
	}],
	
	// Results
	totalQuestions: { type: Number },
	questionsAnswered: { type: Number, default: 0 },
	questionsCorrect: { type: Number, default: 0 },
	questionsSkipped: { type: Number, default: 0 },
	
	// Scores
	score: { type: Number, default: 0 },
	maxPossibleScore: { type: Number },
	scorePercentage: { type: Number, default: 0 },
	
	// [IMPROVED] Bonus points
	bonusPoints: { type: Number, default: 0 },
	bonusReasons: [{ type: String }], // e.g., "Perfect score", "Speed bonus"
	
	// [IMPROVED] Pass/fail status
	passed: { type: Boolean },
	
	// Attempt status
	status: {
		type: String,
		enum: ['in_progress', 'completed', 'abandoned', 'timed_out'],
		default: 'in_progress'
	},
	
	// [IMPROVED] Attempt number for this user/quiz combination
	attemptNumber: { type: Number, default: 1 },
	
	// [IMPROVED] User feedback
	feedback: {
		rating: { type: Number, min: 1, max: 5 },
		difficultyFeedback: { type: String, enum: ['too_easy', 'just_right', 'too_hard'] },
		comment: { type: String, trim: true, maxlength: 500 },
		submittedAt: { type: Date }
	}
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// USER QUIZ PROGRESS SCHEMA
// [IMPROVED] Track overall quiz progress and achievements
// ============================================================================
const userQuizProgressSchema = new mongoose.Schema({
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true,
		unique: true,
		index: true
	},
	
	// Overall statistics
	totalQuizzesTaken: { type: Number, default: 0 },
	totalQuizzesCompleted: { type: Number, default: 0 },
	totalQuizzesPassed: { type: Number, default: 0 },
	totalQuestionsAnswered: { type: Number, default: 0 },
	totalQuestionsCorrect: { type: Number, default: 0 },
	
	// Points and scores
	totalPointsEarned: { type: Number, default: 0 },
	avgScorePercentage: { type: Number, default: 0 },
	highestScore: { type: Number, default: 0 },
	
	// [IMPROVED] Streaks
	currentStreak: { type: Number, default: 0 }, // Days in a row with quiz completed
	longestStreak: { type: Number, default: 0 },
	lastQuizDate: { type: Date },
	
	// [IMPROVED] Category progress
	categoryProgress: [{
		category: { type: String },
		quizzesCompleted: { type: Number, default: 0 },
		avgScore: { type: Number, default: 0 },
		totalPoints: { type: Number, default: 0 }
	}],
	
	// [IMPROVED] Achievements/Badges
	achievements: [{
		achievementId: { type: String },
		name: { type: String },
		description: { type: String },
		iconUrl: { type: String },
		earnedAt: { type: Date, default: Date.now },
		category: { type: String }
	}],
	
	// [IMPROVED] Level system
	level: { type: Number, default: 1 },
	experiencePoints: { type: Number, default: 0 },
	experienceToNextLevel: { type: Number, default: 100 },
	
	// [IMPROVED] Daily quiz tracking
	dailyQuizzesCompleted: { type: Number, default: 0 },
	lastDailyQuizDate: { type: Date },
	dailyQuizStreak: { type: Number, default: 0 },
	
	// [IMPROVED] Favorite categories
	favoriteCategories: [{ type: String }],
	
	// [IMPROVED] Weak areas (categories with lower scores)
	weakAreas: [{
		category: { type: String },
		avgScore: { type: Number },
		suggestedQuizIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }]
	}]
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// INDEXES
// ============================================================================
// Quiz indexes
quizSchema.index({ category: 1, isActive: 1, isPublished: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ targetTrimester: 1 });
quizSchema.index({ 'targetWeekRange.minWeek': 1, 'targetWeekRange.maxWeek': 1 });
quizSchema.index({ difficulty: 1 });
quizSchema.index({ isFeatured: 1, featuredUntil: 1 });
quizSchema.index({ isDailyQuiz: 1, dailyQuizDate: 1 });
quizSchema.index({ 'ratings.avgRating': -1 });
quizSchema.index({ totalCompletions: -1 });
quizSchema.index({ deletedAt: 1 });
quizSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Attempt indexes
quizAttemptSchema.index({ userId: 1, quizId: 1 });
quizAttemptSchema.index({ userId: 1, status: 1 });
quizAttemptSchema.index({ userId: 1, completedAt: -1 });
quizAttemptSchema.index({ quizId: 1, status: 1 });

// Progress indexes
userQuizProgressSchema.index({ totalPointsEarned: -1 }); // For leaderboard
userQuizProgressSchema.index({ level: -1 });

// ============================================================================
// VIRTUALS
// ============================================================================
// Quiz virtuals
quizSchema.virtual('questionCount').get(function() {
	return this.questions?.length || 0;
});

quizSchema.virtual('totalPoints').get(function() {
	if (!this.questions) return 0;
	return this.questions.reduce((sum, q) => sum + (q.points || 10), 0);
});

quizSchema.virtual('completionRate').get(function() {
	if (this.totalAttempts === 0) return 0;
	return Math.round((this.totalCompletions / this.totalAttempts) * 100);
});

// Attempt virtuals
quizAttemptSchema.virtual('isComplete').get(function() {
	return this.status === 'completed';
});

quizAttemptSchema.virtual('correctPercentage').get(function() {
	if (this.totalQuestions === 0) return 0;
	return Math.round((this.questionsCorrect / this.totalQuestions) * 100);
});

// Progress virtuals
userQuizProgressSchema.virtual('overallAccuracy').get(function() {
	if (this.totalQuestionsAnswered === 0) return 0;
	return Math.round((this.totalQuestionsCorrect / this.totalQuestionsAnswered) * 100);
});

// ============================================================================
// QUIZ INSTANCE METHODS
// ============================================================================
// Get questions (optionally shuffled)
quizSchema.methods.getQuestions = function(shuffle = false) {
	let questions = [...this.questions.filter(q => q.isActive)];
	
	if (shuffle || this.settings.shuffleQuestions) {
		for (let i = questions.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[questions[i], questions[j]] = [questions[j], questions[i]];
		}
	}
	
	return questions;
};

// Add a question
quizSchema.methods.addQuestion = async function(questionData) {
	this.questions.push(questionData);
	await this.save();
	return this;
};

// Update statistics after an attempt
quizSchema.methods.updateStats = async function(attemptScore, completionTimeSeconds, completed) {
	this.totalAttempts += 1;
	
	if (completed) {
		this.totalCompletions += 1;
		
		// Update average score
		const totalScore = this.avgScore * (this.totalCompletions - 1) + attemptScore;
		this.avgScore = totalScore / this.totalCompletions;
		
		// Update average completion time
		const totalTime = this.avgCompletionTimeSeconds * (this.totalCompletions - 1) + completionTimeSeconds;
		this.avgCompletionTimeSeconds = totalTime / this.totalCompletions;
	}
	
	await this.save();
	return this;
};

// Add rating
quizSchema.methods.addRating = async function(rating) {
	this.ratings.totalRatings += 1;
	this.ratings.sumRatings += rating;
	this.ratings.avgRating = this.ratings.sumRatings / this.ratings.totalRatings;
	await this.save();
	return this;
};

// ============================================================================
// ATTEMPT INSTANCE METHODS
// ============================================================================
// Record an answer
quizAttemptSchema.methods.recordAnswer = async function(questionIndex, selectedIndex, isCorrect, points, timeSpent, usedHint = false) {
	this.answers.push({
		questionIndex,
		selectedAnswerIndex: selectedIndex,
		isCorrect,
		pointsEarned: points,
		timeSpentSeconds: timeSpent,
		usedHint,
		answeredAt: new Date()
	});
	
	this.questionsAnswered += 1;
	if (isCorrect) {
		this.questionsCorrect += 1;
	}
	this.score += points;
	this.timeSpentSeconds += timeSpent;
	
	await this.save();
	return this;
};

// Complete the attempt
quizAttemptSchema.methods.complete = async function(passingScore) {
	this.completedAt = new Date();
	this.status = 'completed';
	this.scorePercentage = Math.round((this.score / this.maxPossibleScore) * 100);
	this.passed = this.scorePercentage >= passingScore;
	
	// Calculate bonus points
	if (this.scorePercentage === 100) {
		this.bonusPoints += 20;
		this.bonusReasons.push('Perfect score!');
	}
	if (this.questionsSkipped === 0) {
		this.bonusPoints += 10;
		this.bonusReasons.push('Answered all questions');
	}
	
	this.score += this.bonusPoints;
	
	await this.save();
	return this;
};

// Skip a question
quizAttemptSchema.methods.skipQuestion = async function(questionIndex) {
	this.answers.push({
		questionIndex,
		skipped: true,
		answeredAt: new Date()
	});
	this.questionsSkipped += 1;
	await this.save();
	return this;
};

// ============================================================================
// PROGRESS INSTANCE METHODS
// ============================================================================
// Update progress after completing a quiz
userQuizProgressSchema.methods.recordQuizCompletion = async function(attempt, quiz) {
	this.totalQuizzesTaken += 1;
	this.totalQuizzesCompleted += 1;
	this.totalQuestionsAnswered += attempt.questionsAnswered;
	this.totalQuestionsCorrect += attempt.questionsCorrect;
	this.totalPointsEarned += attempt.score;
	
	if (attempt.passed) {
		this.totalQuizzesPassed += 1;
	}
	
	// Update average score
	this.avgScorePercentage = Math.round(
		(this.totalQuestionsCorrect / this.totalQuestionsAnswered) * 100
	);
	
	// Update highest score
	if (attempt.score > this.highestScore) {
		this.highestScore = attempt.score;
	}
	
	// Update streak
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
	if (this.lastQuizDate) {
		const lastDate = new Date(this.lastQuizDate);
		lastDate.setHours(0, 0, 0, 0);
		
		const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
		
		if (diffDays === 1) {
			this.currentStreak += 1;
		} else if (diffDays > 1) {
			this.currentStreak = 1;
		}
		// If same day, streak stays the same
	} else {
		this.currentStreak = 1;
	}
	
	if (this.currentStreak > this.longestStreak) {
		this.longestStreak = this.currentStreak;
	}
	
	this.lastQuizDate = new Date();
	
	// Update category progress
	const categoryIndex = this.categoryProgress.findIndex(c => c.category === quiz.category);
	if (categoryIndex >= 0) {
		const cat = this.categoryProgress[categoryIndex];
		cat.quizzesCompleted += 1;
		cat.totalPoints += attempt.score;
		cat.avgScore = Math.round(cat.totalPoints / cat.quizzesCompleted);
	} else {
		this.categoryProgress.push({
			category: quiz.category,
			quizzesCompleted: 1,
			avgScore: attempt.scorePercentage,
			totalPoints: attempt.score
		});
	}
	
	// Update level and XP
	this.experiencePoints += attempt.score;
	while (this.experiencePoints >= this.experienceToNextLevel) {
		this.experiencePoints -= this.experienceToNextLevel;
		this.level += 1;
		this.experienceToNextLevel = Math.floor(this.experienceToNextLevel * 1.5);
	}
	
	// Check for achievements
	await this.checkAchievements();
	
	await this.save();
	return this;
};

// Check and award achievements
userQuizProgressSchema.methods.checkAchievements = async function() {
	const newAchievements = [];
	
	// First quiz
	if (this.totalQuizzesCompleted === 1 && !this.hasAchievement('first_quiz')) {
		newAchievements.push({
			achievementId: 'first_quiz',
			name: 'Quiz Starter',
			description: 'Completed your first quiz!',
			category: 'milestone'
		});
	}
	
	// 10 quizzes
	if (this.totalQuizzesCompleted >= 10 && !this.hasAchievement('ten_quizzes')) {
		newAchievements.push({
			achievementId: 'ten_quizzes',
			name: 'Quiz Enthusiast',
			description: 'Completed 10 quizzes!',
			category: 'milestone'
		});
	}
	
	// 7-day streak
	if (this.currentStreak >= 7 && !this.hasAchievement('week_streak')) {
		newAchievements.push({
			achievementId: 'week_streak',
			name: 'Consistent Learner',
			description: '7-day quiz streak!',
			category: 'streak'
		});
	}
	
	// Perfect accuracy
	if (this.avgScorePercentage >= 90 && this.totalQuizzesCompleted >= 5 && !this.hasAchievement('high_accuracy')) {
		newAchievements.push({
			achievementId: 'high_accuracy',
			name: 'Pregnancy Expert',
			description: '90%+ average accuracy on 5+ quizzes!',
			category: 'skill'
		});
	}
	
	this.achievements.push(...newAchievements);
	return newAchievements;
};

// Check if user has achievement
userQuizProgressSchema.methods.hasAchievement = function(achievementId) {
	return this.achievements.some(a => a.achievementId === achievementId);
};

// ============================================================================
// STATIC METHODS
// ============================================================================
// Quiz static methods
quizSchema.statics.getByCategory = function(category, options = {}) {
	const query = {
		category,
		isActive: true,
		isPublished: true,
		deletedAt: null
	};
	
	if (options.difficulty) query.difficulty = options.difficulty;
	if (options.trimester) query.targetTrimester = options.trimester;
	
	return this.find(query).sort({ 'ratings.avgRating': -1 });
};

quizSchema.statics.getForPregnancyWeek = function(week) {
	return this.find({
		isActive: true,
		isPublished: true,
		deletedAt: null,
		$or: [
			{ 'targetWeekRange.minWeek': { $lte: week }, 'targetWeekRange.maxWeek': { $gte: week } },
			{ targetTrimester: week <= 12 ? 1 : week <= 27 ? 2 : 3 }
		]
	}).sort({ 'ratings.avgRating': -1 });
};

quizSchema.statics.getFeatured = function() {
	return this.find({
		isFeatured: true,
		isActive: true,
		isPublished: true,
		deletedAt: null,
		$or: [
			{ featuredUntil: { $gte: new Date() } },
			{ featuredUntil: null }
		]
	}).sort({ 'ratings.avgRating': -1 });
};

quizSchema.statics.getDailyQuiz = function(date = new Date()) {
	const startOfDay = new Date(date);
	startOfDay.setHours(0, 0, 0, 0);
	
	const endOfDay = new Date(date);
	endOfDay.setHours(23, 59, 59, 999);
	
	return this.findOne({
		isDailyQuiz: true,
		dailyQuizDate: { $gte: startOfDay, $lte: endOfDay },
		isActive: true,
		deletedAt: null
	});
};

quizSchema.statics.search = function(searchTerm, options = {}) {
	const query = {
		$text: { $search: searchTerm },
		isActive: true,
		isPublished: true,
		deletedAt: null
	};
	
	if (options.category) query.category = options.category;
	
	return this.find(query, { score: { $meta: 'textScore' } })
		.sort({ score: { $meta: 'textScore' } })
		.limit(options.limit || 20);
};

// Attempt static methods
quizAttemptSchema.statics.getUserAttempts = function(userId, options = {}) {
	const query = { userId };
	
	if (options.quizId) query.quizId = options.quizId;
	if (options.status) query.status = options.status;
	
	return this.find(query)
		.sort({ createdAt: -1 })
		.limit(options.limit || 20)
		.populate('quizId', 'title category difficulty');
};

quizAttemptSchema.statics.getAttemptCount = function(userId, quizId) {
	return this.countDocuments({ userId, quizId });
};

quizAttemptSchema.statics.getBestAttempt = function(userId, quizId) {
	return this.findOne({
		userId,
		quizId,
		status: 'completed'
	}).sort({ score: -1 });
};

quizAttemptSchema.statics.getLeaderboard = function(quizId, limit = 10) {
	return this.find({
		quizId,
		status: 'completed'
	})
	.sort({ score: -1, timeSpentSeconds: 1 })
	.limit(limit)
	.populate('userId', 'firstName lastName profileImageUrl');
};

// Progress static methods
userQuizProgressSchema.statics.getOrCreate = async function(userId) {
	let progress = await this.findOne({ userId });
	
	if (!progress) {
		progress = new this({ userId });
		await progress.save();
	}
	
	return progress;
};

userQuizProgressSchema.statics.getLeaderboard = function(limit = 10) {
	return this.find()
		.sort({ totalPointsEarned: -1 })
		.limit(limit)
		.populate('userId', 'firstName lastName profileImageUrl');
};

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
quizSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
quizSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

quizAttemptSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

userQuizProgressSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

// ============================================================================
// EXPORT MODELS
// ============================================================================
const Quiz = mongoose.model('Quiz', quizSchema);
const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
const UserQuizProgress = mongoose.model('UserQuizProgress', userQuizProgressSchema);

module.exports = {
	Quiz,
	QuizAttempt,
	UserQuizProgress
};
