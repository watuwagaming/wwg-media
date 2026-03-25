require('dotenv').config();
const { db } = require('./database');

async function seed() {
  // Wait for schema to init
  await new Promise(r => setTimeout(r, 2000));

  console.log('Seeding database...');

  // Admin user — you must update clerk_id after your first Clerk login
  const existing = await db.get("SELECT id FROM users WHERE email = 'admin@wwgmedia.co.ke'");
  let adminId;
  if (!existing) {
    const r = await db.run(
      `INSERT INTO users (username, email, display_name, role, bio) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      ['wwgadmin', 'admin@wwgmedia.co.ke', 'WWG Admin', 'admin', 'Running the WWG community hub.']
    );
    adminId = r.rows[0].id;
    console.log('Admin user created (email: admin@wwgmedia.co.ke) — link your Clerk account via /admin/users after first login');
  } else {
    adminId = existing.id;
    console.log('Admin user already exists');
  }

  const cats = {};
  const catRows = await db.all('SELECT id, slug FROM categories');
  catRows.forEach(c => cats[c.slug] = c.id);

  const posts = [
    {
      title: 'Okay hear me out — EA FC 25 actually goes hard this year',
      slug: 'ea-fc-25-actually-goes-hard',
      excerpt: 'I know everyone is tired of hearing about EA FC but this one genuinely surprised me. The gameplay feels different and I cannot stop playing.',
      body: `<h2>I was not expecting to enjoy this</h2><p>Every year I tell myself I am not buying it. Every year I buy it. But this time I am not even mad about it because EA FC 25 is actually decent.</p><p>The FC IQ tactical system is the thing nobody is talking about enough. You can set up your team in ways that actually make sense for how you want to play.</p><blockquote>The defending feels fair for once. I said what I said.</blockquote><h2>What I have been doing</h2><p>Mostly career mode, trying to build up Gor Mahia. Somebody in the Discord shared a whole tutorial on setting up East African clubs and it works really well.</p><p>Anyone else been playing it? Drop your thoughts below.</p>`,
      category_id: cats['reviews'],
      featured: true,
    },
    {
      title: 'Hot take: mobile gaming is not real gaming and I am tired of pretending',
      slug: 'mobile-gaming-hot-take',
      excerpt: 'Before you come for me — I have reasons. Mobile gaming is fine for what it is but calling it the same as console or PC gaming is a stretch.',
      body: `<h2>Let me explain before you close the tab</h2><p>I am not saying mobile games are bad. But the experience is fundamentally different and pretending otherwise helps nobody.</p><h2>The controls issue</h2><p>Touch controls are a compromise every single time. Even with a controller attachment, you are working around a device that was not designed for serious gaming.</p><blockquote>There is no shame in playing mobile games. But they are a different category.</blockquote><p>Disagree? Tell me below. I want to hear it.</p>`,
      category_id: cats['hot-takes'],
    },
    {
      title: 'Currently obsessed with Hades and I am probably the last person to discover it',
      slug: 'obsessed-with-hades',
      excerpt: 'Yes I know it came out in 2020. I just found it. And now I cannot stop. Send help.',
      body: `<h2>How did nobody tell me about this</h2><p>I picked up Hades on PC sale for less than 500 shillings a few weeks ago and I have played it for probably 60 hours since.</p><blockquote>This might be the best 500 shillings I have ever spent on a game.</blockquote><h2>Tip for getting started</h2><p>Do not look up guides immediately. The game wants you to figure things out. Is anyone else playing this? What build are you running?</p>`,
      category_id: cats['currently-playing'],
    },
    {
      title: 'Quick tip: turn off crossplay if you are getting wrecked online',
      slug: 'turn-off-crossplay-tip',
      excerpt: 'This one small setting change made online gaming genuinely enjoyable for me again.',
      body: `<h2>The situation</h2><p>I was getting absolutely destroyed in every online match. Thought I was just bad. Turned out I was playing against PC players with mouse and keyboard advantages.</p><h2>The fix</h2><p>Switch to console-only matchmaking in your network settings. Yes queue times get longer. Worth it.</p><blockquote>Played 10 matches after turning it off. Won 6. Just saying.</blockquote><p>Try it and let me know if it works for you.</p>`,
      category_id: cats['tips-tricks'],
    },
  ];

  for (const p of posts) {
    const exists = await db.get('SELECT id FROM articles WHERE slug = $1', [p.slug]);
    if (!exists) {
      await db.run(
        `INSERT INTO articles (title,slug,excerpt,body,category_id,author_id,status,featured,published_at) VALUES ($1,$2,$3,$4,$5,$6,'published',$7,NOW())`,
        [p.title, p.slug, p.excerpt, p.body, p.category_id, adminId, p.featured || false]
      );
      console.log('Post created: ' + p.title);
    }
  }

  const videos = [
    { title: 'Playing EA FC 25 Career Mode — Building Gor Mahia from scratch', youtube_id: 'dQw4w9WgXcQ', description: 'Starting a career mode save with a custom East African club.' },
    { title: 'First time playing Hades — the internet was right about this one', youtube_id: 'dQw4w9WgXcQ', description: 'Blind playthrough of Hades. Died a lot. Kept playing.' },
    { title: 'My budget gaming setup in Nairobi — what I am working with', youtube_id: 'dQw4w9WgXcQ', description: 'Full setup tour. Nothing fancy but it gets the job done.' },
  ];

  for (const v of videos) {
    const exists = await db.get('SELECT id FROM videos WHERE title = $1', [v.title]);
    if (!exists) {
      const thumb = `https://img.youtube.com/vi/${v.youtube_id}/maxresdefault.jpg`;
      await db.run('INSERT INTO videos (title,description,youtube_id,thumbnail,author_id) VALUES ($1,$2,$3,$4,$5)', [v.title, v.description, v.youtube_id, thumb, adminId]);
      console.log('Video created: ' + v.title);
    }
  }

  console.log('\nSeed complete!');
  console.log('IMPORTANT: After your first Clerk login, go to /admin/users and promote yourself to admin.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
