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
    ['fullname', 'emailOrPhone', 'password', 'password2', 'general'].forEach(field => setError(field, ''));
  };

  // Google Sign Up button
  const googleBtn = document.getElementById('googleSignUp');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Collect form values
    const fullname = (document.getElementById('fullname') || {}).value || '';
    const emailOrPhone = (document.getElementById('emailOrPhone') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';
    const password2 = (document.getElementById('password2') || {}).value || '';

    // Clear previous errors
    clearErrors();

    // Client-side validation
    let hasErrors = false;
    
    if (!fullname.trim()) { 
      setError('fullname', 'Full name is required'); 
      hasErrors = true; 
    } else if (fullname.trim().length < 2) {
      setError('fullname', 'Name must be at least 2 characters');
      hasErrors = true;
    }
    
    if (!emailOrPhone.trim()) { 
      setError('emailOrPhone', 'Email or phone number is required'); 
      hasErrors = true; 
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone) && !/^\+?[0-9]{8,15}$/.test(emailOrPhone.replace(/[\s\-\(\)\.]/g, ''))) {
      setError('emailOrPhone', 'Please enter a valid email or phone number');
      hasErrors = true;
    }
    
    if (!password) { 
      setError('password', 'Password is required'); 
      hasErrors = true; 
    } else if (password.length < 6) {
      setError('password', 'Password must be at least 6 characters');
      hasErrors = true;
    }
    
    if (!password2) {
      setError('password2', 'Please confirm your password');
      hasErrors = true;
    } else if (password !== password2) { 
      setError('password2', 'Passwords do not match'); 
      hasErrors = true; 
    }

    if (hasErrors) return;

    // Determine if email or phone
    let email = null;
    let phoneNumber = null;
    
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone)) {
      email = emailOrPhone;
    } else {
      phoneNumber = emailOrPhone.replace(/[\s\-\(\)\.]/g, '');
    }
    
    // Disable submit button during request
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.value = 'Creating Account...';
    }

    try {
      const resp = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname, email, phoneNumber, password, password2 })
      });
      const data = await resp.json();
      
      if (resp.ok && data.success) {
        window.location.href = data.redirect || '/';
        return;
      }
      
      // Show server validation errors
      if (data && data.errors) {
        Object.keys(data.errors).forEach(key => {
          setError(key, data.errors[key]);
        });
      } else {
        setError('general', 'Unexpected server error');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('general', 'Network error. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.value = 'Create Account';
      }
    }
  });
});