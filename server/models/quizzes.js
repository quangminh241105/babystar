const mongoose = require('mongoose');

// ============================================================================
// QUESTION SCHEMA - Simple multiple choice (A, B, C, D)
// ============================================================================
const questionSchema = new mongoose.Schema({
	questionText: { 
		type: String, 
		required: [true, 'Question text is required'],
		trim: true
	},
	
	// Answer options (A, B, C, D)
	options: {
		type: [String],
		validate: {
			validator: function(v) {
				return v.length === 4;
			},
			message: 'Question must have exactly 4 options (A, B, C, D)'
		},
		required: true
	},
	
	// Correct answer index (0 = A, 1 = B, 2 = C, 3 = D)
	correctAnswer: { 
		type: Number, 
		required: true,
		min: 0,
		max: 3
	},
	
	// Explanation shown after answering
	explanation: { 
		type: String, 
		trim: true
	}
}, { _id: true });

// ============================================================================
// QUIZ SCHEMA
// ============================================================================
const quizSchema = new mongoose.Schema({
	title: { 
		type: String, 
		required: [true, 'Quiz title is required'],
		trim: true
	},
	
	description: { 
		type: String, 
		trim: true
	},
	
	category: {
		type: String,
		enum: [
			'nutrition', 'exercise', 'baby_development'
		],
		required: true
	},
	
	questions: [questionSchema],
	
	isActive: { type: Boolean, default: true }
	
}, {
	timestamps: true
});

// ============================================================================
// QUIZ ATTEMPT SCHEMA - Track user progress and score
// ============================================================================
const quizAttemptSchema = new mongoose.Schema({
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
	
	// Current question index (0-based) - tracks where user left off
	currentQuestionIndex: { 
		type: Number, 
		default: 0,
		min: 0
	},
	
	// User's answers for each question
	answers: [{
		questionIndex: { type: Number, required: true },
		selectedAnswer: { type: Number, min: 0, max: 3 },
		isCorrect: { type: Boolean }
	}],
	
	// Score (number of correct answers)
	score: { type: Number, default: 0 },
	totalQuestions: { type: Number, required: true },
	
	// Status: in_progress or completed
	status: {
		type: String,
		enum: ['in_progress', 'completed'],
		default: 'in_progress'
	},
	
	startedAt: { type: Date, default: Date.now },
	completedAt: { type: Date }
	
}, {
	timestamps: true
});

// ============================================================================
// INDEXES
// ============================================================================
quizSchema.index({ category: 1, isActive: 1 });
quizAttemptSchema.index({ userId: 1, quizId: 1, status: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
quizSchema.virtual('questionCount').get(function() {
	return this.questions?.length || 0;
});

quizAttemptSchema.virtual('scorePercentage').get(function() {
	if (this.totalQuestions === 0) return 0;
	return Math.round((this.score / this.totalQuestions) * 100);
});

quizAttemptSchema.virtual('isComplete').get(function() {
	return this.status === 'completed';
});

// ============================================================================
// STATIC METHODS
// ============================================================================
quizSchema.statics.getByCategory = function(category) {
	return this.find({ category, isActive: true });
};

// Get user's in-progress attempt for a quiz (to resume)
quizAttemptSchema.statics.getInProgressAttempt = function(userId, quizId) {
	return this.findOne({ userId, quizId, status: 'in_progress' });
};

// Get user's completed attempts for a quiz
quizAttemptSchema.statics.getCompletedAttempts = function(userId, quizId = null) {
	const query = { userId, status: 'completed' };
	if (quizId) query.quizId = quizId;
	return this.find(query).sort({ completedAt: -1 }).populate('quizId', 'title category');
};

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// Record an answer and move to next question
quizAttemptSchema.methods.answerQuestion = async function(questionIndex, selectedAnswer, isCorrect) {
	this.answers.push({
		questionIndex,
		selectedAnswer,
		isCorrect
	});
	
	if (isCorrect) {
		this.score += 1;
	}
	
	this.currentQuestionIndex = questionIndex + 1;
	
	// Check if quiz is complete
	if (this.currentQuestionIndex >= this.totalQuestions) {
		this.status = 'completed';
		this.completedAt = new Date();
	}
	
	await this.save();
	return this;
};

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

// ============================================================================
// EXPORT MODELS
// ============================================================================
const Quiz = mongoose.model('Quiz', quizSchema);
const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = {
	Quiz,
	QuizAttempt
};
