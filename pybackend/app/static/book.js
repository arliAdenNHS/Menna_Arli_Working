// Book Detail & Review Page Logic (OpenBookRank external data + Local MySQL Reviews)
document.addEventListener('DOMContentLoaded', () => {
  const alertBanner = document.getElementById('alert-banner');
  const bookLoading = document.getElementById('book-loading');
  const bookContent = document.getElementById('book-content');
  const bookTitle = document.getElementById('book-title');
  const bookAuthor = document.getElementById('book-author');
  const bookCoverImg = document.getElementById('book-cover-img');
  const bookRankBadge = document.getElementById('book-rank-badge');
  const bookCategoryBadge = document.getElementById('book-category-badge');
  const bookScore = document.getElementById('book-score');
  const bookConfidence = document.getElementById('book-confidence');
  const bookReviewsCount = document.getElementById('book-reviews-count');
  const bookDescription = document.getElementById('book-description');
  const bookIdentifiersList = document.getElementById('book-identifiers-list');
  const bookApiLink = document.getElementById('book-api-link');
  const breadcrumbCurrentBook = document.getElementById('breadcrumb-current-book');
  const backToRankings = document.getElementById('back-to-rankings');

  const similarBooksSection = document.getElementById('similar-books-section');
  const similarBooksGrid = document.getElementById('similar-books-grid');

  const reviewForm = document.getElementById('review-form');
  const starWidget = document.getElementById('star-widget');
  const starRatingText = document.getElementById('star-rating-text');
  const selectedRatingInput = document.getElementById('selected-rating');
  const reviewerNameInput = document.getElementById('reviewer-name');
  const reviewCommentInput = document.getElementById('review-comment');
  const btnSubmitReview = document.getElementById('btn-submit-review');
  const reviewsList = document.getElementById('reviews-list');
  const feedReviewsCount = document.getElementById('feed-reviews-count');

  const ratingLabels = {
    1: '1 Star - Poor',
    2: '2 Stars - Fair',
    3: '3 Stars - Good',
    4: '4 Stars - Very Good',
    5: '5 Stars - Masterpiece',
  };

  let currentSlug = '';
  let selectedRating = 5;

  // Determine slug from URL
  const urlParams = new URLSearchParams(window.location.search);
  const querySlug = urlParams.get('slug');
  if (querySlug) {
    currentSlug = querySlug.toLowerCase();
  } else {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === 'books') {
      currentSlug = pathParts[1].toLowerCase();
    }
  }

  if (!currentSlug) {
    currentSlug = 'the-name-of-the-wind'; // default fallback
  }

  // Pre-fill reviewer name if logged in
  prefillUserSession();

  // Setup star rating widget
  setupStarWidget();

  // Load book data
  loadBookData(currentSlug);

  // Review submission
  reviewForm.addEventListener('submit', handleReviewSubmit);

  function prefillUserSession() {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((user) => {
          if (user && user.email) {
            const name = user.email.split('@')[0];
            reviewerNameInput.value = name.charAt(0).toUpperCase() + name.slice(1);
          }
        })
        .catch(() => { });
    }
  }

  function setupStarWidget() {
    const starBtns = starWidget.querySelectorAll('.star-btn');
    setStarRating(5);

    starBtns.forEach((btn) => {
      const val = parseInt(btn.dataset.value, 10);
      btn.addEventListener('mouseenter', () => highlightStars(val));
      btn.addEventListener('mouseleave', () => highlightStars(selectedRating));
      btn.addEventListener('click', () => setStarRating(val));
    });
  }

  function setStarRating(val) {
    selectedRating = val;
    selectedRatingInput.value = val;
    starRatingText.textContent = ratingLabels[val] || `${val} Stars`;
    highlightStars(val);
  }

  function highlightStars(val) {
    const starBtns = starWidget.querySelectorAll('.star-btn');
    starBtns.forEach((btn) => {
      const btnVal = parseInt(btn.dataset.value, 10);
      btn.classList.toggle('active', btnVal <= val);
    });
  }

  async function loadBookData(slug) {
    bookLoading.classList.remove('hidden');
    bookContent.classList.add('hidden');
    clearAlert();

    const apiEndpoint = `/api/v1/books/${slug}.json`;

    try {
      const res = await fetch(apiEndpoint);
      if (!res.ok) {
        throw new Error(`Book not found on OpenBookRank (Status: ${res.status})`);
      }
      const book = await res.json();
      renderBookDetail(book);
    } catch (err) {
      bookLoading.classList.add('hidden');
      showAlert(`Error: ${err.message}`, 'error');
    }
  }

  function renderBookDetail(book) {
    bookLoading.classList.add('hidden');
    bookContent.classList.remove('hidden');

    document.title = `${book.title} - Book Review API`;

    // Author
    const authorName = typeof book.author === 'string' ? book.author : (book.author?.name || 'Unknown Author');

    // Breadcrumb
    breadcrumbCurrentBook.textContent = book.title;
    const primaryRank = (book.ranks && book.ranks.length > 0) ? book.ranks[0] : null;
    const categoryName = primaryRank?.name || primaryRank?.category || 'General';
    const categorySlug = primaryRank?.category || 'fantasy';
    backToRankings.href = `/rankings?category=${encodeURIComponent(categorySlug)}`;

    bookTitle.textContent = book.title;
    bookAuthor.textContent = `by ${authorName} ${book.year ? `(${book.year})` : ''}`;

    // Cover Image from OpenBookRank
    const slug = book.slug || currentSlug;
    bookCoverImg.src = 'https://openbookrank.com/covers/' + slug + '-m.webp';
    bookCoverImg.onerror = () => {
      bookCoverImg.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80';
    };
    bookCoverImg.alt = `${book.title} Cover`;

    // Badges
    if (primaryRank) {
      bookRankBadge.textContent = `#${primaryRank.rank} in ${primaryRank.name || primaryRank.category}`;
      bookRankBadge.classList.remove('hidden');
    } else {
      bookRankBadge.classList.add('hidden');
    }
    bookCategoryBadge.textContent = categoryName;

    // Scores (OpenBookRank score format: { value: 8.9, scale: 10, confidence: 0.965, ratings: 4080 })
    const scoreVal = typeof book.score === 'object' ? book.score?.value : book.score;
    const confVal = typeof book.score === 'object' ? book.score?.confidence : book.confidence;
    const scaleVal = typeof book.score === 'object' ? (book.score?.scale || 10) : 10;
    const ratingsCount = typeof book.score === 'object' ? (book.score?.ratings || 0) : 0;

    bookReviewsCount.textContent = (book.reviews ? book.reviews.length : 0);

    // Description / Citation
    const descriptionText = book.citation || book.description || (
      `"${book.title}" by ${authorName}. ${ratingsCount ? `Based on ${ratingsCount.toLocaleString()} external ratings with ${Math.round((confVal || 0.9) * 100)}% statistical confidence.` : ''}`
    );
    bookDescription.textContent = descriptionText;

    // Identifiers
    bookIdentifiersList.innerHTML = '';
    if (book.identifiers && Object.keys(book.identifiers).length > 0) {
      Object.entries(book.identifiers).forEach(([k, v]) => {
        if (typeof v === 'string') {
          const span = document.createElement('span');
          span.className = 'id-tag';
          span.textContent = `${k.toUpperCase()}: ${v}`;
          bookIdentifiersList.appendChild(span);
        }
      });
    }

    // Direct JSON link
    bookApiLink.href = `/api/v1/books/${book.slug}.json`;
    bookApiLink.textContent = `/api/v1/books/${book.slug}.json ↗`;

    // Similar Books (OpenBookRank returns .similar: [{ id, title, author, score, api }])
    renderSimilarBooks(book.similar || book.similar_books);

    // Reviews list (local reviews stored in MySQL)
    renderReviews(book.reviews || []);
  }

  function renderSimilarBooks(similar) {
    if (!similar || similar.length === 0) {
      similarBooksSection.classList.add('hidden');
      return;
    }
    similarBooksSection.classList.remove('hidden');
    similarBooksGrid.innerHTML = similar
      .map((b) => {
        // extract slug from api or id or work
        const bSlug = b.slug || (b.id ? b.id.replace('obr:work:', '') : '') || (b.api ? b.api.split('/').pop().replace('.json', '') : '');
        const authorName = typeof b.author === 'string' ? b.author : (b.author?.name || 'Author');
        return `
          <a href="/books/${bSlug}" class="similar-card">
            <div class="similar-info">
              <h4 class="similar-title">${escapeHtml(b.title)}</h4>
              <p class="similar-author">${escapeHtml(authorName)}</p>
              <span class="similar-score">★ ${(b.score || 0).toFixed(1)}</span>
            </div>
          </a>
        `;
      })
      .join('');
  }

  function renderReviews(reviews) {
    feedReviewsCount.textContent = reviews.length;
    bookReviewsCount.textContent = reviews.length;

    if (reviews.length === 0) {
      reviewsList.innerHTML = `
        <div class="empty-reviews">
          <p>No reader reviews yet for this book in your database. Be the first to vote and leave a review!</p>
        </div>
      `;
      return;
    }

    reviewsList.innerHTML = reviews
      .map((r) => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const dateStr = r.created_at
          ? new Date(r.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          : 'Recent';

        return `
          <div class="review-item-card">
            <div class="review-item-header">
              <div class="reviewer-meta">
                <span class="reviewer-avatar">👤</span>
                <div>
                  <strong class="reviewer-name">${escapeHtml(r.reviewer_name)}</strong>
                  <span class="review-date">${dateStr}</span>
                </div>
              </div>
              <div class="review-stars-badge" title="${r.rating} out of 5 stars">
                ${stars}
              </div>
            </div>
            <p class="review-item-comment">${escapeHtml(r.comment)}</p>
          </div>
        `;
      })
      .join('');
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    clearAlert();

    const rating = parseInt(selectedRatingInput.value, 10);
    const comment = reviewCommentInput.value.trim();
    const reviewerName = reviewerNameInput.value.trim();

    if (!rating || rating < 1 || rating > 5) {
      showAlert('Please select a star rating from 1 to 5.');
      return;
    }
    if (!comment || comment.length < 3) {
      showAlert('Please enter a review of at least 3 characters.');
      return;
    }

    setButtonLoading(btnSubmitReview, true, 'Submit Review');

    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/v1/books/${currentSlug}/reviews`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          rating: rating,
          comment: comment,
          reviewer_name: reviewerName || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.detail
          ? (Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail)
          : 'Failed to submit review.';
        throw new Error(errorMsg);
      }

      showAlert('Thank you! Your vote and review have been saved in the database.', 'success');

      // Reset comment and reload
      reviewCommentInput.value = '';
      setStarRating(5);
      await loadBookData(currentSlug);
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setButtonLoading(btnSubmitReview, false, 'Submit Review');
    }
  }

  function setButtonLoading(button, isLoading, defaultText) {
    const textSpan = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    button.disabled = isLoading;
    if (isLoading) {
      textSpan.textContent = 'Submitting...';
      spinner.classList.remove('hidden');
    } else {
      textSpan.textContent = defaultText;
      spinner.classList.add('hidden');
    }
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
