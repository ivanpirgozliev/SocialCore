/**
 * SocialCore - Friends Module
 * Handles friends list, friend requests, and suggestions
 */

import { showToast, formatRelativeTime } from './main.js';
import { getFriendSuggestions, getFriendRequests, getOutgoingFriendRequests, getFriendsList, sendFriendRequest, cancelFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend } from './database.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Friends page loaded');
  initTabs();
  loadFriends();
  loadFriendRequests();
  loadSentRequests();
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
async function loadFriends() {
  console.log('Loading friends...');
  const friendsList = document.getElementById('friends-list');
  
  if (!friendsList) {
    console.error('Friends list element not found!');
    return;
  }
  
  friendsList.innerHTML = `
    <div class="col-12">
      <div class="text-muted small">Loading friends...</div>
    </div>
  `;

  try {
    const friends = await getFriendsList();
    if (!friends.length) {
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

    friendsList.innerHTML = '';
    friends.forEach((friend) => {
      const friendCard = createFriendCard(friend, 'friend');
      friendsList.appendChild(friendCard);
    });
  } catch (error) {
    console.error('Error loading friends:', error);
    friendsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-exclamation-triangle fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">Failed to load friends</h5>
            <p class="text-gray-500 mb-0">Please try again later.</p>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Load friend requests
 */
async function loadFriendRequests() {
  const requestsList = document.getElementById('requests-list');
  if (!requestsList) return;

  requestsList.innerHTML = `
    <div class="col-12">
      <div class="text-muted small">Loading requests...</div>
    </div>
  `;
  
  try {
    const requests = await getFriendRequests();
    setRequestBadge(requests.length);

    if (!requests.length) {
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

    requestsList.innerHTML = '';
    requests.forEach((request) => {
      const requestCard = createFriendCard(request, 'request');
      requestsList.appendChild(requestCard);
    });
  } catch (error) {
    console.error('Error loading friend requests:', error);
    requestsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-exclamation-triangle fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">Failed to load requests</h5>
            <p class="text-gray-500 mb-0">Please try again later.</p>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Load outgoing friend requests
 */
async function loadSentRequests() {
  const sentList = document.getElementById('sent-requests-list');
  if (!sentList) return;

  sentList.innerHTML = `
    <div class="col-12">
      <div class="text-muted small">Loading sent requests...</div>
    </div>
  `;

  try {
    const requests = await getOutgoingFriendRequests();
    setSentRequestBadge(requests.length);
    if (!requests.length) {
      sentList.innerHTML = `
        <div class="col-12">
          <div class="card text-center py-5">
            <div class="card-body">
              <i class="bi bi-clock-history fs-1 text-muted mb-3 d-block"></i>
              <h5 class="text-muted">No sent requests</h5>
              <p class="text-gray-500 mb-0">Send a friend request to get started.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    sentList.innerHTML = '';
    requests.forEach((request) => {
      const requestCard = createFriendCard(request, 'outgoing');
      sentList.appendChild(requestCard);
    });
  } catch (error) {
    console.error('Error loading sent requests:', error);
    sentList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-exclamation-triangle fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">Failed to load sent requests</h5>
            <p class="text-gray-500 mb-0">Please try again later.</p>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Load friend suggestions
 */
async function loadSuggestions() {
  const suggestionsList = document.getElementById('suggestions-list');
  if (!suggestionsList) return;

  suggestionsList.innerHTML = `
    <div class="col-12">
      <div class="text-muted small">Loading suggestions...</div>
    </div>
  `;
  
  try {
    const suggestions = await getFriendSuggestions(12);
    if (!suggestions.length) {
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
      suggestionsList.classList.remove('has-overflow');
      return;
    }

    suggestionsList.innerHTML = '';
    suggestions.forEach((suggestion) => {
      const suggestionCard = createSuggestionCard(suggestion);
      suggestionsList.appendChild(suggestionCard);
    });
    setupScrollHint(suggestionsList);
  } catch (error) {
    console.error('Error loading suggestions:', error);
    suggestionsList.innerHTML = `
      <div class="col-12">
        <div class="card text-center py-5">
          <div class="card-body">
            <i class="bi bi-exclamation-triangle fs-1 text-muted mb-3 d-block"></i>
            <h5 class="text-muted">Failed to load suggestions</h5>
            <p class="text-gray-500 mb-0">Please try again later.</p>
          </div>
        </div>
      </div>
    `;
    suggestionsList.classList.remove('has-overflow');
  }
}

function setupScrollHint(list) {
  if (!list) return;

  const container = list.parentElement;
  if (!container) return;
  container.classList.add('scroll-hint-container');

  let hint = container.querySelector('.scroll-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'scroll-hint';
    hint.textContent = '▼';
    container.appendChild(hint);
  }

  const update = () => {
    const hasOverflow = list.scrollHeight > list.clientHeight + 1;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    container.classList.toggle('has-overflow', hasOverflow);
    container.classList.toggle('at-bottom', !hasOverflow || atBottom);
  };

  update();

  if (list.dataset.scrollHintBound === 'true') return;
  list.dataset.scrollHintBound = 'true';

  list.addEventListener('scroll', update);
  window.addEventListener('resize', update);
}

/**
 * Create friend card element
 * @param {Object} person - Person data
 * @param {string} type - Card type: 'friend', 'request', 'outgoing', 'suggestion'
 * @returns {HTMLElement} Friend card element
 */
function createFriendCard(person, type) {
  const col = document.createElement('div');
  col.className = type === 'friend' ? 'col-md-6 col-lg-3' : 'col-md-6 col-lg-4';

  const fullName = person?.full_name || person?.username || 'User';
  const username = person?.username || 'user';
  const avatarUrl = person?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;
  const profileHref = person?.id ? `profile.html?id=${encodeURIComponent(person.id)}` : 'profile.html';

  let actionButtons = '';

  if (type === 'friend') {
    actionButtons = `
      <a class="btn btn-outline-primary btn-sm w-100 mb-2" href="${escapeHtml(profileHref)}">
        <i class="bi bi-person me-1"></i>View Profile
      </a>
      <button class="btn btn-outline-danger btn-sm w-100 unfriend-btn" data-id="${escapeHtml(String(person?.id || ''))}" data-name="${escapeHtml(fullName)}">
        <i class="bi bi-person-dash me-1"></i>Unfriend
      </button>
    `;
  } else if (type === 'request') {
    const timeAgo = person?.requested_at ? formatRelativeTime(person.requested_at) : '';
    actionButtons = `
      <a class="btn btn-outline-primary btn-sm w-100 mb-2" href="${escapeHtml(profileHref)}">
        <i class="bi bi-person me-1"></i>View Profile
      </a>
      <small class="text-muted d-block mb-2">${escapeHtml(timeAgo)}</small>
      <button class="btn btn-primary btn-sm w-100 mb-2 accept-btn" data-request-id="${escapeHtml(String(person?.request_id || ''))}" data-name="${escapeHtml(fullName)}">
        <i class="bi bi-check-lg me-1"></i>Accept Friend
      </button>
      <button class="btn btn-outline-secondary btn-sm w-100 decline-btn" data-request-id="${escapeHtml(String(person?.request_id || ''))}" data-name="${escapeHtml(fullName)}">
        <i class="bi bi-x-lg me-1"></i>Decline
      </button>
    `;
  } else if (type === 'outgoing') {
    const timeAgo = person?.requested_at ? formatRelativeTime(person.requested_at) : '';
    actionButtons = `
      <a class="btn btn-outline-primary btn-sm w-100 mb-2" href="${escapeHtml(profileHref)}">
        <i class="bi bi-person me-1"></i>View Profile
      </a>
      <small class="text-muted d-block mb-2"><i class="bi bi-clock me-1"></i>${escapeHtml(timeAgo || 'Request sent')}</small>
      <button class="btn btn-outline-secondary btn-sm w-100 cancel-request-btn" data-id="${escapeHtml(String(person?.id || ''))}" data-name="${escapeHtml(fullName)}">
        <i class="bi bi-x-circle me-1"></i>Cancel Request
      </button>
    `;
  }

  const mutualFriends = Number.isFinite(person?.mutual_friends) ? person.mutual_friends : 0;
  const mutualLabel = mutualFriends === 1 ? 'mutual friend' : 'mutual friends';

  col.innerHTML = `
    <div class="card h-100 shadow-hover">
      <div class="card-body text-center p-4">
        <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
          <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="rounded-circle mb-3 border border-2" width="100" height="100" loading="lazy">
        </a>
        <h5 class="mb-1 fw-bold">${escapeHtml(fullName)}</h5>
        <p class="text-muted small mb-2">@${escapeHtml(username)}</p>
        ${type === 'suggestion' ? `
          <p class="text-muted small mb-3">
            <i class="bi bi-people me-1"></i>${mutualFriends} ${mutualLabel}
          </p>
        ` : ''}
        ${actionButtons}
      </div>
    </div>
  `;

  if (type === 'friend') {
    col.querySelector('.unfriend-btn')?.addEventListener('click', (e) => handleUnfriend(e.target.closest('button')));
  } else if (type === 'request') {
    col.querySelector('.accept-btn')?.addEventListener('click', (e) => handleAcceptRequest(e.target.closest('button')));
    col.querySelector('.decline-btn')?.addEventListener('click', (e) => handleDeclineRequest(e.target.closest('button')));
  } else if (type === 'outgoing') {
    col.querySelector('.cancel-request-btn')?.addEventListener('click', (e) => handleCancelOutgoingRequest(e.target.closest('button')));
  }

  return col;
}

/**
 * Handle cancel outgoing friend request
 */
async function handleCancelOutgoingRequest(btn) {
  const name = btn.getAttribute('data-name');
  const userId = btn.getAttribute('data-id');
  if (!userId) return;

  btn.disabled = true;

  try {
    await cancelFriendRequest(userId);
    const card = btn.closest('.col-md-6');
    card?.remove();
    showToast(`Canceled friend request to ${name}`, 'info');
  } catch (error) {
    console.error('Error canceling friend request:', error);
    btn.disabled = false;
    showToast('Failed to cancel request. Please try again.', 'error');
  }
}

/**
 * Handle unfriend action
 */
async function handleUnfriend(btn) {
  const name = btn.getAttribute('data-name');
  const userId = btn.getAttribute('data-id');
  if (!userId) return;

  if (!confirm(`Are you sure you want to unfriend ${name}?`)) return;

  btn.disabled = true;

  try {
    await removeFriend(userId);
    const card = btn.closest('.col-md-6, .col-lg-3');
    card?.remove();
    showToast(`You are no longer friends with ${name}`, 'info');
  } catch (error) {
    console.error('Error removing friend:', error);
    btn.disabled = false;
    showToast('Failed to remove friend. Please try again.', 'error');
  }
}

/**
 * Handle accept friend request
 */
async function handleAcceptRequest(btn) {
  const name = btn.getAttribute('data-name');
  const requestId = btn.getAttribute('data-request-id');
  if (!requestId) return;

  btn.disabled = true;

  try {
    await acceptFriendRequest(requestId);
    const card = btn.closest('.col-md-6');
    card?.remove();
    showToast(`You are now friends with ${name}!`, 'success');
    updateRequestBadge(-1);
    loadFriends();
  } catch (error) {
    console.error('Error accepting request:', error);
    btn.disabled = false;
    showToast('Failed to accept request. Please try again.', 'error');
  }
}

/**
 * Handle decline friend request
 */
async function handleDeclineRequest(btn) {
  const name = btn.getAttribute('data-name');
  const requestId = btn.getAttribute('data-request-id');
  if (!requestId) return;

  btn.disabled = true;

  try {
    await declineFriendRequest(requestId);
    const card = btn.closest('.col-md-6');
    card?.remove();
    showToast(`Friend request from ${name} declined`, 'info');
    updateRequestBadge(-1);
  } catch (error) {
    console.error('Error declining request:', error);
    btn.disabled = false;
    showToast('Failed to decline request. Please try again.', 'error');
  }
}

/**
 * Handle add friend
 */
function createSuggestionCard(profile) {
  const col = document.createElement('div');
  col.className = 'col-12';

  const fullName = profile?.full_name || profile?.username || 'User';
  const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=3B82F6&color=fff`;
  const profileHref = profile?.id ? `profile.html?id=${encodeURIComponent(profile.id)}` : 'profile.html';
  const mutualFriends = Number.isFinite(profile?.mutual_friends) ? profile.mutual_friends : 0;
  const mutualLabel = mutualFriends === 1 ? 'mutual friend' : 'mutual friends';

  col.innerHTML = `
    <div class="suggestion-card">
      <div class="suggestion-card-body">
        <div class="friend-item">
          <a href="${escapeHtml(profileHref)}" class="text-decoration-none">
            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(fullName)}" class="friend-avatar" loading="lazy">
          </a>
          <div class="flex-grow-1">
            <a href="${escapeHtml(profileHref)}" class="friend-name mb-0 text-decoration-none">${escapeHtml(fullName)}</a>
            <small class="text-muted d-block mutual-friends">
              <i class="bi bi-people me-1"></i>${mutualFriends} ${mutualLabel}
            </small>
          </div>
        </div>
        <button class="btn btn-primary-gradient btn-sm suggestion-action add-friend-btn" data-id="${escapeHtml(String(profile?.id || ''))}" data-state="none" data-name="${escapeHtml(fullName)}">
          <i class="bi bi-person-plus me-1"></i>Add Friend
        </button>
      </div>
    </div>
  `;

  const addBtn = col.querySelector('.add-friend-btn');
  addBtn.addEventListener('click', (e) => handleAddFriend(e.target.closest('button')));
  return col;
}

async function handleAddFriend(btn) {
  const userId = btn?.getAttribute('data-id');
  const name = btn?.getAttribute('data-name') || 'this user';
  if (!userId) return;

  const state = btn.dataset.state || 'none';
  const originalHtml = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Working';

  try {
    if (state === 'pending') {
      await cancelFriendRequest(userId);
      btn.dataset.state = 'none';
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-primary-gradient');
      btn.innerHTML = '<i class="bi bi-person-plus me-1"></i>Add Friend';
      showToast('Friend request canceled.', 'info');
    } else {
      await sendFriendRequest(userId);
      btn.dataset.state = 'pending';
      btn.classList.remove('btn-primary-gradient');
      btn.classList.add('btn-outline-secondary');
      btn.innerHTML = '<i class="bi bi-x-circle me-1"></i>Cancel Request';
      showToast(`Friend request sent to ${name}`, 'success');
    }
  } catch (error) {
    console.error('Error updating friend request:', error);
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    showToast('Failed to update friend request. Please try again.', 'error');
    return;
  }

  btn.disabled = false;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update friend request badge count
 */
function updateRequestBadge(change) {
  const badge = document.querySelector('.nav-link[data-tab="friend-requests"] .badge');
  const currentCount = badge ? parseInt(badge.textContent, 10) || 0 : 0;
  const newCount = currentCount + change;
  setRequestBadge(newCount);
}

function setRequestBadge(count) {
  const link = document.querySelector('.nav-link[data-tab="friend-requests"]');
  if (!link) return;

  const existingBadge = link.querySelector('.badge');
  if (count > 0) {
    if (existingBadge) {
      existingBadge.textContent = count;
      return;
    }
    const badge = document.createElement('span');
    badge.className = 'badge bg-danger ms-2';
    badge.textContent = count;
    link.appendChild(badge);
  } else if (existingBadge) {
    existingBadge.remove();
  }
}

function setSentRequestBadge(count) {
  const link = document.querySelector('.nav-link[data-tab="sent-requests"]');
  if (!link) return;

  const existingBadge = link.querySelector('.badge');
  if (count > 0) {
    if (existingBadge) {
      existingBadge.textContent = count;
      return;
    }
    const badge = document.createElement('span');
    badge.className = 'badge bg-primary ms-2';
    badge.textContent = count;
    link.appendChild(badge);
  } else if (existingBadge) {
    existingBadge.remove();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
