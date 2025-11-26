const mongoose = require('mongoose');

// ============================================================================
// DAILY MEAL RECOMMENDATION SUB-SCHEMA
// ============================================================================
const dailyMealSchema = new mongoose.Schema({
	day: { 
		type: String, 
		enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		required: true
	},
	breakfast: {
		meal: { type: String, trim: true },
		alternatives: [{ type: String, trim: true }],
		// [IMPROVED] Added nutritional info
		estimatedCalories: { type: Number, min: 0 }
	},
	lunch: {
		meal: { type: String, trim: true },
		alternatives: [{ type: String, trim: true }],
		estimatedCalories: { type: Number, min: 0 }
	},
	dinner: {
		meal: { type: String, trim: true },
		alternatives: [{ type: String, trim: true }],
		estimatedCalories: { type: Number, min: 0 }
	},
	snacks: [{
		name: { type: String, trim: true },
		time: { type: String, trim: true }, // e.g., "Mid-morning", "Afternoon"
		estimatedCalories: { type: Number, min: 0 }
	}]
}, { _id: false });

// ============================================================================
// DAILY EXERCISE SUB-SCHEMA
// ============================================================================
const dailyExerciseSchema = new mongoose.Schema({
	day: { 
		type: String, 
		enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
		required: true
	},
	exercises: [{
		name: { type: String, trim: true, required: true },
		durationMin: { type: Number, min: 0 },
		// [IMPROVED] Added intensity and instructions
		intensity: { 
			type: String, 
			enum: ['low', 'moderate', 'light'],
			default: 'light'
		},
		instructions: { type: String, trim: true },
		videoUrl: { type: String, trim: true } // Optional tutorial link
	}],
	// [IMPROVED] Rest day option
	isRestDay: { type: Boolean, default: false },
	restDayActivities: [{ type: String, trim: true }] // e.g., "Light stretching", "Meditation"
}, { _id: false });

// ============================================================================
// SUMMARY SUB-SCHEMA
// ============================================================================
const summarySchema = new mongoose.Schema({
	overallStatus: { 
		type: String, 
		enum: ['Excellent', 'Good', 'Stable', 'Needs Attention', 'Concerning'],
		default: 'Stable'
	},
	// [IMPROVED] Added status score for easier tracking
	statusScore: { type: Number, min: 1, max: 10 },
	
	keySymptoms: [{ type: String, trim: true }],
	
	// Weight tracking
	startWeightKg: { type: Number, min: 0 },
	endWeightKg: { type: Number, min: 0 },
	weightChangeKg: { type: Number }, // Can be negative
	// [IMPROVED] Added weight change assessment
	weightChangeStatus: {
		type: String,
		enum: ['below_target', 'on_target', 'above_target', 'concerning'],
		default: 'on_target'
	},
	
	// Energy and mood
	avgEnergyLevel: { type: Number, min: 1, max: 5 },
	avgMood: { 
		type: String, 
		enum: ['very_happy', 'happy', 'neutral', 'anxious', 'sad', 'stressed', 'mixed'],
		default: 'neutral'
	},
	moodPattern: { type: String, trim: true }, // e.g., "Improving", "Fluctuating", "Stable"
	
	// Concerns
	concernsDetected: [{ type: String, trim: true }],
	// [IMPROVED] Concern severity level
	concernSeverity: {
		type: String,
		enum: ['none', 'low', 'moderate', 'high', 'urgent'],
		default: 'none'
	},
	
	// [IMPROVED] Positive highlights
	positiveHighlights: [{ type: String, trim: true }],
	
	// [IMPROVED] Compliance tracking
	logCompletionRate: { type: Number, min: 0, max: 100 }, // Percentage of days logged
	daysLogged: { type: Number, min: 0, max: 7, default: 0 }
}, { _id: false });

// ============================================================================
// VITALS SUMMARY SUB-SCHEMA
// ============================================================================
const vitalsSummarySchema = new mongoose.Schema({
	// Blood Pressure
	avgSystolic: { type: Number, min: 0 },
	avgDiastolic: { type: Number, min: 0 },
	maxSystolic: { type: Number, min: 0 },
	maxDiastolic: { type: Number, min: 0 },
	minSystolic: { type: Number, min: 0 },
	minDiastolic: { type: Number, min: 0 },
	// [IMPROVED] Blood pressure assessment
	bloodPressureStatus: {
		type: String,
		enum: ['low', 'normal', 'elevated', 'high', 'concerning'],
		default: 'normal'
	},
	
	// Weight
	avgWeightKg: { type: Number, min: 0 },
	
	// Heart Rate
	avgHeartRateBpm: { type: Number, min: 0 },
	maxHeartRateBpm: { type: Number, min: 0 },
	minHeartRateBpm: { type: Number, min: 0 },
	
	// Temperature
	avgTemperatureC: { type: Number, min: 30, max: 45 },
	
	// [IMPROVED] Fetal movement summary
	avgFetalMovementCount: { type: Number, min: 0 },
	totalFetalMovements: { type: Number, min: 0 },
	fetalMovementTrend: {
		type: String,
		enum: ['increasing', 'stable', 'decreasing', 'insufficient_data'],
		default: 'insufficient_data'
	}
}, { _id: false });

// ============================================================================
// ACTIVITIES SUMMARY SUB-SCHEMA
// ============================================================================
const activitiesSummarySchema = new mongoose.Schema({
	// Exercise
	totalExerciseMinutes: { type: Number, min: 0, default: 0 },
	exerciseDaysCount: { type: Number, min: 0, max: 7, default: 0 },
	mostCommonExercise: { type: String, trim: true },
	exercisesByType: [{
		type: { type: String, trim: true },
		totalMinutes: { type: Number, min: 0 },
		sessionsCount: { type: Number, min: 0 }
	}],
	// [IMPROVED] Exercise goal tracking
	exerciseGoalMet: { type: Boolean, default: false },
	recommendedMinutes: { type: Number, min: 0, default: 150 }, // Weekly target
	
	// Sleep
	avgSleepHours: { type: Number, min: 0, max: 24 },
	totalSleepHours: { type: Number, min: 0 },
	// [IMPROVED] Sleep quality tracking
	avgSleepQuality: { type: Number, min: 1, max: 5 },
	sleepPattern: {
		type: String,
		enum: ['consistent', 'irregular', 'improving', 'worsening'],
		default: 'consistent'
	},
	
	// Hydration
	avgWaterIntakeLiters: { type: Number, min: 0 },
	totalWaterIntakeLiters: { type: Number, min: 0 },
	hydrationGoalMet: { type: Boolean, default: false },
	recommendedWaterLiters: { type: Number, min: 0, default: 2.5 },
	
	// [IMPROVED] Steps/Activity tracking
	avgStepsPerDay: { type: Number, min: 0 },
	totalSteps: { type: Number, min: 0 }
}, { _id: false });

// ============================================================================
// AI ADVICE SUB-SCHEMA
// ============================================================================
const aiAdviceSchema = new mongoose.Schema({
	generalRecommendations: [{ type: String, trim: true }],
	warningSignsToWatch: [{ type: String, trim: true }],
	
	// [IMPROVED] Personalized insights based on data
	personalizedInsights: [{ type: String, trim: true }],
	
	// [IMPROVED] Action items with priority
	actionItems: [{
		item: { type: String, trim: true },
		priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
		category: { type: String, trim: true } // e.g., "nutrition", "exercise", "medical"
	}],
	
	// [IMPROVED] When to contact healthcare provider
	seekMedicalAttentionIf: [{ type: String, trim: true }],
	
	// [IMPROVED] Week-specific tips based on pregnancy stage
	weekSpecificTips: [{ type: String, trim: true }],
	
	// [IMPROVED] Mental health support
	mentalHealthTips: [{ type: String, trim: true }],
	
	// [IMPROVED] Upcoming milestones
	upcomingMilestones: [{
		week: { type: Number },
		milestone: { type: String, trim: true },
		description: { type: String, trim: true }
	}]
}, { _id: false });

// ============================================================================
// AI DIET PLAN SUB-SCHEMA
// ============================================================================
const aiDietPlanSchema = new mongoose.Schema({
	dailyMealRecommendations: [dailyMealSchema],
	
	nutrientFocus: [{ type: String, trim: true }],
	foodsToAvoid: [{ type: String, trim: true }],
	
	// [IMPROVED] Detailed nutritional targets
	dailyTargets: {
		calories: { type: Number, min: 0 },
		proteinGrams: { type: Number, min: 0 },
		calciumMg: { type: Number, min: 0 },
		ironMg: { type: Number, min: 0 },
		folicAcidMcg: { type: Number, min: 0 },
		omega3Grams: { type: Number, min: 0 },
		fiberGrams: { type: Number, min: 0 }
	},
	
	// [IMPROVED] Foods rich in needed nutrients
	recommendedFoods: [{
		nutrient: { type: String, trim: true },
		foods: [{ type: String, trim: true }]
	}],
	
	// [IMPROVED] Meal prep tips
	mealPrepTips: [{ type: String, trim: true }],
	
	// [IMPROVED] Handling common issues
	nauseaFriendlyOptions: [{ type: String, trim: true }],
	heartburnFriendlyOptions: [{ type: String, trim: true }],
	
	// [IMPROVED] Hydration reminders
	hydrationTips: [{ type: String, trim: true }]
}, { _id: false });

// ============================================================================
// AI EXERCISE PLAN SUB-SCHEMA
// ============================================================================
const aiExercisePlanSchema = new mongoose.Schema({
	weeklyFocus: { type: String, trim: true },
	dailyExercises: [dailyExerciseSchema],
	safetyTips: [{ type: String, trim: true }],
	
	// [IMPROVED] Trimester-specific modifications
	trimesterModifications: [{ type: String, trim: true }],
	
	// [IMPROVED] Exercises to avoid
	exercisesToAvoid: [{ type: String, trim: true }],
	
	// [IMPROVED] Warm-up and cool-down
	warmUpRoutine: [{
		exercise: { type: String, trim: true },
		durationMin: { type: Number, min: 0 }
	}],
	coolDownRoutine: [{
		exercise: { type: String, trim: true },
		durationMin: { type: Number, min: 0 }
	}],
	
	// [IMPROVED] Pelvic floor exercises
	pelvicFloorExercises: [{
		name: { type: String, trim: true },
		reps: { type: Number, min: 0 },
		sets: { type: Number, min: 0 },
		instructions: { type: String, trim: true }
	}],
	
	// [IMPROVED] When to stop exercising
	stopExercisingIf: [{ type: String, trim: true }]
}, { _id: false });

// ============================================================================
// AI OUTPUTS SUB-SCHEMA
// ============================================================================
const aiOutputsSchema = new mongoose.Schema({
	advice: aiAdviceSchema,
	dietPlan: aiDietPlanSchema,
	exercisePlan: aiExercisePlanSchema,
	
	// [IMPROVED] AI generation metadata
	generatedAt: { type: Date, default: Date.now },
	modelVersion: { type: String, trim: true },
	// [IMPROVED] Confidence score for AI recommendations
	confidenceScore: { type: Number, min: 0, max: 1 },
	
	// [IMPROVED] User feedback on AI outputs
	userFeedback: {
		rating: { type: Number, min: 1, max: 5 },
		helpful: { type: Boolean },
		feedbackText: { type: String, trim: true, maxlength: 500 },
		submittedAt: { type: Date }
	},
	
	// [IMPROVED] Regeneration tracking
	regenerationCount: { type: Number, default: 0 },
	lastRegeneratedAt: { type: Date }
}, { _id: false });

// ============================================================================
// MAIN WEEKLY REPORT SCHEMA
// ============================================================================
const weeklyReportSchema = new mongoose.Schema({
	// User reference
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: [true, 'User ID is required'],
		index: true
	},
	
	// Week information
	weekNumber: { 
		type: Number, 
		required: [true, 'Week number is required'],
		min: [1, 'Week number must be at least 1'],
		max: [42, 'Week number cannot exceed 42']
	},
	trimester: {
		type: Number,
		enum: [1, 2, 3],
		required: true
	},
	startDate: { 
		type: Date, 
		required: [true, 'Start date is required']
	},
	endDate: { 
		type: Date, 
		required: [true, 'End date is required']
	},
	
	// Summaries
	summary: { type: summarySchema, default: () => ({}) },
	vitalsSummary: { type: vitalsSummarySchema, default: () => ({}) },
	activities: { type: activitiesSummarySchema, default: () => ({}) },
	
	// AI-generated content
	aiOutputs: { type: aiOutputsSchema, default: () => ({}) },
	
	// [IMPROVED] Source health logs reference
	healthLogIds: [{ 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'HealthLog'
	}],
	
	// Sharing
	sharedWith: [{ 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User'
	}],
	// [IMPROVED] Sharing settings
	sharingSettings: {
		isPublicToAssociated: { type: Boolean, default: true },
		hideWeightData: { type: Boolean, default: false },
		hideMoodData: { type: Boolean, default: false },
		hideMedicalConcerns: { type: Boolean, default: false }
	},
	
	// [IMPROVED] Report status
	status: {
		type: String,
		enum: ['generating', 'complete', 'incomplete', 'error'],
		default: 'generating'
	},
	
	// [IMPROVED] Comparison with previous week
	comparisonWithPreviousWeek: {
		weightTrend: { type: String, enum: ['up', 'down', 'stable'] },
		energyTrend: { type: String, enum: ['up', 'down', 'stable'] },
		moodTrend: { type: String, enum: ['improving', 'declining', 'stable'] },
		exerciseTrend: { type: String, enum: ['more', 'less', 'same'] },
		overallTrend: { type: String, enum: ['improving', 'declining', 'stable'] }
	},
	
	// [IMPROVED] User notes and annotations
	userNotes: { type: String, trim: true, maxlength: 2000 },
	
	// [IMPROVED] Doctor/Partner notes
	associatedUserNotes: [{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		note: { type: String, trim: true, maxlength: 1000 },
		createdAt: { type: Date, default: Date.now }
	}],
	
	// [IMPROVED] Bookmarked/Flagged for review
	isBookmarked: { type: Boolean, default: false },
	isFlaggedForReview: { type: Boolean, default: false },
	flagReason: { type: String, trim: true },
	
	// [IMPROVED] PDF export tracking
	pdfGeneratedAt: { type: Date },
	pdfUrl: { type: String, trim: true },
	
	// [IMPROVED] Soft delete
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// INDEXES
// ============================================================================
weeklyReportSchema.index({ userId: 1, weekNumber: 1 }, { unique: true });
weeklyReportSchema.index({ userId: 1, startDate: -1 });
weeklyReportSchema.index({ userId: 1, status: 1 });
weeklyReportSchema.index({ sharedWith: 1 });
weeklyReportSchema.index({ 'summary.overallStatus': 1 });
weeklyReportSchema.index({ 'summary.concernSeverity': 1 });
weeklyReportSchema.index({ createdAt: -1 });
weeklyReportSchema.index({ deletedAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
// [IMPROVED] Check if report is current week
weeklyReportSchema.virtual('isCurrentWeek').get(function() {
	const now = new Date();
	return now >= this.startDate && now <= this.endDate;
});

// [IMPROVED] Days in report period
weeklyReportSchema.virtual('reportDays').get(function() {
	if (this.startDate && this.endDate) {
		const diffTime = this.endDate - this.startDate;
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	}
	return 7;
});

// [IMPROVED] Formatted week display
weeklyReportSchema.virtual('weekDisplay').get(function() {
	return `Week ${this.weekNumber} (Trimester ${this.trimester})`;
});

// [IMPROVED] Overall health score (calculated from various metrics)
weeklyReportSchema.virtual('overallHealthScore').get(function() {
	let score = 50; // Base score
	
	// Add points for good metrics
	if (this.summary?.avgEnergyLevel >= 4) score += 10;
	else if (this.summary?.avgEnergyLevel >= 3) score += 5;
	
	if (this.summary?.avgMood === 'happy' || this.summary?.avgMood === 'very_happy') score += 10;
	else if (this.summary?.avgMood === 'neutral') score += 5;
	
	if (this.activities?.exerciseGoalMet) score += 10;
	if (this.activities?.hydrationGoalMet) score += 5;
	if (this.summary?.logCompletionRate >= 80) score += 10;
	
	// Subtract for concerns
	if (this.summary?.concernSeverity === 'high') score -= 15;
	else if (this.summary?.concernSeverity === 'moderate') score -= 10;
	else if (this.summary?.concernSeverity === 'low') score -= 5;
	
	return Math.max(0, Math.min(100, score));
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// [IMPROVED] Share report with user
weeklyReportSchema.methods.shareWith = async function(userId) {
	if (!this.sharedWith.includes(userId)) {
		this.sharedWith.push(userId);
		await this.save();
	}
	return this;
};

// [IMPROVED] Remove sharing
weeklyReportSchema.methods.unshareWith = async function(userId) {
	this.sharedWith = this.sharedWith.filter(id => id.toString() !== userId.toString());
	await this.save();
	return this;
};

// [IMPROVED] Add associated user note
weeklyReportSchema.methods.addAssociatedNote = async function(userId, note) {
	this.associatedUserNotes.push({
		userId,
		note,
		createdAt: new Date()
	});
	await this.save();
	return this;
};

// [IMPROVED] Mark for review
weeklyReportSchema.methods.flagForReview = async function(reason) {
	this.isFlaggedForReview = true;
	this.flagReason = reason;
	await this.save();
	return this;
};

// [IMPROVED] Submit AI feedback
weeklyReportSchema.methods.submitAIFeedback = async function(rating, helpful, feedbackText) {
	this.aiOutputs.userFeedback = {
		rating,
		helpful,
		feedbackText,
		submittedAt: new Date()
	};
	await this.save();
	return this;
};

// ============================================================================
// STATIC METHODS
// ============================================================================
// [IMPROVED] Get latest report for user
weeklyReportSchema.statics.getLatestForUser = function(userId) {
	return this.findOne({ 
		userId, 
		deletedAt: null,
		status: 'complete'
	}).sort({ weekNumber: -1 });
};

// [IMPROVED] Get reports by trimester
weeklyReportSchema.statics.getByTrimester = function(userId, trimester) {
	return this.find({ 
		userId, 
		trimester,
		deletedAt: null
	}).sort({ weekNumber: 1 });
};

// [IMPROVED] Get reports with concerns
weeklyReportSchema.statics.getReportsWithConcerns = function(userId) {
	return this.find({
		userId,
		deletedAt: null,
		'summary.concernSeverity': { $in: ['moderate', 'high', 'urgent'] }
	}).sort({ weekNumber: -1 });
};

// [IMPROVED] Get reports shared with user (for partners)
weeklyReportSchema.statics.getSharedWithUser = function(userId) {
	return this.find({
		sharedWith: userId,
		deletedAt: null,
		status: 'complete'
	}).sort({ weekNumber: -1 }).populate('userId', 'firstName lastName profileImageUrl');
};

// [IMPROVED] Check if report exists for week
weeklyReportSchema.statics.existsForWeek = function(userId, weekNumber) {
	return this.exists({ userId, weekNumber, deletedAt: null });
};

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================
weeklyReportSchema.pre('save', function(next) {
	// Auto-calculate trimester from week number
	if (this.weekNumber) {
		if (this.weekNumber <= 12) this.trimester = 1;
		else if (this.weekNumber <= 27) this.trimester = 2;
		else this.trimester = 3;
	}
	
	// Auto-calculate end date if not set (7 days from start)
	if (this.startDate && !this.endDate) {
		this.endDate = new Date(this.startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
	}
	
	next();
});

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
// Exclude soft-deleted reports by default
weeklyReportSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
weeklyReportSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
