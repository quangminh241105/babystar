const mongoose = require('mongoose');

// ============================================================================
// REMINDER SUB-SCHEMA
// ============================================================================
const reminderSchema = new mongoose.Schema({
	type: {
		type: String,
		enum: ['email', 'push', 'sms'],
		default: 'push'
	},
	scheduledFor: { type: Date, required: true },
	sent: { type: Boolean, default: false },
	sentAt: { type: Date }
}, { _id: true });

// ============================================================================
// APPOINTMENT NOTES SUB-SCHEMA
// ============================================================================
const appointmentNoteSchema = new mongoose.Schema({
	content: { type: String, required: true, trim: true, maxlength: 2000 },
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	isFromDoctor: { type: Boolean, default: false },
	attachments: [{
		type: { type: String, enum: ['image', 'document', 'lab_result'] },
		url: { type: String, trim: true },
		filename: { type: String, trim: true }
	}]
}, { _id: true, timestamps: true });

// ============================================================================
// MAIN APPOINTMENT SCHEMA
// ============================================================================
const appointmentSchema = new mongoose.Schema({
	// User reference
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: [true, 'User ID is required'],
		index: true
	},
	
	// Appointment details
	title: { 
		type: String, 
		required: [true, 'Appointment title is required'],
		trim: true,
		maxlength: 200
	},
	description: { type: String, trim: true, maxlength: 1000 },
	
	// Appointment type
	appointmentType: {
		type: String,
		enum: [
			'prenatal_checkup',
			'ultrasound',
			'blood_test',
			'glucose_test',
			'genetic_screening',
			'specialist',
			'hospital_tour',
			'birthing_class',
			'pediatrician_interview',
			'dental',
			'mental_health',
			'postpartum_checkup',
			'vaccination',
			'other'
		],
		required: true
	},
	
	// Date and time
	scheduledDate: { 
		type: Date, 
		required: [true, 'Scheduled date is required'],
		index: true
	},
	endDate: { type: Date },
	duration: { type: Number, default: 30 }, // minutes
	isAllDay: { type: Boolean, default: false },
	
	// Recurrence
	isRecurring: { type: Boolean, default: false },
	recurrence: {
		frequency: { type: String, enum: ['weekly', 'biweekly', 'monthly'] },
		endDate: { type: Date },
		occurrences: { type: Number }
	},
	parentAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
	
	// Location
	location: {
		name: { type: String, trim: true },
		address: { type: String, trim: true },
		city: { type: String, trim: true },
		phone: { type: String, trim: true },
		// [IMPROVED] Google Maps integration
		placeId: { type: String, trim: true },
		coordinates: {
			lat: { type: Number },
			lng: { type: Number }
		}
	},
	
	// Healthcare provider
	provider: {
		name: { type: String, trim: true },
		specialty: { type: String, trim: true },
		phone: { type: String, trim: true },
		email: { type: String, trim: true }
	},
	
	// Status
	status: {
		type: String,
		enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'],
		default: 'scheduled'
	},
	cancelReason: { type: String, trim: true },
	
	// Pregnancy context
	pregnancyWeek: { type: Number, min: 1, max: 42 },
	
	// Preparation
	preparationInstructions: [{ type: String, trim: true }],
	fastingRequired: { type: Boolean, default: false },
	fastingHours: { type: Number },
	documentsToTake: [{ type: String, trim: true }],
	questionsToAsk: [{ type: String, trim: true }],
	
	// Results and follow-up
	results: {
		summary: { type: String, trim: true, maxlength: 2000 },
		documents: [{
			type: { type: String, enum: ['lab_result', 'ultrasound_image', 'report', 'prescription', 'other'] },
			url: { type: String, trim: true },
			filename: { type: String, trim: true },
			uploadedAt: { type: Date, default: Date.now }
		}],
		measurements: {
			babyHeartRate: { type: Number },
			fundalHeight: { type: Number },
			weight: { type: Number },
			bloodPressure: { type: String },
			urineProtein: { type: String },
			urineGlucose: { type: String }
		},
		followUpRequired: { type: Boolean, default: false },
		followUpNotes: { type: String, trim: true }
	},
	
	// Notes
	notes: [appointmentNoteSchema],
	
	// Reminders
	reminders: [reminderSchema],
	
	// Sharing
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
appointmentSchema.index({ userId: 1, scheduledDate: 1 });
appointmentSchema.index({ userId: 1, status: 1 });
appointmentSchema.index({ userId: 1, appointmentType: 1 });
appointmentSchema.index({ scheduledDate: 1 });
appointmentSchema.index({ sharedWith: 1 });
appointmentSchema.index({ deletedAt: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
appointmentSchema.virtual('isPast').get(function() {
	return this.scheduledDate < new Date();
});

appointmentSchema.virtual('isUpcoming').get(function() {
	const now = new Date();
	const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	return this.scheduledDate >= now && this.scheduledDate <= weekFromNow;
});

appointmentSchema.virtual('isToday').get(function() {
	const today = new Date();
	return this.scheduledDate.toDateString() === today.toDateString();
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
appointmentSchema.methods.addReminder = async function(type, hoursBeforeParam) {
	const hoursBefore = hoursBeforeParam || 24;
	const scheduledFor = new Date(this.scheduledDate.getTime() - hoursBefore * 60 * 60 * 1000);
	
	this.reminders.push({ type, scheduledFor });
	await this.save();
	return this;
};

appointmentSchema.methods.cancel = async function(reason) {
	this.status = 'cancelled';
	this.cancelReason = reason;
	await this.save();
	return this;
};

appointmentSchema.methods.complete = async function(resultsSummary) {
	this.status = 'completed';
	if (resultsSummary) {
		this.results.summary = resultsSummary;
	}
	await this.save();
	return this;
};

appointmentSchema.methods.addNote = async function(content, userId, isFromDoctor = false) {
	this.notes.push({ content, createdBy: userId, isFromDoctor });
	await this.save();
	return this;
};

// ============================================================================
// STATIC METHODS
// ============================================================================
appointmentSchema.statics.getUpcoming = function(userId, limit = 10) {
	return this.find({
		userId,
		scheduledDate: { $gte: new Date() },
		status: { $in: ['scheduled', 'confirmed'] },
		deletedAt: null
	})
	.sort({ scheduledDate: 1 })
	.limit(limit);
};

appointmentSchema.statics.getByDateRange = function(userId, startDate, endDate) {
	return this.find({
		userId,
		scheduledDate: { $gte: startDate, $lte: endDate },
		deletedAt: null
	}).sort({ scheduledDate: 1 });
};

appointmentSchema.statics.getByType = function(userId, appointmentType) {
	return this.find({
		userId,
		appointmentType,
		deletedAt: null
	}).sort({ scheduledDate: -1 });
};

appointmentSchema.statics.getPendingReminders = function() {
	const now = new Date();
	const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
	
	return this.find({
		'reminders.scheduledFor': { $lte: fiveMinutesFromNow },
		'reminders.sent': false,
		status: { $in: ['scheduled', 'confirmed'] },
		deletedAt: null
	});
};

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
appointmentSchema.pre(/^find/, function(next) {
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
appointmentSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.__v;
		return ret;
	}
});

module.exports = mongoose.model('Appointment', appointmentSchema);
