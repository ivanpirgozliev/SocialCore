/**
 * SocialCore - Main JavaScript Module
 * Handles general application functionality
 */

// Initialize Bootstrap tooltips and popovers
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((tooltipTriggerEl) => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Bootstrap popovers
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  popoverTriggerList.forEach((popoverTriggerEl) => {
    new bootstrap.Popover(popoverTriggerEl);
  });

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    });
  });

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('shadow');
      } else {
        navbar.classList.remove('shadow');
      }
    });
  }

  // Active nav link based on current page
  setActiveNavLink();

  // Navbar user avatar (from localStorage)
  initNavbarUserAvatar();
  refreshStoredUserFromProfile().then(() => {
    initNavbarUserAvatar();
  });
});

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('socialcore_user') || 'null');
  } catch {
    return null;
  }
}

function buildFallbackAvatarUrl(user) {
  const name = user?.name || user?.username || user?.email || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff`;
}

export async function refreshStoredUserFromProfile() {
  const user = getStoredUser();
  if (!user?.id) return user;

  try {
    const { getProfile } = await import('./database.js');
    const profile = await getProfile(user.id);

    if (!profile) return user;

    const updatedUser = {
      ...user,
      name: profile.full_name || user.name,
      username: profile.username || user.username,
      avatar: profile.avatar_url || user.avatar,
    };

    localStorage.setItem('socialcore_user', JSON.stringify(updatedUser));
    return updatedUser;
  } catch {
    return user;
  }
}

function initNavbarUserAvatar() {
  const avatarEls = document.querySelectorAll('.js-navbar-avatar');
  if (!avatarEls.length) return;

  const user = getStoredUser();
  const avatarUrl = user?.avatar || buildFallbackAvatarUrl(user);
  const altText = user?.name ? `${user.name} profile photo` : 'Profile';

  avatarEls.forEach((img) => {
    img.src = avatarUrl;
    img.alt = altText;
  });
}

/**
 * Set active class on the current page's nav link
 */
function setActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      const linkPage = href.split('/').pop();
      if (linkPage === currentPage) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
  });
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 */
export function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(toastContainer);
  }

  // Define toast styles
  const toastStyles = {
    success: { bg: 'bg-success', icon: 'bi-check-circle' },
    error: { bg: 'bg-danger', icon: 'bi-exclamation-circle' },
    warning: { bg: 'bg-warning', icon: 'bi-exclamation-triangle' },
    info: { bg: 'bg-info', icon: 'bi-info-circle' },
  };

  const style = toastStyles[type] || toastStyles.info;

  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-white ${style.bg} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${style.icon} me-2"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  toastContainer.appendChild(toastEl);

  // Show toast
  const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 5000 });
  toast.show();

  // Remove toast element after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted relative time string
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
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

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

// Export for use in other modules
export default {
  showToast,
  formatRelativeTime,
  debounce,
  isValidEmail,
  truncateText,
};
