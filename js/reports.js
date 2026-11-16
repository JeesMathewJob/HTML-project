/* ==========================================================================
   reports.js  -  reports.html   (admins and poll creators)
   Summary numbers, two simple charts made with CSS (no chart library),
   a detailed table, a CSV download link and a Print button.
   ========================================================================== */

const user = protectPage(["admin", "creator"]);
if (user && can(user, "viewReports")) {
  initReports();
}

function initReports() {
  const polls = getPolls();
  const rows = polls.map((poll) => {
    const results = getResults(poll);
    const total = results.reduce((sum, r) => sum + r.count, 0);
    const top = Math.max(...results.map((r) => r.count));
    const leaders = results.filter((r) => r.count === top);
    return {
      title: poll.title,
      category: poll.category,
      status: getPollStatus(poll),
      deadline: poll.deadline,
      options: poll.options.length,
      votes: total,
      leader: total === 0 ? "-" : leaders[0].text + (leaders.length > 1 ? " (tie)" : "")
    };
  });

  const totalVotes = rows.reduce((sum, r) => sum + r.votes, 0);
  const count = (status) => rows.filter((r) => r.status === status).length;
  const active = count("Active");
  const upcoming = count("Upcoming");
  const closed = count("Closed");

  // Summary cards
  $("repTotalPolls").textContent = rows.length;
  $("repTotalVotes").textContent = totalVotes;
  $("repActive").textContent = active;
  $("repClosed").textContent = closed;
  $("repAverage").textContent = rows.length === 0 ? "0" : (totalVotes / rows.length).toFixed(1);
  $("reportDate").textContent = new Date().toLocaleString("en-GB");
  $("printMeta").textContent = "Report printed by " + user.name + " (" + ROLE_LABELS[user.role] + ")";

  drawColumnChart(rows);
  drawDonut(active, upcoming, closed, rows.length);
  drawTable(rows, totalVotes);
  prepareCsv(rows);

  $("printBtn").addEventListener("click", () => window.print());
}

/* ---------- Chart 1: votes per poll (CSS columns) ---------- */
function drawColumnChart(rows) {
  const max = Math.max(1, ...rows.map((r) => r.votes));
  $("columnChart").innerHTML = rows.length === 0
    ? '<p class="empty">No polls yet.</p>'
    : rows.map((r) => {
        const short = r.title.length > 16 ? r.title.slice(0, 15) + "..." : r.title;
        return '<div class="col"><span class="col-value">' + r.votes + "</span>" +
          '<div class="col-track"><div class="col-bar" style="height:' + Math.round((r.votes / max) * 100) + '%"></div></div>' +
          '<span class="col-label" title="' + escapeHtml(r.title) + '">' + escapeHtml(short) + "</span></div>";
      }).join("");
}

/* ---------- Chart 2: poll status donut (CSS conic-gradient) ---------- */
function drawDonut(active, upcoming, closed, total) {
  const donut = $("statusDonut");
  donut.dataset.total = total;       // the number in the middle (CSS ::after)
  if (total > 0) {
    const a = (active / total) * 100;
    const u = a + (upcoming / total) * 100;
    donut.style.background = "conic-gradient(var(--navy) 0% " + a + "%, var(--gold) " + a + "% " + u + "%, var(--beige) " + u + "% 100%)";
  }
  $("donutLegend").innerHTML =
    '<li class="dot-active">Active <strong>' + active + "</strong></li>" +
    '<li class="dot-upcoming">Upcoming <strong>' + upcoming + "</strong></li>" +
    '<li class="dot-closed">Closed <strong>' + closed + "</strong></li>";
}

/* ---------- Detailed table ---------- */
function drawTable(rows, totalVotes) {
  $("summaryBody").innerHTML = rows.length === 0
    ? '<tr><td colspan="7">No polls to report.</td></tr>'
    : rows.map((r) =>
        "<tr><td>" + escapeHtml(r.title) + "</td><td>" + escapeHtml(r.category) + "</td><td>" + statusBadge(r.status) +
        "</td><td>" + formatDate(r.deadline) + "</td><td>" + r.options + "</td><td>" + r.votes +
        "</td><td>" + escapeHtml(r.leader) + "</td></tr>"
      ).join("");

  const optionTotal = rows.reduce((sum, r) => sum + r.options, 0);
  $("summaryFoot").innerHTML =
    '<tr><td colspan="4">Totals (' + rows.length + " polls)</td><td>" + optionTotal + "</td><td>" + totalVotes +
    "</td><td>Avg " + (rows.length === 0 ? "0" : (totalVotes / rows.length).toFixed(1)) + " votes / poll</td></tr>";
}

/* ---------- CSV download link (uses the <a download> attribute) ---------- */
function prepareCsv(rows) {
  const clean = (text) => '"' + String(text).replace(/"/g, '""') + '"';
  const lines = ["Poll,Category,Status,Deadline,Options,Votes,Leading option"];
  rows.forEach((r) => {
    lines.push([clean(r.title), clean(r.category), r.status, r.deadline, r.options, r.votes, clean(r.leader)].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  $("csvLink").href = URL.createObjectURL(blob);
}
