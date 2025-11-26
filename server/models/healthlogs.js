const mongoose = require('mongoose');

// ============================================================================
// BLOOD PRESSURE SUB-SCHEMA
// [IMPROVED] Separated systolic and diastolic for proper tracking
// ============================================================================
const bloodPressureSchema = new mongoose.Schema({
	systolic: { 
		type: Number, 
		min: [60, 'Systolic pressure too low'],
		max: [250, 'Systolic pressure too high']
	},
	diastolic: { 
		type: Number, 
		min: [40, 'Diastolic pressure too low'],
		max: [150, 'Diastolic pressure too high']
	},
	measuredAt: { type: Date, default: Date.now },
	// [IMPROVED] Position during measurement
	position: {
		type: String,
		enum: ['sitting', 'lying', 'standing'],
		default: 'sitting'
	},
	// [IMPROVED] Arm used
	arm: {
		type: String,
		enum: ['left', 'right'],
		default: 'left'
	}
}, { _id: false });

// ============================================================================
// FOOD INTAKE SUB-SCHEMA
// [IMPROVED] Enhanced nutrition tracking
// ============================================================================
const foodIntakeSchema = new mongoose.Schema({
	mealType: {
		type: String,
		enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
		required: true
	},
	time: { type: Date },
	foods: [{
		name: { type: String, trim: true, required: true },
		amount: { type: Number, min: 0 }, // in grams or servings
		unit: { type: String, enum: ['g', 'ml', 'serving', 'piece', 'cup', 'tbsp', 'tsp'], default: 'serving' },
		// [IMPROVED] Optional nutritional info
		calories: { type: Number, min: 0 },
		protein: { type: Number, min: 0 }, // grams
		carbs: { type: Number, min: 0 }, // grams
		fat: { type: Number, min: 0 }, // grams
		// [IMPROVED] Food category for analysis
		category: {
			type: String,
			enum: ['protein', 'dairy', 'grains', 'fruits', 'vegetables', 'fats', 'sweets', 'beverages', 'other']
		}
	}],
	// [IMPROVED] Meal notes
	notes: { type: String, trim: true, maxlength: 200 },
	// [IMPROVED] Photo of meal
	photoUrl: { type: String, trim: true },
	// [IMPROVED] Skip meal tracking
	skipped: { type: Boolean, default: false },
	skipReason: { type: String, enum: ['nausea', 'no_appetite', 'busy', 'other'] }
}, { _id: true });

// ============================================================================
// EXERCISE SUB-SCHEMA
// [IMPROVED] Detailed exercise tracking
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
	durationMinutes: { type: Number, min: 0, max: 300 },
	// [IMPROVED] Intensity tracking
	intensity: {
		type: String,
		enum: ['light', 'moderate', 'vigorous'],
		default: 'light'
	},
	// [IMPROVED] Calories burned (estimated)
	caloriesBurned: { type: Number, min: 0 },
	// [IMPROVED] How user felt during/after
	feeling: {
		type: String,
		enum: ['great', 'good', 'okay', 'tired', 'uncomfortable', 'painful']
	},
	// [IMPROVED] Time of exercise
	time: { type: Date },
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: true });

// ============================================================================
// SYMPTOM SUB-SCHEMA
// [IMPROVED] Detailed symptom tracking with severity
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
	severity: {
		type: Number,
		min: 1,
		max: 10,
		default: 5
	},
	// [IMPROVED] Duration of symptom
	duration: {
		value: { type: Number, min: 0 },
		unit: { type: String, enum: ['minutes', 'hours', 'days'], default: 'hours' }
	},
	// [IMPROVED] Time symptom occurred
	occurredAt: { type: Date },
	// [IMPROVED] What triggered it (if known)
	trigger: { type: String, trim: true, maxlength: 100 },
	// [IMPROVED] What helped relieve it
	relief: { type: String, trim: true, maxlength: 100 },
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: true });

// ============================================================================
// SLEEP SUB-SCHEMA
// [IMPROVED] Detailed sleep tracking
// ============================================================================
const sleepSchema = new mongoose.Schema({
	bedTime: { type: Date },
	wakeTime: { type: Date },
	totalHours: { type: Number, min: 0, max: 24 },
	// [IMPROVED] Sleep quality
	quality: {
		type: Number,
		min: 1,
		max: 5
	},
	// [IMPROVED] Number of times woken up
	timesAwakened: { type: Number, min: 0, default: 0 },
	awakeningReasons: [{
		type: String,
		enum: ['bathroom', 'discomfort', 'baby_movement', 'noise', 'pain', 'nightmare', 'other']
	}],
	// [IMPROVED] Sleep position
	primaryPosition: {
		type: String,
		enum: ['left_side', 'right_side', 'back', 'varied']
	},
	// [IMPROVED] Used pregnancy pillow
	usedPregnancyPillow: { type: Boolean },
	// [IMPROVED] Naps
	naps: [{
		startTime: { type: Date },
		durationMinutes: { type: Number, min: 0 }
	}],
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: false });

// ============================================================================
// MEDICATION SUB-SCHEMA
// [IMPROVED] Track medications and supplements
// ============================================================================
const medicationSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	type: {
		type: String,
		enum: ['prescription', 'otc', 'supplement', 'vitamin', 'other'],
		default: 'other'
	},
	dosage: { type: String, trim: true }, // e.g., "500mg", "1 tablet"
	frequency: { type: String, trim: true }, // e.g., "twice daily"
	takenAt: { type: Date, default: Date.now },
	// [IMPROVED] Common pregnancy supplements
	isPregnancyVitamin: { type: Boolean, default: false },
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: true });

// ============================================================================
// FETAL MOVEMENT SUB-SCHEMA
// [IMPROVED] Detailed kick counting
// ============================================================================
const fetalMovementSchema = new mongoose.Schema({
	// [IMPROVED] Kick count session
	startTime: { type: Date },
	endTime: { type: Date },
	count: { type: Number, min: 0 },
	// [IMPROVED] Duration to reach 10 kicks (important metric)
	minutesTo10Kicks: { type: Number, min: 0 },
	// [IMPROVED] Type of movement
	movementTypes: [{
		type: String,
		enum: ['kick', 'punch', 'roll', 'hiccup', 'stretch', 'other']
	}],
	// [IMPROVED] Position when counting
	motherPosition: {
		type: String,
		enum: ['lying_left', 'lying_right', 'sitting', 'standing']
	},
	// [IMPROVED] Time since last meal
	timeSinceMeal: {
		type: String,
		enum: ['just_ate', '1_hour', '2_hours', '3_plus_hours']
	},
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: true });

// ============================================================================
// CONTRACTION SUB-SCHEMA
// [IMPROVED] Track contractions (especially important in third trimester)
// ============================================================================
const contractionSchema = new mongoose.Schema({
	startTime: { type: Date, required: true },
	endTime: { type: Date },
	durationSeconds: { type: Number, min: 0 },
	// [IMPROVED] Time since last contraction
	intervalMinutes: { type: Number, min: 0 },
	// [IMPROVED] Pain level
	intensity: {
		type: Number,
		min: 1,
		max: 10
	},
	// [IMPROVED] Type of contraction
	type: {
		type: String,
		enum: ['braxton_hicks', 'possible_labor', 'labor', 'unsure'],
		default: 'unsure'
	},
	notes: { type: String, trim: true, maxlength: 200 }
}, { _id: true });

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
	pregnancyWeek: { type: Number, min: 1, max: 42 },
	trimester: { type: Number, enum: [1, 2, 3] },
	
	// ===== VITALS =====
	bloodPressure: bloodPressureSchema,
	
	weightKg: { 
		type: Number, 
		min: [20, 'Weight seems too low'],
		max: [300, 'Weight seems too high']
	},
	// [IMPROVED] Weight change tracking
	weightChangeKg: { type: Number }, // Change from previous log
	
	heartRateBpm: { 
		type: Number, 
		min: [40, 'Heart rate too low'],
		max: [200, 'Heart rate too high']
	},
	
	temperatureC: { 
		type: Number, 
		min: [35, 'Temperature too low'],
		max: [42, 'Temperature too high']
	},
	
	// [IMPROVED] Blood sugar for gestational diabetes tracking
	bloodSugar: {
		value: { type: Number, min: 0 },
		unit: { type: String, enum: ['mg/dL', 'mmol/L'], default: 'mg/dL' },
		measuredAt: { type: Date },
		timing: { type: String, enum: ['fasting', 'before_meal', 'after_meal', 'bedtime'] }
	},
	
	// ===== MOOD & ENERGY =====
	mood: { 
		type: String, 
		enum: ['very_happy', 'happy', 'neutral', 'anxious', 'sad', 'stressed', 'irritable', 'emotional', 'overwhelmed']
	},
	// [IMPROVED] Multiple mood entries throughout the day
	moodLog: [{
		mood: { type: String, enum: ['very_happy', 'happy', 'neutral', 'anxious', 'sad', 'stressed', 'irritable', 'emotional', 'overwhelmed'] },
		time: { type: Date },
		trigger: { type: String, trim: true, maxlength: 100 }
	}],
	
	energyLevel: { 
		type: Number, 
		min: 1, 
		max: 5
	},
	// [IMPROVED] Stress level
	stressLevel: {
		type: Number,
		min: 1,
		max: 5
	},
	
	// ===== SLEEP =====
	sleep: sleepSchema,
	// Legacy field for backward compatibility
	hoursSleept: { type: Number, min: 0, max: 24 },
	
	// ===== SYMPTOMS =====
	symptoms: [symptomSchema],
	
	// ===== EXERCISE =====
	exercises: [exerciseSchema],
	// [IMPROVED] Total exercise summary
	totalExerciseMinutes: { type: Number, min: 0, default: 0 },
	
	// ===== NUTRITION =====
	foodIntake: [foodIntakeSchema],
	// [IMPROVED] Hydration tracking
	hydration: {
		waterLiters: { type: Number, min: 0, max: 10 },
		otherFluidsLiters: { type: Number, min: 0, max: 10 },
		// [IMPROVED] Individual drink entries
		drinks: [{
			type: { type: String, enum: ['water', 'juice', 'milk', 'tea', 'coffee', 'other'] },
			amountMl: { type: Number, min: 0 },
			time: { type: Date }
		}]
	},
	// [IMPROVED] Caffeine intake (important to track)
	caffeineIntakeMg: { type: Number, min: 0 },
	
	// ===== MEDICATIONS & SUPPLEMENTS =====
	medications: [medicationSchema],
	
	// ===== FETAL TRACKING =====
	fetalMovement: fetalMovementSchema,
	// [IMPROVED] Multiple kick count sessions per day
	kickCountSessions: [fetalMovementSchema],
	
	// [IMPROVED] Contractions (for third trimester)
	contractions: [contractionSchema],
	
	// ===== APPOINTMENTS & REMINDERS =====
	// [IMPROVED] Track doctor visits
	doctorVisit: {
		visited: { type: Boolean, default: false },
		type: { type: String, enum: ['routine', 'ultrasound', 'lab_work', 'specialist', 'emergency', 'other'] },
		notes: { type: String, trim: true, maxlength: 500 },
		nextAppointment: { type: Date }
	},
	
	// ===== GENERAL =====
	notes: { 
		type: String, 
		trim: true,
		maxlength: [2000, 'Notes cannot exceed 2000 characters']
	},
	
	// [IMPROVED] Photo/media attachments
	attachments: [{
		type: { type: String, enum: ['photo', 'document', 'ultrasound'] },
		url: { type: String, trim: true },
		caption: { type: String, trim: true, maxlength: 200 },
		uploadedAt: { type: Date, default: Date.now }
	}],
	
	// ===== LOG METADATA =====
	// [IMPROVED] Log completion status
	isComplete: { type: Boolean, default: false },
	completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
	
	// [IMPROVED] Which sections were filled
	sectionsCompleted: {
		vitals: { type: Boolean, default: false },
		mood: { type: Boolean, default: false },
		sleep: { type: Boolean, default: false },
		symptoms: { type: Boolean, default: false },
		exercise: { type: Boolean, default: false },
		nutrition: { type: Boolean, default: false },
		fetalMovement: { type: Boolean, default: false }
	},
	
	// [IMPROVED] AI analysis flags
	aiAnalyzed: { type: Boolean, default: false },
	aiFlags: [{
		type: { type: String, enum: ['concern', 'warning', 'positive', 'recommendation'] },
		message: { type: String, trim: true },
		severity: { type: String, enum: ['low', 'medium', 'high'] },
		category: { type: String, trim: true }
	}],
	
	// [IMPROVED] Shared with associated users
	sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
	
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
// [IMPROVED] Blood pressure reading as string
healthLogSchema.virtual('bloodPressureReading').get(function() {
	if (this.bloodPressure?.systolic && this.bloodPressure?.diastolic) {
		return `${this.bloodPressure.systolic}/${this.bloodPressure.diastolic}`;
	}
	return null;
});

// [IMPROVED] Blood pressure status
healthLogSchema.virtual('bloodPressureStatus').get(function() {
	if (!this.bloodPressure?.systolic || !this.bloodPressure?.diastolic) return null;
	
	const sys = this.bloodPressure.systolic;
	const dia = this.bloodPressure.diastolic;
	
	if (sys < 90 || dia < 60) return 'low';
	if (sys < 120 && dia < 80) return 'normal';
	if (sys < 140 && dia < 90) return 'elevated';
	if (sys >= 140 || dia >= 90) return 'high';
	return 'normal';
});

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
	
	const concerningSymptoms = ['bleeding', 'spotting', 'severe_headache', 'blurred_vision', 
		'decreased_fetal_movement', 'contractions', 'fainting'];
	
	return this.symptoms.some(s => 
		concerningSymptoms.includes(s.symptom) || s.severity >= 8
	);
});

// [IMPROVED] Symptom count
healthLogSchema.virtual('symptomCount').get(function() {
	return this.symptoms?.length || 0;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// [IMPROVED] Add symptom
healthLogSchema.methods.addSymptom = async function(symptomData) {
	this.symptoms.push(symptomData);
	this.sectionsCompleted.symptoms = true;
	await this.updateCompletionPercentage();
	await this.save();
	return this;
};

// [IMPROVED] Add exercise
healthLogSchema.methods.addExercise = async function(exerciseData) {
	this.exercises.push(exerciseData);
	this.totalExerciseMinutes = this.exercises.reduce((sum, ex) => sum + (ex.durationMinutes || 0), 0);
	this.sectionsCompleted.exercise = true;
	await this.updateCompletionPercentage();
	await this.save();
	return this;
};

// [IMPROVED] Add meal
healthLogSchema.methods.addMeal = async function(mealData) {
	this.foodIntake.push(mealData);
	this.sectionsCompleted.nutrition = true;
	await this.updateCompletionPercentage();
	await this.save();
	return this;
};

// [IMPROVED] Add water intake
healthLogSchema.methods.addWater = async function(amountMl) {
	if (!this.hydration) {
		this.hydration = { waterLiters: 0, drinks: [] };
	}
	
	this.hydration.drinks.push({
		type: 'water',
		amountMl,
		time: new Date()
	});
	
	// Update total
	this.hydration.waterLiters = this.hydration.drinks
		.filter(d => d.type === 'water')
		.reduce((sum, d) => sum + (d.amountMl || 0), 0) / 1000;
	
	await this.save();
	return this;
};

// [IMPROVED] Record kick count session
healthLogSchema.methods.addKickCountSession = async function(sessionData) {
	this.kickCountSessions.push(sessionData);
	this.sectionsCompleted.fetalMovement = true;
	await this.updateCompletionPercentage();
	await this.save();
	return this;
};

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
		vitals: !!(this.bloodPressure?.systolic || this.weightKg || this.heartRateBpm || this.temperatureC),
		mood: !!(this.mood || this.energyLevel),
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
	startOfDay.setHours(0, 0, 0, 0);
	
	const endOfDay = new Date(date);
	endOfDay.setHours(23, 59, 59, 999);
	
	return this.findOne({
		userId,
		logDate: { $gte: startOfDay, $lte: endOfDay },
		deletedAt: null
	});
};

// [IMPROVED] Get or create log for today
healthLogSchema.statics.getOrCreateToday = async function(userId, pregnancyWeek = null, trimester = null) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	
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
		mood: { $exists: true, $ne: null },
		logDate: { $gte: startDate },
		deletedAt: null
	})
	.select('logDate mood energyLevel stressLevel')
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
   
