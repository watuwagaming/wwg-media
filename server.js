require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const ejsLayouts = require('express-ejs-layouts');
const { clerkMiddleware } = require('@clerk/express');
const { db } = require('./database');
const { attachUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── VIEW ENGINE ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(clerkMiddleware());
app.use(attachUser);

// ─── SETTINGS ON EVERY REQUEST ───────────────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    const rows = await db.all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.locals.settings = settings;
  } catch {
    res.locals.settings = {};
  }
  next();
});

// ─── TEMPLATE HELPERS ────────────────────────────────────────────────────────
app.locals.formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
};
app.locals.timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};
app.locals.excerpt = (text, len = 120) => {
  if (!text) return '';
  const clean = text.replace(/<[^>]*>/g, '');
  return clean.length > len ? clean.slice(0, len) + '...' : clean;
};
app.locals.initial = (name) => (name || '?')[0].toUpperCase();

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/articles', require('./routes/articles'));
app.use('/videos', require('./routes/videos'));
app.use('/admin', require('./routes/admin'));
app.use('/admin', require('./routes/settings'));

// Profile
app.get('/profile', async (req, res) => {
  if (!req.user) return res.redirect('/sign-in');
  const articles = await db.all(`
    SELECT a.*, c.name AS cat_name, c.color AS cat_color
    FROM articles a LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.author_id = $1 ORDER BY a.created_at DESC LIMIT 20
  `, [req.user.id]);
  res.render('profile', { title: req.user.display_name, profileUser: req.user, articles, activePage: '' });
});

// Homepage
app.get('/', async (req, res) => {
  try {
    const [featured, latest, popular, featuredVideos, categories] = await Promise.all([
      db.get(`
        SELECT a.*, c.name AS cat_name, c.slug AS cat_slug, c.color AS cat_color,
               u.display_name AS author_name, u.username AS author_username
        FROM articles a LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.status = 'published' AND a.featured = TRUE
        ORDER BY a.published_at DESC LIMIT 1
      `),
      db.all(`
        SELECT a.*, c.name AS cat_name, c.slug AS cat_slug, c.color AS cat_color,
               u.display_name AS author_name, u.username AS author_username
        FROM articles a LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.status = 'published'
        ORDER BY a.published_at DESC LIMIT 8
      `),
      db.all(`
        SELECT a.*, c.name AS cat_name, c.color AS cat_color, u.display_name AS author_name
        FROM articles a LEFT JOIN categories c ON a.category_id = c.id
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.status = 'published'
        ORDER BY a.views DESC LIMIT 5
      `),
      db.all(`
        SELECT v.*, u.display_name AS author_name
        FROM videos v LEFT JOIN users u ON v.author_id = u.id
        ORDER BY v.created_at DESC LIMIT 6
      `),
      db.all('SELECT * FROM categories ORDER BY name'),
    ]);

    res.render('index', {
      title: "East Africa's Gaming Community",
      featured, latest, popular, featuredVideos, categories,
      activePage: 'home'
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong', activePage: '' });
  }
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('error', { title: '404', message: 'Page not found', activePage: '' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Error', message: 'Something went wrong', activePage: '' });
});

app.listen(PORT, () => console.log(`WWG Media running on http://localhost:${PORT}`));
