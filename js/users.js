/* ==========================================================================
   users.js  -  users.html   (ADMINISTRATORS ONLY)
   Table of users with search, role filter, add, edit, delete and
   quick role change.
   ========================================================================== */

const user = protectPage(["admin"]);
let editingId = null;       // null = adding a new user

if (user) {
  initUsers();
}

function initUsers() {
  $("userSearch").addEventListener("input", renderUsers);
  $("roleFilter").addEventListener("change", renderUsers);
  $("addUserBtn").addEventListener("click", () => openModal(null));
  $("cancelUser").addEventListener("click", closeModal);
  $("userModal").addEventListener("click", (e) => {
    if (e.target === $("userModal")) closeModal();     // click on the dark background
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  $("userForm").addEventListener("submit", saveUser);
  $("userTableBody").addEventListener("click", handleTableClick);
  $("userTableBody").addEventListener("change", handleRoleChange);
  renderUsers();
}

/* ---------- Table ---------- */
function renderUsers() {
  const search = $("userSearch").value.trim().toLowerCase();
  const role = $("roleFilter").value;
  const all = getUsers();

  const visible = all.filter((u) => {
    const matchesText = u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
    const matchesRole = role === "all" || u.role === role;
    return matchesText && matchesRole;
  });

  $("userTableBody").innerHTML = visible.length === 0
    ? '<tr><td colspan="5">No users found.</td></tr>'
    : visible.map((u) => {
        const isMe = u.id === user.id;
        const roleOptions = Object.keys(ROLE_LABELS).map((r) =>
          '<option value="' + r + '"' + (u.role === r ? " selected" : "") + ">" + ROLE_LABELS[r] + "</option>"
        ).join("");
        return "<tr>" +
          "<td>" + escapeHtml(u.name) + (isMe ? ' <small class="you-tag">(you)</small>' : "") + "</td>" +
          "<td>" + escapeHtml(u.email) + "</td>" +
          '<td><select class="role-select" data-id="' + u.id + '" aria-label="Role of ' + escapeHtml(u.name) + '"' +
            (isMe ? " disabled" : "") + ">" + roleOptions + "</select></td>" +
          '<td><span class="badge badge-' + (u.status === "Active" ? "active" : "closed") + '">' + u.status + "</span></td>" +
          '<td><div class="actions"><button class="btn btn-sm" type="button" data-edit="' + u.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" type="button" data-delete="' + u.id + '"' + (isMe ? " disabled" : "") +
          ">Delete</button></div></td></tr>";
      }).join("");

  $("userCount").textContent = "Showing " + visible.length + " of " + all.length + " users";
}

function handleTableClick(e) {
  const editBtn = e.target.closest("[data-edit]");
  const deleteBtn = e.target.closest("[data-delete]");
  if (editBtn) openModal(editBtn.dataset.edit);
  if (deleteBtn) deleteUser(deleteBtn.dataset.delete);
}

/* ---------- Change role from the table ---------- */
function handleRoleChange(e) {
  if (!e.target.classList.contains("role-select")) return;
  const users = getUsers();
  const target = users.find((u) => u.id === e.target.dataset.id);
  const newRole = e.target.value;
  if (!target) return;

  // Never remove the last administrator
  if (target.role === "admin" && newRole !== "admin" && users.filter((u) => u.role === "admin").length === 1) {
    showToast("There must be at least one administrator.", "error");
    renderUsers();
    return;
  }
  target.role = newRole;
  save(KEYS.users, users);
  addActivity(user.name + " changed the role of " + target.name + " to " + ROLE_LABELS[newRole]);
  showToast(target.name + " is now a " + ROLE_LABELS[newRole] + ".");
  renderUsers();
}

/* ---------- Delete ---------- */
function deleteUser(id) {
  if (!can(user, "manageUsers")) return;
  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;

  if (target.id === user.id) {
    showToast("You cannot delete your own account.", "error");
    return;
  }
  if (target.role === "admin" && users.filter((u) => u.role === "admin").length === 1) {
    showToast("There must be at least one administrator.", "error");
    return;
  }
  if (!confirm("Delete " + target.name + " (" + target.email + ")? This cannot be undone.")) return;

  save(KEYS.users, users.filter((u) => u.id !== id));
  addActivity(user.name + " deleted the user " + target.name);
  showToast("User deleted.");
  renderUsers();
}

/* ---------- Add / edit pop-up ---------- */
function openModal(id) {
  editingId = id;
  clearErrors($("userForm"));
  $("userForm").reset();

  if (id) {
    const target = getUsers().find((u) => u.id === id);
    $("modalTitle").textContent = "Edit User";
    $("fName").value = target.name;
    $("fEmail").value = target.email;
    $("fRole").value = target.role;
    $("fStatus").value = target.status;
    $("fPasswordHint").textContent = "Leave blank to keep the current password.";
    // You cannot lock yourself out by changing your own role or status
    $("fRole").disabled = target.id === user.id;
    $("fStatus").disabled = target.id === user.id;
  } else {
    $("modalTitle").textContent = "Add User";
    $("fPasswordHint").textContent = "At least 6 characters.";
    $("fRole").disabled = false;
    $("fStatus").disabled = false;
  }
  $("userModal").hidden = false;
  $("fName").focus();
}

function closeModal() {
  $("userModal").hidden = true;
}

function saveUser(e) {
  e.preventDefault();
  clearErrors($("userForm"));

  const name = $("fName").value.trim();
  const email = $("fEmail").value.trim().toLowerCase();
  const password = $("fPassword").value;
  const role = $("fRole").value;
  const status = $("fStatus").value;
  const users = getUsers();
  let valid = true;

  if (name.length < 2) { setError("fName", "Please enter a name."); valid = false; }
  if (!isValidEmail(email)) {
    setError("fEmail", "Please enter a valid email."); valid = false;
  } else if (users.some((u) => u.email === email && u.id !== editingId)) {
    setError("fEmail", "This email is already used by another user."); valid = false;
  }
  if ((!editingId || password !== "") && password.length < 6) {
    setError("fPassword", "Password must be at least 6 characters."); valid = false;
  }
  if (!valid) return;

  if (editingId) {
    const target = users.find((u) => u.id === editingId);
    target.name = name;
    target.email = email;
    if (password !== "") target.password = password;
    if (target.id !== user.id) {
      // protect the last administrator
      if (target.role === "admin" && role !== "admin" && users.filter((u) => u.role === "admin").length === 1) {
        showToast("There must be at least one administrator.", "error");
        return;
      }
      target.role = role;
      target.status = status;
    }
    addActivity(user.name + " updated the user " + name);
    showToast("User updated.");
  } else {
    users.push({ id: makeId("u"), name: name, email: email, password: password, role: role, status: status });
    addActivity(user.name + " added the user " + name);
    showToast("User added.");
  }
  save(KEYS.users, users);
  closeModal();
  renderUsers();
}
