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
    // collect values (inputs use ids from your markup)
    const fullname = (document.getElementById('fullname') || {}).value || '';
    const email = (document.getElementById('email') || {}).value || '';
    const password = (document.getElementById('password') || {}).value || '';
    const password2 = (document.getElementById('password2') || {}).value || '';
    const userRadio = document.querySelector('input[name="user"]:checked');
    const user = userRadio ? userRadio.value : '';

    // clear errors
    setError('fullname', '');
    setError('email', '');
    setError('password', '');
    setError('password2', '');
    setError('general', '');

    // basic client-side checks
    let clientErrors = false;
    if (!fullname.trim()) { setError('fullname', 'Full name is required'); clientErrors = true; }
    if (!email.trim()) { setError('email', 'Email is required'); clientErrors = true; }
    if (!password) { setError('password', 'Password is required'); clientErrors = true; }
    if (password !== password2) { setError('password2', 'Passwords do not match'); clientErrors = true; }
    if (clientErrors) return;

    try {
      const resp = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullname, email, password, password2, user })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        // registered: redirect to login (optionally add query param)
        window.location.href = '/auth/login?registered=1';
        return;
      }
      // show server validation errors
      if (data && data.errors) {
        Object.keys(data.errors).forEach(key => {
          const msg = data.errors[key];
          if (key === 'general') setError('general', msg);
          else setError(key, msg);
        });
      } else {
        setError('general', 'Unexpected server error');
      }
    } catch (err) {
      console.error(err);
      setError('general', 'Network error');
    }
  });
});