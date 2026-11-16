/* ==========================================================================
   dashboard.js  -  dashboard.html
   Shows statistics, recent polls and recent activity.
   The same page adapts to the role (admin / creator / voter).
   ========================================================================== */

const user = protectPage(["admin", "creator", "voter"]);
if (user) {
  initDashboard();
}

function initDashboard() {
  // Sent here because another page was not allowed for this role?
  if (sessionStorage.getItem(KEYS.denied)) {
    sessionStorage.removeItem(KEYS.denied);
    showToast("You do not have permission to open that page.", "error");
  }

  const polls = getPolls();
  const votes = getVotes();
  const activePolls = polls.filter((p) => getPollStatus(p) === "Active");
  const waiting = activePolls.filter((p) => !hasVoted(p.id, user.id)).length;

  // Welcome message
  $("welcomeTitle").textContent = "Welcome back, " + user.name.split(" ")[0] + "!";
  $("welcomeText").textContent = waiting > 0
    ? "You have " + waiting + (waiting === 1 ? " active poll" : " active polls") + " waiting for your vote."
    : "You are all caught up - no active polls are waiting for your vote.";

  // Statistic cards
  $("statPolls").textContent = polls.length;
  $("statVotes").textContent = votes.length;
  $("statActive").textContent = activePolls.length;

  // The 4th card depends on the role
  if (user.role === "admin") {
    $("statFourthLabel").textContent = "Registered Users";
    $("statFourth").textContent = getUsers().length;
  } else if (user.role === "creator") {
    $("statFourthLabel").textContent = "My Polls";
    $("statFourth").textContent = polls.filter((p) => p.createdBy === user.id).length;
  } else {
    $("statFourthLabel").textContent = "My Votes";
    $("statFourth").textContent = votes.filter((v) => v.userId === user.id).length;
  }

  // Recent polls (5 newest)
  const recent = [...polls].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  $("recentPolls").innerHTML = recent.length === 0
    ? "<li>No polls yet.</li>"
    : recent.map((p) =>
        "<li><div class=\"recent-item\"><a href=\"vote.html?id=" + p.id + "\">" + escapeHtml(p.title) + "</a>" +
        statusBadge(getPollStatus(p)) + "</div><small>" + escapeHtml(p.category) + " &middot; " +
        countVotes(p.id) + " votes &middot; closes " + formatDate(p.deadline) + "</small></li>"
      ).join("");

  // Recent activity (6 newest)
  const activity = getActivity().slice(0, 6);
  $("recentActivity").innerHTML = activity.length === 0
    ? "<li>No activity yet.</li>"
    : activity.map((a) =>
        "<li>" + escapeHtml(a.text) + "<small>" + timeAgo(a.time) + "</small></li>"
      ).join("");
}
