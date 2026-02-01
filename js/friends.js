/**
 * SocialCore - Friends Module
 * Handles friends list, friend requests, and suggestions
 */

import { showToast, formatRelativeTime } from './main.js';

// Sample data - will be replaced with Supabase
const mockFriends = [
  { id: 1, name: 'Sarah Wilson', username: 'sarahw', mutualFriends: 12, avatar: 'https://ui-avatars.com/api/?name=Sarah+Wilson&background=06B6D4&color=fff' },
  { id: 2, name: 'Mike Johnson', username: 'mikej', mutualFriends: 8, avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=3B82F6&color=fff' },
  { id: 3, name: 'Emily Davis', username: 'emilyd', mutualFriends: 15, avatar: 'https://ui-avatars.com/api/?name=Emily+Davis&background=8B5CF6&color=fff' },
  { id: 4, name: 'Alex Brown', username: 'alexb', mutualFriends: 5, avatar: 'https://ui-avatars.com/api/?name=Alex+Brown&background=F59E0B&color=fff' },
  { id: 5, name: 'Lisa Park', username: 'lisap', mutualFriends: 3, avatar: 'https://ui-avatars.com/api/?name=Lisa+Park&background=EF4444&color=fff' },
  { id: 6, name: 'Tom Davis', username: 'tomd', mutualFriends: 8, avatar: 'https://ui-avatars.com/api/?name=Tom+Davis&background=8B5CF6&color=fff' },
  { id: 7, name: 'Jessica Lee', username: 'jessical', mutualFriends: 10, avatar: 'https://ui-avatars.com/api/?name=Jessica+Lee&background=EC4899&color=fff' },
  { id: 8, name: 'Robert Chen', username: 'robertc', mutualFriends: 6, avatar: 'https://ui-avatars.com/api/?name=Robert+Chen&background=10B981&color=fff' },
  { id: 9, name: 'Maria Garcia', username: 'mariag', mutualFriends: 14, avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=F59E0B&color=fff' },
  { id: 10, name: 'David Kim', username: 'davidk', mutualFriends: 9, avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3B82F6&color=fff' },
  { id: 11, name: 'Sophie Turner', username: 'sophiet', mutualFriends: 7, avatar: 'https://ui-avatars.com/api/?name=Sophie+Turner&background=EC4899&color=fff' },
  { id: 12, name: 'James Miller', username: 'jamesm', mutualFriends: 11, avatar: 'https://ui-avatars.com/api/?name=James+Miller&background=8B5CF6&color=fff' },
  { id: 13, name: 'Olivia White', username: 'oliviaw', mutualFriends: 4, avatar: 'https://ui-avatars.com/api/?name=Olivia+White&background=06B6D4&color=fff' },
  { id: 14, name: 'Daniel Martinez', username: 'danielm', mutualFriends: 13, avatar: 'https://ui-avatars.com/api/?name=Daniel+Martinez&background=10B981&color=fff' },
  { id: 15, name: 'Emma Thompson', username: 'emmat', mutualFriends: 6, avatar: 'https://ui-avatars.com/api/?name=Emma+Thompson&background=EF4444&color=fff' },
  { id: 16, name: 'Chris Anderson', username: 'chrisa', mutualFriends: 9, avatar: 'https://ui-avatars.com/api/?name=Chris+Anderson&background=3B82F6&color=fff' },
];

const mockRequests = [
  { id: 1, name: 'Jessica Lee', username: 'jessical', mutualFriends: 7, avatar: 'https://ui-avatars.com/api/?name=Jessica+Lee&background=EC4899&color=fff', time: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { id: 2, name: 'Robert Chen', username: 'robertc', mutualFriends: 4, avatar: 'https://ui-avatars.com/api/?name=Robert+Chen&background=10B981&color=fff', time: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  { id: 3, name: 'Maria Garcia', username: 'mariag', mutualFriends: 11, avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=F59E0B&color=fff', time: new Date(Date.now() - 24 * 60 * 60 * 1000) },
];

const mockSuggestions = [
  { id: 1, name: 'David Kim', username: 'davidk', mutualFriends: 9, avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3B82F6&color=fff' },
  { id: 2, name: 'Sophie Turner', username: 'sophiet', mutualFriends: 6, avatar: 'https://ui-avatars.com/api/?name=Sophie+Turner&background=EC4899&color=fff' },
  { id: 3, name: 'James Miller', username: 'jamesm', mutualFriends: 10, avatar: 'https://ui-avatars.com/api/?name=James+Miller&background=8B5CF6&color=fff' },
  { id: 4, name: 'Olivia White', username: 'oliviaw', mutualFriends: 5, avatar: 'https://ui-avatars.com/api/?name=Olivia+White&background=06B6D4&color=fff' },
];

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
