/*
 * JavaScript for the Nafez alpha homepage.
 *
 * This script adds basic interactivity for the prototype, including
 * toggling active filters and handling the view mode buttons. In a real
 * implementation these hooks would drive API calls or modify the DOM to
 * display different sets of campaigns. For this prototype they simply
 * apply CSS classes to indicate state.
 */

/*
 * Alpha prototype interactivity
 *
 * The goal of this script is to simulate core functionality of the
 * crowdfunding marketplace without relying on a backend.  A small
 * array of sample campaigns is defined below and rendered into
 * #campaigns-container.  Users can toggle between grid and list
 * views, search campaigns by title/description, and activate filter
 * labels (Feed/For You).  In a full implementation these actions
 * would make API calls; here they simply modify the DOM and update
 * classes.  The styling for grid vs list is defined in CSS via
 * #campaigns-container.list.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Local sample data used as a fallback if the API is unavailable.
  let campaigns = [
    {
      id: 1,
      title: 'Pyrasound V1',
      owner: 'Omar A.',
      description:
        'Support local production and pre-order this 100% Egyptian full surround-sound Dolby Atmos approved home theatre system. Basic package includes 1 sound bar + 3 pyramid speakers.',
      goal: 50000,
      raised: 22648,
      backers: 47,
      stage: 'Concept',
      daysLeft: 23,
      isFeatured: true,
    },
    {
      id: 2,
      title: 'Solar Water Purifier',
      owner: 'Sara M.',
      description:
        'A portable solar-powered water purification device designed for remote villages. Help us provide clean water to those in need.',
      goal: 30000,
      raised: 12000,
      backers: 20,
      stage: 'Prototype',
      daysLeft: 15,
      isFeatured: true,
    },
    {
      id: 3,
      title: 'Artisan Coffee Roastery',
      owner: 'Ali K.',
      description:
        'Launching an artisan micro roastery sourcing ethically grown beans from local farmers. Back us to support fair trade and exceptional taste.',
      goal: 20000,
      raised: 10000,
      backers: 12,
      stage: 'Idea',
      daysLeft: 30,
      isFeatured: false,
    },
  ];

  // Tracks which campaigns current user backed
  let backedSet = new Set();

  async function fetchMyPledges() {
    try {
      const res = await fetch('/alpha/api/me/pledges', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        const ids = (data.pledges || []).map((p) => Number(p.campaignId));
        backedSet = new Set(ids);
      }
    } catch (_) { /* ignore */ }
  }

  // Try to replace sample data with API data
  (async function fetchCampaigns() {
    try {
      const res = await fetch('/alpha/api/campaigns', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.campaigns)) {
          campaigns = data.campaigns;
        }
      }
    } catch (e) {
      // keep fallback sample data silently
    }
    // Also fetch which campaigns the user has backed
    await fetchMyPledges();
    // Re-render once real data arrives so Featured/Backed show correct sets
    renderCampaigns();
  })();

  // Global state for UI controls
  let currentView = 'grid'; // 'grid' or 'list'
  // Filters: 'Feed' (chronological) and 'For You' (personalized ranking)
  let currentFilter = 'Feed';
  let searchTerm = '';
  // Infinite feed pagination
  const FEED_PAGE_SIZE = 10;
  let page = 1;

  const container = document.getElementById('campaigns-container');
  const viewButtons = document.querySelectorAll('.view-toggle .icon-btn');
  const filters = document.querySelectorAll('.filter');
  // Prefer navbar search input if present
  const searchInput = document.getElementById('navSearch') || document.querySelector('.search-bar input');
  const categoriesRow = document.querySelector('.categories-row');
  const catViewport = document.getElementById('categoriesViewport');
  const catPrev = document.querySelector('.cat-prev');
  const catNext = document.querySelector('.cat-next');

  // Helper to format numbers as EGP currency with commas
  function formatEGP(value) {
    return value.toLocaleString('en-EG', { maximumFractionDigits: 0 });
  }

  // Deterministic estimated shipping date based on campaign attributes
  function computeShippingDate(c) {
    try {
      const base = new Date();
      const id = Number(c.id || 1);
      const daysLeft = Number(c.daysLeft || 30);
      // Offset: daysLeft plus 30..90 days pseudo-randomized by id
      const extra = 30 + ((id * 37) % 61); // 30..90
      const offset = Math.max(30, daysLeft) + extra;
      const ship = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
      return ship;
    } catch (_) { return null; }
  }
  function formatMonthYear(d) {
    if (!d || !(d instanceof Date)) return 'TBD';
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  // Basic preference retrieval (placeholder until onboarding is built)
  // Stores a list of preferred categories in localStorage under 'nafez:prefs:categories'
  function getUserPreferredCategories() {
    try {
      const raw = localStorage.getItem('nafez:prefs:categories');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  // Compute ordered list for the selected tab
  function computeOrderedList() {
    // Start with all campaigns
    let list = campaigns.slice();

    // Filter by selected category first
    if (selectedCategory && selectedCategory !== 'All') {
      list = list.filter((c) => (c.category || 'General') === selectedCategory);
    }
    // Filter by search string
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c) => (c.title && c.title.toLowerCase().includes(term)) || (c.description && c.description.toLowerCase().includes(term)) || (c.owner && c.owner.toLowerCase().includes(term)));
    }

    if (currentFilter === 'Feed') {
      // Chronological style (newest first). If createdAt exists, use it; fallback to id desc
      list.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
        return bt - at;
      });
      return list;
    }

    // For You: simple scoring based on signals until we have onboarding
    const prefs = new Set(getUserPreferredCategories());
    const scored = list.map((c) => {
      let score = 0;
      // User backed campaigns get top priority
      if (backedSet.has(Number(c.id))) score += 1000;
      // Featured campaigns are boosted
      if (c.isFeatured) score += 200;
      // Category preference boost
      if (c.category && prefs.has(c.category)) score += 120;
      // Higher engagement proxy (more backers)
      if (c.backers) score += Math.min(150, c.backers);
      // Recency
      const t = c.createdAt ? new Date(c.createdAt).getTime() : (c.id || 0);
      score += (t % 1000) / 1000; // minor tie-breaker
      return { c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.c);
  }

  // Category chips
  let selectedCategory = 'All';
  const DEFAULT_CATEGORIES = ['All','Technology','Environment','Food','Education','Mobility','Hardware','Design','Community'];
  function renderCategories() {
    if (!categoriesRow) return;
    let cats = new Set(['All']);
    (campaigns || []).forEach(c => { if (c.category) cats.add(c.category); });
    const list = (cats.size > 1 ? Array.from(cats) : DEFAULT_CATEGORIES);
    categoriesRow.innerHTML = list.map(cat => `<button type="button" class="category-chip${cat===selectedCategory?' active':''}" data-cat="${cat}" aria-pressed="${cat===selectedCategory}">${cat}</button>`).join('');
    categoriesRow.querySelectorAll('.category-chip').forEach(chip => {
      const activate = () => {
        selectedCategory = chip.getAttribute('data-cat');
        page = 1; // reset pagination when category changes
        renderCategories();
        renderCampaigns();
      };
      chip.addEventListener('click', activate);
      chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });
    // Carousel controls (scroll the viewport)
    if (catPrev && catViewport) catPrev.onclick = () => { catViewport.scrollBy({ left: -Math.max(160, catViewport.clientWidth * 0.5), behavior: 'smooth' }); };
    if (catNext && catViewport) catNext.onclick = () => { catViewport.scrollBy({ left: Math.max(160, catViewport.clientWidth * 0.5), behavior: 'smooth' }); };
  }

  // Make vertical wheel scroll the categories horizontally when hovering or focused
  if (catViewport) {
    const wheelToHorizontal = (e) => {
      // Prefer vertical delta; fall back to horizontal if trackpad sends that
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      catViewport.scrollLeft += delta;
    };
    // Hover behavior
    catViewport.addEventListener('wheel', wheelToHorizontal, { passive: false });
    // Focused behavior (when users click into the carousel)
    const globalWheel = (e) => {
      if (document.activeElement === catViewport) wheelToHorizontal(e);
    };
    catViewport.addEventListener('focus', () => {
      window.addEventListener('wheel', globalWheel, { passive: false });
    });
    catViewport.addEventListener('blur', () => {
      window.removeEventListener('wheel', globalWheel, { passive: false });
    });
    // Keyboard support for focused viewport
    catViewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); catViewport.scrollBy({ left: -120, behavior: 'smooth' }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); catViewport.scrollBy({ left: 120, behavior: 'smooth' }); }
      if (e.key === 'Home') { e.preventDefault(); catViewport.scrollTo({ left: 0, behavior: 'smooth' }); }
      if (e.key === 'End') { e.preventDefault(); catViewport.scrollTo({ left: catViewport.scrollWidth, behavior: 'smooth' }); }
    });
  }

  // Render campaigns into the container based on current state
  function renderCampaigns() {
    if (!container) return;
    const ordered = computeOrderedList();
    const end = Math.min(ordered.length, page * FEED_PAGE_SIZE);
    const visible = ordered.slice(0, end);
    // Update view class on container
    if (currentView === 'list') {
      container.classList.add('list');
    } else {
      container.classList.remove('list');
    }
    // Build HTML for each card
    const html = visible
      .map((c) => {
        const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
        const imgSrc = (c.imageUrl && typeof c.imageUrl === 'string') ? c.imageUrl : '/alpha/public/images/campaign-placeholder.png';
        const shipDate = computeShippingDate(c);
        const shipLabel = formatMonthYear(shipDate);
        return `
          <div class="campaign-card" data-campaign-id="${c.id}" role="button" tabindex="0" aria-label="Open ${c.title}">
            <div class="media-col">
              <div class="campaign-media">
                <img src="${imgSrc}" alt="${c.title}" />
                <span class="stage-badge">${c.stage || 'Stage'}</span>
              </div>
              <div class="media-stats">
                <span class="raised">${formatEGP(c.raised)} EGP raised</span>
                <span class="backers">${c.backers} Backers</span>
              </div>
              <div class="media-progress">
                <div class="progress-pill"><div class="progress" style="width:${pct}%"></div></div>
                <div class="pct-badge">${pct}%</div>
              </div>
              <div class="deadline-info">
                <span>${c.daysLeft} days left</span>
                <span>Round ends: TBD</span>
              </div>
            </div>
            <div class="info-col">
              <h3 class="campaign-title">${c.title}</h3>
              <div class="creator">
                <img src="/alpha/public/images/user-icon.png" alt="avatar" class="avatar" />
                <span>${c.owner}</span>
              </div>
              <p class="campaign-description">${c.description}</p>
              <div class="shipping-info">
                <span class="shipping-label">Estimated Shipping</span>
                <span class="shipping-date">${shipLabel}</span>
              </div>
              <a class="rewards-btn large" href="/alpha/campaign/${c.id}" role="link" aria-label="View ${c.title} details">View Rewards</a>
            </div>
          </div>
        `;
      })
      .join('');
    container.innerHTML = html;

    // Ship dates → calendar events
    try {
      const dates = visible.map((c) => computeShippingDate(c)).filter(Boolean).map((d) => {
        const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const da = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${da}`;
      });
      if (!window.__pendingCalDates) window.__pendingCalDates = new Set();
      dates.forEach((k)=> window.__pendingCalDates.add(k));
      if (window.nafezCal && typeof window.nafezCal.add === 'function') {
        window.nafezCal.add(dates);
      }
    } catch(_) {}

    // Make entire card clickable to details
    container.querySelectorAll('.campaign-card').forEach((card) => {
      const id = card.getAttribute('data-campaign-id');
      const open = () => { if (id) window.location.href = `/alpha/campaign/${id}`; };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });
  }

  // Initialize view buttons
  viewButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      viewButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentView = index === 0 ? 'list' : 'grid';
      page = 1; // reset pagination
      renderCampaigns();
    });
  });
  // Mark default view as selected (list) to resemble social feeds
  if (viewButtons[0]) { viewButtons[0].classList.add('selected'); currentView = 'list'; }

  // Initialize filters
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      filters.forEach((f) => f.classList.remove('active'));
      filter.classList.add('active');
      currentFilter = filter.textContent.trim();
      page = 1;
      renderCampaigns();
    });
  });
  // Default active filter
  filters.forEach((f) => {
    if (f.classList.contains('active')) {
      currentFilter = f.textContent.trim();
    }
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderCampaigns();
    });
  }

  // Initial render
  renderCategories();
  renderCampaigns();

  // Infinite scroll: load more when close to the bottom
  function onScrollLoadMore() {
    try {
      const ordered = computeOrderedList();
      if (page * FEED_PAGE_SIZE >= ordered.length) return; // all loaded
      const threshold = 240; // px before bottom
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - threshold) {
        page += 1;
        renderCampaigns();
      }
    } catch (_) {}
  }
  window.addEventListener('scroll', onScrollLoadMore, { passive: true });

  // Align calendar top with first posts
  function alignCalendar() {
    try {
      const rail = document.querySelector('.content-right');
      const sticky = document.getElementById('rightSticky');
      const spacer = document.getElementById('rightStickySpacer');
      const ad = document.querySelector('.ad-card');
      if (!rail || !sticky || !container) return;

      // Measurements
      const railRect = rail.getBoundingClientRect();
      const railTop = railRect.top + window.scrollY;
      const railLeft = railRect.left + window.scrollX;
      const cardsTopAbs = container.getBoundingClientRect().top + window.scrollY;
      const alignOffset = Math.max(0, Math.round(cardsTopAbs - railTop));
      const adBox = ad ? ad.getBoundingClientRect() : null;
      const adWidth = adBox ? Math.round(adBox.width) : Math.round(sticky.offsetWidth);
      const adBottomAbs = adBox ? (adBox.top + window.scrollY + adBox.height + 12) : railTop; // gap after ad

      // Determine desired absolute top so the stack:
      //  - never goes above 16px from viewport
      //  - never overlaps the ad (starts below ad bottom)
      //  - aligns with first post row at its first appearance
      const minViewportTopAbs = window.scrollY + 16;
      let desiredTopAbs = Math.max(minViewportTopAbs, adBottomAbs, cardsTopAbs);

      // Clamp so bottom of stack never overlaps the footer
      const footer = document.querySelector('footer');
      const footerTopAbs = footer ? (footer.getBoundingClientRect().top + window.scrollY) : Number.POSITIVE_INFINITY;
      const stackHeight = sticky.scrollHeight;
      const maxTopAbs = footerTopAbs - stackHeight - 16; // keep a small gap
      if (desiredTopAbs > maxTopAbs) desiredTopAbs = maxTopAbs;

      // Apply fixed positioning
      sticky.style.position = 'fixed';
      sticky.style.top = Math.round(desiredTopAbs - window.scrollY) + 'px';
      sticky.style.left = Math.round(railLeft) + 'px';
      if (adWidth > 0) { sticky.style.width = adWidth + 'px'; sticky.style.maxWidth = adWidth + 'px'; }

      // Spacer preserves flow height and initial alignment within the rail
      if (spacer) {
        const h = sticky.scrollHeight;
        spacer.style.height = h + 'px';
        spacer.style.marginTop = alignOffset + 'px';
      }
    } catch (_) {}
  }
  alignCalendar();
  window.addEventListener('resize', alignCalendar);
  window.addEventListener('load', alignCalendar);
  window.addEventListener('scroll', alignCalendar, { passive: true });

  // Update copyright year in the alpha footer.  We look for an element
  // with id="year-alpha" and set its text content to the current year.
  const nowYear = new Date().getFullYear();
  const yearAlpha = document.getElementById('year-alpha');
  if (yearAlpha) yearAlpha.textContent = nowYear;
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = nowYear;

  // Sidebar: Intizam calendar
  (function initCalendar(){
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const grid = document.getElementById('calGrid');
    const mEl = document.getElementById('calMonth');
    const yEl = document.getElementById('calYear');
    const prev = document.getElementById('calPrev');
    const next = document.getElementById('calNext');
    if (!grid || !mEl || !yEl) return;
    let current = new Date();
    const eventDays = { }; // e.g., '2025-09-10': true
    function render(){
      const y = current.getFullYear();
      const m = current.getMonth();
      mEl.textContent = monthNames[m];
      yEl.textContent = y;
      grid.innerHTML = '';
      const head = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      head.forEach(h=>{ const d=document.createElement('div'); d.textContent=h; d.className='cal-cell cal-head'; grid.appendChild(d); });
      const first = new Date(y,m,1); const start = first.getDay();
      const days = new Date(y,m+1,0).getDate();
      for (let i=0;i<start;i++){ const e=document.createElement('div'); e.className='cal-cell'; e.innerHTML='&nbsp;'; grid.appendChild(e); }
      for (let d=1; d<=days; d++){
        const cell=document.createElement('div'); cell.className='cal-cell'; cell.textContent=String(d);
        const today=new Date(); if (d===today.getDate() && m===today.getMonth() && y===today.getFullYear()) cell.classList.add('cal-today');
        const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; if (eventDays[key]) cell.classList.add('cal-event');
        grid.appendChild(cell);
      }
    }
    prev && prev.addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); render(); });
    next && next.addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); render(); });
    // Expose small API to add dates and re-render if in current month
    window.nafezCal = {
      add: function(dateKeys){
        try {
          (dateKeys||[]).forEach((k)=>{ eventDays[k]=true; });
          render();
        } catch(_) {}
      }
    };
    // Drain any pending dates collected during early card rendering
    try {
      if (window.__pendingCalDates) {
        window.nafezCal.add(Array.from(window.__pendingCalDates));
      }
    } catch(_) {}
    render();
  })();

  // Sidebar: Seeker/Backer checklist
  (function initChecklist(){
    const list = document.getElementById('roleChecklist');
    const btnS = document.getElementById('roleSeeker');
    const btnB = document.getElementById('roleBacker');
    if (!list || !btnS || !btnB) return;
    const SEEKER = ['Define your idea & category','Write title and 140-char pitch','Add at least 2 rewards','Prepare video and 3 images','Set goal and duration','Submit application','Share campaign with friends'];
    const BACKER = ['Browse Featured projects','Read story and risks','Choose a suitable reward','Pledge amount','Share with a friend','Track updates'];
    let role = localStorage.getItem('nafez:role') || 'seeker';
    function render(){
      btnS.classList.toggle('active', role==='seeker'); btnB.classList.toggle('active', role==='backer');
      const items = role==='seeker' ? SEEKER : BACKER;
      list.innerHTML = items.map((t, i)=>`<li><input type="checkbox" id="task-${i}"><label for="task-${i}">${t}</label></li>`).join('');
    }
    btnS.addEventListener('click', ()=>{ role='seeker'; localStorage.setItem('nafez:role', role); render(); });
    btnB.addEventListener('click', ()=>{ role='backer'; localStorage.setItem('nafez:role', role); render(); });
    render();
  })();
});

  
