/**
 * SocialCore - Create Post Module
 * Handles post creation functionality
 */

import { showToast } from './main.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize create post form
  initCreatePostForm();

  // Initialize image upload
  initImageUpload();

  // Initialize character counter
  initCharacterCounter();
});

/**
 * Initialize create post form
 */
function initCreatePostForm() {
  const form = document.getElementById('createPostForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = document.getElementById('postContent').value.trim();
    const imagePreview = document.getElementById('imagePreview');
    const hasImage = imagePreview && imagePreview.src && !imagePreview.closest('.d-none');

    // Validate content
    if (!content && !hasImage) {
      showToast('Please write something or add an image to your post.', 'warning');
      return;
    }

    // Disable submit button and show loading state
    const submitBtn = document.getElementById('postButton');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Posting...';

    try {
      // Create post data
      const postData = {
        content: content,
        image: hasImage ? imagePreview.src : null,
        privacy: getSelectedPrivacy(),
        createdAt: new Date().toISOString(),
      };

      // TODO: Send to Supabase
      await simulateCreatePost(postData);

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
 * Simulate creating a post (to be replaced with Supabase)
 * @param {Object} postData - Post data
 * @returns {Promise} Resolves on success
 */
function simulateCreatePost(postData) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('Creating post:', postData);
      
      // Simulate successful post creation
      if (postData.content || postData.image) {
        resolve({ success: true, id: Date.now() });
      } else {
        reject(new Error('Post content is required'));
      }
    }, 1500);
  });
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
