require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Session config (24h)
// -----------------------------
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
app.use(session({
	name: process.env.SESSION_NAME || 'baby_star_sid',
	secret: process.env.SESSION_SECRET || 'please-change-this-secret',
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: SESSION_MAX_AGE,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production' // enable when using HTTPSn 
	}
}));

// Make session user available to all views as `user`
app.use((req, res, next) => {
	res.locals.user = req.session && req.session.user ? req.session.user : null;
	res.locals.currentPath = req.path;
	next();
});

// -----------------------------
// i18n Middleware
// -----------------------------
// const translations = {
// 	en: require('./i18n/en.json'),
// 	vi: require('./i18n/vi.json')
// };

app.use((req, res, next) => {
	// determine language from session or default to 'en'
	const lang = (req.session && req.session.language) || 'en';
	const dict = translations[lang] || translations.en;

	// expose translation helper and current language to views
	res.locals.lang = lang;
	res.locals.t = (key) => dict[key] || key;

	next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// View engine setup
app.set('view engine', 'ejs');
// Set view root to resolve from ../client/views
app.set('views', path.join(__dirname, '../client/views'));

// Import models
require('./models/user');

// -----------------------------
// Routes
// -----------------------------

// Importing routers from /server/routes
const { index: indexRouter, auth: authRouter, partner: partnerRouter, admin: adminRouter } = require('./routes/indexRouter');

// Mount routers
app.use('/', indexRouter);            // Import the index routes
app.use('/auth', authRouter);         // Import the auth routes
app.use('/partner', partnerRouter);   // Import the partner routes
app.use('/admin', adminRouter);       // Import the admin routes

// -----------------------------
// Render wrapper
// -----------------------------
const originalRender = app.response.render;
app.response.render = function(view, options, callback) {
	// normalize args
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}
	options = options || {};

	// explicit opt-out or rendering the layout itself -> short-circuit
	if (options.noLayout === true || options.layout === false || view === 'layout') {
		return originalRender.call(this, view, options, callback);
	}

	// determine views root (may be array or string)
	let viewsRoot = app.get('views');
	// if (Array.isArray(viewsRoot)) viewsRoot = viewsRoot[0];

	// quick page detection: startsWith('pages/') OR file exists under views/pages
	const isPageView = (typeof view === 'string') && (
		view.indexOf('pages/') === 0 ||
		(viewsRoot && (
			fs.existsSync(path.join(viewsRoot, 'pages', `${view}.ejs`)) ||
			fs.existsSync(path.join(viewsRoot, 'pages', view, 'index.ejs'))
		))
	);

	if (!isPageView) {
		return originalRender.call(this, view, options, callback);
	}

	// render page to string once, then render top-level layout with body
	return app.render(view, options, (err, rendered) => {
		if (err) {
			if (callback) return callback(err);
			return this.req && this.req.next ? this.req.next(err) : this.status(500).send(err.message || 'Render error');
		}
		const layoutOptions = Object.assign({}, options, { body: rendered });
		return originalRender.call(this, 'layout', layoutOptions, callback);
	});
};

// -----------------------------
// Connect to MongoDB then start
// -----------------------------
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pregnancy_app';

function startServer() {
	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}

mongoose.connect(MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
.then(() => {
	console.log(`✅ Connected to MongoDB (${MONGO_URI.startsWith('mongodb+srv://') ? 'Atlas' : 'local/custom host'})`);
	startServer();
})
.catch(err => {
	console.error('❌ MongoDB connection error:', err);
	process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
	console.log('Shutting down gracefully...');
	try {
		await mongoose.disconnect();
		console.log('MongoDB disconnected');
	} catch (e) {
		console.error('Error disconnecting MongoDB', e);
	}
	process.exit(0);
});
