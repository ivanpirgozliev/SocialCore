/**
 * SocialCore - Profile Module
 * Handles user profile functionality
 */

import { showToast } from './main.js';
import { getProfile, updateProfile, getUserPosts, followUser, unfollowUser, isFollowing } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  // Load user profile data
  loadUserProfile();

  // Initialize profile actions
  initProfileActions();

  // Initialize post actions on profile page
  initPostActions();

  // Initialize tab navigation
  initTabNavigation();
});

/**
 * Load user profile from Supabase
 */
async function loadUserProfile() {
  try {
    const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
    
    if (!userData.id) {
      window.location.href = 'login.html';
      return;
    }

    // Get profile from Supabase
    const profile = await getProfile(userData.id);
    
    // Update UI with real data
    updateProfileUI(profile);
    
    // Load user posts
    const posts = await getUserPosts(userData.id);
    updatePostsUI(posts);
    
  } catch (error) {
    console.error('Error loading profile:', error);
    // If error, use local storage data as fallback
    const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
    updateProfileUIFromLocalStorage(userData);
  }
}

/**
 * Update profile UI with Supabase data
 */
function updateProfileUI(profile) {
  // Update name
  const nameElement = document.querySelector('.profile-info h2');
  if (nameElement) nameElement.textContent = profile.full_name;
  
  // Update username
  const usernameElement = document.querySelector('.profile-info p.text-muted');
  if (usernameElement) usernameElement.textContent = `@${profile.username}`;
  
  // Remove the hardcoded location/work line (third paragraph)
  const profileInfo = document.querySelector('.profile-info');
  if (profileInfo) {
    const allParagraphs = profileInfo.querySelectorAll('p');
    // Remove the paragraph with location/work info (usually 3rd p tag)
    if (allParagraphs[2]) {
      allParagraphs[2].remove();
    }
  }
  
  // Update bio (should be the last paragraph before buttons, now 3rd after removal)
  const bioParagraphs = document.querySelectorAll('.profile-info p');
  let bioElement = bioParagraphs[bioParagraphs.length - 1]; // Get last paragraph
  
  // Make sure we're not selecting the username paragraph
  if (bioElement && !bioElement.classList.contains('text-muted')) {
    if (profile.bio) {
      bioElement.textContent = profile.bio;
      bioElement.className = 'mb-3'; // Reset classes
    } else {
      bioElement.textContent = 'No bio yet.';
      bioElement.className = 'mb-3 text-muted';
    }
  }
  
  // Update About section in sidebar
  const aboutList = document.querySelector('.card-body ul.list-unstyled');
  if (aboutList) {
    // Clear existing content
    aboutList.innerHTML = '';
    
    // Add location if exists
    if (profile.location) {
      const locationLi = document.createElement('li');
      locationLi.className = 'mb-2 d-flex align-items-center';
      locationLi.innerHTML = `
        <i class="bi bi-geo-alt me-3 text-muted"></i>
        <span>Lives in <strong>${escapeHtml(profile.location)}</strong></span>
      `;
      aboutList.appendChild(locationLi);
    }
    
    // Add website if exists
    if (profile.website) {
      const websiteLi = document.createElement('li');
      websiteLi.className = 'mb-2 d-flex align-items-center';
      const websiteUrl = profile.website;
      const displayText = websiteUrl.replace(/^https?:\/\//, '');
      websiteLi.innerHTML = `
        <i class="bi bi-link-45deg me-3 text-muted"></i>
        <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener">${escapeHtml(displayText)}</a>
      `;
      aboutList.appendChild(websiteLi);
    }
    
    // Add joined date
    if (profile.created_at) {
      const joinedLi = document.createElement('li');
      joinedLi.className = 'd-flex align-items-center';
      const joinedDate = new Date(profile.created_at);
      const formattedDate = joinedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      joinedLi.innerHTML = `
        <i class="bi bi-calendar3 me-3 text-muted"></i>
        <span>Joined <strong>${formattedDate}</strong></span>
      `;
      aboutList.appendChild(joinedLi);
    }
    
    // If no data to show, display a message
    if (aboutList.children.length === 0) {
      aboutList.innerHTML = '<li class="text-muted text-center">No information added yet.</li>';
    }
  }
  
  // Update avatar
  const avatarElements = document.querySelectorAll('img[alt*="John"], img[alt*="User"]');
  avatarElements.forEach(img => {
    img.src = profile.avatar_url;
    img.alt = profile.full_name;
  });
  
  // Update cover photo if exists
  if (profile.cover_photo_url) {
    const coverElement = document.querySelector('.profile-cover');
    if (coverElement) {
      coverElement.style.backgroundImage = `url(${profile.cover_photo_url})`;
      coverElement.style.backgroundSize = 'cover';
      coverElement.style.backgroundPosition = 'center';
    }
  }
}

/**
 * Update profile UI from local storage (fallback)
 */
function updateProfileUIFromLocalStorage(userData) {
  const nameElement = document.querySelector('.profile-info h2');
  if (nameElement) nameElement.textContent = userData.name || 'User';
  
  const usernameElement = document.querySelector('.profile-info p.text-muted');
  if (usernameElement) usernameElement.textContent = `@${userData.username || 'user'}`;
  
  const avatarElements = document.querySelectorAll('img[alt*="John"], img[alt*="User"]');
  avatarElements.forEach(img => {
    img.src = userData.avatar || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff';
    img.alt = userData.name || 'User';
  });
}

/**
 * Update posts UI
 */
function updatePostsUI(posts) {
  const postsContainer = document.getElementById('postsContent');
  if (!postsContainer) return;
  
  if (!posts || posts.length === 0) {
    postsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-inbox fs-1 text-muted"></i>
        <p class="text-muted mt-3">No posts yet. Start sharing your thoughts!</p>
        <a href="create-post.html" class="btn btn-primary-gradient mt-3">
          <i class="bi bi-plus-circle me-2"></i>Create Post
        </a>
      </div>
    `;
    return;
  }
  
  // Clear existing content
  postsContainer.innerHTML = '';
  
  // Render posts
  posts.forEach(post => {
    const postCard = createPostCard(post);
    postsContainer.insertAdjacentHTML('beforeend', postCard);
  });
}

/**
 * Create post card HTML
 */
function createPostCard(post) {
  const relativeTime = formatRelativeTime(new Date(post.created_at));
  
  return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <img src="${post.profiles.avatar_url}" alt="${post.profiles.full_name}" class="post-avatar">
        <div>
          <div class="post-author">${post.profiles.full_name}</div>
          <div class="post-time">${relativeTime}</div>
        </div>
      </div>
      <div class="post-content">
        <p>${escapeHtml(post.content)}</p>
        ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ''}
      </div>
      <div class="post-actions">
        <button class="post-action-btn" data-action="like">
          <i class="bi bi-heart"></i>
          <span>${post.likes_count || 0}</span>
        </button>
        <button class="post-action-btn" data-action="comment">
          <i class="bi bi-chat"></i>
          <span>${post.comments_count || 0}</span>
        </button>
        <button class="post-action-btn" data-action="share">
          <i class="bi bi-share"></i>
          <span>${post.shares_count || 0}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Format relative time
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize profile action buttons
 */
function initProfileActions() {
  // Edit profile button
  const editProfileBtn = document.querySelector('.btn-primary-gradient');
  if (editProfileBtn && editProfileBtn.textContent.includes('Edit Profile')) {
    editProfileBtn.addEventListener('click', () => {
      openEditProfileModal();
    });
  }

  // Share profile button
  const shareProfileBtn = document.querySelector('.btn-outline-primary');
  if (shareProfileBtn && shareProfileBtn.textContent.includes('Share Profile')) {
    shareProfileBtn.addEventListener('click', () => {
      shareProfile();
    });
  }

  // Edit cover button
  const editCoverBtn = document.querySelector('.profile-cover .btn');
  if (editCoverBtn) {
    editCoverBtn.addEventListener('click', () => {
      showToast('Cover photo upload coming soon!', 'info');
    });
  }
}

/**
 * Open edit profile modal
 */
async function openEditProfileModal() {
  const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
  
  // Get profile data from Supabase
  let profile = null;
  try {
    profile = await getProfile(userData.id);
  } catch (error) {
    console.error('Error loading profile:', error);
  }
  
  // Split full name and escape for HTML
  const nameParts = (profile?.full_name || userData.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Prepare safe values for HTML
  const safeFirstName = firstName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeLastName = lastName.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeUsername = (profile?.username || userData.username || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeBio = (profile?.bio || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeLocation = (profile?.location || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const safeWebsite = (profile?.website || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const avatarUrl = profile?.avatar_url || userData.avatar || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff&size=100';
  
  // Check if modal already exists
  let editModal = document.getElementById('editProfileModal');
  
  if (!editModal) {
    // Create modal
    editModal = document.createElement('div');
    editModal.id = 'editProfileModal';
    editModal.className = 'modal fade';
    editModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Profile</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="editProfileForm">
              <!-- Profile Picture -->
              <div class="text-center mb-4">
                <img src="${avatarUrl}" 
                     alt="Profile" class="rounded-circle mb-2" width="100" height="100">
                <div>
                  <label class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-camera me-1"></i>Change Photo
                    <input type="file" accept="image/*" class="d-none" id="profilePhotoInput">
                  </label>
                  <small class="d-block text-muted mt-1">Photo upload coming soon</small>
                </div>
              </div>
              
              <!-- Name Fields -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">First Name</label>
                  <input type="text" class="form-control" id="editFirstName" value="${safeFirstName}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Last Name</label>
                  <input type="text" class="form-control" id="editLastName" value="${safeLastName}">
                </div>
              </div>
              
              <!-- Username -->
              <div class="mb-3">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text">@</span>
                  <input type="text" class="form-control" id="editUsername" value="${safeUsername}" required pattern="[a-zA-Z0-9_]+" title="Only letters, numbers and underscores allowed">
                </div>
              </div>
              
              <!-- Bio -->
              <div class="mb-3">
                <label class="form-label">Bio</label>
                <textarea class="form-control" id="editBio" rows="3" maxlength="160">${safeBio}</textarea>
                <small class="text-muted"><span id="bioCharCount">${safeBio.length}</span>/160 characters</small>
              </div>
              
              <!-- Location -->
              <div class="mb-3">
                <label class="form-label">Location</label>
                <input type="text" class="form-control" id="editLocation" value="${safeLocation}" placeholder="City, Country">
              </div>
              
              <!-- Website -->
              <div class="mb-3">
                <label class="form-label">Website</label>
                <input type="url" class="form-control" id="editWebsite" value="${safeWebsite}" placeholder="https://yourwebsite.com">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary-gradient" id="saveProfileBtn">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(editModal);

    // Add event listeners
    const bioTextarea = editModal.querySelector('#editBio');
    const charCount = editModal.querySelector('#bioCharCount');
    
    bioTextarea.addEventListener('input', () => {
      const length = bioTextarea.value.length;
      charCount.textContent = length;
      charCount.parentElement.className = length > 140 ? 'text-danger' : 'text-muted';
    });

    const saveBtn = editModal.querySelector('#saveProfileBtn');
    saveBtn.addEventListener('click', () => {
      saveProfile();
      bootstrap.Modal.getInstance(editModal).hide();
    });
  }

  // Show modal
  const modal = new bootstrap.Modal(editModal);
  modal.show();
}

/**
 * Save profile changes
 */
async function saveProfile() {
  const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
  
  const profileData = {
    full_name: `${document.getElementById('editFirstName')?.value || ''} ${document.getElementById('editLastName')?.value || ''}`.trim(),
    username: document.getElementById('editUsername')?.value,
    bio: document.getElementById('editBio')?.value,
    location: document.getElementById('editLocation')?.value || null,
    website: document.getElementById('editWebsite')?.value || null,
  };

  try {
    await updateProfile(userData.id, profileData);
    
    // Update local storage
    userData.name = profileData.full_name;
    userData.username = profileData.username;
    localStorage.setItem('socialcore_user', JSON.stringify(userData));
    
    showToast('Profile updated successfully!', 'success');
    
    // Reload page to show updates
    setTimeout(() => location.reload(), 1500);
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast('Failed to update profile. Please try again.', 'error');
  }
}

/**
 * Share profile
 */
function shareProfile() {
  const profileUrl = window.location.href;
  
  // Try native share API first
  if (navigator.share) {
    navigator.share({
      title: 'John Doe - SocialCore',
      text: 'Check out my profile on SocialCore!',
      url: profileUrl,
    }).catch(() => {
      // Fallback to clipboard
      copyToClipboard(profileUrl);
    });
  } else {
    copyToClipboard(profileUrl);
  }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('Profile link copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy link', 'error'));
}

/**
 * Initialize post actions on profile page
 */
function initPostActions() {
  const profilePosts = document.querySelectorAll('.post-card');
  
  profilePosts.forEach((postCard) => {
    // Like button
    const likeBtn = postCard.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => handleLike(likeBtn));
    }

    // Comment button
    const commentBtn = postCard.querySelector('[data-action="comment"]');
    if (commentBtn) {
      commentBtn.addEventListener('click', () => {
        showToast('Comments feature coming soon!', 'info');
      });
    }

    // Share button
    const shareBtn = postCard.querySelector('[data-action="share"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        copyToClipboard(window.location.href);
      });
    }
  });
}

/**
 * Handle like button click
 * @param {HTMLElement} button - Like button element
 */
function handleLike(button) {
  const icon = button.querySelector('i');
  const countSpan = button.querySelector('span');
  let count = parseInt(countSpan.textContent) || 0;

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

/**
 * Initialize tab navigation on profile page
 */
function initTabNavigation() {
  const navPills = document.querySelectorAll('.nav-pills .nav-link');
  
  navPills.forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all pills
      navPills.forEach((p) => p.classList.remove('active'));
      
      // Add active class to clicked pill
      pill.classList.add('active');

      // Show corresponding content (to be implemented)
      const tabName = pill.textContent.trim();
      console.log('Switching to tab:', tabName);
      
      showToast(`${tabName} section coming soon!`, 'info');
    });
  });
}
