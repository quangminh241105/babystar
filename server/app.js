require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client/public')));

// View engine setup
app.set('view engine', 'ejs');
// change views root so includes resolve from ../client/views
app.set('views', path.join(__dirname, '../client/views'));

// Replace individual routes by importing routers from /server/routes
const { index: indexRouter, auth: authRouter, partner: partnerRouter, admin: adminRouter } = require('./routes/indexRouter');

// Require models so they're registered (no variable needed here)
require('./models/user');

// Mount routers
app.use('/', indexRouter);            // serves GET '/'
app.use('/auth', authRouter);         // serves /login and /register
app.use('/partner', partnerRouter);   // placeholder partner routes
app.use('/admin', adminRouter);       // placeholder admin routes

// Save original render
const originalRender = app.response.render;
app.response.render = function(view, options, callback) {
	// normalize args
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}
	options = options || {};

	// Only wrap views inside pages/ and avoid wrapping the layout itself
	if (typeof view === 'string' && view.indexOf('pages/') === 0 && view !== 'pages/layout') {
		// render the requested page to a string first, then render the layout with body
		return app.render(view, options, (err, rendered) => {
			if (err) {
				if (callback) return callback(err);
				// fallback error handling
				return this.req && this.req.next ? this.req.next(err) : this.status(500).send(err.message || 'Render error');
			}
			const layoutOptions = Object.assign({}, options, { body: rendered });
			// call original response.render to render pages/layout
			return originalRender.call(this, 'pages/layout', layoutOptions, callback);
		});
	}

	// default behavior
	return originalRender.call(this, view, options, callback);
};

// Connect to MongoDB then start server
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
.then(() => {
	console.log('✅ Connected to MongoDB');
	app.listen(PORT, () => {
	  console.log(`Server running on http://localhost:${PORT}`);
	});
})
.catch(err => {
	console.error('❌ MongoDB connection error:', err);
	process.exit(1);
});
