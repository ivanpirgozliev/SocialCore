/**
 * SocialCore - Message Reactions (Twemoji)
 */

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

export const MESSAGE_REACTION_OPTIONS = [
  { type: 'like', emoji: '👍', label: 'Like', icon: `${TWEMOJI_BASE}/1f44d.svg` },
  { type: 'love', emoji: '❤️', label: 'Love', icon: `${TWEMOJI_BASE}/2764.svg` },
  { type: 'haha', emoji: '😂', label: 'Haha', icon: `${TWEMOJI_BASE}/1f602.svg` },
  { type: 'wow', emoji: '😮', label: 'Wow', icon: `${TWEMOJI_BASE}/1f62e.svg` },
  { type: 'sad', emoji: '😢', label: 'Sad', icon: `${TWEMOJI_BASE}/1f622.svg` },
  { type: 'angry', emoji: '😡', label: 'Angry', icon: `${TWEMOJI_BASE}/1f621.svg` },
];

const MESSAGE_REACTION_BY_TYPE = Object.fromEntries(MESSAGE_REACTION_OPTIONS.map((o) => [o.type, o]));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function messageReactionImg(type, extraClass = '') {
  const option = MESSAGE_REACTION_BY_TYPE[type] || MESSAGE_REACTION_OPTIONS[0];
  return `<img src="${option.icon}" alt="${option.emoji}" class="reaction-img ${extraClass}" draggable="false" loading="lazy">`;
}

export function buildMessageReactionControlHtml(message) {
  const safeMessageId = escapeHtml(String(message?.id || ''));
  const userReaction = String(message?.user_reaction || '').trim();
  const reactionCounts = message?.reaction_counts || {};
  const total = Number(message?.reactions_total) || 0;
  const triggerIcon = '<i class="bi bi-emoji-smile"></i>';

  const optionsHtml = MESSAGE_REACTION_OPTIONS.map((option) => `
    <button
      type="button"
      class="message-reaction-option ${userReaction === option.type ? 'is-active' : ''}"
      data-message-reaction-action="set"
      data-message-id="${safeMessageId}"
      data-reaction-type="${option.type}"
      title="${escapeHtml(option.label)}"
      aria-label="React with ${escapeHtml(option.label)}"
    >
      ${messageReactionImg(option.type, 'reaction-picker-img')}
    </button>
  `).join('');

  const clearHtml = userReaction
    ? `
      <button
        type="button"
        class="message-reaction-clear"
        data-message-reaction-action="clear"
        data-message-id="${safeMessageId}"
        title="Remove reaction"
        aria-label="Remove reaction"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    `
    : '';

  return `
    <div class="message-reaction-control" data-message-id="${safeMessageId}">
      <button
        type="button"
        class="message-reaction-toggle"
        data-message-reaction-action="toggle"
        data-message-id="${safeMessageId}"
        aria-label="Open message reactions"
      >
        ${triggerIcon}
      </button>
      <div class="message-reaction-options">${optionsHtml}${clearHtml}</div>
    </div>
  `;
}

export function buildMessageReactionBadgeHtml(message) {
  const reactionCounts = message?.reaction_counts || {};
  const total = Number(message?.reactions_total) || 0;
  if (!total) return '';

  const userReaction = String(message?.user_reaction || '').trim();

  let dominantType = userReaction || null;
  if (!dominantType) {
    dominantType = MESSAGE_REACTION_OPTIONS
      .map((option) => ({ type: option.type, count: Number(reactionCounts[option.type]) || 0 }))
      .sort((a, b) => b.count - a.count)[0]?.type || 'like';
  }

  return `
    <div class="message-reaction-badge" title="${escapeHtml(String(total))} reactions" aria-label="${escapeHtml(String(total))} reactions">
      ${messageReactionImg(dominantType, 'reaction-chip-img')}
      <span>${total}</span>
    </div>
  `;
}
