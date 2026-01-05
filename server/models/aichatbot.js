const mongoose = require('mongoose');

// ============================================================================
// MESSAGE SUB-SCHEMA
// Individual chat messages within a conversation
// ============================================================================
const messageSchema = new mongoose.Schema({
	role: { 
		type: String, 
		enum: ['user', 'assistant', 'system'],
		required: [true, 'Message role is required']
	},
	content: { 
		type: String, 
		required: [true, 'Message content is required'],
		maxlength: [50000, 'Message cannot exceed 50000 characters']
	},
	
	// [IMPROVED] Rich content support
	contentType: {
		type: String,
		enum: ['text', 'image', 'file'],
		default: 'text'
	},
	
	// [IMPROVED] Attachments support (images, documents)
	attachments: [{
		type: { type: String, enum: ['image', 'document', 'link'] },
		url: { type: String, trim: true },
		filename: { type: String, trim: true },
		mimeType: { type: String, trim: true },
		size: { type: Number } // in bytes
	}],
	
	// [IMPROVED] AI-specific metadata
	aiMetadata: {
		model: { type: String, trim: true }, // e.g., "gpt-4", "claude-3"
		tokensUsed: { type: Number, min: 0 },
		promptTokens: { type: Number, min: 0 },
		completionTokens: { type: Number, min: 0 },
		responseTimeMs: { type: Number, min: 0 },
		// [IMPROVED] Confidence and safety scores
		confidenceScore: { type: Number, min: 0, max: 1 },
		safetyScore: { type: Number, min: 0, max: 1 }
	},
	
	// [IMPROVED] Context used for generating response
	contextUsed: {
		userPregnancyWeek: { type: Number },
		userTrimester: { type: Number },
		recentSymptoms: [{ type: String }],
		recentMood: { type: String },
		healthLogIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HealthLog' }]
	},
	
	// [IMPROVED] User feedback on AI response
	feedback: {
		rating: { type: Number, min: 1, max: 5 },
		isHelpful: { type: Boolean },
		feedbackType: { 
			type: String, 
			enum: ['helpful', 'not_helpful', 'inaccurate', 'inappropriate', 'other'] 
		},
		feedbackText: { type: String, trim: true, maxlength: 500 },
		submittedAt: { type: Date }
	},
	
	// [IMPROVED] Message status
	status: {
		type: String,
		enum: ['sending', 'sent', 'delivered', 'read', 'error'],
		default: 'sent'
	},
	errorMessage: { type: String, trim: true },
	
	// [IMPROVED] Flagged for review (inappropriate content, etc.)
	isFlagged: { type: Boolean, default: false },
	flagReason: { type: String, trim: true },
	
	// [IMPROVED] Edit history
	isEdited: { type: Boolean, default: false },
	editedAt: { type: Date },
	originalContent: { type: String },
	
	// Soft delete
	deletedAt: { type: Date, default: null }
	
}, { 
	timestamps: true,
	_id: true,
	minimize: false
});

// ============================================================================
// SUGGESTED QUESTION SUB-SCHEMA
// [IMPROVED] Pre-defined or AI-generated follow-up questions
// ============================================================================
const suggestedQuestionSchema = new mongoose.Schema({
	question: { type: String, required: true, trim: true },
	category: { 
		type: String, 
		enum: ['symptom', 'nutrition', 'exercise', 'medical', 'emotional', 'baby_development', 'general'],
		default: 'general'
	},
	relevanceScore: { type: Number, min: 0, max: 1 },
	wasUsed: { type: Boolean, default: false }
}, { _id: false });

// ============================================================================
// MAIN CONVERSATION SCHEMA
// ============================================================================
const conversationSchema = new mongoose.Schema({
	// User reference
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: [true, 'User ID is required'],
		index: true
	},
	
	// [IMPROVED] Conversation title (auto-generated or user-defined)
	title: { 
		type: String, 
		trim: true,
		maxlength: [200, 'Title cannot exceed 200 characters'],
		default: 'New Conversation'
	},
	
	// [IMPROVED] Conversation topic/category
	topic: {
		type: String,
		enum: [
			'general',
			'symptoms',
			'nutrition',
			'exercise',
			'baby_development',
			'emotional_support',
			'medical_questions',
			'labor_preparation',
			'postpartum',
			'breastfeeding',
			'appointments',
			'emergency',
			'other'
		],
		default: 'general'
	},
	
	// Messages array
	messages: { type: [messageSchema], default: [] },
	
	// [IMPROVED] Suggested follow-up questions
	suggestedQuestions: [suggestedQuestionSchema],
	
	// [IMPROVED] Conversation context snapshot (pregnancy info at conversation start)
	contextSnapshot: {
		pregnancyWeek: { type: Number, default: null },
		trimester: { type: Number, default: null },
		dueDate: { type: Date },
		isHighRisk: { type: Boolean },
		allergies: [{ type: String }],
		medicalConditions: [{ type: String }]
	},
	
	// [IMPROVED] Conversation summary (for long conversations)
	summary: {
		text: { type: String, trim: true, maxlength: 1000 },
		keyTopics: [{ type: String, trim: true }],
		actionItems: [{ type: String, trim: true }],
		generatedAt: { type: Date }
	},
	
	// [IMPROVED] Conversation statistics
	stats: {
		messageCount: { type: Number, default: 0 },
		userMessageCount: { type: Number, default: 0 },
		assistantMessageCount: { type: Number, default: 0 },
		totalTokensUsed: { type: Number, default: 0 },
		avgResponseTimeMs: { type: Number, default: 0 }
	},
	
	// [IMPROVED] Conversation status
	status: {
		type: String,
		enum: ['active', 'archived', 'resolved', 'needs_followup'],
		default: 'active'
	},
	
	// [IMPROVED] Priority (for medical concerns)
	priority: {
		type: String,
		enum: ['low', 'normal', 'high', 'urgent'],
		default: 'normal'
	},
	
	// [IMPROVED] Whether conversation contains medical advice
	containsMedicalAdvice: { type: Boolean, default: false },
	medicalDisclaimerShown: { type: Boolean, default: false },
	
	// [IMPROVED] Bookmarked conversations
	isBookmarked: { type: Boolean, default: false },
	isPinned: { type: Boolean, default: false },
	
	// [IMPROVED] Tags for organization
	tags: [{ type: String, trim: true, lowercase: true }],
	
	// [IMPROVED] Shared with associated users (partners, doctors)
	sharedWith: [{ 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User' 
	}],
	
	// [IMPROVED] Last activity tracking
	lastMessageAt: { type: Date, default: null },
	lastUserMessageAt: { type: Date, default: null },
	lastAssistantMessageAt: { type: Date, default: null },
	
	// [IMPROVED] Export tracking
	exportedAt: { type: Date },
	exportFormat: { type: String, enum: ['pdf', 'txt', 'json'] },
	
	// Soft delete
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true,
	minimize: false
});

// ============================================================================
// INDEXES - Optimized for common query patterns
// ============================================================================
// Primary query pattern: user's conversations sorted by recent activity
conversationSchema.index({ userId: 1, deletedAt: 1, lastMessageAt: -1 });
// For status filtering
conversationSchema.index({ userId: 1, status: 1, deletedAt: 1 });
// For bookmarked/pinned queries
conversationSchema.index({ userId: 1, isBookmarked: 1, deletedAt: 1 });
// TTL index for auto-cleanup of soft-deleted conversations after 30 days
conversationSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { deletedAt: { $ne: null } } });

// ============================================================================
// VIRTUALS
// ============================================================================
// [IMPROVED] Get last message
conversationSchema.virtual('lastMessage').get(function() {
	if (this.messages && this.messages.length > 0) {
		const activeMessages = this.messages.filter(m => !m.deletedAt);
		return activeMessages[activeMessages.length - 1];
	}
	return null;
});

// [IMPROVED] Get conversation duration
conversationSchema.virtual('duration').get(function() {
	if (this.messages && this.messages.length > 1) {
		const firstMessage = this.messages[0];
		const lastMessage = this.messages[this.messages.length - 1];
		return lastMessage.createdAt - firstMessage.createdAt;
	}
	return 0;
});

// [IMPROVED] Check if conversation is recent (within last 24 hours)
conversationSchema.virtual('isRecent').get(function() {
	if (this.lastMessageAt) {
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		return this.lastMessageAt > dayAgo;
	}
	return false;
});

// [IMPROVED] Preview text (first 100 chars of last message)
conversationSchema.virtual('preview').get(function() {
	const last = this.lastMessage;
	if (last && last.content) {
		return last.content.length > 100 
			? last.content.substring(0, 100) + '...' 
			: last.content;
	}
	return '';
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// [IMPROVED] Add a message to conversation
conversationSchema.methods.addMessage = async function(role, content, aiMetadata = null, contextUsed = null) {
	const message = {
		role,
		content,
		aiMetadata,
		contextUsed,
		status: 'sent'
	};
	
	this.messages.push(message);
	
	// Update stats
	this.stats.messageCount = this.messages.filter(m => !m.deletedAt).length;
	this.stats.userMessageCount = this.messages.filter(m => m.role === 'user' && !m.deletedAt).length;
	this.stats.assistantMessageCount = this.messages.filter(m => m.role === 'assistant' && !m.deletedAt).length;
	
	if (aiMetadata?.tokensUsed) {
		this.stats.totalTokensUsed += aiMetadata.tokensUsed;
	}
	
	// Update timestamps
	this.lastMessageAt = new Date();
	if (role === 'user') {
		this.lastUserMessageAt = new Date();
	} else if (role === 'assistant') {
		this.lastAssistantMessageAt = new Date();
	}
	
	// Auto-generate title from first user message if still default
	if (this.title === 'New Conversation' && role === 'user') {
		this.title = content.length > 50 ? content.substring(0, 47) + '...' : content;
	}
	
	await this.save();
	return this.messages[this.messages.length - 1];
};

// [IMPROVED] Add feedback to a message
conversationSchema.methods.addMessageFeedback = async function(messageId, feedback) {
	const message = this.messages.id(messageId);
	if (!message) {
		throw new Error('Message not found');
	}
	
	message.feedback = {
		...feedback,
		submittedAt: new Date()
	};
	
	await this.save();
	return message;
};

// [IMPROVED] Flag a message
conversationSchema.methods.flagMessage = async function(messageId, reason) {
	const message = this.messages.id(messageId);
	if (!message) {
		throw new Error('Message not found');
	}
	
	message.isFlagged = true;
	message.flagReason = reason;
	
	await this.save();
	return message;
};

// [IMPROVED] Soft delete a message
conversationSchema.methods.deleteMessage = async function(messageId) {
	const message = this.messages.id(messageId);
	if (!message) {
		throw new Error('Message not found');
	}
	
	message.deletedAt = new Date();
	
	// Update stats
	this.stats.messageCount = this.messages.filter(m => !m.deletedAt).length;
	this.stats.userMessageCount = this.messages.filter(m => m.role === 'user' && !m.deletedAt).length;
	this.stats.assistantMessageCount = this.messages.filter(m => m.role === 'assistant' && !m.deletedAt).length;
	
	await this.save();
	return message;
};

// [IMPROVED] Archive conversation
conversationSchema.methods.archive = async function() {
	this.status = 'archived';
	await this.save();
	return this;
};

// [IMPROVED] Generate conversation summary
conversationSchema.methods.generateSummary = async function(summaryText, keyTopics = [], actionItems = []) {
	this.summary = {
		text: summaryText,
		keyTopics,
		actionItems,
		generatedAt: new Date()
	};
	await this.save();
	return this;
};

// [IMPROVED] Update suggested questions
conversationSchema.methods.updateSuggestedQuestions = async function(questions) {
	this.suggestedQuestions = questions.map(q => ({
		question: q.question || q,
		category: q.category || 'general',
		relevanceScore: q.relevanceScore || 0.5,
		wasUsed: false
	}));
	await this.save();
	return this;
};

// [IMPROVED] Mark suggested question as used
conversationSchema.methods.markQuestionUsed = async function(questionIndex) {
	if (this.suggestedQuestions[questionIndex]) {
		this.suggestedQuestions[questionIndex].wasUsed = true;
		await this.save();
	}
	return this;
};

// [IMPROVED] Share with user
conversationSchema.methods.shareWith = async function(userId) {
	if (!this.sharedWith.includes(userId)) {
		this.sharedWith.push(userId);
		await this.save();
	}
	return this;
};

// [IMPROVED] Get messages for AI context (last N messages)
conversationSchema.methods.getContextMessages = function(limit = 10) {
	const activeMessages = this.messages.filter(m => !m.deletedAt);
	return activeMessages.slice(-limit).map(m => ({
		role: m.role,
		content: m.content
	}));
};

// ============================================================================
// STATIC METHODS
// ============================================================================
// [IMPROVED] Get active conversations for user
conversationSchema.statics.getActiveForUser = function(userId, limit = 20) {
	return this.find({ 
		userId, 
		status: 'active',
		deletedAt: null 
	})
	.sort({ lastMessageAt: -1 })
	.limit(limit)
	.select('-messages'); // Exclude messages for list view
};

// [IMPROVED] Get conversation with messages
conversationSchema.statics.getWithMessages = function(conversationId, userId) {
	return this.findOne({ 
		_id: conversationId,
		$or: [
			{ userId },
			{ sharedWith: userId }
		],
		deletedAt: null 
	});
};

// [IMPROVED] Search conversations
conversationSchema.statics.search = function(userId, searchTerm, options = {}) {
	const query = {
		userId,
		deletedAt: null,
		$text: { $search: searchTerm }
	};
	
	if (options.topic) query.topic = options.topic;
	if (options.status) query.status = options.status;
	if (options.fromDate) query.createdAt = { $gte: options.fromDate };
	if (options.toDate) query.createdAt = { ...query.createdAt, $lte: options.toDate };
	
	return this.find(query, { score: { $meta: 'textScore' } })
		.sort({ score: { $meta: 'textScore' } })
		.limit(options.limit || 20);
};

// [IMPROVED] Get bookmarked conversations
conversationSchema.statics.getBookmarked = function(userId) {
	return this.find({ 
		userId, 
		isBookmarked: true,
		deletedAt: null 
	})
	.sort({ lastMessageAt: -1 })
	.select('-messages');
};

// [IMPROVED] Get conversations by topic
conversationSchema.statics.getByTopic = function(userId, topic) {
	return this.find({ 
		userId, 
		topic,
		deletedAt: null 
	})
	.sort({ lastMessageAt: -1 })
	.select('-messages');
};

// [IMPROVED] Get conversations shared with user
conversationSchema.statics.getSharedWithUser = function(userId) {
	return this.find({ 
		sharedWith: userId,
		deletedAt: null 
	})
	.sort({ lastMessageAt: -1 })
	.select('-messages')
	.populate('userId', 'firstName lastName profileImageUrl');
};

// [IMPROVED] Get conversation statistics for user
conversationSchema.statics.getUserStats = async function(userId) {
	const stats = await this.aggregate([
		{ $match: { userId: new mongoose.Types.ObjectId(userId), deletedAt: null } },
		{
			$group: {
				_id: null,
				totalConversations: { $sum: 1 },
				totalMessages: { $sum: '$stats.messageCount' },
				totalTokensUsed: { $sum: '$stats.totalTokensUsed' },
				avgMessagesPerConversation: { $avg: '$stats.messageCount' }
			}
		}
	]);
	
	return stats[0] || {
		totalConversations: 0,
		totalMessages: 0,
		totalTokensUsed: 0,
		avgMessagesPerConversation: 0
	};
};

// [IMPROVED] Create new conversation with initial context
conversationSchema.statics.createWithContext = async function(userId, user) {
	const conversation = new this({
		userId,
		contextSnapshot: {
			pregnancyWeek: user.currentPregnancyWeek?.weeks,
			trimester: user.currentTrimester,
			dueDate: user.pregnancyProfile?.dueDate,
			isHighRisk: user.pregnancyProfile?.isHighRisk,
			allergies: user.pregnancyProfile?.allergies,
			medicalConditions: user.pregnancyProfile?.medicalConditions
		}
	});
	
	await conversation.save();
	return conversation;
};

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
// Exclude soft-deleted conversations by default
conversationSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
conversationSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		// Filter out deleted messages
		if (ret.messages) {
			ret.messages = ret.messages.filter(m => !m.deletedAt);
		}
		return ret;
	}
});

module.exports = mongoose.model('Conversation', conversationSchema);