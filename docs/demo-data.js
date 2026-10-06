/* demo content, no backend */
window.DEMO_DATA = {
  articles: [
    {
      id: "a1",
      title: "Shipping a private blog on FastAPI and Supabase",
      slug: "fastapi-supabase-blog",
      excerpt: "Why the API serves JSON only, how auth stays inside Supabase, and where the ranking lives.",
      content: "The first decision was boring on purpose: the API serves JSON and nothing else.\n\nAll pages are plain HTML, CSS and JavaScript. There is no server-side rendering, no framework, no build step. The FastAPI backend verifies the Supabase JWT on every request, resolves the member profile and the admin flag, and returns data.\n\nPasswords never touch the API. Supabase Auth owns credentials end to end; the backend only ever sees a verified user id and email.\n\nComment ranking is the one piece of real logic: pinned comments first, then a hot score that weighs reactions against age, then newest. It runs server-side in production, and this demo re-implements the same formula in the browser so you can watch it work.",
      tags: ["fastapi", "supabase", "architecture"],
      image_url: null,
      pinned: true,
      created_at: "2026-09-28T10:00:00Z",
      author_email: "admin@example.com"
    },
    {
      id: "a2",
      title: "Hot-score ranking for small communities",
      slug: "hot-score-ranking",
      excerpt: "Likes are cheap, admin fires are not: score = (likes + 5 x fires) / (age_hours + 2)^1.2.",
      content: "Chronological order buries good replies. Vote-only order freezes the front page. For a small private blog, a decayed score works better.\n\nEach comment gets score = (likes + 5 x fires) / (age_hours + 2) ^ 1.2. Likes come from any member; fires are admin-only endorsements, so each one counts as five likes. The +2 in the denominator keeps fresh comments competitive for their first hours, and the 1.2 exponent decays old threads gently instead of killing them overnight.\n\nPinned comments skip the math entirely and stay on top. Everything else re-sorts on every page load, so an old reply with a new wave of likes can climb back up.\n\nOpen the comments below and toggle a few likes to see the order change live.",
      tags: ["ranking", "community"],
      image_url: null,
      pinned: false,
      created_at: "2026-09-20T15:30:00Z",
      author_email: "admin@example.com"
    },
    {
      id: "a3",
      title: "Vanilla JS frontend: what I kept and what I miss",
      slug: "vanilla-js-frontend",
      excerpt: "No framework, no bundler: fetch, template strings and hash routing were enough — mostly.",
      content: "The whole reader UI is one HTML file, one CSS file and a few scripts. Routing is a location hash (#a=slug), rendering is template strings with an escapeHtml helper, and state is three module-level variables.\n\nWhat worked: the app loads instantly, there is nothing to build or deploy beyond static files, and every bug is traceable in minutes. The admin console and the profile page reuse the same styles and helpers.\n\nWhat I miss: the comment list re-renders from scratch on every reaction, and form state is handled by hand. Past a dozen components I would reach for something with real state management.\n\nFor this size, though, vanilla was the right call — and it made this static demo trivial to build.",
      tags: ["javascript", "frontend"],
      image_url: null,
      pinned: false,
      created_at: "2026-09-12T09:15:00Z",
      author_email: "admin@example.com"
    }
  ],
  comments: [
    {
      id: "c1",
      article_id: "a1",
      author_email: "reader@example.com",
      body: "The JSON-only API decision makes total sense. Did you ever consider server-side rendering for the reader pages?",
      pinned: false,
      created_at: "2026-10-01T08:20:00Z",
      like_count: 4,
      fire_count: 1,
      liked: false,
      fired: false
    },
    {
      id: "c2",
      article_id: "a1",
      author_email: "admin@example.com",
      body: "Welcome — please keep discussion civil and on topic. Off-topic threads get unpinned, not deleted.",
      pinned: true,
      created_at: "2026-09-28T11:00:00Z",
      like_count: 1,
      fire_count: 0,
      liked: false,
      fired: false
    },
    {
      id: "c3",
      article_id: "a1",
      author_email: "member@example.com",
      body: "Confirming the setup works exactly as the README says. The seed_admin step took under a minute.",
      pinned: false,
      created_at: "2026-10-05T18:45:00Z",
      like_count: 2,
      fire_count: 0,
      liked: false,
      fired: false
    },
    {
      id: "c4",
      article_id: "a2",
      author_email: "reader@example.com",
      body: "Why ^1.2 and not ^2 like classic HN decay? Genuinely curious about the tuning.",
      pinned: false,
      created_at: "2026-09-25T14:10:00Z",
      like_count: 6,
      fire_count: 0,
      liked: false,
      fired: false
    },
    {
      id: "c5",
      article_id: "a2",
      author_email: "admin@example.com",
      body: "Great question — ^2 killed threads too fast for a community this small. 1.2 keeps a good reply visible for days instead of hours.",
      pinned: false,
      created_at: "2026-09-25T16:40:00Z",
      like_count: 9,
      fire_count: 2,
      liked: false,
      fired: false
    },
    {
      id: "c6",
      article_id: "a3",
      author_email: "member@example.com",
      body: "Hash routing in 2026, respect. It really does keep things simple at this scale.",
      pinned: false,
      created_at: "2026-09-30T12:05:00Z",
      like_count: 3,
      fire_count: 0,
      liked: false,
      fired: false
    }
  ]
};
