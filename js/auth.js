/* ==========================================================================
   auth.js  -  login page (index.html)
   Handles: validation, show/hide password, remember me, demo accounts,
   registration of new voters and redirecting after login.
   ========================================================================== */

// Already logged in? Go straight to the dashboard.
if (getCurrentUser()) {
  window.location.href = "dashboard.html";
}

const loginForm = $("loginForm");
const registerForm = $("registerForm");

/* ---------- Remember me: pre-fill the saved e-mail ---------- */
const savedEmail = localStorage.getItem(KEYS.remember);
if (savedEmail) {
  $("email").value = savedEmail;
  $("remember").checked = true;
}

/* ---------- Show / hide password ---------- */
$("showPassword").addEventListener("change", (e) => {
  $("password").type = e.target.checked ? "text" : "password";
});
$("showRegPassword").addEventListener("change", (e) => {
  const type = e.target.checked ? "text" : "password";
  $("regPassword").type = type;
  $("regConfirm").type = type;
});

/* ---------- LOGIN ---------- */
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearErrors(loginForm);
  $("formError").hidden = true;

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;
  let valid = true;

  if (email === "") {
    setError("email", "Please enter your email address.");
    valid = false;
  } else if (!isValidEmail(email)) {
    setError("email", "Please enter a valid email address.");
    valid = false;
  }
  if (password === "") {
    setError("password", "Please enter your password.");
    valid = false;
  }
  if (!valid) return;

  // Look for a user with this e-mail and password
  const found = getUsers().find((u) => u.email === email && u.password === password);

  if (!found) {
    showLoginError("Invalid email or password. Please try again.");
    return;
  }
  if (found.status !== "Active") {
    showLoginError("This account has been deactivated. Please contact an administrator.");
    return;
  }

  // Remember me (stores only the e-mail, never the password)
  if ($("remember").checked) {
    localStorage.setItem(KEYS.remember, email);
  } else {
    localStorage.removeItem(KEYS.remember);
  }

  loginUser(found);
  window.location.href = "dashboard.html";   // the dashboard adapts to the user's role
});

function showLoginError(message) {
  const box = $("formError");
  box.textContent = message;
  box.hidden = false;
}

/* ---------- DEMO ACCOUNT BUTTONS ---------- */
document.querySelectorAll(".fill-btn").forEach((button) => {
  button.addEventListener("click", () => {
    $("email").value = button.dataset.email;
    $("password").value = "demo123";
    $("formError").hidden = true;
    $("password").focus();
  });
});

/* ---------- SWITCH BETWEEN LOGIN AND REGISTER ---------- */
function showForm(which) {
  const registering = which === "register";
  loginForm.hidden = registering;
  registerForm.hidden = !registering;
  $("formHeading").textContent = registering ? "Create your account" : "Welcome back";
  $("formIntro").textContent = registering
    ? "New accounts are created as Voters."
    : "Sign in to continue to your dashboard.";
  $("switchText").hidden = registering;
  $("backText").hidden = !registering;
  $("formSuccess").hidden = true;
}
$("showRegister").addEventListener("click", (e) => { e.preventDefault(); showForm("register"); });
$("backToLogin").addEventListener("click", (e) => { e.preventDefault(); showForm("login"); });

/* ---------- REGISTER ---------- */
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearErrors(registerForm);

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const password = $("regPassword").value;
  const confirm = $("regConfirm").value;
  const users = getUsers();
  let valid = true;

  if (name.length < 2) { setError("regName", "Please enter your full name."); valid = false; }
  if (!isValidEmail(email)) {
    setError("regEmail", "Please enter a valid email address."); valid = false;
  } else if (users.some((u) => u.email === email)) {
    setError("regEmail", "An account with this email already exists."); valid = false;
  }
  if (password.length < 6) { setError("regPassword", "Password must be at least 6 characters."); valid = false; }
  if (confirm !== password) { setError("regConfirm", "Passwords do not match."); valid = false; }
  if (!valid) return;

  users.push({ id: makeId("u"), name: name, email: email, password: password, role: "voter", status: "Active" });
  save(KEYS.users, users);
  addActivity(name + " registered a new account");

  registerForm.reset();
  showForm("login");
  $("email").value = email;
  $("password").value = "";
  const ok = $("formSuccess");
  ok.textContent = "Account created! You can now sign in.";
  ok.hidden = false;
});

/* ---------- RESET DEMO DATA ---------- */
$("resetDemo").addEventListener("click", () => {
  if (confirm("This will delete all polls, votes and users you created and restore the original demo data. Continue?")) {
    resetDemoData();
    showToast("Demo data has been reset.");
  }
});
