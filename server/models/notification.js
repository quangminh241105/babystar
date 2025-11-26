const mongoose = require('mongoose');

// ============================================================================
// MAIN NOTIFICATION SCHEMA
// ============================================================================
const notificationSchema = new mongoose.Schema({
	// Recipient
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: [true, 'User ID is required'],
		index: true
	},
	
	// Notification content
	title: { 
		type: String, 
		required: [true, 'Notification title is required'],
		trim: true,
		maxlength: 200
	},
	message: { 
		type: String, 
		required: [true, 'Notification message is required'],
		trim: true,
		maxlength: 1000
	},
	
	// Type and category
	type: {
		type: String,
		enum: [
			// Health reminders
			'daily_log_reminder',
			'medication_reminder',
			'water_reminder',
			'exercise_reminder',
			'kick_count_reminder',
			
			// Appointments
			'appointment_reminder',
			'appointment_confirmed',
			'appointment_cancelled',
			'appointment_rescheduled',
			
			// Health alerts
			'health_alert',
			'symptom_warning',
			'vital_concern',
			
			// Pregnancy milestones
			'weekly_update',
			'trimester_change',
			'milestone_reached',
			
			// Social/Partner
			'partner_request',
			'partner_accepted',
			'partner_shared_log',
			'partner_note_added',
			
			// Content
			'new_article',
			'quiz_recommendation',
			'daily_tip',
			
			// Reports
			'weekly_report_ready',
			'monthly_summary',
			
			// AI Chat
			'chat_response',
			'follow_up_suggestion',
			
			// System
			'system_announcement',
			'feature_update',
			'account_security',
			
			// Achievements
			'achievement_earned',
			'streak_milestone',
			
			'other'
		],
		required: true,
		index: true
	},
	
	category: {
		type: String,
		enum: ['health', 'appointment', 'social', 'content', 'report', 'system', 'achievement'],
		required: true
	},
	
	// Priority
	priority: {
		type: String,
		enum: ['low', 'normal', 'high', 'urgent'],
		default: 'normal'
	},
	
	// Related entities
	relatedEntity: {
		type: { type: String, enum: ['appointment', 'healthLog', 'article', 'quiz', 'report', 'user', 'conversation'] },
		id: { type: mongoose.Schema.Types.ObjectId }
	},
	
	// Action URL/deep link
	actionUrl: { type: String, trim: true },
	actionLabel: { type: String, trim: true }, // e.g., "View Report", "Log Now"
	
	// Media
	imageUrl: { type: String, trim: true },
	iconType: { type: String, trim: true }, // Icon name for app display
	
	// Status
	read: { type: Boolean, default: false },
	readAt: { type: Date },
	
	// Delivery
	deliveryChannels: [{
		channel: { type: String, enum: ['in_app', 'push', 'email', 'sms'] },
		sent: { type: Boolean, default: false },
		sentAt: { type: Date },
		delivered: { type: Boolean, default: false },
		deliveredAt: { type: Date },
		failed: { type: Boolean, default: false },
		failReason: { type: String }
	}],
	
	// Scheduling
	scheduledFor: { type: Date },
	expiresAt: { type: Date },
	
	// Interaction tracking
	clicked: { type: Boolean, default: false },
	clickedAt: { type: Date },
	dismissed: { type: Boolean, default: false },
	dismissedAt: { type: Date },
	
	// Grouping (for stacking similar notifications)
	groupKey: { type: String, trim: true },
	
	// Created by (system, admin, or trigger)
	createdBy: {
		type: { type: String, enum: ['system', 'admin', 'trigger', 'user'] },
		id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
	},
	
	// Soft delete
	deletedAt: { type: Date, default: null }

}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// NOTIFICATION PREFERENCES SCHEMA (can also be embedded in User)
// ============================================================================
const notificationPreferencesSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		unique: true,
		index: true
	},
	
	// Global settings
	enabled: { type: Boolean, default: true },
	quietHoursEnabled: { type: Boolean, default: false },
	quietHoursStart: { type: String, default: '22:00' }, // HH:MM format
	quietHoursEnd: { type: String, default: '07:00' },
	
	// Channel preferences
	channels: {
		inApp: { type: Boolean, default: true },
		push: { type: Boolean, default: true },
		email: { type: Boolean, default: true },
		sms: { type: Boolean, default: false }
	},
	
	// Type-specific preferences
	typePreferences: {
		// Health reminders
		dailyLogReminder: { enabled: { type: Boolean, default: true }, time: { type: String, default: '20:00' } },
		medicationReminder: { enabled: { type: Boolean, default: true } },
		waterReminder: { enabled: { type: Boolean, default: false }, intervalHours: { type: Number, default: 2 } },
		exerciseReminder: { enabled: { type: Boolean, default: false } },
		kickCountReminder: { enabled: { type: Boolean, default: true }, time: { type: String, default: '19:00' } },
		
		// Appointments
		appointmentReminders: { 
			enabled: { type: Boolean, default: true },
			hoursBefore: [{ type: Number }] // e.g., [24, 2] for reminders 24h and 2h before
		},
		
		// Health alerts - always on for safety
		healthAlerts: { enabled: { type: Boolean, default: true } },
		
		// Weekly updates
		weeklyUpdates: { enabled: { type: Boolean, default: true }, dayOfWeek: { type: Number, default: 1 } }, // Monday
		
		// Partner notifications
		partnerNotifications: { enabled: { type: Boolean, default: true } },
		
		// Content
		contentRecommendations: { enabled: { type: Boolean, default: true }, frequency: { type: String, default: 'daily' } },
		
		// Reports
		weeklyReportNotification: { enabled: { type: Boolean, default: true } }
	},
	
	// Email digest preferences
	emailDigest: {
		enabled: { type: Boolean, default: false },
		frequency: { type: String, enum: ['daily', 'weekly'], default: 'weekly' }
	}

}, {
	timestamps: true
});

// ============================================================================
// SCHEDULED NOTIFICATION SCHEMA
// For recurring notifications
// ============================================================================
const scheduledNotificationSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
	
	// Template
	templateType: {
		type: String,
		enum: [
			'daily_log_reminder',
			'water_reminder',
			'kick_count_reminder',
			'medication_reminder',
			'weekly_update',
			'custom'
		],
		required: true
	},
	
	// Custom content (for custom type)
	customTitle: { type: String, trim: true },
	customMessage: { type: String, trim: true },
	
	// Schedule
	schedule: {
		type: { type: String, enum: ['once', 'daily', 'weekly', 'interval'], required: true },
		time: { type: String }, // HH:MM for daily
		dayOfWeek: { type: Number, min: 0, max: 6 }, // For weekly (0 = Sunday)
		intervalMinutes: { type: Number }, // For interval type
		startDate: { type: Date },
		endDate: { type: Date }
	},
	
	// Status
	isActive: { type: Boolean, default: true },
	lastTriggeredAt: { type: Date },
	nextTriggerAt: { type: Date },
	triggerCount: { type: Number, default: 0 }

}, {
	timestamps: true
});

// ============================================================================
// INDEXES
// ============================================================================
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ userId: 1, category: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ groupKey: 1 });
notificationSchema.index({ deletedAt: 1 });

scheduledNotificationSchema.index({ userId: 1, isActive: 1 });
scheduledNotificationSchema.index({ nextTriggerAt: 1, isActive: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
notificationSchema.virtual('isExpired').get(function() {
	if (!this.expiresAt) return false;
	return this.expiresAt < new Date();
});

notificationSchema.virtual('isScheduled').get(function() {
	if (!this.scheduledFor) return false;
	return this.scheduledFor > new Date();
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
notificationSchema.methods.markAsRead = async function() {
	this.read = true;
	this.readAt = new Date();
	await this.save();
	return this;
};

notificationSchema.methods.markAsClicked = async function() {
	this.clicked = true;
	this.clickedAt = new Date();
	if (!this.read) {
		this.read = true;
		this.readAt = new Date();
	}
	await this.save();
	return this;
};

notificationSchema.methods.dismiss = async function() {
	this.dismissed = true;
	this.dismissedAt = new Date();
	await this.save();
	return this;
};

notificationSchema.methods.markDelivered = async function(channel) {
	const channelEntry = this.deliveryChannels.find(c => c.channel === channel);
	if (channelEntry) {
		channelEntry.delivered = true;
		channelEntry.deliveredAt = new Date();
		await this.save();
	}
	return this;
};

// ============================================================================
// STATIC METHODS
// ============================================================================
notificationSchema.statics.getUnread = function(userId, limit = 50) {
	return this.find({
		userId,
		read: false,
		dismissed: false,
		deletedAt: null,
		$or: [
			{ expiresAt: { $gte: new Date() } },
			{ expiresAt: null }
		]
	})
	.sort({ createdAt: -1 })
	.limit(limit);
};

notificationSchema.statics.getAll = function(userId, options = {}) {
	const query = {
		userId,
		deletedAt: null,
		dismissed: false
	};
	
	if (options.type) query.type = options.type;
	if (options.category) query.category = options.category;
	if (options.read !== undefined) query.read = options.read;
	
	return this.find(query)
		.sort({ createdAt: -1 })
		.limit(options.limit || 100);
};

notificationSchema.statics.getUnreadCount = function(userId) {
	return this.countDocuments({
		userId,
		read: false,
		dismissed: false,
		deletedAt: null,
		$or: [
			{ expiresAt: { $gte: new Date() } },
			{ expiresAt: null }
		]
	});
};

notificationSchema.statics.markAllAsRead = function(userId) {
	return this.updateMany(
		{ userId, read: false, deletedAt: null },
		{ $set: { read: true, readAt: new Date() } }
	);
};

notificationSchema.statics.deleteOld = function(daysOld = 30) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOld);
	
	return this.updateMany(
		{ createdAt: { $lt: cutoffDate }, read: true },
		{ $set: { deletedAt: new Date() } }
	);
};

notificationSchema.statics.createHealthReminder = async function(userId, reminderType, customMessage = null) {
	const templates = {
		daily_log_reminder: {
			title: 'Time to Log Your Health',
			message: "Don't forget to log your daily health information. It helps track your pregnancy journey!",
			category: 'health',
			actionLabel: 'Log Now'
		},
		water_reminder: {
			title: 'Stay Hydrated! 💧',
			message: "Remember to drink water. Staying hydrated is important for you and your baby.",
			category: 'health',
			actionLabel: 'Log Water'
		},
		kick_count_reminder: {
			title: 'Kick Count Time',
			message: "It's time to count your baby's movements. Find a quiet moment to focus on your baby.",
			category: 'health',
			actionLabel: 'Start Counting'
		}
	};
	
	const template = templates[reminderType] || {};
	
	const notification = new this({
		userId,
		title: template.title || 'Health Reminder',
		message: customMessage || template.message || 'Remember to take care of your health!',
		type: reminderType,
		category: template.category || 'health',
		actionLabel: template.actionLabel,
		createdBy: { type: 'system' }
	});
	
	await notification.save();
	return notification;
};

notificationSchema.statics.createAppointmentReminder = async function(userId, appointment, hoursBefore) {
	const notification = new this({
		userId,
		title: 'Upcoming Appointment',
		message: `Reminder: ${appointment.title} in ${hoursBefore} hour${hoursBefore > 1 ? 's' : ''}`,
		type: 'appointment_reminder',
		category: 'appointment',
		priority: 'high',
		relatedEntity: { type: 'appointment', id: appointment._id },
		actionLabel: 'View Details',
		createdBy: { type: 'system' }
	});
	
	await notification.save();
	return notification;
};

notificationSchema.statics.createWeeklyUpdate = async function(userId, weekNumber) {
	const notification = new this({
		userId,
		title: `Week ${weekNumber} of Your Pregnancy! 🎉`,
		message: `You're now in week ${weekNumber}. Check out what's happening with your baby and your body.`,
		type: 'weekly_update',
		category: 'content',
		actionLabel: 'Learn More',
		createdBy: { type: 'system' }
	});
	
	await notification.save();
	return notification;
};

// Scheduled notification methods
scheduledNotificationSchema.methods.calculateNextTrigger = function() {
	const now = new Date();
	
	switch (this.schedule.type) {
		case 'daily': {
			const [hours, minutes] = this.schedule.time.split(':').map(Number);
			const next = new Date(now);
			next.setHours(hours, minutes, 0, 0);
			if (next <= now) {
				next.setDate(next.getDate() + 1);
			}
			this.nextTriggerAt = next;
			break;
		}
		case 'weekly': {
			const [hours, minutes] = this.schedule.time.split(':').map(Number);
			const next = new Date(now);
			next.setHours(hours, minutes, 0, 0);
			const daysUntilTarget = (this.schedule.dayOfWeek - now.getDay() + 7) % 7 || 7;
			next.setDate(next.getDate() + daysUntilTarget);
			this.nextTriggerAt = next;
			break;
		}
		case 'interval': {
			this.nextTriggerAt = new Date(now.getTime() + this.schedule.intervalMinutes * 60 * 1000);
			break;
		}
	}
	
	return this.nextTriggerAt;
};

scheduledNotificationSchema.statics.getDueNotifications = function() {
	return this.find({
		isActive: true,
		nextTriggerAt: { $lte: new Date() },
		$or: [
			{ 'schedule.endDate': { $gte: new Date() } },
			{ 'schedule.endDate': null }
		]
	});
};

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
notificationSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
notificationSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

notificationPreferencesSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

scheduledNotificationSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

// ============================================================================
// EXPORT MODELS
// ============================================================================
const Notification = mongoose.model('Notification', notificationSchema);
const NotificationPreferences = mongoose.model('NotificationPreferences', notificationPreferencesSchema);
const ScheduledNotification = mongoose.model('ScheduledNotification', scheduledNotificationSchema);

module.exports = {
	Notification,
	NotificationPreferences,
	ScheduledNotification
};
