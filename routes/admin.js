const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../database');
const { requireWriter, requireAdmin } = require('../middleware/auth');

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Dashboard
router.get('/', requireWriter, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [articlesRow, publishedRow, videosRow, usersRow] = await Promise.all([
      db.get(isAdmin ? 'SELECT COUNT(*) as cnt FROM articles' : 'SELECT COUNT(*) as cnt FROM articles WHERE author_id = $1', isAdmin ? [] : [req.user.id]),
      db.get(isAdmin ? "SELECT COUNT(*) as cnt FROM articles WHERE status='published'" : "SELECT COUNT(*) as cnt FROM articles WHERE status='published' AND author_id=$1", isAdmin ? [] : [req.user.id]),
      db.get('SELECT COUNT(*) as cnt FROM videos'),
      db.get('SELECT COUNT(*) as cnt FROM users'),
    ]);

    const recentArticles = await db.all(`
      SELECT a.*, c.name AS cat_name, u.display_name AS author_name
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      ${!isAdmin ? 'WHERE a.author_id = $1' : ''}
      ORDER BY a.created_at DESC LIMIT 15
    `, !isAdmin ? [req.user.id] : []);

    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: {
        articles: parseInt(articlesRow.cnt),
        published: parseInt(publishedRow.cnt),
        videos: parseInt(videosRow.cnt),
        users: parseInt(usersRow.cnt),
      },
      recentArticles
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Dashboard error', activePage: '' });
  }
});

// New post form
router.get('/articles/new', requireWriter, async (req, res) => {
  const categories = await db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/article-form', { title: 'New Post', article: null, categories, error: null });
});

// Create post
router.post('/articles/new', requireWriter, upload.single('cover_image'), async (req, res) => {
  const { title, excerpt, body, category_id, status, featured } = req.body;
  if (!title || !excerpt || !body) {
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    return res.render('admin/article-form', { title: 'New Post', article: null, categories, error: 'Title, excerpt and body are required.' });
  }
  try {
    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await db.get('SELECT id FROM articles WHERE slug = $1', [slug]);
    if (existing) slug += '-' + Date.now();

    const cover_image = req.file ? '/uploads/' + req.file.filename : null;
    const pub = status === 'published' ? new Date().toISOString() : null;

    await db.run(
      `INSERT INTO articles (title,slug,excerpt,body,cover_image,category_id,author_id,status,featured,published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [title, slug, excerpt, body, cover_image, category_id || null, req.user.id, status || 'draft', featured ? true : false, pub]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/article-form', { title: 'New Post', article: null, categories, error: 'Failed to save post.' });
  }
});

// Edit post form
router.get('/articles/:id/edit', requireWriter, async (req, res) => {
  const article = await db.get('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) return res.status(404).render('error', { message: 'Post not found', activePage: '' });
  if (req.user.role !== 'admin' && article.author_id !== req.user.id) {
    return res.status(403).render('error', { message: 'Not your post', activePage: '' });
  }
  const categories = await db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/article-form', { title: 'Edit Post', article, categories, error: null });
});

// Update post
router.post('/articles/:id/edit', requireWriter, upload.single('cover_image'), async (req, res) => {
  const article = await db.get('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (!article) return res.status(404).render('error', { message: 'Not found', activePage: '' });
  if (req.user.role !== 'admin' && article.author_id !== req.user.id) {
    return res.status(403).render('error', { message: 'Not your post', activePage: '' });
  }
  const { title, excerpt, body, category_id, status, featured } = req.body;
  const cover_image = req.file ? '/uploads/' + req.file.filename : article.cover_image;
  const pub = status === 'published' ? (article.status === 'published' ? article.published_at : new Date().toISOString()) : null;

  await db.run(
    `UPDATE articles SET title=$1,excerpt=$2,body=$3,cover_image=$4,category_id=$5,status=$6,featured=$7,published_at=$8 WHERE id=$9`,
    [title, excerpt, body, cover_image, category_id || null, status, featured ? true : false, pub, req.params.id]
  );
  res.redirect('/admin');
});

// Delete post
router.post('/articles/:id/delete', requireWriter, async (req, res) => {
  const article = await db.get('SELECT * FROM articles WHERE id = $1', [req.params.id]);
  if (article && (req.user.role === 'admin' || article.author_id === req.user.id)) {
    await db.run('DELETE FROM articles WHERE id = $1', [req.params.id]);
  }
  res.redirect('/admin');
});

// New video form
router.get('/videos/new', requireWriter, (req, res) => {
  res.render('admin/video-form', { title: 'Add Video', video: null, error: null });
});

// Add video
router.post('/videos/new', requireWriter, async (req, res) => {
  const { title, description, youtube_url, category, featured } = req.body;
  if (!title || !youtube_url) {
    return res.render('admin/video-form', { title: 'Add Video', video: null, error: 'Title and YouTube URL are required.' });
  }
  let youtube_id = youtube_url;
  const ytMatch = youtube_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) youtube_id = ytMatch[1];
  const thumbnail = `https://img.youtube.com/vi/${youtube_id}/maxresdefault.jpg`;

  await db.run(
    `INSERT INTO videos (title,description,youtube_id,thumbnail,category,author_id,featured) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [title, description || '', youtube_id, thumbnail, category || 'general', req.user.id, featured ? true : false]
  );
  res.redirect('/admin');
});

// Delete video
router.post('/videos/:id/delete', requireWriter, async (req, res) => {
  await db.run('DELETE FROM videos WHERE id = $1', [req.params.id]);
  res.redirect('/admin');
});

// Users list
router.get('/users', requireAdmin, async (req, res) => {
  const users = await db.all('SELECT id,clerk_id,username,display_name,email,role,is_active,created_at FROM users ORDER BY created_at DESC');
  res.render('admin/users', { title: 'Users', users });
});

// Change role
router.post('/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['member','writer','admin'].includes(role)) return res.redirect('/admin/users');
  await db.run('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
  res.redirect('/admin/users');
});

// Ban/unban
router.post('/users/:id/toggle', requireAdmin, async (req, res) => {
  const u = await db.get('SELECT is_active FROM users WHERE id = $1', [req.params.id]);
  if (u) await db.run('UPDATE users SET is_active = $1 WHERE id = $2', [!u.is_active, req.params.id]);
  res.redirect('/admin/users');
});

module.exports = router;
