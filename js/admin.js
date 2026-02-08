// ============================================
// SocialCore - Admin Dashboard JavaScript
// Fetches real data from Supabase
// ============================================

import { supabase } from './supabase.js';
import './main.js';
import {
  getAdminStats,
  getAdminPosts,
  checkIsAdmin,
  deletePostAdmin,
} from './database.js';

// ============================================
// Constants
// ============================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const USERS_PER_PAGE = 10;

// ============================================
// State
// ============================================
let currentPage = 1;
let currentSearchTerm = '';
let currentRoleFilter = '';
let allUsers = [];

// ============================================
// DOM Elements
// ============================================
const totalUsersEl = document.getElementById('totalUsers');
const totalPostsEl = document.getElementById('totalPosts');
const totalCommentsEl = document.getElementById('totalComments');
const usersTableBody = document.getElementById('usersTableBody');
const postsTableBody = document.getElementById('postsTableBody');
const usersPaginationInfo = document.getElementById('usersPaginationInfo');
const usersPagination = document.getElementById('usersPagination');
const userSearchInput = document.getElementById('userSearch');
const roleFilter = document.getElementById('roleFilter');

// Add User Modal elements
const addUserSubmitBtn = document.getElementById('addUserSubmitBtn');

// Edit User Modal elements
const editUserSubmitBtn = document.getElementById('editUserSubmitBtn');

// Delete User Modal elements
const confirmDeleteUser = document.getElementById('confirmDeleteUser');
const confirmDeleteUserBtn = document.getElementById('confirmDeleteUserBtn');

// Delete Post Modal elements
const confirmDeletePostBtn = document.getElementById('confirmDeletePostBtn');

// ============================================
// Admin Access Check
// ============================================
async function checkAdminAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }

  const isAdmin = await checkIsAdmin(user.id);
  if (!isAdmin) {
    window.location.href = 'feed.html';
    return false;
  }

  return true;
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'success') {
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '1100';
    document.body.appendChild(toastContainer);
  }
  
  const toastId = 'toast-' + Date.now();
  const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : type === 'warning' ? 'bg-warning text-dark' : 'bg-info';
  
  const toastHTML = `
    <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHTML);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();
  toastElement.addEventListener('hidden.bs.toast', function () { this.remove(); });
}

// ============================================
// Load Dashboard Statistics
// ============================================
async function loadStats() {
  try {
    const stats = await getAdminStats();
    totalUsersEl.textContent = stats.totalUsers.toLocaleString();
    totalPostsEl.textContent = stats.totalPosts.toLocaleString();
    totalCommentsEl.textContent = stats.totalComments.toLocaleString();
  } catch (err) {
    console.error('Error loading stats:', err);
    totalUsersEl.textContent = '—';
    totalPostsEl.textContent = '—';
    totalCommentsEl.textContent = '—';
  }
}

// ============================================
// Load Users - via edge function to get emails
// ============================================
async function loadUsers() {
  try {
    const data = await callEdgeFunction('list-users', {});
    allUsers = data.users || [];
    renderUsersTable();
  } catch (err) {
    console.error('Error loading users:', err);
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-circle me-2"></i>Error loading users
        </td>
      </tr>
    `;
  }
}

function getFilteredUsers() {
  let filtered = [...allUsers];

  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    filtered = filtered.filter(u =>
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
    );
  }

  if (currentRoleFilter) {
    filtered = filtered.filter(u => u.role === currentRoleFilter);
  }

  return filtered;
}

function renderUsersTable() {
  const filtered = getFilteredUsers();
  const totalPages = Math.ceil(filtered.length / USERS_PER_PAGE) || 1;

  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * USERS_PER_PAGE;
  const end = start + USERS_PER_PAGE;
  const pageUsers = filtered.slice(start, end);

  if (pageUsers.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          <i class="bi bi-person-x me-2"></i>No users found
        </td>
      </tr>
    `;
  } else {
    usersTableBody.innerHTML = pageUsers.map(user => createUserRow(user)).join('');
  }

  // Update pagination info
  usersPaginationInfo.textContent = filtered.length > 0
    ? `Showing ${start + 1} to ${Math.min(end, filtered.length)} of ${filtered.length} users`
    : 'No users found';

  // Render pagination
  renderPagination(totalPages);

  // Attach event listeners to action buttons
  attachUserActionListeners();
}

function createUserRow(user) {
  const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=3B82F6&color=fff`;
  const roleBadge = user.role === 'admin'
    ? '<span class="badge bg-danger">Admin</span>'
    : '<span class="badge bg-secondary">User</span>';
  const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  return `
    <tr data-user-id="${user.id}">
      <td class="ps-4">
        <div class="d-flex align-items-center">
          <img src="${avatarUrl}" alt="${user.full_name}" class="rounded-circle me-3" width="40" height="40">
          <div>
            <h6 class="mb-0">${user.full_name || '—'}</h6>
            <small class="text-muted">@${user.username || '—'}</small>
          </div>
        </div>
      </td>
      <td>${user.email || '—'}</td>
      <td>${roleBadge}</td>
      <td>${joinedDate}</td>
      <td class="text-end pe-4">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-primary btn-edit-user" title="Edit User"
                  data-user-id="${user.id}"
                  data-full-name="${user.full_name || ''}"
                  data-username="${user.username || ''}"
                  data-email="${user.email || ''}"
                  data-role="${user.role || 'user'}">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-delete-user" title="Delete User"
                  data-user-id="${user.id}"
                  data-full-name="${user.full_name || ''}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    usersPagination.innerHTML = '';
    return;
  }

  let html = `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item ${i === currentPage ? 'active' : ''}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }

  html += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
    </li>
  `;

  usersPagination.innerHTML = html;

  // Pagination click handlers
  usersPagination.querySelectorAll('.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = parseInt(link.dataset.page);
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderUsersTable();
      }
    });
  });
}

// ============================================
// User Action Listeners
// ============================================
function attachUserActionListeners() {
  // Edit user buttons
  document.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('editUserId').value = btn.dataset.userId;
      document.getElementById('editUserName').value = btn.dataset.fullName;
      document.getElementById('editUserUsername').value = btn.dataset.username;
      document.getElementById('editUserEmail').value = btn.dataset.email;
      document.getElementById('editUserRole').value = btn.dataset.role;
      const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
      modal.show();
    });
  });

  // Delete user buttons
  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('deleteUserId').value = btn.dataset.userId;
      document.getElementById('deleteUserName').textContent = btn.dataset.fullName;
      document.getElementById('confirmDeleteUser').value = '';
      confirmDeleteUserBtn.disabled = true;
      const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
      modal.show();
    });
  });
}

// ============================================
// Load Recent Posts
// ============================================
async function loadPosts() {
  try {
    const posts = await getAdminPosts(20);
    if (posts.length === 0) {
      postsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-muted">
            <i class="bi bi-file-earmark-x me-2"></i>No posts yet
          </td>
        </tr>
      `;
      return;
    }
    postsTableBody.innerHTML = posts.map(post => createPostRow(post)).join('');
    attachPostActionListeners();
  } catch (err) {
    console.error('Error loading posts:', err);
    postsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-danger">
          <i class="bi bi-exclamation-circle me-2"></i>Error loading posts
        </td>
      </tr>
    `;
  }
}

function createPostRow(post) {
  const authorName = post.profiles?.full_name || 'Unknown';
  const avatarUrl = post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=3B82F6&color=fff`;
  const content = post.content.length > 80 ? post.content.substring(0, 80) + '...' : post.content;
  const date = new Date(post.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  return `
    <tr data-post-id="${post.id}">
      <td class="ps-4" style="max-width: 300px;">
        <p class="mb-0 text-truncate">${content}</p>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <img src="${avatarUrl}" alt="${authorName}" class="rounded-circle me-2" width="30" height="30">
          <span>${authorName}</span>
        </div>
      </td>
      <td><span class="badge bg-primary bg-opacity-10 text-primary">${post.likes_count || 0}</span></td>
      <td><span class="badge bg-success bg-opacity-10 text-success">${post.comments_count || 0}</span></td>
      <td>${date}</td>
      <td class="text-end pe-4">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-danger btn-delete-post" title="Delete Post"
                  data-post-id="${post.id}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function attachPostActionListeners() {
  document.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('deletePostId').value = btn.dataset.postId;
      const modal = new bootstrap.Modal(document.getElementById('deletePostModal'));
      modal.show();
    });
  });
}

// ============================================
// Edge Function Helpers
// ============================================
async function callEdgeFunction(functionName, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Edge function error');
  }
  return data;
}

// ============================================
// Add User Handler
// ============================================
async function handleAddUser() {
  const fullName = document.getElementById('addUserFullName').value.trim();
  const username = document.getElementById('addUserUsername').value.trim();
  const email = document.getElementById('addUserEmail').value.trim();
  const password = document.getElementById('addUserPassword').value;
  const role = document.getElementById('addUserRole').value;

  if (!fullName || !username || !email || !password) {
    showToast('Please fill in all fields', 'warning');
    return;
  }

  addUserSubmitBtn.disabled = true;
  addUserSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creating...';

  try {
    await callEdgeFunction('create-user', { email, password, full_name: fullName, username, role });
    showToast('User created successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
    document.getElementById('addUserForm').reset();
    // Reload data
    await Promise.all([loadUsers(), loadStats()]);
  } catch (err) {
    console.error('Error creating user:', err);
    showToast(`Error creating user: ${err.message}`, 'danger');
  } finally {
    addUserSubmitBtn.disabled = false;
    addUserSubmitBtn.innerHTML = '<i class="bi bi-person-plus me-1"></i>Create User';
  }
}

// ============================================
// Edit User Handler
// ============================================
async function handleEditUser() {
  const userId = document.getElementById('editUserId').value;
  const fullName = document.getElementById('editUserName').value.trim();
  const username = document.getElementById('editUserUsername').value.trim();
  const email = document.getElementById('editUserEmail').value.trim();
  const role = document.getElementById('editUserRole').value;

  editUserSubmitBtn.disabled = true;
  editUserSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

  try {
    await callEdgeFunction('edit-user', {
      user_id: userId,
      email,
      full_name: fullName,
      username,
      role,
    });
    showToast('User updated successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
    await loadUsers();
  } catch (err) {
    console.error('Error updating user:', err);
    showToast(`Error updating user: ${err.message}`, 'danger');
  } finally {
    editUserSubmitBtn.disabled = false;
    editUserSubmitBtn.innerHTML = 'Save Changes';
  }
}

// ============================================
// Delete User Handler
// ============================================
async function handleDeleteUser() {
  const userId = document.getElementById('deleteUserId').value;

  confirmDeleteUserBtn.disabled = true;
  confirmDeleteUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';

  try {
    await callEdgeFunction('delete-user', { user_id: userId });
    showToast('User deleted successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('deleteUserModal')).hide();
    await Promise.all([loadUsers(), loadStats()]);
  } catch (err) {
    console.error('Error deleting user:', err);
    showToast(`Error deleting user: ${err.message}`, 'danger');
  } finally {
    confirmDeleteUserBtn.disabled = false;
    confirmDeleteUserBtn.innerHTML = 'Delete User';
    document.getElementById('confirmDeleteUser').value = '';
  }
}

// ============================================
// Delete Post Handler
// ============================================
async function handleDeletePost() {
  const postId = document.getElementById('deletePostId').value;

  confirmDeletePostBtn.disabled = true;
  confirmDeletePostBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...';

  try {
    await deletePostAdmin(postId);
    showToast('Post deleted successfully!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('deletePostModal')).hide();
    await Promise.all([loadPosts(), loadStats()]);
  } catch (err) {
    console.error('Error deleting post:', err);
    showToast(`Error deleting post: ${err.message}`, 'danger');
  } finally {
    confirmDeletePostBtn.disabled = false;
    confirmDeletePostBtn.innerHTML = 'Delete Post';
  }
}

// ============================================
// Event Listeners
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const hasAccess = await checkAdminAccess();
  if (!hasAccess) return;

  // Load all data
  await Promise.all([loadStats(), loadUsers(), loadPosts()]);

  // Search input
  if (userSearchInput) {
    let searchTimeout;
    userSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearchTerm = userSearchInput.value.trim();
        currentPage = 1;
        renderUsersTable();
      }, 300);
    });
  }

  // Role filter
  if (roleFilter) {
    roleFilter.addEventListener('change', () => {
      currentRoleFilter = roleFilter.value;
      currentPage = 1;
      renderUsersTable();
    });
  }

  // Add user button
  if (addUserSubmitBtn) {
    addUserSubmitBtn.addEventListener('click', handleAddUser);
  }

  // Edit user button
  if (editUserSubmitBtn) {
    editUserSubmitBtn.addEventListener('click', handleEditUser);
  }

  // Delete user confirmation input
  if (confirmDeleteUser) {
    confirmDeleteUser.addEventListener('input', function () {
      confirmDeleteUserBtn.disabled = this.value !== 'DELETE';
    });
  }

  // Delete user button
  if (confirmDeleteUserBtn) {
    confirmDeleteUserBtn.addEventListener('click', handleDeleteUser);
  }

  // Delete post button
  if (confirmDeletePostBtn) {
    confirmDeletePostBtn.addEventListener('click', handleDeletePost);
  }
});

export { checkAdminAccess, showToast };
