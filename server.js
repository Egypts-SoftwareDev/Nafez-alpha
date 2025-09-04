/*
 * Nafez alpha MVP server.
 *
 * This server is a minimal prototype of the Nafez crowdfunding platform. It is
 * intended for internal alpha testing only and does not implement any
 * production‑grade security features. It uses built‑in Node.js modules to
 * avoid external dependencies. Authentication is handled via a single
 * password defined in ALPHA_PASSWORD and stored in a cookie. Campaign data
 * is stored in a JSON file (campaigns.json) in the project root.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4000; // separate port from landing page
const DATA_FILE = path.join(__dirname, 'campaigns.json');
const APPS_FILE = path.join(__dirname, 'applications.json');

// Users file for simple credential storage.  This alpha server stores
// registered users in a JSON file.  The file contains an array of
// objects: { name, email, password, role }.  Passwords are stored
// in plaintext for simplicity; do not use this mechanism in
// production.  The presence of a user with a matching email and
// password indicates successful authentication.  Use environment
// variable ALPHA_ADMIN_PASSWORD to retain the legacy single password
// fallback for quick access during testing.
const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeUsers(list) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error writing users:', err);
  }
}

const ALPHA_PASSWORD = process.env.ALPHA_PASSWORD || 'mvpSecret';
const ALPHA_ADMIN_PASSWORD = process.env.ALPHA_ADMIN_PASSWORD || ALPHA_PASSWORD;
const ALPHA_INVITE_CODE = (process.env.ALPHA_INVITE_CODE || '').trim();
// Landing origin for legal/info pages. Links in the alpha footer point to
// these paths; redirect them here so users land on the canonical content.
const LANDING_ORIGIN = process.env.LANDING_ORIGIN || 'http://localhost:3000';

// Directory containing static assets for the alpha UI.  The UI is served
// from /alpha/public/ and the home page at /alpha/home loads the index.html
// file from this directory.  Assets include HTML, CSS, JS and images.
const PUBLIC_DIR = path.join(__dirname, 'public');
const PLEDGES_FILE = path.join(__dirname, 'pledges.json');

// Read JSON helper (tolerates UTF-8 BOM from some editors)
function readJsonNoBom(file, fallback) {
  try {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw && raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading', path.basename(file) + ':', err);
    return fallback;
  }
}

// Read campaigns from file
function readCampaigns() {
  return readJsonNoBom(DATA_FILE, []);
}

// Write campaigns to file
function writeCampaigns(list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error writing campaigns:', err);
  }
}

// Applications persistence helpers
function ensureFile(filePath, emptyJson) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(emptyJson, null, 2));
    }
  } catch (err) {
    console.error('Error ensuring file', filePath, err);
  }
}
ensureFile(APPS_FILE, []);
ensureFile(PLEDGES_FILE, []);

function readApplications() { return readJsonNoBom(APPS_FILE, []); }

function writeApplications(list) {
  try {
    fs.writeFileSync(APPS_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error writing applications:', err);
  }
}

function readPledges() { return readJsonNoBom(PLEDGES_FILE, []); }
function writePledges(list) {
  try {
    fs.writeFileSync(PLEDGES_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error writing pledges:', err);
  }
}

// Parse cookies from request headers
function parseCookies(req) {
  const header = req.headers.cookie;
  const result = {};
  if (!header) return result;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    result[key] = value;
  });
  return result;
}

// Render HTML pages
function renderLoginPage(error = '') {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nafez Alpha Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Tomorrow', Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
      .container { background-color: #112240; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); width: 350px; }
      h1 { color: #cfe468; margin-bottom: 1rem; }
      label { display: block; margin-bottom: 0.5rem; }
      input { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #cfe468; border-radius: 4px; background-color: transparent; color: #f5f5f5; }
      button { padding: 0.5rem 1rem; background-color: #cfe468; border: none; border-radius: 4px; color: #0a1522; font-weight: bold; cursor: pointer; }
      .error { color: #ff6b6b; margin-bottom: 1rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Nafez Alpha</h1>
      <p>Please enter the access password:</p>
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/alpha/login">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" autofocus required />
        <button type="submit">Enter</button>
      </form>
    </div>
  </body>
  </html>`;
}

function renderHomePage(campaigns) {
  const items = campaigns
    .map((c) => `<li><a href="/alpha/campaign/${c.id}" style="color:#cfe468; text-decoration:none;">${c.title}</a> — EGP ${c.raised} raised of ${c.goal}</li>`) .join('');
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nafez Alpha Home</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Tomorrow', Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; margin: 0; padding: 2rem; }
      h1 { color: #cfe468; }
      a { color: #cfe468; }
      ul { list-style: none; padding: 0; }
      li { margin-bottom: 0.5rem; }
      .actions { margin-top: 1rem; }
      .button { padding: 0.5rem 1rem; background-color: #cfe468; color: #0a1522; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Alpha Dashboard</h1>
    <p>Welcome to the Nafez alpha. Below are sample campaigns:</p>
    <ul>${items || '<li>No campaigns available.</li>'}</ul>
    <div class="actions">
      <a href="/alpha/campaign/new" class="button">Create New Campaign</a>
    </div>
  </body>
  </html>`;
}

function renderCampaignPage(c) {
  if (!c) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head><body><h1 style="color:#ff6b6b;">Campaign not found</h1></body></html>`;
  }
  const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
  const rewards = Array.isArray(c.rewards) && c.rewards.length ? c.rewards : [
    { id: 1, title: 'Supporter', amountEGP: Math.max(50, Math.round((c.goal||10000)*0.01/10)*10), description: 'Thank you shout‑out.' },
    { id: 2, title: 'Early Backer', amountEGP: Math.max(150, Math.round((c.goal||10000)*0.03/10)*10), description: 'Early reward perk.' },
    { id: 3, title: 'Sponsor', amountEGP: Math.max(500, Math.round((c.goal||10000)*0.1/10)*10), description: 'Premium perk.' },
  ];
  // Media embed helper
  function getEmbed(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url);
      const host = u.hostname.replace('www.', '');
      if (host.includes('youtu.be')) { const id = u.pathname.slice(1); return `<iframe src="https://www.youtube.com/embed/${id}" title="Video" frameborder="0" allowfullscreen loading="lazy"></iframe>`; }
      if (host.includes('youtube.com')) { const id = u.searchParams.get('v') || u.pathname.split('/').pop(); if (id) return `<iframe src="https://www.youtube.com/embed/${id}" title="Video" frameborder="0" allowfullscreen loading="lazy"></iframe>`; }
      if (host.includes('vimeo.com')) { const id = u.pathname.split('/').filter(Boolean).pop(); if (id) return `<iframe src="https://player.vimeo.com/video/${id}" title="Video" frameborder="0" allowfullscreen loading="lazy"></iframe>`; }
      return '';
    } catch { return ''; }
  }
  const embedHtml = getEmbed((c.story && c.story.videoUrl) || c.videoUrl);
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${c.title} – Nafez Alpha</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Tomorrow', Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; margin: 0; }
      .wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
      h1 { color: #cfe468; margin: .5rem 0; }
      .media { background:#112240; border:1px solid #263244; border-radius:8px; padding:0; overflow:hidden; }
      .media .frame { position: relative; width: 100%; padding-top: 56.25%; }
      .media .frame > iframe, .media .frame > img { position:absolute; top:0; left:0; width:100%; height:100%; border:0; object-fit: cover; }
      .media .caption { padding: .5rem .75rem; color:#8fa1b2; font-size: 13px; }
      .progress { height: 10px; background:#1b2b44; border-radius:6px; overflow:hidden; }
      .bar { height:100%; width:${pct}%; background:#cfe468; }
      .stat { color:#8fa1b2; margin-right: 14px; }
      .card { background:#112240; border:1px solid #263244; border-radius:8px; padding:1rem; margin-top:1rem; }
      .grid { display:grid; grid-template-columns: 2fr 1fr; gap: 16px; }
      @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }
      .button { padding: .6rem 1rem; background:#cfe468; color:#0a1522; border:1px solid #9fb63c; border-radius:8px; cursor:pointer; text-decoration:none; font-weight:600; }
      label { display:block; color:#8fa1b2; margin:.5rem 0 .25rem; }
      input, select { width:100%; background:#0d1a2c; border:1px solid #263244; border-radius:8px; padding:10px 12px; color:#f5f5f5; }
      .error { color:#ff6b6b; }
      .success { color:#cfe468; background:rgba(207,228,104,0.08); border:1px solid #9fb63c; padding:.6rem .8rem; border-radius:8px; margin:.5rem 0; }
      ul { padding-left: 1rem; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <a href="/alpha/home" style="color:#cfe468;text-decoration:none">← Back to campaigns</a>
      <div class="grid">
        <div>
          <div class="media">
            <div class="frame">
              ${embedHtml || `<img src="/alpha/public/images/campaign-placeholder.png" alt="${c.title}">`}
            </div>
            <div class="caption">${((c.story && c.story.videoUrl) || c.videoUrl) ? 'Campaign video' : 'Campaign image placeholder'}</div>
          </div>
          <h1>${c.title}</h1>
          <div class="progress"><div class="bar"></div></div>
          <p>
            <span class="stat">EGP <strong id="raisedVal">${(c.raised ?? 0).toLocaleString('en-EG')}</strong> raised</span>
            <span class="stat"><strong id="percentVal">${pct}</strong>% funded</span>
            <span class="stat"><strong id="backersVal">${c.backers ?? 0}</strong> backers</span>
            <span class="stat"><strong>${c.daysLeft ?? 'TBD'}</strong> days left</span>
          </p>
          <div class="card">
            <h3 style="margin-top:0; color:#cfe468;">Story</h3>
            <p>${(c.story && c.story.description) || c.description || ''}</p>
            ${(c.story && c.story.risks) ? `<h4 style=\"color:#cfe468;\">Risks & challenges</h4><p>${c.story.risks}</p>` : ''}
          </div>
        </div>
        <div>
          <div class="card">
            <h3 style="margin-top:0; color:#cfe468;">Back this campaign</h3>
            <div id="pledge-error" class="error"></div>
            <div id="pledge-success" class="success" style="display:none"></div>
            <label for="reward">Reward</label>
            <select id="reward">
              <option value="">No reward</option>
              ${rewards.map(r => `<option value="${r.id}" data-amount="${r.amountEGP}">${r.title} — EGP ${r.amountEGP}</option>`).join('')}
            </select>
            <label for="amount">Amount (EGP)</label>
            <input id="amount" type="number" min="50" step="10" placeholder="e.g. 200" />
            <div style="margin-top:.75rem; display:flex; gap:8px;">
              <button class="button" id="pledgeBtn">Pledge</button>
              <a class="button" href="/alpha/pledges" style="background:transparent;color:#cfe468">My pledges</a>
            </div>
          </div>
          <div class="card">
            <h4 style="margin-top:0;color:#cfe468;">Goal</h4>
            <p>EGP ${c.goal}</p>
            <h4 style="margin-top:0;color:#cfe468;">Stage</h4>
            <p>${c.stage || 'TBD'}</p>
          </div>
        </div>
      </div>
    </div>
    <script>
      (function(){
        var sel = document.getElementById('reward');
        var amt = document.getElementById('amount');
        var err = document.getElementById('pledge-error');
        var ok = document.getElementById('pledge-success');
        var raisedEl = document.getElementById('raisedVal');
        var backersEl = document.getElementById('backersVal');
        var percentEl = document.getElementById('percentVal');
        var bar = document.querySelector('.bar');
        function fmt(n){ try { return Number(n||0).toLocaleString('en-EG'); } catch(e){ return String(n); } }
        if (sel && amt) {
          sel.addEventListener('change', function(){
            var opt = sel.options[sel.selectedIndex];
            var min = Number(opt && opt.getAttribute('data-amount')) || 0;
            if (min) amt.value = String(min);
          });
        }
        var btn = document.getElementById('pledgeBtn');
        if (btn) {
          btn.addEventListener('click', async function(){
            err.textContent = '';
            if (ok) { ok.style.display='none'; ok.textContent=''; }
            var amount = Number(amt && amt.value || 0);
            var rewardId = sel && sel.value ? Number(sel.value) : undefined;
            if (!amount || amount < 50) { err.textContent = 'Minimum pledge is EGP 50'; return; }
            try {
              btn.disabled = true; var oldTxt = btn.textContent; btn.textContent = 'Processing...';
              var res = await fetch('/alpha/api/campaigns/${c.id}/pledge', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amountEGP: amount, rewardId }) });
              var data = await res.json().catch(function(){ return {}; });
              if (!res.ok) { err.textContent = (data && data.error) || 'Unable to pledge'; }
              else {
                // Update stats inline
                var camp = (data && data.campaign) || {};
                if (raisedEl) raisedEl.textContent = fmt(camp.raised);
                if (backersEl) backersEl.textContent = String(camp.backers||0);
                var pctNow = (camp.goal ? Math.min(100, Math.round((Number(camp.raised||0)/Number(camp.goal))*100)) : 0);
                if (percentEl) percentEl.textContent = String(pctNow);
                if (bar) bar.style.width = pctNow + '%';
                // Success message
                if (ok) { ok.textContent = 'Thank you! Your pledge of EGP ' + fmt(amount) + ' was recorded.'; ok.style.display='block'; }
                // Reset form
                if (sel) sel.value = '';
                if (amt) amt.value = '';
              }
            } catch(e) { err.textContent = 'Network error'; }
            finally { btn.disabled = false; btn.textContent = oldTxt || 'Pledge'; }
          });
        }
      })();
    </script>
  </body>
  </html>`;
}

function renderNewCampaignPage() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Campaign — Nafez Alpha</title>
    <style>
      body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; margin: 0; padding: 2rem; }
      h1 { color: #cfe468; }
      label { display: block; margin-bottom: 0.5rem; }
      input, textarea { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #cfe468; border-radius: 4px; background-color: transparent; color: #f5f5f5; }
      button { padding: 0.5rem 1rem; background-color: #cfe468; color: #0a1522; border: none; border-radius: 4px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Create New Campaign</h1>
    <form method="POST" action="/alpha/campaign">
      <label for="title">Title</label>
      <input type="text" id="title" name="title" required />
      <label for="description">Description</label>
      <textarea id="description" name="description" rows="4" required></textarea>
      <label for="goal">Funding Goal (EGP)</label>
      <input type="number" id="goal" name="goal" min="0" required />
      <button type="submit">Create</button>
    </form>
    <a href="/alpha/home" class="button" style="margin-top: 1rem;">Cancel</a>
  </body>
  </html>`;
}

// Parse URL-encoded body
function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 1e6) req.connection.destroy();
  });
  req.on('end', () => {
    const result = {};
    body.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    callback(result);
  });
}

// Parse JSON body
function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 2e6) req.connection.destroy();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

// Create the HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const cookies = parseCookies(req);
  
  // Redirect requests for landing static pages (Terms, Privacy, etc.)
  const landingPages = new Set([
    '/terms.html', '/privacy.html', '/cookies.html', '/accessibility.html',
    '/about-us.html', '/trust-safety.html', '/help-support.html', '/careers.html', '/contact-us.html',
    '/how-it-works.html', '/us-vs-competitors.html', '/education-center.html',
    '/crowdfunding.html', '/fixed-vs-flexible.html', '/intizam.html', '/info.html'
  ]);
  if (req.method === 'GET' && landingPages.has(parsedUrl.pathname)) {
    const loc = new url.URL(parsedUrl.pathname + (parsedUrl.search || ''), LANDING_ORIGIN).toString();
    res.writeHead(302, { Location: loc });
    res.end();
    return;
  }
  // Determine whether the request is authenticated.  We support two
  // authentication methods: the legacy AlphaAuth cookie (set when
  // logging in with the admin password) and the AlphaUser cookie
  // (set when logging in with email/password).  If either cookie is
  // present, the user is considered authenticated.
  const isAdminAuthenticated = cookies.AlphaAuth === '1';
  const isUserAuthenticated = typeof cookies.AlphaUser === 'string' && cookies.AlphaUser.length > 0;
  const isAuthenticated = isAdminAuthenticated || isUserAuthenticated;

  // Serve static assets for the alpha UI without authentication.  These files
  // live under PUBLIC_DIR and are requested from paths prefixed with
  // '/alpha/public/'.  For example, '/alpha/public/css/styles.css' will
  // resolve to `${PUBLIC_DIR}/css/styles.css`.  This allows the index
  // page and supporting assets to load correctly.  If the file does not
  // exist, fall through to the remaining route handlers.
  if (req.method === 'GET' && parsedUrl.pathname.startsWith('/alpha/public/')) {
    const relativePath = parsedUrl.pathname.replace('/alpha/public/', '');
    const filePath = path.join(PUBLIC_DIR, relativePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      // Prevent directory traversal
      res.writeHead(403);
      res.end('403 Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('404 Not Found');
        return;
      }
      // Determine content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.html') contentType = 'text/html';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.woff2') contentType = 'font/woff2';
      else if (ext === '.woff') contentType = 'font/woff';
      else if (ext === '.ttf') contentType = 'font/ttf';
      else if (ext === '.otf') contentType = 'font/otf';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
    return;
  }

  // Route handling
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha') {
    // Legacy login page: redirect to new email/password login page.
    res.writeHead(302, { Location: '/alpha/login' });
    res.end();
    return;
  }
  // -------------------------------------------------------------------
  // Authentication routes
  // -------------------------------------------------------------------
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/login') {
    // Serve the email/password login page.  If already authenticated
    // (either as admin or user), redirect to home.
    if (isAuthenticated) {
      res.writeHead(302, { Location: '/alpha/home' });
      res.end();
      return;
    }
    const loginPage = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nafez Alpha Login</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Tomorrow', Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { background-color: #112240; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); width: 350px; }
        h1 { color: #cfe468; margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; }
        input { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #cfe468; border-radius: 4px; background-color: transparent; color: #f5f5f5; }
        button { padding: 0.5rem 1rem; background-color: #cfe468; border: none; border-radius: 4px; color: #0a1522; font-weight: bold; cursor: pointer; }
        .error { color: #ff6b6b; margin-bottom: 1rem; }
        a { color: #cfe468; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Nafez Alpha</h1>
        <p>Login with your account or <a href="/alpha/signup">sign up</a>.</p>
        ${parsedUrl.query.error ? `<div class="error">${decodeURIComponent(parsedUrl.query.error)}</div>` : ''}
        <form method="POST" action="/alpha/login">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required />
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required />
          <button type="submit">Login</button>
        </form>
        <p style="margin-top:1rem; font-size:0.9rem; color:#8fa1b2;">For quick access you can also <a href="/alpha/admin">enter admin mode</a>.</p>
      </div>
    </body>
    </html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginPage);
    return;
  }
  if (req.method === 'POST' && parsedUrl.pathname === '/alpha/login') {
    // Handle email/password login submission.  Accept both admin
    // password and user credentials.  Set appropriate cookie and
    // redirect to home on success.
    parseBody(req, (body) => {
      const { email, password } = body;
      // Admin password fallback
      if (password === ALPHA_ADMIN_PASSWORD) {
        res.writeHead(302, {
          'Set-Cookie': 'AlphaAuth=1; HttpOnly',
          Location: '/alpha/home',
        });
        res.end();
        return;
      }
      const users = readUsers();
      const user = users.find((u) => u.email === email && u.password === password);
      if (user) {
        res.writeHead(302, {
          'Set-Cookie': `AlphaUser=${encodeURIComponent(user.email)}; HttpOnly`,
          Location: '/alpha/home',
        });
        res.end();
      } else {
        // Invalid credentials
        res.writeHead(302, { Location: '/alpha/login?error=' + encodeURIComponent('Invalid email or password.') });
        res.end();
      }
    });
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/logout') {
    // Clear authentication cookies and redirect to login
    res.writeHead(302, {
      'Set-Cookie': 'AlphaAuth=; Max-Age=0',
      'Set-Cookie': 'AlphaUser=; Max-Age=0',
      Location: '/alpha/login',
    });
    res.end();
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/signup') {
    // Serve sign‑up page.  If already authenticated, redirect to home.
    if (isAuthenticated) {
      res.writeHead(302, { Location: '/alpha/home' });
      res.end();
      return;
    }
      const signupPage = `<!DOCTYPE html>
      <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nafez Alpha Sign Up</title>
      <style>
        body { font-family: 'Tomorrow', Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { background-color: #112240; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); width: 400px; }
        h1 { color: #cfe468; margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; }
        input, select { width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #cfe468; border-radius: 4px; background-color: transparent; color: #f5f5f5; }
        button { padding: 0.5rem 1rem; background-color: #cfe468; border: none; border-radius: 4px; color: #0a1522; font-weight: bold; cursor: pointer; }
        .message { color: #ff6b6b; margin-bottom: 1rem; }
        a { color: #cfe468; }
      </style>
    </head>
    <body>
      <div class="container">
          <h1>Create Account</h1>
          <p>Already have an account? <a href="/alpha/login">Log in</a>.</p>
          ${parsedUrl.query.error ? `<div class="message">${decodeURIComponent(parsedUrl.query.error)}</div>` : ''}
          <form method="POST" action="/alpha/signup">
            ${ALPHA_INVITE_CODE ? `<label for="invite">Invite code</label><input type="text" id="invite" name="invite" required />` : ''}
            <label for="name">Name</label>
            <input type="text" id="name" name="name" required />
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required />
            <label for="role">Role</label>
            <select id="role" name="role" required>
              <option value="seeker">Seeker</option>
              <option value="backer">Backer</option>
            </select>
            <button type="submit">Sign Up</button>
          </form>
        </div>
      </body>
      </html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(signupPage);
    return;
  }
  if (req.method === 'POST' && parsedUrl.pathname === '/alpha/signup') {
    // Handle sign‑up form submission: validate fields, check for duplicate
    // email, then save user and redirect to login.
    parseBody(req, (body) => {
      const { name, email, password, role, invite } = body;
      if (!name || !email || !password || !role) {
        res.writeHead(302, { Location: '/alpha/signup?error=' + encodeURIComponent('All fields are required.') });
        res.end();
        return;
      }
      if (ALPHA_INVITE_CODE && invite !== ALPHA_INVITE_CODE) {
        res.writeHead(302, { Location: '/alpha/signup?error=' + encodeURIComponent('Invalid invite code.') });
        res.end();
        return;
      }
      const users = readUsers();
      if (users.find((u) => u.email === email)) {
        res.writeHead(302, { Location: '/alpha/signup?error=' + encodeURIComponent('Email already in use.') });
        res.end();
        return;
      }
      users.push({ name, email, password, role });
      writeUsers(users);
      res.writeHead(302, { Location: '/alpha/login?error=' + encodeURIComponent('Account created. Please log in.') });
      res.end();
    });
    return;
  }

  // Simple route to jump back to the landing site root
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/landing') {
    const loc = new url.URL('/', LANDING_ORIGIN).toString();
    res.writeHead(302, { Location: loc });
    res.end();
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/admin') {
    // Admin quick login page: for convenience, allow entering the admin
    // password directly.  This is separate from the email/password
    // login page.
    const adminPage = renderLoginPage();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(adminPage);
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/admin/users') {
    if (!isAdminAuthenticated) { res.writeHead(302, { Location: '/alpha/login' }); res.end(); return; }
    const users = readUsers();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Users</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body{font-family:'Tomorrow', Arial, sans-serif;background:#0a1522;color:#f5f5f5;padding:1rem} a{color:#cfe468}</style>
    </head><body><h1>Alpha Users</h1><ul>${users.map(u => `<li>${u.name} &lt;${u.email}&gt; — ${u.role||'user'}</li>`).join('')}</ul>
    <p><a href="/alpha/home">Back</a></p></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/admin/apps') {
    if (!isAdminAuthenticated) { res.writeHead(302, { Location: '/alpha/login' }); res.end(); return; }
    const apps = readApplications();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Applications</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body{font-family:'Tomorrow', Arial, sans-serif;background:#0a1522;color:#f5f5f5;padding:1rem} a{color:#cfe468} table{border-collapse:collapse} td,th{border:1px solid #263244;padding:6px}</style>
    </head><body><h1>Applications</h1>
    <table><tr><th>ID</th><th>Owner</th><th>Title</th><th>Status</th><th>Actions</th></tr>
    ${apps.map(a => `<tr><td>${a.id}</td><td>${a.ownerEmail}</td><td>${(a.basics&&a.basics.title)||''}</td><td>${a.status}</td><td>
    <a href="/alpha/admin/app/${a.id}/set?status=under_review">Under review</a> |
    <a href="/alpha/admin/app/${a.id}/set?status=approved">Approve</a> |
    <a href="/alpha/admin/app/${a.id}/set?status=rejected">Reject</a>
    </td></tr>`).join('')}
    </table>
    <p><a href="/alpha/home">Back</a></p></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  const appSetMatch = parsedUrl.pathname.match(/^\/alpha\/admin\/app\/(\d+)\/set$/);
  if (req.method === 'GET' && appSetMatch) {
    if (!isAdminAuthenticated) { res.writeHead(302, { Location: '/alpha/login' }); res.end(); return; }
    const id = parseInt(appSetMatch[1], 10);
    const status = parsedUrl.query.status;
    let apps = readApplications();
    let app = apps.find(a => a.id === id);
    if (!app) { res.writeHead(404); res.end('Not found'); return; }
    if (!['under_review','approved','rejected'].includes(status)) { res.writeHead(400); res.end('Bad status'); return; }
    app.status = status; app.updatedAt = new Date().toISOString();
    apps = apps.map(a => (a.id===id?app:a));
    writeApplications(apps);
    res.writeHead(302, { Location: '/alpha/admin/apps' }); res.end(); return;
  }
  if (!isAuthenticated) {
    // All alpha routes require authentication.  Redirect
    // unauthenticated requests to the login page.
    res.writeHead(302, { Location: '/alpha/login' });
    res.end();
    return;
  }
  // Read-only API endpoints (authenticated)
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/api/campaigns') {
    const campaigns = readCampaigns();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ campaigns }));
    return;
  }
  const apiMatch = parsedUrl.pathname.match(/^\/alpha\/api\/campaigns\/(\d+)$/);
  if (req.method === 'GET' && apiMatch) {
    const id = parseInt(apiMatch[1], 10);
    const campaigns = readCampaigns();
    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ campaign }));
    return;
  }
  // Authenticated routes
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/home') {
    // Serve the UI home page.  Instead of rendering a server-side list
    // of campaigns, we return the static index.html from PUBLIC_DIR.  The
    // client-side JS can be enhanced later to fetch campaign data.
    const homePath = path.join(PUBLIC_DIR, 'index.html');
    fs.readFile(homePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading home page');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/apply') {
    const applyPath = path.join(PUBLIC_DIR, 'apply.html');
    fs.readFile(applyPath, (err, data) => {
      if (err) { res.writeHead(500); res.end('Error loading apply page'); }
      else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data); }
    });
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/campaign/new') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderNewCampaignPage());
    return;
  }
  if (req.method === 'POST' && parsedUrl.pathname === '/alpha/campaign') {
    parseBody(req, (body) => {
      let campaigns = readCampaigns();
      const id = campaigns.length ? campaigns[campaigns.length - 1].id + 1 : 1;
      const newCampaign = {
        id,
        title: body.title || 'Untitled',
        description: body.description || '',
        goal: Number(body.goal) || 0,
        raised: 0,
        backers: 0,
        stage: 'Concept',
      };
      campaigns.push(newCampaign);
      writeCampaigns(campaigns);
      res.writeHead(302, { Location: '/alpha/home' });
      res.end();
    });
    return;
  }
  const campaignIdMatch = parsedUrl.pathname.match(/^\/alpha\/campaign\/(\d+)$/);
  if (req.method === 'GET' && campaignIdMatch) {
    const id = parseInt(campaignIdMatch[1], 10);
    const campaigns = readCampaigns();
    const campaign = campaigns.find((c) => c.id === id);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderCampaignPage(campaign));
    return;
  }

  // Create pledge for a campaign
  const pledgeMatch = parsedUrl.pathname.match(/^\/alpha\/api\/campaigns\/(\d+)\/pledge$/);
  if (req.method === 'POST' && pledgeMatch) {
    const id = parseInt(pledgeMatch[1], 10);
    if (!isAuthenticated) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    parseJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      const amount = Number(body && body.amountEGP);
      const rewardId = body && body.rewardId ? Number(body.rewardId) : undefined;
      if (!amount || amount < 50) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Minimum pledge is EGP 50' })); return; }
      let campaigns = readCampaigns();
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Campaign not found' })); return; }
      // Optionally enforce daysLeft > 0
      if (campaign.daysLeft !== undefined && campaign.daysLeft <= 0) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Campaign is closed' })); return; }
      // Record pledge
      let pledges = readPledges();
      const pid = pledges.length ? pledges[pledges.length - 1].id + 1 : 1;
      const pledge = { id: pid, campaignId: id, backerEmail: cookies.AlphaUser || 'admin@local', amountEGP: amount, rewardId, status: 'authorized', createdAt: new Date().toISOString() };
      pledges.push(pledge);
      writePledges(pledges);
      // Update campaign totals
      campaign.raised = Number(campaign.raised || 0) + amount;
      campaign.backers = Number(campaign.backers || 0) + 1;
      campaigns = campaigns.map((c) => (c.id === id ? campaign : c));
      writeCampaigns(campaigns);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pledge, campaign }));
    });
    return;
  }

  // List my pledges
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/api/me/pledges') {
    if (!isAuthenticated) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    const email = cookies.AlphaUser || 'admin@local';
    const pledges = readPledges().filter((p) => p.backerEmail === email);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pledges }));
    return;
  }

  // Simple My Pledges page
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/pledges') {
    if (!isAuthenticated) { res.writeHead(302, { Location: '/alpha/login?next=/alpha/pledges' }); res.end(); return; }
    const email = cookies.AlphaUser || 'admin@local';
    const pledges = readPledges().filter((p) => p.backerEmail === email);
    const campaigns = readCampaigns();
    const rows = pledges.map((p) => {
      const camp = campaigns.find((c) => c.id === p.campaignId) || { title: 'Unknown' };
      return `<tr><td>${p.id}</td><td>${camp.title}</td><td>EGP ${p.amountEGP}</td><td>${p.status}</td><td>${new Date(p.createdAt).toLocaleString()}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>My Pledges</title>
    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"> 
    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin> 
    <link href=\"https://fonts.googleapis.com/css2?family=Tomorrow:wght@400;500;600;700&display=swap\" rel=\"stylesheet\"> 
    <style>body{font-family:'Tomorrow', Arial, sans-serif;background:#0a1522;color:#f5f5f5;margin:0} .wrap{max-width:960px;margin:0 auto;padding:1.5rem}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #263244;padding:8px;text-align:left} a{color:#cfe468;text-decoration:none}
    </style></head><body><div class='wrap'><a href='/alpha/home'>← Back to campaigns</a><h1 style='color:#cfe468'>My Pledges</h1>
    <table><tr><th>ID</th><th>Campaign</th><th>Amount</th><th>Status</th><th>Date</th></tr>${rows || '<tr><td colspan=5>No pledges yet</td></tr>'}</table>
    </div></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
  }
  // Applications API (authenticated)
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/api/applications') {
    const apps = readApplications();
    const owner = cookies.AlphaUser || 'admin@local';
    const onlyMine = parsedUrl.query.me === '1';
    const result = onlyMine ? apps.filter((a) => a.ownerEmail === owner) : apps;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ applications: result }));
    return;
  }
  const appIdMatch = parsedUrl.pathname.match(/^\/alpha\/api\/applications\/(\d+)$/);
  if (req.method === 'GET' && appIdMatch) {
    const id = parseInt(appIdMatch[1], 10);
    const apps = readApplications();
    const app = apps.find((a) => a.id === id);
    if (!app) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
    if (!cookies.AlphaAuth && app.ownerEmail !== (cookies.AlphaUser || '')) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Forbidden' })); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ application: app }));
    return;
  }
  if (req.method === 'POST' && parsedUrl.pathname === '/alpha/api/applications') {
    if ((req.headers['content-type'] || '').includes('application/json')) {
      parseJsonBody(req, (err, body) => {
        if (err) { res.writeHead(400); res.end('Invalid JSON'); return; }
        const owner = cookies.AlphaUser || 'admin@local';
        let apps = readApplications();
        let app; const now = new Date().toISOString();
        if (body && body.id) {
          app = apps.find((a) => a.id === body.id);
          if (!app) { res.writeHead(404); res.end('Not found'); return; }
          if (!cookies.AlphaAuth && app.ownerEmail !== owner) { res.writeHead(403); res.end('Forbidden'); return; }
          app = Object.assign({}, app, body, { updatedAt: now });
          apps = apps.map((a) => (a.id === app.id ? app : a));
        } else {
          const id = apps.length ? apps[apps.length - 1].id + 1 : 1;
          app = { id, ownerEmail: owner, status: 'draft', basics: {}, identity: {}, story: {}, rewards: [], budget: {}, compliance: {}, createdAt: now, updatedAt: now };
          if (body && typeof body === 'object') { app = Object.assign(app, body); }
          apps.push(app);
        }
        writeApplications(apps);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ application: app }));
      });
    } else {
      parseBody(req, (body) => {
        const owner = cookies.AlphaUser || 'admin@local';
        let apps = readApplications();
        const id = apps.length ? apps[apps.length - 1].id + 1 : 1; const now = new Date().toISOString();
        const app = { id, ownerEmail: owner, status: 'draft', basics: body, createdAt: now, updatedAt: now };
        apps.push(app); writeApplications(apps);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ application: app }));
      });
    }
    return;
  }
  const appSubmitMatch = parsedUrl.pathname.match(/^\/alpha\/api\/applications\/(\d+)\/submit$/);
  if (req.method === 'POST' && appSubmitMatch) {
    const id = parseInt(appSubmitMatch[1], 10);
    let apps = readApplications();
    let app = apps.find((a) => a.id === id);
    if (!app) { res.writeHead(404); res.end('Not found'); return; }
    const owner = cookies.AlphaUser || 'admin@local';
    if (!cookies.AlphaAuth && app.ownerEmail !== owner) { res.writeHead(403); res.end('Forbidden'); return; }
    const missing = [];
    if (!app.basics || !app.basics.title) missing.push('title');
    if (!app.basics || !app.basics.goalEGP) missing.push('goalEGP');
    if (!app.identity || !app.identity.name) missing.push('name');
    if (!app.identity || !app.identity.nationalId) missing.push('nationalId');
    if (!app.story || !app.story.pitch) missing.push('pitch');
    if (missing.length) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Missing required fields', missing })); return; }
    app.status = 'submitted'; app.updatedAt = new Date().toISOString(); apps = apps.map((a) => (a.id === app.id ? app : a)); writeApplications(apps);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ application: app }));
    return;
  }
  // Not found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`Nafez alpha server running on port ${PORT}`);
});
