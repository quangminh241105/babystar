const mongoose = require('mongoose');

// ============================================================================
// MEAL ITEM SUB-SCHEMA
// ============================================================================
const mealItemSchema = new mongoose.Schema({
    food: { type: String, required: true },
    portion: { type: String, required: true },
    calories: { type: Number, default: 0, min: 0 },
    reason: { type: String },
    keyNutrients: [{ type: String }],
    alternatives: [{ type: String }],
    // Detailed nutrition info
    nutritionInfo: {
        proteinGrams: { type: Number, default: 0, min: 0 },
        calciumMg: { type: Number, default: 0, min: 0 },
        ironMg: { type: Number, default: 0, min: 0 },
        folicAcidMcg: { type: Number, default: 0, min: 0 },
        omega3Grams: { type: Number, default: 0, min: 0 },
        fiberGrams: { type: Number, default: 0, min: 0 }
    }
}, { _id: false });

// ============================================================================
// DAILY MEAL PLAN SUB-SCHEMA
// ============================================================================
const dailyMealPlanSchema = new mongoose.Schema({
    day: { type: String, required: true }, // e.g., "Monday", "Tuesday"
    breakfast: [mealItemSchema],
    lunch: [mealItemSchema],
    dinner: [mealItemSchema],
    snacks: [mealItemSchema],
    // Daily nutrition totals
    dailyTotals: {
        calories: { type: Number, default: 0, min: 0 },
        proteinGrams: { type: Number, default: 0, min: 0 },
        calciumMg: { type: Number, default: 0, min: 0 },
        ironMg: { type: Number, default: 0, min: 0 },
        folicAcidMcg: { type: Number, default: 0, min: 0 },
        omega3Grams: { type: Number, default: 0, min: 0 },
        fiberGrams: { type: Number, default: 0, min: 0 }
    }
}, { _id: false });

// ============================================================================
// NUTRIENT FOCUS SUB-SCHEMA
// ============================================================================
const nutrientFocusSchema = new mongoose.Schema({
    nutrient: { type: String, required: true },
    reason: { type: String },
    sources: [{ type: String }]
}, { _id: false });

// ============================================================================
// NUTRITION INTAKE SUMMARY SUB-SCHEMA
// ============================================================================
const nutritionIntakeSummarySchema = new mongoose.Schema({
    analyzedPeriod: { type: String }, // e.g., "Last 7 days"
    totalDaysAnalyzed: { type: Number, default: 0 },
    averageDailyIntake: {
        calories: { type: Number, default: 0, min: 0 },
        proteinGrams: { type: Number, default: 0, min: 0 },
        calciumMg: { type: Number, default: 0, min: 0 },
        ironMg: { type: Number, default: 0, min: 0 },
        folicAcidMcg: { type: Number, default: 0, min: 0 },
        omega3Grams: { type: Number, default: 0, min: 0 },
        fiberGrams: { type: Number, default: 0, min: 0 }
    },
    // Analysis of user's nutrition performance
    performanceAnalysis: {
        doingWell: [{ type: String }], // Nutrients user is meeting targets for
        needsImprovement: [{ type: String }], // Nutrients below target
        recommendations: [{ type: String }] // Specific recommendations
    }
}, { _id: false });

// ============================================================================
// DIET PLAN MAIN SCHEMA
// ============================================================================
const dietPlanSchema = new mongoose.Schema({
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

    // Daily nutritional targets
    dailyTargets: {
        calories: { type: Number, min: 0 },
        proteinGrams: { type: Number, min: 0 },
        calciumMg: { type: Number, min: 0 },
        ironMg: { type: Number, min: 0 },
        folicAcidMcg: { type: Number, min: 0 },
        omega3Grams: { type: Number, min: 0 },
        fiberGrams: { type: Number, min: 0 }
    },

    // Weekly meal plan (7 days)
    weeklyMeals: [dailyMealPlanSchema],

    // Key nutrients to focus on
    nutrientFocus: [nutrientFocusSchema],

    // User's current nutrition intake summary
    intakeSummary: nutritionIntakeSummarySchema,

    // Additional recommendations and notes
    generalAdvice: [{ type: String }],
    warnings: [{ type: String }], // Foods to avoid, etc.

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
    collection: 'dietplans'
});

// ============================================================================
// INDEXES
// ============================================================================
dietPlanSchema.index({ userId: 1, createdAt: -1 });
dietPlanSchema.index({ userId: 1, isActive: 1 });
dietPlanSchema.index({ validUntil: 1 });

// ============================================================================
// METHODS
// ============================================================================

/**
 * Check if the diet plan is still valid
 */
dietPlanSchema.methods.isValid = function() {
    return this.isActive && new Date() <= this.validUntil;
};

/**
 * Deactivate this diet plan
 */
dietPlanSchema.methods.deactivate = function() {
    this.isActive = false;
    return this.save();
};

/**
 * Get summary of the diet plan
 */
dietPlanSchema.methods.getSummary = function() {
    return {
        id: this._id,
        pregnancyWeek: this.pregnancyWeek,
        trimester: this.trimester,
        dailyTargets: this.dailyTargets,
        validFrom: this.validFrom,
        validUntil: this.validUntil,
        isActive: this.isActive,
        isValid: this.isValid(),
        intakeSummary: this.intakeSummary
    };
};

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Get the most recent active diet plan for a user
 */
dietPlanSchema.statics.getActivePlan = async function(userId) {
    const mongoose = require('mongoose');
    // Convert to ObjectId if it's a string - handle both old and new Mongoose versions
    let userObjectId = userId;
    if (typeof userId === 'string') {
        try {
            // Try new method first (Mongoose 6+)
            userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (e) {
            // Fallback to old method
            userObjectId = mongoose.Types.ObjectId(userId);
        }
    }
    
    const plan = await this.findOne({
        userId: userObjectId,
        isActive: true,
        validUntil: { $gte: new Date() }
    }).sort({ createdAt: -1 });
    
    console.log(`🔍 getActivePlan for user ${userId}: ${plan ? 'Found' : 'Not found'}`);
    if (plan) {
        console.log(`   - Valid until: ${plan.validUntil}`);
        console.log(`   - Is active: ${plan.isActive}`);
    }
    
    return plan;
};

/**
 * Deactivate old diet plans for a user
 */
dietPlanSchema.statics.deactivateOldPlans = async function(userId) {
    return this.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false } }
    );
};

/**
 * Get diet plan history for a user
 */
dietPlanSchema.statics.getUserHistory = async function(userId, limit = 10) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('pregnancyWeek trimester dailyTargets validFrom validUntil isActive createdAt');
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Update the updatedAt timestamp before saving
dietPlanSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// ============================================================================
// MODEL EXPORT
// ============================================================================
const DietPlan = mongoose.model('DietPlan', dietPlanSchema);

module.exports = DietPlan;
