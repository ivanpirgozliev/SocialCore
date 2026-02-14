/**
 * SocialCore - Main JavaScript Module
 * Handles general application functionality
 */

// Initialize Bootstrap tooltips and popovers
document.addEventListener('DOMContentLoaded', () => {
  // Require a real Supabase session for all app pages (except public ones).
  // This prevents a localStorage-only "logged in" state that breaks RLS-protected features.
  enforceAuthenticatedSession().then((ok) => {
    if (!ok) return;

    initAppAfterAuth();
  });
});

function initAppAfterAuth() {
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

  if (!isPublicPage()) {
    initMessagingNav();
    initMessagingRealtime();
    initMessagingBar();
  }
}

function isPublicPage() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  return new Set(['index.html', 'login.html', 'register.html']).has(currentPage);
}

async function enforceAuthenticatedSession() {
  if (isPublicPage()) return true;

  try {
    const { supabase } = await import('./supabase.js');
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user?.id) return true;
  } catch {
    // ignore
  }

  try {
    localStorage.removeItem('socialcore_user');
  } catch {
    // ignore
  }

  // Redirect to login (path differs for root vs /pages)
  const inPages = window.location.pathname.includes('/pages/');
  window.location.href = inPages ? 'login.html' : 'pages/login.html';
  return false;
}

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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function getCurrentUserId() {
  try {
    const { supabase } = await import('./supabase.js');
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

function initMessagingNav() {
  const messagesMenu = document.getElementById('messagesMenu');
  const messagesToggle = document.getElementById('messagesToggle');
  const messagesBadge = document.getElementById('messagesBadge');
  if (!messagesMenu || !messagesToggle) return;

  const dropdownRoot = messagesMenu.closest('.dropdown');
  if (dropdownRoot) {
    dropdownRoot.addEventListener('show.bs.dropdown', () => {
      loadMessagesPreview(messagesMenu).catch((err) => {
        console.warn('Failed to load messages preview', err);
      });

      refreshMessagesBadge().catch(() => {
        // ignore
      });
    });
  }

  messagesMenu.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (action === 'open-messaging') {
      // Navigate to the Messages page (drawer stays available for quick convos).
      const href = actionEl.getAttribute('href') || 'messages.html';
      if (href && href !== '#') {
        // allow normal navigation
        return;
      }

      e.preventDefault();
      window.location.href = 'messages.html';
      return;
    }

    if (action === 'open-conversation') {
      e.preventDefault();
      const conversationId = actionEl.dataset.conversationId;
      if (!conversationId) return;
      hideMessagesDropdown();
      openMessagingDrawer({ view: 'conversation', conversationId }).catch((err) => {
        console.error(err);
        showToast(err?.message || 'Failed to open conversation', 'error');
      });
    }
  });

  // Initial placeholder (in case dropdown is opened before events)
  loadMessagesPreview(messagesMenu).catch(() => {
    // ignore
  });

  if (messagesBadge) {
    refreshMessagesBadge().catch(() => {
      // ignore
    });
  }

  function hideMessagesDropdown() {
    try {
      const instance = bootstrap.Dropdown.getOrCreateInstance(messagesToggle);
      instance.hide();
    } catch {
      // ignore
    }
  }

  // Badge is updated via refreshMessagesBadge()
}

async function loadMessagesPreview(messagesMenu) {
  messagesMenu.innerHTML = `
    <li class="dropdown-header">Messages</li>
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item py-2 text-center text-muted">Loading...</a></li>
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item text-center text-primary" href="messages.html" data-action="open-messaging">See all messages</a></li>
  `;

  try {
    const { getMyConversations } = await import('./database.js');
    const conversations = await getMyConversations(5);

    if (!conversations.length) {
      messagesMenu.innerHTML = `
        <li class="dropdown-header">Messages</li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item py-2 text-center text-muted">No messages yet</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-center text-primary" href="messages.html" data-action="open-messaging">See all messages</a></li>
      `;
      return;
    }

    const itemsHtml = conversations.map((c) => {
      const name = c.other?.full_name || c.other?.username || 'Conversation';
      const avatar = c.other?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&size=64`;
      const preview = c.last_message?.body ? escapeHtml(truncateText(c.last_message.body, 60)) : 'No messages yet';
      const unreadDot = c.has_unread ? '<span class="badge bg-danger ms-auto" style="width:8px;height:8px;border-radius:9999px;padding:0"></span>' : '';

      return `
        <li>
          <a class="dropdown-item d-flex align-items-center gap-2 py-2" href="#" data-action="open-conversation" data-conversation-id="${escapeHtml(c.id)}">
            <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" width="34" height="34" class="rounded-circle" loading="lazy">
            <div class="flex-grow-1" style="min-width: 0;">
              <div class="d-flex align-items-center gap-2">
                <strong class="small text-truncate">${escapeHtml(name)}</strong>
              </div>
              <div class="small text-muted text-truncate">${preview}</div>
            </div>
            ${unreadDot}
          </a>
        </li>
      `;
    }).join('');

    messagesMenu.innerHTML = `
      <li class="dropdown-header">Messages</li>
      <li><hr class="dropdown-divider"></li>
      ${itemsHtml}
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item text-center text-primary" href="messages.html" data-action="open-messaging">See all messages</a></li>
    `;
  } catch (err) {
    // Most common: missing DB tables until migration is applied.
    console.warn('Messaging preview unavailable', err);
    messagesMenu.innerHTML = `
      <li class="dropdown-header">Messages</li>
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item py-2 text-center text-muted">Messaging not set up yet</a></li>
      <li><hr class="dropdown-divider"></li>
      <li><a class="dropdown-item text-center text-primary" href="messages.html" data-action="open-messaging">See all messages</a></li>
    `;
  }
}

export async function refreshMessagesBadge() {
  const badge = document.getElementById('messagesBadge');
  const barBadge = document.getElementById('messagingBarBadge');

  try {
    const { getMyUnreadCounts } = await import('./database.js');
    const counts = await getMyUnreadCounts();

    const unreadMessages = Number(counts?.unread_messages) || 0;
    const label = String(unreadMessages);

    if (badge) {
      badge.textContent = label;
      badge.classList.toggle('d-none', unreadMessages <= 0);
    }
    if (barBadge) {
      barBadge.textContent = label;
      barBadge.style.display = unreadMessages > 0 ? '' : 'none';
    }
  } catch {
    // Most common: messaging tables / RPC not created yet
    if (badge) {
      badge.textContent = '0';
      badge.classList.add('d-none');
    }
    if (barBadge) {
      barBadge.style.display = 'none';
    }
  }
}

let messagingRealtimeCleanup = null;

async function initMessagingRealtime() {
  const messagesToggle = document.getElementById('messagesToggle');
  const messagesMenu = document.getElementById('messagesMenu');
  if (!messagesToggle || !messagesMenu) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const [{ supabase }, { getMyConversations }] = await Promise.all([
      import('./supabase.js'),
      import('./database.js')
    ]);

    // Clean previous subscriptions
    if (typeof messagingRealtimeCleanup === 'function') {
      messagingRealtimeCleanup();
      messagingRealtimeCleanup = null;
    }

    const convos = await getMyConversations(20);
    const conversationIds = (convos || []).map((c) => c.id).filter(Boolean);

    const channels = [];

    // Watch participant rows for this user (new conversations, read state updates, etc.)
    const participantsChannel = supabase
      .channel(`realtime:conversation_participants:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        async (payload) => {
          await refreshMessagesBadge();
          if (payload?.eventType === 'INSERT' || payload?.eventType === 'DELETE') {
            // Re-init message channels to follow new/removed conversations
            initMessagingRealtime().catch(() => {
              // ignore
            });
          }
        }
      )
      .subscribe();

    channels.push(participantsChannel);

    // Watch message inserts for recent conversations
    conversationIds.forEach((conversationId) => {
      const ch = supabase
        .channel(`realtime:messages:${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          async (payload) => {
            const newRow = payload?.new;
            const convoId = newRow?.conversation_id || conversationId;

            await refreshMessagesBadge();

            // Update dropdown preview if it is open
            const dropdownRoot = messagesMenu.closest('.dropdown');
            if (dropdownRoot?.classList.contains('show')) {
              loadMessagesPreview(messagesMenu).catch(() => {
                // ignore
              });
            }

            // Update drawer view if open on this conversation
            if (messagingDrawerState?.isOpen && messagingDrawerState?.view === 'conversation' && messagingDrawerState?.conversationId === convoId) {
              renderConversationView(convoId).catch(() => {
                // ignore
              });
            }

            // Notify pages (e.g., messages.html)
            try {
              window.dispatchEvent(new CustomEvent('socialcore:message:new', { detail: { conversationId: convoId } }));
            } catch {
              // ignore
            }
          }
        )
        .subscribe();

      channels.push(ch);
    });

    messagingRealtimeCleanup = () => {
      try {
        channels.forEach((ch) => {
          supabase.removeChannel(ch);
        });
      } catch {
        // ignore
      }
    };
  } catch (err) {
    console.warn('Realtime messaging unavailable', err);
  }
}

let messagingDrawerState = {
  isOpen: false,
  view: 'list',
  conversationId: null,
};

function ensureMessagingDrawer() {
  let drawer = document.getElementById('messagingDrawer');
  if (drawer) return drawer;

  drawer = document.createElement('div');
  drawer.id = 'messagingDrawer';
  drawer.className = 'messaging-drawer';
  drawer.setAttribute('aria-hidden', 'true');

  drawer.innerHTML = `
    <div class="messaging-drawer-header d-flex align-items-center gap-2 px-3 py-2 border-bottom">
      <button type="button" class="btn btn-link text-muted p-0 messaging-back d-none" data-action="messaging-back" aria-label="Back">
        <i class="bi bi-arrow-left fs-5"></i>
      </button>
      <div class="flex-grow-1 fw-semibold" id="messagingDrawerTitle">Messaging</div>
      <button type="button" class="btn btn-link text-muted p-0" data-action="messaging-new" aria-label="New message">
        <i class="bi bi-pencil-square fs-5"></i>
      </button>
      <button type="button" class="btn btn-link text-muted p-0" data-action="messaging-close" aria-label="Close">
        <i class="bi bi-x-lg fs-5"></i>
      </button>
    </div>
    <div class="messaging-drawer-body" id="messagingDrawerBody"></div>
    <form class="messaging-drawer-footer d-none" id="messagingDrawerForm">
      <div class="input-group">
        <input type="text" class="form-control" id="messagingDrawerInput" placeholder="Write a message..." autocomplete="off" />
        <button class="btn btn-primary" type="submit">Send</button>
      </div>
    </form>
  `;

  document.body.appendChild(drawer);

  drawer.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'messaging-close') {
      closeMessagingDrawer();
      return;
    }

    if (action === 'messaging-back') {
      openMessagingDrawer({ view: 'list' }).catch(() => {
        // ignore
      });
      return;
    }

    if (action === 'messaging-new') {
      openMessagingDrawer({ view: 'new' }).catch((err) => {
        console.error(err);
        showToast(err?.message || 'Failed to start a new message', 'error');
      });
      return;
    }
  });

  const form = drawer.querySelector('#messagingDrawerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = drawer.querySelector('#messagingDrawerInput');
    const body = input.value;

    if (!messagingDrawerState.conversationId) return;

    try {
      const { sendConversationMessage } = await import('./database.js');
      input.value = '';
      await sendConversationMessage(messagingDrawerState.conversationId, body);
      await renderConversationView(messagingDrawerState.conversationId);
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Failed to send message', 'error');
    }
  });

  return drawer;
}

function openDrawerDom() {
  const drawer = ensureMessagingDrawer();
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  messagingDrawerState.isOpen = true;
  // Hide the minimized bar while drawer is open
  const bar = document.getElementById('messagingBar');
  if (bar) bar.style.display = 'none';
}

function closeMessagingDrawer() {
  const drawer = document.getElementById('messagingDrawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  messagingDrawerState.isOpen = false;
  // Show the minimized bar again
  const bar = document.getElementById('messagingBar');
  if (bar) bar.style.display = '';
}

/**
 * LinkedIn-style minimized messaging bar at bottom-right.
 * Always visible for logged-in users; clicking opens the full drawer.
 */
async function initMessagingBar() {
  // Only show on pages that aren't the dedicated messages page
  const currentPage = window.location.pathname.split('/').pop() || '';
  if (currentPage === 'messages.html') return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  let bar = document.getElementById('messagingBar');
  if (bar) return; // already exists

  bar = document.createElement('div');
  bar.id = 'messagingBar';
  bar.className = 'messaging-bar';
  bar.innerHTML = `
    <div class="messaging-bar-inner">
      <i class="bi bi-chat-dots-fill text-primary"></i>
      <span class="messaging-bar-title">Messaging</span>
      <span class="messaging-bar-badge" id="messagingBarBadge" style="display:none">0</span>
      <div class="messaging-bar-actions">
        <button type="button" class="btn btn-link text-muted p-0" data-bar-action="new" title="New message">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button type="button" class="btn btn-link text-muted p-0" data-bar-action="expand" title="Open messaging">
          <i class="bi bi-chevron-up"></i>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(bar);

  // Click on the bar opens the drawer to the conversation list
  bar.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-bar-action]');
    const action = actionBtn?.dataset?.barAction;

    if (action === 'new') {
      e.stopPropagation();
      openMessagingDrawer({ view: 'new' }).catch((err) => {
        console.error(err);
        showToast(err?.message || 'Failed to start new message', 'error');
      });
      return;
    }

    // Default: open the drawer list view
    openMessagingDrawer({ view: 'list' }).catch((err) => {
      console.error(err);
      showToast(err?.message || 'Failed to open messaging', 'error');
    });
  });

  // Refresh badge on bar too
  refreshMessagesBadge().catch(() => {});
}

export async function openMessagingDrawer({ view, conversationId } = { view: 'list' }) {
  openDrawerDom();

  messagingDrawerState.view = view || 'list';
  messagingDrawerState.conversationId = conversationId || null;

  const drawer = ensureMessagingDrawer();
  const titleEl = drawer.querySelector('#messagingDrawerTitle');
  const backBtn = drawer.querySelector('.messaging-back');
  const footer = drawer.querySelector('#messagingDrawerForm');

  if (messagingDrawerState.view === 'conversation') {
    backBtn.classList.remove('d-none');
    footer.classList.remove('d-none');
    titleEl.textContent = 'Conversation';
    await renderConversationView(messagingDrawerState.conversationId);
    return;
  }

  footer.classList.add('d-none');
  backBtn.classList.add('d-none');

  if (messagingDrawerState.view === 'new') {
    titleEl.textContent = 'New message';
    await renderNewMessageView();
    return;
  }

  titleEl.textContent = 'Messaging';
  await renderConversationListView();
}

async function renderConversationListView() {
  const drawer = ensureMessagingDrawer();
  const bodyEl = drawer.querySelector('#messagingDrawerBody');
  bodyEl.innerHTML = '<div class="p-3 text-muted small">Loading...</div>';

  try {
    const { getMyConversations } = await import('./database.js');
    const conversations = await getMyConversations(20);

    if (!conversations.length) {
      bodyEl.innerHTML = `
        <div class="p-3">
          <div class="text-muted small mb-2">No conversations yet.</div>
          <button type="button" class="btn btn-outline-primary btn-sm w-100" data-action="messaging-new">Start a new message</button>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = `
      <div class="list-group list-group-flush">
        ${conversations.map((c) => {
          const name = c.other?.full_name || c.other?.username || 'Conversation';
          const avatar = c.other?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&size=64`;
          const preview = c.last_message?.body ? escapeHtml(truncateText(c.last_message.body, 60)) : 'No messages yet';
          const unreadClass = c.has_unread ? 'messaging-unread' : '';

          return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 ${unreadClass}" data-action="messaging-open" data-conversation-id="${escapeHtml(c.id)}">
              <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" width="38" height="38" class="rounded-circle" loading="lazy">
              <div class="flex-grow-1" style="min-width:0">
                <div class="fw-semibold small text-truncate">${escapeHtml(name)}</div>
                <div class="small text-muted text-truncate">${preview}</div>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;

    bodyEl.querySelectorAll('[data-action="messaging-open"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.conversationId;
        if (!id) return;
        openMessagingDrawer({ view: 'conversation', conversationId: id }).catch((err) => {
          console.error(err);
          showToast(err?.message || 'Failed to open conversation', 'error');
        });
      });
    });
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = '<div class="p-3 text-muted small">Messaging not set up yet.</div>';
  }
}

async function renderNewMessageView() {
  const drawer = ensureMessagingDrawer();
  const bodyEl = drawer.querySelector('#messagingDrawerBody');
  bodyEl.innerHTML = '<div class="p-3 text-muted small">Loading friends...</div>';

  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const { getFriendsForUser, getOrCreateDirectConversation } = await import('./database.js');
    const { friends } = await getFriendsForUser(userId, 30);

    if (!friends.length) {
      bodyEl.innerHTML = '<div class="p-3 text-muted small">No friends found to message.</div>';
      return;
    }

    bodyEl.innerHTML = `
      <div class="list-group list-group-flush">
        ${friends.map((f) => {
          const name = f.full_name || f.username || 'User';
          const avatar = f.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&size=64`;
          return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2" data-action="messaging-start" data-user-id="${escapeHtml(f.id)}">
              <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" width="38" height="38" class="rounded-circle" loading="lazy">
              <div class="flex-grow-1" style="min-width:0">
                <div class="fw-semibold small text-truncate">${escapeHtml(name)}</div>
                <div class="small text-muted text-truncate">@${escapeHtml(f.username || '')}</div>
              </div>
            </button>
          `;
        }).join('')}
      </div>
    `;

    bodyEl.querySelectorAll('[data-action="messaging-start"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const otherUserId = btn.dataset.userId;
        if (!otherUserId) return;
        try {
          const convo = await getOrCreateDirectConversation(otherUserId);
          await openMessagingDrawer({ view: 'conversation', conversationId: convo.id });
        } catch (err) {
          console.error(err);
          showToast(err?.message || 'Failed to start conversation', 'error');
        }
      });
    });
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = '<div class="p-3 text-muted small">Unable to load friends.</div>';
  }
}

async function renderConversationView(conversationId) {
  if (!conversationId) throw new Error('Missing conversation id');

  const drawer = ensureMessagingDrawer();
  const bodyEl = drawer.querySelector('#messagingDrawerBody');
  const titleEl = drawer.querySelector('#messagingDrawerTitle');
  const input = drawer.querySelector('#messagingDrawerInput');
  bodyEl.innerHTML = '<div class="p-3 text-muted small">Loading conversation...</div>';

  const userId = await getCurrentUserId();

  try {
    const { getConversationMessages, markConversationRead } = await import('./database.js');
    const messages = await getConversationMessages(conversationId, 60);

    // Attempt to set a nicer title from message participants
    const other = messages
      .map((m) => m.sender)
      .find((p) => p?.id && p.id !== userId);

    if (other) {
      titleEl.textContent = other.full_name || other.username || 'Conversation';
    }

    bodyEl.innerHTML = `
      <div class="messaging-thread p-3">
        ${messages.length ? messages.map((m) => {
          const mine = userId && m.sender_id === userId;
          const bubbleClass = mine ? 'messaging-bubble messaging-bubble--mine' : 'messaging-bubble messaging-bubble--theirs';
          return `
            <div class="${mine ? 'd-flex justify-content-end' : 'd-flex justify-content-start'} mb-2">
              <div class="${bubbleClass}">
                <div class="small">${escapeHtml(m.body)}</div>
              </div>
            </div>
          `;
        }).join('') : '<div class="text-muted small">No messages yet.</div>'}
      </div>
    `;

    // Scroll to bottom
    const thread = bodyEl.querySelector('.messaging-thread');
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }

    input?.focus();
    await markConversationRead(conversationId);
    await refreshMessagesBadge();
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = '<div class="p-3 text-muted small">Messaging not set up yet.</div>';
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
