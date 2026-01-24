/**
 * Edit Profile Page JavaScript
 * Handles profile editing functionality
 */

// ============================================
// Bio Character Counter
// ============================================
const bioTextarea = document.getElementById('bio');
const bioCharCount = document.getElementById('bioCharCount');

if (bioTextarea && bioCharCount) {
  // Update character count on load
  bioCharCount.textContent = bioTextarea.value.length;
  
  // Update on input
  bioTextarea.addEventListener('input', () => {
    bioCharCount.textContent = bioTextarea.value.length;
  });
}

// ============================================
// Profile Picture Preview
// ============================================
const profilePictureInput = document.getElementById('profilePictureInput');
const profilePicturePreview = document.getElementById('profilePicturePreview');

if (profilePictureInput && profilePicturePreview) {
  profilePictureInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        e.target.value = '';
        return;
      }
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
        alert('Please select a valid image file (JPG, PNG, or GIF)');
        e.target.value = '';
        return;
      }
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => {
        profilePicturePreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// ============================================
// Cover Photo Preview
// ============================================
const coverPhotoInput = document.getElementById('coverPhotoInput');
const coverPhotoPreview = document.getElementById('coverPhotoPreview');

if (coverPhotoInput && coverPhotoPreview) {
  coverPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max for cover)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        e.target.value = '';
        return;
      }
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        alert('Please select a valid image file (JPG or PNG)');
        e.target.value = '';
        return;
      }
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => {
        coverPhotoPreview.style.background = `url(${e.target.result}) center/cover no-repeat`;
      };
      reader.readAsDataURL(file);
    }
  });
}

// ============================================
// Form Submission
// ============================================
const editProfileForm = document.getElementById('editProfileForm');

if (editProfileForm) {
  editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(editProfileForm);
    const profileData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      username: formData.get('username'),
      bio: formData.get('bio'),
      birthday: formData.get('birthday'),
      gender: formData.get('gender'),
      location: formData.get('location'),
      website: formData.get('website'),
      phone: formData.get('phone'),
      work: formData.get('work'),
      education: formData.get('education'),
      relationship: formData.get('relationship'),
      socialLinks: {
        facebook: formData.get('facebook'),
        twitter: formData.get('twitter'),
        instagram: formData.get('instagram'),
        linkedin: formData.get('linkedin'),
        github: formData.get('github')
      }
    };
    
    // Validation
    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      alert('First name and last name are required');
      return;
    }
    
    if (!profileData.username.trim()) {
      alert('Username is required');
      return;
    }
    
    // Username validation
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(profileData.username)) {
      alert('Username must be 3-30 characters and contain only letters, numbers, and underscores');
      return;
    }
    
    // Show loading state
    const submitBtn = editProfileForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Log the data (in real app, send to backend)
      console.log('Profile data to save:', profileData);
      
      // Show success message
      showToast('Profile updated successfully!', 'success');
      
      // Redirect to profile page after short delay
      setTimeout(() => {
        window.location.href = 'profile.html';
      }, 1500);
      
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('Failed to save profile. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'success') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  existingToasts.forEach(toast => toast.remove());
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-notification alert alert-${type === 'success' ? 'success' : 'danger'} position-fixed`;
  toast.style.cssText = 'top: 100px; right: 20px; z-index: 9999; min-width: 300px; animation: slideIn 0.3s ease;';
  toast.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
      <span>${message}</span>
      <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 3000);
}

// ============================================
// Add animation styles
// ============================================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
