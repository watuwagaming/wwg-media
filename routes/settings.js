const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { requireAdmin } = require('../middleware/auth');

// Site settings
router.get('/settings', requireAdmin, async (req, res) => {
  const rows = await db.all('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.render('admin/settings', { title: 'Site Settings', settings, query: req.query });
});

router.post('/settings', requireAdmin, async (req, res) => {
  const allowed = ['site_name','site_tagline','site_description','discord_url','twitter_url',
    'youtube_url','instagram_url','tiktok_url','footer_text','hero_cta_text','hero_cta_url'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      await db.run('INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', [key, req.body[key].trim()]);
    }
  }
  res.redirect('/admin/settings?saved=1');
});

// Categories
router.get('/categories', requireAdmin, async (req, res) => {
  const categories = await db.all('SELECT * FROM categories ORDER BY name');
  res.render('admin/categories', { title: 'Categories', categories, error: null, success: null });
});

router.post('/categories/new', requireAdmin, async (req, res) => {
  const { name, color, description } = req.body;
  if (!name?.trim()) {
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    return res.render('admin/categories', { title: 'Categories', categories, error: 'Name is required.', success: null });
  }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    await db.run('INSERT INTO categories (name,slug,color,description) VALUES ($1,$2,$3,$4)', [name.trim(), slug, color || '#a3003a', description?.trim() || '']);
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/categories', { title: 'Categories', categories, error: null, success: 'Category added!' });
  } catch {
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/categories', { title: 'Categories', categories, error: 'That category already exists.', success: null });
  }
});

router.post('/categories/:id/edit', requireAdmin, async (req, res) => {
  const { name, color, description } = req.body;
  if (!name?.trim()) return res.redirect('/admin/categories');
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await db.run('UPDATE categories SET name=$1,slug=$2,color=$3,description=$4 WHERE id=$5', [name.trim(), slug, color || '#a3003a', description?.trim() || '', req.params.id]);
  res.redirect('/admin/categories?saved=1');
});

router.post('/categories/:id/delete', requireAdmin, async (req, res) => {
  await db.run('UPDATE articles SET category_id = NULL WHERE category_id = $1', [req.params.id]);
  await db.run('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.redirect('/admin/categories');
});

module.exports = router;
