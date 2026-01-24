/**
 * SocialCore - Authentication Module
 * Handles login and registration functionality
 */

import { showToast, isValidEmail } from './main.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    initLoginForm(loginForm);
  }

  // Initialize registration form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    initRegisterForm(registerForm);
  }

  // Initialize password toggle buttons
  initPasswordToggles();
});

/**
 * Initialize login form functionality
 * @param {HTMLFormElement} form - Login form element
 */
function initLoginForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm(form)) {
      return;
    }

    // Get form data
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    const rememberMe = formData.get('rememberMe');

    // Disable submit button and show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

    try {
      // TODO: Implement Supabase authentication
      // For now, simulate login
      await simulateLogin(email, password);

      // Store user session if remember me is checked
      if (rememberMe) {
        localStorage.setItem('socialcore_remember', email);
      }

      showToast('Login successful! Redirecting...', 'success');

      // Redirect to feed after successful login
      setTimeout(() => {
        window.location.href = 'feed.html';
      }, 1500);
    } catch (error) {
      showToast(error.message || 'Login failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Check for remembered email
  const rememberedEmail = localStorage.getItem('socialcore_remember');
  if (rememberedEmail) {
    form.querySelector('#email').value = rememberedEmail;
    form.querySelector('#rememberMe').checked = true;
  }
}

/**
 * Initialize registration form functionality
 * @param {HTMLFormElement} form - Registration form element
 */
function initRegisterForm(form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm(form)) {
      return;
    }

    // Validate password match
    const password = form.querySelector('#password').value;
    const confirmPassword = form.querySelector('#confirmPassword').value;

    if (password !== confirmPassword) {
      showFieldError(form.querySelector('#confirmPassword'), 'Passwords do not match.');
      return;
    }

    // Get form data
    const formData = new FormData(form);
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
    };

    // Disable submit button and show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

    try {
      // TODO: Implement Supabase registration
      // For now, simulate registration
      await simulateRegister(userData);

      showToast('Account created successfully! Please log in.', 'success');

      // Redirect to login after successful registration
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } catch (error) {
      showToast(error.message || 'Registration failed. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Real-time username validation
  const usernameInput = form.querySelector('#username');
  if (usernameInput) {
    usernameInput.addEventListener('input', debounce((e) => {
      const username = e.target.value;
      if (username.length >= 3) {
        // TODO: Check username availability with Supabase
        console.log('Checking username availability:', username);
      }
    }, 500));
  }
}

/**
 * Initialize password visibility toggle buttons
 */
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

/**
 * Toggle password field visibility
 * @param {string} inputId - Password input ID
 * @param {HTMLElement} toggleBtn - Toggle button element
 */
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

/**
 * Validate form fields
 * @param {HTMLFormElement} form - Form to validate
 * @returns {boolean} True if form is valid
 */
function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required]');

  // Clear previous validation states
  inputs.forEach((input) => {
    input.classList.remove('is-invalid');
  });

  inputs.forEach((input) => {
    // Check if field is empty
    if (!input.value.trim()) {
      showFieldError(input, 'This field is required.');
      isValid = false;
      return;
    }

    // Email validation
    if (input.type === 'email' && !isValidEmail(input.value)) {
      showFieldError(input, 'Please enter a valid email address.');
      isValid = false;
      return;
    }

    // Password length validation
    if (input.type === 'password' && input.minLength && input.value.length < input.minLength) {
      showFieldError(input, `Password must be at least ${input.minLength} characters.`);
      isValid = false;
      return;
    }

    // Username pattern validation
    if (input.name === 'username' && input.pattern) {
      const pattern = new RegExp(input.pattern);
      if (!pattern.test(input.value)) {
        showFieldError(input, 'Username can only contain letters, numbers, and underscores.');
        isValid = false;
        return;
      }
    }

    // Checkbox validation (terms)
    if (input.type === 'checkbox' && !input.checked) {
      showFieldError(input, 'You must agree to continue.');
      isValid = false;
      return;
    }
  });

  return isValid;
}

/**
 * Show error message for a form field
 * @param {HTMLInputElement} input - Input element
 * @param {string} message - Error message
 */
function showFieldError(input, message) {
  input.classList.add('is-invalid');
  
  // Update invalid feedback message if exists
  const feedback = input.parentElement.querySelector('.invalid-feedback') ||
                   input.parentElement.parentElement.querySelector('.invalid-feedback');
  if (feedback) {
    feedback.textContent = message;
  }
}

/**
 * Simulate login (to be replaced with Supabase)
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} Resolves on success, rejects on failure
 */
function simulateLogin(email, password) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate successful login
      // In production, this will be replaced with Supabase auth
      if (email && password) {
        // Store mock user data
        const userData = {
          id: '1',
          email: email,
          name: 'John Doe',
          username: 'johndoe',
          avatar: `https://ui-avatars.com/api/?name=John+Doe&background=3B82F6&color=fff`,
        };
        localStorage.setItem('socialcore_user', JSON.stringify(userData));
        resolve(userData);
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 1500);
  });
}

/**
 * Simulate registration (to be replaced with Supabase)
 * @param {Object} userData - User registration data
 * @returns {Promise} Resolves on success, rejects on failure
 */
function simulateRegister(userData) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate successful registration
      // In production, this will be replaced with Supabase auth
      if (userData.email && userData.password) {
        resolve({ success: true, message: 'User registered successfully' });
      } else {
        reject(new Error('Registration failed'));
      }
    }, 1500);
  });
}

/**
 * Simple debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
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
