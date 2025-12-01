const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================================================
// PREGNANCY PROFILE SUB-SCHEMA
// All pregnancy-related information grouped together
// ============================================================================
const pregnancyProfileSchema = new mongoose.Schema({
	// Dates - use null as explicit default
	lastMenstrualPeriod: { type: Date, default: null },
	dueDate: { type: Date, default: null },
	deliveryDate: { type: Date, default: null },
	
	// Physical measurements
	heightCm: { type: Number, min: 50, max: 300, default: null },
	prePregnancyWeightKg: { type: Number, min: 20, max: 500, default: null },
	
	// Medical info
	bloodType: { 
		type: String, 
		enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
		default: null
	},
	allergies: { type: [String], default: [] },
	medicalConditions: { type: [String], default: [] },
	isHighRisk: { type: Boolean, default: false },
	
	// Pregnancy history
	gravida: { type: Number, default: 1, min: 1 },
	para: { type: Number, default: 0, min: 0 },
	
	// Healthcare provider
	primaryPhysician: { type: String, trim: true, default: null },
	hospitalName: { type: String, trim: true, default: null },
	
	// Status
	status: {
		type: String,
		enum: ['active', 'completed', 'loss', 'terminated'],
		default: 'active'
	}
}, { 
	_id: false,
	minimize: false // IMPORTANT: This prevents Mongoose from removing empty objects
});

// ============================================================================
// NOTIFICATION PREFERENCES SUB-SCHEMA
// ============================================================================
const notificationPreferencesSchema = new mongoose.Schema({
	email: { type: Boolean, default: true },
	push: { type: Boolean, default: true },
	sms: { type: Boolean, default: false },
	dailyReminders: { type: Boolean, default: true },
	weeklyReportReady: { type: Boolean, default: true },
	appointmentReminders: { type: Boolean, default: true },
	partnerUpdates: { type: Boolean, default: true },
	healthAlerts: { type: Boolean, default: true },
	tipsAndArticles: { type: Boolean, default: false }
}, { 
	_id: false,
	minimize: false
});

// ============================================================================
// ASSOCIATED USER SUB-SCHEMA
// ============================================================================
const associatedUserSchema = new mongoose.Schema({
	userId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true
	},
	relationship: { 
		type: String, 
		enum: ['partner', 'family_member'],
		required: true
	},
	// STATUS OPTIONS:
	// - 'pending': Initial state when invitation is sent, waiting for receiver to accept
	// - 'accepted': Receiver accepted the invitation, link is active
	// - 'rejected': Receiver rejected the invitation
	// - 'revoked': Sender cancelled/removed the link after it was established
	// - 'expired': Invitation expired before receiver responded (7 days default)
	status: {
		type: String,
		enum: ['pending', 'accepted', 'rejected', 'revoked', 'expired'],
		default: 'pending'
	},
	permissions: {
		viewHealthLogs: { type: Boolean, default: true },
		viewWeeklyReports: { type: Boolean, default: true },
		viewMedicalInfo: { type: Boolean, default: false },
		receiveAlerts: { type: Boolean, default: false },
		addNotes: { type: Boolean, default: false }
	},
	invitedAt: { type: Date, default: Date.now },
	respondedAt: { type: Date, default: null },
	expiresAt: { 
		type: Date, 
		default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
	},
	customLabel: { type: String, trim: true, maxlength: 50, default: null }
}, { _id: true, minimize: false });

// ============================================================================
// MAIN USER SCHEMA
// ============================================================================
const userSchema = new mongoose.Schema({
	// =========================================================================
	// AUTHENTICATION & ACCOUNT
	// =========================================================================
	email: { 
		type: String, 
		required: [true, 'Email is required'],
		trim: true, 
		lowercase: true, 
		unique: true,
		match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
	},
	passwordHash: { 
		type: String,
		select: false,
		default: null
	},
	authProvider: { 
		type: String, 
		enum: ['email', 'google'],
		default: 'email',
		required: true
	},
	googleId: { type: String, unique: true, sparse: true },  // No default - field won't exist for email users
	role: { 
		type: String, 
		enum: { values: ['user', 'partner', 'admin'], message: '{VALUE} is not a valid role' },
		default: 'user',
		required: true
	},
	isActive: { type: Boolean, default: true },
	isEmailVerified: { type: Boolean, default: false },
	emailVerificationToken: { type: String, select: false, default: null },
	emailVerificationExpires: { type: Date, select: false, default: null },
	passwordResetToken: { type: String, select: false, default: null },
	passwordResetExpires: { type: Date, select: false, default: null },
	
	// =========================================================================
	// PERSONAL INFO - ALL WITH EXPLICIT DEFAULTS
	// =========================================================================
	firstName: { type: String, trim: true, maxlength: 50, default: '' },
	lastName: { type: String, trim: true, maxlength: 50, default: '' },
	phoneNumber: { type: String, trim: true, default: null },
	profileImageUrl: { type: String, trim: true, default: null },
	dateOfBirth: { type: Date, default: null },
	currentWeightKg: { type: Number, min: 20, max: 500, default: null },
	
	// =========================================================================
	// PREGNANCY PROFILE (embedded object) - WITH EXPLICIT DEFAULT OBJECT
	// =========================================================================
	pregnancyProfile: { 
		type: pregnancyProfileSchema, 
		default: () => ({
			lastMenstrualPeriod: null,
			dueDate: null,
			deliveryDate: null,
			heightCm: null,
			prePregnancyWeightKg: null,
			bloodType: null,
			allergies: [],
			medicalConditions: [],
			isHighRisk: false,
			gravida: 1,
			para: 0,
			primaryPhysician: null,
			hospitalName: null,
			status: 'active'
		})
	},
	
	// =========================================================================
	// ASSOCIATED USERS (array)
	// =========================================================================
	associatedUsers: { type: [associatedUserSchema], default: [] },
	
	// =========================================================================
	// NOTIFICATION PREFERENCES (embedded object)
	// =========================================================================
	notificationPreferences: { 
		type: notificationPreferencesSchema, 
		default: () => ({
			email: true,
			push: true,
			sms: false,
			dailyReminders: true,
			weeklyReportReady: true,
			appointmentReminders: true,
			partnerUpdates: true,
			healthAlerts: true,
			tipsAndArticles: false
		})
	},
	
	// =========================================================================
	// USER PREFERENCES & SETTINGS
	// =========================================================================
	preferredLanguage: { type: String, default: 'en', enum: ['en', 'vi', 'es', 'fr', 'de', 'zh'] },
	language: { type: String, enum: ['en', 'vi'], default: 'en' },
	timezone: { type: String, default: 'UTC' },
	invitationCode: { type: String, unique: true, sparse: true },  // No default - generated on first access
	invitationCodeExpiresAt: { type: Date },  // No default - set when code is generated
	
	// =========================================================================
	// SECURITY & AUDIT
	// =========================================================================
	lastLoginAt: { type: Date, default: null },
	lastLoginIP: { type: String, default: null },
	loginAttempts: { type: Number, default: 0 },
	lockUntil: { type: Date, default: null },
	termsAcceptedAt: { type: Date, default: null },
	privacyPolicyAcceptedAt: { type: Date, default: null },
	deletedAt: { type: Date, default: null }
	
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true },
	minimize: false // CRITICAL: Prevents Mongoose from removing empty objects/null values
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
userSchema.index({ email: 1, authProvider: 1 });
userSchema.index({ deletedAt: 1, isActive: 1 });

// ============================================================================
// VIRTUALS
// ============================================================================
userSchema.virtual('fullName').get(function() {
	if (this.firstName && this.lastName) {
		return `${this.firstName} ${this.lastName}`;
	}
	return this.firstName || this.lastName || '';
});

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

userSchema.virtual('currentTrimester').get(function() {
	const weekInfo = this.currentPregnancyWeek;
	if (!weekInfo) return null;
	if (weekInfo.weeks <= 12) return 1;
	if (weekInfo.weeks <= 27) return 2;
	return 3;
});

userSchema.virtual('daysUntilDueDate').get(function() {
	if (this.pregnancyProfile?.dueDate) {
		const dueDate = new Date(this.pregnancyProfile.dueDate);
		const now = new Date();
		const diffTime = dueDate - now;
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}
	return null;
});

userSchema.virtual('isLocked').get(function() {
	return !!(this.lockUntil && this.lockUntil > Date.now());
});

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

// Check if invitation code is expired (5 minutes = 300000ms)
userSchema.virtual('isInvitationCodeExpired').get(function() {
	if (!this.invitationCodeExpiresAt) return true;
	return new Date() > new Date(this.invitationCodeExpiresAt);
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================
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

userSchema.methods.comparePassword = async function(candidatePassword) {
	if (!this.passwordHash) return false;
	return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.generatePasswordResetToken = function() {
	const resetToken = crypto.randomBytes(32).toString('hex');
	this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
	this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
	return resetToken;
};

userSchema.methods.generateEmailVerificationToken = function() {
	const verifyToken = crypto.randomBytes(32).toString('hex');
	this.emailVerificationToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
	this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
	return verifyToken;
};

// Generate invitation code with 5-minute expiration
userSchema.methods.generateInvitationCode = function() {
	this.invitationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
	this.invitationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
	return this.invitationCode;
};

// Get valid invitation code (regenerate if expired)
userSchema.methods.getValidInvitationCode = async function() {
	if (this.isInvitationCodeExpired) {
		this.generateInvitationCode();
		await this.save();
	}
	return this.invitationCode;
};

userSchema.methods.incLoginAttempts = async function() {
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
	}
	const updates = { $inc: { loginAttempts: 1 } };
	if (this.loginAttempts + 1 >= 5) {
		updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
	}
	return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
	return this.updateOne({ $set: { loginAttempts: 0, lastLoginAt: new Date() }, $unset: { lockUntil: 1 } });
};

// Add associated user (when someone enters your invitation code)
userSchema.methods.addAssociatedUser = function(userId, relationship, customLabel = '') {
	const existing = this.associatedUsers.find(au => au.userId.toString() === userId.toString());
	if (existing) {
		if (existing.status === 'rejected' || existing.status === 'revoked' || existing.status === 'expired') {
			// Allow re-invitation if previously rejected/revoked/expired
			existing.status = 'pending';
			existing.relationship = relationship;
			existing.customLabel = customLabel;
			existing.invitedAt = new Date();
			existing.respondedAt = null;
			existing.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			return this.save();
		}
		throw new Error('User is already associated');
	}
	this.associatedUsers.push({ 
		userId, 
		relationship, 
		customLabel, 
		invitedAt: new Date(), 
		status: 'pending',
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
	});
	return this.save();
};

// SENDER: Accept a pending association request (approve the person who used your code)
userSchema.methods.acceptAssociation = function(associationId) {
	const association = this.associatedUsers.id(associationId);
	if (!association) throw new Error('Association not found');
	if (association.status !== 'pending') throw new Error('Association is not pending');
	
	association.status = 'accepted';
	association.respondedAt = new Date();
	return this.save();
};

// SENDER: Reject a pending association request
userSchema.methods.rejectAssociation = function(associationId) {
	const association = this.associatedUsers.id(associationId);
	if (!association) throw new Error('Association not found');
	if (association.status !== 'pending') throw new Error('Association is not pending');
	
	association.status = 'rejected';
	association.respondedAt = new Date();
	return this.save();
};

// SENDER: Revoke an accepted association (remove linked user)
userSchema.methods.revokeAssociation = function(associationId) {
	const association = this.associatedUsers.id(associationId);
	if (!association) throw new Error('Association not found');
	
	association.status = 'revoked';
	association.respondedAt = new Date();
	return this.save();
};

// SENDER: Remove association completely from array
userSchema.methods.removeAssociation = function(associationId) {
	const association = this.associatedUsers.id(associationId);
	if (!association) throw new Error('Association not found');
	
	association.deleteOne();
	return this.save();
};

// SENDER: Update association permissions
userSchema.methods.updateAssociationPermissions = function(associationId, permissions) {
	const association = this.associatedUsers.id(associationId);
	if (!association) throw new Error('Association not found');
	
	if (permissions.viewHealthLogs !== undefined) association.permissions.viewHealthLogs = permissions.viewHealthLogs;
	if (permissions.viewWeeklyReports !== undefined) association.permissions.viewWeeklyReports = permissions.viewWeeklyReports;
	if (permissions.viewMedicalInfo !== undefined) association.permissions.viewMedicalInfo = permissions.viewMedicalInfo;
	if (permissions.receiveAlerts !== undefined) association.permissions.receiveAlerts = permissions.receiveAlerts;
	if (permissions.addNotes !== undefined) association.permissions.addNotes = permissions.addNotes;
	
	return this.save();
};

// Get pending associations (people waiting for approval)
userSchema.methods.getPendingAssociations = function() {
	return this.associatedUsers.filter(au => au.status === 'pending');
};

// Get accepted associations (active links)
userSchema.methods.getAcceptedAssociations = function() {
	return this.associatedUsers.filter(au => au.status === 'accepted');
};

// Check and expire old pending associations
userSchema.methods.expirePendingAssociations = async function() {
	const now = new Date();
	let changed = false;
	
	this.associatedUsers.forEach(au => {
		if (au.status === 'pending' && au.expiresAt && au.expiresAt < now) {
			au.status = 'expired';
			au.respondedAt = now;
			changed = true;
		}
	});
	
	if (changed) {
		await this.save();
	}
	return this;
};

// ============================================================================
// STATIC METHODS
// ============================================================================
userSchema.statics.findOrCreateGoogleUser = async function(profile) {
	let user = await this.findOne({ googleId: profile.id });
	if (user) {
		if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos[0].value) {
			user.profileImageUrl = profile.photos[0].value;
			await user.save();
		}
		return user;
	}
	const email = profile.emails?.[0]?.value;
	if (email) {
		user = await this.findOne({ email: email.toLowerCase() });
		if (user) {
			user.googleId = profile.id;
			user.isEmailVerified = true;
			if (!user.profileImageUrl && profile.photos?.[0]?.value) user.profileImageUrl = profile.photos[0].value;
			if (!user.firstName && profile.name?.givenName) user.firstName = profile.name.givenName;
			if (!user.lastName && profile.name?.familyName) user.lastName = profile.name.familyName;
			await user.save();
			return user;
		}
	}
	user = await this.create({
		googleId: profile.id,
		email: email?.toLowerCase(),
		firstName: profile.name?.givenName || '',
		lastName: profile.name?.familyName || '',
		profileImageUrl: profile.photos?.[0]?.value || '',
		authProvider: 'google',
		isEmailVerified: true,
		role: 'user'
	});
	user.generateInvitationCode();
	await user.save();
	return user;
};

userSchema.statics.findByInvitationCode = function(code) {
	return this.findOne({ 
		invitationCode: code.toUpperCase(), 
		invitationCodeExpiresAt: { $gt: new Date() }, // Must not be expired
		isActive: true, 
		deletedAt: null 
	});
};

userSchema.statics.findActiveByRole = function(role) {
	return this.find({ role, isActive: true, deletedAt: null });
};

// Find users where current user is in their associatedUsers array (as receiver)
userSchema.statics.findAssociationsForUser = function(userId) {
	return this.find({
		'associatedUsers.userId': userId,
		isActive: true,
		deletedAt: null
	}).select('firstName lastName email profileImageUrl associatedUsers');
};

// Find users where current user has pending invitations (as receiver)
userSchema.statics.findPendingInvitationsForUser = function(userId) {
	return this.find({
		'associatedUsers.userId': userId,
		'associatedUsers.status': 'pending',
		isActive: true,
		deletedAt: null
	}).select('firstName lastName email profileImageUrl associatedUsers');
};

// ============================================================================
// PRE-SAVE MIDDLEWARE
// ============================================================================
userSchema.pre('save', async function(next) {
	if (this.isModified('passwordHash') && this.passwordHash && !this.passwordHash.startsWith('$2')) {
		this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
	}
	if (this.isModified('pregnancyProfile') || this.isModified('pregnancyProfile.lastMenstrualPeriod')) {
		if (this.pregnancyProfile?.lastMenstrualPeriod && !this.pregnancyProfile.dueDate) {
			const lmp = new Date(this.pregnancyProfile.lastMenstrualPeriod);
			this.pregnancyProfile.dueDate = new Date(lmp.getTime() + (280 * 24 * 60 * 60 * 1000));
		}
	}
	// Generate invitation code with expiration if not exists or expired
	if (!this.invitationCode || !this.invitationCodeExpiresAt || new Date() > this.invitationCodeExpiresAt) {
		if (this.role === 'user') {
			this.invitationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
			this.invitationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
		}
	}
	
	next();
});

// ============================================================================
// QUERY MIDDLEWARE
// ============================================================================
userSchema.pre(/^find/, function(next) {
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
