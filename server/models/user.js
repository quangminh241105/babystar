const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	name: { type: String, required: true, trim: true },
	email: { type: String, required: true, trim: true, lowercase: true, unique: true },
	passwordHash: { type: String, required: true }, // store hashed password
	role: { type: String, enum: ['user', 'partner', 'admin'], default: 'user' },
	// add other fields as needed (profile, dob, etc.)
}, {
	timestamps: true
});

// Add any instance/static methods as needed, e.g. toJSON to hide passwordHash
userSchema.methods.toPublic = function() {
	const obj = this.toObject();
	delete obj.passwordHash;
	return obj;
};

module.exports = mongoose.model('User', userSchema);
