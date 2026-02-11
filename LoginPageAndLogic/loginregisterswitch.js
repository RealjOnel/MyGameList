function switchAuth(type) {
    const emailGroup = document.getElementById('email-group');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitText = document.getElementById('submit-text');
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    if (type === 'register') {
        emailGroup.style.display = 'block';
        title.innerHTML = 'Join the <span class="gradient-text">Gamers!</span>';
        subtitle.textContent = 'Create your free MyGameList account.';
        submitText.textContent = 'Register';
    } else {
        emailGroup.style.display = 'none';
        title.innerHTML = 'Welcome <span class="gradient-text">Back!</span>';
        subtitle.textContent = 'Get back to track your Gaming History.';
        submitText.textContent = 'Login';
    }
}

const form = document.getElementById('auth-form');
const errorMsg = document.getElementById('error-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Erkennen, ob Login oder Register
  const isRegister = document.getElementById('submit-text').textContent === 'Register';

  // Inputs auslesen
  const username = form.querySelector('input[type="text"]').value;
  const password = form.querySelector('input[type="password"]').value;
  const emailInput = form.querySelector('input[type="email"]');
  const email = isRegister ? emailInput.value : undefined;

  // Validation
  if (!username || !password || (isRegister && !email)) {
    errorMsg.textContent = 'Please fill all required fields';
    return;
  }

  // Endpoint wählen
    const BACKEND_URL = 'https://mygamelist-backend.onrender.com';
    const endpoint = isRegister 
        ? `${BACKEND_URL}/api/register` 
        : `${BACKEND_URL}/api/login`;


  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.message || 'Something went wrong';
    } else {
      console.log('✅ Success:', data);
      errorMsg.textContent = '';
      // z.B. Token speichern und weiterleiten
      localStorage.setItem('token', data.token);
      window.location.href = '/'; // oder Dashboard
    }
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Network error';
  }
});
