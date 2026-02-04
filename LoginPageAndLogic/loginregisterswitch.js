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