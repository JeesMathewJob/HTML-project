/* ==========================================================================
   create-poll.js  -  create-poll.html
   Create a new poll, or edit an existing one (create-poll.html?edit=ID).
   Only admins and poll creators may open this page.
   ========================================================================== */

const user = protectPage(["admin", "creator"]);
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
let editingPoll = null;     // stays null when creating a new poll

if (user) {
  initCreatePoll();
}

function initCreatePoll() {
  // Fill the category drop-down
  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    $("pollCategory").appendChild(option);
  });

  // Are we editing? (the poll id is in the address bar: ?edit=p1)
  const editId = new URLSearchParams(window.location.search).get("edit");
  if (editId) {
    editingPoll = getPolls().find((p) => p.id === editId) || null;
    if (!editingPoll || !canManagePoll(editingPoll, user)) {
      sessionStorage.setItem(KEYS.denied, "1");
      window.location.href = "dashboard.html";
      return;
    }
    fillFormForEditing(editingPoll);
  } else {
    resetForm();
  }

  $("addOptionBtn").addEventListener("click", () => addOptionRow("", ""));
  $("optionsList").addEventListener("click", (e) => {
    const removeButton = e.target.closest(".remove-option");
    if (removeButton) removeOptionRow(removeButton.closest("li"));
  });
  $("clearBtn").addEventListener("click", () => {
    if (editingPoll) {
      fillFormForEditing(editingPoll);      // when editing, "Clear" restores the saved poll
    } else {
      resetForm();
    }
    $("successBox").hidden = true;
  });
  $("pollForm").addEventListener("submit", publishPoll);
}

/* ---------- Dynamic option rows ---------- */
function addOptionRow(text, optionId) {
  if (document.querySelectorAll("#optionsList li").length >= MAX_OPTIONS) {
    showToast("You can add up to " + MAX_OPTIONS + " options.", "error");
    return;
  }
  const row = document.createElement("li");
  row.className = "option-row";
  row.dataset.id = optionId;      // empty for new options
  row.innerHTML =
    '<input type="text" maxlength="80" aria-label="Voting option" value="' + escapeHtml(text) + '">' +
    '<button type="button" class="btn btn-sm btn-danger remove-option" aria-label="Remove option">Remove</button>';
  $("optionsList").appendChild(row);
  refreshOptionRows();
}

function removeOptionRow(row) {
  if (document.querySelectorAll("#optionsList li").length <= MIN_OPTIONS) {
    showToast("A poll needs at least " + MIN_OPTIONS + " options.", "error");
    return;
  }
  row.remove();
  refreshOptionRows();
}

// Updates placeholders and disables buttons when limits are reached
function refreshOptionRows() {
  const rows = document.querySelectorAll("#optionsList li");
  rows.forEach((row, index) => {
    row.querySelector("input").placeholder = "Option " + (index + 1);
    row.querySelector(".remove-option").disabled = rows.length <= MIN_OPTIONS;
  });
  $("addOptionBtn").disabled = rows.length >= MAX_OPTIONS;
}

/* ---------- Reset / fill the form ---------- */
function resetForm() {
  $("pollForm").reset();
  clearErrors($("pollForm"));
  $("startDate").value = dateOffset(0);
  $("deadline").value = dateOffset(7);
  $("optionsList").innerHTML = "";
  addOptionRow("", "");
  addOptionRow("", "");
  document.querySelector('input[name="visibility"][value="public"]').checked = true;
}

function fillFormForEditing(poll) {
  clearErrors($("pollForm"));
  $("pageHeading").textContent = "Edit Poll";
  $("pageIntro").textContent = "Update the details below. Removing an option also removes its votes.";
  $("publishBtn").textContent = "Save Changes";
  $("pollTitle").value = poll.title;
  $("pollDescription").value = poll.description;
  $("pollCategory").value = poll.category;
  $("startDate").value = poll.start;
  $("deadline").value = poll.deadline;
  $("optionsList").innerHTML = "";
  poll.options.forEach((option) => addOptionRow(option.text, option.id));
  document.querySelector('input[name="visibility"][value="' + (poll.resultsPublic ? "public" : "restricted") + '"]').checked = true;
}

/* ---------- Validation ---------- */
function validateForm() {
  clearErrors($("pollForm"));
  let valid = true;

  const title = $("pollTitle").value.trim();
  const description = $("pollDescription").value.trim();
  const start = $("startDate").value;
  const deadline = $("deadline").value;

  if (title.length < 5) { setError("pollTitle", "The title must be at least 5 characters."); valid = false; }
  if (description.length < 10) { setError("pollDescription", "Please write a description (at least 10 characters)."); valid = false; }
  if ($("pollCategory").value === "") { setError("pollCategory", "Please choose a category."); valid = false; }
  if (start === "") { setError("startDate", "Please choose a start date."); valid = false; }
  if (deadline === "") {
    setError("deadline", "Please choose a voting deadline."); valid = false;
  } else if (start !== "" && deadline < start) {
    setError("deadline", "The deadline cannot be before the start date."); valid = false;
  } else if (!editingPoll && deadline < dateOffset(0)) {
    setError("deadline", "The deadline cannot be in the past."); valid = false;
  }

  // Options: none empty, no duplicates
  const texts = [...document.querySelectorAll("#optionsList input")].map((input) => input.value.trim());
  const lower = texts.map((t) => t.toLowerCase());
  if (texts.some((t) => t === "")) {
    $("optionsError").textContent = "Fill in every option or remove the empty ones."; valid = false;
  } else if (new Set(lower).size !== lower.length) {
    $("optionsError").textContent = "Each option must be different."; valid = false;
  }
  return valid;
}

/* ---------- Publish / save ---------- */
function publishPoll(e) {
  e.preventDefault();

  // Permission check before saving
  if (!can(user, "createPoll")) {
    showToast("You are not allowed to create polls.", "error");
    return;
  }
  if (!validateForm()) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  // Build the options (existing options keep their id so their votes stay)
  const options = [...document.querySelectorAll("#optionsList li")].map((row) => ({
    id: row.dataset.id || makeId("o"),
    text: row.querySelector("input").value.trim()
  }));
  const resultsPublic = document.querySelector('input[name="visibility"]:checked').value === "public";
  const polls = getPolls();

  if (editingPoll) {
    const index = polls.findIndex((p) => p.id === editingPoll.id);
    polls[index] = Object.assign({}, editingPoll, {
      title: $("pollTitle").value.trim(),
      description: $("pollDescription").value.trim(),
      category: $("pollCategory").value,
      start: $("startDate").value,
      deadline: $("deadline").value,
      options: options,
      resultsPublic: resultsPublic
    });
    // Remove votes that belonged to deleted options
    const keep = options.map((o) => o.id);
    save(KEYS.votes, getVotes().filter((v) => v.pollId !== editingPoll.id || keep.includes(v.optionId)));
    editingPoll = polls[index];
    addActivity(user.name + ' updated the poll "' + editingPoll.title + '"');
    showSuccess("Poll updated successfully.");
  } else {
    const newPoll = {
      id: makeId("p"),
      title: $("pollTitle").value.trim(),
      description: $("pollDescription").value.trim(),
      category: $("pollCategory").value,
      options: options,
      start: $("startDate").value,
      deadline: $("deadline").value,
      resultsPublic: resultsPublic,
      createdBy: user.id,
      createdAt: new Date().toISOString()
    };
    polls.push(newPoll);
    addActivity(user.name + ' published "' + newPoll.title + '"');
    showSuccess('Your poll "' + newPoll.title + '" has been published and now appears on the All Polls page.');
    save(KEYS.polls, polls);
    resetForm();
    return;
  }
  save(KEYS.polls, polls);
}

// Confirmation message shown after publishing
function showSuccess(message) {
  $("successText").textContent = message;
  $("successBox").hidden = false;
  $("successBox").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast(message);
}
