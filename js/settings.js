/**
 * Settings Page JavaScript
 * Handles settings functionality
 */

// ============================================
// Password Toggle Visibility
// ============================================
const passwordToggles = [
  { toggle: 'toggleCurrentPassword', input: 'currentPassword' },
  { toggle: 'toggleNewPassword', input: 'newPassword' },
  { toggle: 'toggleConfirmPassword', input: 'confirmNewPassword' }
];

passwordToggles.forEach(({ toggle, input }) => {
  const toggleBtn = document.getElementById(toggle);
  const inputField = document.getElementById(input);
  
  if (toggleBtn && inputField) {
    toggleBtn.addEventListener('click', () => {
      const type = inputField.type === 'password' ? 'text' : 'password';
      inputField.type = type;
      toggleBtn.querySelector('i').className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }
});

// ============================================
// Delete Account Confirmation
// ============================================
const confirmDeleteInput = document.getElementById('confirmDelete');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

if (confirmDeleteInput && confirmDeleteBtn) {
  confirmDeleteInput.addEventListener('input', (e) => {
    confirmDeleteBtn.disabled = e.target.value !== 'DELETE';
  });
}

// ============================================
// Font Size Slider
// ============================================
const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');

if (fontSizeSlider && fontSizeValue) {
  const sizes = ['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large'];
  
  fontSizeSlider.addEventListener('input', (e) => {
    fontSizeValue.textContent = sizes[e.target.value - 1];
  });
}

// ============================================
// Theme Selection Cards
// ============================================
const themeCards = document.querySelectorAll('[name="theme"]');

themeCards.forEach(radio => {
  const card = radio.closest('.card');
  
  radio.addEventListener('change', () => {
    // Remove border from all cards
    document.querySelectorAll('[name="theme"]').forEach(r => {
      r.closest('.card').classList.remove('border-primary', 'border-2');
    });
    
    // Add border to selected card
    if (radio.checked) {
      card.classList.add('border-primary', 'border-2');
    }
  });
  
  // Make card clickable
  card.addEventListener('click', () => {
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  });
});

// ============================================
// Form Submissions
// ============================================
const forms = ['accountSettingsForm', 'privacySettingsForm', 'notificationsSettingsForm', 'appearanceSettingsForm'];

forms.forEach(formId => {
  const form = document.getElementById(formId);
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Add checkboxes (they don't appear in FormData when unchecked)
      form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        data[checkbox.id] = checkbox.checked;
      });
      
      // Show loading state
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`${formId} data:`, data);
        showToast('Settings saved successfully!', 'success');
        
      } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
});

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
