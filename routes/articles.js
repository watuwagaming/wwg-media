const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAuth } = require('../middleware/auth');

// All articles listing
router.get('/', async (req, res) => {
  try {
    const { category, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    let where = "a.status = 'published'";
    const params = [];

    if (category) { where += ` AND c.slug = $${params.length+1}`; params.push(category); }
    if (q) { where += ` AND (a.title ILIKE $${params.length+1} OR a.excerpt ILIKE $${params.length+2})`; params.push(`%${q}%`, `%${q}%`); }

    const articles = await db.all(`
      SELECT a.*, c.name AS cat_name, c.slug AS cat_slug, c.color AS cat_color,
             u.display_name AS author_name, u.username AS author_username
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE ${where}
      ORDER BY a.published_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, limit, offset]);

    const countRow = await db.get(`
      SELECT COUNT(*) as cnt FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE ${where}
    `, params);

    const total = parseInt(countRow.cnt);
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    const catObj = categories.find(c => c.slug === category);

    res.render('articles', {
      title: catObj ? catObj.name : q ? `Search: ${q}` : 'All Posts',
      activePage: 'articles',
      articles, categories, total,
      page, limit, category, q,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load posts', activePage: '' });
  }
});

// Single article
router.get('/:slug', async (req, res) => {
  try {
    const article = await db.get(`
      SELECT a.*, c.name AS cat_name, c.slug AS cat_slug, c.color AS cat_color,
             u.display_name AS author_name, u.username AS author_username,
             u.avatar AS author_avatar, u.bio AS author_bio
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.slug = $1 AND a.status = 'published'
    `, [req.params.slug]);

    if (!article) return res.status(404).render('error', { message: 'Post not found', activePage: '' });

    await db.run('UPDATE articles SET views = views + 1 WHERE id = $1', [article.id]);

    const comments = await db.all(`
      SELECT co.*, u.display_name, u.username, u.avatar
      FROM comments co
      JOIN users u ON co.user_id = u.id
      WHERE co.article_id = $1
      ORDER BY co.created_at ASC
    `, [article.id]);

    const likesRow = await db.get('SELECT COUNT(*) as cnt FROM likes WHERE article_id = $1', [article.id]);
    const likesCount = parseInt(likesRow.cnt);
    const userLiked = req.user
      ? !!(await db.get('SELECT id FROM likes WHERE article_id = $1 AND user_id = $2', [article.id, req.user.id]))
      : false;

    const related = await db.all(`
      SELECT a.*, c.name AS cat_name, c.color AS cat_color
      FROM articles a LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.status = 'published' AND a.category_id = $1 AND a.id != $2
      ORDER BY a.published_at DESC LIMIT 3
    `, [article.category_id, article.id]);

    res.render('article', { title: article.title, activePage: 'articles', article, comments, likesCount, userLiked, related });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load post', activePage: '' });
  }
});

// Post comment
router.post('/:slug/comment', requireAuth, async (req, res) => {
  try {
    const article = await db.get("SELECT id FROM articles WHERE slug = $1 AND status = 'published'", [req.params.slug]);
    if (!article) return res.status(404).send('Not found');
    const { body } = req.body;
    if (!body?.trim()) return res.redirect('/articles/' + req.params.slug);
    await db.run('INSERT INTO comments (article_id, user_id, body) VALUES ($1,$2,$3)', [article.id, req.user.id, body.trim()]);
    res.redirect('/articles/' + req.params.slug + '#comments');
  } catch (err) {
    console.error(err);
    res.redirect('/articles/' + req.params.slug);
  }
});

// Like / unlike
router.post('/:slug/like', async (req, res) => {
  if (!req.user) return res.json({ error: 'Sign in to like posts' });
  try {
    const article = await db.get("SELECT id FROM articles WHERE slug = $1 AND status = 'published'", [req.params.slug]);
    if (!article) return res.json({ error: 'Not found' });

    const existing = await db.get('SELECT id FROM likes WHERE article_id = $1 AND user_id = $2', [article.id, req.user.id]);
    if (existing) {
      await db.run('DELETE FROM likes WHERE article_id = $1 AND user_id = $2', [article.id, req.user.id]);
    } else {
      await db.run('INSERT INTO likes (article_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [article.id, req.user.id]);
    }
    const countRow = await db.get('SELECT COUNT(*) as cnt FROM likes WHERE article_id = $1', [article.id]);
    res.json({ liked: !existing, count: parseInt(countRow.cnt) });
  } catch (err) {
    res.json({ error: 'Failed' });
  }
});

module.exports = router;
