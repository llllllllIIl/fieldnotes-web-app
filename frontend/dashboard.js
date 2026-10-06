const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);
const API = window.APP_CONFIG.API_BASE;
const BUCKET = "article-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const coverInput = document.getElementById("cover");
const coverPreview = document.getElementById("coverPreview");

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.access_token : null;
}

function authHeaders(t) {
  return { Authorization: `Bearer ${t}` };
}

async function init() {
  const t = await token();
  if (!t) {
    window.location.href = "index.html";
    return;
  }
  const meRes = await fetch(`${API}/api/me`, { headers: authHeaders(t) });
  if (!meRes.ok) {
    window.location.href = "index.html";
    return;
  }
  const me = await meRes.json();
  if (!me.is_admin) {
    document.getElementById("denied").hidden = false;
    return;
  }
  document.getElementById("adminView").hidden = false;
  loadRecent(t);
}

async function loadRecent(t) {
  const res = await fetch(`${API}/api/articles`, { headers: authHeaders(t) });
  const box = document.getElementById("recent");
  if (!res.ok) {
    box.innerHTML = "<p class='error'>Could not load.</p>";
    return;
  }
  const data = await res.json();
  box.innerHTML = data.items.slice(0, 10).map((a) => {
    const thumb = a.image_url
      ? `<img class="thumb" src="${escapeHtml(a.image_url)}" alt="" loading="lazy">`
      : "";
    const badge = a.pinned ? `<span class="pin-badge">Pinned</span>` : "";
    const label = a.pinned ? "Unpin" : "Pin";
    return `<div class="article recent-row">${thumb}
      <div class="recent-main"><h3>${escapeHtml(a.title)}</h3>
      <p class="meta">${escapeHtml(a.slug)} ${badge}</p></div>
      <button class="secondary small" data-pin="${a.id}" data-pinned="${a.pinned ? 1 : 0}">${label}</button>
    </div>`;
  }).join("") || "<p>No entries yet.</p>";

  box.querySelectorAll("[data-pin]").forEach((btn) => {
    btn.addEventListener("click", () => togglePin(btn));
  });
}

async function togglePin(btn) {
  const t = await token();
  if (!t) return;
  const id = btn.getAttribute("data-pin");
  const pinned = btn.getAttribute("data-pinned") !== "1";
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/api/articles/${id}/pin`, {
      method: "PATCH",
      headers: { ...authHeaders(t), "Content-Type": "application/json" },
      body: JSON.stringify({ pinned })
    });
    if (!res.ok) throw new Error("pin failed");
    loadRecent(t);
  } catch {
    btn.disabled = false;
  }
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

function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80) || "cover";
}

async function uploadCover(file) {
  const path = `${Date.now()}-${sanitizeName(file.name)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

coverInput.addEventListener("change", () => {
  const file = coverInput.files[0];
  if (!file) {
    coverPreview.hidden = true;
    coverPreview.removeAttribute("src");
    return;
  }
  if (!file.type.startsWith("image/")) {
    coverInput.value = "";
    coverPreview.hidden = true;
    return;
  }
  coverPreview.src = URL.createObjectURL(file);
  coverPreview.hidden = false;
});

document.getElementById("articleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("formError");
  const ok = document.getElementById("formOk");
  const btn = document.getElementById("publishBtn");
  err.textContent = "";
  ok.textContent = "";
  btn.disabled = true;
  btn.textContent = "Publishing…";
  try {
    const t = await token();
    if (!t) {
      window.location.href = "index.html";
      return;
    }
    let imageUrl = null;
    const file = coverInput.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) throw new Error("Cover must be an image file.");
      if (file.size > MAX_IMAGE_BYTES) throw new Error("Cover image exceeds 5 MB.");
      imageUrl = await uploadCover(file);
    }
    const payload = {
      title: document.getElementById("title").value.trim(),
      excerpt: document.getElementById("excerpt").value.trim(),
      content: document.getElementById("content").value,
      tags: document.getElementById("tags").value.split(",").map((s) => s.trim()).filter(Boolean),
      image_url: imageUrl,
      pinned: document.getElementById("pinned").checked
    };
    const res = await fetch(`${API}/api/articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Publish failed");
    }
    e.target.reset();
    coverPreview.hidden = true;
    coverPreview.removeAttribute("src");
    ok.textContent = "Entry published.";
    loadRecent(t);
  } catch (ex) {
    err.textContent = friendlyError(ex, "Publish failed");
  } finally {
    btn.disabled = false;
    btn.textContent = "Publish article";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  window.location.href = "index.html";
});

init();
