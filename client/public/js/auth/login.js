document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  const setError = (id, msg) => {
    let el = document.getElementById(id + '-error');
    if (!el) {
      el = document.createElement('div');
      el.id = id + '-error';
      el.className = 'field-error';
      const input = document.getElementById(id);
      if (input && input.parentNode) input.parentNode.appendChild(el);
    }
    el.textContent = msg || '';
  };

  const clearErrors = () => {
    ['email', 'password', 'general'].forEach(field => setError(field, ''));
  };

  // Google Sign In button
  const googleBtn = document.getElementById('googleSignIn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values - ensure they're strings
    const emailEl = document.getElementById('email');
    const passwordEl = document.getElementById('password');
    const redirectEl = document.getElementById('redirect');
    
    const email = emailEl?.value?.trim() || '';
    const password = passwordEl?.value || '';
    const redirect = redirectEl?.value || '/';
    
    // Clear previous errors
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    
    // Basic validation
    if (!email || !password) {
      const errorEl = document.getElementById('general-error');
      if (errorEl) errorEl.textContent = 'Email and password required';
      return;
    }
    
    try {
      const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, redirect })
      });
      
      const data = await resp.json();
      
      if (data.success) {
        window.location.href = data.redirect || '/';
      } else {
        // Show errors
        if (data.errors?.general) {
          const el = document.getElementById('general-error');
          if (el) el.textContent = data.errors.general;
        }
        if (data.errors?.email) {
          const el = document.getElementById('email-error');
          if (el) el.textContent = data.errors.email;
        }
        if (data.errors?.password) {
          const el = document.getElementById('password-error');
          if (el) el.textContent = data.errors.password;
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorEl = document.getElementById('general-error');
      if (errorEl) errorEl.textContent = 'Network error. Please try again.';
    }
  });
});
