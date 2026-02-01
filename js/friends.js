/**
 * SocialCore - Friends Module
 * Handles friends list, friend requests, and suggestions
 */

import { showToast, formatRelativeTime } from './main.js';

// TODO: Replace with Supabase queries
const mockFriends = [];
const mockRequests = [];
const mockSuggestions = [];

document.addEventListener('DOMContentLoaded', () => {
  console.log('Friends page loaded');
  initTabs();
  loadFriends();
  loadFriendRequests();
  loadSuggestions();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
  const tabLinks = document.querySelectorAll('.nav-link[data-tab]');
  
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all tabs and content
      tabLinks.forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      link.classList.add('active');
      
      // Show corresponding content
      const tabId = link.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

/**
 * Load all friends
 */
function loadFriends() {
  console.log('Loading friends...', mockFriends.length);
  const friendsList = document.getElementById('friends-list');
  
  if (!friendsList) {
    console.error('Friends list element not found!');
    return;
  }
  
  // Show empty state if no friends
  if (mockFriends.length === 0) {
    friendsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-people fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">No friends yet</h5>
            <p class="text-gray-500 mb-3">Start connecting with people by sending friend requests!</p>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  mockFriends.forEach(friend => {
    const friendCard = createFriendCard(friend, 'friend');
    friendsList.appendChild(friendCard);
  });
  
  console.log('Friends loaded successfully');
}

/**
 * Load friend requests
 */
function loadFriendRequests() {
  const requestsList = document.getElementById('requests-list');
  
  // Show empty state if no requests
  if (mockRequests.length === 0) {
    requestsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-person-check fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">No friend requests</h5>
            <p class="text-gray-500 mb-0">You're all caught up!</p>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  mockRequests.forEach(request => {
    const requestCard = createFriendCard(request, 'request');
    requestsList.appendChild(requestCard);
  });
}

/**
 * Load friend suggestions
 */
function loadSuggestions() {
  const suggestionsList = document.getElementById('suggestions-list');
  
  // Show empty state if no suggestions
  if (mockSuggestions.length === 0) {
    suggestionsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-person-plus fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">No suggestions available</h5>
            <p class="text-gray-500 mb-0">Check back later for new friend suggestions!</p>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  mockSuggestions.forEach(suggestion => {
    const suggestionCard = createFriendCard(suggestion, 'suggestion');
    suggestionsList.appendChild(suggestionCard);
  });
}

/**
 * Create friend card element
 * @param {Object} person - Person data
 * @param {string} type - Card type: 'friend', 'request', 'suggestion'
 * @returns {HTMLElement} Friend card element
 */
function createFriendCard(person, type) {
  const col = document.createElement('div');
  col.className = type === 'friend' ? 'col-md-6 col-lg-3' : 'col-md-6 col-lg-4';
  
  let actionButtons = '';
  
  if (type === 'friend') {
    actionButtons = `
      <button class="btn btn-outline-primary btn-sm w-100 mb-2" onclick="window.location.href='profile.html?user=${person.username}'">
        <i class="bi bi-person me-1"></i>View Profile
      </button>
      <button class="btn btn-outline-danger btn-sm w-100 unfriend-btn" data-id="${person.id}" data-name="${person.name}">
        <i class="bi bi-person-dash me-1"></i>Unfriend
      </button>
    `;
  } else if (type === 'request') {
    const timeAgo = formatRelativeTime(person.time);
    actionButtons = `
      <small class="text-muted d-block mb-2">${timeAgo}</small>
      <button class="btn btn-primary btn-sm w-100 mb-2 accept-btn" data-id="${person.id}" data-name="${person.name}">
        <i class="bi bi-check-lg me-1"></i>Accept
      </button>
      <button class="btn btn-outline-secondary btn-sm w-100 decline-btn" data-id="${person.id}" data-name="${person.name}">
        <i class="bi bi-x-lg me-1"></i>Decline
      </button>
    `;
  } else if (type === 'suggestion') {
    actionButtons = `
      <button class="btn btn-primary btn-sm w-100 mb-2 add-friend-btn" data-id="${person.id}" data-name="${person.name}">
        <i class="bi bi-person-plus me-1"></i>Add Friend
      </button>
      <button class="btn btn-outline-secondary btn-sm w-100 remove-suggestion-btn" data-id="${person.id}">
        <i class="bi bi-x-lg me-1"></i>Remove
      </button>
    `;
  }
  
  col.innerHTML = `
    <div class="card h-100 shadow-hover">
      <div class="card-body text-center p-4">
        <img src="${person.avatar}" alt="${person.name}" class="rounded-circle mb-3 border border-2" width="100" height="100">
        <h5 class="mb-1 fw-bold">${person.name}</h5>
        <p class="text-muted small mb-2">@${person.username}</p>
        <p class="text-muted small mb-3">
          <i class="bi bi-people me-1"></i>${person.mutualFriends} mutual friends
        </p>
        ${actionButtons}
      </div>
    </div>
  `;
  
  // Add event listeners
  if (type === 'friend') {
    col.querySelector('.unfriend-btn').addEventListener('click', (e) => handleUnfriend(e.target.closest('button')));
  } else if (type === 'request') {
    col.querySelector('.accept-btn').addEventListener('click', (e) => handleAcceptRequest(e.target.closest('button')));
    col.querySelector('.decline-btn').addEventListener('click', (e) => handleDeclineRequest(e.target.closest('button')));
  } else if (type === 'suggestion') {
    col.querySelector('.add-friend-btn').addEventListener('click', (e) => handleAddFriend(e.target.closest('button')));
    col.querySelector('.remove-suggestion-btn').addEventListener('click', (e) => handleRemoveSuggestion(e.target.closest('button')));
  }
  
  return col;
}

/**
 * Handle unfriend action
 */
function handleUnfriend(btn) {
  const name = btn.getAttribute('data-name');
  
  if (confirm(`Are you sure you want to unfriend ${name}?`)) {
    // TODO: Implement Supabase unfriend
    const card = btn.closest('.col-md-6');
    card.remove();
    showToast(`You are no longer friends with ${name}`, 'info');
  }
}

/**
 * Handle accept friend request
 */
function handleAcceptRequest(btn) {
  const name = btn.getAttribute('data-name');
  
  // TODO: Implement Supabase accept request
  const card = btn.closest('.col-md-6');
  card.remove();
  showToast(`You are now friends with ${name}!`, 'success');
  
  // Update badge count
  updateRequestBadge(-1);
}

/**
 * Handle decline friend request
 */
function handleDeclineRequest(btn) {
  const name = btn.getAttribute('data-name');
  
  // TODO: Implement Supabase decline request
  const card = btn.closest('.col-md-6');
  card.remove();
  showToast(`Friend request from ${name} declined`, 'info');
  
  // Update badge count
  updateRequestBadge(-1);
}

/**
 * Handle add friend
 */
function handleAddFriend(btn) {
  const name = btn.getAttribute('data-name');
  
  // TODO: Implement Supabase send friend request
  btn.innerHTML = '<i class="bi bi-clock me-1"></i>Request Sent';
  btn.disabled = true;
  btn.classList.remove('btn-primary');
  btn.classList.add('btn-secondary');
  
  showToast(`Friend request sent to ${name}`, 'success');
}

/**
 * Handle remove suggestion
 */
function handleRemoveSuggestion(btn) {
  // TODO: Implement Supabase remove suggestion
  const card = btn.closest('.col-md-6');
  card.remove();
  showToast('Suggestion removed', 'info');
}

/**
 * Update friend request badge count
 */
function updateRequestBadge(change) {
  const badge = document.querySelector('.nav-link[data-tab="friend-requests"] .badge');
  if (badge) {
    const currentCount = parseInt(badge.textContent);
    const newCount = currentCount + change;
    
    if (newCount > 0) {
      badge.textContent = newCount;
    } else {
      badge.remove();
    }
  }
}
