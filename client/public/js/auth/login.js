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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('email') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';

    clearErrors();

    // Client-side validation
    let hasErrors = false;
    if (!email.trim()) { 
      setError('email', 'Email is required'); 
      hasErrors = true; 
    }
    if (!password) { 
      setError('password', 'Password is required'); 
      hasErrors = true; 
    }
    if (hasErrors) return;

    // Disable submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.value = 'Signing in...';
    }

    try {
      const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      
      if (resp.ok && data.success) {
        window.location.href = data.redirect || '/';
        return;
      }
      
      if (data && data.errors) {
        const msg = data.errors.general || data.errors.email || data.errors.password || 'Invalid credentials';
        setError('general', msg);
      } else {
        setError('general', 'Unexpected server error');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('general', 'Network error. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.value = 'Log In';
      }
    }
  });
});
