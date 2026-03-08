/**
 * SocialCore - Saved Posts Page
 */

import { showToast, formatRelativeTime, getStoredUser, refreshStoredUserFromProfile, resolveAvatarUrl } from './main.js';
import { attachEmojiPicker, closeEmojiPicker, renderTwemoji } from './emoji-picker.js';
import { getSavedPostsFeed, unsavePostForCurrentUser, setPostReaction, clearPostReaction, getPostReactionState, createComment, getPostComments, setCommentReaction, clearCommentReaction, getCommentReactionState, updateComment, deleteComment } from './database.js';

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

const REACTION_OPTIONS = [
  { type: 'like', emoji: '👍', label: 'Like', icon: `${TWEMOJI_BASE}/1f44d.svg` },
  { type: 'love', emoji: '❤️', label: 'Love', icon: `${TWEMOJI_BASE}/2764.svg` },
  { type: 'haha', emoji: '😂', label: 'Haha', icon: `${TWEMOJI_BASE}/1f602.svg` },
  { type: 'wow', emoji: '😮', label: 'Wow', icon: `${TWEMOJI_BASE}/1f62e.svg` },
  { type: 'sad', emoji: '😢', label: 'Sad', icon: `${TWEMOJI_BASE}/1f622.svg` },
  { type: 'angry', emoji: '😡', label: 'Angry', icon: `${TWEMOJI_BASE}/1f621.svg` },
];

const REACTION_EMOJI_TO_TYPE = Object.fromEntries(REACTION_OPTIONS.map((option) => [option.emoji, option.type]));

const savedPostsCommentsModalState = {
  modalEl: null,
  activePostId: null,
};

let savedPostsCurrentUserId = null;

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

  savedPostsCurrentUserId = user.id || null;

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

  if (feed.dataset.reactionPopoverBound !== 'true') {
    feed.dataset.reactionPopoverBound = 'true';
    document.addEventListener('click', (event) => {
      if (event.target.closest('.reaction-control')) return;
      closeSavedPostsReactionPopovers(document);
    });
  }

  feed.addEventListener('click', async (event) => {
    const reactionOptionBtn = event.target.closest('[data-action="set-post-reaction"]');
    if (reactionOptionBtn && feed.contains(reactionOptionBtn)) {
      event.preventDefault();
      const postId = reactionOptionBtn.dataset.postId;
      const reactionType = reactionOptionBtn.dataset.reactionType;
      if (postId && reactionType) {
        await handleSavedPostReactionSelect(postId, reactionType, reactionOptionBtn.closest('.reaction-control'));
      }
      return;
    }

    const actionBtn = event.target.closest('[data-action="unsave-post"]');
    if (actionBtn && feed.contains(actionBtn)) {
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
      return;
    }

    const postActionBtn = event.target.closest('.saved-post-card__metric-btn');
    if (!postActionBtn || !feed.contains(postActionBtn)) return;

    const action = postActionBtn.dataset.action;
    const postCard = postActionBtn.closest('.post-card');
    const postId = postCard?.dataset.postId;
    if (!postId) return;

    if (action === 'react-post') {
      toggleSavedPostsReactionPopover(postActionBtn.closest('.reaction-control'));
      return;
    }

    if (action === 'comment') {
      openSavedPostCommentsModal(postCard, postId);
    }
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
  const commentClass = commentsCount > 0 ? 'has-comments' : '';
  const rawContent = String(post?.content || '');
  const primaryUrl = extractPrimaryExternalUrl(rawContent);
  const domainLabel = primaryUrl ? getDisplayUrlText(primaryUrl) : '';
  const contentText = stripUrlsFromText(rawContent);
  const cardTitle = truncateText(contentText || (domainLabel ? `Shared from ${domainLabel}` : 'Saved post'), 120);
  const cardExcerpt = contentText && contentText !== cardTitle ? truncateText(contentText, 190) : '';
  const postTypeLabel = primaryUrl ? 'Link' : post?.image_url ? 'Photo post' : 'Post';
  const previewMeta = domainLabel ? `${postTypeLabel} · ${domainLabel}` : postTypeLabel;

  return `
    <article class="post-card saved-post-card" data-post-id="${escapeHtml(postId)}">
      <div class="saved-post-card__layout">
        <div class="saved-post-card__media-column">
          ${post?.image_url ? `
            <img src="${escapeHtml(post.image_url)}" alt="Post image" class="saved-post-card__media" loading="lazy">
          ` : `
            <div class="saved-post-card__media saved-post-card__media--placeholder" aria-hidden="true">
              <i class="bi bi-bookmark-check"></i>
              <span>${escapeHtml(postTypeLabel)}</span>
            </div>
          `}
        </div>

        <div class="saved-post-card__body">
          <div class="saved-post-card__topbar">
            <div class="saved-post-card__meta-stack">
              <div class="saved-post-card__type-line">${escapeHtml(previewMeta)}</div>
              <div class="saved-post-card__saved-line">Saved ${escapeHtml(savedAtLabel)}</div>
            </div>
            <div class="dropdown">
              <button class="saved-post-card__icon-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Saved post actions">
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button type="button" class="dropdown-item" data-action="unsave-post" data-post-id="${escapeHtml(postId)}">
                    <i class="bi bi-bookmark-x me-2"></i>Remove From Saved
                  </button>
                </li>
                <li>
                  <a class="dropdown-item" href="${escapeHtml(profileHref)}">
                    <i class="bi bi-person me-2"></i>Open Author Profile
                  </a>
                </li>
                ${primaryUrl ? `
                  <li>
                    <a class="dropdown-item" href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener noreferrer">
                      <i class="bi bi-box-arrow-up-right me-2"></i>Open Link
                    </a>
                  </li>
                ` : ''}
              </ul>
            </div>
          </div>

          <div class="saved-post-card__content-block">
            <a href="${escapeHtml(profileHref)}" class="saved-post-card__title text-decoration-none">${escapeHtml(cardTitle)}</a>
            ${cardExcerpt ? `<p class="saved-post-card__excerpt mb-0">${escapeHtml(cardExcerpt)}</p>` : ''}
          </div>

          <div class="saved-post-card__source-row">
            <a href="${escapeHtml(profileHref)}" class="text-decoration-none flex-shrink-0">
              <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="saved-post-card__source-avatar" loading="lazy">
            </a>
            <div class="saved-post-card__source-copy">
              <div class="saved-post-card__source-line">
                Saved from <a href="${escapeHtml(profileHref)}" class="saved-post-card__source-link text-decoration-none">${escapeHtml(fullName)}</a>'s post
              </div>
              <div class="saved-post-card__source-subline">@${escapeHtml(username)} · ${escapeHtml(createdAtLabel)}</div>
            </div>
          </div>

          <div class="saved-post-card__footer">
            <div class="saved-post-card__engagement">
              ${buildReactionControlHtml({
                targetType: 'post',
                targetId: postId,
                count: reactionsCount,
                userReaction: post?.user_reaction || null,
                tooltip: post?.reaction_tooltip || 'No reactions yet',
                reactionCounts: post?.reaction_counts || {},
                reactors: post?.reactors || [],
                baseClass: 'post-action-btn saved-post-card__metric-btn',
              })}
              <button class="post-action-btn saved-post-card__metric-btn ${commentClass}" data-action="comment" type="button" aria-label="Comment">
                <i class="bi bi-chat-left-text"></i>
                <span>${Math.max(0, commentsCount)}</span>
              </button>
            </div>

            <div class="saved-post-card__actions">
              <a href="${escapeHtml(profileHref)}" class="saved-post-card__action-btn saved-post-card__action-btn--author">
                <i class="bi bi-person"></i>
                <span>View Author</span>
              </a>
              ${primaryUrl ? `
                <a href="${escapeHtml(primaryUrl)}" target="_blank" rel="noopener noreferrer" class="saved-post-card__icon-btn" aria-label="Open saved link">
                  <i class="bi bi-box-arrow-up-right"></i>
                </a>
              ` : ''}
              <button type="button" class="saved-post-card__icon-btn" data-action="unsave-post" data-post-id="${escapeHtml(postId)}" aria-label="Remove saved post">
                <i class="bi bi-bookmark-x"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
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

function reactionImg(typeOrEmoji, extraClass = '') {
  const type = REACTION_EMOJI_TO_TYPE[typeOrEmoji] || typeOrEmoji || 'like';
  const option = REACTION_OPTIONS.find((item) => item.type === type) || REACTION_OPTIONS[0];
  return `<img src="${option.icon}" alt="${option.emoji}" class="reaction-img ${extraClass}" draggable="false" loading="lazy">`;
}

function getReactionMeta(reactionType) {
  return REACTION_OPTIONS.find((option) => option.type === reactionType) || REACTION_OPTIONS[0];
}

function resolveDisplayedReactionType(userReaction = null, reactionCounts = {}, reactors = []) {
  if (userReaction) return userReaction;

  const topReaction = REACTION_OPTIONS
    .map((option) => ({ type: option.type, count: Number(reactionCounts?.[option.type]) || 0 }))
    .sort((first, second) => second.count - first.count)[0];

  if (topReaction?.count > 0) return topReaction.type;

  const firstReactorType = reactors.find((reactor) => reactor?.reaction_type || reactor?.reaction_emoji)?.reaction_type
    || reactors.find((reactor) => reactor?.reaction_type || reactor?.reaction_emoji)?.reaction_emoji;

  return firstReactorType || 'like';
}

function buildReactionPickerHtml({ targetType, targetId }) {
  return `
    <div class="reaction-picker" role="menu" aria-label="Choose reaction">
      ${REACTION_OPTIONS.map((option) => `
        <button
          type="button"
          class="reaction-option"
          data-action="set-${targetType}-reaction"
          data-${targetType}-id="${escapeHtml(String(targetId || ''))}"
          data-reaction-type="${escapeHtml(option.type)}"
          title="${escapeHtml(option.label)}"
          aria-label="${escapeHtml(option.label)}"
        >${reactionImg(option.type, 'reaction-picker-img')}</button>
      `).join('')}
    </div>
  `;
}

function buildReactionBreakdownHtml({ reactionCounts = {}, reactors = [] }) {
  const counts = REACTION_OPTIONS
    .map((option) => ({ ...option, count: Number(reactionCounts?.[option.type]) || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((first, second) => second.count - first.count);

  const summaryHtml = counts.length
    ? `<div class="reaction-breakdown-summary">${counts.map((entry) => `<span class="reaction-breakdown-chip" title="${escapeHtml(entry.label)}">${reactionImg(entry.type, 'reaction-chip-img')} ${entry.count}</span>`).join('')}</div>`
    : '<div class="reaction-breakdown-empty">No reactions yet</div>';

  const reactorsHtml = (reactors || []).length
    ? `<div class="reaction-breakdown-reactors">${reactors.slice(0, 8).map((reactor) => `<div class="reaction-breakdown-row"><span class="reaction-breakdown-emoji">${reactionImg(reactor.reaction_type || reactor.reaction_emoji || 'like', 'reaction-row-img')}</span><span>${escapeHtml(String(reactor.name || 'User'))}</span></div>`).join('')}</div>`
    : '';

  return `${summaryHtml}${reactorsHtml}`;
}

function buildReactionControlHtml({ targetType, targetId, count = 0, userReaction = null, tooltip = 'No reactions yet', reactionCounts = {}, reactors = [], baseClass = 'saved-post-card__metric-btn' }) {
  const displayedReactionType = resolveDisplayedReactionType(userReaction, reactionCounts, reactors);
  const reaction = getReactionMeta(displayedReactionType);
  const activeClass = userReaction ? 'liked' : '';
  const breakdownHtml = buildReactionBreakdownHtml({ reactionCounts, reactors });

  return `
    <div class="reaction-control">
      <button class="${baseClass} ${activeClass}" data-action="react-${targetType}" data-${targetType}-id="${escapeHtml(String(targetId || ''))}" data-user-reaction="${escapeHtml(String(userReaction || ''))}" title="${escapeHtml(tooltip)}" type="button" aria-label="React">
        <span class="reaction-emoji" aria-hidden="true">${reactionImg(reaction.type, 'reaction-btn-img')}</span>
        <span>${Math.max(0, Number(count) || 0)}</span>
      </button>
      <div class="reaction-breakdown" role="tooltip">
        ${breakdownHtml}
      </div>
      ${buildReactionPickerHtml({ targetType, targetId })}
    </div>
  `;
}

function closeSavedPostsReactionPopovers(scope = document) {
  scope.querySelectorAll('.reaction-control.is-open').forEach((control) => {
    control.classList.remove('is-open');
  });
}

function toggleSavedPostsReactionPopover(control) {
  if (!control) return;
  const shouldOpen = !control.classList.contains('is-open');
  closeSavedPostsReactionPopovers(document);
  if (shouldOpen) {
    control.classList.add('is-open');
  }
}

function updateSavedPostReactionControl(postCard, reactionState) {
  const reactionBtn = postCard?.querySelector('.saved-post-card__metric-btn[data-action="react-post"]');
  if (!reactionBtn) return;

  const emojiEl = reactionBtn.querySelector('.reaction-emoji');
  const countEl = reactionBtn.querySelector('span:last-child');
  const displayedReactionType = resolveDisplayedReactionType(
    reactionState?.user_reaction || null,
    reactionState?.reaction_counts || {},
    reactionState?.reactors || []
  );
  const reactionMeta = getReactionMeta(displayedReactionType);

  if (emojiEl) emojiEl.innerHTML = reactionImg(reactionMeta.type, 'reaction-btn-img');
  if (countEl) countEl.textContent = String(Math.max(0, Number(reactionState?.reactions_total) || 0));

  reactionBtn.dataset.userReaction = reactionState?.user_reaction || '';
  reactionBtn.classList.toggle('liked', Boolean(reactionState?.user_reaction));
  reactionBtn.title = reactionState?.reaction_tooltip || 'No reactions yet';

  const breakdownEl = postCard?.querySelector('.reaction-breakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = buildReactionBreakdownHtml({
      reactionCounts: reactionState?.reaction_counts || {},
      reactors: reactionState?.reactors || [],
    });
  }
}

async function handleSavedPostReactionSelect(postId, reactionType, reactionControl = null) {
  if (!postId || !reactionType) return;
  if (reactionControl) reactionControl.classList.remove('is-open');

  const postCard = document.querySelector(`.post-card[data-post-id="${CSS.escape(String(postId))}"]`);
  const reactionBtn = postCard?.querySelector('.saved-post-card__metric-btn[data-action="react-post"]');
  const currentReaction = String(reactionBtn?.dataset.userReaction || '').trim();

  try {
    if (currentReaction === reactionType) {
      await clearPostReaction(postId);
    } else {
      await setPostReaction(postId, reactionType);
    }

    const reactionState = await getPostReactionState(postId);
    updateSavedPostReactionControl(postCard, reactionState);
  } catch (error) {
    console.error('Error setting saved post reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

function ensureSavedPostsCommentsModal() {
  if (savedPostsCommentsModalState.modalEl) return savedPostsCommentsModalState.modalEl;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade saved-post-comments-modal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-chat-left-text me-2"></i>Comments</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body p-0">
          <div class="saved-post-comments-preview-host"></div>
          <div class="saved-post-comments-host"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  savedPostsCommentsModalState.modalEl = modalEl;

  modalEl.addEventListener('hidden.bs.modal', () => {
    const previewHost = modalEl.querySelector('.saved-post-comments-preview-host');
    const host = modalEl.querySelector('.saved-post-comments-host');
    if (previewHost) previewHost.innerHTML = '';
    if (host) host.innerHTML = '';
    savedPostsCommentsModalState.activePostId = null;
    closeEmojiPicker();
  });

  return modalEl;
}

function openSavedPostCommentsModal(postCard, postId) {
  if (!postCard || !postId) return;

  const modalEl = ensureSavedPostsCommentsModal();
  const previewHost = modalEl.querySelector('.saved-post-comments-preview-host');
  const host = modalEl.querySelector('.saved-post-comments-host');
  if (!host || !previewHost) return;

  previewHost.innerHTML = '';
  previewHost.appendChild(createSavedPostCommentsPreview(postCard));
  const commentSection = createSavedPostCommentSection(postId);
  host.innerHTML = '';
  host.appendChild(commentSection);
  savedPostsCommentsModalState.activePostId = postId;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  requestAnimationFrame(() => {
    commentSection.querySelector('.comment-composer-input')?.focus();
  });
}

function createSavedPostCommentsPreview(postCard) {
  const previewCard = postCard.cloneNode(true);
  previewCard.classList.add('saved-post-comments-preview');
  previewCard.querySelector('.saved-post-card__footer')?.remove();
  previewCard.querySelector('.saved-post-card__topbar .dropdown')?.remove();
  return previewCard;
}

function createSavedPostCommentSection(postId) {
  const commentSection = document.createElement('div');
  commentSection.className = 'comment-section saved-post-comment-section p-3';
  commentSection.dataset.postId = postId;

  const user = getStoredUser();
  const currentUserAvatarUrl = resolveAvatarUrl(user, user?.avatar);

  commentSection.innerHTML = `
    <div class="d-flex gap-2 mb-3">
      <img src="${escapeHtml(currentUserAvatarUrl)}" alt="Profile" class="rounded-circle" width="35" height="35" loading="lazy">
      <div class="flex-grow-1">
        <div class="input-group">
          <textarea class="form-control comment-composer-input" rows="2" placeholder="Write a comment..."></textarea>
          <button class="btn btn-primary-gradient" type="button">
            <i class="bi bi-send"></i>
          </button>
        </div>
      </div>
    </div>
    <div class="comments-list">
      <div class="text-muted small">Loading comments...</div>
    </div>
  `;

  const inputGroup = commentSection.querySelector('.input-group');
  const commentInput = commentSection.querySelector('.comment-composer-input');
  attachEmojiPicker(inputGroup, commentInput);

  loadSavedPostComments(postId, commentSection);

  const submitBtn = commentSection.querySelector('button');
  const input = commentSection.querySelector('.comment-composer-input');

  submitBtn?.addEventListener('click', () => submitSavedPostComment(input, postId, commentSection));
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submitSavedPostComment(input, postId, commentSection);
    }
  });

  commentSection.addEventListener('click', (event) => {
    const toggleBtn = event.target.closest('.comment-toggle-replies');
    if (toggleBtn) {
      const commentId = toggleBtn.dataset.commentId;
      const commentItem = commentSection.querySelector(`.comment-item[data-comment-id="${CSS.escape(String(commentId || ''))}"]`);
      toggleReplies(commentItem);
      return;
    }

    const actionBtn = event.target.closest('[data-action][data-comment-id]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const commentId = actionBtn.dataset.commentId;

    if (action === 'react-comment' && commentId) {
      toggleSavedPostsReactionPopover(actionBtn.closest('.reaction-control'));
      return;
    }

    if (action === 'set-comment-reaction' && commentId) {
      const reactionType = actionBtn.dataset.reactionType;
      if (reactionType) {
        handleSavedCommentReactionSelect(commentSection, commentId, reactionType, actionBtn.closest('.reaction-control'));
      }
      return;
    }

    if (action === 'reply-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      toggleReplyForm(commentItem, postId, commentId);
      return;
    }

    if (action === 'edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleSavedPostEditComment(commentId, commentItem);
      return;
    }

    if (action === 'save-edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleSavedPostSaveCommentEdit(commentId, commentItem, postId, commentSection);
      return;
    }

    if (action === 'cancel-edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleSavedPostCancelCommentEdit(commentItem);
      return;
    }

    if (action === 'delete-comment' && commentId) {
      handleSavedPostDeleteComment(commentId, postId, commentSection);
      return;
    }

    if (action === 'submit-reply' && commentId) {
      const replyInput = actionBtn.closest('.comment-reply-form')?.querySelector('.reply-composer-input');
      if (replyInput) {
        submitSavedPostReply(replyInput, postId, commentId, commentSection);
      }
    }
  });

  return commentSection;
}

async function loadSavedPostComments(postId, commentSection) {
  const commentsList = commentSection.querySelector('.comments-list');
  if (!commentsList) return;

  try {
    const comments = await getPostComments(postId);
    if (!comments.length) {
      commentsList.innerHTML = '<div class="text-muted small">No comments yet.</div>';
      return;
    }

    renderSavedPostCommentsList(comments, commentsList);
  } catch (error) {
    console.error('Error loading saved post comments:', error);
    commentsList.innerHTML = '<div class="text-muted small">Failed to load comments.</div>';
  }
}

async function submitSavedPostComment(input, postId, commentSection) {
  const commentText = input?.value.trim();
  if (!commentText) return;

  input.disabled = true;

  try {
    await createComment(postId, commentText, null);
    input.value = '';
    updateSavedPostCommentCount(postId, 1);
    await loadSavedPostComments(postId, commentSection);
  } catch (error) {
    console.error('Error creating saved post comment:', error);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function renderSavedPostCommentsList(comments, commentsList) {
  const tree = buildSavedPostCommentTree(comments);
  commentsList.innerHTML = tree.map((comment) => renderSavedPostCommentItem(comment, 0)).join('');
}

function buildSavedPostCommentTree(comments) {
  const map = new Map();
  const roots = [];

  comments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] });
  });

  comments.forEach((comment) => {
    const node = map.get(comment.id);
    if (comment.parent_comment_id && map.has(comment.parent_comment_id)) {
      map.get(comment.parent_comment_id).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function renderSavedPostCommentItem(comment, depth) {
  const fullName = comment?.profiles?.full_name || comment?.profiles?.username || 'User';
  const avatarUrl = resolveAvatarUrl(comment?.profiles, comment?.profiles?.avatar_url);
  const likesCount = Number.isFinite(comment?.likes_count) ? comment.likes_count : 0;
  const safeId = escapeHtml(String(comment?.id || ''));
  const timeText = comment?.created_at ? formatRelativeTime(comment.created_at) : 'recently';
  const replyCount = countReplies(comment);
  const replyLabel = replyCount === 1 ? 'reply' : 'replies';
  const hasReplies = replyCount > 0;
  const repliesHtml = (comment.replies || []).map((reply) => renderSavedPostCommentItem(reply, depth + 1)).join('');
  const margin = Math.min(depth, 6) * 16;

  return `
    <div class="comment-item" data-comment-id="${safeId}" style="margin-left: ${margin}px;">
      <div class="d-flex gap-2">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="rounded-circle" width="30" height="30" loading="lazy">
        <div class="comment-bubble">
          <strong class="d-block small">${escapeHtml(fullName)}</strong>
          <span class="small comment-content-text">${renderTwemoji(String(comment?.content || ''))}</span>
          <div class="comment-actions">
            <span class="comment-reply-count">${escapeHtml(timeText)}</span>
            ${buildReactionControlHtml({
              targetType: 'comment',
              targetId: comment?.id,
              count: likesCount,
              userReaction: comment?.user_reaction || null,
              tooltip: comment?.reaction_tooltip || 'No reactions yet',
              reactionCounts: comment?.reaction_counts || {},
              reactors: comment?.reactors || [],
              baseClass: 'comment-action-btn',
            })}
            <button class="comment-action-btn" data-action="reply-comment" data-comment-id="${safeId}">Reply</button>
            ${canManageSavedPostComment(comment)
              ? `<button class="comment-action-btn" data-action="edit-comment" data-comment-id="${safeId}">Edit</button>
                 <button class="comment-action-btn text-danger" data-action="delete-comment" data-comment-id="${safeId}">Delete</button>`
              : ''}
          </div>
        </div>
      </div>
      ${hasReplies ? `<button class="comment-toggle-replies comment-replies-inline-toggle" type="button" data-comment-id="${safeId}" data-reply-count="${replyCount}" aria-expanded="false">View ${replyCount} ${replyLabel}</button>` : ''}
      ${repliesHtml ? `<div class="comment-replies d-none">${repliesHtml}</div>` : ''}
    </div>
  `;
}

function countReplies(comment) {
  if (!comment?.replies?.length) return 0;

  return comment.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0);
}

function canManageSavedPostComment(comment) {
  if (!comment?.id) return false;
  return Boolean(savedPostsCurrentUserId && comment?.user_id === savedPostsCurrentUserId);
}

function toggleReplyForm(commentItem, postId, parentCommentId) {
  if (!commentItem) return;

  const existing = commentItem.querySelector('.comment-reply-form');
  if (existing) {
    existing.remove();
    return;
  }

  const replyForm = document.createElement('div');
  replyForm.className = 'comment-reply-form mt-2';
  replyForm.innerHTML = `
    <div class="input-group input-group-sm">
      <textarea class="form-control reply-composer-input" rows="2" placeholder="Write a reply..."></textarea>
      <button class="btn btn-primary-gradient" type="button" data-action="submit-reply" data-comment-id="${escapeHtml(String(parentCommentId || ''))}">
        <i class="bi bi-send"></i>
      </button>
    </div>
  `;

  commentItem.querySelector('.comment-bubble')?.appendChild(replyForm);
  replyForm.querySelector('.reply-composer-input')?.focus();

  const replyInputGroup = replyForm.querySelector('.input-group');
  const replyInputEl = replyForm.querySelector('.reply-composer-input');
  attachEmojiPicker(replyInputGroup, replyInputEl);

  replyInputEl?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      replyForm.querySelector('[data-action="submit-reply"]')?.click();
    }
  });
}

function toggleReplies(commentItem) {
  if (!commentItem) return;

  const replies = commentItem.querySelector('.comment-replies');
  if (!replies) return;

  const toggleBtn = commentItem.querySelector('.comment-toggle-replies');
  const replyCount = Number.parseInt(toggleBtn?.dataset.replyCount || '0', 10);
  const safeReplyCount = Number.isFinite(replyCount) ? Math.max(0, replyCount) : 0;
  const replyLabel = safeReplyCount === 1 ? 'reply' : 'replies';
  const isCollapsed = replies.classList.toggle('d-none');

  if (toggleBtn) {
    toggleBtn.textContent = isCollapsed ? `View ${safeReplyCount} ${replyLabel}` : 'Hide replies';
    toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  }
}

function updateSavedCommentReactionControl(commentSection, commentId, reactionState) {
  const reactionBtn = commentSection?.querySelector(`.comment-item[data-comment-id="${CSS.escape(String(commentId))}"] .comment-action-btn[data-action="react-comment"]`);
  if (!reactionBtn) return;

  const emojiEl = reactionBtn.querySelector('.reaction-emoji');
  const countEl = reactionBtn.querySelector('span:last-child');
  const displayedReactionType = resolveDisplayedReactionType(
    reactionState?.user_reaction || null,
    reactionState?.reaction_counts || {},
    reactionState?.reactors || []
  );
  const reactionMeta = getReactionMeta(displayedReactionType);

  if (emojiEl) emojiEl.innerHTML = reactionImg(reactionMeta.type, 'reaction-btn-img');
  if (countEl) countEl.textContent = String(Math.max(0, Number(reactionState?.reactions_total) || 0));

  reactionBtn.dataset.userReaction = reactionState?.user_reaction || '';
  reactionBtn.classList.toggle('liked', Boolean(reactionState?.user_reaction));
  reactionBtn.title = reactionState?.reaction_tooltip || 'No reactions yet';

  const reactionControl = reactionBtn.closest('.reaction-control');
  const breakdownEl = reactionControl?.querySelector('.reaction-breakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = buildReactionBreakdownHtml({
      reactionCounts: reactionState?.reaction_counts || {},
      reactors: reactionState?.reactors || [],
    });
  }
}

async function handleSavedCommentReactionSelect(commentSection, commentId, reactionType, reactionControl = null) {
  if (!commentId || !reactionType) return;
  if (reactionControl) reactionControl.classList.remove('is-open');

  const reactionBtn = commentSection?.querySelector(`.comment-item[data-comment-id="${CSS.escape(String(commentId))}"] .comment-action-btn[data-action="react-comment"]`);
  const currentReaction = String(reactionBtn?.dataset.userReaction || '').trim();

  try {
    if (currentReaction === reactionType) {
      await clearCommentReaction(commentId);
    } else {
      await setCommentReaction(commentId, reactionType);
    }

    const reactionState = await getCommentReactionState(commentId);
    updateSavedCommentReactionControl(commentSection, commentId, reactionState);
  } catch (error) {
    console.error('Error setting saved comment reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

async function submitSavedPostReply(input, postId, parentCommentId, commentSection) {
  const replyText = input?.value.trim();
  if (!replyText) return;

  input.disabled = true;

  try {
    await createComment(postId, replyText, parentCommentId);
    input.value = '';
    updateSavedPostCommentCount(postId, 1);
    await loadSavedPostComments(postId, commentSection);
  } catch (error) {
    console.error('Error creating saved post reply:', error);
    showToast('Failed to post reply. Please try again.', 'error');
  } finally {
    input.disabled = false;
  }
}

async function handleSavedPostDeleteComment(commentId, postId, commentSection) {
  const confirmed = window.confirm('Delete this comment?');
  if (!confirmed) return;

  try {
    await deleteComment(commentId);
    updateSavedPostCommentCount(postId, -1);
    await loadSavedPostComments(postId, commentSection);
    showToast('Comment deleted.', 'info');
  } catch (error) {
    console.error('Error deleting saved post comment:', error);
    showToast('Failed to delete comment.', 'error');
  }
}

function setSavedPostCommentEditingState(commentItem, editing) {
  if (!commentItem) return;

  const actionControls = commentItem.querySelectorAll('.comment-actions > .comment-action-btn, .comment-actions > .comment-reply-count, .comment-actions > .reaction-control');
  actionControls.forEach((control) => {
    control.classList.toggle('d-none', editing);
  });
}

function handleSavedPostEditComment(commentId, commentItem) {
  if (!commentItem || commentItem.dataset.editing === 'true') return;

  const contentEl = commentItem.querySelector('.comment-content-text');
  const currentContent = String(contentEl?.textContent || '').trim();
  if (!contentEl || !currentContent) return;

  commentItem.dataset.editing = 'true';
  commentItem.dataset.originalCommentContent = currentContent;

  setSavedPostCommentEditingState(commentItem, true);
  contentEl.classList.add('d-none');

  const editor = document.createElement('div');
  editor.className = 'comment-edit-form mt-2';
  editor.innerHTML = `
    <div class="input-group input-group-sm">
      <input type="text" class="form-control comment-edit-input" value="${escapeHtml(currentContent)}" maxlength="1000">
      <button type="button" class="btn btn-primary-gradient" data-action="save-edit-comment" data-comment-id="${escapeHtml(String(commentId || ''))}">Save</button>
      <button type="button" class="btn btn-outline-secondary" data-action="cancel-edit-comment" data-comment-id="${escapeHtml(String(commentId || ''))}">Cancel</button>
    </div>
  `;

  contentEl.after(editor);

  const input = editor.querySelector('.comment-edit-input');
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editor.querySelector('[data-action="save-edit-comment"]')?.click();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      editor.querySelector('[data-action="cancel-edit-comment"]')?.click();
    }
  });

  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
}

function handleSavedPostCancelCommentEdit(commentItem) {
  if (!commentItem) return;

  const contentEl = commentItem.querySelector('.comment-content-text');
  commentItem.querySelector('.comment-edit-form')?.remove();

  if (contentEl) {
    const original = String(commentItem.dataset.originalCommentContent || contentEl.textContent || '').trim();
    contentEl.innerHTML = renderTwemoji(original);
    contentEl.classList.remove('d-none');
  }

  delete commentItem.dataset.editing;
  delete commentItem.dataset.originalCommentContent;
  setSavedPostCommentEditingState(commentItem, false);
}

async function handleSavedPostSaveCommentEdit(commentId, commentItem, postId, commentSection) {
  if (!commentItem) return;

  const input = commentItem.querySelector('.comment-edit-input');
  const original = String(commentItem.dataset.originalCommentContent || '').trim();
  const normalized = String(input?.value || '').trim();

  if (!normalized) {
    showToast('Comment cannot be empty.', 'warning');
    input?.focus();
    return;
  }

  if (normalized === original) {
    handleSavedPostCancelCommentEdit(commentItem);
    return;
  }

  const buttons = commentItem.querySelectorAll('.comment-edit-form button');
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    await updateComment(commentId, normalized);
    await loadSavedPostComments(postId, commentSection);
    showToast('Comment updated.', 'success');
  } catch (error) {
    console.error('Error updating saved post comment:', error);
    buttons.forEach((button) => {
      button.disabled = false;
    });
    showToast('Failed to update comment.', 'error');
  }
}

function updateSavedPostCommentCount(postId, delta) {
  if (!postId) return;

  const cards = document.querySelectorAll(`.post-card[data-post-id="${CSS.escape(String(postId))}"]`);
  cards.forEach((postCard) => {
    const commentBtn = postCard.querySelector('.saved-post-card__metric-btn[data-action="comment"] span');
    if (!commentBtn) return;

    const current = parseInt(commentBtn.textContent, 10) || 0;
    const next = Math.max(0, current + delta);
    commentBtn.textContent = String(next);
    postCard.querySelector('.saved-post-card__metric-btn[data-action="comment"]')?.classList.toggle('has-comments', next > 0);
  });
}

function extractPrimaryExternalUrl(content) {
  const raw = String(content || '');
  const match = raw.match(/https?:\/\/[^\s]+/i);
  return match ? normalizeExternalUrl(match[0]) : null;
}

function stripUrlsFromText(content) {
  return String(content || '')
    .replace(/https?:\/\/[^\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
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
