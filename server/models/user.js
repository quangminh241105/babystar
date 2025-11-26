const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================================================
// PREGNANCY PROFILE SUB-SCHEMA
// Embedded document for pregnancy-specific information
// ============================================================================
const pregnancyProfileSchema = new mongoose.Schema({
	lastMenstrualPeriod: { type: Date },
	conceptionDate: { type: Date },
	dueDate: { type: Date },
	
	// [IMPROVED] Added enum validation for blood type
	bloodType: { 
		type: String, 
		enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
		default: null
	},
	heightCm: { type: Number, min: 50, max: 300 },
	prePregnancyWeightKg: { type: Number, min: 20, max: 500 },
	
	// [IMPROVED] Arrays with trimmed strings
	allergies: [{ type: String, trim: true }],
	medicalConditions: [{ type: String, trim: true }],
	
	isHighRisk: { type: Boolean, default: false },
	
	// [IMPROVED] Added additional useful pregnancy fields
	gravida: { type: Number, default: 1, min: 1 }, // Total pregnancies including current
	para: { type: Number, default: 0, min: 0 },    // Number of births after 20 weeks
	
	// [IMPROVED] Healthcare provider information
	primaryPhysician: { type: String, trim: true },
	hospitalName: { type: String, trim: true },
	
	// [IMPROVED] Pregnancy status tracking
	status: {
		type: String,
		enum: ['active', 'completed', 'loss', 'terminated'],
		default: 'active'
	},
	deliveryDate: { type: Date }, // Actual delivery date when pregnancy completes
	
}, { _id: false }); // No separate _id for embedded document

// ============================================================================
// ASSOCIATED USER SUB-SCHEMA
// [IMPROVED] Separated into proper sub-schema with relationship tracking
// ============================================================================
const associatedUserSchema = new mongoose.Schema({
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true
	},
	relationship: { 
		type: String, 
		enum: ['partner', 'family_member', 'doctor', 'midwife', 'doula', 'other'],
		required: true
	},
	status: {
		type: String,
		enum: ['pending', 'accepted', 'rejected', 'revoked'],
		default: 'pending'
	},
	// [IMPROVED] Granular permission control
	permissions: {
		viewHealthLogs: { type: Boolean, default: true },
		viewWeeklyReports: { type: Boolean, default: true },
		viewMedicalInfo: { type: Boolean, default: false },
		receiveAlerts: { type: Boolean, default: false },
		addNotes: { type: Boolean, default: false }
	},
	invitedAt: { type: Date, default: Date.now },
	respondedAt: { type: Date },
	// [IMPROVED] Invitation expiry for security
	expiresAt: { 
		type: Date, 
		default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
	},
	customLabel: { type: String, trim: true, maxlength: 50 } // e.g., "Mom", "Dr. Smith"
}, { _id: true });

// ============================================================================
// NOTIFICATION PREFERENCES SUB-SCHEMA
// [IMPROVED] Added notification preferences for better UX
// ============================================================================
const notificationPreferencesSchema = new mongoose.Schema({
	email: { type: Boolean, default: true },
	push: { type: Boolean, default: true },
	sms: { type: Boolean, default: false },
	
	// Specific notification types
	dailyReminders: { type: Boolean, default: true },
	weeklyReportReady: { type: Boolean, default: true },
	appointmentReminders: { type: Boolean, default: true },
	partnerUpdates: { type: Boolean, default: true },
	healthAlerts: { type: Boolean, default: true },
	tipsAndArticles: { type: Boolean, default: false }
}, { _id: false });

// ============================================================================
// MAIN USER SCHEMA
// ============================================================================
const userSchema = new mongoose.Schema({
	// ===== AUTHENTICATION FIELDS =====
	email: { 
		type: String, 
		required: [true, 'Email is required'],
		trim: true, 
		lowercase: true, 
		unique: true,
		match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
	},
	
	// [IMPROVED] Password only required for email auth provider
	passwordHash: { 
		type: String,
		required: function() { 
			return this.authProvider === 'email'; 
		},
		select: false // Don't include in queries by default
	},
	
	// [IMPROVED] Auth provider for Google OAuth support
	authProvider: { 
		type: String, 
		enum: ['email', 'google'],
		default: 'email',
		required: true
	},
	
	// [IMPROVED] Google OAuth fields
	googleId: { 
		type: String, 
		unique: true, 
		sparse: true // Allows multiple null values while enforcing uniqueness for non-null
	},
	
	// ===== PROFILE INFORMATION =====
	firstName: { 
		type: String, 
		trim: true, 
		maxlength: [50, 'First name cannot exceed 50 characters']
	},
	lastName: { 
		type: String, 
		trim: true, 
		maxlength: [50, 'Last name cannot exceed 50 characters']
	},
	phoneNumber: { 
		type: String, 
		trim: true,
		match: [/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Please enter a valid phone number']
	},
	profileImageUrl: { type: String, trim: true },
	dateOfBirth: { type: Date },
	
	// ===== ROLE & STATUS =====
	role: { 
		type: String, 
		enum: {
			values: ['user', 'partner', 'admin'],
			message: '{VALUE} is not a valid role'
		},
		default: 'user',
		required: true
	},
	isActive: { type: Boolean, default: true },
	
	// [IMPROVED] Email verification for security
	isEmailVerified: { type: Boolean, default: false },
	emailVerificationToken: { type: String, select: false },
	emailVerificationExpires: { type: Date, select: false },
	
	// [IMPROVED] Password reset functionality
	passwordResetToken: { type: String, select: false },
	passwordResetExpires: { type: Date, select: false },
	
	// ===== PHYSICAL MEASUREMENTS =====
	currentWeightKg: { type: Number, min: 20, max: 500 },
	
	// ===== PREGNANCY PROFILE (Embedded) =====
	pregnancyProfile: { type: pregnancyProfileSchema, default: () => ({}) },
	
	// ===== ASSOCIATED USERS (Partners, Doctors, etc.) =====
	associatedUsers: [associatedUserSchema],
	
	// ===== INVITATION SYSTEM =====
	// [IMPROVED] Unique shareable invitation code
	invitationCode: { 
		type: String, 
		unique: true, 
		sparse: true
	},
	
	// ===== NOTIFICATION PREFERENCES =====
	notificationPreferences: { 
		type: notificationPreferencesSchema, 
		default: () => ({}) 
	},
	
	// ===== SECURITY & AUDIT =====
	// [IMPROVED] Login tracking for security
	lastLoginAt: { type: Date },
	lastLoginIP: { type: String },
	loginAttempts: { type: Number, default: 0 },
	lockUntil: { type: Date },
	
	// [IMPROVED] User preferences
	preferredLanguage: { type: String, default: 'en', enum: ['en', 'vi', 'es', 'fr', 'de', 'zh'] },
	timezone: { type: String, default: 'UTC' },
	
	// [IMPROVED] Terms acceptance tracking
	termsAcceptedAt: { type: Date },
	privacyPolicyAcceptedAt: { type: Date },
	
	// [IMPROVED] Soft delete support
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true, // Adds createdAt and updatedAt
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// ============================================================================
// INDEXES
// ============================================================================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ invitationCode: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'associatedUsers.userId': 1 });
userSchema.index({ 'associatedUsers.status': 1 });
// [IMPROVED] Compound index for efficient user lookups
userSchema.index({ email: 1, authProvider: 1 });
userSchema.index({ deletedAt: 1, isActive: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
// [IMPROVED] Full name virtual
userSchema.virtual('fullName').get(function() {
	if (this.firstName && this.lastName) {
		return `${this.firstName} ${this.lastName}`;
	}
	return this.firstName || this.lastName || '';
});

// [IMPROVED] Current pregnancy week calculation
userSchema.virtual('currentPregnancyWeek').get(function() {
	if (this.pregnancyProfile?.lastMenstrualPeriod) {
		const lmp = new Date(this.pregnancyProfile.lastMenstrualPeriod);
		const now = new Date();
		const diffTime = now - lmp;
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const weeks = Math.floor(diffDays / 7);
		const days = diffDays % 7;
		
		if (weeks >= 0 && weeks <= 42) {
			return { weeks, days, totalDays: diffDays };
		}
	}
	return null;
});

// [IMPROVED] Trimester calculation
userSchema.virtual('currentTrimester').get(function() {
	const weekInfo = this.currentPregnancyWeek;
	if (!weekInfo) return null;
	
	if (weekInfo.weeks <= 12) return 1;
	if (weekInfo.weeks <= 27) return 2;
	return 3;
});

// [IMPROVED] Days until due date
userSchema.virtual('daysUntilDueDate').get(function() {
	if (this.pregnancyProfile?.dueDate) {
		const dueDate = new Date(this.pregnancyProfile.dueDate);
		const now = new Date();
		const diffTime = dueDate - now;
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}
	return null;
});

// [IMPROVED] Check if account is locked
userSchema.virtual('isLocked').get(function() {
	return !!(this.lockUntil && this.lockUntil > Date.now());
});

// [IMPROVED] Age calculation
userSchema.virtual('age').get(function() {
	if (!this.dateOfBirth) return null;
	const today = new Date();
	const birthDate = new Date(this.dateOfBirth);
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
// Return public representation without sensitive fields
userSchema.methods.toPublic = function() {
	const obj = this.toObject();
	delete obj.passwordHash;
	delete obj.__v;
	delete obj.passwordResetToken;
	delete obj.passwordResetExpires;
	delete obj.emailVerificationToken;
	delete obj.emailVerificationExpires;
	delete obj.loginAttempts;
	delete obj.lockUntil;
	return obj;
};

// Compare password for authentication
userSchema.methods.comparePassword = async function(candidatePassword) {
	if (!this.passwordHash) return false;
	return bcrypt.compare(candidatePassword, this.passwordHash);
};

// [IMPROVED] Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
	const resetToken = crypto.randomBytes(32).toString('hex');
	this.passwordResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');
	this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
	return resetToken;
};

// [IMPROVED] Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
	const verifyToken = crypto.randomBytes(32).toString('hex');
	this.emailVerificationToken = crypto
		.createHash('sha256')
		.update(verifyToken)
		.digest('hex');
	this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
	return verifyToken;
};

// [IMPROVED] Generate unique invitation code
userSchema.methods.generateInvitationCode = function() {
	this.invitationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
	return this.invitationCode;
};

// [IMPROVED] Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
	// Reset if lock has expired
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.updateOne({
			$set: { loginAttempts: 1 },
			$unset: { lockUntil: 1 }
		});
	}
	
	const updates = { $inc: { loginAttempts: 1 } };
	
	// Lock account after 5 failed attempts for 2 hours
	if (this.loginAttempts + 1 >= 5) {
		updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
	}
	
	return this.updateOne(updates);
};

// [IMPROVED] Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function() {
	return this.updateOne({
		$set: { loginAttempts: 0, lastLoginAt: new Date() },
		$unset: { lockUntil: 1 }
	});
};

// [IMPROVED] Add associated user
userSchema.methods.addAssociatedUser = function(userId, relationship, customLabel = '') {
	// Check if already associated
	const existing = this.associatedUsers.find(
		au => au.userId.toString() === userId.toString()
	);
	
	if (existing) {
		throw new Error('User is already associated');
	}
	
	this.associatedUsers.push({
		userId,
		relationship,
		customLabel,
		invitedAt: new Date(),
		status: 'pending'
	});
	
	return this.save();
};

// [IMPROVED] Accept/reject association request
userSchema.methods.updateAssociationStatus = function(associationId, status) {
	const association = this.associatedUsers.id(associationId);
	
	if (!association) {
		throw new Error('Association not found');
	}
	
	association.status = status;
	association.respondedAt = new Date();
	
	return this.save();
};

// ============================================================================
// STATIC METHODS
// ============================================================================
// [IMPROVED] Find or create user from Google OAuth
userSchema.statics.findOrCreateGoogleUser = async function(profile) {
	// First, try to find by googleId
	let user = await this.findOne({ googleId: profile.id });
	
	if (user) {
		// Update profile image if changed
		if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos[0].value) {
			user.profileImageUrl = profile.photos[0].value;
			await user.save();
		}
		return user;
	}
	
	// Check if email already exists (user registered with email first)
	const email = profile.emails?.[0]?.value;
	if (email) {
		user = await this.findOne({ email: email.toLowerCase() });
		
		if (user) {
			// Link Google account to existing user
			user.googleId = profile.id;
			user.isEmailVerified = true;
			if (!user.profileImageUrl && profile.photos?.[0]?.value) {
				user.profileImageUrl = profile.photos[0].value;
			}
			if (!user.firstName && profile.name?.givenName) {
				user.firstName = profile.name.givenName;
			}
			if (!user.lastName && profile.name?.familyName) {
				user.lastName = profile.name.familyName;
			}
			await user.save();
			return user;
		}
	}
	
	// Create new user
	user = await this.create({
		googleId: profile.id,
		email: email?.toLowerCase(),
		firstName: profile.name?.givenName || '',
		lastName: profile.name?.familyName || '',
		profileImageUrl: profile.photos?.[0]?.value || '',
		authProvider: 'google',
		isEmailVerified: true,
		role: 'expectant_mother'
	});
	
	// Generate invitation code for new user
	user.generateInvitationCode();
	await user.save();
	
	return user;
};

// [IMPROVED] Find user by invitation code
userSchema.statics.findByInvitationCode = function(code) {
	return this.findOne({ 
		invitationCode: code.toUpperCase(),
		isActive: true,
		deletedAt: null
	});
};

// [IMPROVED] Find active users by role
userSchema.statics.findActiveByRole = function(role) {
	return this.find({ 
		role, 
		isActive: true,
		deletedAt: null
	});
};

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================
userSchema.pre('save', async function(next) {
	// Hash password if modified and not already hashed
	if (this.isModified('passwordHash') && this.passwordHash) {
		// Check if already hashed (bcrypt hashes start with $2)
		if (!this.passwordHash.startsWith('$2')) {
			this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
		}
	}
	
	// Calculate due date from LMP if not set (280 days from LMP)
	if (this.pregnancyProfile?.lastMenstrualPeriod && !this.pregnancyProfile.dueDate) {
		const lmp = new Date(this.pregnancyProfile.lastMenstrualPeriod);
		this.pregnancyProfile.dueDate = new Date(lmp.getTime() + (280 * 24 * 60 * 60 * 1000));
	}
	
	// Generate invitation code if not exists (for expectant mothers)
	if (!this.invitationCode && this.role === 'expectant_mother') {
		this.invitationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
	}
	
	next();
});

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
// [IMPROVED] Exclude soft-deleted users by default
userSchema.pre(/^find/, function(next) {
	// Only apply if not explicitly querying for deleted users
	if (!this.getQuery().deletedAt) {
		this.where({ deletedAt: null });
	}
	next();
});

// ============================================================================
// JSON TRANSFORM
// ============================================================================
userSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret) {
		delete ret.passwordHash;
		delete ret.__v;
		delete ret.passwordResetToken;
		delete ret.passwordResetExpires;
		delete ret.emailVerificationToken;
		delete ret.emailVerificationExpires;
		delete ret.loginAttempts;
		delete ret.lockUntil;
		return ret;
	}
});

module.exports = mongoose.model('User', userSchema);
