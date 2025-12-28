const mongoose = require('mongoose');

// ============================================================================
// FOOD INTAKE SUB-SCHEMA
// ============================================================================
const foodIntakeSchema = new mongoose.Schema({
	mealType: {
		type: String,
		enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
		required: true
	},
	time: { type: Date, default: null },
	foods: {
		type: [{
			name: { type: String, trim: true, required: true },
			amount: { type: Number, min: 0, default: null },
			unit: { type: String, enum: ['g', 'ml', 'serving', 'piece', 'cup', 'tbsp', 'tsp'], default: 'serving' }
		}],
		default: []
	},
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// EXERCISE SUB-SCHEMA
// ============================================================================
const exerciseSchema = new mongoose.Schema({
	type: { 
		type: String, 
		required: true,
		trim: true,
		// [IMPROVED] Common pregnancy-safe exercises
		enum: [
			'walking', 'swimming', 'prenatal_yoga', 'stretching', 
			'stationary_cycling', 'low_impact_aerobics', 'pilates',
			'kegel_exercises', 'water_aerobics', 'dancing',
			'strength_training', 'meditation', 'breathing_exercises',
			'other'
		]
	},
	durationMinutes: { type: Number, min: 0, max: 300, default: null },
	// [IMPROVED] Intensity tracking
	intensity: {
		type: String,
		enum: ['light', 'moderate', 'vigorous'],
		default: 'light'
	},
	// [IMPROVED] How user felt during/after
	feeling: {
		type: String,
		enum: ['great', 'good', 'okay', 'tired', 'uncomfortable', 'painful', null],
		default: null
	},
	// [IMPROVED] Time of exercise
	time: { type: Date, default: null },
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// SYMPTOM SUB-SCHEMA
// ============================================================================
const symptomSchema = new mongoose.Schema({
	symptom: {
		type: String,
		required: true,
		enum: [
			// Common pregnancy symptoms
			'nausea', 'vomiting', 'morning_sickness',
			'headache', 'migraine',
			'fatigue', 'dizziness', 'fainting',
			'back_pain', 'pelvic_pain', 'round_ligament_pain',
			'leg_cramps', 'swelling_feet', 'swelling_hands', 'swelling_face',
			'heartburn', 'indigestion', 'constipation', 'bloating',
			'frequent_urination', 'incontinence',
			'breast_tenderness', 'nipple_changes',
			'skin_changes', 'stretch_marks', 'itching',
			'shortness_of_breath', 'nasal_congestion',
			'insomnia', 'vivid_dreams', 'restless_legs',
			'food_aversions', 'food_cravings',
			'mood_swings', 'anxiety', 'crying_spells',
			'braxton_hicks', 'contractions',
			'vaginal_discharge', 'spotting', 'bleeding',
			'decreased_fetal_movement', 'increased_fetal_movement',
			'other'
		]
	},
	severity: { type: Number, min: 1, max: 10, default: 5 },
	// [IMPROVED] Time symptom occurred
	ocurredAt: { type: Date, default: null },
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// SLEEP SUB-SCHEMA
// ============================================================================
const sleepSchema = new mongoose.Schema({
	bedTime: { type: Date, default: null },
	wakeTime: { type: Date, default: null },
	totalHours: { type: Number, min: 0, max: 24, default: null },
	// [IMPROVED] Sleep quality
	quality: { type: Number, min: 1, max: 5, default: null },
	// [IMPROVED] Number of times woken up
	timesAwakened: { type: Number, min: 0, default: 0 },
	awakeningReasons: {
		type: [{
			type: String,
			enum: ['bathroom', 'discomfort', 'baby_movement', 'noise', 'pain', 'nightmare', 'other']
		}],
		default: []
	},
	// [IMPROVED] Sleep position
	primaryPosition: {
		type: String,
		enum: ['left_side', 'right_side', 'back', 'varied', null],
		default: null
	},
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: false, minimize: false });

// ============================================================================
// FETAL MOVEMENT SUB-SCHEMA
// ============================================================================
const fetalMovementSchema = new mongoose.Schema({
	// [IMPROVED] Kick count session
	startTime: { type: Date, default: null },
	endTime: { type: Date, default: null },
	count: { type: Number, min: 0, default: null },
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// CONTRACTION SUB-SCHEMA
// ============================================================================
const contractionSchema = new mongoose.Schema({
	startTime: { type: Date, required: true },
	endTime: { type: Date, default: null },
	durationSeconds: { type: Number, min: 0, default: null },
	// [IMPROVED] Time since last contraction
	intervalMinutes: { type: Number, min: 0, default: null },
	// [IMPROVED] Pain level
	intensity: { type: Number, min: 1, max: 10, default: null },
	// [IMPROVED] Type of contraction
	type: {
		type: String,
		enum: ['braxton_hicks', 'possible_labor', 'labor', 'unsure'],
		default: 'unsure'
	},
	notes: { type: String, trim: true, maxlength: 200, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// MAIN HEALTH LOG SCHEMA
// ============================================================================
const healthLogSchema = new mongoose.Schema({
	// User reference
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: [true, 'User ID is required'],
		index: true
	},
	
	// [IMPROVED] Log date (separate from creation time)
	logDate: { 
		type: Date, 
		required: [true, 'Log date is required'],
		index: true
	},
	
	// [IMPROVED] Pregnancy week at time of log
	pregnancyWeek: { type: Number, min: 1, max: 42, default: null },
	trimester: { type: Number, enum: [1, 2, 3, null], default: null },
	
	// ===== VITALS =====
	weightKg: { type: Number, min: 20, max: 300, default: null },
	
	heartRateBpm: { 
		type: Number, 
		min: [40, 'Heart rate too low'],
		max: [200, 'Heart rate too high'],
		default: null
	},
	
	// [IMPROVED] Blood pressure tracking
	bloodPressure: {
		type: {
			systolic: { type: Number, min: 70, max: 200, default: null },
			diastolic: { type: Number, min: 40, max: 130, default: null }
		},
		default: () => ({ systolic: null, diastolic: null })
	},
	
	// [IMPROVED] Blood sugar for gestational diabetes tracking
	bloodSugar: {
		type: {
			value: { type: Number, min: 0, default: null },
			unit: { type: String, enum: ['mg/dL', 'mmol/L'], default: 'mg/dL' },
			measuredAt: { type: Date, default: null },
			timing: { type: String, enum: ['fasting', 'before_meal', 'after_meal', 'bedtime', null], default: null }
		},
		default: () => ({ value: null, unit: 'mg/dL', measuredAt: null, timing: null })
	},
	
	// ===== MOOD & ENERGY =====
	// [IMPROVED] Multiple mood entries throughout the day
	moodLog: {
		type: [{
			mood: { type: String, enum: ['very_happy', 'happy', 'neutral', 'anxious', 'sad', 'stressed', 'irritable', 'emotional', 'overwhelmed'] },
			time: { type: Date, default: null },
			trigger: { type: String, trim: true, maxlength: 100, default: null }
		}],
		default: []
	},
	
	energyLevel: { type: Number, min: 1, max: 5, default: null },
	// [IMPROVED] Stress level
	stressLevel: { type: Number, min: 1, max: 5, default: null },
	
	// ===== SLEEP =====
	sleep: { 
		type: sleepSchema, 
		default: () => ({
			bedTime: null,
			wakeTime: null,
			totalHours: null,
			quality: null,
			timesAwakened: 0,
			awakeningReasons: [],
			primaryPosition: null,
			notes: null
		})
	},
	// Legacy field for backward compatibility
	hoursSleept: { type: Number, min: 0, max: 24, default: null },
	
	// ===== SYMPTOMS =====
	symptoms: { type: [symptomSchema], default: [] },
	
	// ===== EXERCISE =====
	exercises: { type: [exerciseSchema], default: [] },
	
	// ===== NUTRITION =====
	foodIntake: { type: [foodIntakeSchema], default: [] },
	// [IMPROVED] Hydration tracking
	hydration: {
		type: {
			waterLiters: { type: Number, min: 0, max: 10, default: 0 },
			otherFluidsLiters: { type: Number, min: 0, max: 10, default: 0 },
			// [IMPROVED] Individual drink entries
			drinks: {
				type: [{
					type: { type: String, enum: ['water', 'juice', 'milk', 'tea', 'coffee', 'other'] },
					amountMl: { type: Number, min: 0, default: null },
					time: { type: Date, default: null }
				}],
				default: []
			}
		},
		default: () => ({ waterLiters: 0, otherFluidsLiters: 0, drinks: [] })
	},
	// [IMPROVED] Caffeine intake (important to track)
	caffeineIntakeMg: { type: Number, min: 0, default: null },
	
	// ===== FETAL TRACKING =====
	fetalMovement: { 
		type: fetalMovementSchema, 
		default: () => ({
			startTime: null,
			endTime: null,
			count: null,
			notes: null
		})
	},
	
	// ===== APPOINTMENTS & REMINDERS ===
	// [IMPROVED] Track doctor visits
	doctorVisit: {
		visited: { type: Boolean, default: false },
		visitType: { type: String, enum: ['routine', 'ultrasound', 'lab_work', 'specialist', 'emergency', 'other', null], default: null },
		notes: { type: String, trim: true, maxlength: 500, default: null },
		nextAppointment: { type: Date, default: null }
	},
	
	// ===== GENERAL =====
	notes: { type: String, trim: true, maxlength: 2000, default: null },
	attachments: {
		type: [{
			type: { type: String, enum: ['photo', 'document', 'ultrasound'] },
			url: { type: String, trim: true },
			caption: { type: String, trim: true, maxlength: 200, default: null },
			uploadedAt: { type: Date, default: Date.now }
		}],
		default: []
	},
	
	// ===== LOG METADATA =====
	// [IMPROVED] Log completion status
	isComplete: { type: Boolean, default: false },
	completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
	
	// [IMPROVED] Which sections were filled
	sectionsCompleted: {
		type: {
			vitals: { type: Boolean, default: false },
			mood: { type: Boolean, default: false },
			sleep: { type: Boolean, default: false },
			symptoms: { type: Boolean, default: false },
			exercise: { type: Boolean, default: false },
			nutrition: { type: Boolean, default: false },
			fetalMovement: { type: Boolean, default: false }
		},
		default: () => ({
			vitals: false, mood: false, sleep: false, symptoms: false,
			exercise: false, nutrition: false, fetalMovement: false
		})
	},
	
	// [IMPROVED] AI analysis flags
	aiAnalyzed: { type: Boolean, default: false },
	aiFlags: {
		type: [{
			type: { type: String, enum: ['concern', 'warning', 'positive', 'recommendation'] },
			message: { type: String, trim: true },
			severity: { type: String, enum: ['low', 'medium', 'high'] },
			category: { type: String, trim: true }
		}],
		default: []
	},
	
	// [IMPROVED] Shared with associated users
	sharedWith: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
	
	// Soft delete
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true },
	minimize: false
});

// ============================================================================
// INDEXES
// ============================================================================
healthLogSchema.index({ userId: 1, logDate: -1 });
healthLogSchema.index({ userId: 1, logDate: 1 }, { unique: true }); // One log per day per user
healthLogSchema.index({ userId: 1, pregnancyWeek: 1 });
healthLogSchema.index({ userId: 1, 'symptoms.symptom': 1 });
healthLogSchema.index({ logDate: -1 });
healthLogSchema.index({ deletedAt: 1 });
healthLogSchema.index({ sharedWith: 1 });
// [IMPROVED] Index for finding logs with concerns
healthLogSchema.index({ 'aiFlags.severity': 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
// [IMPROVED] Total calories consumed
healthLogSchema.virtual('totalCalories').get(function() {
	if (!this.foodIntake) return 0;
	
	return this.foodIntake.reduce((total, meal) => {
		const mealCalories = meal.foods?.reduce((sum, food) => sum + (food.calories || 0), 0) || 0;
		return total + mealCalories;
	}, 0);
});

// [IMPROVED] Total water intake
healthLogSchema.virtual('totalWaterLiters').get(function() {
	let total = this.hydration?.waterLiters || 0;
	
	if (this.hydration?.drinks) {
		total += this.hydration.drinks
			.filter(d => d.type === 'water')
			.reduce((sum, d) => sum + (d.amountMl || 0) / 1000, 0);
	}
	
	return total;
});

// [IMPROVED] Has concerning symptoms
healthLogSchema.virtual('hasConcerningSymptoms').get(function() {
	if (!this.symptoms) return false;
	
	const concerningSymptoms = ['bleeding', 'spotting', 'decreased_fetal_movement', 'contractions', 'fainting'];
	
	return this.symptoms.some(s => concerningSymptoms.includes(s.symptom) || s.severity >= 8);
});

// [IMPROVED] Symptom count
healthLogSchema.virtual('symptomCount').get(function() {
	return this.symptoms?.length || 0;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// [IMPROVED] Update completion percentage
healthLogSchema.methods.updateCompletionPercentage = function() {
	const sections = this.sectionsCompleted;
	const completed = Object.values(sections).filter(v => v).length;
	const total = Object.keys(sections).length;
	this.completionPercentage = Math.round((completed / total) * 100);
	this.isComplete = this.completionPercentage >= 70; // Consider 70%+ as complete
};

// [IMPROVED] Calculate section completion
healthLogSchema.methods.calculateSectionsCompleted = function() {
	this.sectionsCompleted = {
		vitals: !!(this.weightKg || this.heartRateBpm || this.bloodPressure?.systolic || this.bloodPressure?.diastolic),
		mood: !!(this.moodLog?.length > 0 || this.energyLevel),
		sleep: !!(this.sleep?.totalHours || this.hoursSleept),
		symptoms: this.symptoms?.length > 0,
		exercise: this.exercises?.length > 0,
		nutrition: this.foodIntake?.length > 0,
		fetalMovement: !!(this.fetalMovement?.count || this.kickCountSessions?.length > 0)
	};
	this.updateCompletionPercentage();
};

// ============================================================================
// STATIC METHODS
// ============================================================================
// [IMPROVED] Get log for specific date
healthLogSchema.statics.getByDate = function(userId, date) {
	const startOfDay = new Date(date);
	startOfDay.setUTCHours(0, 0, 0, 0);
	
	const endOfDay = new Date(date);
	endOfDay.setUTCHours(23, 59, 59, 999);
	
	return this.findOne({
		userId,
		logDate: { $gte: startOfDay, $lte: endOfDay },
		deletedAt: null
	});
};

// [IMPROVED] Get or create log for today
healthLogSchema.statics.getOrCreateToday = async function(userId, pregnancyWeek = null, trimester = null) {
	const today = new Date();
	// Use UTC to avoid timezone issues
	today.setUTCHours(0, 0, 0, 0);
	
	let log = await this.findOne({
		userId,
		logDate: today,
		deletedAt: null
	});
	
	if (!log) {
		log = new this({
			userId,
			logDate: today,
			pregnancyWeek,
			trimester
		});
		await log.save();
	}
	
	return log;
};

// [IMPROVED] Get logs for date range
healthLogSchema.statics.getByDateRange = function(userId, startDate, endDate) {
	return this.find({
		userId,
		logDate: { $gte: startDate, $lte: endDate },
		deletedAt: null
	}).sort({ logDate: 1 });
};

// [IMPROVED] Get logs for pregnancy week
healthLogSchema.statics.getByPregnancyWeek = function(userId, week) {
	return this.find({
		userId,
		pregnancyWeek: week,
		deletedAt: null
	}).sort({ logDate: 1 });
};

// [IMPROVED] Get logs with specific symptom
healthLogSchema.statics.getBySymptom = function(userId, symptom) {
	return this.find({
		userId,
		'symptoms.symptom': symptom,
		deletedAt: null
	}).sort({ logDate: -1 });
};

// [IMPROVED] Get recent logs
healthLogSchema.statics.getRecent = function(userId, days = 7) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	return this.find({
		userId,
		logDate: { $gte: startDate },
		deletedAt: null
	}).sort({ logDate: -1 });
};

// Get all logs
healthLogSchema.statics.getAllLogs = function(userId) {
	return this.find({
		userId,
		deletedAt: null
	}).sort({ logDate: -1 });
}

// [IMPROVED] Get logs with concerns
healthLogSchema.statics.getWithConcerns = function(userId) {
	return this.find({
		userId,
		'aiFlags.severity': { $in: ['medium', 'high'] },
		deletedAt: null
	}).sort({ logDate: -1 });
};

// [IMPROVED] Get weight history
healthLogSchema.statics.getWeightHistory = function(userId) {
	return this.find({
		userId,
		weightKg: { $exists: true, $ne: null },
		deletedAt: null
	})
	.select('logDate weightKg pregnancyWeek')
	.sort({ logDate: 1 });
};

// [IMPROVED] Get mood history
healthLogSchema.statics.getMoodHistory = function(userId, days = 30) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	return this.find({
		userId,
		$or: [
			{ moodLog: { $exists: true, $ne: [] } },
			{ energyLevel: { $exists: true, $ne: null } },
			{ stressLevel: { $exists: true, $ne: null } }
		],
		logDate: { $gte: startDate },
		deletedAt: null
	})
	.select('logDate moodLog energyLevel stressLevel')
	.sort({ logDate: 1 });
};

// [IMPROVED] Get sleep history
healthLogSchema.statics.getSleepHistory = function(userId, days = 30) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	return this.find({
		userId,
		$or: [
			{ 'sleep.totalHours': { $exists: true } },
			{ hoursSleept: { $exists: true } }
		],
		logDate: { $gte: startDate },
		deletedAt: null
	})
	.select('logDate sleep hoursSleept')
	.sort({ logDate: 1 });
};

// [IMPROVED] Calculate weekly averages
healthLogSchema.statics.getWeeklyAverages = async function(userId, weekNumber) {
	const logs = await this.find({
		userId,
		pregnancyWeek: weekNumber,
		deletedAt: null
	});
	
	if (logs.length === 0) return null;
	
	const avg = (arr, key) => {
		const values = arr.map(l => l[key]).filter(v => v != null);
		return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
	};
	
	return {
		weekNumber,
		daysLogged: logs.length,
		avgWeight: avg(logs, 'weightKg'),
		avgHeartRate: avg(logs, 'heartRateBpm'),
		avgSleep: avg(logs.map(l => l.sleep?.totalHours || l.hoursSleept).filter(Boolean), x => x),
		avgEnergy: avg(logs, 'energyLevel'),
		avgExerciseMinutes: avg(logs, 'totalExerciseMinutes'),
		symptomFrequency: logs.reduce((acc, log) => {
			log.symptoms?.forEach(s => {
				acc[s.symptom] = (acc[s.symptom] || 0) + 1;
			});
			return acc;
		}, {})
	};
};

// [IMPROVED] Get logs shared with user (for partners)
healthLogSchema.statics.getSharedWithUser = function(userId) {
	return this.find({
		sharedWith: userId,
		deletedAt: null
	})
	.sort({ logDate: -1 })
	.populate('userId', 'firstName lastName profileImageUrl');
};

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================
healthLogSchema.pre('save', function(next) {
	// Calculate sections completed
	this.calculateSectionsCompleted();
	
	// Auto-calculate total exercise minutes
	if (this.exercises?.length > 0) {
		this.totalExerciseMinutes = this.exercises.reduce((sum, ex) => sum + (ex.durationMinutes || 0), 0);
	}
	
	next();
});

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
// Exclude soft-deleted logs by default
healthLogSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
healthLogSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

module.exports = mongoose.model('HealthLog', healthLogSchema);

