document.addEventListener('DOMContentLoaded', () => {
  // Only select the content sections for step toggling
  const sections = Array.from(document.querySelectorAll('section[data-step]'));
  // These are the visual step indicators (pills)
  const indicators = Array.from(document.querySelectorAll('.step'));
  const btnBack = document.getElementById('back');
  const btnNext = document.getElementById('next');
  const btnSave = document.getElementById('save');
  const btnSubmit = document.getElementById('submit');
  const appIdInput = document.getElementById('app-id');
  const rewardsDiv = document.getElementById('rewards');
  const addRewardBtn = document.getElementById('add-reward');
  const reviewDiv = document.getElementById('review');
  const errorsDiv = document.getElementById('errors');
  const inlineErrors = document.getElementById('inline-errors');
  const govSelect = document.getElementById('locationGov');
  const cityInput = document.getElementById('locationCity');
  const citiesList = document.getElementById('citiesList');

  let current = 0;

  function setStep(i) {
    current = Math.max(0, Math.min(sections.length - 1, i));
    sections.forEach((s, idx) => (s.hidden = idx !== current));
    indicators.forEach((el, idx) => el.classList.toggle('active', idx === current));
    btnBack.disabled = current === 0;
    btnNext.hidden = current === sections.length - 1;
    btnSubmit.hidden = current !== sections.length - 1;
  }

  setStep(0);

  btnBack.addEventListener('click', () => setStep(current - 1));
  btnNext.addEventListener('click', async () => {
    if (!validateCurrentStep()) { inlineErrors?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    await debouncedSave();
    setStep(current + 1);
  });

  // Egypt governorates + sample cities (MVP)
  const EG_GOVS = {
    Cairo: ['Nasr City', 'Heliopolis', 'Maadi', 'New Cairo', 'Dokki'],
    Giza: ['6th of October', 'Sheikh Zayed', 'Haram', 'Agouza'],
    Alexandria: ['Montaza', 'Sidi Gaber', 'Smouha', 'Louran'],
    Dakahlia: ['Mansoura', 'Talkha'],
    Sharqia: ['Zagazig', '10th of Ramadan'],
    Qalyubia: ['Banha', 'Obour City', 'Shubra El-Kheima'],
    Monufia: ['Shibin El-Kom'],
    Gharbia: ['Tanta', 'Mahalla'],
    Beheira: ['Damanhour'],
    KafrElSheikh: ['Kafr El-Sheikh City'],
    Fayoum: ['Fayoum'],
    BeniSuef: ['Beni Suef'],
    Minya: ['Minya'],
    Assiut: ['Assiut'],
    Sohag: ['Sohag'],
    Qena: ['Qena', 'Luxor'],
    Aswan: ['Aswan'],
    RedSea: ['Hurghada'],
    SouthSinai: ['Sharm El-Sheikh', 'Dahab'],
    NorthSinai: ['Arish'],
    Ismailia: ['Ismailia'],
    Suez: ['Suez'],
    PortSaid: ['Port Said'],
    Matrouh: ['Marsa Matruh'],
    NewValley: ['Kharga'],
    Damietta: ['Damietta'],
    Luxor: ['Luxor']
  };

  function populateGovs() {
    if (!govSelect) return;
    const opts = ['<option value="">Select governorate</option>'];
    for (const key of Object.keys(EG_GOVS)) {
      const label = key.replace(/([A-Z])/g, ' $1').trim();
      opts.push(`<option>${label}</option>`);
    }
    govSelect.innerHTML = opts.join('');
  }
  function populateCities(govName) {
    if (!citiesList) return;
    const normalized = (govName || '').replace(/\s+/g, '');
    const cities = EG_GOVS[normalized] || EG_GOVS[govName] || [];
    citiesList.innerHTML = cities.map((c) => `<option value="${c}"></option>`).join('');
  }
  populateGovs();
  if (govSelect) govSelect.addEventListener('change', () => populateCities(govSelect.value));

  function readForm() {
    // Basics
    const basics = {
      title: val('title'),
      category: val('category'),
      locationGov: val('locationGov'),
      locationCity: val('locationCity'),
      fundingModel: val('fundingModel'),
      goalEGP: num('goalEGP'),
      durationDays: num('durationDays'),
    };
    // Identity
    const identity = {
      name: val('name'), phone: val('phone'), nationalId: val('nationalId'),
      business: { entityType: val('entityType'), crn: val('crn'), taxId: val('taxId') }
    };
    // Story
    const story = { pitch: val('pitch'), description: val('description'), videoUrl: val('videoUrl'), images: [] };
    // Rewards
    const rewards = Array.from(document.querySelectorAll('.reward')).map((row) => ({
      title: row.querySelector('[data-r=title]').value.trim(),
      description: row.querySelector('[data-r=description]').value.trim(),
      amountEGP: Number(row.querySelector('[data-r=amount]').value || 0),
      limit: Number(row.querySelector('[data-r=limit]').value || 0),
      eta: row.querySelector('[data-r=eta]').value
    }));
    return { basics, identity, story, rewards };
  }

  function renderRewards() {
    if (!rewardsDiv) return;
    if (rewardsDiv.children.length === 0) addReward();
  }

  function addReward() {
    const wrap = document.createElement('div');
    wrap.className = 'reward';
    wrap.style.margin = '10px 0';
    wrap.innerHTML = `
      <div class="grid-2">
        <div><label>Title</label><input data-r="title" /></div>
        <div><label>Amount (EGP)</label><input type="number" min="0" step="10" data-r="amount" /></div>
        <div><label>Description</label><input data-r="description" /></div>
        <div><label>Limit</label><input type="number" min="0" step="1" data-r="limit" /></div>
        <div><label>Estimated delivery</label><input type="month" data-r="eta" /></div>
      </div>
    `;
    rewardsDiv.appendChild(wrap);
  }

  if (addRewardBtn) addRewardBtn.addEventListener('click', addReward);
  renderRewards();

  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function num(id) { const v = val(id); return v ? Number(v) : 0; }

  // Step validations
  function validateCurrentStep() {
    const errs = [];
    if (current === 0) {
      if (!val('title')) errs.push('Title is required');
      const goal = num('goalEGP');
      if (!goal || goal < 1000) errs.push('Goal must be at least 1,000 EGP');
      if (!val('locationGov')) errs.push('Governorate is required');
      const d = num('durationDays');
      if (d < 10 || d > 60) errs.push('Duration must be 10–60 days');
    } else if (current === 1) {
      if (!val('name')) errs.push('Full name is required');
      const nid = val('nationalId');
      if (!/^\d{14}$/.test(nid)) errs.push('National ID must be 14 digits');
      const phone = val('phone');
      if (phone && !/^[+]?\d[\d\s-]{7,}$/.test(phone)) errs.push('Phone number looks invalid');
    } else if (current === 2) {
      if (!val('pitch')) errs.push('Short pitch is required');
    }
    const msg = errs.join('\n');
    errorsDiv.textContent = msg;
    if (inlineErrors) inlineErrors.textContent = msg;
    return errs.length === 0;
  }

  async function saveDraft() {
    errorsDiv.textContent = '';
    const payload = Object.assign({ id: id() }, readForm());
    const res = await fetch('/alpha/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Save failed');
    const data = await res.json();
    if (data && data.application) {
      appIdInput.value = data.application.id;
      localStorage.setItem('nafez:lastAppId', String(data.application.id));
    }
  }
  let saveTimer = null;
  async function debouncedSave() {
    return new Promise((resolve) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => { try { await saveDraft(); } catch (_) {} finally { resolve(); } }, 600);
    });
  }
  function id() { return Number(appIdInput.value || localStorage.getItem('nafez:lastAppId') || 0) || undefined; }

  btnSave.addEventListener('click', async () => {
    try { await saveDraft(); alert('Draft saved'); } catch (e) { errorsDiv.textContent = e.message; }
  });
  // Autosave on changes
  document.getElementById('apply-form')?.addEventListener('input', debouncedSave);

  btnSubmit.addEventListener('click', async () => {
    errorsDiv.textContent = '';
    try {
      if (!validateCurrentStep()) { inlineErrors?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setStep(current); return; }
      await saveDraft();
      const appId = Number(appIdInput.value);
      if (!appId) throw new Error('No application id');
      const res = await fetch(`/alpha/api/applications/${appId}/submit`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      reviewDiv.innerHTML = '<p>Submitted! Our team will review your application.</p>';
      alert('Application submitted');
    } catch (e) {
      errorsDiv.textContent = e.message || String(e);
      setStep(4);
    }
  });

  // Restore last draft if exists
  (async function restoreDraft(){
    const last = id();
    if (!last) return;
    try {
      const res = await fetch(`/alpha/api/applications/${last}`);
      if (!res.ok) return;
      const data = await res.json();
      const a = data && data.application;
      if (!a) return;
      appIdInput.value = a.id;
      setIf('title', a.basics?.title);
      setIf('category', a.basics?.category);
      setIf('locationGov', a.basics?.locationGov);
      populateCities(a.basics?.locationGov);
      setIf('locationCity', a.basics?.locationCity);
      setIf('fundingModel', a.basics?.fundingModel);
      setIf('goalEGP', a.basics?.goalEGP);
      setIf('durationDays', a.basics?.durationDays);
      setIf('name', a.identity?.name);
      setIf('phone', a.identity?.phone);
      setIf('nationalId', a.identity?.nationalId);
      setIf('entityType', a.identity?.business?.entityType);
      setIf('crn', a.identity?.business?.crn);
      setIf('taxId', a.identity?.business?.taxId);
      setIf('pitch', a.story?.pitch);
      setIf('description', a.story?.description);
      setIf('videoUrl', a.story?.videoUrl);
      rewardsDiv.innerHTML = '';
      (a.rewards || []).forEach(r => { addReward(); const row = rewardsDiv.lastElementChild; row.querySelector('[data-r=title]').value = r.title || ''; row.querySelector('[data-r=description]').value = r.description || ''; row.querySelector('[data-r=amount]').value = r.amountEGP || ''; row.querySelector('[data-r=limit]').value = r.limit || ''; row.querySelector('[data-r=eta]').value = r.eta || ''; });
      renderRewards();
    } catch(_){}
  })();

  function setIf(id, v){ if (v !== undefined && v !== null) { const el = document.getElementById(id); if (el) el.value = v; } }
});
