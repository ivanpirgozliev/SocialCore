/**
 * SocialCore - Feed Module
 * Handles posts feed functionality
 */

import { showToast, formatRelativeTime, getStoredUser, refreshStoredUserFromProfile } from './main.js';
import { getFeedPosts, likePost, unlikePost, createComment, getPostComments, likeComment, unlikeComment, getFriendSuggestions, getFriendRequests, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest } from './database.js';

const FEED_PAGE_SIZE = 10;
let feedOffset = 0;
let isLoadingFeed = false;

document.addEventListener('DOMContentLoaded', () => {
  // Hydrate current user (avatar/name/username) and update Feed UI
  initCurrentUserFeedUI();

  // Load initial feed posts
  loadInitialFeedPosts();

  // Load people you may know suggestions
  initPeopleYouMayKnow();

  // Initialize follow actions
  initPeopleYouMayKnowActions();

  // Load notification menu
  loadNotifications();

  // Initialize notification actions
  initNotificationActions();

  // Initialize post actions (like, comment, share)
  initPostActions();

  // Initialize load more functionality
  initLoadMore();

  // Initialize search functionality
  initSearch();
});

async function loadInitialFeedPosts() {
  const postsFeed = document.getElementById('postsFeed');
  if (!postsFeed) return;

  isLoadingFeed = true;
  feedOffset = 0;

  try {
    const posts = await getFeedPosts(FEED_PAGE_SIZE, feedOffset);
    postsFeed.innerHTML = '';

    if (!posts.length) {
      postsFeed.innerHTML = buildEmptyStateHtml();
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
    const posts = await getFeedPosts(FEED_PAGE_SIZE, feedOffset);
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
  const avatarUrl = post?.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;
  const contentHtml = escapeHtml(post?.content || '').replace(/\n/g, '<br>');
  const timeText = post?.created_at ? formatRelativeTime(post.created_at) : '';

  const likesCount = Number.isFinite(post?.likes_count) ? post.likes_count : 0;
  const commentsCount = Number.isFinite(post?.comments_count) ? post.comments_count : 0;
  const isLiked = !!post?.liked_by_user;
  const likeIcon = isLiked ? 'bi-heart-fill' : 'bi-heart';
  const likeClass = isLiked ? 'liked' : '';
  const commentClass = commentsCount > 0 ? 'has-comments' : '';

  return `
    <article class="post-card" data-post-id="${escapeHtml(String(post?.id || ''))}">
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
            <li><a class="dropdown-item" href="#"><i class="bi bi-bookmark me-2"></i>Save Post</a></li>
            <li><a class="dropdown-item" href="#"><i class="bi bi-flag me-2"></i>Report</a></li>
          </ul>
        </div>
      </div>
      <div class="post-content">
        ${contentHtml ? `<p class="mb-0">${contentHtml}</p>` : ''}
        ${post?.image_url ? `<img src="${escapeHtml(post.image_url)}" alt="Post image" class="post-image mt-3" loading="lazy">` : ''}
      </div>
      <div class="post-actions">
        <button class="post-action-btn ${likeClass}" data-action="like" type="button" aria-label="Like">
          <i class="bi ${likeIcon}"></i>
          <span>${likesCount}</span>
        </button>
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

function buildEmptyStateHtml(title = 'No posts yet') {
  return `
    <div class="card text-center py-5">
      <div class="card-body">
        <i class="bi bi-inbox fs-1 text-muted mb-3 d-block"></i>
        <h5 class="text-muted">${escapeHtml(title)}</h5>
        <p class="text-gray-500 mb-3">Start following people or create your first post!</p>
        <a href="create-post.html" class="btn btn-primary-gradient">
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
    const [requests, suggestions] = await Promise.all([
      getFriendRequests(),
      getFriendSuggestions(8),
    ]);

    if (!requests.length && !suggestions.length) {
      list.innerHTML = '<div class="text-muted small">No suggestions right now.</div>';
      list.classList.remove('has-overflow');
      return;
    }

    const requestHtml = requests.map((request) => buildIncomingRequestHtml(request)).join('');
    const suggestionHtml = suggestions.map((user) => buildSuggestionHtml(user)).join('');

    list.innerHTML = `${requestHtml}${suggestionHtml}`;
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
    await Promise.all([initPeopleYouMayKnow(), loadNotifications()]);
  });
}

function buildSuggestionHtml(user) {
  const fullName = user?.full_name || user?.username || 'User';
  const profileHref = user?.id ? `profile.html?id=${encodeURIComponent(user.id)}` : 'profile.html';
  const avatarUrl = user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;
  const mutualFriends = Number.isFinite(user?.mutual_friends) ? user.mutual_friends : 0;
  const mutualLabel = mutualFriends === 1 ? 'mutual friend' : 'mutual friends';

  return `
    <div class="suggestion-card" data-user-id="${escapeHtml(String(user?.id || ''))}">
      <div class="suggestion-card-body">
        <div class="friend-item">
          <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="friend-avatar" loading="lazy">
          </a>
          <div class="flex-grow-1">
            <a href="${escapeHtml(profileHref)}" class="friend-name mb-0 text-decoration-none">${escapeHtml(fullName)}</a>
            <small class="text-muted d-block mutual-friends">${mutualFriends} ${mutualLabel}</small>
          </div>
        </div>
        <button class="btn btn-primary-gradient btn-sm suggestion-action" type="button" data-action="add-friend" data-state="none" data-user-id="${escapeHtml(String(user?.id || ''))}">
          <i class="bi bi-person-plus me-1"></i>Add Friend
        </button>
      </div>
    </div>
  `;
}

function buildIncomingRequestHtml(request) {
  const fullName = request?.full_name || request?.username || 'User';
  const profileHref = request?.id ? `profile.html?id=${encodeURIComponent(request.id)}` : 'profile.html';
  const avatarUrl = request?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;

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
      const avatarUrl = request?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;
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
      await Promise.all([loadNotifications(), initPeopleYouMayKnow()]);
      return;
    }

    await Promise.all([loadNotifications(), initPeopleYouMayKnow()]);
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
    const actionBtn = e.target.closest('.post-action-btn');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const postCard = actionBtn.closest('.post-card');
    const postId = postCard?.dataset?.postId;

    switch (action) {
      case 'like':
        handleLike(actionBtn, postId);
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

/**
 * Handle like button click
 * @param {HTMLElement} button - Like button element
 * @param {string} postId - Post ID
 */
async function handleLike(button, postId) {
  const icon = button.querySelector('i');
  const countSpan = button.querySelector('span');
  let count = parseInt(countSpan.textContent) || 0;

  // Toggle like state
  if (button.classList.contains('liked')) {
    // Unlike
    button.classList.remove('liked');
    icon.classList.remove('bi-heart-fill');
    icon.classList.add('bi-heart');
    count--;
  } else {
    // Like
    button.classList.add('liked');
    icon.classList.remove('bi-heart');
    icon.classList.add('bi-heart-fill');
    count++;

    // Add animation
    button.classList.add('animate-pulse');
    setTimeout(() => {
      button.classList.remove('animate-pulse');
    }, 500);
  }

  countSpan.textContent = count;

  // Send like/unlike to Supabase
  try {
    if (button.classList.contains('liked')) {
      await likePost(postId);
    } else {
      await unlikePost(postId);
    }
  } catch (error) {
    console.error('Error updating like:', error);
    // Revert UI changes on error
    if (button.classList.contains('liked')) {
      button.classList.remove('liked');
      icon.classList.remove('bi-heart-fill');
      icon.classList.add('bi-heart');
      count--;
    } else {
      button.classList.add('liked');
      icon.classList.remove('bi-heart');
      icon.classList.add('bi-heart-fill');
      count++;
    }
    countSpan.textContent = count;
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
  const currentUserAvatarUrl = user?.avatar || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff';

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
    const actionBtn = e.target.closest('.comment-action-btn');
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

    if (action === 'like-comment' && commentId) {
      handleCommentLike(actionBtn, commentId);
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
  const avatarUrl = comment?.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff';
  const likesCount = Number.isFinite(comment?.likes_count) ? comment.likes_count : 0;
  const isLiked = !!comment?.liked_by_user;
  const likeIcon = isLiked ? 'bi-heart-fill' : 'bi-heart';
  const likeClass = isLiked ? 'liked' : '';
  const safeId = escapeHtml(String(comment?.id || ''));
  const margin = Math.min(depth, 6) * 16;
  const replyCount = countReplies(comment);
  const replyLabel = replyCount === 1 ? 'reply' : 'replies';

  const repliesHtml = (comment.replies || []).map((reply) => renderCommentItem(reply, depth + 1, postId)).join('');

  return `
    <div class="comment-item" data-comment-id="${safeId}" style="margin-left: ${margin}px;">
      <div class="d-flex gap-2">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="rounded-circle" width="30" height="30" loading="lazy">
        <div class="comment-bubble">
          <strong class="d-block small">${escapeHtml(fullName)}</strong>
          <span class="small">${escapeHtml(comment.content || '')}</span>
          <div class="comment-actions">
            <button class="comment-action-btn ${likeClass}" data-action="like-comment" data-comment-id="${safeId}">
              <i class="bi ${likeIcon}"></i>
              <span>${likesCount}</span>
            </button>
            <button class="comment-action-btn" data-action="reply-comment" data-comment-id="${safeId}">Reply</button>
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

async function handleCommentLike(button, commentId) {
  const icon = button.querySelector('i');
  const countSpan = button.querySelector('span');
  let count = parseInt(countSpan.textContent, 10) || 0;

  if (button.classList.contains('liked')) {
    button.classList.remove('liked');
    icon.classList.remove('bi-heart-fill');
    icon.classList.add('bi-heart');
    count--;
  } else {
    button.classList.add('liked');
    icon.classList.remove('bi-heart');
    icon.classList.add('bi-heart-fill');
    count++;
  }

  countSpan.textContent = count;

  try {
    if (button.classList.contains('liked')) {
      await likeComment(commentId);
    } else {
      await unlikeComment(commentId);
    }
  } catch (error) {
    console.error('Error updating comment like:', error);
    if (button.classList.contains('liked')) {
      button.classList.remove('liked');
      icon.classList.remove('bi-heart-fill');
      icon.classList.add('bi-heart');
      count--;
    } else {
      button.classList.add('liked');
      icon.classList.remove('bi-heart');
      icon.classList.add('bi-heart-fill');
      count++;
    }
    countSpan.textContent = count;
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
  const searchInput = document.querySelector('form[role="search"] input');
  if (!searchInput) return;

  searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim();
    if (query.length >= 2) {
      // TODO: Implement search with Supabase
      console.log('Searching for:', query);
    }
  }, 300));
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
