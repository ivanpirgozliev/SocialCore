/**
 * SocialCore - Messages Page Module
 */

import { showToast, truncateText, getStoredUser, refreshStoredUserFromProfile } from './main.js';
import {
  getMyConversations,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
} from './database.js';

let activeConversationId = null;
let activeConversationOtherName = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshStoredUserFromProfile().catch(() => {
    // ignore
  });

  initMessagesPage();
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function initMessagesPage() {
  const listEl = document.getElementById('messagesConversationsList');
  const threadEl = document.getElementById('messagesThread');
  const titleEl = document.getElementById('messagesConversationTitle');
  const form = document.getElementById('messagesForm');
  const input = document.getElementById('messagesInput');
  const sendBtn = form?.querySelector('button[type="submit"]');
  const searchEl = document.getElementById('messagesSearch');
  const newBtn = document.getElementById('messagesNewBtn');
  const openDrawerBtn = document.getElementById('messagesOpenDrawerBtn');

  if (!listEl || !threadEl || !titleEl || !form || !input || !sendBtn) return;

  input.disabled = true;
  sendBtn.disabled = true;

  let allConversations = [];

  async function loadList() {
    listEl.innerHTML = '<div class="p-3 text-muted small">Loading...</div>';

    try {
      allConversations = await getMyConversations(50);
      renderList(allConversations);

      // Auto-open first conversation (LinkedIn-like)
      if (!activeConversationId && allConversations.length) {
        openConversation(allConversations[0].id).catch(() => {
          // ignore
        });
      }
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<div class="p-3 text-muted small">Messaging not set up yet.</div>';
    }
  }

  function renderList(conversations) {
    if (!conversations.length) {
      listEl.innerHTML = '<div class="p-3 text-muted small">No conversations yet.</div>';
      return;
    }

    listEl.innerHTML = conversations.map((c) => {
      const name = c.other?.full_name || c.other?.username || 'Conversation';
      const avatar = c.other?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3B82F6&color=fff&size=64`;
      const preview = c.last_message?.body ? escapeHtml(truncateText(c.last_message.body, 60)) : 'No messages yet';
      const unreadDot = c.has_unread ? '<span class="badge bg-danger" style="width:8px;height:8px;border-radius:9999px;padding:0"></span>' : '';
      const activeClass = c.id === activeConversationId ? 'active' : '';

      return `
        <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 ${activeClass}" data-conversation-id="${escapeHtml(c.id)}">
          <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" width="40" height="40" class="rounded-circle" loading="lazy">
          <div class="flex-grow-1" style="min-width:0">
            <div class="d-flex align-items-center justify-content-between gap-2">
              <div class="fw-semibold small text-truncate">${escapeHtml(name)}</div>
              ${unreadDot}
            </div>
            <div class="small text-muted text-truncate">${preview}</div>
          </div>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('[data-conversation-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.conversationId;
        if (!id) return;
        openConversation(id).catch((err) => {
          console.error(err);
          showToast(err?.message || 'Failed to open conversation', 'error');
        });
      });
    });
  }

  async function openConversation(conversationId) {
    activeConversationId = conversationId;
    titleEl.textContent = 'Loading...';
    threadEl.innerHTML = '<div class="text-muted small">Loading conversation...</div>';
    input.disabled = false;
    sendBtn.disabled = false;

    // Update active styling
    renderList(filterConversations(searchEl?.value || ''));

    try {
      const messages = await getConversationMessages(conversationId, 100);
      const currentUserId = getStoredUser()?.id || null;

      // Determine other name from message senders if possible
      const other = messages
        .map((m) => m.sender)
        .find((p) => p?.id && p.id !== currentUserId);

      activeConversationOtherName = other?.full_name || other?.username || null;
      titleEl.textContent = activeConversationOtherName || 'Conversation';

      threadEl.innerHTML = messages.length
        ? messages.map((m) => {
          const mine = currentUserId && m.sender_id === currentUserId;
          const bubbleClass = mine ? 'messaging-bubble messaging-bubble--mine' : 'messaging-bubble messaging-bubble--theirs';
          return `
            <div class="${mine ? 'd-flex justify-content-end' : 'd-flex justify-content-start'} mb-2">
              <div class="${bubbleClass}">
                <div class="small">${escapeHtml(m.body)}</div>
              </div>
            </div>
          `;
        }).join('')
        : '<div class="text-muted small">No messages yet.</div>';

      threadEl.scrollTop = threadEl.scrollHeight;

      await markConversationRead(conversationId);
      await safeRefreshMessagesBadge();
      await loadList();
    } catch (err) {
      console.error(err);
      titleEl.textContent = 'Conversation';
      threadEl.innerHTML = '<div class="text-muted small">Failed to load conversation.</div>';
    }
  }

  function filterConversations(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return allConversations;

    return allConversations.filter((c) => {
      const name = (c.other?.full_name || c.other?.username || '').toLowerCase();
      const last = (c.last_message?.body || '').toLowerCase();
      return name.includes(q) || last.includes(q);
    });
  }

  // Search
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      renderList(filterConversations(searchEl.value));
    });
  }

  // New message: pick a friend (simple list via prompt-like modal pattern not required; use drawer new-message view)
  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      try {
        const { openMessagingDrawer } = await import('./main.js');
        await openMessagingDrawer({ view: 'new' });
      } catch (err) {
        console.error(err);
        showToast(err?.message || 'Failed to start a new message', 'error');
      }
    });
  }

  // Open drawer button
  if (openDrawerBtn) {
    openDrawerBtn.addEventListener('click', async () => {
      try {
        const { openMessagingDrawer } = await import('./main.js');
        if (activeConversationId) {
          await openMessagingDrawer({ view: 'conversation', conversationId: activeConversationId });
        } else {
          await openMessagingDrawer({ view: 'list' });
        }
      } catch {
        // ignore
      }
    });
  }

  // Send
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConversationId) return;

    const text = input.value;
    try {
      input.value = '';
      await sendConversationMessage(activeConversationId, text);
      await openConversation(activeConversationId);
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Failed to send message', 'error');
    }
  });

  // Realtime events from main.js
  window.addEventListener('socialcore:message:new', (e) => {
    const conversationId = e?.detail?.conversationId;
    if (!conversationId) return;

    safeRefreshMessagesBadge().catch(() => {
      // ignore
    });

    if (activeConversationId && conversationId === activeConversationId) {
      openConversation(activeConversationId).catch(() => {
        // ignore
      });
    } else {
      loadList().catch(() => {
        // ignore
      });
    }
  });

  await loadList();
}

async function safeRefreshMessagesBadge() {
  try {
    const { refreshMessagesBadge } = await import('./main.js');
    await refreshMessagesBadge();
  } catch {
    // ignore
  }
}
