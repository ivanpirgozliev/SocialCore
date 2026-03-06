/**
 * SocialCore - Saved Posts Page
 */

import { showToast, formatRelativeTime, getStoredUser, refreshStoredUserFromProfile, resolveAvatarUrl } from './main.js';
import { getSavedPostsFeed, unsavePostForCurrentUser } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  initSavedPostsPage().catch((error) => {
    console.error('Failed to initialize saved posts page:', error);
    showToast('Failed to load saved posts.', 'error');
  });
});

async function initSavedPostsPage() {
  await initCurrentUserCard();
  await loadSavedPosts();
  initSavedPostsActions();

  window.addEventListener('socialcore:saved-posts:changed', async () => {
    await loadSavedPosts();
  });
}

async function initCurrentUserCard() {
  const user = (await refreshStoredUserFromProfile()) || getStoredUser();
  if (!user) return;

  const avatar = document.getElementById('savedPostsSidebarUserAvatar');
  const name = document.getElementById('savedPostsSidebarUserName');
  const username = document.getElementById('savedPostsSidebarUserUsername');

  if (avatar) {
    avatar.src = resolveAvatarUrl(user, user.avatar);
  }

  if (name) {
    name.textContent = user.name || user.full_name || 'User';
  }

  if (username) {
    username.textContent = `@${user.username || 'user'}`;
  }
}

function initSavedPostsActions() {
  const feed = document.getElementById('savedPostsFeed');
  if (!feed) return;

  feed.addEventListener('click', async (event) => {
    const actionBtn = event.target.closest('[data-action="unsave-post"]');
    if (!actionBtn) return;

    event.preventDefault();

    const postCard = actionBtn.closest('.post-card');
    const postId = postCard?.dataset.postId || actionBtn.dataset.postId;
    if (!postId) return;

    actionBtn.disabled = true;

    try {
      await unsavePostForCurrentUser(postId);
      postCard?.remove();
      showToast('Post removed from saved.', 'info');
      ensureEmptyStateIfNeeded();
    } catch (error) {
      console.error('Failed to remove saved post:', error);
      showToast('Failed to remove saved post.', 'error');
      actionBtn.disabled = false;
      return;
    }

    actionBtn.disabled = false;
  });
}

function ensureEmptyStateIfNeeded() {
  const feed = document.getElementById('savedPostsFeed');
  if (!feed) return;

  const cards = feed.querySelectorAll('.post-card');
  if (cards.length > 0) return;

  feed.innerHTML = buildEmptySavedPostsHtml();
}

async function loadSavedPosts() {
  const feed = document.getElementById('savedPostsFeed');
  if (!feed) return;

  feed.innerHTML = `
    <div class="card text-center py-4">
      <div class="card-body text-muted">
        <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading saved posts...
      </div>
    </div>
  `;

  try {
    const savedPosts = await getSavedPostsFeed();

    if (!savedPosts.length) {
      feed.innerHTML = buildEmptySavedPostsHtml();
      return;
    }

    const cardsHtml = savedPosts
      .map((post) => buildSavedPostCardHtml(post, post?.saved_at))
      .join('');

    feed.innerHTML = cardsHtml;
  } catch (error) {
    console.error('Failed to load saved posts:', error);
    feed.innerHTML = `
      <div class="card text-center py-5">
        <div class="card-body">
          <i class="bi bi-exclamation-triangle fs-1 text-warning mb-3 d-block"></i>
          <h5 class="text-muted">Could not load saved posts</h5>
          <p class="text-muted mb-3">Please refresh and try again.</p>
          <button type="button" class="btn btn-outline-primary" id="retrySavedPostsBtn">
            <i class="bi bi-arrow-clockwise me-2"></i>Retry
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('retrySavedPostsBtn');
    retryBtn?.addEventListener('click', () => {
      loadSavedPosts().catch((reloadError) => {
        console.error('Retry failed:', reloadError);
      });
    }, { once: true });
  }
}

function buildSavedPostCardHtml(post, savedAt) {
  const fullName = post?.profiles?.full_name || post?.profiles?.username || 'User';
  const username = post?.profiles?.username || 'user';
  const avatarUrl = resolveAvatarUrl(post?.profiles, post?.profiles?.avatar_url);
  const postId = String(post?.id || '');
  const profileHref = post?.profiles?.id
    ? `profile.html?id=${encodeURIComponent(post.profiles.id)}`
    : 'profile.html';

  const createdAtLabel = post?.created_at ? formatRelativeTime(post.created_at) : 'recently';
  const savedAtLabel = savedAt ? formatRelativeTime(new Date(savedAt)) : 'recently';

  const commentsCount = Number.isFinite(post?.comments_count) ? post.comments_count : 0;
  const reactionsCount = Number.isFinite(post?.likes_count) ? post.likes_count : 0;

  return `
    <article class="post-card" data-post-id="${escapeHtml(postId)}">
      <div class="post-header">
        <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
          <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="post-avatar" loading="lazy">
        </a>
        <div>
          <a href="${escapeHtml(profileHref)}" class="post-author text-decoration-none">${escapeHtml(fullName)}</a>
          <div class="post-time">@${escapeHtml(username)} · ${escapeHtml(createdAtLabel)}</div>
          <div class="saved-post-meta">Saved ${escapeHtml(savedAtLabel)}</div>
        </div>
        <div class="ms-auto">
          <button class="btn btn-link text-muted p-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-three-dots"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <button type="button" class="dropdown-item" data-action="unsave-post" data-post-id="${escapeHtml(postId)}">
                <i class="bi bi-bookmark-x me-2"></i>Remove From Saved
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div class="post-content">
        ${buildPostContentHtml(post?.content || '')}
      </div>

      ${post?.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="Post image" class="post-image" loading="lazy">` : ''}

      <div class="saved-post-actions d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="text-muted small">
          <i class="bi bi-heart me-1"></i>${Math.max(0, reactionsCount)} reactions
          <span class="mx-2">•</span>
          <i class="bi bi-chat me-1"></i>${Math.max(0, commentsCount)} comments
        </div>
        <div class="d-flex gap-2">
          <a href="${escapeHtml(profileHref)}" class="btn btn-outline-primary btn-sm">
            <i class="bi bi-person me-1"></i>View Author
          </a>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="unsave-post" data-post-id="${escapeHtml(postId)}">
            <i class="bi bi-bookmark-x me-1"></i>Unsave
          </button>
        </div>
      </div>
    </article>
  `;
}

function buildPostContentHtml(content) {
  const html = formatPostContentHtml(content);
  if (!html) {
    return '<p class="text-muted mb-0">(No text content)</p>';
  }

  return `<p class="mb-0">${html}</p>`;
}

function buildEmptySavedPostsHtml() {
  return `
    <div class="card text-center py-5">
      <div class="card-body">
        <i class="bi bi-bookmark fs-1 text-muted mb-3 d-block"></i>
        <h5 class="text-muted">No saved posts yet</h5>
        <p class="text-muted mb-3">Use the post menu in Feed or Profile and click Save Post.</p>
        <a href="feed.html" class="btn btn-primary-gradient create-post-match-add-friend">
          <i class="bi bi-house-door me-2"></i>Go to Feed
        </a>
      </div>
    </div>
  `;
}

function formatPostContentHtml(content) {
  const raw = String(content || '');
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(urlRegex)) {
    const index = match.index ?? 0;
    const urlText = match[0] || '';

    if (index > lastIndex) {
      parts.push(escapeHtml(raw.slice(lastIndex, index)));
    }

    const safeUrl = normalizeExternalUrl(urlText);
    if (safeUrl) {
      const label = escapeHtml(getDisplayUrlText(safeUrl));
      parts.push(`<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="post-link">${label}</a>`);
    } else {
      parts.push(escapeHtml(urlText));
    }

    lastIndex = index + urlText.length;
  }

  if (lastIndex < raw.length) {
    parts.push(escapeHtml(raw.slice(lastIndex)));
  }

  return parts.join('').replace(/\n/g, '<br>');
}

function normalizeExternalUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function getDisplayUrlText(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return String(url).replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
