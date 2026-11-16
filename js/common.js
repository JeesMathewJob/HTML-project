/* ==========================================================================
   common.js  -  shared helper functions used by EVERY page of VoteSphere
   --------------------------------------------------------------------------
   Every page loads this file first, then its own page file (dashboard.js,
   polls.js ...). It contains:
     1. Constants (storage keys, categories, roles)
     2. Small helper functions (storage, dates, safe text)
     3. Demo data (seeded the first time the site is opened)
     4. Login session + role-based permissions
     5. Layout setup (sidebar links, logout, mobile menu)
     6. Poll / vote calculations
     7. Toast messages and form-error helpers

   !! SECURITY NOTE !!
   This is a FRONT-END COLLEGE PROTOTYPE. Users, polls and votes live in the
   browser (localStorage) and the login session lives in sessionStorage.
   Anyone can open the browser developer tools and read or edit this data,
   and passwords are stored as plain text. This is fine for learning, but it
   is NOT secure enough for real elections. A real system needs a server,
   a database, password hashing and proper authentication.
   ========================================================================== */

/* ---------- 1. CONSTANTS ---------- */
const KEYS = {
  users: "votesphere_users",       // localStorage
  polls: "votesphere_polls",       // localStorage
  votes: "votesphere_votes",       // localStorage
  activity: "votesphere_activity", // localStorage
  remember: "votesphere_remember", // localStorage (remembered e-mail)
  session: "votesphere_session",   // sessionStorage (who is logged in)
  denied: "votesphere_denied"      // sessionStorage (access-denied flag)
};

const CATEGORIES = ["Campus Life", "Academics", "Events", "Sports", "Student Council", "Other"];
const ROLE_LABELS = { admin: "Admin", creator: "Poll Creator", voter: "Voter" };

/* What each role is allowed to do (checked before restricted actions) */
const ROLE_PERMISSIONS = {
  admin: ["createPoll", "manageUsers", "viewReports", "manageAllPolls"],
  creator: ["createPoll", "viewReports", "manageOwnPolls"],
  voter: []
};

/* ---------- 2. SMALL HELPERS ---------- */

// Shortcut for document.getElementById
function $(id) {
  return document.getElementById(id);
}

// Read a value from localStorage (returns fallback if nothing is stored)
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

// Save a value to localStorage
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() { return load(KEYS.users, []); }
function getPolls() { return load(KEYS.polls, []); }
function getVotes() { return load(KEYS.votes, []); }
function getActivity() { return load(KEYS.activity, []); }

// Make a reasonably unique id such as "p3k9x2ab"
function makeId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Stops user-typed text from being treated as HTML (protects innerHTML)
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (ch) => map[ch]);
}

// Date -> "2026-11-20" (the format used by <input type="date">)
function toDateInput(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

// Today + a number of days, as "YYYY-MM-DD"
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

// "2026-11-20" -> "20 Nov 2026"
function formatDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ISO time stamp from "h" hours ago (used for demo data)
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

// ISO time stamp -> "5 hr ago"
function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + " hr ago";
  const days = Math.round(hrs / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

/* ---------- 3. DEMO DATA ---------- */
// Runs on every page load but only writes data when nothing is stored yet.
function seedDemoData() {
  if (!localStorage.getItem(KEYS.users)) {
    const person = (id, name, email, role, status) =>
      ({ id, name, email, password: "demo123", role, status: status || "Active" });
    save(KEYS.users, [
      person("u1", "Alex Admin", "admin@votesphere.demo", "admin"),
      person("u2", "Casey Creator", "creator@votesphere.demo", "creator"),
      person("u3", "Victor Voter", "voter@votesphere.demo", "voter"),
      person("u4", "Aarav Sharma", "aarav@votesphere.demo", "voter"),
      person("u5", "Meera Nair", "meera@votesphere.demo", "voter"),
      person("u6", "Rohan Verma", "rohan@votesphere.demo", "voter"),
      person("u7", "Sneha Kapoor", "sneha@votesphere.demo", "voter"),
      person("u8", "Imran Khan", "imran@votesphere.demo", "voter", "Inactive"),
      person("u9", "Priya Singh", "priya@votesphere.demo", "voter"),
      person("u10", "Karan Mehta", "karan@votesphere.demo", "voter"),
      person("u11", "Divya Rao", "divya@votesphere.demo", "voter")
    ]);
  }

  if (!localStorage.getItem(KEYS.polls)) {
    // Helper that builds a poll object (option ids look like "p1o1", "p1o2" ...)
    const poll = (id, title, category, description, options, start, deadline, resultsPublic, createdBy, hours) => ({
      id, title, category, description,
      options: options.map((text, i) => ({ id: id + "o" + (i + 1), text })),
      start: dateOffset(start), deadline: dateOffset(deadline),
      resultsPublic, createdBy, createdAt: hoursAgo(hours)
    });
    save(KEYS.polls, [
      poll("p1", "Best date for the Annual Tech Fest", "Events",
        "Help the organising committee pick the most convenient dates for this year's two-day tech fest.",
        ["Friday - Saturday this month", "Friday - Saturday next month", "Mid-week (Wednesday - Thursday)", "During the semester break"],
        -4, 10, true, "u2", 96),
      poll("p2", "Cafeteria menu improvement", "Campus Life",
        "Which addition would you like to see on the cafeteria menu from next semester?",
        ["More vegetarian meals", "A fresh fruit counter", "A late-night snack window"],
        -2, 5, true, "u2", 50),
      poll("p3", "Student Council President 2026", "Student Council",
        "Choose the candidate you want to represent students for the coming academic year. (Results are hidden from voters until the council releases them.)",
        ["Ananya Rao", "Dev Malhotra", "Zoya Khan"],
        -1, 7, false, "u1", 30),
      poll("p4", "Preferred language for the Coding Workshop", "Academics",
        "Our coding workshop is finished, and this poll helped us choose the language. Thank you for voting!",
        ["Python", "Java", "JavaScript", "C++"],
        -12, -3, true, "u2", 300),
      poll("p5", "New library opening hours", "Campus Life",
        "The library is considering longer hours. Voting opens soon - tell us what suits you best.",
        ["Open until 10 PM on weekdays", "Open 24 hours during exams", "Keep the current timings"],
        3, 12, true, "u1", 10),
      poll("p6", "Annual Sports Day: headline event", "Sports",
        "Pick the event that should close the Sports Day celebrations.",
        ["Relay race", "Tug of war", "Football tournament"],
        -1, 9, true, "u2", 20)
    ]);
  }

  if (!localStorage.getItem(KEYS.votes)) {
    // [pollId, [userId, optionNumber], ...]
    const seed = {
      p1: [["u4", 1], ["u5", 2], ["u6", 1], ["u7", 3], ["u9", 1], ["u10", 4], ["u11", 1]],
      p2: [["u4", 2], ["u5", 2], ["u6", 1], ["u9", 2], ["u11", 3]],
      p3: [["u4", 1], ["u5", 2], ["u6", 1], ["u7", 1], ["u8", 3], ["u9", 2], ["u10", 1], ["u11", 1]],
      p4: [["u2", 2], ["u4", 1], ["u5", 1], ["u6", 2], ["u7", 3], ["u9", 1], ["u10", 1]],
      p6: [["u5", 1], ["u6", 2], ["u9", 1]]
    };
    const votes = [];
    Object.keys(seed).forEach((pollId) => {
      seed[pollId].forEach((entry) => {
        votes.push({ pollId, userId: entry[0], optionId: pollId + "o" + entry[1], time: hoursAgo(5) });
      });
    });
    save(KEYS.votes, votes);
  }

  if (!localStorage.getItem(KEYS.activity)) {
    save(KEYS.activity, [
      { text: 'A vote was cast in "Annual Sports Day: headline event"', time: hoursAgo(2) },
      { text: 'Alex Admin published "New library opening hours"', time: hoursAgo(10) },
      { text: 'Casey Creator published "Annual Sports Day: headline event"', time: hoursAgo(20) },
      { text: 'Alex Admin published "Student Council President 2026"', time: hoursAgo(30) },
      { text: 'Casey Creator published "Cafeteria menu improvement"', time: hoursAgo(50) }
    ]);
  }
}

// Remove everything and start again with fresh demo data
function resetDemoData() {
  [KEYS.users, KEYS.polls, KEYS.votes, KEYS.activity].forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem(KEYS.session);
  seedDemoData();
}

// Add a line to the "Recent activity" list (newest first, max 30 kept)
function addActivity(text) {
  const list = getActivity();
  list.unshift({ text: text, time: new Date().toISOString() });
  save(KEYS.activity, list.slice(0, 30));
}

/* ---------- 4. SESSION + PERMISSIONS ---------- */

// Remember who logged in (sessionStorage is cleared when the tab is closed)
function loginUser(userRecord) {
  sessionStorage.setItem(KEYS.session, JSON.stringify({ id: userRecord.id }));
}

function logout() {
  sessionStorage.removeItem(KEYS.session);
}

// Returns the logged-in user (without the password) or null
function getCurrentUser() {
  try {
    const session = JSON.parse(sessionStorage.getItem(KEYS.session));
    if (!session) return null;
    const found = getUsers().find((u) => u.id === session.id);
    if (!found || found.status !== "Active") return null;   // deleted or deactivated
    return { id: found.id, name: found.name, email: found.email, role: found.role };
  } catch (error) {
    return null;
  }
}

// Does this role have a permission? e.g. can(user, "manageUsers")
function can(userRecord, action) {
  return ROLE_PERMISSIONS[userRecord.role].includes(action);
}

// Admin can edit/delete every poll; a creator only their own polls
function canManagePoll(poll, userRecord) {
  if (can(userRecord, "manageAllPolls")) return true;
  return can(userRecord, "manageOwnPolls") && poll.createdBy === userRecord.id;
}

// Admins and creators always see results; voters only if the poll allows it
function canViewResults(poll, userRecord) {
  return userRecord.role !== "voter" || poll.resultsPublic === true;
}

/* ---------- 5. PAGE PROTECTION + LAYOUT ---------- */

// Call at the top of each page: sends the visitor away if not allowed in.
function protectPage(allowedRoles) {
  const current = getCurrentUser();
  if (!current) {
    window.location.href = "index.html";            // not logged in
    return null;
  }
  if (!allowedRoles.includes(current.role)) {
    sessionStorage.setItem(KEYS.denied, "1");        // show a message on the dashboard
    window.location.href = "dashboard.html";
    return null;
  }
  setupLayout(current);
  return current;
}

// Fills the user name, hides links the role may not use, wires logout + menu
function setupLayout(current) {
  $("userName").textContent = current.name;
  $("userRole").textContent = ROLE_LABELS[current.role];

  // Any element with data-roles="admin creator" is hidden for other roles
  document.querySelectorAll("[data-roles]").forEach((el) => {
    if (!el.dataset.roles.split(" ").includes(current.role)) {
      el.hidden = true;
    }
  });

  // Highlight the link of the page we are on (vote.html belongs to "All Polls")
  let page = window.location.pathname.split("/").pop() || "dashboard.html";
  if (page === "vote.html") page = "polls.html";
  document.querySelectorAll("#sidebar a").forEach((link) => {
    if (link.getAttribute("href") === page) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  $("logoutLink").addEventListener("click", logout);

  // Mobile menu button + close when clicking elsewhere
  const sidebar = $("sidebar");
  $("menuBtn").addEventListener("click", () => sidebar.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !$("menuBtn").contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });
}

/* ---------- 6. POLL + VOTE CALCULATIONS ---------- */

// Status is worked out from today's date: Upcoming, Active or Closed
function getPollStatus(poll) {
  const now = new Date();
  const start = new Date(poll.start + "T00:00:00");
  const end = new Date(poll.deadline + "T23:59:59");
  if (now < start) return "Upcoming";
  if (now > end) return "Closed";
  return "Active";
}

function statusBadge(status) {
  return '<span class="badge badge-' + status.toLowerCase() + '">' + status + "</span>";
}

function countVotes(pollId) {
  return getVotes().filter((v) => v.pollId === pollId).length;
}

function hasVoted(pollId, userId) {
  return getVotes().some((v) => v.pollId === pollId && v.userId === userId);
}

// Votes + percentage for every option of a poll
function getResults(poll) {
  const votes = getVotes().filter((v) => v.pollId === poll.id);
  const total = votes.length;
  return poll.options.map((option) => {
    const count = votes.filter((v) => v.optionId === option.id).length;
    return {
      id: option.id,
      text: option.text,
      count: count,
      percent: total === 0 ? 0 : Math.round((count * 1000) / total) / 10
    };
  });
}

/* ---------- 7. MESSAGES + FORM ERRORS ---------- */

// Small pop-up message in the top-right corner. type = "success" or "error"
function showToast(message, type) {
  let box = $("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "success");
  toast.textContent = message;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Show an error under a field. Convention: the error span id is  inputId + "Error"
function setError(inputId, message) {
  const input = $(inputId);
  if (input) input.classList.add("invalid");
  const target = $(inputId + "Error");
  if (target) target.textContent = message;
}

// Remove all error messages inside a form
function clearErrors(form) {
  form.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Make sure demo data exists on every page
seedDemoData();
