const mongoose = require('mongoose');

// ============================================================================
// SUMMARY SUB-SCHEMA (Aggregated from Health Logs)
// ============================================================================
const summarySchema = new mongoose.Schema({
	
	// Aggregated symptoms from health logs
	keySymptoms: [{ type: String, trim: true }],
	mostFrequentSymptoms: [{
		symptom: { type: String, trim: true },
		frequency: { type: Number, min: 0 },
		avgSeverity: { type: Number, min: 1, max: 10 }
	}],
	
	// Energy and mood (from health log energyLevel, stressLevel, moodLog)
	avgEnergyLevel: { type: Number, min: 1, max: 5 },
	avgStressLevel: { type: Number, min: 1, max: 5 },
	
	// Most common mood from moodLog array
	dominantMoods: [{
		mood: { 
			type: String, 
			enum: ['very_happy', 'happy', 'neutral', 'anxious', 'sad', 'stressed', 'irritable', 'emotional', 'overwhelmed']
		},
		frequency: { type: Number, min: 0 }
	}],
	
	// Concerns detected from AI flags in health logs
	aiFlags: [{
		type: { type: String, enum: ['concern', 'warning', 'positive', 'recommendation'] },
		message: { type: String, trim: true },
		severity: { type: String, enum: ['low', 'medium', 'high'] },
		category: { type: String, trim: true },
		count: { type: Number, min: 0 }
	}],
	
	// Compliance tracking (based on health logs submitted)
	daysLogged: { type: Number, min: 0, max: 7, default: 0 },
	avgCompletionPercentage: { type: Number, min: 0, max: 100 }
}, { _id: false });

// ============================================================================
// VITALS SUMMARY SUB-SCHEMA (Aggregated from Health Logs)
// ============================================================================
const vitalsSummarySchema = new mongoose.Schema({
	// Blood Pressure (from health log bloodPressure)
	avgSystolic: { type: Number, min: 0 },
	avgDiastolic: { type: Number, min: 0 },
	maxSystolic: { type: Number, min: 0 },
	maxDiastolic: { type: Number, min: 0 },
	minSystolic: { type: Number, min: 0 },
	minDiastolic: { type: Number, min: 0 },
	
	// Weight (from health log weightKg)
	avgWeightKg: { type: Number, min: 0 },
	weightChangeKg: { type: Number },
	minWeightKg: { type: Number, min: 0 },
	maxWeightKg: { type: Number, min: 0 },
	
	// Heart Rate (from health log heartRateBpm)
	avgHeartRateBpm: { type: Number, min: 0 },
	maxHeartRateBpm: { type: Number, min: 0 },
	minHeartRateBpm: { type: Number, min: 0 },
	
	// Blood Sugar (from health log bloodSugar)
	avgBloodSugarValue: { type: Number, min: 0 },
	maxBloodSugarValue: { type: Number, min: 0 },
	minBloodSugarValue: { type: Number, min: 0 },
	bloodSugarUnit: { type: String, enum: ['mg/dL', 'mmol/L'], default: 'mg/dL' },
	bloodSugarReadings: { type: Number, min: 0 }, // Count of readings
	
	// Fetal movement (from health log fetalMovement)
	avgFetalMovementCount: { type: Number, min: 0 },
	totalFetalMovements: { type: Number, min: 0 },
	fetalMovementSessions: { type: Number, min: 0 }
}, { _id: false });

// ============================================================================
// ACTIVITIES SUMMARY SUB-SCHEMA (Aggregated from Health Logs)
// ============================================================================
const activitiesSummarySchema = new mongoose.Schema({
	// Exercise (from health log exercises array)
	totalExerciseMinutes: { type: Number, min: 0, default: 0 },
	avgExerciseMinutesPerDay: { type: Number, min: 0 },
	
	// Exercise types breakdown
	exercisesByType: [{
		type: { 
			type: String,
			enum: [
				'walking', 'swimming', 'prenatal_yoga', 'stretching', 
				'stationary_cycling', 'low_impact_aerobics', 'pilates',
				'kegel_exercises', 'water_aerobics', 'dancing',
				'strength_training', 'meditation', 'breathing_exercises',
				'other'
			]
		},
		totalMinutes: { type: Number, min: 0 },
		sessionsCount: { type: Number, min: 0 },
		avgIntensity: { type: String, enum: ['light', 'moderate', 'vigorous'] }
	}],
	
	// Sleep (from health log sleep and hoursSleept)
	avgSleepHours: { type: Number, min: 0, max: 24 },
	totalSleepHours: { type: Number, min: 0 },
	avgSleepQuality: { type: Number, min: 1, max: 5 },
	
	
	
	// Hydration (from health log hydration)
	avgWaterIntakeLiters: { type: Number, min: 0 },
	totalWaterIntakeLiters: { type: Number, min: 0 },
	
	
	
	// Caffeine (from health log caffeineIntakeMg)
	avgCaffeineIntakeMg: { type: Number, min: 0 },
	totalCaffeineIntakeMg: { type: Number, min: 0 },
	daysWithCaffeine: { type: Number, min: 0, max: 7 },
	
	// Nutrition (from health log foodIntake)
	totalMealsLogged: { type: Number, min: 0 },
	avgMealsPerDay: { type: Number, min: 0 },
	mealsByType: [{
		mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'] },
		count: { type: Number, min: 0 }
	}]
}, { _id: false });


// ============================================================================
// CONTRACTIONS SUMMARY SUB-SCHEMA
// ============================================================================
const contractionsSummarySchema = new mongoose.Schema({
	totalContractions: { type: Number, min: 0, default: 0 },
	avgDurationSeconds: { type: Number, min: 0 },
	avgIntervalMinutes: { type: Number, min: 0 },
	avgIntensity: { type: Number, min: 1, max: 10 },
	contractionsByType: [{
		type: { type: String, enum: ['braxton_hicks', 'possible_labor', 'labor', 'unsure'] },
		count: { type: Number, min: 0 }
	}]
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
	
	// Summaries (all aggregated from health logs)
	summary: { type: summarySchema, default: () => ({}) },
	vitalsSummary: { type: vitalsSummarySchema, default: () => ({}) },
	activities: { type: activitiesSummarySchema, default: () => ({}) },
	contractions: { type: contractionsSummarySchema, default: () => ({}) },
	
	// Source health logs reference
	healthLogIds: [{ 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'HealthLog'
	}],
	
	// Report status
	status: {
		type: String,
		enum: ['generating', 'complete', 'incomplete', 'error'],
		default: 'generating'
	},
	
	// Comparison with previous week
	comparisonWithPreviousWeek: {
		weightTrend: { type: String, enum: ['up', 'down', 'stable', 'no_data'] },
		energyTrend: { type: String, enum: ['up', 'down', 'stable', 'no_data'] },
		sleepTrend: { type: String, enum: ['better', 'worse', 'stable', 'no_data'] },
		exerciseTrend: { type: String, enum: ['more', 'less', 'same', 'no_data'] },
		symptomsTrend: { type: String, enum: ['more', 'less', 'same', 'no_data'] }
	},
	
	
	
	// Soft delete
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
weeklyReportSchema.index({ createdAt: -1 });
weeklyReportSchema.index({ deletedAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
weeklyReportSchema.virtual('isCurrentWeek').get(function() {
	const now = new Date();
	return now >= this.startDate && now <= this.endDate;
});

weeklyReportSchema.virtual('reportDays').get(function() {
	if (this.startDate && this.endDate) {
		const diffTime = this.endDate - this.startDate;
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	}
	return 7;
});

weeklyReportSchema.virtual('weekDisplay').get(function() {
	return `Week ${this.weekNumber} (Trimester ${this.trimester})`;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
weeklyReportSchema.methods.shareWith = async function(userId) {
	if (!this.sharedWith.includes(userId)) {
		this.sharedWith.push(userId);
		await this.save();
	}
	return this;
};

weeklyReportSchema.methods.unshareWith = async function(userId) {
	this.sharedWith = this.sharedWith.filter(id => id.toString() !== userId.toString());
	await this.save();
	return this;
};

weeklyReportSchema.methods.addAssociatedNote = async function(userId, note) {
	this.associatedUserNotes.push({
		userId,
		note,
		createdAt: new Date()
	});
	await this.save();
	return this;
};

weeklyReportSchema.methods.flagForReview = async function(reason) {
	this.isFlaggedForReview = true;
	this.flagReason = reason;
	await this.save();
	return this;
};

// ============================================================================
// STATIC METHODS
// ============================================================================
weeklyReportSchema.statics.getLatestForUser = function(userId) {
	return this.findOne({ 
		userId, 
		deletedAt: null,
		status: 'complete'
	}).sort({ weekNumber: -1 });
};

weeklyReportSchema.statics.getByTrimester = function(userId, trimester) {
	return this.find({ 
		userId, 
		trimester,
		deletedAt: null
	}).sort({ weekNumber: 1 });
};

weeklyReportSchema.statics.getReportsWithConcerns = function(userId) {
	return this.find({
		userId,
		deletedAt: null,
		'summary.aiFlags': { 
			$elemMatch: { severity: { $in: ['medium', 'high'] } }
		}
	}).sort({ weekNumber: -1 });
};

weeklyReportSchema.statics.getSharedWithUser = function(userId) {
	return this.find({
		sharedWith: userId,
		deletedAt: null,
		status: 'complete'
	}).sort({ weekNumber: -1 }).populate('userId', 'firstName lastName profileImageUrl');
};

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
