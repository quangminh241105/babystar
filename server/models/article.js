const mongoose = require('mongoose');

// ============================================================================
// ARTICLE SECTION SUB-SCHEMA
// ============================================================================
const articleSectionSchema = new mongoose.Schema({
	title: { type: String, trim: true },
	content: { type: String, required: true, trim: true },
	type: {
		type: String,
		enum: ['text', 'heading', 'list', 'quote', 'callout', 'warning'],
		default: 'text'
	},
	imageUrl: { type: String, trim: true },
	imageCaption: { type: String, trim: true },
	order: { type: Number, default: 0 }
}, { _id: true });

// ============================================================================
// MAIN ARTICLE SCHEMA
// ============================================================================
const articleSchema = new mongoose.Schema({
	// Basic info
	title: { 
		type: String, 
		required: [true, 'Article title is required'],
		trim: true,
		maxlength: 300
	},
	slug: { 
		type: String, 
		unique: true,
		trim: true,
		lowercase: true
	},
	summary: { 
		type: String, 
		trim: true,
		maxlength: 500
	},
	
	// Content
	content: { type: String, trim: true }, // Full content (markdown or HTML)
	sections: [articleSectionSchema], // Structured content
	
	// Media
	thumbnailUrl: { type: String, trim: true },
	featuredImageUrl: { type: String, trim: true },
	videoUrl: { type: String, trim: true },
	
	// Categorization
	category: {
		type: String,
		enum: [
			'pregnancy_basics',
			'trimester_1', 'trimester_2', 'trimester_3',
			'nutrition', 'exercise', 'mental_health',
			'baby_development', 'symptoms',
			'labor_delivery', 'postpartum',
			'breastfeeding', 'newborn_care',
			'health_conditions', 'lifestyle',
			'partner_support', 'work_career',
			'shopping_gear', 'tips_advice'
		],
		required: true,
		index: true
	},
	subCategory: { type: String, trim: true },
	tags: [{ type: String, trim: true, lowercase: true }],
	
	// Target audience
	targetWeekRange: {
		minWeek: { type: Number, min: 1, max: 42 },
		maxWeek: { type: Number, min: 1, max: 42 }
	},
	targetTrimester: { type: Number, enum: [1, 2, 3, null] },
	targetAudience: {
		type: String,
		enum: ['expectant_mother', 'partner', 'both'],
		default: 'expectant_mother'
	},
	
	// Author
	author: {
		name: { type: String, trim: true },
		title: { type: String, trim: true }, // e.g., "OB-GYN", "Nutritionist"
		imageUrl: { type: String, trim: true },
		bio: { type: String, trim: true, maxlength: 500 }
	},
	
	// Medical review
	medicallyReviewed: { type: Boolean, default: false },
	reviewer: {
		name: { type: String, trim: true },
		credentials: { type: String, trim: true },
		reviewedAt: { type: Date }
	},
	
	// Reading info
	readTimeMinutes: { type: Number, min: 1 },
	difficulty: {
		type: String,
		enum: ['beginner', 'intermediate', 'advanced'],
		default: 'beginner'
	},
	
	// Engagement
	views: { type: Number, default: 0 },
	uniqueViews: { type: Number, default: 0 },
	likes: { type: Number, default: 0 },
	saves: { type: Number, default: 0 },
	shares: { type: Number, default: 0 },
	
	// Ratings
	ratings: {
		totalRatings: { type: Number, default: 0 },
		sumRatings: { type: Number, default: 0 },
		avgRating: { type: Number, default: 0, min: 0, max: 5 }
	},
	
	// Related content
	relatedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
	relatedQuizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
	
	// Sources and references
	sources: [{
		title: { type: String, trim: true },
		url: { type: String, trim: true },
		publishedDate: { type: Date }
	}],
	
	// Status
	status: {
		type: String,
		enum: ['draft', 'review', 'published', 'archived'],
		default: 'draft'
	},
	publishedAt: { type: Date },
	
	// Featured
	isFeatured: { type: Boolean, default: false },
	featuredUntil: { type: Date },
	isPinned: { type: Boolean, default: false },
	
	// SEO
	seo: {
		metaTitle: { type: String, trim: true, maxlength: 60 },
		metaDescription: { type: String, trim: true, maxlength: 160 },
		keywords: [{ type: String, trim: true }]
	},
	
	// Created by (admin)
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	
	// Soft delete
	deletedAt: { type: Date, default: null }

}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// USER ARTICLE INTERACTION SCHEMA
// Track user interactions with articles
// ============================================================================
const userArticleInteractionSchema = new mongoose.Schema({
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true,
		index: true
	},
	articleId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Article',
		required: true,
		index: true
	},
	
	// Interactions
	viewed: { type: Boolean, default: false },
	viewedAt: { type: Date },
	viewCount: { type: Number, default: 0 },
	readTime: { type: Number, default: 0 }, // seconds spent reading
	
	liked: { type: Boolean, default: false },
	likedAt: { type: Date },
	
	saved: { type: Boolean, default: false },
	savedAt: { type: Date },
	savedToCollection: { type: String, trim: true },
	
	shared: { type: Boolean, default: false },
	sharedAt: { type: Date },
	shareMethod: { type: String, enum: ['link', 'email', 'social'] },
	
	rating: { type: Number, min: 1, max: 5 },
	ratedAt: { type: Date },
	
	// Reading progress
	readingProgress: { type: Number, default: 0, min: 0, max: 100 },
	completedReading: { type: Boolean, default: false },
	completedAt: { type: Date },
	
	// Notes
	notes: { type: String, trim: true, maxlength: 1000 },
	highlights: [{
		text: { type: String, trim: true },
		color: { type: String, default: 'yellow' },
		createdAt: { type: Date, default: Date.now }
	}]

}, {
	timestamps: true
});

// ============================================================================
// INDEXES
// ============================================================================
// Article indexes
articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ targetTrimester: 1 });
articleSchema.index({ 'targetWeekRange.minWeek': 1, 'targetWeekRange.maxWeek': 1 });
articleSchema.index({ isFeatured: 1, featuredUntil: 1 });
articleSchema.index({ publishedAt: -1 });
articleSchema.index({ views: -1 });
articleSchema.index({ 'ratings.avgRating': -1 });
articleSchema.index({ deletedAt: 1 });
articleSchema.index({ title: 'text', summary: 'text', content: 'text', tags: 'text' });

// Interaction indexes
userArticleInteractionSchema.index({ userId: 1, articleId: 1 }, { unique: true });
userArticleInteractionSchema.index({ userId: 1, saved: 1 });
userArticleInteractionSchema.index({ userId: 1, liked: 1 });

// ============================================================================
// ARTICLE VIRTUALS
// ============================================================================
articleSchema.virtual('isPublished').get(function() {
	return this.status === 'published';
});

articleSchema.virtual('engagementScore').get(function() {
	return (this.views * 1) + (this.likes * 5) + (this.saves * 10) + (this.shares * 15);
});

// ============================================================================
// ARTICLE PRE-SAVE MIDDLEWARE
// ============================================================================
articleSchema.pre('save', function(next) {
	// Generate slug from title if not set
	if (!this.slug && this.title) {
		this.slug = this.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}
	
	// Calculate read time if content exists
	if (this.content && !this.readTimeMinutes) {
		const wordCount = this.content.split(/\s+/).length;
		this.readTimeMinutes = Math.ceil(wordCount / 200); // ~200 words per minute
	}
	
	// Set publishedAt when status changes to published
	if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
		this.publishedAt = new Date();
	}
	
	next();
});

// ============================================================================
// ARTICLE INSTANCE METHODS
// ============================================================================
articleSchema.methods.incrementViews = async function() {
	this.views += 1;
	await this.save();
	return this;
};

articleSchema.methods.addRating = async function(rating) {
	this.ratings.totalRatings += 1;
	this.ratings.sumRatings += rating;
	this.ratings.avgRating = this.ratings.sumRatings / this.ratings.totalRatings;
	await this.save();
	return this;
};

articleSchema.methods.publish = async function() {
	this.status = 'published';
	this.publishedAt = new Date();
	await this.save();
	return this;
};

// ============================================================================
// ARTICLE STATIC METHODS
// ============================================================================
articleSchema.statics.getByCategory = function(category, options = {}) {
	const query = {
		category,
		status: 'published',
		deletedAt: null
	};
	
	return this.find(query)
		.sort(options.sortBy || { publishedAt: -1 })
		.limit(options.limit || 20);
};

articleSchema.statics.getForPregnancyWeek = function(week) {
	const trimester = week <= 12 ? 1 : week <= 27 ? 2 : 3;
	
	return this.find({
		status: 'published',
		deletedAt: null,
		$or: [
			{ 'targetWeekRange.minWeek': { $lte: week }, 'targetWeekRange.maxWeek': { $gte: week } },
			{ targetTrimester: trimester },
			{ targetTrimester: null }
		]
	}).sort({ publishedAt: -1 });
};

articleSchema.statics.getFeatured = function(limit = 5) {
	return this.find({
		isFeatured: true,
		status: 'published',
		deletedAt: null,
		$or: [
			{ featuredUntil: { $gte: new Date() } },
			{ featuredUntil: null }
		]
	})
	.sort({ publishedAt: -1 })
	.limit(limit);
};

articleSchema.statics.getPopular = function(limit = 10) {
	return this.find({
		status: 'published',
		deletedAt: null
	})
	.sort({ views: -1 })
	.limit(limit);
};

articleSchema.statics.search = function(searchTerm, options = {}) {
	const query = {
		$text: { $search: searchTerm },
		status: 'published',
		deletedAt: null
	};
	
	if (options.category) query.category = options.category;
	
	return this.find(query, { score: { $meta: 'textScore' } })
		.sort({ score: { $meta: 'textScore' } })
		.limit(options.limit || 20);
};

articleSchema.statics.getRelated = async function(articleId, limit = 5) {
	const article = await this.findById(articleId);
	if (!article) return [];
	
	return this.find({
		_id: { $ne: articleId },
		status: 'published',
		deletedAt: null,
		$or: [
			{ category: article.category },
			{ tags: { $in: article.tags } }
		]
	})
	.sort({ publishedAt: -1 })
	.limit(limit);
};

// ============================================================================
// INTERACTION INSTANCE METHODS
// ============================================================================
userArticleInteractionSchema.methods.recordView = async function() {
	this.viewed = true;
	this.viewedAt = new Date();
	this.viewCount += 1;
	await this.save();
	return this;
};

userArticleInteractionSchema.methods.toggleLike = async function() {
	this.liked = !this.liked;
	this.likedAt = this.liked ? new Date() : null;
	await this.save();
	return this;
};

userArticleInteractionSchema.methods.toggleSave = async function(collection = null) {
	this.saved = !this.saved;
	this.savedAt = this.saved ? new Date() : null;
	this.savedToCollection = collection;
	await this.save();
	return this;
};

// ============================================================================
// INTERACTION STATIC METHODS
// ============================================================================
userArticleInteractionSchema.statics.getOrCreate = async function(userId, articleId) {
	let interaction = await this.findOne({ userId, articleId });
	
	if (!interaction) {
		interaction = new this({ userId, articleId });
		await interaction.save();
	}
	
	return interaction;
};

userArticleInteractionSchema.statics.getSavedArticles = function(userId) {
	return this.find({ userId, saved: true })
		.sort({ savedAt: -1 })
		.populate('articleId');
};

userArticleInteractionSchema.statics.getLikedArticles = function(userId) {
	return this.find({ userId, liked: true })
		.sort({ likedAt: -1 })
		.populate('articleId');
};

userArticleInteractionSchema.statics.getReadingHistory = function(userId, limit = 20) {
	return this.find({ userId, viewed: true })
		.sort({ viewedAt: -1 })
		.limit(limit)
		.populate('articleId');
};

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
articleSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
articleSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

userArticleInteractionSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

// ============================================================================
// EXPORT MODELS
// ============================================================================
const Article = mongoose.model('Article', articleSchema);
const UserArticleInteraction = mongoose.model('UserArticleInteraction', userArticleInteractionSchema);

module.exports = {
	Article,
	UserArticleInteraction
};
