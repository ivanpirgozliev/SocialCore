/**
 * SocialCore - Photos Page
 * Upload and list user photos using Supabase Storage
 */

import { supabase } from './supabase.js';
import { showToast } from './main.js';
import { getProfileIdByUsername } from './database.js';

const BUCKET_ID = 'post-images';
const USER_PHOTOS_FOLDER = 'photos';

const photosViewerState = {
  modalEl: null,
  imageEl: null,
  counterEl: null,
  triggers: [],
  currentIndex: 0,
  keyHandler: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initPhotosPage();
});

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function resolveTargetUserId(authUserId) {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam && isUuid(idParam)) return idParam;

  const usernameParam = params.get('user') || params.get('username') || params.get('u');
  if (usernameParam) {
    const { id } = await getProfileIdByUsername(usernameParam);
    return id;
  }

  return authUserId;
}

async function initPhotosPage() {
  const photosInput = document.getElementById('photosInput');
  const uploadBtn = document.getElementById('uploadPhotosBtn');
  const refreshBtn = document.getElementById('refreshPhotosBtn');

  const backToProfileLink = document.getElementById('photosBackToProfileLink');
  const galleryTitle = document.getElementById('photosGalleryTitle');
  initPhotosViewer();

  const authUser = await requireUser();
  if (!authUser) return;

  let targetUserId = authUser.id;
  try {
    targetUserId = await resolveTargetUserId(authUser.id);
  } catch (e) {
    showToast('Could not find that user.', 'error');
    window.location.href = 'feed.html';
    return;
  }

  const isOwnPhotos = targetUserId === authUser.id;

  if (backToProfileLink) {
    backToProfileLink.href = `profile.html?id=${encodeURIComponent(targetUserId)}`;
  }

  if (uploadBtn) uploadBtn.classList.toggle('d-none', !isOwnPhotos);
  if (galleryTitle && !isOwnPhotos) {
    galleryTitle.innerHTML = '<i class="bi bi-images me-2 text-primary-blue"></i>Photos';
  }

  if (photosInput && uploadBtn && isOwnPhotos) {
    uploadBtn.addEventListener('click', () => {
      photosInput.click();
    });

    photosInput.addEventListener('change', async () => {
      const files = Array.from(photosInput.files || []);
      if (!files.length) return;

      const originalBtnHtml = uploadBtn.innerHTML;
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

      try {
        const uploadedCount = await uploadImages(authUser.id, files);
        showToast(`Uploaded ${uploadedCount} photo${uploadedCount === 1 ? '' : 's'}!`, 'success');
        photosInput.value = '';
        await loadPhotos(targetUserId);
      } catch (err) {
        showToast(err?.message || 'Upload failed. Please try again.', 'error');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadPhotos(targetUserId);
    });
  }

  await loadPhotos(targetUserId);
}

function ensurePhotosViewerModal() {
  if (photosViewerState.modalEl) return photosViewerState.modalEl;

  const modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'photosViewerModal';
  modalEl.tabIndex = -1;
  modalEl.setAttribute('aria-hidden', 'true');

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width: min(1100px, 95vw); width: 95vw;">
      <div class="modal-content bg-dark border-0 text-white rounded-3 overflow-hidden" style="height: 720px; max-height: 85vh;">
        <div class="modal-body p-0 position-relative bg-dark h-100">
          <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-2" data-bs-dismiss="modal" aria-label="Close"></button>

          <button type="button" class="btn btn-dark position-absolute top-50 start-0 translate-middle-y ms-3 px-3" data-action="prev" aria-label="Previous photo" style="z-index: 10;">
            <i class="bi bi-chevron-left"></i>
          </button>

          <img src="" alt="Photo" class="d-block" id="photosViewerImage" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; background: #000;">

          <button type="button" class="btn btn-dark position-absolute top-50 end-0 translate-middle-y me-3 px-3" data-action="next" aria-label="Next photo" style="z-index: 10;">
            <i class="bi bi-chevron-right"></i>
          </button>

          <div class="position-absolute bottom-0 start-50 translate-middle-x mb-2 px-2 py-1 rounded bg-dark bg-opacity-75 text-white-50 small" id="photosViewerCounter"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  photosViewerState.modalEl = modalEl;
  photosViewerState.imageEl = modalEl.querySelector('#photosViewerImage');
  photosViewerState.counterEl = modalEl.querySelector('#photosViewerCounter');

  modalEl.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.getAttribute('data-action');
    if (!action) return;
    if (action === 'prev') {
      event.preventDefault();
      navigatePhotosViewer(-1);
      return;
    }
    if (action === 'next') {
      event.preventDefault();
      navigatePhotosViewer(1);
    }
  });

  modalEl.addEventListener('shown.bs.modal', () => {
    photosViewerState.keyHandler = (event) => {
      if (event.key === 'ArrowLeft') navigatePhotosViewer(-1);
      if (event.key === 'ArrowRight') navigatePhotosViewer(1);
    };
    document.addEventListener('keydown', photosViewerState.keyHandler);
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    if (photosViewerState.keyHandler) {
      document.removeEventListener('keydown', photosViewerState.keyHandler);
      photosViewerState.keyHandler = null;
    }
  });

  return modalEl;
}

function updatePhotosViewer() {
  if (!photosViewerState.imageEl || !photosViewerState.triggers.length) return;

  const trigger = photosViewerState.triggers[photosViewerState.currentIndex];
  const url = trigger?.getAttribute('data-photo-viewer-url') || '';

  photosViewerState.imageEl.src = url;
  photosViewerState.counterEl.textContent = `${photosViewerState.currentIndex + 1} / ${photosViewerState.triggers.length}`;
}

function navigatePhotosViewer(direction) {
  if (!photosViewerState.triggers.length) return;

  const total = photosViewerState.triggers.length;
  photosViewerState.currentIndex = (photosViewerState.currentIndex + direction + total) % total;
  updatePhotosViewer();
}

function openPhotosViewer(trigger) {
  const allTriggers = Array.from(document.querySelectorAll('[data-photo-viewer-url][data-photo-gallery="user-photos"]'));
  if (!allTriggers.length) return;

  const clickedIndex = allTriggers.indexOf(trigger);
  photosViewerState.triggers = allTriggers;
  photosViewerState.currentIndex = clickedIndex >= 0 ? clickedIndex : 0;

  updatePhotosViewer();

  const modalEl = ensurePhotosViewerModal();
  const modal = window.bootstrap?.Modal.getOrCreateInstance(modalEl);
  modal?.show();
}

function initPhotosViewer() {
  ensurePhotosViewerModal();

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-photo-viewer-url]');
    if (!trigger) return;
    if (!trigger.closest('#photosGrid')) return;

    event.preventDefault();
    openPhotosViewer(trigger);
  });
}

function renderSelectedFiles(fileList, summaryEl, listEl, previewEl) {
  if (!summaryEl || !listEl || !previewEl) return;

  const files = Array.from(fileList || []);
  if (!files.length) {
    summaryEl.textContent = 'No files selected';
    listEl.innerHTML = '';
    previewEl.innerHTML = '';
    return;
  }

  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  summaryEl.textContent = `${files.length} file${files.length === 1 ? '' : 's'} selected · ${formatFileSize(totalSize)}`;

  listEl.innerHTML = files
    .slice(0, 6)
    .map((file) => {
      return `
        <div class="upload-file-chip" title="${file.name}">
          <i class="bi bi-image"></i>
          <span>${file.name}</span>
        </div>
      `;
    })
    .join('');

  if (files.length > 6) {
    listEl.insertAdjacentHTML('beforeend', `
      <div class="upload-file-chip upload-file-more">+${files.length - 6} more</div>
    `);
  }

  const previewItems = files.slice(0, 8).map((file) => {
    const objectUrl = URL.createObjectURL(file);
    return `
      <div class="upload-preview-item">
        <img src="${objectUrl}" alt="${file.name}" data-object-url="${objectUrl}" loading="lazy">
      </div>
    `;
  });

  previewEl.innerHTML = previewItems.join('');

  if (files.length > 8) {
    previewEl.insertAdjacentHTML('beforeend', `
      <div class="upload-preview-more">+${files.length - 8} more</div>
    `);
  }

  previewEl.querySelectorAll('img[data-object-url]').forEach((img) => {
    img.addEventListener('load', () => {
      const url = img.getAttribute('data-object-url');
      if (url) URL.revokeObjectURL(url);
    }, { once: true });
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    showToast(error.message || 'Auth error. Please log in again.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    return null;
  }

  const user = data?.user;
  if (!user) {
    showToast('Please log in to manage photos.', 'warning');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 800);
    return null;
  }

  return user;
}

function buildUserPrefix(userId) {
  return `${userId}/${USER_PHOTOS_FOLDER}`;
}

function getFileExtension(fileName) {
  const parts = String(fileName || '').split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

function isImageFile(file) {
  return Boolean(file?.type && file.type.startsWith('image/'));
}

async function uploadImages(userId, files) {
  let uploaded = 0;
  const prefix = buildUserPrefix(userId);

  for (const file of files) {
    if (!isImageFile(file)) continue;

    const ext = getFileExtension(file.name);
    const safeExt = ext ? `.${ext}` : '';
    const uniqueName = `${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}${safeExt}`;
    const filePath = `${prefix}/${uniqueName}`;

    const { error } = await supabase.storage
      .from(BUCKET_ID)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message || 'Upload failed');
    }

    uploaded += 1;
  }

  if (uploaded === 0) {
    throw new Error('No valid images selected.');
  }

  return uploaded;
}

async function loadPhotos(userId) {
  const grid = document.getElementById('photosGrid');
  const emptyState = document.getElementById('photosEmptyState');
  if (!grid || !emptyState) return;

  grid.innerHTML = '';
  emptyState.classList.add('d-none');

  const prefix = buildUserPrefix(userId);
  const { data, error } = await supabase.storage
    .from(BUCKET_ID)
    .list(prefix, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error) {
    showToast(error.message || 'Could not load photos.', 'error');
    emptyState.classList.remove('d-none');
    return;
  }

  const items = (data || []).filter((item) => item?.name);
  if (!items.length) {
    emptyState.classList.remove('d-none');
    return;
  }

  const html = items
    .map((item) => {
      const fullPath = `${prefix}/${item.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET_ID).getPublicUrl(fullPath);
      const publicUrl = urlData?.publicUrl || '';

      return `
        <div class="col-6 col-md-4 col-lg-3">
          <a href="${publicUrl}" class="photos-grid-tile d-block text-decoration-none" data-photo-viewer-url="${publicUrl}" data-photo-gallery="user-photos">
            <img src="${publicUrl}" alt="Photo" class="photos-grid-image" loading="lazy">
          </a>
        </div>
      `;
    })
    .join('');

  grid.innerHTML = html;
}
