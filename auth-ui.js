const SUPABASE_URL = "https://tyzvxrlimbhmvmjenjxy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BdJd1R8Pkbggf5X_oOZL3w_DgoDyhNH";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let authMode = "login";
let isLoggedIn = false;

function injectAuthModal() {
  if (document.getElementById("signinModal")) return;

  const modalHtml = `
    <div id="signinModal" class="modal" aria-hidden="true">
      <div class="modal-content" role="dialog" aria-modal="true" aria-label="Sign in">
        <div class="modal-top">
          <h2 id="authTitle">Sign In</h2>
          <button class="close" type="button" id="closeSignInBtn" aria-label="Close">×</button>
        </div>

        <div id="displayNameRow">
          <input id="authDisplayName" type="text" placeholder="Username" class="signin-input">
        </div>

        <input id="authUsername" type="text" placeholder="Email or Username" class="signin-input" autocomplete="username">
        <input id="authPassword" type="password" placeholder="Password" class="signin-input" autocomplete="current-password">

        <label class="show-password-row">
          <input type="checkbox" id="showPasswordToggle">
          <span>Show password</span>
        </label>

        <div id="authError" class="auth-error"></div>

        <button class="signin-btn" id="authSubmitBtn" type="button">Sign In</button>

        <button class="link-btn" id="toggleAuthModeBtn" type="button">
          Don’t have an account? Create one
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function getDisplayName(user) {
  return user?.user_metadata?.username || user?.email || "Sign In";
}

function clearAuthError() {
  const el = document.getElementById("authError");
  if (!el) return;
  el.style.display = "none";
  el.textContent = "";
  el.style.borderColor = "rgba(255,180,180,.35)";
  el.style.background = "rgba(255,180,180,.10)";
  el.style.color = "rgba(255,220,220,.95)";
}

function showAuthError(msg, success = false) {
  const el = document.getElementById("authError");
  if (!el) return;

  el.textContent = msg;
  el.style.display = "block";

  if (success) {
    el.style.borderColor = "rgba(140,255,180,.35)";
    el.style.background = "rgba(140,255,180,.10)";
    el.style.color = "rgba(220,255,230,.95)";
  } else {
    el.style.borderColor = "rgba(255,180,180,.35)";
    el.style.background = "rgba(255,180,180,.10)";
    el.style.color = "rgba(255,220,220,.95)";
  }
}

function openSignIn(e) {
  if (e) e.preventDefault();

  const modal = document.getElementById("signinModal");
  if (!modal) return;

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");

  clearAuthError();
  syncAuthUI();

  const input = document.getElementById("authUsername");
  if (input) input.focus();
}

function closeSignIn() {
  const modal = document.getElementById("signinModal");
  if (!modal) return;

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");

  const toggle = document.getElementById("showPasswordToggle");
  const pass = document.getElementById("authPassword");

  if (toggle) toggle.checked = false;
  if (pass) pass.type = "password";
}

function syncAuthUI() {
  const title = document.getElementById("authTitle");
  const btn = document.getElementById("authSubmitBtn");
  const toggleBtn = document.getElementById("toggleAuthModeBtn");
  const pass = document.getElementById("authPassword");
  const displayNameRow = document.getElementById("displayNameRow");
  const displayNameInput = document.getElementById("authDisplayName");

  if (!title || !btn || !toggleBtn || !pass || !displayNameRow || !displayNameInput) return;

  if (authMode === "login") {
    title.textContent = "Sign In";
    btn.textContent = "Sign In";
    toggleBtn.textContent = "Don’t have an account? Create one";
    pass.autocomplete = "current-password";
    displayNameRow.style.display = "none";
    displayNameInput.value = "";
  } else {
    title.textContent = "Create Account";
    btn.textContent = "Create Account";
    toggleBtn.textContent = "Already have an account? Sign in";
    pass.autocomplete = "new-password";
    displayNameRow.style.display = "block";
  }
}

function closeAccountDropdown() {
  const dropdown = document.getElementById("accountDropdown");
  if (dropdown) dropdown.classList.remove("open");
}

function handleAccountClick(e) {
  e.preventDefault();

  if (!isLoggedIn) {
    openSignIn();
    return;
  }

  const dropdown = document.getElementById("accountDropdown");
  if (dropdown) dropdown.classList.toggle("open");
}

function goToStats() {
  window.location.href = "my-stats.html";
}

async function logOut() {
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error(err);
  }

  isLoggedIn = false;

  const link = document.getElementById("signInLink");
  if (link) link.textContent = "Sign In";

  closeAccountDropdown();
}

async function authSubmit() {
  clearAuthError();

  const usernameOrEmail = document.getElementById("authUsername")?.value.trim() || "";
  const password = document.getElementById("authPassword")?.value || "";
  const displayName = document.getElementById("authDisplayName")?.value.trim() || "";
  const btn = document.getElementById("authSubmitBtn");

  if (!usernameOrEmail || !password) {
    showAuthError("Please enter an email and password.");
    return;
  }

  if (authMode === "signup" && !displayName) {
    showAuthError("Please enter a username.");
    return;
  }

  if (btn) btn.disabled = true;

  try {
    let resp;

    if (authMode === "login") {
      resp = await supabaseClient.auth.signInWithPassword({
        email: usernameOrEmail,
        password
      });

      if (resp.error) {
        showAuthError(resp.error.message);
        return;
      }

      const me = await supabaseClient.auth.getUser();
      if (me.data?.user) {
        isLoggedIn = true;
        const link = document.getElementById("signInLink");
        if (link) link.textContent = getDisplayName(me.data.user);
      }

      closeSignIn();
      closeAccountDropdown();
    } else {
      resp = await supabaseClient.auth.signUp({
        email: usernameOrEmail,
        password,
        options: {
          data: {
            username: displayName
          }
        }
      });

      if (resp.error) {
        showAuthError(resp.error.message);
        return;
      }

      showAuthError("Account created. Check your email for a confirmation link.", true);
    }
  } catch (err) {
    showAuthError(err?.message || "Authentication request failed.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function restoreUser() {
  try {
    const me = await supabaseClient.auth.getUser();
    if (me.data?.user) {
      isLoggedIn = true;
      const link = document.getElementById("signInLink");
      if (link) link.textContent = getDisplayName(me.data.user);
    }
  } catch (err) {
    console.error(err);
  }
}

function initAuthUI() {
  injectAuthModal();

  const signInLink = document.getElementById("signInLink");
  const closeBtn = document.getElementById("closeSignInBtn");
  const toggleModeBtn = document.getElementById("toggleAuthModeBtn");
  const submitBtn = document.getElementById("authSubmitBtn");
  const showPasswordToggle = document.getElementById("showPasswordToggle");
  const authPassword = document.getElementById("authPassword");

  if (signInLink) {
    signInLink.addEventListener("click", handleAccountClick);
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSignIn);
  }

  if (toggleModeBtn) {
    toggleModeBtn.addEventListener("click", () => {
      authMode = authMode === "login" ? "signup" : "login";
      clearAuthError();
      syncAuthUI();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", authSubmit);
  }

  if (showPasswordToggle && authPassword) {
    showPasswordToggle.addEventListener("change", () => {
      authPassword.type = showPasswordToggle.checked ? "text" : "password";
    });
  }

  ["authUsername", "authPassword", "authDisplayName"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") authSubmit();
    });
  });

  document.querySelectorAll("[data-account-action='stats']").forEach((btn) => {
    btn.addEventListener("click", goToStats);
  });

  document.querySelectorAll("[data-account-action='logout']").forEach((btn) => {
    btn.addEventListener("click", logOut);
  });

  window.addEventListener("click", (event) => {
    const modal = document.getElementById("signinModal");
    const wrap = document.querySelector(".account-menu-wrap");

    if (event.target === modal) {
      closeSignIn();
    }

    if (wrap && !wrap.contains(event.target)) {
      closeAccountDropdown();
    }
  });

  syncAuthUI();
  restoreUser();
}

document.addEventListener("DOMContentLoaded", initAuthUI);
