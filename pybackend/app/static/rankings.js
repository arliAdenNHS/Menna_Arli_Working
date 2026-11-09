// Rankings Page Logic (Connected to OpenBookRank external API + Local Reviews)
document.addEventListener('DOMContentLoaded', () => {
  const categoryTabs = document.getElementById('category-tabs');
  const rankingsList = document.getElementById('rankings-list');
  const currentCategoryName = document.getElementById('current-category-name');
  const currentApiEndpoint = document.getElementById('current-api-endpoint');
  const totalCountBadge = document.getElementById('total-count-badge');
  const searchInput = document.getElementById('search-input');
  const alertBanner = document.getElementById('alert-banner');

  let currentCategory = 'fantasy';
  let allBooksInCategory = [];

  // Parse category from URL query or path
  const urlParams = new URLSearchParams(window.location.search);
  const paramCategory = urlParams.get('category');
  if (paramCategory) {
    currentCategory = paramCategory.toLowerCase();
  } else {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === 'rankings') {
      currentCategory = pathParts[1].toLowerCase();
    }
  }

  // Set active tab
  updateActiveTabUI(currentCategory);
  loadRankings(currentCategory);

  // Category tab click
  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    const cat = btn.dataset.category;
    if (cat && cat !== currentCategory) {
      currentCategory = cat;
      updateActiveTabUI(currentCategory);
      window.history.pushState({}, '', `?category=${currentCategory}`);
      loadRankings(currentCategory);
    }
  });

  // Client-side search filter
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderBooks(allBooksInCategory.slice(0, 50));
      return;
    }
    const filtered = allBooksInCategory.filter((b) => {
      const title = (b.title || '').toLowerCase();
      const author = (typeof b.author === 'string' ? b.author : b.author?.name || '').toLowerCase();
      return title.includes(query) || author.includes(query);
    });
    renderBooks(filtered.slice(0, 50));
  });

  function updateActiveTabUI(category) {
    document.querySelectorAll('.cat-tab').forEach((tab) => {
      const match = tab.dataset.category === category;
      tab.classList.toggle('active', match);
      tab.setAttribute('aria-selected', match ? 'true' : 'false');
    });
  }

  async function loadRankings(category) {
    currentCategoryName.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    currentApiEndpoint.textContent = `/api/v1/rankings/${category}.json`;
    rankingsList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Fetching category rankings from /api/v1/rankings/${category}.json (via OpenBookRank)...</p>
      </div>
    `;
    clearAlert();

    try {
      const res = await fetch(`/api/v1/rankings/${category}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load rankings (${res.status} ${res.statusText})`);
      }
      const data = await res.json();
      allBooksInCategory = data.items || data.books || [];
      totalCountBadge.textContent = data.count || allBooksInCategory.length;
      // Render top 50 books
      renderBooks(allBooksInCategory.slice(0, 50));
    } catch (err) {
      showAlert(`Error loading rankings: ${err.message}`, 'error');
      rankingsList.innerHTML = `
        <div class="empty-state">
          <p>⚠️ Unable to load rankings for category "${category}".</p>
        </div>
      `;
    }
  }

  function renderBooks(books) {
    if (books.length === 0) {
      rankingsList.innerHTML = `
        <div class="empty-state">
          <p>No books found for this category or search filter.</p>
        </div>
      `;
      return;
    }

    rankingsList.innerHTML = books
      .map((b) => {
        const medalClass = b.rank === 1 ? 'rank-gold' : b.rank === 2 ? 'rank-silver' : b.rank === 3 ? 'rank-bronze' : '';
        const authorName = typeof b.author === 'string' ? b.author : (b.author?.name || 'Unknown Author');
        const scoreVal = typeof b.score === 'object' ? b.score?.value : b.score;
        const confidenceVal = typeof b.score === 'object' ? b.score?.confidence : b.confidence;
        const confPercent = confidenceVal != null ? Math.round(confidenceVal * 100) : 90;

        // Cover fallback with OpenLibrary or curated placeholder
        const coverImg = 'https://openbookrank.com/covers/' + b.slug + '-m.webp';

        return `
          <article class="ranked-card ${medalClass}">
            <div class="rank-badge-col">
              <span class="rank-number">#${b.rank}</span>
            </div>

            <div class="book-cover-col">
              <img
                src="${coverImg}"
                alt="${escapeHtml(b.title)} cover"
                loading="lazy"
                class="book-cover-img"
              />
            </div>

            <div class="book-info-col">
              <div class="book-header-line">
                <span class="category-pill">${escapeHtml(currentCategory)}</span>
                ${b.year ? `<span class="id-tag">Year: ${b.year}</span>` : ''}
              </div>

              <h2 class="book-title">
                <a href="/books/${b.slug}" class="book-title-link">${escapeHtml(b.title)}</a>
              </h2>
              <p class="book-author">by <strong>${escapeHtml(authorName)}</strong></p>

              <div class="scores-row">
              </div>
            </div>

            <div class="book-action-col">
              <a href="/books/${b.slug}" class="btn btn-primary btn-sm">View & Review &rarr;</a>            </div>
          </article>
        `;
      })
      .join('');
  }

  function showAlert(msg, type = 'error') {
    alertBanner.textContent = msg;
    alertBanner.className = `alert-banner alert-${type}`;
    alertBanner.classList.remove('hidden');
  }

  function clearAlert() {
    alertBanner.textContent = '';
    alertBanner.className = 'alert-banner hidden';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
