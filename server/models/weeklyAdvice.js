const mongoose = require('mongoose');

// ============================================================================
// WEEKLY ADVICE SCHEMA
// ============================================================================

const symptomAdviceSchema = new mongoose.Schema({
	symptom: { type: String, required: true, trim: true },
	advice: { type: String, required: true, trim: true },
	severity: { 
		type: String, 
		enum: ['mild', 'moderate', 'severe'],
		default: 'mild'
	}
}, { _id: false });

const weeklyGuidanceSchema = new mongoose.Schema({
	fetalDevelopment: { type: String, trim: true },
	selfCare: { type: String, trim: true },
	nutritionTip: { type: String, trim: true },
	activityTip: { type: String, trim: true },
	riskManagement: { type: String, trim: true }
}, { _id: false });

const focusAreaSchema = new mongoose.Schema({
	title: { type: String, required: true, trim: true },
	icon: { type: String, default: '📌' },
	description: { type: String, required: true, trim: true },
	action: { type: String, trim: true }
}, { _id: false });

const riskAssessmentSchema = new mongoose.Schema({
	level: { 
		type: String, 
		enum: ['low', 'mid', 'high'],
		required: true 
	},
	confidence: { 
		type: Number, 
		min: 0, 
		max: 1,
		required: true 
	},
	factors: [{ type: String, trim: true }],
	vitals: {
		bloodPressure: { type: String, trim: true },
		heartRate: { type: Number, min: 0 },
		bloodSugar: { type: Number, min: 0 }
	},
	recommendations: [{ type: String, trim: true }]
}, { _id: false });

const weeklyAdviceSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
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
	symptomAdvice: [symptomAdviceSchema],
	weeklyGuidance: weeklyGuidanceSchema,
	focusAreas: [focusAreaSchema],
	riskAssessment: riskAssessmentSchema,
	
	// Metadata
	generatedAt: {
		type: Date,
		default: Date.now,
		index: true
	},
	
	// Track which health logs were used to generate this advice
	healthLogIds: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'HealthLog'
	}],
	
	// AI model info
	aiModel: {
		type: String,
		default: 'gemini-2.5-flash'
	},
	
	// Deletion tracking
	deletedAt: { 
		type: Date, 
		default: null 
	}
}, {
	timestamps: true,
	collection: 'weeklyadvices'
});

// ============================================================================
// INDEXES
// ============================================================================
weeklyAdviceSchema.index({ userId: 1, pregnancyWeek: 1, generatedAt: -1 });
weeklyAdviceSchema.index({ userId: 1, deletedAt: 1 });

// ============================================================================
// STATIC METHODS
// ============================================================================

/**
 * Save new weekly advice to database
 * @param {Object} adviceData - The advice data to save
 * @returns {Promise<Object>} - Saved advice document
 */
weeklyAdviceSchema.statics.saveWeeklyAdvice = async function(adviceData) {
	try {
		const {
			userId,
			pregnancyWeek,
			trimester,
			symptomAdvice,
			weeklyGuidance,
			focusAreas,
			riskAssessment,
			healthLogIds,
			aiModel
		} = adviceData;

		// Create new advice document
		const advice = new this({
			userId,
			pregnancyWeek,
			trimester,
			symptomAdvice: symptomAdvice || [],
			weeklyGuidance: weeklyGuidance || {},
			focusAreas: focusAreas || [],
			riskAssessment: riskAssessment || null,
			healthLogIds: healthLogIds || [],
			aiModel: aiModel || 'gemini-2.5-flash',
			generatedAt: new Date()
		});

		await advice.save();
		return advice;
	} catch (error) {
		console.error('Error saving weekly advice:', error);
		throw error;
	}
};

/**
 * Get most recent weekly advice for a user
 * @param {String} userId - User ID
 * @param {Number} limit - Number of recent advice to retrieve (default: 1)
 * @returns {Promise<Array>} - Array of advice documents
 */
weeklyAdviceSchema.statics.getRecentAdvice = async function(userId, limit = 1) {
	try {
		const advice = await this.find({
			userId,
			deletedAt: null
		})
		.sort({ generatedAt: -1 })
		.limit(limit)
		.lean();

		return advice;
	} catch (error) {
		console.error('Error retrieving recent advice:', error);
		throw error;
	}
};

/**
 * Get weekly advice by pregnancy week
 * @param {String} userId - User ID
 * @param {Number} pregnancyWeek - Pregnancy week number
 * @returns {Promise<Array>} - Array of advice for that week
 */
weeklyAdviceSchema.statics.getAdviceByWeek = async function(userId, pregnancyWeek) {
	try {
		const advice = await this.find({
			userId,
			pregnancyWeek,
			deletedAt: null
		})
		.sort({ generatedAt: -1 })
		.lean();

		return advice;
	} catch (error) {
		console.error('Error retrieving advice by week:', error);
		throw error;
	}
};

/**
 * Get all weekly advice for a user (paginated)
 * @param {String} userId - User ID
 * @param {Number} page - Page number (default: 1)
 * @param {Number} pageSize - Items per page (default: 10)
 * @returns {Promise<Object>} - { advice, total, page, totalPages }
 */
weeklyAdviceSchema.statics.getAdviceHistory = async function(userId, page = 1, pageSize = 10) {
	try {
		const skip = (page - 1) * pageSize;
		
		const [advice, total] = await Promise.all([
			this.find({ userId, deletedAt: null })
				.sort({ generatedAt: -1 })
				.skip(skip)
				.limit(pageSize)
				.lean(),
			this.countDocuments({ userId, deletedAt: null })
		]);

		return {
			advice,
			total,
			page,
			totalPages: Math.ceil(total / pageSize)
		};
	} catch (error) {
		console.error('Error retrieving advice history:', error);
		throw error;
	}
};

/**
 * Get advice with risk assessment only
 * @param {String} userId - User ID
 * @param {String} riskLevel - Filter by risk level ('low', 'mid', 'high')
 * @returns {Promise<Array>} - Array of advice with risk assessments
 */
weeklyAdviceSchema.statics.getAdviceWithRisk = async function(userId, riskLevel = null) {
	try {
		const query = {
			userId,
			deletedAt: null,
			'riskAssessment.level': riskLevel ? riskLevel : { $exists: true }
		};

		const advice = await this.find(query)
			.sort({ generatedAt: -1 })
			.lean();

		return advice;
	} catch (error) {
		console.error('Error retrieving advice with risk:', error);
		throw error;
	}
};

/**
 * Soft delete advice
 * @param {String} adviceId - Advice ID
 * @returns {Promise<Object>} - Updated advice document
 */
weeklyAdviceSchema.statics.softDelete = async function(adviceId) {
	try {
		const advice = await this.findByIdAndUpdate(
			adviceId,
			{ deletedAt: new Date() },
			{ new: true }
		);

		return advice;
	} catch (error) {
		console.error('Error soft deleting advice:', error);
		throw error;
	}
};

/**
 * Check if advice exists for current week
 * @param {String} userId - User ID
 * @param {Number} pregnancyWeek - Pregnancy week number
 * @param {Number} hoursThreshold - How recent to consider (default: 24 hours)
 * @returns {Promise<Object|null>} - Existing advice or null
 */
weeklyAdviceSchema.statics.findRecentForWeek = async function(userId, pregnancyWeek, hoursThreshold = 24) {
	try {
		const cutoffTime = new Date();
		cutoffTime.setHours(cutoffTime.getHours() - hoursThreshold);

		const advice = await this.findOne({
			userId,
			pregnancyWeek,
			deletedAt: null,
			generatedAt: { $gte: cutoffTime }
		})
		.sort({ generatedAt: -1 })
		.lean();

		return advice;
	} catch (error) {
		console.error('Error checking recent advice:', error);
		throw error;
	}
};

/**
 * Get statistics for user's advice history
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Statistics object
 */
weeklyAdviceSchema.statics.getAdviceStats = async function(userId) {
	try {
		const stats = await this.aggregate([
			{ $match: { userId: mongoose.Types.ObjectId(userId), deletedAt: null } },
			{
				$group: {
					_id: null,
					totalAdvice: { $sum: 1 },
					weeksWithAdvice: { $addToSet: '$pregnancyWeek' },
					avgSymptomAdviceCount: { $avg: { $size: '$symptomAdvice' } },
					avgFocusAreasCount: { $avg: { $size: '$focusAreas' } },
					riskLevels: {
						$push: '$riskAssessment.level'
					}
				}
			},
			{
				$project: {
					_id: 0,
					totalAdvice: 1,
					uniqueWeeks: { $size: '$weeksWithAdvice' },
					avgSymptomAdviceCount: { $round: ['$avgSymptomAdviceCount', 1] },
					avgFocusAreasCount: { $round: ['$avgFocusAreasCount', 1] },
					riskLevels: 1
				}
			}
		]);

		if (stats.length === 0) {
			return {
				totalAdvice: 0,
				uniqueWeeks: 0,
				avgSymptomAdviceCount: 0,
				avgFocusAreasCount: 0,
				riskLevels: []
			};
		}

		return stats[0];
	} catch (error) {
		console.error('Error retrieving advice stats:', error);
		throw error;
	}
};

// ============================================================================
// EXPORT MODEL
// ============================================================================
const WeeklyAdvice = mongoose.model('WeeklyAdvice', weeklyAdviceSchema);

module.exports = WeeklyAdvice;
