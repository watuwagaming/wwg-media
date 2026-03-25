const { getAuth } = require('@clerk/express');
const { db } = require('../database');

// Sync Clerk user to our local DB and attach to req.user
async function attachUser(req, res, next) {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) {
      req.user = null;
      res.locals.user = null;
      return next();
    }

    // Find or create local user record
    let user = await db.get('SELECT * FROM users WHERE clerk_id = $1 AND is_active = TRUE', [clerkId]);

    if (!user) {
      // First time this Clerk user visits — create local record
      // Get user details from Clerk via the request's auth object
      const clerkUser = req.auth?.sessionClaims;
      const email = clerkUser?.email || `${clerkId}@clerk.user`;
      const username = (clerkUser?.username || clerkUser?.first_name || clerkId.slice(-8)).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const displayName = clerkUser?.full_name || clerkUser?.first_name || username;

      // Check username not taken
      const existing = await db.get('SELECT id FROM users WHERE username = $1', [username]);
      const finalUsername = existing ? `${username}_${Date.now().toString().slice(-4)}` : username;

      const result = await db.run(
        `INSERT INTO users (clerk_id, username, email, display_name) VALUES ($1,$2,$3,$4) RETURNING *`,
        [clerkId, finalUsername, email, displayName]
      );
      user = result.rows[0];
    }

    req.user = user;
    res.locals.user = user;
  } catch (err) {
    console.error('attachUser error:', err.message);
    req.user = null;
    res.locals.user = null;
  }
  next();
}

// Must be signed in via Clerk
function requireAuth(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) return res.redirect('/sign-in?redirect_url=' + encodeURIComponent(req.originalUrl));
  next();
}

// Must have writer or admin role in our DB
function requireWriter(req, res, next) {
  if (!req.user || !['writer', 'admin'].includes(req.user.role)) {
    return res.status(403).render('error', { message: 'Access denied. Writers only.', activePage: '' });
  }
  next();
}

// Must have admin role in our DB
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admins only.', activePage: '' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireWriter, requireAdmin };
