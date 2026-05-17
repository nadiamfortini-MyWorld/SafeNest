// SafeNest — App Logic

let currentView = 'home';
let previousView = 'home';
let favorites = JSON.parse(localStorage.getItem('safenest-favorites') || '[]');
let currentFilters = { search: '', minPrice: 0, maxPrice: 5000, bedrooms: 'any', pets: false, roommate: false, city: 'all' };

// Cache for live API data
let liveSchoolsCache = {};
let liveCrimeCache = {};
let liveRentalsCache = {};

// ── Live API Calls ──

async function fetchLiveRentals(city, state = 'WA') {
  const key = `${city}-${state}`;
  if (liveRentalsCache[key]) return liveRentalsCache[key];

  try {
    const resp = await fetch(`/api/rentals?city=${encodeURIComponent(city)}&state=${state}&limit=20`);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    liveRentalsCache[key] = data.listings || [];
    return liveRentalsCache[key];
  } catch (err) {
    console.warn('Rental API fallback to mock data:', err.message);
    return null;
  }
}

async function fetchLiveSchools(neighborhood) {
  const hood = NEIGHBORHOODS.find(n => n.id === neighborhood);
  if (!hood) return null;
  const key = `${hood.city}-${hood.name}`;
  if (liveSchoolsCache[key]) return liveSchoolsCache[key];

  try {
    const resp = await fetch(`/api/schools?city=${encodeURIComponent(hood.city)}&state=WA&perPage=8`);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    liveSchoolsCache[key] = data.schools || [];
    return liveSchoolsCache[key];
  } catch (err) {
    console.warn('School API fallback to mock data:', err.message);
    return null; // will fall back to mock data
  }
}

async function fetchLiveCrime(stateAbbr) {
  if (liveCrimeCache[stateAbbr]) return liveCrimeCache[stateAbbr];

  try {
    const resp = await fetch(`/api/crime/state/${stateAbbr}`);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    liveCrimeCache[stateAbbr] = data.crime;
    return liveCrimeCache[stateAbbr];
  } catch (err) {
    console.warn('Crime API fallback to mock data:', err.message);
    return null;
  }
}

// ── Navigation ──

function switchView(view, data) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  const tabEl = document.querySelector(`[data-view="${view}"]`);
  if (viewEl) viewEl.classList.add('active');
  if (tabEl) tabEl.classList.add('active');

  if (view === 'home') renderHome();
  if (view === 'search') renderListings();
  if (view === 'map') renderMap();
  if (view === 'favorites') renderFavorites();
  if (view === 'detail' && data) renderDetail(data);

  if (view !== 'detail') previousView = view;
  currentView = view;
  if (view !== 'detail') window.scrollTo(0, 0);
}

// ── Home Screen ──

function renderHome() {
  const stats = {
    listings: LISTINGS.length,
    avgPrice: Math.round(LISTINGS.reduce((s, l) => s + l.price, 0) / LISTINGS.length),
    safest: [...NEIGHBORHOODS].sort((a, b) => b.safetyScore - a.safetyScore)[0],
    cheapest: [...LISTINGS].sort((a, b) => a.price - b.price)[0],
  };

  const featured = LISTINGS.slice(0, 4);
  const roommates = LISTINGS.filter(l => l.roommate);

  document.getElementById('view-home').innerHTML = `
    <div class="hero-banner">
      <div class="hero-content">
        <h1>🏡 SafeNest</h1>
        <p>Find affordable, safe housing in Washington</p>
        <div class="hero-search">
          <span class="hero-search-icon">🔍</span>
          <input type="text" id="heroSearchInput" placeholder="Search by city, neighborhood, or keyword..."
                 oninput="currentFilters.search = this.value"
                 onkeydown="if(event.key==='Enter'){doSearch(this.value);}" />
          <button class="hero-search-btn" aria-label="Search" onclick="doSearch(document.getElementById('heroSearchInput').value)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M13 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="home-stats">
      <div class="stat-card">
        <div class="stat-number">${stats.listings}</div>
        <div class="stat-label">Listings</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">$${stats.avgPrice}</div>
        <div class="stat-label">Avg Rent</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${stats.safest.safetyScore}</div>
        <div class="stat-label">Top Safety</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${roommates.length}</div>
        <div class="stat-label">Roommate</div>
      </div>
    </div>

    <div class="home-section">
      <div class="section-header">
        <h2>Featured Listings</h2>
        <button class="see-all-btn" onclick="switchView('search')">See all →</button>
      </div>
      <div class="featured-scroll">
        ${featured.map(l => renderFeaturedCard(l)).join('')}
      </div>
    </div>

    <div class="home-section">
      <div class="section-header">
        <h2>🏘️ Roommate Options</h2>
      </div>
      <div class="listing-list">
        ${roommates.map(l => renderListingCard(l)).join('')}
      </div>
    </div>

    <div class="home-section">
      <div class="section-header">
        <h2>🛡️ Safest Neighborhoods</h2>
      </div>
      <div class="neighborhood-list">
        ${[...NEIGHBORHOODS].sort((a,b) => b.safetyScore - a.safetyScore).slice(0,4).map(n => `
          <div class="neighborhood-card" onclick="filterByNeighborhood('${n.id}')">
            <div class="nb-score" style="background:${n.color}20;color:${n.color}">${n.safetyScore}</div>
            <div class="nb-info">
              <div class="nb-name">${n.name}</div>
              <div class="nb-city">${n.city} · ${n.crimeRate} crime</div>
            </div>
            <div class="nb-arrow">›</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="demo-banner">
      <span>📋</span> This is a demo with sample data. Real API integration coming soon!
    </div>
  `;
}

function renderFeaturedCard(listing) {
  const hood = NEIGHBORHOODS.find(n => n.id === listing.neighborhood);
  const isFav = favorites.includes(listing.id);
  return `
    <div class="featured-card" onclick="switchView('detail', ${listing.id})">
      <div class="featured-img" style="background-image:url('${listing.image}')">
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite(${listing.id})">
          ${isFav ? '❤️' : '🤍'}
        </button>
        ${listing.roommate ? '<span class="tag roommate-tag">👥 Roommate</span>' : ''}
      </div>
      <div class="featured-body">
        <div class="featured-price">$${listing.price.toLocaleString()}<span>/mo</span></div>
        <div class="featured-title">${listing.title}</div>
        <div class="featured-meta">${listing.bedrooms === 0 ? 'Studio' : listing.bedrooms + 'bd'} · ${listing.bathrooms}ba · ${listing.sqft} sqft</div>
        <div class="featured-location">📍 ${hood.name}, ${hood.city}</div>
        <div class="safety-badge" style="background:${hood.color}15;color:${hood.color}">🛡️ ${hood.safetyScore} Safety</div>
      </div>
    </div>
  `;
}

// ── Listings View ──

function renderListings() {
  const filtered = getFilteredListings();
  console.debug('renderListings', { filters: currentFilters, results: filtered.length });
  const cities = [...new Set(NEIGHBORHOODS.map(n => n.city))];

  document.getElementById('view-search').innerHTML = `
    <div class="search-header">
      <div class="search-top-row">
        <button class="back-btn" onclick="switchView('home')">← Home</button>
        <div class="results-count">${filtered.length} listing${filtered.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="search-input-wrap">
        <span>🔍</span>
         <input type="text" id="searchInput" placeholder="Search listings..."
           oninput="handleSearchInput(this.value)"
           onkeydown="if(event.key==='Enter'){currentFilters.search=this.value;updateListingResults();}" />
      </div>
    </div>

    <div class="filters-bar">
      <select onchange="updateFilter('city', this.value)">
        <option value="all" ${currentFilters.city === 'all' ? 'selected' : ''}>All Cities</option>
        ${cities.map(c => `<option value="${c}" ${currentFilters.city === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select onchange="updateFilter('bedrooms', this.value)">
        <option value="any" ${currentFilters.bedrooms === 'any' ? 'selected' : ''}>Any Beds</option>
        <option value="0" ${currentFilters.bedrooms === '0' ? 'selected' : ''}>Studio</option>
        <option value="1" ${currentFilters.bedrooms === '1' ? 'selected' : ''}>1 Bed</option>
        <option value="2" ${currentFilters.bedrooms === '2' ? 'selected' : ''}>2 Beds</option>
        <option value="3" ${currentFilters.bedrooms === '3' ? 'selected' : ''}>3+ Beds</option>
      </select>
      <button class="filter-chip ${currentFilters.pets ? 'active' : ''}" onclick="toggleFilter('pets')">🐾 Pets</button>
      <button class="filter-chip ${currentFilters.roommate ? 'active' : ''}" onclick="toggleFilter('roommate')">👥 Roommate</button>
    </div>

    <div class="price-filter">
      <label>Max Price: <strong>$${currentFilters.maxPrice.toLocaleString()}</strong></label>
      <input type="range" min="400" max="5000" step="100" value="${currentFilters.maxPrice}"
             oninput="updateFilter('maxPrice', parseInt(this.value))" />
    </div>

    <div class="results-count">${filtered.length} listing${filtered.length !== 1 ? 's' : ''} found</div>

    <div class="listing-list">
      ${filtered.length ? filtered.map(l => renderListingCard(l)).join('') : '<div class="empty-state">😕 No listings match your filters. Try adjusting them!</div>'}
    </div>

    <div id="live-rentals-section">
      <div class="loading-hint" style="text-align:center;padding:20px">⏳ Loading live rental listings...</div>
    </div>
  `;

  // Fetch live rentals for the current search city
  const searchCity = currentFilters.city !== 'all' ? currentFilters.city : (currentFilters.search || 'Seattle');
  fetchLiveRentals(searchCity).then(liveListings => {
    const container = document.getElementById('live-rentals-section');
    if (container && liveListings && liveListings.length > 0) {
      // Filter live listings by current filters
      let filtered = liveListings;
      if (currentFilters.maxPrice < 5000) filtered = filtered.filter(l => l.price <= currentFilters.maxPrice);
      if (currentFilters.bedrooms !== 'any') {
        const beds = parseInt(currentFilters.bedrooms);
        filtered = filtered.filter(l => beds === 3 ? (l.bedrooms >= 3) : (l.bedrooms === beds));
      }
      if (currentFilters.pets) filtered = filtered.filter(l => l.pets);

      container.innerHTML = `
        <div style="padding:0 16px">
          <div class="live-badge" style="margin-top:16px">🟢 Live data from Realtor.com — ${filtered.length} rentals in ${searchCity}</div>
        </div>
        <div class="listing-list" style="margin-top:12px">
          ${filtered.map(l => renderLiveListingCard(l)).join('')}
        </div>
        <div style="font-size:11px;color:#94a3b8;padding:16px;text-align:center">Data from Realtor.com via US Real Estate Listings API</div>
      `;
    } else if (container) {
      container.innerHTML = '';
    }
  });

  // After rendering, set the search input value safely and focus if needed
  setTimeout(() => {
    const input = document.getElementById('searchInput');
    if (input) input.value = currentFilters.search || '';
  }, 0);
}

function renderListingCard(listing) {
  const hood = NEIGHBORHOODS.find(n => n.id === listing.neighborhood);
  const reviews = REVIEWS.filter(r => r.listingId === listing.id);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
  const isFav = favorites.includes(listing.id);

  return `
    <div class="listing-card" onclick="switchView('detail', ${listing.id})">
      <div class="listing-img" style="background-image:url('${listing.image}')">
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite(${listing.id})">
          ${isFav ? '❤️' : '🤍'}
        </button>
        ${listing.roommate ? '<span class="tag roommate-tag">👥 Roommate</span>' : ''}
        <span class="tag price-tag">$${listing.price.toLocaleString()}/mo</span>
      </div>
      <div class="listing-body">
        <div class="listing-title">${listing.title}</div>
        <div class="listing-meta">${listing.bedrooms === 0 ? 'Studio' : listing.bedrooms + 'bd'} · ${listing.bathrooms}ba · ${listing.sqft} sqft</div>
        <div class="listing-location">📍 ${hood.name}, ${hood.city}</div>
        <div class="listing-footer">
          <div class="safety-badge sm" style="background:${hood.color}15;color:${hood.color}">🛡️ ${hood.safetyScore}</div>
          ${avgRating ? `<div class="review-badge">⭐ ${avgRating} (${reviews.length})</div>` : ''}
          ${listing.pets ? '<span class="pet-badge">🐾</span>' : ''}
        </div>
      </div>
    </div>
  `;
}

function renderLiveListingCard(listing) {
  const placeholderImg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" fill="%23e2e8f0"><rect width="400" height="250"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-size="16">No Photo</text></svg>');
  const img = listing.image || placeholderImg;
  const beds = listing.bedrooms === 0 ? 'Studio' : listing.bedrooms != null ? `${listing.bedrooms}bd` : '?bd';
  const baths = listing.bathrooms != null ? `${listing.bathrooms}ba` : '';
  const sqft = listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : '';
  const meta = [beds, baths, sqft].filter(Boolean).join(' · ');

  return `
    <div class="listing-card" onclick="window.open('${listing.href || '#'}', '_blank')">
      <div class="listing-img" style="background-image:url('${img}')">
        ${listing.pets ? '<span class="tag roommate-tag" style="background:#10b981">🐾 Pets OK</span>' : ''}
        <span class="tag price-tag">$${listing.price.toLocaleString()}/mo</span>
      </div>
      <div class="listing-body">
        <div class="listing-title">${listing.title}</div>
        <div class="listing-meta">${meta}</div>
        <div class="listing-location">📍 ${listing.address || `${listing.city}, ${listing.state}`}</div>
        <div class="listing-footer">
          ${listing.photoCount ? `<span class="review-badge">📷 ${listing.photoCount} photos</span>` : ''}
          <span class="review-badge" style="color:#10b981;font-weight:600">View on Realtor.com →</span>
        </div>
      </div>
    </div>
  `;
}

// ── Detail View ──

function renderDetail(listingId) {
  const listing = LISTINGS.find(l => l.id === listingId);
  if (!listing) return;
  const hood = NEIGHBORHOODS.find(n => n.id === listing.neighborhood);
  const reviews = REVIEWS.filter(r => r.listingId === listing.id);
  const mockSchools = SCHOOLS.filter(s => s.neighborhood === listing.neighborhood);
  const crime = CRIME_DATA[listing.neighborhood];
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 'N/A';
  const isFav = favorites.includes(listing.id);

  // Start fetching live data in background
  fetchLiveSchools(listing.neighborhood).then(liveSchools => {
    const schoolsContainer = document.getElementById('tab-schools');
    if (schoolsContainer && liveSchools && liveSchools.length > 0) {
      schoolsContainer.innerHTML = `
        <div class="live-badge">🟢 Live data from SchoolDigger API</div>
        <h3>Nearby Schools in ${hood.city}</h3>
        ${liveSchools.map(s => `
          <div class="school-card">
            <div class="school-rating ${s.rating >= 4 ? 'high' : s.rating >= 2.5 ? 'mid' : s.rating ? 'low' : 'mid'}">${s.rating ? '★'.repeat(s.rating) : '—'}</div>
            <div class="school-info">
              <div class="school-name">${s.name}</div>
              <div class="school-meta">${s.type} · Grades ${s.grades}${s.enrollment ? ` · ${s.enrollment.toLocaleString()} students` : ''}${s.rankPercentile ? ` · Top ${(100 - s.rankPercentile).toFixed(0)}%` : ''}</div>
              ${s.district ? `<div class="school-meta">${s.district}</div>` : ''}
            </div>
          </div>
        `).join('')}
        <div style="font-size:11px;color:#94a3b8;margin-top:12px;text-align:center">Data from SchoolDigger.com · Ratings: ★-★★★★★</div>
      `;
    }
  });

  fetchLiveCrime('WA').then(liveCrime => {
    const crimeContainer = document.getElementById('tab-safety');
    if (crimeContainer && liveCrime) {
      const pop = liveCrime.population || 1;
      const vRate = ((liveCrime.violent?.total || 0) / pop * 1000).toFixed(1);
      const pRate = ((liveCrime.property?.total || 0) / pop * 1000).toFixed(1);

      const liveSection = document.getElementById('live-crime-section');
      if (liveSection) {
        liveSection.innerHTML = `
          <div class="live-badge">🟢 Live data from FBI Crime Data API (${liveCrime.year || 'latest'})</div>
          <h4>Washington State Crime Overview</h4>
          <div class="crime-bar-row">
            <span class="crime-type">Violent</span>
            <div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${Math.min(vRate/8*100,100)}%;background:#ef4444"></div></div>
            <span class="crime-count">${vRate}/1k</span>
          </div>
          <div class="crime-bar-row">
            <span class="crime-type">Property</span>
            <div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${Math.min(pRate/40*100,100)}%;background:#f59e0b"></div></div>
            <span class="crime-count">${pRate}/1k</span>
          </div>
          ${liveCrime.violent?.assault ? `<div class="crime-bar-row"><span class="crime-type">Assault</span><div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${Math.min(liveCrime.violent.assault/pop*1000/5*100,100)}%;background:#ef4444"></div></div><span class="crime-count">${(liveCrime.violent.assault/pop*1000).toFixed(1)}/1k</span></div>` : ''}
          ${liveCrime.property?.burglary ? `<div class="crime-bar-row"><span class="crime-type">Burglary</span><div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${Math.min(liveCrime.property.burglary/pop*1000/10*100,100)}%;background:#f59e0b"></div></div><span class="crime-count">${(liveCrime.property.burglary/pop*1000).toFixed(1)}/1k</span></div>` : ''}
          ${liveCrime.property?.motorVehicleTheft ? `<div class="crime-bar-row"><span class="crime-type">Vehicle Theft</span><div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${Math.min(liveCrime.property.motorVehicleTheft/pop*1000/8*100,100)}%;background:#f59e0b"></div></div><span class="crime-count">${(liveCrime.property.motorVehicleTheft/pop*1000).toFixed(1)}/1k</span></div>` : ''}
        `;
      }
    }
  });

  document.getElementById('view-detail').innerHTML = `
    <div class="detail-header">
      <button class="back-btn" onclick="switchView('${previousView}')">← Back</button>
      <button class="fav-btn-detail ${isFav ? 'active' : ''}" onclick="toggleFavorite(${listing.id});renderDetail(${listing.id})">
        ${isFav ? '❤️ Saved' : '🤍 Save'}
      </button>
    </div>

    <div class="detail-gallery">
      <div class="gallery-scroll">
        ${listing.images.map(img => `<img src="${img}" alt="${listing.title}" />`).join('')}
      </div>
    </div>

    <div class="detail-info">
      <div class="detail-price">$${listing.price.toLocaleString()}<span>/month</span></div>
      <h2 class="detail-title">${listing.title}</h2>
      <div class="detail-address">📍 ${listing.address}</div>
      <div class="detail-specs">
        <span>${listing.bedrooms === 0 ? 'Studio' : listing.bedrooms + ' Bed'}</span>
        <span>${listing.bathrooms} Bath</span>
        <span>${listing.sqft} sqft</span>
        <span>${listing.type}</span>
      </div>
      <p class="detail-desc">${listing.description}</p>

      <div class="detail-amenities">
        <h3>Amenities</h3>
        <div class="amenity-list">
          ${listing.amenities.map(a => `<span class="amenity-chip">${a}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="detail-tabs">
      <button class="detail-tab active" onclick="showDetailTab('safety')">🛡️ Safety</button>
      <button class="detail-tab" onclick="showDetailTab('schools')">🏫 Schools</button>
      <button class="detail-tab" onclick="showDetailTab('reviews')">⭐ Reviews</button>
    </div>

    <div id="detail-tab-content">
      <div id="tab-safety" class="tab-panel active">
        <div class="safety-overview">
          <div class="safety-score-big" style="background:${hood.color}">
            <div class="score-number">${hood.safetyScore}</div>
            <div class="score-label">Safety Score</div>
          </div>
          <div class="safety-details">
            <div class="safety-row"><span>Crime Level</span><span class="safety-val" style="color:${hood.color}">${hood.crimeRate}</span></div>
            <div class="safety-row"><span>Trend</span><span class="safety-val trend-${crime.trend}">${crime.trend === 'decreasing' ? '📉 Decreasing' : crime.trend === 'increasing' ? '📈 Increasing' : '➡️ Stable'}</span></div>
            <div class="safety-row"><span>Violent (per 1k)</span><span class="safety-val">${crime.violent}</span></div>
            <div class="safety-row"><span>Property (per 1k)</span><span class="safety-val">${crime.property}</span></div>
          </div>
        </div>
        <div class="crime-breakdown">
          <h4>Crime Breakdown (per 1,000 residents)</h4>
          ${Object.entries(crime.details).map(([type, count]) => `
            <div class="crime-bar-row">
              <span class="crime-type">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
              <div class="crime-bar-bg"><div class="crime-bar-fill" style="width:${(count/40)*100}%;background:${hood.color}"></div></div>
              <span class="crime-count">${count}</span>
            </div>
          `).join('')}
        </div>
        <div id="live-crime-section" style="margin-top:20px">
          <div class="loading-hint">⏳ Loading live FBI crime data...</div>
        </div>
      </div>

      <div id="tab-schools" class="tab-panel">
        <div class="loading-hint">⏳ Loading live school data...</div>
        <h3>Nearby Schools</h3>
        ${mockSchools.length ? mockSchools.map(s => `
          <div class="school-card">
            <div class="school-rating ${s.rating >= 8 ? 'high' : s.rating >= 6 ? 'mid' : 'low'}">${s.rating}</div>
            <div class="school-info">
              <div class="school-name">${s.name}</div>
              <div class="school-meta">${s.type} · ${s.distance}</div>
            </div>
          </div>
        `).join('') : '<div class="empty-state">No school data available for this area.</div>'}
      </div>

      <div id="tab-reviews" class="tab-panel">
        <div class="reviews-summary">
          <div class="reviews-avg">⭐ ${avgRating}</div>
          <div class="reviews-count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div>
          <div class="landlord-rating">Landlord: ${'⭐'.repeat(Math.round(listing.landlordRating))} ${listing.landlordRating}</div>
        </div>
        ${reviews.length ? reviews.map(r => `
          <div class="review-card">
            <div class="review-header">
              <div class="review-author">${r.author}</div>
              <div class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
              <div class="review-date">${new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
            </div>
            <p class="review-text">${r.text}</p>
            <div class="review-tags">
              ${r.pros.map(p => `<span class="tag-pro">👍 ${p}</span>`).join('')}
              ${r.cons.map(c => `<span class="tag-con">👎 ${c}</span>`).join('')}
            </div>
          </div>
        `).join('') : '<div class="empty-state">No reviews yet. Be the first to review!</div>'}
      </div>
    </div>

    <div class="detail-cta">
      <button class="cta-btn" onclick="alert('📞 Contact feature coming soon!')">📞 Contact Landlord</button>
      <button class="cta-btn secondary" onclick="alert('📅 Tour scheduling coming soon!')">📅 Schedule Tour</button>
    </div>
  `;
}

function showDetailTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  event.target.classList.add('active');
}

// ── Map View ──

function renderMap() {
  const filtered = getFilteredListings();
  document.getElementById('view-map').innerHTML = `
    <div class="map-container">
      <div class="map-placeholder">
        <div class="map-icon">🗺️</div>
        <h3>Map View</h3>
        <p>Interactive map requires Google Maps or Mapbox API key.</p>
        <p style="font-size:13px;color:#888;margin-top:8px">Below is a list view of all ${filtered.length} listings by location:</p>
      </div>
      <div class="map-list">
        ${NEIGHBORHOODS.map(n => {
          const nListings = filtered.filter(l => l.neighborhood === n.id);
          if (!nListings.length) return '';
          return `
            <div class="map-neighborhood">
              <div class="map-nb-header">
                <span class="map-nb-name">📍 ${n.name}, ${n.city}</span>
                <span class="safety-badge sm" style="background:${n.color}15;color:${n.color}">🛡️ ${n.safetyScore}</span>
              </div>
              ${nListings.map(l => `
                <div class="map-listing" onclick="switchView('detail', ${l.id})">
                  <span class="map-listing-price">$${l.price.toLocaleString()}</span>
                  <span class="map-listing-title">${l.title}</span>
                  <span class="map-listing-arrow">›</span>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ── Favorites ──

function renderFavorites() {
  const favListings = LISTINGS.filter(l => favorites.includes(l.id));

  document.getElementById('view-favorites').innerHTML = `
    <div class="fav-header">
      <h2>❤️ Saved Listings</h2>
      ${favListings.length > 1 ? `<button class="compare-btn" onclick="renderCompare()">⚖️ Compare</button>` : ''}
    </div>
    ${favListings.length ? `
      <div class="listing-list">
        ${favListings.map(l => renderListingCard(l)).join('')}
      </div>
    ` : `
      <div class="empty-state-big">
        <div class="empty-icon">🤍</div>
        <h3>No saved listings yet</h3>
        <p>Tap the heart on any listing to save it here.</p>
        <button class="cta-btn" onclick="switchView('search')">Browse Listings</button>
      </div>
    `}
    <div id="compare-section"></div>
  `;
}

function renderCompare() {
  const favListings = LISTINGS.filter(l => favorites.includes(l.id)).slice(0, 3);
  if (favListings.length < 2) return;

  document.getElementById('compare-section').innerHTML = `
    <div class="compare-table">
      <h3>⚖️ Side-by-Side Comparison</h3>
      <div class="compare-grid" style="grid-template-columns: 120px repeat(${favListings.length}, 1fr)">
        <div class="compare-label"></div>
        ${favListings.map(l => `<div class="compare-header">${l.title}</div>`).join('')}

        <div class="compare-label">Price</div>
        ${favListings.map(l => `<div class="compare-cell">$${l.price.toLocaleString()}/mo</div>`).join('')}

        <div class="compare-label">Beds/Bath</div>
        ${favListings.map(l => `<div class="compare-cell">${l.bedrooms === 0 ? 'Studio' : l.bedrooms + 'bd'}/${l.bathrooms}ba</div>`).join('')}

        <div class="compare-label">Sqft</div>
        ${favListings.map(l => `<div class="compare-cell">${l.sqft}</div>`).join('')}

        <div class="compare-label">Safety</div>
        ${favListings.map(l => {
          const h = NEIGHBORHOODS.find(n => n.id === l.neighborhood);
          return `<div class="compare-cell" style="color:${h.color};font-weight:600">${h.safetyScore}/10</div>`;
        }).join('')}

        <div class="compare-label">Schools</div>
        ${favListings.map(l => {
          const s = SCHOOLS.filter(sc => sc.neighborhood === l.neighborhood);
          const avg = s.length ? (s.reduce((a,sc) => a+sc.rating,0)/s.length).toFixed(1) : 'N/A';
          return `<div class="compare-cell">${avg}/10</div>`;
        }).join('')}

        <div class="compare-label">Reviews</div>
        ${favListings.map(l => {
          const r = REVIEWS.filter(rv => rv.listingId === l.id);
          const avg = r.length ? (r.reduce((a,rv) => a+rv.rating,0)/r.length).toFixed(1) : 'N/A';
          return `<div class="compare-cell">⭐ ${avg}</div>`;
        }).join('')}

        <div class="compare-label">Pets</div>
        ${favListings.map(l => `<div class="compare-cell">${l.pets ? '✅' : '❌'}</div>`).join('')}
      </div>
    </div>
  `;
}

// ── Helpers ──

function getFilteredListings() {
  return LISTINGS.filter(l => {
    const hood = NEIGHBORHOODS.find(n => n.id === l.neighborhood);

    // Flexible search: split query into tokens and require that each token appears
    // in either the title, address, neighborhood name, or city.
    if (currentFilters.search) {
      const q = currentFilters.search.trim().toLowerCase();
      if (q.length) {
        const tokens = q.split(/\s+/).filter(Boolean);
        const haystack = [l.title, l.address, hood.name, hood.city].join(' ').toLowerCase();
        const allMatch = tokens.every(t => haystack.includes(t));
        if (!allMatch) return false;
      }
    }

    if (l.price > currentFilters.maxPrice) return false;
    if (currentFilters.bedrooms !== 'any') {
      const beds = parseInt(currentFilters.bedrooms);
      if (beds === 3 ? l.bedrooms < 3 : l.bedrooms !== beds) return false;
    }
    if (currentFilters.pets && !l.pets) return false;
    if (currentFilters.roommate && !l.roommate) return false;
    if (currentFilters.city !== 'all' && hood.city.toLowerCase().trim() !== String(currentFilters.city).toLowerCase().trim()) return false;
    return true;
  });
}

function updateFilter(key, value) {
  currentFilters[key] = (typeof value === 'string') ? value.trim() : value;
  // Update price label if that's what changed
  if (key === 'maxPrice') {
    const label = document.querySelector('.price-filter strong');
    if (label) label.textContent = `$${value.toLocaleString()}`;
  }
  // If changing the city, re-render the whole listings view so the select/options stay in sync.
  if (key === 'city' && currentView === 'search') {
    renderListings();
  } else {
    updateListingResults();
  }

  console.debug('Filters updated', currentFilters);
}

function toggleFilter(key) {
  currentFilters[key] = !currentFilters[key];
  renderListings();
}

// Only re-render the results list, not the entire view (preserves input focus)
let searchDebounceTimer = null;

function handleSearchInput(value) {
  currentFilters.search = value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // If the user typed a city name, sync the city filter (only if user hasn't chosen a city)
    const detectedCity = detectCityFromQuery(currentFilters.search);
    if (detectedCity && currentFilters.city === 'all') currentFilters.city = detectedCity;
    updateListingResults();
    // Restore focus to search input after DOM update
    const input = document.getElementById('searchInput');
    if (input) {
      input.focus();
      // Place cursor at end of text
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }, 300);
}

// Called by hero search and search button — navigates to search view and focuses input
function doSearch(query) {
  currentFilters.search = (query || '').trim();
  // If the query matches a known city and no explicit city is selected, set the city filter
  const detectedCity = detectCityFromQuery(currentFilters.search);
  if (detectedCity && currentFilters.city === 'all') currentFilters.city = detectedCity;
  switchView('search');
  // Small delay to let the view render, then sync input and run search
  setTimeout(() => {
    const input = document.getElementById('searchInput');
    if (input) {
      input.value = currentFilters.search;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    updateListingResults();
  }, 80);
}

function detectCityFromQuery(q) {
  if (!q) return null;
  const cities = [...new Set(NEIGHBORHOODS.map(n => n.city))];
  // Remove punctuation and common state abbreviations, then normalize
  let norm = q.trim().toLowerCase();
  norm = norm.replace(/[,\.]/g, ''); // strip punctuation
  norm = norm.replace(/\bwa\b|\bwa\.?$|\bwashington\b/gi, '').trim();
  // Exact match first
  const exact = cities.find(c => c.toLowerCase() === norm);
  if (exact) return exact;
  // If query contains a city token, match it
  const tokens = norm.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const match = cities.find(c => c.toLowerCase() === t);
    if (match) return match;
  }
  return null;
}

function updateListingResults() {
  const filtered = getFilteredListings();
  const resultsCount = document.querySelector('.results-count');
  const listingList = document.querySelector('#view-search .listing-list');
  if (resultsCount) resultsCount.textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''} found`;
  if (listingList) {
    listingList.innerHTML = filtered.length
      ? filtered.map(l => renderListingCard(l)).join('')
      : '<div class="empty-state">😕 No listings match your filters. Try adjusting them!</div>';
  }
}

function filterByNeighborhood(id) {
  const hood = NEIGHBORHOODS.find(n => n.id === id);
  if (hood) {
    currentFilters.city = hood.city;
    currentFilters.search = hood.name;
  }
  switchView('search');
}

function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx > -1) favorites.splice(idx, 1);
  else favorites.push(id);
  localStorage.setItem('safenest-favorites', JSON.stringify(favorites));

  if (currentView === 'home') renderHome();
  if (currentView === 'search') renderListings();
  if (currentView === 'favorites') renderFavorites();
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  renderHome();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
