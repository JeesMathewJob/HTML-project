/* ==========================================================================
   results.js  -  results.html
   Pick a poll and see votes + percentages as horizontal progress bars.
   The page checks for new votes every 3 seconds, so results update
   automatically (also when a vote is cast in another browser tab).
   ========================================================================== */

const user = protectPage(["admin", "creator", "voter"]);
let selectedId = null;
let lastSignature = "";

if (user) {
  initResults();
}

// Polls this user is allowed to see results for
function getVisiblePolls() {
  return getPolls()
    .filter((p) => canViewResults(p, user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function initResults() {
  const requestedId = new URLSearchParams(window.location.search).get("id");
  const visible = getVisiblePolls();

  if (requestedId) {
    if (visible.some((p) => p.id === requestedId)) {
      selectedId = requestedId;
    } else if (getPolls().some((p) => p.id === requestedId)) {
      $("restrictedMsg").hidden = false;        // exists but results are restricted
    }
  }
  if (!selectedId && visible.length > 0) selectedId = visible[0].id;

  $("pollSelect").addEventListener("change", (e) => {
    selectedId = e.target.value;
    renderResults();
  });
  window.addEventListener("storage", renderResults);

  // Check for changes every 3 seconds and redraw only if something changed
  setInterval(() => {
    if (signature() !== lastSignature) renderResults();
  }, 3000);

  renderResults();
}

// A text fingerprint of the stored data - changes when polls or votes change
function signature() {
  return localStorage.getItem(KEYS.polls) + "|" + localStorage.getItem(KEYS.votes) + "|" + selectedId;
}

function renderResults() {
  const visible = getVisiblePolls();
  lastSignature = signature();

  // Rebuild the drop-down
  $("pollSelect").innerHTML = visible.map((p) =>
    '<option value="' + p.id + '">' + escapeHtml(p.title) + "</option>"
  ).join("");

  if (visible.length === 0) {
    $("noPolls").hidden = false;
    $("resultsPanel").hidden = true;
    return;
  }
  $("noPolls").hidden = true;

  // Keep the selection valid (the poll may have been deleted)
  if (!visible.some((p) => p.id === selectedId)) selectedId = visible[0].id;
  $("pollSelect").value = selectedId;

  const poll = visible.find((p) => p.id === selectedId);
  const results = getResults(poll);
  const total = results.reduce((sum, r) => sum + r.count, 0);
  const topCount = Math.max(...results.map((r) => r.count));

  $("resultsPanel").hidden = false;
  $("resultTitle").textContent = poll.title;
  $("resultDesc").textContent = poll.description;
  $("totalVotes").textContent = total;
  $("optionCount").textContent = poll.options.length;
  $("pollStatus").innerHTML = statusBadge(getPollStatus(poll));
  $("pollDeadline").textContent = formatDate(poll.deadline);

  // One row per option. The bar width is set with an inline style (width: 45%)
  $("resultList").innerHTML = results.map((r) => {
    const isLeader = total > 0 && r.count === topCount;
    return '<li class="result-row' + (isLeader ? " leader" : "") + '">' +
      '<div class="result-head"><span class="result-name">' + escapeHtml(r.text) + "</span>" +
      '<span class="result-numbers"><strong>' + r.count + "</strong> " + (r.count === 1 ? "vote" : "votes") +
      " &middot; " + r.percent + "%</span></div>" +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + r.percent + '">' +
      '<div class="bar-fill" style="width:' + r.percent + '%"></div></div></li>';
  }).join("");
}
