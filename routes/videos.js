const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;

    const videos = await db.all(`
      SELECT v.*, u.display_name AS author_name
      FROM videos v LEFT JOIN users u ON v.author_id = u.id
      ORDER BY v.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countRow = await db.get('SELECT COUNT(*) as cnt FROM videos');
    const total = parseInt(countRow.cnt);

    res.render('videos', { title: 'Videos', activePage: 'videos', videos, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Failed to load videos', activePage: '' });
  }
});

module.exports = router;
