const mongoose = require('mongoose');

// ============================================================================
// EXERCISE ITEM SUB-SCHEMA
// ============================================================================
const exerciseItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String }, // e.g., "cardio", "strength", "flexibility"
    durationMinutes: { type: Number, default: 0, min: 0 },
    intensity: { 
        type: String, 
        enum: ['low', 'moderate', 'high'],
        default: 'moderate'
    },
    targetAreas: [{ type: String }],
    instructions: { type: String },
    modifications: { type: String },
    benefits: [{ type: String }],
    equipmentNeeded: [{ type: String }]
}, { _id: false });

// ============================================================================
// DAILY EXERCISE PLAN SUB-SCHEMA
// ============================================================================
const dailyExercisePlanSchema = new mongoose.Schema({
    day: { type: String, required: true }, // e.g., "Monday", "Tuesday"
    restDay: { type: Boolean, default: false },
    exercises: [exerciseItemSchema],
    totalMinutes: { type: Number, default: 0, min: 0 },
    notes: { type: String }
}, { _id: false });

// ============================================================================
// EXERCISE PLAN MAIN SCHEMA
// ============================================================================
const exercisePlanSchema = new mongoose.Schema({
    // User reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Pregnancy context
    pregnancyWeek: {
        type: Number,
        required: true,
        min: 1,
        max: 42
    },
    trimester: {
        type: Number,
        required: true,
        min: 1,
        max: 3
    },

    // Plan summary
    summary: {
        planReason: { type: String },
        keyBenefits: [{ type: String }],
        weeklyFocus: { type: String }
    },

    // Weekly exercise plan (7 days)
    dailyExercisePlan: [dailyExercisePlanSchema],

    // Weekly totals
    weeklyTotals: {
        totalMinutes: { type: Number, default: 0 },
        activeDays: { type: Number, default: 0 },
        restDays: { type: Number, default: 0 }
    },

    // Exercises to avoid
    exercisesToAvoid: [{ type: String }],

    // Safety notes and tips
    safetyNotes: [{ type: String }],
    generalTips: [{ type: String }],

    // Plan validity
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        // Default to 7 days from creation
        default: function() {
            const date = new Date();
            date.setDate(date.getDate() + 7);
            return date;
        }
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    // AI generation metadata
    generatedBy: {
        type: String,
        default: 'AI Assistant'
    },
    aiModel: {
        type: String,
        default: 'gemini-2.5-flash'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'exerciseplans'
});

// ============================================================================
// INDEXES
// ============================================================================
exercisePlanSchema.index({ userId: 1, createdAt: -1 });
exercisePlanSchema.index({ userId: 1, isActive: 1 });
exercisePlanSchema.index({ validUntil: 1 });

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if the exercise plan is still valid
 */
exercisePlanSchema.methods.isValid = function() {
    return this.isActive && new Date() <= this.validUntil;
};

/**
 * Deactivate this exercise plan
 */
exercisePlanSchema.methods.deactivate = function() {
    this.isActive = false;
    return this.save();
};

/**
 * Get summary of the exercise plan
 */
exercisePlanSchema.methods.getSummary = function() {
    return {
        id: this._id,
        pregnancyWeek: this.pregnancyWeek,
        trimester: this.trimester,
        weeklyTotals: this.weeklyTotals,
        validFrom: this.validFrom,
        validUntil: this.validUntil,
        isActive: this.isActive,
        isValid: this.isValid()
    };
};

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Get the most recent active exercise plan for a user
 */
exercisePlanSchema.statics.getActivePlan = async function(userId) {
    const mongoose = require('mongoose');
    // Convert to ObjectId if it's a string
    let userObjectId = userId;
    if (typeof userId === 'string') {
        try {
            userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (e) {
            userObjectId = mongoose.Types.ObjectId(userId);
        }
    }
    
    const plan = await this.findOne({
        userId: userObjectId,
        isActive: true,
        validUntil: { $gte: new Date() }
    }).sort({ createdAt: -1 });
    
    console.log(`🔍 getActivePlan (Exercise) for user ${userId}: ${plan ? 'Found' : 'Not found'}`);
    if (plan) {
        console.log(`   - Valid until: ${plan.validUntil}`);
        console.log(`   - Is active: ${plan.isActive}`);
    }
    
    return plan;
};

/**
 * Deactivate old exercise plans for a user
 */
exercisePlanSchema.statics.deactivateOldPlans = async function(userId) {
    return this.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false } }
    );
};

/**
 * Get exercise plan history for a user
 */
exercisePlanSchema.statics.getUserHistory = async function(userId, limit = 10) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('pregnancyWeek trimester weeklyTotals validFrom validUntil isActive createdAt');
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Calculate weekly totals before saving
exercisePlanSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Calculate weekly totals from daily plans
    if (this.dailyExercisePlan && this.dailyExercisePlan.length > 0) {
        let totalMinutes = 0;
        let activeDays = 0;
        let restDays = 0;
        
        this.dailyExercisePlan.forEach(day => {
            if (day.restDay) {
                restDays++;
            } else if (day.exercises && day.exercises.length > 0) {
                activeDays++;
                day.totalMinutes = day.exercises.reduce((sum, ex) => sum + (ex.durationMinutes || 0), 0);
                totalMinutes += day.totalMinutes;
            }
        });
        
        this.weeklyTotals = {
            totalMinutes,
            activeDays,
            restDays
        };
    }
    
    next();
});

// ============================================================================
// MODEL EXPORT
// ============================================================================
const ExercisePlan = mongoose.model('ExercisePlan', exercisePlanSchema);

module.exports = ExercisePlan;
