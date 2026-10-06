const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);
const API = window.APP_CONFIG.API_BASE;

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function snippet(s, n) {
  const t = String(s || "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

async function init() {
  const t = await token();
  if (!t) {
    window.location.href = "index.html";
    return;
  }
  const headers = { Authorization: `Bearer ${t}` };
  const meRes = await fetch(`${API}/api/me`, { headers });
  if (!meRes.ok) {
    window.location.href = "index.html";
    return;
  }
  const me = await meRes.json();
  document.getElementById("profileEmail").textContent = me.email;
  document.getElementById("roleTag").textContent = me.is_admin ? "ADMIN" : "MEMBER";
  document.getElementById("dashLink").hidden = !me.is_admin;
  document.getElementById("memberSince").textContent = me.member_since
    ? "Member since " + new Date(me.member_since).toLocaleDateString()
    : "";

  const box = document.getElementById("myComments");
  const res = await fetch(`${API}/api/me/activity`, { headers });
  if (!res.ok) {
    box.innerHTML = "<p class='error'>Could not load activity. Is the backend running?</p>";
    return;
  }
  const data = await res.json();
  document.getElementById("statComments").textContent = data.total_comments || 0;
  document.getElementById("statLikes").textContent = data.likes_received || 0;
  document.getElementById("statFires").textContent = data.fires_received || 0;
  box.innerHTML = (data.comments || []).map((c) => `
    <div class="comment">
      <p class="meta">${new Date(c.created_at).toLocaleString()} · on
        <a href="index.html#a=${encodeURIComponent(c.article_slug)}">${escapeHtml(c.article_title)}</a></p>
      <p class="comment-body">${escapeHtml(snippet(c.body, 220))}</p>
    </div>`).join("") || "<p class='meta'>No comments yet.</p>";
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  window.location.href = "index.html";
});

init();
