/* ==========================================================================
   polls.js  -  polls.html
   Shows every poll as a card with search, category and status filters.
   Admins can edit/delete all polls; creators only their own.
   ========================================================================== */

const user = protectPage(["admin", "creator", "voter"]);
if (user) {
  initPolls();
}

function initPolls() {
  // Fill the category drop-down
  CATEGORIES.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    $("categoryFilter").appendChild(option);
  });

  // Re-draw the cards whenever a filter changes
  $("searchInput").addEventListener("input", renderPolls);
  $("categoryFilter").addEventListener("change", renderPolls);
  $("statusFilter").addEventListener("change", renderPolls);
  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("categoryFilter").value = "all";
    $("statusFilter").value = "all";
    renderPolls();
  });

  // One listener for all Delete buttons (event delegation)
  $("pollGrid").addEventListener("click", handleGridClick);

  // Keep the page up to date if another tab changes the data
  window.addEventListener("storage", renderPolls);

  renderPolls();
}

function renderPolls() {
  const search = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const status = $("statusFilter").value;
  const allPolls = getPolls();

  const visible = allPolls
    .filter((poll) => {
      const matchesText = poll.title.toLowerCase().includes(search) ||
                          poll.description.toLowerCase().includes(search);
      const matchesCategory = category === "all" || poll.category === category;
      const matchesStatus = status === "all" || getPollStatus(poll) === status;
      return matchesText && matchesCategory && matchesStatus;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));   // newest first

  $("resultCount").textContent = "Showing " + visible.length + " of " + allPolls.length + " polls";

  if (visible.length === 0) {
    $("pollGrid").innerHTML = '<p class="empty card">No polls match your search. Try changing the filters.</p>';
    return;
  }
  $("pollGrid").innerHTML = visible.map(buildCard).join("");
}

// Builds the HTML of one poll card
function buildCard(poll) {
  const status = getPollStatus(poll);
  const voted = hasVoted(poll.id, user.id);

  // Vote Now button (only when the poll is active and the user has not voted)
  let voteButton;
  if (status === "Active" && !voted) {
    voteButton = '<a class="btn btn-primary btn-sm" href="vote.html?id=' + poll.id + '">Vote Now</a>';
  } else {
    const label = voted ? "Already Voted" : status === "Upcoming" ? "Not Open Yet" : "Voting Closed";
    voteButton = '<button class="btn btn-sm" type="button" disabled>' + label + "</button>";
  }

  // View Results button (voters only see results the creator allowed)
  const resultsButton = canViewResults(poll, user)
    ? '<a class="btn btn-sm" href="results.html?id=' + poll.id + '">View Results</a>'
    : '<button class="btn btn-sm" type="button" disabled title="Results are restricted for this poll">Results Hidden</button>';

  // Edit / Delete only for people allowed to manage this poll
  const manageButtons = canManagePoll(poll, user)
    ? '<div class="manage-actions"><a class="btn btn-sm" href="create-poll.html?edit=' + poll.id + '">Edit</a>' +
      '<button class="btn btn-sm btn-danger" type="button" data-delete="' + poll.id + '">Delete</button></div>'
    : "";

  return '<article class="poll-card card">' +
    "<header><span class=\"category\">" + escapeHtml(poll.category) + "</span>" + statusBadge(status) + "</header>" +
    "<h2>" + escapeHtml(poll.title) + "</h2>" +
    '<p class="desc">' + escapeHtml(poll.description) + "</p>" +
    '<dl class="poll-meta">' +
      "<div><dt>Votes</dt><dd>" + countVotes(poll.id) + "</dd></div>" +
      "<div><dt>Options</dt><dd>" + poll.options.length + "</dd></div>" +
      "<div><dt>Deadline</dt><dd>" + formatDate(poll.deadline) + "</dd></div>" +
    "</dl>" +
    '<div class="poll-actions">' + voteButton + resultsButton + "</div>" +
    manageButtons +
    "</article>";
}

function handleGridClick(e) {
  const button = e.target.closest("[data-delete]");
  if (!button) return;

  const poll = getPolls().find((p) => p.id === button.dataset.delete);
  if (!poll) return;

  // Check permission again before doing anything destructive
  if (!canManagePoll(poll, user)) {
    showToast("You are not allowed to delete this poll.", "error");
    return;
  }
  if (!confirm('Delete the poll "' + poll.title + '"? All its votes will be removed too.')) return;

  save(KEYS.polls, getPolls().filter((p) => p.id !== poll.id));
  save(KEYS.votes, getVotes().filter((v) => v.pollId !== poll.id));
  addActivity(user.name + ' deleted the poll "' + poll.title + '"');
  showToast("Poll deleted.");
  renderPolls();
}
