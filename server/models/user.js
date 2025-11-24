const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	email: { type: String, required: true, trim: true, lowercase: true, unique: true },
	passwordHash: { type: String, required: true }, // store hashed password
	role: { type: String, enum: ['user', 'partner', 'admin'], default: 'user' },
	// add other fields as needed (profile, dob, etc.)
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

// index to ensure uniqueness at DB level
userSchema.index({ email: 1 }, { unique: true });

// instance: return public representation without passwordHash and __v
userSchema.methods.toPublic = function() {
	const obj = this.toObject();
	delete obj.passwordHash;
	delete obj.__v;
	return obj;
};

// helper used in many auth flows
userSchema.methods.comparePassword = function(plain) {
	return bcrypt.compare(plain, this.passwordHash);
};

// Optional: better default JSON output to hide sensitive fields
userSchema.set('toJSON', {
	transform: function(doc, ret) {
		delete ret.passwordHash;
		delete ret.__v;
		return ret;
	}
});

module.exports = mongoose.model('User', userSchema);
