/**
 * SocialCore - Authentication Module
 * Handles login and registration functionality with Supabase
 */

import { showToast, isValidEmail } from './main.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    initLoginForm(loginForm);
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    initRegisterForm(registerForm);
  }

  initPasswordToggles();
});

function initLoginForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    const rememberMe = formData.get('rememberMe');

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // A real session is required for all RLS-protected features (messaging, friends, etc.)
      if (!data?.session || !data?.user) {
        throw new Error('Login incomplete. Please confirm your email address and try again.');
      }

      if (rememberMe) {
        localStorage.setItem('socialcore_remember', email);
      }

      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || 'User',
        username: data.user.user_metadata?.username || data.user.email.split('@')[0],
        avatar: data.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.user_metadata?.full_name || 'User')}&background=3B82F6&color=fff`,
      };
      localStorage.setItem('socialcore_user', JSON.stringify(userData));

      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'feed.html'; }, 1500);
    } catch (error) {
      showToast(error.message || 'Login failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  const rememberedEmail = localStorage.getItem('socialcore_remember');
  if (rememberedEmail) {
    form.querySelector('#email').value = rememberedEmail;
    form.querySelector('#rememberMe').checked = true;
  }

  const emailInput = form.querySelector('#email');
  const rememberCheckbox = form.querySelector('#rememberMe');
  if (emailInput && rememberCheckbox) {
    rememberCheckbox.addEventListener('change', () => {
      if (!rememberCheckbox.checked) {
        localStorage.removeItem('socialcore_remember');
      }
    });

    emailInput.addEventListener('input', () => {
      if (!emailInput.value.trim()) {
        rememberCheckbox.checked = false;
        localStorage.removeItem('socialcore_remember');
      }
    });
  }
}

function initRegisterForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const password = form.querySelector('#password').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;

    if (password !== confirmPassword) {
      showFieldError(form.querySelector('#confirmPassword'), 'Passwords do not match.');
      return;
    }

    const formData = new FormData(form);
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: `${userData.firstName} ${userData.lastName}`,
            username: userData.username,
            first_name: userData.firstName,
            last_name: userData.lastName,
          }
        }
      });

      if (error) throw error;

      if (data?.user?.identities?.length === 0) {
        showToast('This email is already registered. Please login instead.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }

      // If email confirmations are enabled, Supabase won't provide a session here.
      // RLS-protected features require a real session.
      if (!data?.session) {
        showToast('Account created! Please confirm your email, then log in to continue.', 'info');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }

      const newUserData = {
        id: data.user.id,
        email: data.user.email,
        name: `${userData.firstName} ${userData.lastName}`,
        username: userData.username,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=3B82F6&color=fff`,
      };
      localStorage.setItem('socialcore_user', JSON.stringify(newUserData));

      showToast('Account created successfully! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'feed.html'; }, 1500);
    } catch (error) {
      showToast(error.message || 'Registration failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function initPasswordToggles() {
  const togglePassword = document.getElementById('togglePassword');
  const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      togglePasswordVisibility('password', togglePassword);
    });
  }

  if (toggleConfirmPassword) {
    toggleConfirmPassword.addEventListener('click', () => {
      togglePasswordVisibility('confirmPassword', toggleConfirmPassword);
    });
  }
}

function togglePasswordVisibility(inputId, toggleBtn) {
  const passwordInput = document.getElementById(inputId);
  const icon = toggleBtn.querySelector('i');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('bi-eye');
    icon.classList.add('bi-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('bi-eye-slash');
    icon.classList.add('bi-eye');
  }
}

function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required]');

  inputs.forEach((input) => {
    input.classList.remove('is-invalid');
  });

  inputs.forEach((input) => {
    if (!input.value.trim()) {
      showFieldError(input, 'This field is required.');
      isValid = false;
      return;
    }

    if (input.type === 'email' && !isValidEmail(input.value)) {
      showFieldError(input, 'Please enter a valid email address.');
      isValid = false;
      return;
    }

    if (input.type === 'password' && input.minLength && input.value.length < input.minLength) {
      showFieldError(input, `Password must be at least ${input.minLength} characters.`);
      isValid = false;
      return;
    }

    if (input.name === 'username' && input.pattern) {
      const pattern = new RegExp(input.pattern);
      if (!pattern.test(input.value)) {
        showFieldError(input, 'Username can only contain letters, numbers, and underscores.');
        isValid = false;
        return;
      }
    }

    if (input.type === 'checkbox' && !input.checked) {
      showFieldError(input, 'You must agree to continue.');
      isValid = false;
      return;
    }
  });

  return isValid;
}

function showFieldError(input, message) {
  input.classList.add('is-invalid');
  
  const existingError = input.parentElement.querySelector('.invalid-feedback');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'invalid-feedback';
  errorDiv.textContent = message;
  input.parentElement.appendChild(errorDiv);
}
