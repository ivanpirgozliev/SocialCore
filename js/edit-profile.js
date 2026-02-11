/**
 * Edit Profile Page JavaScript
 * Handles profile editing functionality
 */

import { showToast } from './main.js';
import { getProfile, updateProfile, uploadProfileImage } from './database.js';

// ============================================
// Load Profile Data on Page Load
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  initBirthdayPicker();
  await loadProfileData();
  initCharacterCounter();
  initImagePreviews();
  initFormSubmit();
});

/**
 * Load user profile data from Supabase
 */
async function loadProfileData() {
  try {
    const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
    
    if (!userData.id) {
      window.location.href = 'login.html';
      return;
    }

    // Get profile from Supabase
    const profile = await getProfile(userData.id);
    
    // Populate form fields
    const nameParts = (profile?.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    document.getElementById('firstName').value = firstName;
    document.getElementById('lastName').value = lastName;
    document.getElementById('username').value = profile?.username || '';
    document.getElementById('bio').value = profile?.bio || '';
    
    // Contact & Location
    document.getElementById('location').value = profile?.location || '';
    document.getElementById('website').value = profile?.website || '';
    if (document.getElementById('phone')) {
      document.getElementById('phone').value = profile?.phone || '';
    }
    
    // Birthday
    if (profile?.birthday) {
      setBirthdayPickerValue(profile.birthday);
    }
    
    // Gender
    if (profile?.gender) {
      const genderRadio = document.querySelector(`input[name="gender"][value="${profile.gender}"]`);
      if (genderRadio) genderRadio.checked = true;
    }
    
    // Work & Education
    if (document.getElementById('work')) {
      document.getElementById('work').value = profile?.work || '';
    }
    if (document.getElementById('education')) {
      document.getElementById('education').value = profile?.education || '';
    }
    
    // Relationship
    if (document.getElementById('relationship') && profile?.relationship) {
      document.getElementById('relationship').value = profile.relationship;
    }
    
    // Social Links
    if (document.getElementById('facebook')) {
      document.getElementById('facebook').value = profile?.social_links?.facebook || '';
    }
    if (document.getElementById('twitter')) {
      document.getElementById('twitter').value = profile?.social_links?.twitter || '';
    }
    if (document.getElementById('instagram')) {
      document.getElementById('instagram').value = profile?.social_links?.instagram || '';
    }
    if (document.getElementById('linkedin')) {
      document.getElementById('linkedin').value = profile?.social_links?.linkedin || '';
    }
    if (document.getElementById('github')) {
      document.getElementById('github').value = profile?.social_links?.github || '';
    }
    
    // Update avatar preview
    const avatarPreview = document.getElementById('profilePicturePreview');
    if (avatarPreview && profile?.avatar_url) {
      avatarPreview.src = profile.avatar_url;
    }
    
    // Update cover photo preview
    const coverPreview = document.getElementById('coverPhotoPreview');
    if (coverPreview && profile?.cover_photo_url) {
      coverPreview.style.background = `url(${profile.cover_photo_url}) center/cover no-repeat`;
    }
    
    // Update character count
    const bioCharCount = document.getElementById('bioCharCount');
    if (bioCharCount) {
      bioCharCount.textContent = (profile?.bio || '').length;
    }
    
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile data', 'error');
  }
}

// ============================================
// Birthday Picker
// ============================================
function initBirthdayPicker() {
  const daySelect = document.getElementById('birthdayDay');
  const monthSelect = document.getElementById('birthdayMonth');
  const yearSelect = document.getElementById('birthdayYear');

  if (!daySelect || !monthSelect || !yearSelect) return;

  monthSelect.innerHTML = buildPlaceholderOption('Month') + buildMonthOptions();
  yearSelect.innerHTML = buildPlaceholderOption('Year') + buildYearOptions();
  updateDayOptions();

  monthSelect.addEventListener('change', updateDayOptions);
  yearSelect.addEventListener('change', updateDayOptions);

  function updateDayOptions() {
    const selectedDay = daySelect.value;
    const month = parseInt(monthSelect.value, 10);
    const year = parseInt(yearSelect.value, 10);
    const daysInMonth = getDaysInMonth(year, month);

    daySelect.innerHTML = buildPlaceholderOption('Day') + buildDayOptions(daysInMonth);
    if (selectedDay) {
      daySelect.value = selectedDay;
    }
  }
}

function buildPlaceholderOption(label) {
  return `<option value="">${label}</option>`;
}

function buildDayOptions(count) {
  let options = '';
  for (let day = 1; day <= count; day++) {
    options += `<option value="${day}">${String(day).padStart(2, '0')}</option>`;
  }
  return options;
}

function buildMonthOptions() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((label, index) => {
    const value = index + 1;
    return `<option value="${value}">${label}</option>`;
  }).join('');
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 110;
  const endYear = currentYear - 10;
  let options = '';
  for (let year = endYear; year >= startYear; year--) {
    options += `<option value="${year}">${year}</option>`;
  }
  return options;
}

function getDaysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function setBirthdayPickerValue(isoDate) {
  const daySelect = document.getElementById('birthdayDay');
  const monthSelect = document.getElementById('birthdayMonth');
  const yearSelect = document.getElementById('birthdayYear');

  if (!daySelect || !monthSelect || !yearSelect) return;

  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return;

  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  monthSelect.value = String(month);
  yearSelect.value = String(year);
  const daysInMonth = getDaysInMonth(year, month);
  daySelect.innerHTML = buildPlaceholderOption('Day') + buildDayOptions(daysInMonth);
  daySelect.value = String(day);
}

// ============================================
// Bio Character Counter
// ============================================
function initCharacterCounter() {
  const bioTextarea = document.getElementById('bio');
  const bioCharCount = document.getElementById('bioCharCount');

  if (bioTextarea && bioCharCount) {
    // Update on input
    bioTextarea.addEventListener('input', () => {
      bioCharCount.textContent = bioTextarea.value.length;
    });
  }
}

// ============================================
// Profile Picture Preview
// ============================================
function initImagePreviews() {
  const profilePictureInput = document.getElementById('profilePictureInput');
  const profilePicturePreview = document.getElementById('profilePicturePreview');

if (profilePictureInput && profilePicturePreview) {
  profilePictureInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB');
        e.target.value = '';
        return;
      }
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
        alert('Please select a valid image file (JPG, PNG, or GIF)');
        e.target.value = '';
        return;
      }
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e) => {
        profilePicturePreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
}

// ============================================
// Cover Photo Preview
// ============================================
  const coverPhotoInput = document.getElementById('coverPhotoInput');
  const coverPhotoPreview = document.getElementById('coverPhotoPreview');

  if (coverPhotoInput && coverPhotoPreview) {
    coverPhotoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (5MB max for cover)
        if (file.size > 5 * 1024 * 1024) {
          showToast('File size must be less than 5MB', 'warning');
          e.target.value = '';
          return;
        }
        
        // Validate file type
        if (!file.type.match(/^image\/(jpeg|png)$/)) {
          showToast('Please select a valid image file (JPG or PNG)', 'warning');
          e.target.value = '';
          return;
        }
        
        // Preview the image
        const reader = new FileReader();
        reader.onload = (e) => {
          coverPhotoPreview.style.background = `url(${e.target.result}) center/cover no-repeat`;
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

// ============================================
// Form Submission
// ============================================
function initFormSubmit() {
  const editProfileForm = document.getElementById('editProfileForm');

  if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const userData = JSON.parse(localStorage.getItem('socialcore_user') || '{}');
      
      // Get form data
      const firstName = document.getElementById('firstName')?.value || '';
      const lastName = document.getElementById('lastName')?.value || '';
      const username = document.getElementById('username')?.value || '';
      const bio = document.getElementById('bio')?.value || '';
      const location = document.getElementById('location')?.value || '';
      const website = document.getElementById('website')?.value || '';
      const phone = document.getElementById('phone')?.value || '';
      const birthday = getBirthdayPickerValue();
      if (birthday === undefined) return;
      const work = document.getElementById('work')?.value || '';
      const education = document.getElementById('education')?.value || '';
      const relationship = document.getElementById('relationship')?.value || '';
      
      // Get gender
      const genderRadio = document.querySelector('input[name="gender"]:checked');
      const gender = genderRadio?.value || null;
      
      // Get social links
      const facebook = document.getElementById('facebook')?.value || '';
      const twitter = document.getElementById('twitter')?.value || '';
      const instagram = document.getElementById('instagram')?.value || '';
      const linkedin = document.getElementById('linkedin')?.value || '';
      const github = document.getElementById('github')?.value || '';
      
      // Validation
      if (!firstName.trim() || !lastName.trim()) {
        showToast('First name and last name are required', 'warning');
        return;
      }
      
      if (!username.trim()) {
        showToast('Username is required', 'warning');
        return;
      }
      
      // Username validation
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        showToast('Username must be 3-30 characters and contain only letters, numbers, and underscores', 'warning');
        return;
      }
      
      // Show loading state
      const submitBtn = editProfileForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
      
      try {
        // Upload profile picture if changed
        const profilePictureInput = document.getElementById('profilePictureInput');
        let avatarUrl = null;
        if (profilePictureInput?.files[0]) {
          showToast('Uploading profile picture...', 'info');
          avatarUrl = await uploadProfileImage(profilePictureInput.files[0], 'avatar');
        }
        
        // Upload cover photo if changed
        const coverPhotoInput = document.getElementById('coverPhotoInput');
        let coverUrl = null;
        if (coverPhotoInput?.files[0]) {
          showToast('Uploading cover photo...', 'info');
          coverUrl = await uploadProfileImage(coverPhotoInput.files[0], 'cover');
        }
        
        // Prepare profile data
        const profileData = {
          full_name: `${firstName} ${lastName}`.trim(),
          username: username,
          bio: bio || null,
          location: location || null,
          website: website || null,
          phone: phone || null,
          birthday: birthday || null,
          gender: gender || null,
          work: work || null,
          education: education || null,
          relationship: relationship || null,
          social_links: {
            facebook: facebook || null,
            twitter: twitter || null,
            instagram: instagram || null,
            linkedin: linkedin || null,
            github: github || null,
          }
        };
        
        // Add image URLs if uploaded
        if (avatarUrl) profileData.avatar_url = avatarUrl;
        if (coverUrl) profileData.cover_photo_url = coverUrl;
        
        // Update profile
        await updateProfile(userData.id, profileData);
        
        // Update localStorage
        userData.name = profileData.full_name;
        userData.username = profileData.username;
        if (avatarUrl) userData.avatar = avatarUrl;
        localStorage.setItem('socialcore_user', JSON.stringify(userData));
        
        // Show success message
        showToast('Profile updated successfully!', 'success');
        
        // Redirect to profile page after short delay
        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 1500);
        
      } catch (error) {
        console.error('Error updating profile:', error);
        showToast(error.message || 'Failed to update profile. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

function getBirthdayPickerValue() {
  const day = document.getElementById('birthdayDay')?.value;
  const month = document.getElementById('birthdayMonth')?.value;
  const year = document.getElementById('birthdayYear')?.value;

  if (!day && !month && !year) return null;

  if (!day || !month || !year) {
    showToast('Please select day, month, and year', 'warning');
    return undefined;
  }

  const isoValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    showToast('Please select a valid date', 'warning');
    return undefined;
  }

  if (parsed.getUTCFullYear() !== parseInt(year, 10)
      || parsed.getUTCMonth() + 1 !== parseInt(month, 10)
      || parsed.getUTCDate() !== parseInt(day, 10)) {
    showToast('Please select a valid date', 'warning');
    return undefined;
  }

  return isoValue;
}
