/**
 * SocialCore - Profile Module
 * Handles user profile functionality
 */

import { showToast } from './main.js';
import { getProfile, updateProfile, getUserPosts, followUser, unfollowUser, isFollowing } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize profile actions
  initProfileActions();

  // Initialize post actions on profile page
  initPostActions();

  // Initialize tab navigation
  initTabNavigation();
});

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
function openEditProfileModal() {
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
                <img src="https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff&size=100" 
                     alt="Profile" class="rounded-circle mb-2" width="100" height="100">
                <div>
                  <label class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-camera me-1"></i>Change Photo
                    <input type="file" accept="image/*" class="d-none" id="profilePhotoInput">
                  </label>
                </div>
              </div>
              
              <!-- Name Fields -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">First Name</label>
                  <input type="text" class="form-control" id="editFirstName" value="John">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Last Name</label>
                  <input type="text" class="form-control" id="editLastName" value="Doe">
                </div>
              </div>
              
              <!-- Username -->
              <div class="mb-3">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text">@</span>
                  <input type="text" class="form-control" id="editUsername" value="johndoe">
                </div>
              </div>
              
              <!-- Bio -->
              <div class="mb-3">
                <label class="form-label">Bio</label>
                <textarea class="form-control" id="editBio" rows="3" maxlength="160">Full-stack developer passionate about building great user experiences. Coffee enthusiast ☕ | Tech lover 💻 | Always learning 📚</textarea>
                <small class="text-muted"><span id="bioCharCount">160</span>/160 characters</small>
              </div>
              
              <!-- Location -->
              <div class="mb-3">
                <label class="form-label">Location</label>
                <input type="text" class="form-control" id="editLocation" value="Sofia, Bulgaria">
              </div>
              
              <!-- Website -->
              <div class="mb-3">
                <label class="form-label">Website</label>
                <input type="url" class="form-control" id="editWebsite" placeholder="https://yourwebsite.com">
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
      const remaining = 160 - bioTextarea.value.length;
      charCount.textContent = remaining;
      charCount.className = remaining < 20 ? 'text-danger' : 'text-muted';
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
