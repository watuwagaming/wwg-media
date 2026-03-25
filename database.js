require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Clean query helpers
const db = {
  async get(text, params = []) {
    const res = await pool.query(text, params);
    return res.rows[0] || null;
  },
  async all(text, params = []) {
    const res = await pool.query(text, params);
    return res.rows;
  },
  async run(text, params = []) {
    return pool.query(text, params);
  },
};

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      clerk_id     TEXT UNIQUE,
      username     TEXT UNIQUE NOT NULL,
      email        TEXT UNIQUE NOT NULL,
      display_name TEXT,
      avatar       TEXT DEFAULT NULL,
      bio          TEXT DEFAULT '',
      role         TEXT DEFAULT 'member' CHECK(role IN ('member','writer','admin')),
      is_active    BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      slug        TEXT UNIQUE NOT NULL,
      color       TEXT DEFAULT '#a3003a',
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS articles (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      slug         TEXT UNIQUE NOT NULL,
      excerpt      TEXT NOT NULL,
      body         TEXT NOT NULL,
      cover_image  TEXT DEFAULT NULL,
      category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status       TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
      featured     BOOLEAN DEFAULT FALSE,
      views        INTEGER DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW(),
      published_at TIMESTAMP DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      youtube_id  TEXT NOT NULL,
      thumbnail   TEXT DEFAULT NULL,
      category    TEXT DEFAULT 'general',
      author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      featured    BOOLEAN DEFAULT FALSE,
      views       INTEGER DEFAULT 0,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id         SERIAL PRIMARY KEY,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS likes (
      id         SERIAL PRIMARY KEY,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(article_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaults = [
    ['site_name','WWG Media'],['site_tagline',"East Africa's Gaming Community"],
    ['site_description','A space for East African gamers to share what they are playing, drop hot takes, and connect.'],
    ['discord_url','https://discord.gg/xpjv99H'],['twitter_url',''],
    ['youtube_url',''],['instagram_url',''],['tiktok_url',''],
    ['footer_text',"East Africa's Gaming Community"],
    ['hero_cta_text','Join the Community'],['hero_cta_url','/sign-up'],
  ];
  for (const [key, value] of defaults) {
    await pool.query(`INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [key, value]);
  }

  const cats = [
    ['Reviews','reviews','#a3003a','Your honest take on games you have played'],
    ['Hot Takes','hot-takes','#ffc300','Unpopular opinions and spicy discussions'],
    ['Currently Playing','currently-playing','#00c9a7','What you are into right now'],
    ['Tips & Tricks','tips-tricks','#a78bfa','Share what you have figured out'],
    ['My Setup','my-setup','#f97316','Show off your gaming setup'],
    ['Stories','stories','#ec4899','Funny moments, highlights, and memories'],
  ];
  for (const [name, slug, color, desc] of cats) {
    await pool.query(`INSERT INTO categories (name,slug,color,description) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING`, [name, slug, color, desc]);
  }
  console.log('Database schema ready');
}

initSchema().catch(err => { console.error('DB init error:', err.message); process.exit(1); });

module.exports = { db, pool };
