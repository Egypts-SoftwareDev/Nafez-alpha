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
 * labels (Featured/Backed).  In a full implementation these actions
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

  // Try to replace sample data with API data
  (async function fetchCampaigns() {
    try {
      const res = await fetch('/alpha/api/campaigns', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.campaigns)) campaigns = data.campaigns;
      }
    } catch (e) {
      // keep fallback sample data silently
    }
  })();

  // Global state for UI controls
  let currentView = 'grid'; // 'grid' or 'list'
  let currentFilter = 'Featured'; // 'Featured' or 'Backed'
  let searchTerm = '';

  const container = document.getElementById('campaigns-container');
  const viewButtons = document.querySelectorAll('.view-toggle .icon-btn');
  const filters = document.querySelectorAll('.filter');
  const searchInput = document.querySelector('.search-bar input');

  // Helper to format numbers as EGP currency with commas
  function formatEGP(value) {
    return value.toLocaleString('en-EG', { maximumFractionDigits: 0 });
  }

  // Render campaigns into the container based on current state
  function renderCampaigns() {
    if (!container) return;
    // Determine which campaigns to show based on filter
    let visible = campaigns.filter((c) => {
      if (currentFilter === 'Featured') return c.isFeatured;
      if (currentFilter === 'Backed') return !c.isFeatured; // In this prototype, non-featured are treated as backed
      return true;
    });
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      visible = visible.filter(
        (c) =>
          c.title.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          (c.owner && c.owner.toLowerCase().includes(term))
      );
    }
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
        return `
          <div class="campaign-card">
            <div class="campaign-media">
              <img src="/alpha/public/images/campaign-placeholder.png" alt="${c.title}" />
              <span class="stage-label">${c.stage}</span>
            </div>
            <div class="campaign-info">
              <h3 class="campaign-title">${c.title}</h3>
              <div class="creator">
                <img src="/alpha/public/images/user-icon.png" alt="avatar" class="avatar" />
                <span>${c.owner}</span>
              </div>
              <p class="campaign-description">${c.description}</p>
              <div class="funding-info">
                <span class="raised">${formatEGP(c.raised)} EGP raised</span>
                <span class="backers">${c.backers} Backers</span>
                <span class="percentage">${pct}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress" style="width:${pct}%"></div>
              </div>
              <div class="deadline-info">
                <span>${c.daysLeft} days left</span>
                <span>Round ends: TBD</span>
              </div>
              <div class="shipping-info">
                <span class="shipping-label">Estimated Shipping</span>
                <span>TBD</span>
              </div>
              <button class="rewards-btn">View Rewards</button>
            </div>
          </div>
        `;
      })
      .join('');
    container.innerHTML = html;
  }

  // Initialize view buttons
  viewButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      viewButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentView = index === 0 ? 'list' : 'grid';
      renderCampaigns();
    });
  });
  // Mark default view as selected (grid)
  if (viewButtons[1]) viewButtons[1].classList.add('selected');

  // Initialize filters
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      filters.forEach((f) => f.classList.remove('active'));
      filter.classList.add('active');
      currentFilter = filter.textContent.trim();
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
      renderCampaigns();
    });
  }

  // Initial render
  renderCampaigns();

  // Update copyright year in the alpha footer.  We look for an element
  // with id="year-alpha" and set its text content to the current year.
  const yearAlpha = document.getElementById('year-alpha');
  if (yearAlpha) {
    yearAlpha.textContent = new Date().getFullYear();
  }
});

  // --- Simple hash router ---
  const viewHome = document.getElementById('view-home');
  const viewNew = document.getElementById('view-new');
  const viewCampaign = document.getElementById('view-campaign');
  const detailRoot = document.getElementById('campaign-detail');

  function show(el){ if(el) el.removeAttribute('hidden'); }
  function hide(el){ if(el) el && el.setAttribute('hidden',''); }

  function renderCampaignDetail(id){
    const c = campaigns.find((x)=> String(x.id) === String(id));
    if(!c){ if(detailRoot) detailRoot.innerHTML = '<p>Campaign not found.</p>'; return; }
    const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
    detailRoot.innerHTML = 
      <h2></h2>
      <div class="campaign-card">
        <div class="campaign-media">
          <img src="/alpha/public/images/campaign-placeholder.png" alt="" />
          <span class="stage-label"></span>
        </div>
        <div class="campaign-info">
          <p class="campaign-description"></p>
          <div class="funding-info">
            <span class="raised"> EGP raised</span>
            <span class="backers"> Backers</span>
            <span class="percentage">%</span>
          </div>
          <div class="progress-bar"><div class="progress" style="width:%"></div></div>
        </div>
      </div>;
  }

  function router(){
    const hash = location.hash || '#/home';
    const matchCampaign = hash.match(/^#\/campaign\/(\d+)$/);
    hide(viewHome); hide(viewNew); hide(viewCampaign);
    if(matchCampaign){ show(viewCampaign); renderCampaignDetail(matchCampaign[1]); return; }
    if(hash === '#/new'){ show(viewNew); return; }
    show(viewHome);
  }

  window.addEventListener('hashchange', router);
  router();

  // hook up new campaign form (UI-only)
  const form = document.getElementById('new-campaign-form');
  function loadLocal(){ try { return JSON.parse(localStorage.getItem('alphaLocalCampaigns')||'[]'); } catch(e){ return []; } }
  function saveLocal(list){ try { localStorage.setItem('alphaLocalCampaigns', JSON.stringify(list)); } catch(e){} }
  let localItems = loadLocal();
  campaigns = campaigns.concat(localItems);
  if(form){
    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const title = String(fd.get('title')||'Untitled').trim();
      const description = String(fd.get('description')||'').trim();
      const goal = Number(fd.get('goal')||0);
      const id = Date.now();
      const item = { id, title, description, goal, raised:0, backers:0, stage:'Concept', daysLeft:30, isFeatured:false };
      localItems.push(item); saveLocal(localItems);
      campaigns.push(item);
      form.reset();
      location.hash = '#/campaign/' + id;
      renderCampaigns();
      router();
    });
  }

  // navigate to details when clicking a campaign card
  const campaignsContainer = document.getElementById('campaigns-container');
  if(campaignsContainer){
    campaignsContainer.addEventListener('click', (e)=>{
      const card = e.target.closest('.campaign-card');
      if(card && card.dataset && card.dataset.id){
        location.hash = '#/campaign/' + card.dataset.id;
      }
    });
  }

