/**
 * SocialCore - Create Post Module
 * Handles post creation functionality
 */

import { showToast, getStoredUser, refreshStoredUserFromProfile } from './main.js';
import { createPost, uploadPostImage } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  // Hydrate current user UI (avatar/name/placeholder)
  initCurrentUserCreatePostUI();

  // Initialize create post form
  initCreatePostForm();

  // Initialize image upload
  initImageUpload();

  // Initialize character counter
  initCharacterCounter();
});

async function initCurrentUserCreatePostUI() {
  const user = (await refreshStoredUserFromProfile()) || getStoredUser();
  if (!user) return;

  const avatarEl = document.getElementById('createPostUserAvatar');
  const nameEl = document.getElementById('createPostUserName');
  const contentEl = document.getElementById('postContent');

  if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  if (nameEl) nameEl.textContent = user.name || 'User';

  if (contentEl) {
    const firstName = (user.name || '').trim().split(' ')[0];
    contentEl.placeholder = firstName ? `What's on your mind, ${firstName}?` : "What's on your mind?";
  }
}

/**
 * Initialize create post form
 */
function initCreatePostForm() {
  const form = document.getElementById('createPostForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = document.getElementById('postContent').value.trim();
    const imageUpload = document.getElementById('imageUpload');
    const imageFile = imageUpload?.files[0];

    // Validate content
    if (!content && !imageFile) {
      showToast('Please write something or add an image to your post.', 'warning');
      return;
    }

    // Disable submit button and show loading state
    const submitBtn = document.getElementById('postButton');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Posting...';

    try {
      let imageUrl = null;
      
      // Upload image if selected
      if (imageFile) {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading image...';
        imageUrl = await uploadPostImage(imageFile);
      }

      // Create post data
      const postData = {
        content: content,
        image_url: imageUrl,
      };

      // Send to Supabase
      await createPost(postData);

      showToast('Post created successfully!', 'success');

      // Redirect to feed after short delay
      setTimeout(() => {
        window.location.href = 'feed.html';
      }, 1500);
    } catch (error) {
      showToast(error.message || 'Failed to create post. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Initialize image upload functionality
 */
function initImageUpload() {
  const imageUpload = document.getElementById('imageUpload');
  const imagePreviewArea = document.getElementById('imagePreviewArea');
  const imagePreview = document.getElementById('imagePreview');
  const removeImageBtn = document.getElementById('removeImage');

  if (!imageUpload || !imagePreviewArea || !imagePreview) return;

  // Handle image selection
  imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'warning');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showToast('Image size must be less than 5MB.', 'warning');
      return;
    }

    // Read and display image
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreviewArea.classList.remove('d-none');
    };
    reader.readAsDataURL(file);
  });

  // Handle image removal
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
      imagePreview.src = '';
      imagePreviewArea.classList.add('d-none');
      imageUpload.value = '';
    });
  }

  // Video upload handler
  const videoUpload = document.getElementById('videoUpload');
  if (videoUpload) {
    videoUpload.addEventListener('change', () => {
      showToast('Video upload coming soon!', 'info');
      videoUpload.value = '';
    });
  }
}

/**
 * Initialize character counter for post content
 */
function initCharacterCounter() {
  const postContent = document.getElementById('postContent');
  if (!postContent) return;

  // Create character counter element
  const counterContainer = document.createElement('div');
  counterContainer.className = 'text-end text-muted small mt-1';
  counterContainer.innerHTML = '<span id="charCount">0</span>/500 characters';
  postContent.parentElement.appendChild(counterContainer);

  const charCount = document.getElementById('charCount');
  const maxLength = 500;

  // Update counter on input
  postContent.addEventListener('input', () => {
    const length = postContent.value.length;
    charCount.textContent = length;

    // Change color based on length
    if (length > maxLength * 0.9) {
      charCount.classList.add('text-danger');
      charCount.classList.remove('text-warning');
    } else if (length > maxLength * 0.7) {
      charCount.classList.add('text-warning');
      charCount.classList.remove('text-danger');
    } else {
      charCount.classList.remove('text-danger', 'text-warning');
    }

    // Limit content
    if (length > maxLength) {
      postContent.value = postContent.value.substring(0, maxLength);
      charCount.textContent = maxLength;
    }
  });

  // Auto-resize textarea
  postContent.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 300) + 'px';
  });
}

/**
 * Get selected privacy option
 * @returns {string} Selected privacy setting
 */
function getSelectedPrivacy() {
  const privacyBtn = document.getElementById('privacyDropdown');
  if (!privacyBtn) return 'public';
  
  const text = privacyBtn.textContent.trim().toLowerCase();
  
  if (text.includes('friends')) return 'friends';
  if (text.includes('only me')) return 'private';
  return 'public';
}



/**
 * Handle feeling selection
 */
document.addEventListener('click', (e) => {
  if (e.target.closest('#feelingModal .btn-outline-secondary')) {
    const feeling = e.target.textContent.trim();
    showToast(`Feeling: ${feeling}`, 'info');
    // TODO: Add feeling to post data
  }
});
