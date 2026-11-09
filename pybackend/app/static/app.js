// Book Review Auth Portal Integration
const API_BASE = window.location.origin;

// DOM Elements
const alertBanner = document.getElementById('alert-banner');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');
const linkToRegister = document.getElementById('link-to-register');
const linkToLogin = document.getElementById('link-to-login');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const btnLoginSubmit = document.getElementById('btn-login-submit');
const btnRegisterSubmit = document.getElementById('btn-register-submit');
const authCard = document.getElementById('auth-card');
const userDashboard = document.getElementById('user-dashboard');
const btnLogout = document.getElementById('btn-logout');
const btnCopyToken = document.getElementById('btn-copy-token');
const btnRefreshProfile = document.getElementById('btn-refresh-profile');
const systemStatus = document.getElementById('system-status');
const statusText = document.getElementById('status-text');
const registerRoleSelect = document.getElementById('register-role');

// State
let token = localStorage.getItem('access_token');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkBackendHealth();
  fetchAvailableRoles();
  checkExistingSession();
});

function setupEventListeners() {
  // Tab switching
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));
  linkToRegister.addEventListener('click', () => switchTab('register'));
  linkToLogin.addEventListener('click', () => switchTab('login'));

  // Password visibility toggles
  document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // Forms
  formLogin.addEventListener('submit', handleLogin);
  formRegister.addEventListener('submit', handleRegister);

  // Dashboard actions
  btnLogout.addEventListener('click', handleLogout);
  btnCopyToken.addEventListener('click', copyTokenToClipboard);
  btnRefreshProfile.addEventListener('click', () => {
    if (token) fetchUserProfile(token, true);
  });
}

function switchTab(mode) {
  clearAlert();
  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');

    loginPanel.classList.remove('hidden');
    loginPanel.classList.add('active');
    registerPanel.classList.add('hidden');
    registerPanel.classList.remove('active');
  } else {
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');

    registerPanel.classList.remove('hidden');
    registerPanel.classList.add('active');
    loginPanel.classList.add('hidden');
    loginPanel.classList.remove('active');
  }
}

function showAlert(message, type = 'error') {
  alertBanner.textContent = message;
  alertBanner.className = `alert-banner alert-${type}`;
  alertBanner.classList.remove('hidden');
}

function clearAlert() {
  alertBanner.textContent = '';
  alertBanner.className = 'alert-banner hidden';
}

function setButtonLoading(button, isLoading, defaultText) {
  const textSpan = button.querySelector('.btn-text');
  const spinner = button.querySelector('.spinner');
  button.disabled = isLoading;
  if (isLoading) {
    textSpan.textContent = 'Processing...';
    spinner.classList.remove('hidden');
  } else {
    textSpan.textContent = defaultText;
    spinner.classList.add('hidden');
  }
}

// 1. Backend Health Check
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      systemStatus.className = 'status-badge status-ok';
      statusText.textContent = 'API Connected (MySQL ready)';
    } else {
      throw new Error('Health check returned non-200');
    }
  } catch (err) {
    systemStatus.className = 'status-badge';
    statusText.textContent = 'API Disconnected';
  }
}

// 2. Fetch Roles dynamically
async function fetchAvailableRoles() {
  try {
    const res = await fetch(`${API_BASE}/api/roles`);
    if (res.ok) {
      const roles = await res.json();
      registerRoleSelect.innerHTML = '';
      roles.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = `${r.name.charAt(0).toUpperCase() + r.name.slice(1)} (${r.description || ''})`;
        if (r.name === 'reader') opt.selected = true;
        registerRoleSelect.appendChild(opt);
      });
    }
  } catch (e) {
    // Keep fallback default options if API call fails
  }
}

// 3. Handle Registration
async function handleRegister(e) {
  e.preventDefault();
  clearAlert();

  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const role = registerRoleSelect.value;

  if (!email || !password) {
    showAlert('Please fill in all required fields.');
    return;
  }
  if (password.length < 6) {
    showAlert('Password must be at least 6 characters long.');
    return;
  }

  setButtonLoading(btnRegisterSubmit, true, 'Create Account');

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.detail
        ? (Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail)
        : 'Registration failed. Please try again.';
      throw new Error(errorMsg);
    }

    // Automatically fill in login and switch tab
    showAlert(`Account created successfully with role '${data.role ? data.role.name : role}'! Please sign in.`, 'success');
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    formRegister.reset();
    switchTab('login');
  } catch (err) {
    showAlert(err.message, 'error');
  } finally {
    setButtonLoading(btnRegisterSubmit, false, 'Create Account');
  }
}

// 4. Handle Login
async function handleLogin(e) {
  e.preventDefault();
  clearAlert();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showAlert('Please enter both email and password.');
    return;
  }

  setButtonLoading(btnLoginSubmit, true, 'Sign In');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.detail
        ? (Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail)
        : 'Invalid credentials.';
      throw new Error(errorMsg);
    }

    token = data.access_token;
    localStorage.setItem('access_token', token);

    showAlert('Authentication successful! Loading profile...', 'success');
    await fetchUserProfile(token);
  } catch (err) {
    showAlert(err.message, 'error');
  } finally {
    setButtonLoading(btnLoginSubmit, false, 'Sign In');
  }
}

// 5. Check Existing Session & Fetch Profile
async function checkExistingSession() {
  if (token) {
    await fetchUserProfile(token);
  }
}

async function fetchUserProfile(jwtToken, showSuccessAlert = false) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!res.ok) {
      // Token expired or invalid
      handleLogout();
      return;
    }

    const user = await res.json();
    renderDashboard(user, jwtToken);
    if (showSuccessAlert) {
      showAlert(`Profile verified via /api/auth/me! Role: ${user.role ? user.role.name : 'reader'}`, 'success');
    }
  } catch (err) {
    handleLogout();
  }
}

function renderDashboard(user, jwtToken) {
  authCard.classList.add('hidden');
  userDashboard.classList.remove('hidden');

  document.getElementById('dash-email').textContent = user.email;
  document.getElementById('dash-id').textContent = `#${user.id}`;
  document.getElementById('dash-created').textContent = new Date(user.created_at).toLocaleString();

  const roleBadge = document.getElementById('dash-role');
  const roleName = user.role ? user.role.name : 'reader';
  roleBadge.textContent = roleName;
  roleBadge.className = `badge ${roleName === 'admin' ? 'badge-admin' : ''}`;

  document.getElementById('dash-status').textContent = user.is_active ? 'Active' : 'Inactive';
  document.getElementById('dash-token').textContent = jwtToken;
}

function handleLogout() {
  token = null;
  localStorage.removeItem('access_token');
  userDashboard.classList.add('hidden');
  authCard.classList.remove('hidden');
  clearAlert();
  formLogin.reset();
  switchTab('login');
}

function copyTokenToClipboard() {
  if (token) {
    navigator.clipboard.writeText(token).then(() => {
      const originalText = btnCopyToken.textContent;
      btnCopyToken.textContent = 'Copied!';
      setTimeout(() => {
        btnCopyToken.textContent = originalText;
      }, 1500);
    });
  }
}
