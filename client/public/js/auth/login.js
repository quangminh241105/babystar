document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  const setError = (id, msg) => {
    let el = document.getElementById(id + '-error');
    if (!el) {
      el = document.createElement('div');
      el.id = id + '-error';
      const input = document.getElementById(id);
      if (input && input.parentNode) input.parentNode.appendChild(el);
    }
    el.textContent = msg || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('email') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';

    setError('email', '');
    setError('password', '');
    setError('general', '');

    if (!email.trim()) { setError('email', 'Email is required'); return; }
    if (!password) { setError('password', 'Password is required'); return; }

    try {
      const resp = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        // on success, redirect home (or to intended page)
        window.location.href = '/';
        return;
      }
      if (data && data.errors) {
        const msg = data.errors.general || 'Invalid credentials';
        setError('general', msg);
      } else {
        setError('general', 'Unexpected server error');
      }
    } catch (err) {
      console.error(err);
      setError('general', 'Network error');
    }
  });
});
