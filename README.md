# 🎮 WWG Media — Setup & Deployment Guide

East Africa's gaming media platform. Built with Node.js, Express, SQLite, and EJS.

---

## 📦 Local Development

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
```

### 3. Seed the database
```bash
npm run seed
```
This creates:
- **Admin account:** `admin@wwgmedia.co.ke` / `wwgadmin2025!`
- **Writer account:** `writer@wwgmedia.co.ke` / `writer2025!`
- 3 sample articles and 3 sample videos

**⚠️ Change the admin password immediately after first login!**

### 4. Start dev server
```bash
npm run dev    # With auto-reload (nodemon)
npm start      # Without auto-reload
```

Visit: http://localhost:3000

---

## 🚀 DigitalOcean VPS Deployment

### Step 1: Server Setup
```bash
# On your VPS (Ubuntu 22.04/24.04)
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Deploy the App
```bash
# Create app directory
sudo mkdir -p /var/www/wwg-media
sudo chown $USER:$USER /var/www/wwg-media

# Upload your files (from local machine)
scp -r ./wwg-media/* user@YOUR_VPS_IP:/var/www/wwg-media/

# Or if using git:
# git clone https://github.com/your-repo/wwg-media /var/www/wwg-media

cd /var/www/wwg-media
npm install --production

# Set up environment
cp .env.example .env
nano .env
# Set JWT_SECRET to a long random string:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Set PORT=3000
# Set APP_URL=https://yourdomain.com

# Seed the database
npm run seed

# Create logs directory
mkdir -p logs
```

### Step 3: PM2 Process Manager
```bash
cd /var/www/wwg-media
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # Follow the instructions it gives you
```

### Step 4: Nginx Reverse Proxy
```bash
# Copy the nginx config
sudo cp /var/www/wwg-media/nginx.conf.example /etc/nginx/sites-available/wwgmedia

# Edit it — replace YOUR_DOMAIN_HERE with your IP or domain
sudo nano /etc/nginx/sites-available/wwgmedia

# Enable it
sudo ln -s /etc/nginx/sites-available/wwgmedia /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: (When you have a domain) SSL with Let's Encrypt
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will auto-configure HTTPS and set up auto-renewal.

### Step 6: Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🗂️ Project Structure

```
wwg-media/
├── server.js              # Express app entry point
├── database.js            # SQLite setup & schema
├── seed.js                # Database seeder
├── ecosystem.config.js    # PM2 config
├── nginx.conf.example     # Nginx config template
├── middleware/
│   └── auth.js            # JWT auth middleware
├── routes/
│   ├── auth.js            # /auth/* routes (login, register, logout)
│   ├── articles.js        # /articles/* routes
│   ├── videos.js          # /videos/* routes
│   └── admin.js           # /admin/* routes
├── views/
│   ├── layout.ejs         # Main layout (nav, footer, ticker)
│   ├── index.ejs          # Homepage
│   ├── articles.ejs       # Articles listing
│   ├── article.ejs        # Single article
│   ├── videos.ejs         # Videos page
│   ├── login.ejs          # Login form
│   ├── register.ejs       # Registration form
│   ├── profile.ejs        # User profile
│   ├── error.ejs          # Error page
│   └── admin/
│       ├── layout.ejs     # Admin layout
│       ├── dashboard.ejs  # Admin dashboard
│       ├── article-form.ejs # Create/edit article
│       ├── video-form.ejs # Add video
│       └── users.ejs      # User management
├── public/
│   ├── css/style.css      # All styles
│   └── js/main.js         # Client-side JS
└── uploads/               # User uploaded images (auto-created)
```

---

## 👥 User Roles

| Role    | Can Do                                           |
|---------|--------------------------------------------------|
| member  | Read, comment, like articles                     |
| writer  | + Create/edit their own articles, add videos     |
| admin   | + Edit/delete any content, manage users          |

**To make someone a writer/admin:** Go to `/admin/users` and change their role.

---

## 📝 Adding Content

### Articles
1. Log in as admin/writer
2. Go to `/admin` → New Article
3. Fill in title, excerpt, body (HTML supported)
4. Upload a cover image (16:9 ratio recommended)
5. Set status to "Published" and optionally "Feature on homepage"

### Videos
1. Go to `/admin` → Add Video
2. Paste any YouTube URL format
3. The thumbnail is auto-fetched from YouTube

---

## 🎨 Design

**Colors from wwg-landing.vercel.app:**
- Red: `#e8172e` (primary brand)
- Gold: `#ffc300`
- Teal: `#00c9a7`
- Purple: `#a78bfa`

**Fonts:** Bebas Neue (display) + Barlow Condensed (UI) + Barlow (body)

**Aesthetic:** Dark editorial — like a Kenyan gaming magazine that came to life online.

---

## 🔧 Useful PM2 Commands

```bash
pm2 status          # Check if app is running
pm2 logs wwg-media  # View logs
pm2 restart wwg-media
pm2 stop wwg-media
```

---

## 🛡️ Security Checklist Before Going Live

- [ ] Change `.env` JWT_SECRET to a long random string
- [ ] Change admin password from the default
- [ ] Set up HTTPS (certbot)
- [ ] Enable UFW firewall
- [ ] Set `NODE_ENV=production`
- [ ] Check `uploads/` folder permissions: `chmod 755 uploads/`

---

## 🇰🇪 Tukicheza Pamoja — Playing Together
