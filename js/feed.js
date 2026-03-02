/**
 * SocialCore - Feed Module
 * Handles posts feed functionality
 */

import { showToast, formatRelativeTime, getStoredUser, refreshStoredUserFromProfile, refreshNotificationsMenu, initUserSearch, resolveAvatarUrl } from './main.js';
import { supabase } from './supabase.js';
import { getFeedPosts, getFollowingFeedPosts, getFollowingFeedAccounts, setPostReaction, clearPostReaction, getPostReactionState, createComment, getPostComments, setCommentReaction, clearCommentReaction, getCommentReactionState, updateComment, deleteComment, checkIsAdmin, getFriendSuggestions, getFriendRequests, getOutgoingFriendRequests, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, updatePost, deletePost, uploadPostImage } from './database.js';

const FEED_PAGE_SIZE = 10;
const FEED_TAB_STORAGE_KEY = 'socialcore_feed_tab';
let feedOffset = 0;
let isLoadingFeed = false;
let currentFeedTab = 'for-you';
let followingAccounts = [];
let selectedFollowingAuthorId = null;
let commentPermissions = {
  userId: null,
  isAdmin: false,
};
let feedCurrentUserId = getStoredUser()?.id || null;
let feedPhotoViewerState = {
  modalEl: null,
  images: [],
  currentIndex: 0,
  keyHandler: null,
};
let feedPostEditorState = {
  modalEl: null,
  activePostCard: null,
  activePostId: null,
  currentImageUrl: null,
  selectedFile: null,
  removeImage: false,
  isSubmitting: false,
  previewObjectUrl: null,
};

const REACTION_OPTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

function getReactionMeta(reactionType) {
  return REACTION_OPTIONS.find((option) => option.type === reactionType) || REACTION_OPTIONS[0];
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
        >${option.emoji}</button>
      `).join('')}
    </div>
  `;
}

function buildReactionBreakdownHtml({ reactionCounts = {}, reactors = [] }) {
  const counts = REACTION_OPTIONS
    .map((option) => ({
      ...option,
      count: Number(reactionCounts?.[option.type]) || 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const summaryHtml = counts.length
    ? `<div class="reaction-breakdown-summary">${counts.map((entry) => `<span class="reaction-breakdown-chip" title="${escapeHtml(entry.label)}">${entry.emoji} ${entry.count}</span>`).join('')}</div>`
    : '<div class="reaction-breakdown-empty">No reactions yet</div>';

  const reactorsHtml = (reactors || []).length
    ? `<div class="reaction-breakdown-reactors">${reactors.slice(0, 8).map((reactor) => `<div class="reaction-breakdown-row"><span class="reaction-breakdown-emoji">${escapeHtml(String(reactor.reaction_emoji || '👍'))}</span><span>${escapeHtml(String(reactor.name || 'User'))}</span></div>`).join('')}</div>`
    : '';

  return `${summaryHtml}${reactorsHtml}`;
}

function buildReactionControlHtml({ targetType, targetId, count = 0, userReaction = null, tooltip = 'No reactions yet', reactionCounts = {}, reactors = [], baseClass = 'post-action-btn' }) {
  const reaction = getReactionMeta(userReaction || 'like');
  const activeClass = userReaction ? 'liked' : '';
  const breakdownHtml = buildReactionBreakdownHtml({ reactionCounts, reactors });

  return `
    <div class="reaction-control">
      <button class="${baseClass} ${activeClass}" data-action="react-${targetType}" data-${targetType}-id="${escapeHtml(String(targetId || ''))}" data-user-reaction="${escapeHtml(String(userReaction || ''))}" title="${escapeHtml(tooltip)}" type="button" aria-label="React">
        <span class="reaction-emoji" aria-hidden="true">${reaction.emoji}</span>
        <span>${Math.max(0, Number(count) || 0)}</span>
      </button>
      <div class="reaction-breakdown" role="tooltip">
        ${breakdownHtml}
      </div>
      ${buildReactionPickerHtml({ targetType, targetId })}
    </div>
  `;
}
let feedRealtimeCleanup = null;
let feedRelationshipsRefreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initFeedTabs();
  initCommentPermissions();

  // Hydrate current user (avatar/name/username) and update Feed UI
  initCurrentUserFeedUI();

  // Load initial feed posts
  loadInitialFeedPosts();

  // Load people you may know suggestions
  initPeopleYouMayKnow();

  // Initialize follow actions
  initPeopleYouMayKnowActions();

  // Initialize post actions (like, comment, share)
  initPostActions();
  initCommentOverlayDismiss();

  // Initialize load more functionality
  initLoadMore();

  // Initialize search functionality
  initSearch();

  initFeedRealtime();

  window.addEventListener('beforeunload', () => {
    if (typeof feedRealtimeCleanup === 'function') {
      feedRealtimeCleanup();
      feedRealtimeCleanup = null;
    }
  });
});

function scheduleFeedRelationshipsRefresh() {
  if (feedRelationshipsRefreshTimer) {
    clearTimeout(feedRelationshipsRefreshTimer);
  }

  feedRelationshipsRefreshTimer = setTimeout(() => {
    Promise.all([
      refreshNotificationsMenu(),
      initPeopleYouMayKnow(),
      refreshFollowingSectionAfterFriendChange(),
    ]).catch((error) => {
      console.error('Realtime feed relationship refresh failed:', error);
    });
  }, 120);
}

async function initFeedRealtime() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    if (typeof feedRealtimeCleanup === 'function') {
      feedRealtimeCleanup();
      feedRealtimeCleanup = null;
    }

    const channels = [];
    const userId = user.id;

    const requesterChannel = supabase
      .channel(`realtime:feed:friend-requests:requester:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `requester_id=eq.${userId}` },
        () => {
          scheduleFeedRelationshipsRefresh();
        }
      )
      .subscribe();
    channels.push(requesterChannel);

    const addresseeChannel = supabase
      .channel(`realtime:feed:friend-requests:addressee:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `addressee_id=eq.${userId}` },
        () => {
          scheduleFeedRelationshipsRefresh();
        }
      )
      .subscribe();
    channels.push(addresseeChannel);

    const followsChannel = supabase
      .channel(`realtime:feed:follows:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${userId}` },
        () => {
          scheduleFeedRelationshipsRefresh();
        }
      )
      .subscribe();
    channels.push(followsChannel);

    feedRealtimeCleanup = () => {
      try {
        channels.forEach((channel) => {
          supabase.removeChannel(channel);
        });

        if (feedRelationshipsRefreshTimer) {
          clearTimeout(feedRelationshipsRefreshTimer);
          feedRelationshipsRefreshTimer = null;
        }
      } catch {
        // ignore
      }
    };
  } catch (error) {
    console.warn('Feed realtime unavailable:', error);
  }
}

async function initCommentPermissions() {
  const storedUser = getStoredUser();
  if (storedUser?.id) {
    commentPermissions.userId = storedUser.id;
    feedCurrentUserId = storedUser.id;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    commentPermissions.userId = user.id;
    feedCurrentUserId = user.id;
    commentPermissions.isAdmin = await checkIsAdmin(user.id);
  } catch (error) {
    console.warn('Failed to resolve comment permissions:', error);
  }
}

function canManageComment(comment) {
  if (!comment?.id) return false;
  if (commentPermissions.isAdmin) return true;
  return Boolean(commentPermissions.userId && comment.user_id === commentPermissions.userId);
}

function initFeedTabs() {
  const tabButtons = document.querySelectorAll('[data-feed-tab]');
  if (!tabButtons.length) return;

  currentFeedTab = resolveInitialFeedTab(tabButtons);
  applyFeedTabSelection(tabButtons, currentFeedTab);

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedTab = button.dataset.feedTab;
      if (!selectedTab || selectedTab === currentFeedTab) return;

      currentFeedTab = selectedTab;

      applyFeedTabSelection(tabButtons, selectedTab);
      persistFeedTab(selectedTab);

      toggleFollowingFiltersVisibility();

      loadInitialFeedPosts();
    });
  });

  initFollowingFiltersActions();
  initFollowingFiltersScrollControls();
  toggleFollowingFiltersVisibility();
}

function resolveInitialFeedTab(tabButtons) {
  const allowedTabs = new Set(Array.from(tabButtons).map((button) => button.dataset.feedTab).filter(Boolean));

  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab && allowedTabs.has(urlTab)) {
    return urlTab;
  }

  try {
    const storedTab = localStorage.getItem(FEED_TAB_STORAGE_KEY);
    if (storedTab && allowedTabs.has(storedTab)) {
      return storedTab;
    }
  } catch {
    // ignore storage access failures
  }

  return 'for-you';
}

function applyFeedTabSelection(tabButtons, selectedTab) {
  tabButtons.forEach((tabBtn) => {
    const active = tabBtn.dataset.feedTab === selectedTab;
    tabBtn.classList.toggle('active', active);
    tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function persistFeedTab(selectedTab) {
  try {
    localStorage.setItem(FEED_TAB_STORAGE_KEY, selectedTab);
  } catch {
    // ignore storage access failures
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', selectedTab);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore history/url failures
  }
}

async function fetchFeedPosts(limit, offset) {
  if (currentFeedTab === 'following') {
    return getFollowingFeedPosts(limit, offset, selectedFollowingAuthorId);
  }

  return getFeedPosts(limit, offset);
}

async function loadInitialFeedPosts() {
  const postsFeed = document.getElementById('postsFeed');
  if (!postsFeed) return;

  isLoadingFeed = true;
  feedOffset = 0;

  try {
    if (currentFeedTab === 'following') {
      await loadFollowingAccounts();
    }

    const posts = await fetchFeedPosts(FEED_PAGE_SIZE, feedOffset);
    postsFeed.innerHTML = '';

    if (!posts.length) {
      const emptyState = currentFeedTab === 'following'
        ? buildEmptyStateHtml({
          title: selectedFollowingAuthorId ? 'No posts from this account yet' : 'No following posts yet',
          description: selectedFollowingAuthorId
            ? 'Try another account from the list above or switch to For You.'
            : 'Follow people or add friends to see their posts here.',
        })
        : buildEmptyStateHtml();

      postsFeed.innerHTML = emptyState;
      toggleLoadMore(false);
      return;
    }

    renderFeedPosts(posts, { append: false });
    feedOffset += posts.length;

    // If we got a full page, allow loading more.
    toggleLoadMore(posts.length === FEED_PAGE_SIZE);
  } catch (error) {
    console.error('Error loading feed posts:', error);
    postsFeed.innerHTML = buildEmptyStateHtml('Failed to load posts');
    showToast('Failed to load posts. Please refresh.', 'error');
    toggleLoadMore(false);
  } finally {
    isLoadingFeed = false;
  }
}

async function loadMoreFeedPosts() {
  if (isLoadingFeed) return;
  isLoadingFeed = true;

  try {
    const posts = await fetchFeedPosts(FEED_PAGE_SIZE, feedOffset);
    if (!posts.length) {
      toggleLoadMore(false);
      return;
    }

    renderFeedPosts(posts, { append: true });
    feedOffset += posts.length;
    toggleLoadMore(posts.length === FEED_PAGE_SIZE);
  } catch (error) {
    console.error('Error loading more posts:', error);
    showToast('Failed to load more posts.', 'error');
  } finally {
    isLoadingFeed = false;
  }
}

function renderFeedPosts(posts, { append }) {
  const postsFeed = document.getElementById('postsFeed');
  if (!postsFeed) return;

  if (!append) postsFeed.innerHTML = '';

  posts.forEach((post) => {
    postsFeed.insertAdjacentHTML('beforeend', createFeedPostHtml(post));
  });
}

function createFeedPostHtml(post) {
  const fullName = post?.profiles?.full_name || 'User';
  const username = post?.profiles?.username || 'user';
  const authorId = post?.profiles?.id;
  const profileHref = authorId ? `profile.html?id=${encodeURIComponent(authorId)}` : 'profile.html';
  const avatarUrl = resolveAvatarUrl(post?.profiles, post?.profiles?.avatar_url);
  const contentHtml = formatPostContentHtml(post?.content || '');
  const linkPreviewHtml = createPostLinkPreviewHtml(post?.content || '', { hidden: Boolean(post?.image_url) });
  const timeText = post?.created_at ? formatRelativeTime(post.created_at) : '';
  const postGallery = `feed-post-${String(post?.id || 'unknown')}`;

  const likesCount = Number.isFinite(post?.likes_count) ? post.likes_count : 0;
  const commentsCount = Number.isFinite(post?.comments_count) ? post.comments_count : 0;
  const commentClass = commentsCount > 0 ? 'has-comments' : '';
  const isOwnPost = Boolean(feedCurrentUserId && post?.user_id && post.user_id === feedCurrentUserId);

  return `
    <article class="post-card" data-post-id="${escapeHtml(String(post?.id || ''))}" data-post-author-id="${escapeHtml(String(post?.user_id || ''))}">
      <div class="post-header">
        <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
          <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="post-avatar" loading="lazy">
        </a>
        <div>
          <a href="${escapeHtml(profileHref)}" class="post-author text-decoration-none">${escapeHtml(fullName)}</a>
          <p class="post-time mb-0">${escapeHtml(timeText)}</p>
        </div>
        <div class="ms-auto">
          <button class="btn btn-link text-muted p-0" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-three-dots"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button type="button" class="dropdown-item" data-post-menu-action="save"><i class="bi bi-bookmark me-2"></i>Save Post</button></li>
            <li><button type="button" class="dropdown-item" data-post-menu-action="report"><i class="bi bi-flag me-2"></i>Report</button></li>
            ${isOwnPost ? `
              <li><hr class="dropdown-divider"></li>
              <li><button type="button" class="dropdown-item" data-post-owner-action="edit"><i class="bi bi-pencil-square me-2"></i>Edit Post</button></li>
              <li><button type="button" class="dropdown-item text-danger" data-post-owner-action="delete"><i class="bi bi-trash3 me-2"></i>Delete Post</button></li>
            ` : ''}
          </ul>
        </div>
      </div>
      <div class="post-content">
        ${contentHtml ? `<p class="mb-0">${contentHtml}</p>` : ''}
        ${post?.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="Post image" class="post-image mt-3" loading="lazy" data-photo-viewer-url="${escapeHtml(post.image_url)}" data-photo-gallery="${escapeHtml(postGallery)}" style="cursor: zoom-in;">` : ''}
        ${linkPreviewHtml}
      </div>
      <div class="post-actions">
        ${buildReactionControlHtml({
          targetType: 'post',
          targetId: post?.id,
          count: likesCount,
          userReaction: post?.user_reaction || null,
          tooltip: post?.reaction_tooltip || 'No reactions yet',
          reactionCounts: post?.reaction_counts || {},
          reactors: post?.reactors || [],
          baseClass: 'post-action-btn',
        })}
        <button class="post-action-btn ${commentClass}" data-action="comment" type="button" aria-label="Comment">
          <i class="bi bi-chat"></i>
          <span>${commentsCount}</span>
        </button>
        <button class="post-action-btn" data-action="share" type="button" aria-label="Share">
          <i class="bi bi-share"></i>
          <span>Share</span>
        </button>
      </div>
    </article>
  `;
}

function buildEmptyStateHtml({ title = 'No posts yet', description = 'Start following people or create your first post!' } = {}) {
  return `
    <div class="card text-center py-5">
      <div class="card-body">
        <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
        <h5 class="text-muted">${escapeHtml(title)}</h5>
        <p class="text-gray-500 mb-3">${escapeHtml(description)}</p>
        <a href="create-post.html" class="btn btn-primary-gradient create-post-match-add-friend">
          <i class="bi bi-plus-circle me-2"></i>Create Post
        </a>
      </div>
    </div>
  `;
}

function toggleLoadMore(show) {
  const container = document.getElementById('loadMoreContainer');
  if (!container) return;
  container.classList.toggle('d-none', !show);
}

function getFollowingFiltersElements() {
  const card = document.getElementById('followingFiltersCard');
  const list = document.getElementById('followingFiltersList');
  const prevBtn = document.getElementById('followingFiltersPrev');
  const nextBtn = document.getElementById('followingFiltersNext');
  return { card, list, prevBtn, nextBtn };
}

function toggleFollowingFiltersVisibility() {
  const { card } = getFollowingFiltersElements();
  if (!card) return;
  card.classList.toggle('d-none', currentFeedTab !== 'following');

  if (currentFeedTab === 'following') {
    window.requestAnimationFrame(() => {
      updateFollowingFiltersScrollControls();
    });
  }
}

function buildFollowingAccountChip(account, { active = false } = {}) {
  const fullName = account?.full_name || account?.username || 'User';
  const label = fullName;
  const avatarUrl = resolveAvatarUrl(account, account?.avatar_url);

  return `
    <button type="button" class="following-filter-chip ${active ? 'active' : ''}" data-following-id="${escapeHtml(String(account?.id || ''))}" title="${escapeHtml(label)}">
      <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="following-filter-avatar" loading="lazy">
      <span class="following-filter-name">${escapeHtml(label)}</span>
    </button>
  `;
}

function renderFollowingFilters() {
  const { list } = getFollowingFiltersElements();
  if (!list) return;

  if (!followingAccounts.length) {
    list.innerHTML = '<div class="text-muted small px-2 py-1">No following accounts yet.</div>';
    updateFollowingFiltersScrollControls();
    return;
  }

  const orderedAccounts = [...followingAccounts];
  if (selectedFollowingAuthorId) {
    orderedAccounts.sort((a, b) => {
      if (a.id === selectedFollowingAuthorId) return -1;
      if (b.id === selectedFollowingAuthorId) return 1;
      return 0;
    });
  }

  const allChip = `
    <button type="button" class="following-filter-chip following-filter-chip--all ${selectedFollowingAuthorId ? '' : 'active'}" data-following-id="all" title="All">
      <span class="following-filter-name">All</span>
    </button>
  `;

  const chips = orderedAccounts
    .map((account) => buildFollowingAccountChip(account, { active: account.id === selectedFollowingAuthorId }))
    .join('');

  list.innerHTML = `${allChip}${chips}`;
  updateFollowingFiltersScrollControls();
}

async function loadFollowingAccounts() {
  const { list } = getFollowingFiltersElements();
  if (!list) return;

  list.innerHTML = '<div class="text-muted small px-2 py-1">Loading following accounts...</div>';

  try {
    followingAccounts = await getFollowingFeedAccounts();

    if (selectedFollowingAuthorId && !followingAccounts.some((account) => account.id === selectedFollowingAuthorId)) {
      selectedFollowingAuthorId = null;
    }

    renderFollowingFilters();
  } catch (error) {
    console.error('Error loading following accounts:', error);
    list.innerHTML = '<div class="text-muted small px-2 py-1">Failed to load following accounts.</div>';
  }
}

async function refreshFollowingSectionAfterFriendChange() {
  if (currentFeedTab === 'following') {
    await loadInitialFeedPosts();
    return;
  }

  await loadFollowingAccounts();
}

function initFollowingFiltersActions() {
  const { list } = getFollowingFiltersElements();
  if (!list) return;

  list.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-following-id]');
    if (!chip) return;

    const selectedId = chip.getAttribute('data-following-id');
    if (!selectedId) return;

    if (selectedId === 'all') {
      if (selectedFollowingAuthorId === null) return;
      selectedFollowingAuthorId = null;
      renderFollowingFilters();
      loadInitialFeedPosts();
      return;
    }

    if (selectedFollowingAuthorId === selectedId) return;

    selectedFollowingAuthorId = selectedId;
    renderFollowingFilters();
    loadInitialFeedPosts();
  });
}

function updateFollowingFiltersScrollControls() {
  const { list, prevBtn, nextBtn } = getFollowingFiltersElements();
  if (!list || !prevBtn || !nextBtn) return;

  if (currentFeedTab !== 'following') {
    prevBtn.classList.add('d-none');
    nextBtn.classList.add('d-none');
    return;
  }

  const maxScrollLeft = Math.max(0, list.scrollWidth - list.clientWidth);
  const hasOverflow = maxScrollLeft > 2;

  if (!hasOverflow) {
    prevBtn.classList.add('d-none');
    nextBtn.classList.add('d-none');
    return;
  }

  const atStart = list.scrollLeft <= 2;
  const atEnd = list.scrollLeft >= maxScrollLeft - 2;

  prevBtn.classList.toggle('d-none', atStart);
  nextBtn.classList.toggle('d-none', atEnd);
}

function initFollowingFiltersScrollControls() {
  const { list, prevBtn, nextBtn } = getFollowingFiltersElements();
  if (!list || !prevBtn || !nextBtn) return;
  if (list.dataset.followingScrollBound === 'true') return;
  list.dataset.followingScrollBound = 'true';

  const scrollStep = 260;

  prevBtn.addEventListener('click', () => {
    list.scrollBy({ left: -scrollStep, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    list.scrollBy({ left: scrollStep, behavior: 'smooth' });
  });

  list.addEventListener('scroll', () => {
    updateFollowingFiltersScrollControls();
  }, { passive: true });

  window.addEventListener('resize', () => {
    updateFollowingFiltersScrollControls();
  });

  initFollowingFiltersDragScroll(list);

  updateFollowingFiltersScrollControls();
}

function initFollowingFiltersDragScroll(list) {
  if (!list || list.dataset.followingDragBound === 'true') return;
  list.dataset.followingDragBound = 'true';

  let isPointerDown = false;
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;
  let movedDistance = 0;

  list.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    isPointerDown = true;
    isDragging = false;
    movedDistance = 0;
    startX = event.clientX;
    startScrollLeft = list.scrollLeft;
    list.classList.add('dragging');
  });

  list.addEventListener('pointermove', (event) => {
    if (!isPointerDown) return;

    const diffX = event.clientX - startX;
    movedDistance = Math.max(movedDistance, Math.abs(diffX));
    if (movedDistance > 4) {
      isDragging = true;
    }

    if (!isDragging) return;
    list.scrollLeft = startScrollLeft - diffX;
  });

  const endDrag = () => {
    isPointerDown = false;
    list.classList.remove('dragging');
    window.requestAnimationFrame(() => {
      isDragging = false;
    });
  };

  list.addEventListener('pointerup', endDrag);
  list.addEventListener('pointerleave', endDrag);
  list.addEventListener('pointercancel', endDrag);

  list.addEventListener('click', (event) => {
    if (!isDragging) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

async function initCurrentUserFeedUI() {
  const user = (await refreshStoredUserFromProfile()) || getStoredUser();
  if (!user) return;

  // Sidebar user card
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarUsername = document.getElementById('sidebarUserUsername');

  if (sidebarAvatar && user.avatar) sidebarAvatar.src = user.avatar;
  if (sidebarName) sidebarName.textContent = user.name || 'User';
  if (sidebarUsername) sidebarUsername.textContent = `@${user.username || 'user'}`;

  // Create-post card
  const createPostAvatar = document.getElementById('createPostAvatar');
  const createPostPrompt = document.getElementById('createPostPrompt');

  if (createPostAvatar && user.avatar) createPostAvatar.src = user.avatar;
  if (createPostPrompt) {
    const firstName = (user.name || '').trim().split(' ')[0];
    createPostPrompt.textContent = firstName ? `What's on your mind, ${firstName}?` : "What's on your mind?";
  }
}

async function initPeopleYouMayKnow() {
  const list = document.getElementById('peopleYouMayKnowList');
  if (!list) return;

  list.innerHTML = '<div class="text-muted small">Loading suggestions...</div>';

  try {
    const [requests, outgoingRequests, suggestions] = await Promise.all([
      getFriendRequests(),
      getOutgoingFriendRequests(),
      getFriendSuggestions(8),
    ]);

    if (!requests.length && !outgoingRequests.length && !suggestions.length) {
      list.innerHTML = '<div class="text-muted small">No suggestions right now.</div>';
      list.classList.remove('has-overflow');
      return;
    }

    const outgoingHtml = outgoingRequests
      .map((request) => buildSuggestionHtml({
        ...request,
        pending_outgoing: true,
      }))
      .join('');

    const requestHtml = requests.map((request) => buildIncomingRequestHtml(request)).join('');
    const suggestionHtml = suggestions.map((user) => buildSuggestionHtml(user)).join('');

    // Keep outgoing pending requests visible and prioritized until accepted/declined.
    list.innerHTML = `${outgoingHtml}${requestHtml}${suggestionHtml}`;
    setupScrollHint(list);
  } catch (error) {
    console.error('Error loading suggestions:', error);
    list.innerHTML = '<div class="text-muted small">Failed to load suggestions.</div>';
    list.classList.remove('has-overflow');
  }
}

function setupScrollHint(list) {
  if (!list) return;

  const container = list.parentElement;
  if (!container) return;
  container.classList.add('scroll-hint-container');

  let hint = container.querySelector('.scroll-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'scroll-hint';
    hint.textContent = '▼';
    container.appendChild(hint);
  }

  const update = () => {
    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    container.classList.toggle('has-overflow', hasOverflow);
    container.classList.toggle('at-bottom', !hasOverflow || atBottom);
  };

  update();

  if (list.dataset.scrollHintBound === 'true') return;
  list.dataset.scrollHintBound = 'true';

  list.addEventListener('scroll', update);
  window.addEventListener('resize', update);
}

function initPeopleYouMayKnowActions() {
  const list = document.getElementById('peopleYouMayKnowList');
  if (!list) return;

  list.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const userId = button.dataset.userId;
    const requestId = button.dataset.requestId;
    if (!userId && !requestId) return;

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Working';

    try {
      if (action === 'accept-request' && requestId) {
        optimisticRemoveRequest(requestId);
        await acceptFriendRequest(requestId);
        showToast('Friend request accepted.', 'success');
      } else if (action === 'reject-request' && requestId) {
        optimisticRemoveRequest(requestId);
        await declineFriendRequest(requestId);
        showToast('Friend request rejected.', 'info');
      } else if (action === 'add-friend' && userId) {
        const state = button.dataset.state || 'none';
        if (state === 'pending') {
          await cancelFriendRequest(userId);
          showToast('Friend request canceled.', 'info');
        } else {
          await sendFriendRequest(userId);
          showToast('Friend request sent.', 'success');
        }
      }
    } catch (error) {
      console.error('Error updating friend request:', error);
      button.disabled = false;
      button.innerHTML = originalHtml;
      showToast('Failed to update friend request. Please try again.', 'error');
      return;
    }

    button.disabled = false;
    await Promise.all([
      initPeopleYouMayKnow(),
      refreshNotificationsMenu(),
      refreshFollowingSectionAfterFriendChange(),
    ]);
  });
}

function buildSuggestionHtml(user) {
  const fullName = user?.full_name || user?.username || 'User';
  const profileHref = user?.id ? `profile.html?id=${encodeURIComponent(user.id)}` : 'profile.html';
  const avatarUrl = resolveAvatarUrl(user, user?.avatar_url);
  const isOutgoingPending = !!user?.pending_outgoing;
  const mutualFriends = Number.isFinite(user?.mutual_friends) ? user.mutual_friends : 0;
  const mutualLabel = mutualFriends === 1 ? 'mutual friend' : 'mutual friends';
  const metaText = isOutgoingPending
    ? 'Friend request sent'
    : `${mutualFriends} ${mutualLabel}`;

  const actionBtnClass = isOutgoingPending ? 'btn-outline-secondary' : 'btn-primary-gradient';
  const actionBtnState = isOutgoingPending ? 'pending' : 'none';
  const actionBtnIcon = isOutgoingPending ? 'bi-x-circle' : 'bi-person-plus';
  const actionBtnLabel = isOutgoingPending ? 'Cancel Request' : 'Add Friend';

  return `
    <div class="suggestion-card" data-user-id="${escapeHtml(String(user?.id || ''))}">
      <div class="suggestion-card-body">
        <div class="friend-item">
          <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="friend-avatar" loading="lazy">
          </a>
          <div class="flex-grow-1">
            <a href="${escapeHtml(profileHref)}" class="friend-name mb-0 text-decoration-none">${escapeHtml(fullName)}</a>
            <small class="text-muted d-block mutual-friends">${escapeHtml(metaText)}</small>
          </div>
        </div>
        <button class="btn ${actionBtnClass} btn-sm suggestion-action" type="button" data-action="add-friend" data-state="${actionBtnState}" data-user-id="${escapeHtml(String(user?.id || ''))}">
          <i class="bi ${actionBtnIcon} me-1"></i>${actionBtnLabel}
        </button>
      </div>
    </div>
  `;
}

function buildIncomingRequestHtml(request) {
  const fullName = request?.full_name || request?.username || 'User';
  const profileHref = request?.id ? `profile.html?id=${encodeURIComponent(request.id)}` : 'profile.html';
  const avatarUrl = resolveAvatarUrl(request, request?.avatar_url);

  return `
    <div class="suggestion-card" data-user-id="${escapeHtml(String(request?.id || ''))}" data-request-id="${escapeHtml(String(request?.request_id || ''))}">
      <div class="suggestion-card-body">
        <div class="friend-item">
          <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="friend-avatar" loading="lazy">
          </a>
          <div class="flex-grow-1">
            <a href="${escapeHtml(profileHref)}" class="friend-name mb-0 text-decoration-none">${escapeHtml(fullName)}</a>
            <small class="text-muted d-block">Sent you a friend request</small>
          </div>
        </div>
        <div class="suggestion-actions">
          <button class="btn btn-primary-gradient btn-sm" type="button" data-action="accept-request" data-request-id="${escapeHtml(String(request?.request_id || ''))}">
            <i class="bi bi-check-lg me-1"></i>Accept
          </button>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-action="reject-request" data-request-id="${escapeHtml(String(request?.request_id || ''))}">
            <i class="bi bi-x-lg me-1"></i>Reject
          </button>
        </div>
      </div>
    </div>
  `;
}

async function loadNotifications() {
  const menu = document.getElementById('notificationsMenu');
  const badge = document.getElementById('notificationsBadge');
  if (!menu) return;

  menu.innerHTML = `
    <li class="dropdown-header">Notifications</li>
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item py-2 text-center text-muted">Loading...</a></li>
  `;

  try {
    const requests = await getFriendRequests();
    if (badge) {
      badge.textContent = requests.length;
      badge.classList.toggle('d-none', requests.length === 0);
    }
    if (!requests.length) {
      menu.innerHTML = `
        <li class="dropdown-header">Notifications</li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item py-2 text-center text-muted">No new notifications</a></li>
      `;
      return;
    }

    const itemsHtml = requests.map((request) => {
      const fullName = request?.full_name || request?.username || 'User';
      const avatarUrl = resolveAvatarUrl(request, request?.avatar_url);
      return `
        <li class="px-3 py-2" data-request-id="${escapeHtml(String(request?.request_id || ''))}">
          <div class="d-flex align-items-start gap-2">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="rounded-circle" width="32" height="32" loading="lazy">
            <div class="flex-grow-1">
              <div class="small"><strong>${escapeHtml(fullName)}</strong> sent you a friend request</div>
              <div class="d-flex gap-2 mt-2">
                <button class="btn btn-primary-gradient btn-sm" type="button" data-action="accept-request" data-request-id="${escapeHtml(String(request?.request_id || ''))}">Accept</button>
                <button class="btn btn-outline-secondary btn-sm" type="button" data-action="reject-request" data-request-id="${escapeHtml(String(request?.request_id || ''))}">Reject</button>
              </div>
            </div>
          </div>
        </li>
      `;
    }).join('');

    menu.innerHTML = `
      <li class="dropdown-header">Notifications</li>
      <li><hr class="dropdown-divider"></li>
      ${itemsHtml}
    `;
  } catch (error) {
    console.error('Error loading notifications:', error);
    if (badge) {
      badge.textContent = '0';
      badge.classList.add('d-none');
    }
    menu.innerHTML = `
      <li class="dropdown-header">Notifications</li>
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item py-2 text-center text-muted">Failed to load notifications</a></li>
    `;
  }
}

function initNotificationActions() {
  const menu = document.getElementById('notificationsMenu');
  if (!menu) return;

  menu.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const requestId = button.dataset.requestId;
    if (!requestId) return;

    button.disabled = true;
    try {
      if (action === 'accept-request') {
        optimisticRemoveRequest(requestId);
        await acceptFriendRequest(requestId);
        showToast('Friend request accepted.', 'success');
      } else if (action === 'reject-request') {
        optimisticRemoveRequest(requestId);
        await declineFriendRequest(requestId);
        showToast('Friend request rejected.', 'info');
      }
    } catch (error) {
      console.error('Error updating request:', error);
      button.disabled = false;
      showToast('Failed to update request. Please try again.', 'error');
      await Promise.all([refreshNotificationsMenu(), initPeopleYouMayKnow()]);
      return;
    }

    await Promise.all([
      refreshNotificationsMenu(),
      initPeopleYouMayKnow(),
      refreshFollowingSectionAfterFriendChange(),
    ]);
  });
}

function optimisticRemoveRequest(requestId) {
  if (!requestId) return;

  const menuItem = document.querySelector(`#notificationsMenu [data-request-id="${CSS.escape(requestId)}"]`);
  if (menuItem) menuItem.remove();

  const requestCard = document.querySelector(`#peopleYouMayKnowList [data-request-id="${CSS.escape(requestId)}"]`);
  if (requestCard) requestCard.remove();

  const badge = document.getElementById('notificationsBadge');
  if (badge && !badge.classList.contains('d-none')) {
    const current = parseInt(badge.textContent, 10) || 0;
    const next = Math.max(0, current - 1);
    badge.textContent = next;
    badge.classList.toggle('d-none', next === 0);
  }

  const list = document.getElementById('peopleYouMayKnowList');
  if (list) setupScrollHint(list);
}

/**
 * Initialize post action buttons (like, comment, share)
 */
function initPostActions() {
  const postsFeed = document.getElementById('postsFeed');
  
  if (!postsFeed) return;

  // Event delegation for post actions
  postsFeed.addEventListener('click', (e) => {
    const imageTrigger = e.target.closest('[data-photo-viewer-url]');
    if (imageTrigger && postsFeed.contains(imageTrigger)) {
      e.preventDefault();
      openFeedPhotoViewerFromTrigger(imageTrigger);
      return;
    }

    const ownerActionBtn = e.target.closest('[data-post-owner-action]');
    if (ownerActionBtn && postsFeed.contains(ownerActionBtn)) {
      e.preventDefault();

      const action = ownerActionBtn.dataset.postOwnerAction;
      const postCard = ownerActionBtn.closest('.post-card');
      const postId = postCard?.dataset?.postId;

      if (!postCard || !postId) return;
      if (!isFeedPostOwnedByCurrentUser(postCard)) {
        showToast('You can only manage your own posts.', 'warning');
        return;
      }

      if (action === 'edit') {
        openFeedPostEditor(postCard, postId);
      }

      if (action === 'delete') {
        handleDeleteFeedPost(postCard, postId);
      }

      return;
    }

    const reactionOptionBtn = e.target.closest('[data-action="set-post-reaction"]');
    if (reactionOptionBtn && postsFeed.contains(reactionOptionBtn)) {
      e.preventDefault();
      const postId = reactionOptionBtn.dataset.postId;
      const reactionType = reactionOptionBtn.dataset.reactionType;
      if (postId && reactionType) {
        handlePostReactionSelect(postId, reactionType);
      }
      return;
    }

    const actionBtn = e.target.closest('.post-action-btn');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const postCard = actionBtn.closest('.post-card');
    const postId = postCard?.dataset?.postId;

    switch (action) {
      case 'react-post':
        handlePostReactionToggle(actionBtn, postId);
        break;
      case 'comment':
        handleComment(actionBtn, postId);
        break;
      case 'share':
        handleShare(actionBtn, postId);
        break;
    }
  });
}

function initCommentOverlayDismiss() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickedCommentToggle = target.closest('.post-action-btn[data-action="comment"]');
    const clickedInsideCommentSection = target.closest('.comment-section');
    const clickedReplyToggle = target.closest('[data-action="reply-comment"]');
    const clickedInsideReplyForm = target.closest('.comment-reply-form');

    if (!clickedCommentToggle && !clickedInsideCommentSection) {
      closeOpenCommentSections();
      closeOpenReplyForms();
      return;
    }

    if (!clickedReplyToggle && !clickedInsideReplyForm) {
      closeOpenReplyForms();
    }
  });
}

function closeOpenCommentSections() {
  const sections = document.querySelectorAll('#postsFeed .comment-section:not(.d-none)');
  sections.forEach((section) => {
    section.classList.add('d-none');
  });
}

function closeOpenReplyForms() {
  const forms = document.querySelectorAll('#postsFeed .comment-reply-form');
  forms.forEach((form) => {
    form.remove();
  });
}

function isFeedPostOwnedByCurrentUser(postCard) {
  if (!postCard) return false;
  const authorId = String(postCard.dataset.postAuthorId || '').trim();
  return Boolean(feedCurrentUserId && authorId && authorId === feedCurrentUserId);
}

function getFeedPostContent(postCard) {
  return postCard?.querySelector('.post-content p')?.textContent || '';
}

function renderFeedPostContent(postCard, content) {
  const contentContainer = postCard?.querySelector('.post-content');
  if (!contentContainer) return;

  const normalized = String(content ?? '').trim();
  const existingParagraph = contentContainer.querySelector('p');

  if (!normalized) {
    if (existingParagraph) existingParagraph.remove();
    renderFeedPostLinkPreview(postCard, normalized);
    return;
  }

  const html = formatPostContentHtml(normalized);

  if (existingParagraph) {
    existingParagraph.innerHTML = html;
    renderFeedPostLinkPreview(postCard, normalized);
    return;
  }

  const paragraph = document.createElement('p');
  paragraph.className = 'mb-0';
  paragraph.innerHTML = html;
  contentContainer.prepend(paragraph);
  renderFeedPostLinkPreview(postCard, normalized);
}

function getFeedPostImageUrl(postCard) {
  const imageEl = postCard?.querySelector('.post-content .post-image');
  if (!imageEl) return null;
  return imageEl.getAttribute('data-photo-viewer-url') || imageEl.getAttribute('src') || null;
}

function renderFeedPostImage(postCard, imageUrl) {
  const contentContainer = postCard?.querySelector('.post-content');
  if (!contentContainer) return;

  const existingImage = contentContainer.querySelector('.post-image');
  const normalized = String(imageUrl || '').trim();
  const postId = String(postCard?.dataset?.postId || 'unknown');
  const gallery = `feed-post-${postId}`;

  if (!normalized) {
    if (existingImage) existingImage.remove();
    renderFeedPostLinkPreview(postCard, getFeedPostContent(postCard));
    return;
  }

  if (existingImage) {
    existingImage.src = normalized;
    existingImage.setAttribute('data-photo-viewer-url', normalized);
    existingImage.setAttribute('data-photo-gallery', gallery);
    existingImage.style.cursor = 'zoom-in';
    renderFeedPostLinkPreview(postCard, getFeedPostContent(postCard));
    return;
  }

  const imageEl = document.createElement('img');
  imageEl.src = normalized;
  imageEl.alt = 'Post image';
  imageEl.className = 'post-image mt-3';
  imageEl.loading = 'lazy';
  imageEl.setAttribute('data-photo-viewer-url', normalized);
  imageEl.setAttribute('data-photo-gallery', gallery);
  imageEl.style.cursor = 'zoom-in';
  contentContainer.appendChild(imageEl);
  renderFeedPostLinkPreview(postCard, getFeedPostContent(postCard));
}

function renderFeedPostLinkPreview(postCard, content) {
  const contentContainer = postCard?.querySelector('.post-content');
  if (!contentContainer) return;

  const existingPreview = contentContainer.querySelector('.post-link-preview');
  const hasImage = Boolean(contentContainer.querySelector('.post-image'));
  const nextPreviewHtml = createPostLinkPreviewHtml(content, { hidden: hasImage });

  if (!nextPreviewHtml) {
    if (existingPreview) existingPreview.remove();
    return;
  }

  if (existingPreview) {
    existingPreview.outerHTML = nextPreviewHtml;
    return;
  }

  contentContainer.insertAdjacentHTML('beforeend', nextPreviewHtml);
}

function ensureFeedPostEditorModal() {
  if (feedPostEditorState.modalEl) return feedPostEditorState.modalEl;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'feedPostEditorModal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-pencil-square me-2"></i>Edit Post</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="feedPostEditorContent" class="form-label">Post text</label>
            <textarea id="feedPostEditorContent" class="form-control" rows="4" maxlength="5000" placeholder="What's on your mind?"></textarea>
          </div>

          <div>
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="form-label mb-0">Image</span>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-theme btn-sm" id="feedPostEditorChangeImageBtn">
                  <i class="bi bi-image me-1"></i><span>Add Photo</span>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" id="feedPostEditorRemoveImageBtn">
                  <i class="bi bi-trash3 me-1"></i>Remove
                </button>
              </div>
            </div>
            <input id="feedPostEditorImageInput" class="d-none" type="file" accept="image/*">
            <div class="border rounded p-2 text-center bg-light">
              <img id="feedPostEditorPreview" class="img-fluid rounded d-none" alt="Post image preview" style="max-height: 220px; width: auto;">
              <p id="feedPostEditorNoImage" class="text-muted mb-0 small">No image</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-theme" id="feedPostEditorSaveBtn">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  feedPostEditorState.modalEl = modalEl;

  const imageInput = modalEl.querySelector('#feedPostEditorImageInput');
  const changeBtn = modalEl.querySelector('#feedPostEditorChangeImageBtn');
  const removeBtn = modalEl.querySelector('#feedPostEditorRemoveImageBtn');
  const saveBtn = modalEl.querySelector('#feedPostEditorSaveBtn');

  changeBtn?.addEventListener('click', () => {
    imageInput?.click();
  });

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0] || null;
    if (!file) return;
    feedPostEditorState.selectedFile = file;
    feedPostEditorState.removeImage = false;
    updateFeedPostEditorPreview();
  });

  removeBtn?.addEventListener('click', () => {
    feedPostEditorState.selectedFile = null;
    feedPostEditorState.removeImage = true;
    if (imageInput) imageInput.value = '';
    updateFeedPostEditorPreview();
  });

  saveBtn?.addEventListener('click', async () => {
    await submitFeedPostEditor();
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    if (feedPostEditorState.previewObjectUrl) {
      URL.revokeObjectURL(feedPostEditorState.previewObjectUrl);
      feedPostEditorState.previewObjectUrl = null;
    }
    feedPostEditorState.activePostCard = null;
    feedPostEditorState.activePostId = null;
    feedPostEditorState.currentImageUrl = null;
    feedPostEditorState.selectedFile = null;
    feedPostEditorState.removeImage = false;
    feedPostEditorState.isSubmitting = false;
    if (imageInput) imageInput.value = '';
  });

  return modalEl;
}

function updateFeedPostEditorPreview() {
  const modalEl = ensureFeedPostEditorModal();
  const previewEl = modalEl.querySelector('#feedPostEditorPreview');
  const noImageEl = modalEl.querySelector('#feedPostEditorNoImage');
  const changeBtnLabel = modalEl.querySelector('#feedPostEditorChangeImageBtn span');
  const removeBtn = modalEl.querySelector('#feedPostEditorRemoveImageBtn');

  if (!previewEl || !noImageEl) return;

  if (feedPostEditorState.previewObjectUrl) {
    URL.revokeObjectURL(feedPostEditorState.previewObjectUrl);
    feedPostEditorState.previewObjectUrl = null;
  }

  let previewUrl = null;
  if (feedPostEditorState.selectedFile) {
    previewUrl = URL.createObjectURL(feedPostEditorState.selectedFile);
    feedPostEditorState.previewObjectUrl = previewUrl;
  } else if (!feedPostEditorState.removeImage && feedPostEditorState.currentImageUrl) {
    previewUrl = feedPostEditorState.currentImageUrl;
  }

  if (previewUrl) {
    previewEl.src = previewUrl;
    previewEl.classList.remove('d-none');
    noImageEl.classList.add('d-none');
    if (changeBtnLabel) changeBtnLabel.textContent = 'Change';
    if (removeBtn) removeBtn.disabled = false;
    return;
  }

  previewEl.removeAttribute('src');
  previewEl.classList.add('d-none');
  noImageEl.classList.remove('d-none');
  if (changeBtnLabel) changeBtnLabel.textContent = 'Add Photo';
  if (removeBtn) removeBtn.disabled = true;
}

function openFeedPostEditor(postCard, postId) {
  const modalEl = ensureFeedPostEditorModal();
  const contentInput = modalEl.querySelector('#feedPostEditorContent');
  const saveBtn = modalEl.querySelector('#feedPostEditorSaveBtn');

  feedPostEditorState.activePostCard = postCard;
  feedPostEditorState.activePostId = postId;
  feedPostEditorState.currentImageUrl = getFeedPostImageUrl(postCard);
  feedPostEditorState.selectedFile = null;
  feedPostEditorState.removeImage = false;
  feedPostEditorState.isSubmitting = false;

  if (contentInput) {
    contentInput.value = getFeedPostContent(postCard);
    contentInput.focus();
    contentInput.setSelectionRange(contentInput.value.length, contentInput.value.length);
  }

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
  }

  updateFeedPostEditorPreview();
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function submitFeedPostEditor() {
  if (feedPostEditorState.isSubmitting) return;

  const modalEl = ensureFeedPostEditorModal();
  const contentInput = modalEl.querySelector('#feedPostEditorContent');
  const saveBtn = modalEl.querySelector('#feedPostEditorSaveBtn');

  const content = String(contentInput?.value || '').trim();
  if (!content) {
    showToast('Post content cannot be empty.', 'warning');
    contentInput?.focus();
    return;
  }

  const postCard = feedPostEditorState.activePostCard;
  const postId = feedPostEditorState.activePostId;
  if (!postCard || !postId) return;

  feedPostEditorState.isSubmitting = true;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
  }

  try {
    let nextImageUrl = feedPostEditorState.removeImage ? null : feedPostEditorState.currentImageUrl;
    if (feedPostEditorState.selectedFile) {
      nextImageUrl = await uploadPostImage(feedPostEditorState.selectedFile);
    }

    await updatePost(postId, {
      content,
      image_url: nextImageUrl,
    });

    renderFeedPostContent(postCard, content);
    renderFeedPostImage(postCard, nextImageUrl);
    showToast('Post updated.', 'success');
    bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  } catch (error) {
    console.error('Error updating post:', error);
    showToast('Failed to update post.', 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save Changes';
    }
    feedPostEditorState.isSubmitting = false;
  }
}

function ensureFeedConfirmModal() {
  const existing = document.getElementById('feedPostConfirmModal');
  if (existing) return existing;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'feedPostConfirmModal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="feedPostConfirmTitle">Confirm</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" id="feedPostConfirmMessage"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger" id="feedPostConfirmAcceptBtn">Delete</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  return modalEl;
}

function showFeedConfirmDialog(title, message, confirmLabel = 'Confirm') {
  const modalEl = ensureFeedConfirmModal();
  const titleEl = modalEl.querySelector('#feedPostConfirmTitle');
  const messageEl = modalEl.querySelector('#feedPostConfirmMessage');
  const acceptBtn = modalEl.querySelector('#feedPostConfirmAcceptBtn');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;

  return new Promise((resolve) => {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    let resolved = false;

    const onHidden = () => {
      if (resolved) return;
      resolved = true;
      resolve(false);
    };

    const onAccept = () => {
      if (resolved) return;
      resolved = true;
      resolve(true);
      modal.hide();
    };

    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
    acceptBtn?.addEventListener('click', onAccept, { once: true });
    modal.show();
  });
}

async function handleDeleteFeedPost(postCard, postId) {
  const confirmed = await showFeedConfirmDialog('Delete post', 'Delete this post? This action cannot be undone.', 'Delete');
  if (!confirmed) return;

  try {
    await deletePost(postId);
    postCard.remove();
    showToast('Post deleted.', 'success');
  } catch (error) {
    console.error('Error deleting post:', error);
    showToast('Failed to delete post.', 'error');
  }
}

function ensureFeedPhotoViewerModal() {
  if (feedPhotoViewerState.modalEl) return feedPhotoViewerState.modalEl;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'feedPhotoViewerModal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered modal-xl">
      <div class="modal-content bg-dark border-0">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title text-white">Photo Viewer</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body pt-2">
          <div class="position-relative d-flex justify-content-center align-items-center">
            <button type="button" class="btn btn-light position-absolute start-0 top-50 translate-middle-y ms-2" data-action="prev-photo" aria-label="Previous photo">
              <i class="bi bi-chevron-left"></i>
            </button>
            <img src="" alt="Post photo" class="img-fluid rounded" id="feedPhotoViewerImage" loading="lazy" style="max-height: 75vh; width: auto;">
            <button type="button" class="btn btn-light position-absolute end-0 top-50 translate-middle-y me-2" data-action="next-photo" aria-label="Next photo">
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          <div class="text-center text-white-50 small mt-3" id="feedPhotoViewerCounter"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  feedPhotoViewerState.modalEl = modalEl;

  modalEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    if (action === 'prev-photo') {
      showPreviousFeedPhoto();
    }
    if (action === 'next-photo') {
      showNextFeedPhoto();
    }
  });

  modalEl.addEventListener('shown.bs.modal', () => {
    feedPhotoViewerState.keyHandler = (event) => {
      if (event.key === 'ArrowLeft') showPreviousFeedPhoto();
      if (event.key === 'ArrowRight') showNextFeedPhoto();
    };
    document.addEventListener('keydown', feedPhotoViewerState.keyHandler);
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    if (feedPhotoViewerState.keyHandler) {
      document.removeEventListener('keydown', feedPhotoViewerState.keyHandler);
      feedPhotoViewerState.keyHandler = null;
    }
  });

  return modalEl;
}

function updateFeedPhotoViewerImage() {
  const modalEl = ensureFeedPhotoViewerModal();
  const imageEl = modalEl.querySelector('#feedPhotoViewerImage');
  const counterEl = modalEl.querySelector('#feedPhotoViewerCounter');
  const prevBtn = modalEl.querySelector('[data-action="prev-photo"]');
  const nextBtn = modalEl.querySelector('[data-action="next-photo"]');

  if (!imageEl) return;
  if (!feedPhotoViewerState.images.length) return;

  const total = feedPhotoViewerState.images.length;
  const normalizedIndex = ((feedPhotoViewerState.currentIndex % total) + total) % total;
  feedPhotoViewerState.currentIndex = normalizedIndex;

  imageEl.src = feedPhotoViewerState.images[normalizedIndex];
  if (counterEl) counterEl.textContent = `${normalizedIndex + 1} / ${total}`;

  const shouldShowArrows = total > 1;
  if (prevBtn) prevBtn.classList.toggle('d-none', !shouldShowArrows);
  if (nextBtn) nextBtn.classList.toggle('d-none', !shouldShowArrows);
}

function showPreviousFeedPhoto() {
  if (!feedPhotoViewerState.images.length) return;
  feedPhotoViewerState.currentIndex -= 1;
  updateFeedPhotoViewerImage();
}

function showNextFeedPhoto() {
  if (!feedPhotoViewerState.images.length) return;
  feedPhotoViewerState.currentIndex += 1;
  updateFeedPhotoViewerImage();
}

function openFeedPhotoViewer(images, startIndex = 0) {
  const validImages = (images || []).filter((url) => typeof url === 'string' && url.trim());
  if (!validImages.length) return;

  feedPhotoViewerState.images = validImages;
  feedPhotoViewerState.currentIndex = Math.max(0, startIndex);

  const modalEl = ensureFeedPhotoViewerModal();
  updateFeedPhotoViewerImage();
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function openFeedPhotoViewerFromTrigger(trigger) {
  if (!trigger) return;

  const imageUrl = trigger.getAttribute('data-photo-viewer-url');
  if (!imageUrl) return;

  const galleryName = trigger.getAttribute('data-photo-gallery');
  const postCard = trigger.closest('.post-card');

  let galleryTriggers = [trigger];
  if (galleryName && postCard) {
    galleryTriggers = Array.from(postCard.querySelectorAll(`[data-photo-viewer-url][data-photo-gallery="${CSS.escape(galleryName)}"]`));
  }

  const galleryImages = galleryTriggers
    .map((item) => item.getAttribute('data-photo-viewer-url'))
    .filter((url) => typeof url === 'string' && url.trim());

  if (!galleryImages.length) {
    openFeedPhotoViewer([imageUrl], 0);
    return;
  }

  const clickedIndex = galleryTriggers.indexOf(trigger);
  openFeedPhotoViewer(galleryImages, clickedIndex >= 0 ? clickedIndex : 0);
}

function updatePostReactionControl(postCard, reactionState) {
  const reactionBtn = postCard?.querySelector('.post-action-btn[data-action="react-post"]');
  if (!reactionBtn) return;

  const emojiEl = reactionBtn.querySelector('.reaction-emoji');
  const countEl = reactionBtn.querySelector('span:last-child');
  const reactionMeta = getReactionMeta(reactionState?.user_reaction || 'like');

  if (emojiEl) emojiEl.textContent = reactionMeta.emoji;
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

async function handlePostReactionToggle(button, postId) {
  if (!button || !postId) return;

  const currentReaction = String(button.dataset.userReaction || '').trim();

  try {
    if (currentReaction) {
      await clearPostReaction(postId);
    } else {
      await setPostReaction(postId, 'like');
    }

    const reactionState = await getPostReactionState(postId);
    const postCard = button.closest('.post-card');
    updatePostReactionControl(postCard, reactionState);
  } catch (error) {
    console.error('Error updating post reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

async function handlePostReactionSelect(postId, reactionType) {
  if (!postId || !reactionType) return;

  const postCard = document.querySelector(`.post-card[data-post-id="${CSS.escape(String(postId))}"]`);
  const reactionBtn = postCard?.querySelector('.post-action-btn[data-action="react-post"]');
  const currentReaction = String(reactionBtn?.dataset.userReaction || '').trim();

  try {
    if (currentReaction === reactionType) {
      await clearPostReaction(postId);
    } else {
      await setPostReaction(postId, reactionType);
    }

    const reactionState = await getPostReactionState(postId);
    updatePostReactionControl(postCard, reactionState);
  } catch (error) {
    console.error('Error setting post reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

/**
 * Handle comment button click
 * @param {HTMLElement} button - Comment button element
 * @param {string} postId - Post ID
 */
function handleComment(button, postId) {
  const postCard = button.closest('.post-card');
  
  // Check if comment section already exists
  let commentSection = postCard.querySelector('.comment-section');
  
  if (commentSection) {
    // Toggle visibility
    commentSection.classList.toggle('d-none');
    return;
  }

  // Create comment section
  commentSection = document.createElement('div');
  commentSection.className = 'comment-section p-3 border-top';
  commentSection.dataset.postId = postId;

  const user = getStoredUser();
  const currentUserAvatarUrl = resolveAvatarUrl(user, user?.avatar);

  commentSection.innerHTML = `
    <div class="d-flex gap-2 mb-3">
      <img src="${currentUserAvatarUrl}" 
           alt="Profile" class="rounded-circle" width="35" height="35" loading="lazy">
      <div class="flex-grow-1">
        <div class="input-group">
          <input type="text" class="form-control" placeholder="Write a comment...">
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

  // Insert after post actions
  const postActions = postCard.querySelector('.post-actions');
  postActions.after(commentSection);

  // Focus on input
  commentSection.querySelector('input').focus();

  // Load existing comments
  loadComments(postId, commentSection);

  // Handle comment submission
  const submitBtn = commentSection.querySelector('button');
  const input = commentSection.querySelector('input');

  submitBtn.addEventListener('click', () => submitComment(input, postId, commentSection));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitComment(input, postId, commentSection);
    }
  });

  commentSection.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action][data-comment-id]');
    const toggleBtn = e.target.closest('.comment-toggle-replies');

    if (toggleBtn) {
      const commentId = toggleBtn.dataset.commentId;
      const commentItem = commentSection.querySelector(`.comment-item[data-comment-id="${CSS.escape(commentId)}"]`);
      toggleReplies(commentItem);
      return;
    }

    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const commentId = actionBtn.dataset.commentId;

    if (action === 'react-comment' && commentId) {
      handleCommentReactionToggle(actionBtn, commentId);
    }

    if (action === 'set-comment-reaction' && commentId) {
      const reactionType = actionBtn.dataset.reactionType;
      if (reactionType) {
        handleCommentReactionSelect(commentSection, commentId, reactionType);
      }
    }

    if (action === 'edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleEditComment(commentId, commentItem, postId, commentSection);
    }

    if (action === 'save-edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleSaveCommentEdit(commentId, commentItem, postId, commentSection);
    }

    if (action === 'cancel-edit-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      handleCancelCommentEdit(commentItem);
    }

    if (action === 'delete-comment' && commentId) {
      handleDeleteComment(commentId, postId, commentSection);
    }

    if (action === 'reply-comment' && commentId) {
      const commentItem = actionBtn.closest('.comment-item');
      toggleReplyForm(commentItem, postId, commentId);
    }

    if (action === 'submit-reply' && commentId) {
      const replyInput = actionBtn.closest('.comment-reply-form')?.querySelector('input');
      if (replyInput) {
        submitReply(replyInput, postId, commentId, commentSection);
      }
    }
  });
}

async function loadComments(postId, commentSection) {
  const commentsList = commentSection.querySelector('.comments-list');
  if (!commentsList) return;

  try {
    const comments = await getPostComments(postId);
    if (!comments.length) {
      commentsList.innerHTML = '<div class="text-muted small">No comments yet.</div>';
      return;
    }

    renderCommentsList(comments, commentsList, postId);
  } catch (error) {
    console.error('Error loading comments:', error);
    commentsList.innerHTML = '<div class="text-muted small">Failed to load comments.</div>';
  }
}

/**
 * Submit a comment
 * @param {HTMLInputElement} input - Comment input element
 * @param {string} postId - Post ID
 * @param {HTMLElement} commentSection - Comment section element
 */
async function submitComment(input, postId, commentSection) {
  const commentText = input.value.trim();
  if (!commentText) return;

  // Disable input while submitting
  input.disabled = true;

  try {
    // Send comment to Supabase
    await createComment(postId, commentText, null);

    input.value = '';

    // Update comment count
    const postCard = commentSection.closest('.post-card');
    const commentBtn = postCard.querySelector('[data-action="comment"] span');
    if (commentBtn) {
      commentBtn.textContent = parseInt(commentBtn.textContent, 10) + 1;
    }

    await loadComments(postId, commentSection);
  } catch (error) {
    console.error('Error creating comment:', error);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function renderCommentsList(comments, commentsList, postId) {
  const tree = buildCommentTree(comments);
  commentsList.innerHTML = tree.map((comment) => renderCommentItem(comment, 0, postId)).join('');
}

function buildCommentTree(comments) {
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

function renderCommentItem(comment, depth, postId) {
  const fullName = comment?.profiles?.full_name || 'User';
  const avatarUrl = resolveAvatarUrl(comment?.profiles, comment?.profiles?.avatar_url);
  const likesCount = Number.isFinite(comment?.likes_count) ? comment.likes_count : 0;
  const safeId = escapeHtml(String(comment?.id || ''));
  const margin = Math.min(depth, 6) * 16;
  const replyCount = countReplies(comment);
  const replyLabel = replyCount === 1 ? 'reply' : 'replies';
  const manageActions = canManageComment(comment)
    ? `
      <button class="comment-action-btn" data-action="edit-comment" data-comment-id="${safeId}">Edit</button>
      <button class="comment-action-btn text-danger" data-action="delete-comment" data-comment-id="${safeId}">Delete</button>
    `
    : '';

  const repliesHtml = (comment.replies || []).map((reply) => renderCommentItem(reply, depth + 1, postId)).join('');

  return `
    <div class="comment-item" data-comment-id="${safeId}" style="margin-left: ${margin}px;">
      <div class="d-flex gap-2">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="rounded-circle" width="30" height="30" loading="lazy">
        <div class="comment-bubble">
          <strong class="d-block small">${escapeHtml(fullName)}</strong>
          <span class="small comment-content-text">${escapeHtml(comment.content || '')}</span>
          <div class="comment-actions">
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
            ${manageActions}
            ${replyCount ? `<span class="comment-reply-count comment-toggle-replies" data-comment-id="${safeId}">${replyCount} ${replyLabel}</span>` : ''}
          </div>
        </div>
      </div>
      ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
    </div>
  `;
}

function countReplies(comment) {
  if (!comment?.replies?.length) return 0;

  return comment.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0);
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
      <input type="text" class="form-control" placeholder="Write a reply...">
      <button class="btn btn-primary-gradient" type="button" data-action="submit-reply" data-comment-id="${escapeHtml(String(parentCommentId || ''))}">
        <i class="bi bi-send"></i>
      </button>
    </div>
  `;

  commentItem.querySelector('.comment-bubble')?.appendChild(replyForm);
  replyForm.querySelector('input')?.focus();

  replyForm.querySelector('input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
      submitBtn?.click();
    }
  });
}

function toggleReplies(commentItem) {
  if (!commentItem) return;

  const replies = commentItem.querySelector('.comment-replies');
  if (!replies) return;

  replies.classList.toggle('d-none');
}

function updateCommentReactionControl(commentSection, commentId, reactionState) {
  const reactionBtn = commentSection?.querySelector(`.comment-item[data-comment-id="${CSS.escape(String(commentId))}"] .comment-action-btn[data-action="react-comment"]`);
  if (!reactionBtn) return;

  const emojiEl = reactionBtn.querySelector('.reaction-emoji');
  const countEl = reactionBtn.querySelector('span:last-child');
  const reactionMeta = getReactionMeta(reactionState?.user_reaction || 'like');

  if (emojiEl) emojiEl.textContent = reactionMeta.emoji;
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

async function handleCommentReactionToggle(button, commentId) {
  if (!button || !commentId) return;

  const currentReaction = String(button.dataset.userReaction || '').trim();
  const commentSection = button.closest('.comment-section');

  try {
    if (currentReaction) {
      await clearCommentReaction(commentId);
    } else {
      await setCommentReaction(commentId, 'like');
    }

    const reactionState = await getCommentReactionState(commentId);
    updateCommentReactionControl(commentSection, commentId, reactionState);
  } catch (error) {
    console.error('Error updating comment reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

async function handleCommentReactionSelect(commentSection, commentId, reactionType) {
  if (!commentId || !reactionType) return;

  const reactionBtn = commentSection?.querySelector(`.comment-item[data-comment-id="${CSS.escape(String(commentId))}"] .comment-action-btn[data-action="react-comment"]`);
  const currentReaction = String(reactionBtn?.dataset.userReaction || '').trim();

  try {
    if (currentReaction === reactionType) {
      await clearCommentReaction(commentId);
    } else {
      await setCommentReaction(commentId, reactionType);
    }

    const reactionState = await getCommentReactionState(commentId);
    updateCommentReactionControl(commentSection, commentId, reactionState);
  } catch (error) {
    console.error('Error setting comment reaction:', error);
    showToast('Failed to update reaction.', 'error');
  }
}

async function submitReply(input, postId, parentCommentId, commentSection) {
  const replyText = input.value.trim();
  if (!replyText) return;

  input.disabled = true;

  try {
    await createComment(postId, replyText, parentCommentId);
    input.value = '';

    const postCard = commentSection.closest('.post-card');
    const commentBtn = postCard.querySelector('[data-action="comment"] span');
    if (commentBtn) {
      commentBtn.textContent = parseInt(commentBtn.textContent, 10) + 1;
    }

    await loadComments(postId, commentSection);
  } catch (error) {
    console.error('Error creating reply:', error);
    showToast('Failed to post reply. Please try again.', 'error');
  } finally {
    input.disabled = false;
  }
}

function updatePostCommentCount(commentSection, delta) {
  const postCard = commentSection?.closest('.post-card');
  const commentBtn = postCard?.querySelector('[data-action="comment"] span');
  if (!commentBtn) return;

  const current = parseInt(commentBtn.textContent, 10) || 0;
  const next = Math.max(0, current + delta);
  commentBtn.textContent = String(next);
}

async function handleDeleteComment(commentId, postId, commentSection) {
  const confirmed = window.confirm('Delete this comment?');
  if (!confirmed) return;

  try {
    await deleteComment(commentId);
    updatePostCommentCount(commentSection, -1);
    await loadComments(postId, commentSection);
    showToast('Comment deleted.', 'info');
  } catch (error) {
    console.error('Error deleting comment:', error);
    showToast('Failed to delete comment.', 'error');
  }
}

async function handleEditComment(commentId, commentItem, postId, commentSection) {
  startInlineCommentEdit(commentId, commentItem, postId, commentSection);
}

function setCommentEditingState(commentItem, editing) {
  if (!commentItem) return;

  const actionControls = commentItem.querySelectorAll('.comment-actions > .comment-action-btn, .comment-actions > .comment-reply-count');
  actionControls.forEach((control) => {
    control.classList.toggle('d-none', editing);
  });
}

function startInlineCommentEdit(commentId, commentItem, postId, commentSection) {
  if (!commentItem || commentItem.dataset.editing === 'true') return;

  const contentEl = commentItem.querySelector('.comment-content-text');
  const currentContent = String(contentEl?.textContent || '').trim();
  if (!contentEl || !currentContent) return;

  commentItem.dataset.editing = 'true';
  commentItem.dataset.originalCommentContent = currentContent;

  setCommentEditingState(commentItem, true);
  contentEl.classList.add('d-none');

  const editor = document.createElement('div');
  editor.className = 'comment-edit-form mt-2';

  const group = document.createElement('div');
  group.className = 'input-group input-group-sm';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control comment-edit-input';
  input.value = currentContent;
  input.maxLength = 1000;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary-gradient';
  saveBtn.dataset.action = 'save-edit-comment';
  saveBtn.dataset.commentId = String(commentId || '');
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-outline-secondary';
  cancelBtn.dataset.action = 'cancel-edit-comment';
  cancelBtn.dataset.commentId = String(commentId || '');
  cancelBtn.textContent = 'Cancel';

  group.appendChild(input);
  group.appendChild(saveBtn);
  group.appendChild(cancelBtn);
  editor.appendChild(group);
  contentEl.after(editor);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveBtn.click();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelBtn.click();
    }
  });

  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function handleCancelCommentEdit(commentItem) {
  if (!commentItem) return;

  const contentEl = commentItem.querySelector('.comment-content-text');
  const editor = commentItem.querySelector('.comment-edit-form');
  if (editor) editor.remove();

  if (contentEl) {
    const original = String(commentItem.dataset.originalCommentContent || contentEl.textContent || '').trim();
    contentEl.textContent = original;
    contentEl.classList.remove('d-none');
  }

  delete commentItem.dataset.editing;
  delete commentItem.dataset.originalCommentContent;
  setCommentEditingState(commentItem, false);
}

async function handleSaveCommentEdit(commentId, commentItem, postId, commentSection) {
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
    handleCancelCommentEdit(commentItem);
    return;
  }

  const buttons = commentItem.querySelectorAll('.comment-edit-form button');
  buttons.forEach((btn) => {
    btn.disabled = true;
  });

  try {
    await updateComment(commentId, normalized);
    await loadComments(postId, commentSection);
    showToast('Comment updated.', 'success');
  } catch (error) {
    console.error('Error updating comment:', error);
    buttons.forEach((btn) => {
      btn.disabled = false;
    });
    showToast('Failed to update comment.', 'error');
  }
}

/**
 * Handle share button click
 * @param {HTMLElement} button - Share button element
 * @param {string} postId - Post ID
 */
function handleShare(button, postId) {
  // Create share modal if it doesn't exist
  let shareModal = document.getElementById('shareModal');
  
  if (!shareModal) {
    shareModal = document.createElement('div');
    shareModal.id = 'shareModal';
    shareModal.className = 'modal fade';
    shareModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-share me-2"></i>Share Post</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="d-grid gap-2">
              <button class="btn btn-outline-primary text-start" data-share="copy">
                <i class="bi bi-link-45deg me-2"></i>Copy Link
              </button>
              <button class="btn btn-outline-primary text-start" data-share="facebook">
                <i class="bi bi-facebook me-2"></i>Share on Facebook
              </button>
              <button class="btn btn-outline-primary text-start" data-share="twitter">
                <i class="bi bi-twitter-x me-2"></i>Share on X
              </button>
              <button class="btn btn-outline-primary text-start" data-share="linkedin">
                <i class="bi bi-linkedin me-2"></i>Share on LinkedIn
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(shareModal);

    // Add event listeners for share buttons
    shareModal.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shareType = btn.dataset.share;
        handleShareAction(shareType, postId);
        bootstrap.Modal.getInstance(shareModal).hide();
      });
    });
  }

  // Show modal
  const modal = new bootstrap.Modal(shareModal);
  modal.show();
}

/**
 * Handle share action
 * @param {string} type - Share type (copy, facebook, twitter, linkedin)
 * @param {string} postId - Post ID
 */
function handleShareAction(type, postId) {
  const postUrl = `${window.location.origin}/post/${postId}`;

  switch (type) {
    case 'copy':
      navigator.clipboard.writeText(postUrl)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
      break;
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`, '_blank');
      break;
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}`, '_blank');
      break;
    case 'linkedin':
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`, '_blank');
      break;
  }
}

/**
 * Initialize load more posts functionality
 */
function initLoadMore() {
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!loadMoreBtn) return;

  loadMoreBtn.addEventListener('click', async () => {
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

    try {
      await loadMoreFeedPosts();
    } catch (error) {
      showToast('Failed to load posts', 'error');
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.innerHTML = '<i class="bi bi-arrow-down-circle me-2"></i>Load More Posts';
    }
  });
}

/**
 * Initialize search functionality
 */
function initSearch() {
  initUserSearch();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

function formatPostContentHtml(content) {
  const raw = String(content || '');
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(urlRegex)) {
    const index = match.index ?? 0;
    const urlText = match[0] || '';

    parts.push(escapeHtml(raw.slice(lastIndex, index)));

    const href = normalizeExternalUrl(urlText);
    if (href) {
      let displayText = urlText.replace(/^https?:\/\/(www\.)?/, '');
      if (displayText.length > 40) {
        displayText = displayText.substring(0, 38) + '...';
      }
      parts.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-decoration-none text-primary fw-medium" title="${escapeHtml(urlText)}">${escapeHtml(displayText)}</a>`);
    } else {
      parts.push(escapeHtml(urlText));
    }

    lastIndex = index + urlText.length;
  }

  parts.push(escapeHtml(raw.slice(lastIndex)));
  return parts.join('').replace(/\n/g, '<br>');
}

function extractFirstExternalUrl(content) {
  const raw = String(content || '');
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  for (const match of raw.matchAll(urlRegex)) {
    const candidate = String(match[0] || '').replace(/[),.;!?]+$/g, '');
    const href = normalizeExternalUrl(candidate);
    if (href) return href;
  }

  return null;
}

function getLinkPreviewImageUrl(url) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`;
}

function createPostLinkPreviewHtml(content, { hidden = false } = {}) {
  if (hidden) return '';

  const href = extractFirstExternalUrl(content);
  if (!href) return '';

  let host = href;
  try {
    host = new URL(href).hostname.replace(/^www\./, '');
  } catch {
    host = href;
  }

  const imageUrl = getLinkPreviewImageUrl(href);
  return `
    <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="post-link-preview mt-3" aria-label="Open link preview">
      <img src="${escapeHtml(imageUrl)}" alt="Link preview" class="post-link-preview-image" loading="lazy">
      <div class="post-link-preview-body">
        <span class="post-link-preview-domain">${escapeHtml(host)}</span>
        <span class="post-link-preview-url">${escapeHtml(href)}</span>
      </div>
    </a>
  `;
}

/**
 * Simple debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
