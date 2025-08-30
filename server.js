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

// Directory containing static assets for the alpha UI.  The UI is served
// from /alpha/public/ and the home page at /alpha/home loads the index.html
// file from this directory.  Assets include HTML, CSS, JS and images.
const PUBLIC_DIR = path.join(__dirname, 'public');

// Read campaigns from file
function readCampaigns() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading campaigns:', err);
    return [];
  }
}

// Write campaigns to file
function writeCampaigns(list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error writing campaigns:', err);
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
    <style>
      body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
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
    <style>
      body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; margin: 0; padding: 2rem; }
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
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${c.title} — Nafez Alpha</title>
    <style>
      body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; margin: 0; padding: 2rem; }
      h1 { color: #cfe468; }
      .button { padding: 0.5rem 1rem; background-color: #cfe468; color: #0a1522; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; }
      a { color: #cfe468; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>${c.title}</h1>
    <p>${c.description}</p>
    <p><strong>Goal:</strong> EGP ${c.goal}</p>
    <p><strong>Raised:</strong> EGP ${c.raised}</p>
    <p><strong>Backers:</strong> ${c.backers}</p>
    <p><strong>Stage:</strong> ${c.stage}</p>
    <a href="/alpha/home" class="button">Back to dashboard</a>
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

// Create the HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const cookies = parseCookies(req);
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
      <style>
        body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
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
        body { font-family: Arial, sans-serif; background-color: #0a1522; color: #f5f5f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
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
      const { name, email, password, role } = body;
      if (!name || !email || !password || !role) {
        res.writeHead(302, { Location: '/alpha/signup?error=' + encodeURIComponent('All fields are required.') });
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
  if (req.method === 'GET' && parsedUrl.pathname === '/alpha/admin') {
    // Admin quick login page: for convenience, allow entering the admin
    // password directly.  This is separate from the email/password
    // login page.
    const adminPage = renderLoginPage();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(adminPage);
    return;
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
  // Not found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`Nafez alpha server running on port ${PORT}`);
});
