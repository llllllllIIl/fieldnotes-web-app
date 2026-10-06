/* demo: same ranking as the api, runs locally */
const DATA = window.DEMO_DATA;

const articlesView = document.getElementById("articlesView");
const detailView = document.getElementById("detailView");
const articlesEl = document.getElementById("articles");
const detailEl = document.getElementById("detail");
const commentsEl = document.getElementById("comments");
const searchInput = document.getElementById("searchInput");
const tagBar = document.getElementById("tagBar");

let currentSlug = null;
let activeTag = null;
let seq = 100;

function hotScore(likes, fires, createdAt) {
  const dt = new Date(createdAt).getTime();
  const ageH = Number.isFinite(dt) ? Math.max(0, (Date.now() - dt) / 3600000) : 0;
  return (likes + 5 * fires) / Math.pow(ageH + 2, 1.2);
}

function rankComments(items) {
  for (const c of items) {
    c.score = Math.round(hotScore(c.like_count, c.fire_count, c.created_at) * 10000) / 10000;
  }
  items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  items.sort((a, b) => b.score - a.score);
  items.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  return items;
}

function articleBySlug(slug) {
  return DATA.articles.find((a) => a.slug === slug) || null;
}

function commentsFor(articleId) {
  return rankComments(DATA.comments.filter((c) => c.article_id === articleId));
}

function hashSlug() {
  return location.hash.startsWith("#a=")
    ? decodeURIComponent(location.hash.slice(3))
    : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function commentCount(articleId) {
  return DATA.comments.filter((c) => c.article_id === articleId).length;
}

function allTags() {
  const seen = [];
  for (const a of DATA.articles) {
    for (const t of a.tags || []) {
      if (!seen.includes(t)) seen.push(t);
    }
  }
  return seen.sort();
}

function matchesQuery(a, q) {
  if (!q) return true;
  const hay = `${a.title} ${a.excerpt} ${(a.tags || []).join(" ")}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function filteredArticles() {
  const q = searchInput.value.trim();
  return DATA.articles
    .filter((a) => (!activeTag || (a.tags || []).includes(activeTag)) && matchesQuery(a, q))
    .sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      String(b.created_at).localeCompare(String(a.created_at))
    );
}

function renderTagBar() {
  const tags = allTags();
  tagBar.innerHTML = tags.map((t) =>
    `<button type="button" class="tagpill${t === activeTag ? " on" : ""}" data-tag="${escapeHtml(t)}" aria-pressed="${t === activeTag}">${escapeHtml(t)}</button>`
  ).join("");
}

function renderList() {
  const items = filteredArticles();
  const total = DATA.articles.length;
  document.getElementById("countLine").textContent =
    items.length === total
      ? `${total} entries available.`
      : `${items.length} of ${total} entries match.`;
  articlesEl.innerHTML = items.map((a) => `
    <article class="article">
      <h3>${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}${escapeHtml(a.title)}</h3>
      <p class="meta">${new Date(a.created_at).toLocaleDateString()} · ${commentCount(a.id)} comments</p>
      <p>${escapeHtml(a.excerpt)}</p>
      <p>${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</p>
      <button class="secondary small" data-open="${escapeHtml(a.slug)}">Read &amp; comment</button>
    </article>`).join("") || "<p class='meta'>No entries match. Clear the search or pick another tag.</p>";
}

function showList() {
  currentSlug = null;
  detailView.hidden = true;
  articlesView.hidden = false;
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  renderTagBar();
  renderList();
}

function openArticle(slug) {
  const a = articleBySlug(slug);
  currentSlug = slug;
  articlesView.hidden = true;
  detailView.hidden = false;
  if (!a) {
    detailEl.innerHTML = "<p class='error'>Article not found.</p>";
    commentsEl.innerHTML = "";
    return;
  }
  detailEl.innerHTML = `
    <h1>${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}${escapeHtml(a.title)}</h1>
    <p class="meta">${new Date(a.created_at).toLocaleDateString()} · ${escapeHtml(a.author_email || "")}</p>
    <p>${(a.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</p>
    <div class="body">${escapeHtml(a.content)}</div>`;
  renderComments(commentsFor(a.id));
}

function renderComments(items) {
  commentsEl.innerHTML = items.map((c) => `
    <div class="comment">
      <p class="meta">${escapeHtml(c.author_email || "member")} · ${new Date(c.created_at).toLocaleString()} ${c.pinned ? `<span class="pin-badge">Pinned</span>` : ""}</p>
      <p class="comment-body">${escapeHtml(c.body)}</p>
      <div class="comment-actions">
        <button class="secondary small react${c.liked ? " active" : ""}" data-react="like" data-id="${c.id}" aria-pressed="${Boolean(c.liked)}">Like ${c.like_count}</button>
        ${c.fire_count ? `<span class="tag fire-static">Fire ${c.fire_count}</span>` : ""}
      </div>
    </div>`).join("") || "<p class='meta'>No comments yet. Be the first.</p>";
}

function reloadComments() {
  const a = articleBySlug(currentSlug);
  if (!a) return;
  renderComments(commentsFor(a.id));
}

searchInput.addEventListener("input", renderList);

tagBar.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tag]");
  if (!btn) return;
  const t = btn.getAttribute("data-tag");
  activeTag = (t === activeTag) ? null : t;
  renderTagBar();
  renderList();
});

articlesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open]");
  if (!btn) return;
  location.hash = "a=" + encodeURIComponent(btn.getAttribute("data-open"));
});

document.getElementById("backBtn").addEventListener("click", () => {
  location.hash = "";
  showList();
});

window.addEventListener("hashchange", () => {
  const slug = hashSlug();
  if (slug) openArticle(slug);
  else showList();
});

commentsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-react]");
  if (!btn) return;
  const c = DATA.comments.find((x) => x.id === btn.getAttribute("data-id"));
  if (!c) return;
  c.liked = !c.liked;
  c.like_count += c.liked ? 1 : -1;
  reloadComments();
});

document.getElementById("commentForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const err = document.getElementById("commentError");
  err.textContent = "";
  const a = articleBySlug(currentSlug);
  const body = document.getElementById("commentBody").value.trim();
  if (!a) return;
  if (!body) {
    err.textContent = "Write something first.";
    return;
  }
  DATA.comments.push({
    id: "local-" + (seq++),
    article_id: a.id,
    author_email: "you (demo)",
    body: body.slice(0, 2000),
    pinned: false,
    created_at: new Date().toISOString(),
    like_count: 0,
    fire_count: 0,
    liked: false,
    fired: false
  });
  e.target.reset();
  reloadComments();
});

const initial = hashSlug();
if (initial) { renderTagBar(); openArticle(initial); }
else showList();
