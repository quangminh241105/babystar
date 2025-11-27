require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // ADD THIS
const http = require('http');
const { Server: IOServer } = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Session config (24h)
// -----------------------------
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';
const SESSION_NAME = process.env.SESSION_NAME || 'baby_star_sid';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pregnancy_app';

// Create MongoStore for sessions - this ensures sessions persist and are shared
const sessionStore = MongoStore.create({
	mongoUrl: MONGO_URI,
	collectionName: 'sessions',
	ttl: SESSION_MAX_AGE / 1000, // TTL in seconds
	autoRemove: 'native'
});

// create session middleware instance so we can reuse it for socket.io
const sessionMiddleware = session({
	name: SESSION_NAME,
	secret: SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	store: sessionStore, // USE MONGO STORE
	cookie: {
		maxAge: SESSION_MAX_AGE,
		httpOnly: true,
		secure: false, // Set to true only in production with HTTPS
		sameSite: 'lax'
	}
});

// Cookie parser middleware
const cookieParserMiddleware = cookieParser();

app.use(cookieParserMiddleware);
app.use(sessionMiddleware);

// Make session middleware available for other modules if needed
app.set('sessionMiddleware', sessionMiddleware);

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

// app.use((req, res, next) => {
// 	// determine language from session or default to 'en'
// 	const lang = (req.session && req.session.language) || 'en';
// 	const dict = translations[lang] || translations.en;

// 	// expose translation helper and current language to views
// 	res.locals.lang = lang;
// 	res.locals.t = (key) => dict[key] || key;

// 	next();
// });

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
// const { User, HealthLog, WeeklyReport, Conversation } = require('./models');

// -----------------------------
// Routes
// -----------------------------

// Importing routers from /server/routes
const { index: indexRouter, auth: authRouter, partner: partnerRouter, admin: adminRouter } = require('./routes/indexRouter');

// Mount routers
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/partner', partnerRouter);
app.use('/admin', adminRouter);
app.use('/chatbot', require('./chatbot/routes'));

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
// Error Handling
// -----------------------------

// 404 Handler - catches unmatched routes
app.use((req, res, next) => {
  res.status(404).render('pages/error', {
    title: 'Page Not Found',
    statusCode: 404,
    errorTitle: 'Page Not Found',
    errorMessage: "Sorry, the page you're looking for doesn't exist or is still under development."
  });
});

// Global Error Handler - catches all errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Handle view not found errors
  if (err.message && err.message.includes('Failed to lookup view')) {
    return res.status(404).render('pages/error', {
      title: 'Page Not Found',
      statusCode: 404,
      errorTitle: 'Page Not Found',
      errorMessage: 'This page is still under development. Please check back later.'
    });
  }
  
  // Handle other errors
  res.status(statusCode).render('pages/error', {
    title: 'Error',
    statusCode: statusCode,
    errorTitle: statusCode === 500 ? 'Server Error' : 'Something Went Wrong',
    errorMessage: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An unexpected error occurred. Please try again later.'
  });
});

// -----------------------------
// Create HTTP server and attach socket.io
// -----------------------------
const server = http.createServer(app);

// Socket.IO - kept for future use but chatbot uses HTTP API
const io = new IOServer(server, {
	cors: { origin: true, credentials: true }
});

// Socket.IO is available for future real-time features
// Currently chatbot uses HTTP API for reliability
io.on('connection', (socket) => {
	console.log('Socket connected:', socket.id);
	socket.on('disconnect', () => {
		console.log('Socket disconnected:', socket.id);
	});
});

// -----------------------------
// Connect to MongoDB then start server
// -----------------------------
function startServer() {
	server.listen(PORT, () => {
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
