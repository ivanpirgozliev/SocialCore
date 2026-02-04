/**
 * SocialCore - Feed Module
 * Handles posts feed functionality
 */

import { showToast, formatRelativeTime, getStoredUser, refreshStoredUserFromProfile } from './main.js';
import { getFeedPosts, likePost, unlikePost, isPostLiked, createComment, getPostComments } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  // Hydrate current user (avatar/name/username) and update Feed UI
  initCurrentUserFeedUI();

  // Initialize post actions (like, comment, share)
  initPostActions();

  // Initialize load more functionality
  initLoadMore();

  // Initialize search functionality
  initSearch();
});

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

    commentsList.innerHTML = comments.map((comment) => {
      const fullName = comment?.profiles?.full_name || 'User';
      const avatarUrl = comment?.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff';
      return `
        <div class="d-flex gap-2 mb-2">
          <img src="${avatarUrl}" alt="${escapeHtml(fullName)}" class="rounded-circle" width="30" height="30" loading="lazy">
          <div class="bg-light rounded p-2 flex-grow-1">
            <strong class="d-block small">${escapeHtml(fullName)}</strong>
            <span class="small">${escapeHtml(comment.content || '')}</span>
          </div>
        </div>
      `;
    }).join('');
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
    const comment = await createComment(postId, commentText);

    // Create new comment element
    const commentsList = commentSection.querySelector('.comments-list');
    const newComment = document.createElement('div');
    newComment.className = 'd-flex gap-2 mb-2';
    newComment.innerHTML = `
      <img src="${comment.profiles.avatar_url}" 
           alt="${comment.profiles.full_name}" class="rounded-circle" width="30" height="30">
      <div class="bg-light rounded p-2 flex-grow-1">
        <strong class="d-block small">${escapeHtml(comment.profiles.full_name)}</strong>
        <span class="small">${escapeHtml(commentText)}</span>
      </div>
    `;

    commentsList.appendChild(newComment);
    input.value = '';

    // Update comment count
    const postCard = commentSection.closest('.post-card');
    const commentBtn = postCard.querySelector('[data-action="comment"] span');
    if (commentBtn) {
      commentBtn.textContent = parseInt(commentBtn.textContent) + 1;
    }
  } catch (error) {
    console.error('Error creating comment:', error);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    input.disabled = false;
    input.focus();
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
      // TODO: Fetch more posts from Supabase
      await simulateLoadMore();

      // Add mock posts
      const postsFeed = document.getElementById('postsFeed');
      const newPost = createMockPost();
      postsFeed.appendChild(newPost);

      showToast('Posts loaded!', 'success');
    } catch (error) {
      showToast('Failed to load posts', 'error');
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.innerHTML = '<i class="bi bi-arrow-down-circle me-2"></i>Load More Posts';
    }
  });
}

/**
 * Simulate loading more posts
 * @returns {Promise} Resolves after delay
 */
function simulateLoadMore() {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Create a mock post element
 * @returns {HTMLElement} Post element
 */
function createMockPost() {
  const post = document.createElement('article');
  post.className = 'post-card';
  post.innerHTML = `
    <div class="post-header">
      <img src="https://ui-avatars.com/api/?name=New+User&background=8B5CF6&color=fff" 
           alt="New User" class="post-avatar">
      <div>
        <a href="profile.html" class="post-author text-decoration-none">New User</a>
        <p class="post-time mb-0">Just now</p>
      </div>
      <div class="ms-auto">
        <button class="btn btn-link text-muted p-0" type="button" data-bs-toggle="dropdown">
          <i class="bi bi-three-dots"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="#"><i class="bi bi-bookmark me-2"></i>Save Post</a></li>
          <li><a class="dropdown-item" href="#"><i class="bi bi-flag me-2"></i>Report</a></li>
        </ul>
      </div>
    </div>
    <div class="post-content">
      <p>This is a newly loaded post! Thanks for scrolling down. 👋</p>
    </div>
    <div class="post-actions">
      <button class="post-action-btn" data-action="like">
        <i class="bi bi-heart"></i>
        <span>0</span>
      </button>
      <button class="post-action-btn" data-action="comment">
        <i class="bi bi-chat"></i>
        <span>0</span>
      </button>
      <button class="post-action-btn" data-action="share">
        <i class="bi bi-share"></i>
        <span>Share</span>
      </button>
    </div>
  `;
  return post;
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
