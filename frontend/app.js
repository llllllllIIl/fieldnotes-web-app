const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);
const API = window.APP_CONFIG.API_BASE;

const loginView = document.getElementById("loginView");
const signupView = document.getElementById("signupView");
const articlesView = document.getElementById("articlesView");
const detailView = document.getElementById("detailView");
const articlesEl = document.getElementById("articles");
const detailEl = document.getElementById("detail");
const commentsEl = document.getElementById("comments");
const whoami = document.getElementById("whoami");
const dashLink = document.getElementById("dashLink");
const profileLink = document.getElementById("profileLink");
const logoutBtn = document.getElementById("logoutBtn");

let me = null;
let currentSlug = null;

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
}

function hashSlug() {
  return location.hash.startsWith("#a=")
    ? decodeURIComponent(location.hash.slice(3))
    : null;
}

function hideLoggedUI() {
  loginView.hidden = false;
  signupView.hidden = true;
  articlesView.hidden = true;
  detailView.hidden = true;
  logoutBtn.hidden = true;
  profileLink.hidden = true;
  dashLink.hidden = true;
  whoami.textContent = "";
  me = null;
  currentSlug = null;
}

async function refresh() {
  const t = await token();
  if (!t) {
    hideLoggedUI();
    return;
  }
  loginView.hidden = true;
  signupView.hidden = true;
  logoutBtn.hidden = false;
  profileLink.hidden = false;

  let meRes = null;
  try {
    meRes = await fetch(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${t}` }
    });
  } catch {
    meRes = null;
  }
  if (!meRes || !meRes.ok) {
    let detail = "";
    try { detail = (await meRes.json()).detail || ""; } catch { detail = ""; }
    await sb.auth.signOut();
    hideLoggedUI();
    document.getElementById("loginError").textContent = detail
      ? "API error: " + detail
      : "Cannot reach the API at " + API + ". Start the backend (python -m uvicorn app:app --port 8000) and open this page via http://127.0.0.1:5500, then sign in again.";
    return;
  }
  me = await meRes.json();
  whoami.textContent = me.email + (me.is_admin ? " · admin" : "");
  dashLink.hidden = !me.is_admin;

  const slug = hashSlug();
  if (slug) openArticle(slug);
  else showList();
}

async function showList() {
  const t = await token();
  if (!t) {
    hideLoggedUI();
    return;
  }
  currentSlug = null;
  detailView.hidden = true;
  articlesView.hidden = false;
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  const res = await fetch(`${API}/api/articles`, {
    headers: { Authorization: `Bearer ${t}` }
  });
  if (!res.ok) {
    articlesEl.innerHTML = "<p class='error'>Could not load articles. Is the backend running?</p>";
    return;
  }
  const data = await res.json();
  document.getElementById("countLine").textContent =
    `${data.items.length} entries available.`;
  articlesEl.innerHTML = data.items.map((a) => `
    <article class="article">
      ${a.image_url ? `<img class="cover" src="${escapeHtml(a.image_url)}" alt="" loading="lazy">` : ""}
      <h3>${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}${escapeHtml(a.title)}</h3>
      <p class="meta">${new Date(a.created_at).toLocaleDateString()} · ${a.comment_count || 0} comments</p>
      <p>${escapeHtml(a.excerpt)}</p>
      <p>${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</p>
      <button class="secondary small" data-open="${escapeHtml(a.slug)}">Read &amp; comment</button>
    </article>`).join("") || "<p>No entries yet.</p>";
}

async function openArticle(slug) {
  const t = await token();
  if (!t) {
    location.hash = "";
    hideLoggedUI();
    return;
  }
  currentSlug = slug;
  articlesView.hidden = true;
  detailView.hidden = false;
  detailEl.innerHTML = "<p class='meta'>Loading…</p>";
  commentsEl.innerHTML = "";
  const headers = { Authorization: `Bearer ${t}` };
  const [aRes, cRes] = await Promise.all([
    fetch(`${API}/api/articles/${encodeURIComponent(slug)}`, { headers }),
    fetch(`${API}/api/articles/${encodeURIComponent(slug)}/comments`, { headers })
  ]);
  if (!aRes.ok) {
    detailEl.innerHTML = "<p class='error'>Article not found.</p>";
    return;
  }
  const a = await aRes.json();
  detailEl.innerHTML = `
    ${a.image_url ? `<img class="cover" src="${escapeHtml(a.image_url)}" alt="">` : ""}
    <h1>${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}${escapeHtml(a.title)}</h1>
    <p class="meta">${new Date(a.created_at).toLocaleDateString()} · ${escapeHtml(a.author_email || "")}</p>
    <p>${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</p>
    <div class="body">${escapeHtml(a.content)}</div>`;
  if (cRes.ok) {
    const data = await cRes.json();
    renderComments(data.items || []);
  } else {
    commentsEl.innerHTML = "<p class='error'>Could not load comments. Is the backend running?</p>";
  }
}

async function reloadComments() {
  const t = await token();
  if (!t || !currentSlug) return;
  const res = await fetch(`${API}/api/articles/${encodeURIComponent(currentSlug)}/comments`, {
    headers: { Authorization: `Bearer ${t}` }
  });
  if (res.ok) {
    const data = await res.json();
    renderComments(data.items || []);
  }
}

function renderComments(items) {
  const admin = Boolean(me && me.is_admin);
  commentsEl.innerHTML = items.map((c) => `
    <div class="comment">
      <p class="meta">${escapeHtml(c.author_email || "member")} · ${new Date(c.created_at).toLocaleString()} ${c.pinned ? `<span class="pin-badge">Pinned</span>` : ""}</p>
      <p class="comment-body">${escapeHtml(c.body)}</p>
      <div class="comment-actions">
        <button class="secondary small react${c.liked ? " active" : ""}" data-react="like" data-id="${c.id}">Like ${c.like_count}</button>
        ${admin ? `<button class="secondary small react${c.fired ? " active" : ""}" data-react="fire" data-id="${c.id}">Fire ${c.fire_count}</button>` : (c.fire_count ? `<span class="tag fire-static">Fire ${c.fire_count}</span>` : "")}
        ${admin ? `<button class="secondary small" data-cpin="${c.id}" data-pinned="${c.pinned ? 1 : 0}">${c.pinned ? "Unpin" : "Pin"}</button>
        <button class="secondary small danger" data-cdel="${c.id}">Delete</button>` : ""}
      </div>
    </div>`).join("") || "<p class='meta'>No comments yet. Be the first.</p>";
}

function friendlyError(ex, fallback) {
  if (ex instanceof TypeError) return `Cannot reach the API at ${API}. Is the backend running?`;
  return (ex && ex.message) || fallback;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

articlesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open]");
  if (!btn) return;
  location.hash = "a=" + encodeURIComponent(btn.getAttribute("data-open"));
});

document.getElementById("backBtn").addEventListener("click", () => {
  location.hash = "";
  if (me) showList();
});

window.addEventListener("hashchange", () => {
  if (!me) return;
  const slug = hashSlug();
  if (slug) openArticle(slug);
  else showList();
});

commentsEl.addEventListener("click", async (e) => {
  const reactBtn = e.target.closest("[data-react]");
  const pinBtn = e.target.closest("[data-cpin]");
  const delBtn = e.target.closest("[data-cdel]");
  const t = await token();
  if (!t) return;
  if (reactBtn) {
    reactBtn.disabled = true;
    const res = await fetch(`${API}/api/comments/${reactBtn.getAttribute("data-id")}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ kind: reactBtn.getAttribute("data-react") })
    });
    reactBtn.disabled = false;
    if (res.ok) reloadComments();
    return;
  }
  if (pinBtn) {
    const pinned = pinBtn.getAttribute("data-pinned") !== "1";
    pinBtn.disabled = true;
    await fetch(`${API}/api/comments/${pinBtn.getAttribute("data-cpin")}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ pinned })
    });
    reloadComments();
    return;
  }
  if (delBtn) {
    if (!window.confirm("Delete this comment?")) return;
    delBtn.disabled = true;
    await fetch(`${API}/api/comments/${delBtn.getAttribute("data-cdel")}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` }
    });
    reloadComments();
  }
});

document.getElementById("commentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("commentError");
  const btn = document.getElementById("commentBtn");
  err.textContent = "";
  btn.disabled = true;
  try {
    const t = await token();
    if (!t || !currentSlug) return;
    const body = document.getElementById("commentBody").value.trim();
    if (!body) throw new Error("Write something first.");
    const res = await fetch(`${API}/api/articles/${encodeURIComponent(currentSlug)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ body })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Could not post comment");
    }
    e.target.reset();
    reloadComments();
  } catch (ex) {
    err.textContent = friendlyError(ex, "Could not post comment");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const err = document.getElementById("loginError");
  err.textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    err.textContent = error.message;
    return;
  }
  e.target.reset();
  refresh();
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  location.hash = "";
  hideLoggedUI();
});

document.getElementById("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  loginView.hidden = true;
  signupView.hidden = false;
});

document.getElementById("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  signupView.hidden = true;
  loginView.hidden = false;
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("suEmail").value.trim();
  const password = document.getElementById("suPassword").value;
  const err = document.getElementById("signupError");
  const ok = document.getElementById("signupOk");
  err.textContent = "";
  ok.textContent = "";
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    err.textContent = error.message;
    return;
  }
  if (data.session) {
    e.target.reset();
    refresh();
  } else {
    ok.textContent = "Account created. Check your email to confirm, then sign in.";
  }
});

refresh();
