/**
 * SocialCore - Photos Page
 * Upload and list user photos using Supabase Storage
 */

import { supabase } from './supabase.js';
import { showToast } from './main.js';

const BUCKET_ID = 'post-images';
const USER_PHOTOS_FOLDER = 'photos';

document.addEventListener('DOMContentLoaded', () => {
  initPhotosPage();
});

async function initPhotosPage() {
  const uploadForm = document.getElementById('uploadPhotosForm');
  const photosInput = document.getElementById('photosInput');
  const uploadBtn = document.getElementById('uploadPhotosBtn');
  const refreshBtn = document.getElementById('refreshPhotosBtn');

  if (uploadForm && photosInput && uploadBtn) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = await requireUser();
      if (!user) return;

      const files = Array.from(photosInput.files || []);
      if (!files.length) {
        showToast('Please select at least one image.', 'warning');
        return;
      }

      const originalBtnHtml = uploadBtn.innerHTML;
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

      try {
        const uploadedCount = await uploadImages(user.id, files);
        showToast(`Uploaded ${uploadedCount} photo${uploadedCount === 1 ? '' : 's'}!`, 'success');
        photosInput.value = '';
        await loadPhotos(user.id);
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
      const user = await requireUser();
      if (!user) return;
      await loadPhotos(user.id);
    });
  }

  const user = await requireUser();
  if (!user) return;
  await loadPhotos(user.id);
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
          <a href="${publicUrl}" target="_blank" rel="noreferrer" class="d-block text-decoration-none">
            <img src="${publicUrl}" alt="Photo" class="img-fluid rounded" loading="lazy">
          </a>
        </div>
      `;
    })
    .join('');

  grid.innerHTML = html;
}
