/**
 * Authentication Middleware
 * Shared middleware functions for route protection and user state management
 */

// Require authenticated user - returns 401 JSON for API routes
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    // Check if request expects JSON (API) or HTML (page)
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(401).json({ success: false, errors: { general: 'Unauthorized' }});
    }
    return res.redirect('/auth/login');
  }
  next();
}

// Require authenticated user - always redirects (for page routes)
function requireAuthRedirect(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Redirect to home if already logged in (for login/register pages)
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  next();
}

// Require specific role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, errors: { general: 'Unauthorized' }});
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ success: false, errors: { general: 'Forbidden' }});
    }
    next();
  };
}

// Require admin role
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('pages/error', {
    title: 'Forbidden',
    statusCode: 403,
    errorTitle: 'Access Denied',
    errorMessage: 'You do not have permission to access this page.'
  });
}

// Check if user is logged in (doesn't block, just sets flag)
function checkAuth(req, res, next) {
  req.isAuthenticated = !!(req.session && req.session.user);
  req.currentUser = req.session?.user || null;
  next();
}

module.exports = {
  requireAuth,
  requireAuthRedirect,
  redirectIfLoggedIn,
  requireRole,
  requireAdmin,
  checkAuth
};
