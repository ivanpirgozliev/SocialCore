/**
 * SocialCore - Profile Module
 * Handles user profile functionality
 */

import { showToast, getStoredUser, refreshStoredUserFromProfile } from './main.js';
import { supabase } from './supabase.js';
import { getProfile, getProfileIdByUsername, updateProfile, getUserPosts, followUser, unfollowUser, isFollowing, uploadProfileImage, checkIsAdmin, likePost, unlikePost, createComment, getPostComments, likeComment, unlikeComment } from './database.js';

const PHOTOS_BUCKET_ID = 'post-images';
const USER_PHOTOS_FOLDER = 'photos';

let profileView = {
  authUserId: null,
  profileUserId: null,
  isOwnProfile: true,
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();

  // Initialize profile actions
  initProfileActions();

  // Initialize post actions on profile page
  initPostActions();

  // Initialize tab navigation
  initTabNavigation();
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function resolveProfileUserId(authUserId) {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam && isUuid(idParam)) return idParam;

  const usernameParam = params.get('user') || params.get('username') || params.get('u');
  if (usernameParam) {
    const { id } = await getProfileIdByUsername(usernameParam);
    return id;
  }

  return authUserId;
}

function applyProfileViewMode() {
  const { isOwnProfile } = profileView;

  const myProfileNavItem = document.getElementById('myProfileNavItem');
  const myProfileNavLink = document.getElementById('myProfileNavLink');
  if (myProfileNavItem) myProfileNavItem.classList.toggle('d-none', isOwnProfile);
  if (myProfileNavLink && profileView.authUserId) {
    myProfileNavLink.href = `profile.html?id=${encodeURIComponent(profileView.authUserId)}`;
  }

  const photosSeeAll = document.getElementById('profilePhotosSeeAllLink');
  if (photosSeeAll && profileView.profileUserId) {
    photosSeeAll.href = `photos.html?id=${encodeURIComponent(profileView.profileUserId)}`;
  }

  const editProfileBtn = document.querySelector('.btn-primary-gradient');
  if (editProfileBtn && editProfileBtn.textContent.includes('Edit Profile')) {
    editProfileBtn.classList.toggle('d-none', !isOwnProfile);
  }

  const editCoverBtn = document.querySelector('.profile-cover-edit-btn');
  if (editCoverBtn) editCoverBtn.classList.toggle('d-none', !isOwnProfile);

  const avatarImg = document.querySelector('.profile-avatar-large');
  if (avatarImg && !isOwnProfile) {
    avatarImg.style.cursor = 'default';
    avatarImg.title = '';
  }

  const createPostAvatar = document.getElementById('profileCreatePostAvatar');
  const createPostCard = createPostAvatar?.closest('.card');
  if (createPostCard) createPostCard.classList.toggle('d-none', !isOwnProfile);
}

/**
 * Load user profile from Supabase
 */
async function loadUserProfile() {
  try {
    const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');

    // Prefer the authenticated Supabase user id (source of truth)
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.id) {
      window.location.href = 'login.html';
      return;
    }

    const authUserId = authUser.id;
    const requestedProfileUserId = await resolveProfileUserId(authUserId);
    const isOwnProfile = requestedProfileUserId === authUserId;

    profileView = {
      authUserId,
      profileUserId: requestedProfileUserId,
      isOwnProfile,
    };

    // Keep localStorage in sync with the real auth user id
    if (userData?.id !== authUserId) {
      const updatedUserData = { ...userData, id: authUserId, email: authUser.email || userData.email };
      localStorage.setItem('socialcore_user', JSON.stringify(updatedUserData));
    }

    // Best-effort refresh of stored user (keeps avatar in sync)
    await refreshStoredUserFromProfile();

    // Toggle UI for own vs other profile
    applyProfileViewMode();

    // Get profile from Supabase
    const profile = await getProfile(requestedProfileUserId);
    
    // Update UI with real data
    updateProfileUI(profile);
    
    // Load user posts
    const posts = await getUserPosts(requestedProfileUserId);
    updatePostsUI(posts, { isOwnProfile });

    // Load user photos (sidebar card)
    await loadProfilePhotos(requestedProfileUserId);

    // Show Admin Dashboard link if user is admin
    try {
      const isAdmin = await checkIsAdmin(authUserId);
      if (isAdmin) {
        const adminLink = document.getElementById('adminDashboardLink');
        if (adminLink) adminLink.classList.remove('d-none');
      }
    } catch (e) {
      // Silently ignore - non-admin users won't see the link
    }
    
  } catch (error) {
    console.error('Error loading profile:', error);

    // If user explicitly requested another profile and it failed, go back to feed.
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('id') || params.get('user') || params.get('username') || params.get('u');
    if (requested) {
      showToast('Failed to load that profile.', 'error');
      window.location.href = 'feed.html';
      return;
    }

    // Fallback: use local storage data
    const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
    updateProfileUIFromLocalStorage(userData);
  }
}

function buildUserPhotosPrefix(userId) {
  return `${userId}/${USER_PHOTOS_FOLDER}`;
}

async function loadProfilePhotos(userId) {
  const grid = document.getElementById('profilePhotosGrid');
  const emptyState = document.getElementById('profilePhotosEmptyState');
  if (!grid || !emptyState) return;

  grid.innerHTML = '';
  emptyState.classList.add('d-none');

  const prefix = buildUserPhotosPrefix(userId);

  const { data, error } = await supabase.storage
    .from(PHOTOS_BUCKET_ID)
    .list(prefix, {
      limit: 4,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error) {
    // Keep the profile usable even if Storage is not configured
    emptyState.classList.remove('d-none');
    return;
  }

  const items = (data || []).filter((item) => item?.name);
  if (!items.length) {
    emptyState.classList.remove('d-none');
    return;
  }

  const html = items
    .map((item) => {
      const fullPath = `${prefix}/${item.name}`;
      const { data: urlData } = supabase.storage.from(PHOTOS_BUCKET_ID).getPublicUrl(fullPath);
      const publicUrl = urlData?.publicUrl || '';

      return `
        <div class="col-6">
          <a href="${publicUrl}" target="_blank" rel="noreferrer" class="d-block">
            <img src="${publicUrl}" alt="Photo" class="img-fluid rounded" loading="lazy">
          </a>
        </div>
      `;
    })
    .join('');

  grid.innerHTML = html;
}

/**
 * Update profile UI with Supabase data
 */
function updateProfileUI(profile) {
  const storedUser = getStoredUser();

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
  const aboutList = document.getElementById('aboutList');
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

    // Add birthday if exists
    if (profile.birthday) {
      const birthdayLi = document.createElement('li');
      birthdayLi.className = 'mb-2 d-flex align-items-center';
      const birthdayDate = new Date(profile.birthday);
      const formattedBirthday = Number.isNaN(birthdayDate.getTime())
        ? String(profile.birthday)
        : birthdayDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      birthdayLi.innerHTML = `
        <i class="bi bi-cake2 me-3 text-muted"></i>
        <span>Birthday <strong>${escapeHtml(formattedBirthday)}</strong></span>
      `;
      aboutList.appendChild(birthdayLi);
    }

    // Add work if exists
    if (profile.work) {
      const workLi = document.createElement('li');
      workLi.className = 'mb-2 d-flex align-items-center';
      workLi.innerHTML = `
        <i class="bi bi-briefcase me-3 text-muted"></i>
        <span>Work <strong>${escapeHtml(profile.work)}</strong></span>
      `;
      aboutList.appendChild(workLi);
    }

    // Add education if exists
    if (profile.education) {
      const educationLi = document.createElement('li');
      educationLi.className = 'mb-2 d-flex align-items-center';
      educationLi.innerHTML = `
        <i class="bi bi-mortarboard me-3 text-muted"></i>
        <span>Education <strong>${escapeHtml(profile.education)}</strong></span>
      `;
      aboutList.appendChild(educationLi);
    }

    // Add social links if exists
    const socialLinks = normalizeSocialLinks(profile.social_links);
    const socialEntries = Object.entries(socialLinks).filter(([, url]) => typeof url === 'string' && url.trim());
    if (socialEntries.length > 0) {
      socialEntries.forEach(([platform, url]) => {
        const socialLi = document.createElement('li');
        socialLi.className = 'mb-2 d-flex align-items-center';
        const safeUrl = url.trim();
        const displayText = getDisplayUrlText(safeUrl);
        socialLi.innerHTML = `
          <i class="${getSocialIconClass(platform)} me-3 text-muted"></i>
          <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">${escapeHtml(displayText)}</a>
        `;
        aboutList.appendChild(socialLi);
      });
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
  
  // Update profile header avatar (avoid brittle alt-based selectors)
  const avatarUrl = profile?.avatar_url || storedUser?.avatar;
  const avatarImg = document.querySelector('.profile-avatar-large');
  if (avatarImg && avatarUrl) {
    avatarImg.src = avatarUrl;
    avatarImg.alt = profile?.full_name ? `${profile.full_name} profile photo` : 'Profile photo';
  }
  
  // Update cover photo if exists
  if (profile.cover_photo_url) {
    const coverElement = document.querySelector('.profile-cover');
    if (coverElement) {
      coverElement.style.backgroundImage = `url(${profile.cover_photo_url})`;
      coverElement.style.backgroundSize = 'cover';
      coverElement.style.backgroundPosition = 'center';
    }
  }

  // Update Profile page "Create Post" card
  const createPostAvatar = document.getElementById('profileCreatePostAvatar');
  const createPostPrompt = document.getElementById('profileCreatePostPrompt');
  if (createPostAvatar && avatarUrl) createPostAvatar.src = avatarUrl;
  if (createPostPrompt) {
    const firstName = String(profile.full_name || '').trim().split(' ')[0];
    createPostPrompt.textContent = firstName ? `What's on your mind, ${firstName}?` : "What's on your mind?";
  }
}

function normalizeSocialLinks(socialLinks) {
  if (!socialLinks) return {};
  if (typeof socialLinks === 'object') return socialLinks;
  if (typeof socialLinks !== 'string') return {};
  try {
    const parsed = JSON.parse(socialLinks);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getSocialIconClass(platform) {
  const normalized = String(platform || '').toLowerCase();
  switch (normalized) {
    case 'facebook':
      return 'bi bi-facebook';
    case 'twitter':
    case 'x':
      return 'bi bi-twitter-x';
    case 'instagram':
      return 'bi bi-instagram';
    case 'linkedin':
      return 'bi bi-linkedin';
    case 'github':
      return 'bi bi-github';
    default:
      return 'bi bi-globe';
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

/**
 * Update profile UI from local storage (fallback)
 */
function updateProfileUIFromLocalStorage(userData) {
  const nameElement = document.querySelector('.profile-info h2');
  if (nameElement) nameElement.textContent = userData.name || 'User';
  
  const usernameElement = document.querySelector('.profile-info p.text-muted');
  if (usernameElement) usernameElement.textContent = `@${userData.username || 'user'}`;

  const avatarUrl = userData.avatar || 'https://ui-avatars.com/api/?name=User&background=3B82F6&color=fff';
  const avatarImg = document.querySelector('.profile-avatar-large');
  if (avatarImg) {
    avatarImg.src = avatarUrl;
    avatarImg.alt = userData.name ? `${userData.name} profile photo` : 'Profile photo';
  }

  const createPostAvatar = document.getElementById('profileCreatePostAvatar');
  if (createPostAvatar) createPostAvatar.src = avatarUrl;
}

/**
 * Update posts UI
 */
function updatePostsUI(posts, { isOwnProfile } = {}) {
  const postsContainer = document.getElementById('postsContent');
  if (!postsContainer) return;
  
  if (!posts || posts.length === 0) {
    const own = isOwnProfile !== false;
    postsContainer.innerHTML = `
      <div class="text-center py-5">
        <i class="bi bi-inbox fs-1 text-muted"></i>
        <p class="text-muted mt-3">No posts yet.</p>
        ${own ? `
          <a href="create-post.html" class="btn btn-primary-gradient mt-3">
            <i class="bi bi-plus-circle me-2"></i>Create Post
          </a>
        ` : ''}
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
  const isLiked = !!post?.liked_by_user;
  const likeIcon = isLiked ? 'bi-heart-fill' : 'bi-heart';
  const likeClass = isLiked ? 'liked' : '';
  
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
        <button class="post-action-btn ${likeClass}" data-action="like">
          <i class="bi ${likeIcon}"></i>
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
  
  // Edit cover photo button
  const editCoverBtn = document.querySelector('.profile-cover .btn');
  if (editCoverBtn) {
    editCoverBtn.addEventListener('click', () => {
      uploadCoverPhoto();
    });
  }
  
  // Avatar click to upload
  const avatarImg = document.querySelector('.profile-avatar-large');
  if (avatarImg) {
    avatarImg.style.cursor = 'pointer';
    avatarImg.title = 'Click to change profile picture';
    avatarImg.addEventListener('click', () => {
      uploadAvatarPhoto();
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
    const postId = postCard.dataset.postId;

    // Like button
    const likeBtn = postCard.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => handleLike(likeBtn, postId));
    }

    // Comment button
    const commentBtn = postCard.querySelector('[data-action="comment"]');
    if (commentBtn) {
      commentBtn.addEventListener('click', () => {
        handleComment(commentBtn, postId);
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
async function handleLike(button, postId) {
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

  try {
    if (button.classList.contains('liked')) {
      await likePost(postId);
    } else {
      await unlikePost(postId);
    }
  } catch (error) {
    console.error('Error updating like:', error);
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
  if (!postCard) return;

  let commentSection = postCard.querySelector('.comment-section');
  if (commentSection) {
    commentSection.classList.toggle('d-none');
    return;
  }

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

  const postActions = postCard.querySelector('.post-actions');
  postActions.after(commentSection);

  commentSection.querySelector('input')?.focus();
  loadComments(postId, commentSection);

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
      const selector = `.comment-item[data-comment-id="${CSS.escape(commentId)}"]`;
      const commentItem = commentSection.querySelector(selector);
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

    renderCommentsList(comments, commentsList);
  } catch (error) {
    console.error('Error loading comments:', error);
    commentsList.innerHTML = '<div class="text-muted small">Failed to load comments.</div>';
  }
}

async function submitComment(input, postId, commentSection) {
  const commentText = input.value.trim();
  if (!commentText) return;

  input.disabled = true;

  try {
    await createComment(postId, commentText, null);
    input.value = '';

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

function renderCommentsList(comments, commentsList) {
  const tree = buildCommentTree(comments);
  commentsList.innerHTML = tree.map((comment) => renderCommentItem(comment, 0)).join('');
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

function renderCommentItem(comment, depth) {
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

  const repliesHtml = (comment.replies || []).map((reply) => renderCommentItem(reply, depth + 1)).join('');

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

function toggleReplies(commentItem) {
  if (!commentItem) return;

  const replies = commentItem.querySelector('.comment-replies');
  if (!replies) return;

  replies.classList.toggle('d-none');
}

function countReplies(comment) {
  if (!comment?.replies?.length) return 0;

  return comment.replies.reduce((total, reply) => total + 1 + countReplies(reply), 0);
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

/**
 * Upload avatar photo
 */
async function uploadAvatarPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      showToast('Uploading profile picture...', 'info');
      
      const imageUrl = await uploadProfileImage(file, 'avatar');
      
      const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
      await updateProfile(userData.id, { avatar_url: imageUrl });
      
      // Update UI
      document.querySelectorAll('img[alt*="' + userData.name + '"], .profile-avatar-large').forEach(img => {
        img.src = imageUrl;
      });
      
      // Update local storage
      userData.avatar = imageUrl;
      localStorage.setItem('socialcore_user', JSON.stringify(userData));
      
      showToast('Profile picture updated!', 'success');
    } catch (error) {
      console.error('Avatar upload error:', error);
      showToast(error.message || 'Failed to upload image', 'error');
    }
  };
  
  input.click();
}

/**
 * Upload cover photo
 */
async function uploadCoverPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      showToast('Uploading cover photo...', 'info');
      
      const imageUrl = await uploadProfileImage(file, 'cover');
      
      const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
      await updateProfile(userData.id, { cover_photo_url: imageUrl });
      
      // Update UI
      const coverElement = document.querySelector('.profile-cover');
      if (coverElement) {
        coverElement.style.backgroundImage = `url(${imageUrl})`;
        coverElement.style.backgroundSize = 'cover';
        coverElement.style.backgroundPosition = 'center';
      }
      
      showToast('Cover photo updated!', 'success');
    } catch (error) {
      console.error('Cover upload error:', error);
      showToast(error.message || 'Failed to upload image', 'error');
    }
  };
  
  input.click();
}

