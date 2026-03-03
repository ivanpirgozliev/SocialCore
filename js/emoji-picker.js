/**
 * SocialCore - Emoji Picker Module
 * Lightweight emoji picker using Twemoji SVG images
 */

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

/**
 * Convert a Unicode emoji string to its Twemoji SVG URL.
 * Handles multi-codepoint emoji (flags, skin tones, ZWJ sequences).
 */
function emojiToTwemojiUrl(emoji) {
  const codepoints = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    // Skip variation selector VS16 (0xFE0F) for filename lookup
    if (cp === 0xFE0F) continue;
    codepoints.push(cp.toString(16));
  }
  return `${TWEMOJI_BASE}/${codepoints.join('-')}.svg`;
}

/**
 * Build an <img> tag for a Twemoji emoji.
 */
function twemojiImg(emoji, extraClass = '') {
  const url = emojiToTwemojiUrl(emoji);
  return `<img src="${url}" alt="${emoji}" class="emoji-picker-twemoji ${extraClass}" draggable="false" loading="lazy">`;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦍','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🦂','🐙','🦑','🐠','🐟','🐡','🐬','🦈','🐳','🐋','🐊','🐆','🐅','🐃'],
  'Food': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍟','🍕','🌭','🍔','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥠','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍺','🍻','🥂','🍷','🍸','🍹'],
  'Objects': ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🎿','🎮','🕹️','🎲','🧩','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎯','🔮','🧿','🎰','💎','🔑','🗝️','🔒','📱','💻','⌨️','🖥️','📷','📸','📹','📼','🔍','💡','📚','📖','✏️','✒️','🖊️','📝','📌','📎','🔗'],
  'Symbols': ['💯','🔥','⭐','🌟','✨','⚡','💥','💫','🎉','🎊','✅','❌','⛔','🚫','💢','♻️','✳️','❇️','🔆','🔅','⚠️','🚸','🔱','⚜️','🔰','💠','🔷','🔶','🔵','🟠','🟡','🟢','🟣','🟤','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','◼️','◻️','🔲','🔳','▪️','▫️']
};

let activePickerEl = null;

/**
 * Close any open emoji picker
 */
export function closeEmojiPicker() {
  if (activePickerEl) {
    activePickerEl.remove();
    activePickerEl = null;
  }
}

/**
 * Create and attach an emoji picker toggle button next to an input field.
 * @param {HTMLElement} inputGroup - The .input-group container holding the text input
 * @param {HTMLInputElement} inputEl - The text input to insert emoji into
 */
export function attachEmojiPicker(inputGroup, inputEl) {
  if (!inputGroup || !inputEl) return;

  const emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className = 'btn btn-emoji-toggle';
  emojiBtn.title = 'Add emoji';
  emojiBtn.innerHTML = '<i class="bi bi-emoji-smile"></i>';

  // Insert before the send button
  const sendBtn = inputGroup.querySelector('button[type="button"], button[type="submit"]');
  if (sendBtn) {
    inputGroup.insertBefore(emojiBtn, sendBtn);
  } else {
    inputGroup.appendChild(emojiBtn);
  }

  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePicker(emojiBtn, inputEl);
  });
}

function togglePicker(anchorBtn, inputEl) {
  // If already open for this button, close it
  if (activePickerEl && activePickerEl._anchorBtn === anchorBtn) {
    closeEmojiPicker();
    return;
  }

  closeEmojiPicker();

  const picker = document.createElement('div');
  picker.className = 'emoji-picker-popover';
  picker._anchorBtn = anchorBtn;
  activePickerEl = picker;

  // Build picker content
  const categoryNames = Object.keys(EMOJI_CATEGORIES);
  let activeCat = categoryNames[0];

  const header = document.createElement('div');
  header.className = 'emoji-picker-tabs';
  categoryNames.forEach((cat) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'emoji-picker-tab' + (cat === activeCat ? ' active' : '');
    tab.innerHTML = twemojiImg(EMOJI_CATEGORIES[cat][0], 'emoji-picker-tab-img');
    tab.title = cat;
    tab.dataset.category = cat;
    header.appendChild(tab);
  });

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'emoji-picker-search';
  searchInput.placeholder = 'Search emoji...';

  const grid = document.createElement('div');
  grid.className = 'emoji-picker-grid';

  function renderGrid(emojis) {
    grid.innerHTML = '';
    emojis.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-picker-item';
      btn.dataset.emoji = em;
      btn.innerHTML = twemojiImg(em);
      grid.appendChild(btn);
    });
  }

  renderGrid(EMOJI_CATEGORIES[activeCat]);

  header.addEventListener('click', (e) => {
    const tab = e.target.closest('.emoji-picker-tab');
    if (!tab) return;
    activeCat = tab.dataset.category;
    header.querySelectorAll('.emoji-picker-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    searchInput.value = '';
    renderGrid(EMOJI_CATEGORIES[activeCat]);
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderGrid(EMOJI_CATEGORIES[activeCat]);
      return;
    }
    // Search across all categories by matching category name
    const results = [];
    for (const [cat, emojis] of Object.entries(EMOJI_CATEGORIES)) {
      if (cat.toLowerCase().includes(q)) {
        results.push(...emojis);
      }
    }
    // If no category match, show all emojis
    if (!results.length) {
      for (const emojis of Object.values(EMOJI_CATEGORIES)) {
        results.push(...emojis);
      }
    }
    renderGrid(results);
  });

  grid.addEventListener('click', (e) => {
    const item = e.target.closest('.emoji-picker-item');
    if (!item) return;
    const emoji = item.dataset.emoji;
    if (emoji) {
      insertEmojiIntoInput(inputEl, emoji);
      closeEmojiPicker();
    }
  });

  picker.appendChild(header);
  picker.appendChild(searchInput);
  picker.appendChild(grid);

  // Stop clicks from propagating
  picker.addEventListener('click', (e) => e.stopPropagation());

  // Position relative to anchor button
  anchorBtn.style.position = 'relative';
  anchorBtn.parentElement.style.position = 'relative';
  document.body.appendChild(picker);

  // Position the picker above the button
  positionPicker(picker, anchorBtn);

  // Focus search
  searchInput.focus();
}

function positionPicker(picker, anchor) {
  const rect = anchor.getBoundingClientRect();
  const pickerW = 300;
  const pickerH = 340;

  let top = rect.top - pickerH - 8;
  let left = rect.right - pickerW;

  // If not enough room above, show below
  if (top < 8) {
    top = rect.bottom + 8;
  }

  // Keep within viewport horizontally
  if (left < 8) left = 8;
  if (left + pickerW > window.innerWidth - 8) {
    left = window.innerWidth - pickerW - 8;
  }

  picker.style.top = `${top + window.scrollY}px`;
  picker.style.left = `${left + window.scrollX}px`;
}

function insertEmojiIntoInput(inputEl, emoji) {
  const start = inputEl.selectionStart || inputEl.value.length;
  const end = inputEl.selectionEnd || inputEl.value.length;
  const before = inputEl.value.substring(0, start);
  const after = inputEl.value.substring(end);
  inputEl.value = before + emoji + after;
  inputEl.focus();
  const newPos = start + emoji.length;
  inputEl.setSelectionRange(newPos, newPos);
  // Trigger input event for any listeners
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}

// Close picker when clicking outside
document.addEventListener('click', () => {
  closeEmojiPicker();
});

/**
 * Convert a text string containing Unicode emoji into HTML with Twemoji <img> tags.
 * Non-emoji text is HTML-escaped. Use this to render comment/message content.
 */
export function renderTwemoji(text) {
  // Match emoji characters (covers most common emoji ranges)
  const emojiRegex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(emojiRegex)) {
    // Escape the text before this emoji
    if (match.index > lastIndex) {
      result += escapeForTwemoji(text.slice(lastIndex, match.index));
    }
    const emoji = match[0];
    result += `<img src="${emojiToTwemojiUrl(emoji)}" alt="${emoji}" class="twemoji-inline" draggable="false">`;
    lastIndex = match.index + emoji.length;
  }

  // Remaining text after last emoji
  if (lastIndex < text.length) {
    result += escapeForTwemoji(text.slice(lastIndex));
  }

  return result;
}

function escapeForTwemoji(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
