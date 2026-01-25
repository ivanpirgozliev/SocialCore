// ============================================
// SocialCore - Admin Dashboard JavaScript
// ============================================

// ============================================
// DOM Elements
// ============================================
const userSearchInput = document.getElementById('userSearch');
const roleFilter = document.getElementById('roleFilter');
const usersTable = document.getElementById('usersTable');
const confirmDeleteUser = document.getElementById('confirmDeleteUser');
const confirmDeleteUserBtn = document.getElementById('confirmDeleteUserBtn');
const confirmMakeAdmin = document.getElementById('confirmMakeAdmin');
const confirmMakeAdminBtn = document.getElementById('confirmMakeAdminBtn');

// ============================================
// Admin Access Check (Placeholder)
// ============================================
// TODO: Add actual admin authentication check
function checkAdminAccess() {
  // This will be implemented later with proper authentication
  // For now, we'll assume the user has admin access
  const isAdmin = true; // Replace with actual check
  
  if (!isAdmin) {
    // Redirect non-admin users
    window.location.href = 'feed.html';
  }
}

// Run admin check on page load
checkAdminAccess();

// ============================================
// Delete User Modal - Enable/Disable Button
// ============================================
if (confirmDeleteUser && confirmDeleteUserBtn) {
  confirmDeleteUser.addEventListener('input', function() {
    confirmDeleteUserBtn.disabled = this.value !== 'DELETE';
  });
}

// ============================================
// Make Admin Modal - Enable/Disable Button
// ============================================
if (confirmMakeAdmin && confirmMakeAdminBtn) {
  confirmMakeAdmin.addEventListener('change', function() {
    confirmMakeAdminBtn.disabled = !this.checked;
  });
}

// ============================================
// User Search Functionality
// ============================================
if (userSearchInput && usersTable) {
  userSearchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const rows = usersTable.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      const name = row.querySelector('h6')?.textContent.toLowerCase() || '';
      const email = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
      const username = row.querySelector('small')?.textContent.toLowerCase() || '';
      
      if (name.includes(searchTerm) || email.includes(searchTerm) || username.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

// ============================================
// Role Filter Functionality
// ============================================
if (roleFilter && usersTable) {
  roleFilter.addEventListener('change', function() {
    const selectedRole = this.value.toLowerCase();
    const rows = usersTable.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
      const roleBadge = row.querySelector('td:nth-child(3) .badge');
      const role = roleBadge?.textContent.toLowerCase() || '';
      
      if (!selectedRole || role === selectedRole) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

// ============================================
// Reported Posts Filter Buttons
// ============================================
const reportFilterButtons = document.querySelectorAll('.card-header .btn-group .btn');

reportFilterButtons.forEach(button => {
  button.addEventListener('click', function() {
    // Remove active class from all buttons
    reportFilterButtons.forEach(btn => btn.classList.remove('active'));
    // Add active class to clicked button
    this.classList.add('active');
    
    const filter = this.textContent.toLowerCase();
    const reportedPostsTable = document.getElementById('reportedPostsTable');
    
    if (reportedPostsTable) {
      const rows = reportedPostsTable.querySelectorAll('tbody tr');
      
      rows.forEach(row => {
        const statusBadge = row.querySelector('td:nth-child(6) .badge');
        const status = statusBadge?.textContent.toLowerCase() || '';
        
        if (filter === 'all' || status === filter) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
  });
});

// ============================================
// Action Button Handlers (Placeholders)
// ============================================

// Edit User - Populate modal with user data
document.querySelectorAll('[data-bs-target="#editUserModal"]').forEach(button => {
  button.addEventListener('click', function() {
    const row = this.closest('tr');
    const name = row.querySelector('h6')?.textContent || '';
    const email = row.querySelector('td:nth-child(2)')?.textContent || '';
    const role = row.querySelector('td:nth-child(3) .badge')?.textContent.toLowerCase() || 'user';
    const status = row.querySelector('td:nth-child(4) .badge')?.textContent.toLowerCase() || 'active';
    
    // Populate modal fields
    document.getElementById('editUserName').value = name;
    document.getElementById('editUserEmail').value = email;
    document.getElementById('editUserRole').value = role;
    document.getElementById('editUserStatus').value = status;
  });
});

// ============================================
// Toast Notifications (Helper Function)
// ============================================
function showToast(message, type = 'success') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1100';
    document.body.appendChild(toastContainer);
  }
  
  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-info';
  
  const toastHTML = `
    <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();
  
  // Remove toast element after it's hidden
  toastElement.addEventListener('hidden.bs.toast', function() {
    this.remove();
  });
}

// ============================================
// Export functions for potential module use
// ============================================
export { checkAdminAccess, showToast };
