/* ==========================================================================
   vote.js  -  vote.html  (vote.html?id=POLL_ID)
   Shows one poll with radio buttons. Rules enforced:
     - one vote per user per poll
     - no voting in closed (or not yet open) polls
   ========================================================================== */

const user = protectPage(["admin", "creator", "voter"]);
let poll = null;

if (user) {
  initVote();
}

function initVote() {
  const pollId = new URLSearchParams(window.location.search).get("id");
  poll = getPolls().find((p) => p.id === pollId) || null;

  if (!poll) {
    $("notFound").hidden = false;     // wrong or missing id
    return;
  }

  $("voteLayout").hidden = false;
  $("pollCategory").textContent = poll.category;
  $("pollTitle").textContent = poll.title;
  $("pollDesc").textContent = poll.description;

  $("pollInfo").innerHTML =
    "<div><dt>Status</dt><dd>" + statusBadge(getPollStatus(poll)) + "</dd></div>" +
    "<div><dt>Opens</dt><dd>" + formatDate(poll.start) + "</dd></div>" +
    "<div><dt>Deadline</dt><dd>" + formatDate(poll.deadline) + "</dd></div>";

  // Radio buttons (all share name="option" so only one can be selected)
  $("optionsBox").innerHTML = poll.options.map((option) =>
    '<label class="option-choice"><input type="radio" name="option" value="' + option.id + '">' +
    "<span>" + escapeHtml(option.text) + "</span></label>"
  ).join("");

  // Is voting blocked right now?
  const reason = getBlockReason();
  if (reason) {
    lockForm(reason);
  }

  $("voteForm").addEventListener("submit", submitVote);
}

// Returns a message if the user cannot vote, otherwise an empty string
function getBlockReason() {
  const status = getPollStatus(poll);
  if (status === "Closed") return "This poll is closed. Voting is no longer allowed.";
  if (status === "Upcoming") return "Voting has not opened yet. It starts on " + formatDate(poll.start) + ".";
  if (hasVoted(poll.id, user.id)) return "You have already voted in this poll. Each user can vote only once.";
  return "";
}

function lockForm(message) {
  $("voteNotice").textContent = message;
  $("voteNotice").hidden = false;
  document.querySelectorAll('input[name="option"]').forEach((radio) => (radio.disabled = true));
  $("submitVote").disabled = true;
}

function submitVote(e) {
  e.preventDefault();
  $("voteError").textContent = "";

  // Check the rules again at the moment of voting (never trust the screen only)
  const reason = getBlockReason();
  if (reason) {
    lockForm(reason);
    showToast(reason, "error");
    return;
  }

  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) {
    $("voteError").textContent = "Please select one option before submitting your vote.";
    return;
  }

  // Save the vote
  const votes = getVotes();
  votes.push({ pollId: poll.id, userId: user.id, optionId: selected.value, time: new Date().toISOString() });
  save(KEYS.votes, votes);
  addActivity('A vote was cast in "' + poll.title + '"');

  // Confirmation
  $("voteForm").hidden = true;
  $("confirmBox").hidden = false;
  $("resultsLink").hidden = !canViewResults(poll, user);
  $("resultsLink").href = "results.html?id=" + poll.id;
  showToast("Your vote has been recorded.");
}
