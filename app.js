/* =====================================================================
   ACHIEVE AI TRAINING  ·  single-file front end (no build step)
   Talks to Supabase with the public anon key. All security is enforced
   by Row Level Security in the database (schema.sql).
   ===================================================================== */

(function () {
  "use strict";

  // ---------- Config / client ----------
  const CFG = window.ACHIEVE_CONFIG || {};
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.indexOf("YOUR-PROJECT") !== -1) {
    document.getElementById("app").innerHTML =
      '<div class="max-w-lg mx-auto mt-24 p-6 bg-white rounded-xl shadow text-center">' +
      '<h1 class="text-xl font-bold mb-2">Almost there</h1>' +
      '<p class="text-slate-600">Open <code>config.js</code> and paste your Supabase URL and anon key, ' +
      'then redeploy.</p></div>';
    return;
  }
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  // ---------- Tiny helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const app = () => document.getElementById("app");
  const esc = (s) =>
    (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
  const pretty = (s) => (s == null ? "" : String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");
  const daysUntil = (d) => (d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null);

  function toast(msg, kind) {
    const box = document.getElementById("toast");
    const color = kind === "error" ? "bg-red-600" : kind === "warn" ? "bg-amber-600" : "bg-slate-800";
    const t = document.createElement("div");
    t.className = color + " text-white px-4 py-2 rounded-lg shadow text-sm max-w-xs";
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }
  async function guard(promise, okMsg) {
    const { data, error } = await promise;
    if (error) { toast(error.message || "Something went wrong", "error"); throw error; }
    if (okMsg) toast(okMsg);
    return data;
  }
  const go = (hash) => { window.location.hash = hash; };
  const busy = () => (app().innerHTML = '<div class="flex items-center justify-center h-64"><div class="spin"></div></div>');

  // ---------- Constants ----------
  const STATUS_ORDER = [
    "not_started","ideas_in_progress","ideas_submitted","ideas_under_review","changes_requested",
    "project_selected","scope_in_progress","scope_submitted","scope_approved","building","testing",
    "project_submitted","final_changes_requested","approved"
  ];
  const IDEA_FIELDS = [
    ["title","Idea title"],["problem","Problem being solved"],["people_affected","People affected"],
    ["current_process","Current process"],["proposed_solution","Proposed AI solution"],
    ["expected_benefit","Expected benefit"],["info_required","Information / files required"],
    ["risks","Potential risks"],["complexity","Estimated complexity"],["success_measure","How success is measured"]
  ];
  const SCOPE_FIELDS = [
    ["project_name","Project name"],["problem_statement","Problem statement"],["intended_users","Intended users"],
    ["current_process","Current process"],["proposed_solution","Proposed solution"],["user_journey","Main user journey"],
    ["required_inputs","Required inputs"],["expected_outputs","Expected outputs"],["features_v1","Features for version one"],
    ["features_excluded","Features excluded from version one"],["database_reqs","Database requirements"],
    ["storage_reqs","File-storage requirements"],["roles_permissions","User roles and permissions"],
    ["privacy_security","Privacy / security considerations"],["human_approval","Human approval points"],
    ["success_measures","Success measures"],["test_cases","Test cases"],["known_risks","Known risks"],
    ["future_improvements","Future improvements"]
  ];
  const FINAL_FIELDS = [
    ["title","Project title"],["description","Short description"],["problem_solved","Problem solved"],
    ["intended_users","Intended users"],["live_link","Live application link"],["doc_link","Supporting document link"],
    ["code_link","Source-code link"],["screenshots","Screenshots (links)"],["features_completed","Features completed"],
    ["features_not_completed","Features not completed"],["limitations","Known limitations"],["test_results","Test results"],
    ["privacy_notes","Privacy and security notes"],["reflection","Reflection on what you discovered"],
    ["future_improvements","Future improvements"]
  ];
  const RATINGS = ["Not demonstrated","Developing","Meets expectations","Exceeds expectations"];

  // ---------- Session state ----------
  let ME = null;          // profiles row for the logged-in user
  let CATEGORIES = [];
  let SETTINGS = {};

  async function loadMe() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { ME = null; return null; }
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    ME = data ? Object.assign({ authEmail: user.email }, data) : { id: user.id, authEmail: user.email, missing: true };
    return ME;
  }
  async function loadRefData() {
    const [cats, sets] = await Promise.all([
      sb.from("categories").select("*").order("sort"),
      sb.from("settings").select("*")
    ]);
    CATEGORIES = (cats.data || []).map((c) => c.name);
    SETTINGS = {};
    (sets.data || []).forEach((s) => (SETTINGS[s.key] = s.value));
  }

  // =====================================================================
  //  AUTH VIEWS
  // =====================================================================
  function authShell(inner) {
    return (
      '<div class="min-h-screen flex items-center justify-center p-4">' +
        '<div class="w-full max-w-md">' +
          '<div class="text-center mb-6">' +
            '<div class="text-4xl mb-2">🎓</div>' +
            '<h1 class="text-2xl font-bold text-slate-900">Achieve AI Training</h1>' +
            '<p class="text-slate-500 text-sm">Project & training portal</p>' +
          "</div>" +
          '<div class="bg-white rounded-2xl shadow-lg p-6">' + inner + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function viewLogin() {
    app().innerHTML = authShell(
      '<h2 class="text-lg font-semibold mb-4">Sign in</h2>' +
      '<form id="f" class="space-y-3">' +
        input("email", "email", "Email", true) +
        input("password", "password", "Password", true) +
        '<button class="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 font-medium">Sign in</button>' +
      "</form>" +
      '<div class="mt-4 text-sm text-center space-y-1">' +
        '<div><a href="#/setup" class="text-brand hover:underline">First time? Create your password</a></div>' +
        '<div><a href="#/forgot" class="text-slate-500 hover:underline">Forgot password?</a></div>' +
      "</div>"
    );
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim(), password = $("#password").value;
      try {
        await guard(sb.auth.signInWithPassword({ email, password }));
        await sb.from("profiles").update({ last_login: new Date().toISOString() }).eq("email", email);
        location.hash = "#/dashboard"; boot();
      } catch (_) {}
    };
  }

  function viewSetup() {
    app().innerHTML = authShell(
      '<h2 class="text-lg font-semibold mb-1">Create your password</h2>' +
      '<p class="text-sm text-slate-500 mb-4">Use the exact email your invitation was sent to.</p>' +
      '<form id="f" class="space-y-3">' +
        input("email", "email", "Invited email", true) +
        input("password", "password", "Choose a password (min 6 chars)", true) +
        '<button class="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 font-medium">Create account</button>' +
      "</form>" +
      '<p class="mt-4 text-sm text-center"><a href="#/login" class="text-brand hover:underline">Back to sign in</a></p>'
    );
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim(), password = $("#password").value;
      try {
        const data = await guard(sb.auth.signUp({ email, password }));
        if (data.session) { location.hash = "#/dashboard"; boot(); }
        else { toast("Account created. If email confirmation is on, confirm then sign in.", "warn"); go("#/login"); }
      } catch (_) {}
    };
  }

  function viewForgot() {
    app().innerHTML = authShell(
      '<h2 class="text-lg font-semibold mb-1">Reset password</h2>' +
      '<p class="text-sm text-slate-500 mb-4">We\'ll email you a reset link.</p>' +
      '<form id="f" class="space-y-3">' +
        input("email", "email", "Email", true) +
        '<button class="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 font-medium">Send reset link</button>' +
      "</form>" +
      '<p class="mt-4 text-sm text-center"><a href="#/login" class="text-brand hover:underline">Back to sign in</a></p>'
    );
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await guard(
          sb.auth.resetPasswordForEmail($("#email").value.trim(), { redirectTo: location.origin + "/#/reset" }),
          "If that email exists, a reset link is on its way."
        );
        go("#/login");
      } catch (_) {}
    };
  }

  function viewReset() {
    app().innerHTML = authShell(
      '<h2 class="text-lg font-semibold mb-4">Set a new password</h2>' +
      '<form id="f" class="space-y-3">' +
        input("password", "password", "New password", true) +
        '<button class="w-full bg-brand hover:bg-brand-dark text-white rounded-lg py-2.5 font-medium">Update password</button>' +
      "</form>"
    );
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await guard(sb.auth.updateUser({ password: $("#password").value }), "Password updated.");
        location.hash = "#/dashboard"; boot();
      } catch (_) {}
    };
  }

  function input(id, type, label, req) {
    return (
      '<div><label class="block text-sm text-slate-600 mb-1">' + esc(label) + "</label>" +
      '<input id="' + id + '" type="' + type + '" ' + (req ? "required" : "") +
      ' class="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand focus:border-brand outline-none" /></div>'
    );
  }

  // =====================================================================
  //  APP CHROME (nav)
  // =====================================================================
  function navItems() {
    const r = ME.role;
    const items = [["#/dashboard", "Dashboard"]];
    if (r === "learner") {
      items.push(["#/ideas", "My Ideas"], ["#/scope", "Scope"], ["#/project", "My Project"]);
    }
    if (r === "admin") {
      items.push(["#/admin/learners", "My Learners"]);
    }
    if (r === "superadmin") {
      items.push(["#/program", "Programme"], ["#/users", "Users"], ["#/settings", "Settings"],
        ["#/audit", "Audit"], ["#/export", "Export"]);
    }
    items.push(["#/materials", "Materials"], ["#/notifications", "Notifications"]);
    return items;
  }

  function chrome(inner) {
    const cur = location.hash || "#/dashboard";
    const links = navItems().map(([h, l]) => {
      const on = cur.indexOf(h) === 0;
      return '<a href="' + h + '" class="px-3 py-2 rounded-lg text-sm ' +
        (on ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100") + '">' + esc(l) + "</a>";
    }).join("");
    const badge = ME.role === "superadmin" ? "bg-purple-100 text-purple-700"
      : ME.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700";
    app().innerHTML =
      '<div class="min-h-screen">' +
      '<header class="bg-white border-b sticky top-0 z-30">' +
        '<div class="max-w-6xl mx-auto px-4 flex items-center gap-2 h-14">' +
          '<a href="#/dashboard" class="font-bold text-slate-900 mr-2">🎓 Achieve</a>' +
          '<nav class="hidden md:flex gap-1 flex-1">' + links + "</nav>" +
          '<span class="ml-auto text-xs px-2 py-1 rounded-full ' + badge + '">' + pretty(ME.role) + "</span>" +
          '<span class="text-sm text-slate-600 hidden sm:inline">' + esc(ME.full_name || ME.email) + "</span>" +
          '<button id="logout" class="text-sm text-slate-500 hover:text-red-600 ml-1">Sign out</button>' +
        "</div>" +
        '<nav class="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">' + links + "</nav>" +
      "</header>" +
      '<main class="max-w-6xl mx-auto px-4 py-6">' + inner + "</main>" +
      "</div>";
    $("#logout").onclick = async () => { await sb.auth.signOut(); ME = null; location.hash = "#/login"; boot(); };
  }

  function card(title, body, extra) {
    return '<div class="bg-white rounded-xl shadow-sm border p-5 ' + (extra || "") + '">' +
      (title ? '<h3 class="font-semibold text-slate-900 mb-3">' + esc(title) + "</h3>" : "") + body + "</div>";
  }
  function stat(label, value, color) {
    return '<div class="bg-white rounded-xl border p-4"><div class="text-2xl font-bold ' +
      (color || "text-slate-900") + '">' + value + '</div><div class="text-xs text-slate-500 mt-1">' + esc(label) + "</div></div>";
  }
  function statusPill(s) {
    const done = s === "approved", warn = /changes|hold|withdrawn/.test(s || "");
    const cls = done ? "bg-emerald-100 text-emerald-700" : warn ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700";
    return '<span class="text-xs px-2 py-1 rounded-full ' + cls + '">' + pretty(s) + "</span>";
  }
  function ta(id, label, val) {
    return '<div><label class="block text-sm font-medium text-slate-700 mb-1">' + esc(label) + "</label>" +
      '<textarea id="' + id + '" rows="2" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand outline-none">' +
      esc(val || "") + "</textarea></div>";
  }

  // =====================================================================
  //  NEXT ACTION helper (drives "what do I do next")
  // =====================================================================
  function nextActionFor(status) {
    const map = {
      not_started: ["Start by drafting your three project ideas.", "#/ideas"],
      ideas_in_progress: ["Finish and submit your three ideas.", "#/ideas"],
      ideas_submitted: ["Waiting for your supervisor to review your ideas.", "#/ideas"],
      ideas_under_review: ["Your supervisor is reviewing your ideas.", "#/ideas"],
      changes_requested: ["Changes were requested on your ideas — update and resubmit.", "#/ideas"],
      project_selected: ["An idea was selected. Start your project scope.", "#/scope"],
      scope_in_progress: ["Complete and submit your project scope.", "#/scope"],
      scope_submitted: ["Waiting for scope approval.", "#/scope"],
      scope_approved: ["Scope approved. You may begin building.", "#/project"],
      building: ["Keep building and post progress updates.", "#/project"],
      testing: ["Test your project, then submit it for review.", "#/project"],
      project_submitted: ["Submitted. Waiting for final review.", "#/project"],
      final_changes_requested: ["Final changes requested — update and resubmit.", "#/project"],
      approved: ["🎉 Your project is approved. Well done!", "#/project"],
      on_hold: ["Your project is on hold. Contact your supervisor.", "#/project"],
      withdrawn: ["This project was withdrawn.", "#/project"],
      archived: ["This project is archived.", "#/project"]
    };
    return map[status] || ["—", "#/dashboard"];
  }

  // =====================================================================
  //  LEARNER: dashboard
  // =====================================================================
  async function learnerProject() {
    const { data } = await sb.from("projects").select("*").eq("learner_id", ME.id).maybeSingle();
    return data;
  }

  async function viewLearnerDashboard() {
    busy();
    const proj = await learnerProject();
    if (!proj) return chrome(card("Welcome", "<p>Your project space is being set up. Please refresh shortly.</p>"));
    const [sup, ideasRes, annRes] = await Promise.all([
      proj ? sb.from("profiles").select("full_name,email").eq("id", ME.supervisor_id).maybeSingle() : { data: null },
      sb.from("ideas").select("id,title,is_selected,submitted").eq("project_id", proj.id),
      sb.from("announcements").select("*").order("created_at", { ascending: false }).limit(3)
    ]);
    const ideas = ideasRes.data || [];
    const [next, nextLink] = nextActionFor(proj.status);
    const idx = STATUS_ORDER.indexOf(proj.status);
    const pct = idx < 0 ? 0 : Math.round((idx / (STATUS_ORDER.length - 1)) * 100);
    const deadline = SETTINGS.deadline_submission_due;

    chrome(
      '<div class="grid gap-4 md:grid-cols-3">' +
        '<div class="md:col-span-2 space-y-4">' +
          card("What do I need to do next?",
            '<p class="text-lg text-slate-900">' + esc(next) + "</p>" +
            '<a href="' + nextLink + '" class="inline-block mt-3 bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2 text-sm">Go there</a>',
            "border-l-4 border-brand") +
          card("My project",
            '<div class="flex items-center justify-between mb-3"><div class="font-medium">' +
              esc(proj.title || "Untitled project") + "</div>" + statusPill(proj.status) + "</div>" +
            '<div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-brand h-2 rounded-full" style="width:' + pct + '%"></div></div>' +
            '<div class="text-xs text-slate-500 mt-1">' + pct + "% through the workflow</div>") +
          card("My three ideas",
            ideas.length
              ? '<ul class="space-y-2">' + ideas.map((i) =>
                  '<li class="flex items-center justify-between text-sm"><span>' + esc(i.title || "Untitled idea") + "</span>" +
                  (i.is_selected ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Selected</span>' :
                   i.submitted ? '<span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Submitted</span>' :
                   '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Draft</span>') + "</li>"
                ).join("") + "</ul>"
              : '<p class="text-sm text-slate-500">No ideas yet. <a href="#/ideas" class="text-brand">Add them</a>.</p>') +
        "</div>" +
        '<div class="space-y-4">' +
          card("At a glance",
            '<div class="text-sm space-y-2">' +
              '<div class="flex justify-between"><span class="text-slate-500">Supervisor</span><span>' + esc((sup.data && sup.data.full_name) || (sup.data && sup.data.email) || "Unassigned") + "</span></div>" +
              '<div class="flex justify-between"><span class="text-slate-500">Status</span>' + statusPill(proj.status) + "</div>" +
              '<div class="flex justify-between"><span class="text-slate-500">Submission due</span><span>' + fmtDate(deadline) + "</span></div>" +
            "</div>") +
          card("Announcements",
            (annRes.data && annRes.data.length)
              ? annRes.data.map((a) => '<div class="mb-3"><div class="font-medium text-sm">' + esc(a.title) + "</div>" +
                  '<div class="text-xs text-slate-500">' + nl2br(a.body) + "</div></div>").join("")
              : '<p class="text-sm text-slate-500">Nothing yet.</p>') +
          card("Training materials", '<a href="#/materials" class="text-brand text-sm">Open the library →</a>') +
        "</div>" +
      "</div>"
    );
  }

  // =====================================================================
  //  LEARNER: ideas
  // =====================================================================
  async function viewIdeas() {
    busy();
    const proj = await learnerProject();
    if (!proj) return chrome(card("Ideas", "<p>Project not ready yet.</p>"));
    let { data: ideas } = await sb.from("ideas").select("*").eq("project_id", proj.id).order("created_at");
    ideas = ideas || [];
    const savedCount = ideas.filter((i) => i.title).length;
    const editable = ["not_started", "ideas_in_progress", "changes_requested"].includes(proj.status);
    const submittedStage = ["ideas_submitted", "ideas_under_review"].includes(proj.status);

    const slots = [];
    for (let n = 0; n < 3; n++) slots.push(ideas[n] || null);

    const forms = slots.map((idea, n) => {
      const i = idea || {};
      const hasId = !!i.id;
      const saved = hasId && !!i.title;
      const badge = i.is_selected
        ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Selected</span>'
        : saved ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Saved &#10003;</span>'
        : hasId ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Draft &middot; needs a title</span>'
        : '<span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Empty</span>';
      const delBtn = hasId
        ? '<button class="del-idea text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5" data-id="' + i.id + '">Delete</button>'
        : "";
      return card(
        '<div class="flex items-center justify-between"><span>Idea ' + (n + 1) + "</span>" + badge + "</div>",
        '<div class="grid gap-3 md:grid-cols-2" data-idea="' + n + '">' +
          IDEA_FIELDS.map(([f, lbl]) =>
            f === "title"
              ? '<div class="md:col-span-2">' + fieldTa(f, lbl, i[f], !editable) + "</div>"
              : fieldTa(f, lbl, i[f], !editable)
          ).join("") +
          '<div class="md:col-span-2">' + selectField("category", "Category", i.category, CATEGORIES, !editable) + "</div>" +
          '<input type="hidden" class="idea-id" value="' + (i.id || "") + '">' +
        "</div>" +
        '<div class="mt-3 flex gap-2">' +
          (editable ? '<button class="save-idea text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-3 py-1.5" data-idea="' + n + '">Save idea ' + (n + 1) + "</button>" : "") +
          delBtn +
        "</div>"
      );
    }).join("");

    let banner = "";
    if (submittedStage) {
      banner = '<div class="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg flex items-center justify-between gap-3">' +
        "<span>Your ideas are submitted and waiting for review. You can withdraw them to edit, or delete one below.</span>" +
        '<button id="reopen-ideas" class="shrink-0 text-sm font-medium underline">Withdraw to edit</button></div>';
    } else if (proj.status === "changes_requested") {
      banner = '<div class="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-lg">Your supervisor requested changes. Update your ideas below and submit again.</div>';
    } else if (!editable) {
      banner = '<div class="mb-4 p-3 bg-slate-100 text-slate-600 text-sm rounded-lg">An idea has been selected, so your ideas are now locked.</div>';
    }

    const submitReady = savedCount >= 3;
    const submitArea = editable
      ? '<div class="mt-4 flex flex-wrap items-center gap-3">' +
          '<button id="submit-ideas" ' + (submitReady ? "" : "disabled") + ' class="' +
            (submitReady ? "bg-brand hover:bg-brand-dark" : "bg-slate-300 cursor-not-allowed") +
            ' text-white rounded-lg px-4 py-2">Submit all three for review</button>' +
          '<span class="text-sm text-slate-500">' + savedCount + " of 3 ideas saved" +
            (submitReady ? "" : " &mdash; each idea needs at least a title") + "</span>" +
        "</div>"
      : "";

    chrome(
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">My three ideas</h2>' +
        '<div class="flex items-center gap-2">' + statusPill(proj.status) +
        '<span class="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Saved ' + savedCount + "/3</span></div></div>" +
      banner + forms + submitArea
    );

    document.querySelectorAll(".save-idea").forEach((b) => (b.onclick = () => saveIdea(proj, +b.dataset.idea)));
    document.querySelectorAll(".del-idea").forEach((b) => (b.onclick = () => deleteIdea(proj, b.dataset.id)));
    const si = $("#submit-ideas");
    if (si) si.onclick = () => submitIdeas(proj);
    const ro = $("#reopen-ideas");
    if (ro) ro.onclick = () => withdrawIdeas(proj);
  }

  function fieldTa(id, label, val, locked) {
    return '<div><label class="block text-xs font-medium text-slate-600 mb-1">' + esc(label) + "</label>" +
      '<textarea data-f="' + id + '" rows="2" ' + (locked ? "disabled" : "") +
      ' class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm ' + (locked ? "bg-slate-50" : "") + '">' +
      esc(val || "") + "</textarea></div>";
  }
  function selectField(id, label, val, opts, locked) {
    return '<div><label class="block text-xs font-medium text-slate-600 mb-1">' + esc(label) + "</label>" +
      '<select data-f="' + id + '" ' + (locked ? "disabled" : "") + ' class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">' +
      '<option value="">—</option>' + opts.map((o) => '<option ' + (o === val ? "selected" : "") + ">" + esc(o) + "</option>").join("") +
      "</select></div>";
  }

  function collectIdea(n) {
    const root = document.querySelector('[data-idea="' + n + '"]');
    const obj = {};
    root.querySelectorAll("[data-f]").forEach((el) => (obj[el.dataset.f] = el.value.trim() || null));
    const id = root.querySelector(".idea-id").value;
    return { id: id || null, obj };
  }

  async function saveIdea(proj, n) {
    const { id, obj } = collectIdea(n);
    const hasContent = Object.keys(obj).some((k) => obj[k]);
    if (!id && !hasContent) return toast("Fill in the idea before saving.", "warn");
    try {
      if (id) {
        await guard(sb.from("ideas").update(obj).eq("id", id), "Idea saved.");
      } else {
        // .select() returns the new row so the slot immediately owns an id (no duplicate inserts)
        await guard(sb.from("ideas").insert(Object.assign({ project_id: proj.id, learner_id: ME.id }, obj)).select(), "Idea saved.");
      }
      if (proj.status === "not_started")
        await sb.rpc("change_project_status", { _project: proj.id, _new: "ideas_in_progress" }).then(() => {}, () => {});
      if (!obj.title) toast("Saved as a draft — add a title before you can submit.", "warn");
      viewIdeas();
    } catch (_) {}
  }

  async function deleteIdea(proj, id) {
    if (!confirm("Delete this idea? This cannot be undone.")) return;
    try {
      await guard(sb.from("ideas").delete().eq("id", id), "Idea deleted.");
      // if this project was already submitted and now has fewer than 3 complete ideas, reopen for editing
      if (["ideas_submitted", "ideas_under_review"].includes(proj.status)) {
        const { data: left } = await sb.from("ideas").select("id,title").eq("project_id", proj.id);
        if ((left || []).filter((i) => i.title).length < 3)
          await sb.rpc("change_project_status", { _project: proj.id, _new: "ideas_in_progress", _reason: "Idea deleted by learner" }).then(() => {}, () => {});
      }
      viewIdeas();
    } catch (_) {}
  }

  async function withdrawIdeas(proj) {
    if (!confirm("Withdraw your submitted ideas so you can edit them again?")) return;
    try {
      await guard(sb.rpc("change_project_status", { _project: proj.id, _new: "ideas_in_progress", _reason: "Withdrawn by learner" }));
      await sb.from("ideas").update({ submitted: false }).eq("project_id", proj.id);
      toast("Ideas reopened for editing.");
      viewIdeas();
    } catch (_) {}
  }

  async function submitIdeas(proj) {
    const { data: ideas } = await sb.from("ideas").select("id,title").eq("project_id", proj.id);
    const filled = (ideas || []).filter((i) => i.title);
    if (filled.length < 3) return toast("You have " + filled.length + " of 3 ideas saved. Save all three (each needs a title) before submitting.", "warn");
    if (!confirm("Submit all three ideas for review? You can still withdraw them later if you need to make changes.")) return;
    try {
      await sb.from("ideas").update({ submitted: true }).eq("project_id", proj.id);
      await guard(sb.rpc("change_project_status", { _project: proj.id, _new: "ideas_submitted" }));
      toast("Ideas submitted for review.");
      viewIdeas();
    } catch (_) {}
  }

  // =====================================================================
  //  LEARNER: scope
  // =====================================================================
  async function viewScope() {
    busy();
    const proj = await learnerProject();
    if (!proj) return chrome(card("Scope", "<p>Project not ready.</p>"));
    if (STATUS_ORDER.indexOf(proj.status) < STATUS_ORDER.indexOf("project_selected")) {
      return chrome(card("Project scope",
        '<p class="text-slate-600">You can complete your scope once an idea has been selected. Current status: ' + pretty(proj.status) + "</p>"));
    }
    let { data: scope } = await sb.from("scopes").select("*").eq("project_id", proj.id).maybeSingle();
    scope = scope || {};
    const locked = ["scope_submitted", "scope_approved", "building", "testing", "project_submitted", "approved"].includes(proj.status);

    chrome(
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Project scope</h2>' + statusPill(proj.status) + "</div>" +
      (locked ? '<div class="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-lg">Scope is locked (submitted or approved).</div>' : "") +
      card("", '<div class="grid gap-3 md:grid-cols-2" id="scope-form">' +
        SCOPE_FIELDS.map(([f, lbl]) => fieldTa(f, lbl, scope[f], locked)).join("") + "</div>") +
      (locked ? "" :
        '<div class="mt-4 flex gap-2">' +
          '<button id="save-scope" class="bg-slate-800 text-white rounded-lg px-4 py-2">Save draft</button>' +
          '<button id="submit-scope" class="bg-brand hover:bg-brand-dark text-white rounded-lg px-4 py-2">Submit scope for approval</button>' +
        "</div>")
    );
    if (!locked) {
      $("#save-scope").onclick = () => saveScope(proj, false);
      $("#submit-scope").onclick = () => saveScope(proj, true);
    }
  }

  async function saveScope(proj, submit) {
    const obj = {};
    document.querySelectorAll("#scope-form [data-f]").forEach((el) => (obj[el.dataset.f] = el.value.trim() || null));
    obj.project_id = proj.id;
    try {
      await guard(sb.from("scopes").upsert(obj, { onConflict: "project_id" }), submit ? null : "Scope saved.");
      if (STATUS_ORDER.indexOf(proj.status) < STATUS_ORDER.indexOf("scope_in_progress"))
        await sb.rpc("change_project_status", { _project: proj.id, _new: "scope_in_progress" }).then(() => {}, () => {});
      if (submit) {
        if (!confirm("Submit your scope for approval?")) return;
        await sb.from("scopes").update({ status: "submitted" }).eq("project_id", proj.id);
        await guard(sb.rpc("change_project_status", { _project: proj.id, _new: "scope_submitted" }));
        toast("Scope submitted.");
      }
      viewScope();
    } catch (_) {}
  }

  // =====================================================================
  //  PROJECT detail (shared) — updates, comments, final submission
  // =====================================================================
  async function viewProject(projectId) {
    busy();
    let proj;
    if (projectId) proj = (await sb.from("projects").select("*").eq("id", projectId).maybeSingle()).data;
    else proj = await learnerProject();
    if (!proj) return chrome(card("Project", "<p>Not found or no access.</p>"));

    const learner = (await sb.from("profiles").select("full_name,email").eq("id", proj.learner_id).maybeSingle()).data || {};
    const isLearner = ME.id === proj.learner_id;
    const canSupervise = ME.role === "superadmin" || (ME.role === "admin");
    const [updRes, comRes, finRes, histRes] = await Promise.all([
      sb.from("project_updates").select("*").eq("project_id", proj.id).order("created_at", { ascending: false }),
      sb.from("comments").select("*").eq("project_id", proj.id).order("created_at"),
      sb.from("final_submissions").select("*").eq("project_id", proj.id).maybeSingle(),
      sb.from("status_history").select("*").eq("project_id", proj.id).order("created_at", { ascending: false })
    ]);
    const updates = updRes.data || [], comments = comRes.data || [], fin = finRes.data, hist = histRes.data || [];

    const canBuild = STATUS_ORDER.indexOf(proj.status) >= STATUS_ORDER.indexOf("building");
    const finLocked = fin && fin.locked;

    chrome(
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-4">' +
        "<div><h2 class=\"text-xl font-bold\">" + esc(proj.title || "Project") + "</h2>" +
        '<div class="text-sm text-slate-500">' + esc(learner.full_name || learner.email || "") + "</div></div>" +
        statusPill(proj.status) +
      "</div>" +
      '<div class="grid gap-4 md:grid-cols-3">' +
        '<div class="md:col-span-2 space-y-4">' +
          // progress updates
          card("Progress updates",
            (isLearner && canBuild
              ? '<div class="grid gap-2 mb-3" id="upd-form">' +
                  ta("u_completed", "What was completed", "") + ta("u_working_on", "Working on now", "") +
                  ta("u_blocker", "Current blocker", "") + ta("u_help", "Help required", "") +
                  ta("u_next", "Next step", "") + input2("u_link", "Optional link") +
                  '<button id="add-upd" class="bg-slate-800 text-white rounded-lg px-3 py-1.5 text-sm w-max">Post update</button>' +
                "</div>"
              : "") +
            (updates.length
              ? updates.map((u) =>
                  '<div class="border-l-2 border-slate-200 pl-3 mb-3 text-sm">' +
                  '<div class="text-xs text-slate-400">' + fmtDateTime(u.created_at) + "</div>" +
                  (u.completed ? "<div><b>Done:</b> " + nl2br(u.completed) + "</div>" : "") +
                  (u.working_on ? "<div><b>Now:</b> " + nl2br(u.working_on) + "</div>" : "") +
                  (u.blocker ? '<div class="text-amber-700"><b>Blocker:</b> ' + nl2br(u.blocker) + "</div>" : "") +
                  (u.next_step ? "<div><b>Next:</b> " + nl2br(u.next_step) + "</div>" : "") +
                  (u.link ? '<a href="' + esc(u.link) + '" target="_blank" class="text-brand">link</a>' : "") +
                  "</div>").join("")
              : '<p class="text-sm text-slate-500">No updates yet.</p>')) +
          // comments
          card("Comments & feedback",
            '<div class="space-y-3 mb-3">' +
              (comments.length ? comments.map(commentHtml).join("")
                : '<p class="text-sm text-slate-500">No comments yet.</p>') +
            "</div>" +
            '<div class="border-t pt-3">' +
              '<div class="flex gap-2 mb-2">' +
                '<select id="c_type" class="border rounded-lg px-2 py-1.5 text-sm">' +
                  ['general','feedback','question'].concat(canSupervise ? ['decision'] : [])
                    .map((t) => "<option value=\"" + t + "\">" + pretty(t) + "</option>").join("") +
                "</select></div>" +
              '<textarea id="c_body" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Write a comment…"></textarea>' +
              '<button id="add-com" class="mt-2 bg-brand text-white rounded-lg px-3 py-1.5 text-sm">Post comment</button>' +
            "</div>") +
          // final submission
          card("Final project submission",
            (STATUS_ORDER.indexOf(proj.status) >= STATUS_ORDER.indexOf("testing") || fin
              ? '<div class="grid gap-3 md:grid-cols-2" id="final-form">' +
                  FINAL_FIELDS.map(([f, lbl]) => fieldTa(f, lbl, fin ? fin[f] : "", finLocked || !isLearner)).join("") + "</div>" +
                (isLearner && !finLocked
                  ? '<div class="mt-3 flex gap-2"><button id="save-final" class="bg-slate-800 text-white rounded-lg px-3 py-1.5 text-sm">Save draft</button>' +
                    '<button id="submit-final" class="bg-brand text-white rounded-lg px-3 py-1.5 text-sm">Submit final project</button></div>'
                  : finLocked ? '<div class="mt-3 p-2 bg-amber-50 text-amber-800 text-xs rounded">Locked while under review.</div>' : "")
              : '<p class="text-sm text-slate-500">Available once you reach the testing stage.</p>')) +
        "</div>" +
        // right column
        '<div class="space-y-4">' +
          (canSupervise && !isLearner ? supervisorPanel(proj) : "") +
          card("Status history",
            hist.length ? hist.map((h) =>
              '<div class="text-xs mb-2"><div>' + statusPill(h.new_status) + "</div>" +
              '<div class="text-slate-400">from ' + pretty(h.previous_status) + " · " + fmtDateTime(h.created_at) + "</div>" +
              (h.reason ? '<div class="text-slate-500">' + esc(h.reason) + "</div>" : "") + "</div>").join("")
              : '<p class="text-sm text-slate-500">No changes yet.</p>') +
        "</div>" +
      "</div>"
    );

    // handlers
    const au = $("#add-upd");
    if (au) au.onclick = async () => {
      const g = (id) => ($("#" + id) ? $("#" + id).value.trim() || null : null);
      await guard(sb.from("project_updates").insert({
        project_id: proj.id, author_id: ME.id, completed: g("u_completed"), working_on: g("u_working_on"),
        blocker: g("u_blocker"), help_needed: g("u_help"), next_step: g("u_next"), link: g("u_link")
      }), "Update posted.");
      viewProject(projectId);
    };
    $("#add-com").onclick = async () => {
      const body = $("#c_body").value.trim();
      if (!body) return;
      await guard(sb.from("comments").insert({ project_id: proj.id, author_id: ME.id, body, ctype: $("#c_type").value }), "Comment posted.");
      viewProject(projectId);
    };
    const sf = $("#save-final"), suf = $("#submit-final");
    if (sf) sf.onclick = () => saveFinal(proj, false, projectId);
    if (suf) suf.onclick = () => saveFinal(proj, true, projectId);
    bindSupervisor(proj, projectId);
  }

  function input2(id, ph) {
    return '<input id="' + id + '" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="' + esc(ph) + '">';
  }
  function commentHtml(c) {
    const tag = c.ctype === "decision" ? '<span class="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Decision</span>'
      : c.ctype === "feedback" ? '<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Feedback</span>'
      : c.ctype === "question" ? '<span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Question</span>' : "";
    return '<div class="bg-slate-50 rounded-lg p-3 text-sm"><div class="flex items-center gap-2 mb-1">' + tag +
      '<span class="text-xs text-slate-400 ml-auto">' + fmtDateTime(c.created_at) + "</span></div>" + nl2br(c.body) + "</div>";
  }

  async function saveFinal(proj, submit, projectId) {
    const obj = { project_id: proj.id };
    document.querySelectorAll("#final-form [data-f]").forEach((el) => (obj[el.dataset.f] = el.value.trim() || null));
    try {
      await guard(sb.from("final_submissions").upsert(obj, { onConflict: "project_id" }), submit ? null : "Draft saved.");
      if (submit) {
        if (!confirm("Submit your final project for review? It will be locked while reviewed.")) return;
        await sb.from("final_submissions").update({ locked: true }).eq("project_id", proj.id);
        await guard(sb.rpc("change_project_status", { _project: proj.id, _new: "project_submitted" }));
        toast("Final project submitted.");
      }
      viewProject(projectId);
    } catch (_) {}
  }

  // ---------- supervisor controls on a project ----------
  function supervisorPanel(proj) {
    const nexts = allowedNext(proj.status);
    return card("Supervisor actions",
      '<label class="block text-xs text-slate-500 mb-1">Move status to</label>' +
      '<select id="sv_status" class="w-full border rounded-lg px-2 py-1.5 text-sm mb-2">' +
        nexts.map((s) => "<option value=\"" + s + "\">" + pretty(s) + "</option>").join("") +
      "</select>" +
      '<input id="sv_reason" class="w-full border rounded-lg px-2 py-1.5 text-sm mb-2" placeholder="Reason (optional)">' +
      '<button id="sv_apply" class="w-full bg-brand text-white rounded-lg py-1.5 text-sm mb-3">Apply status change</button>' +
      '<a href="#/evaluate/' + proj.id + '" class="block text-center border rounded-lg py-1.5 text-sm text-brand">Open evaluation rubric</a>'
    );
  }
  function allowedNext(cur) {
    const base = {
      ideas_submitted: ["ideas_under_review", "project_selected", "changes_requested"],
      ideas_under_review: ["changes_requested", "project_selected"],
      scope_submitted: ["scope_approved", "changes_requested"],
      scope_approved: ["building"],
      building: ["testing"],
      testing: ["project_submitted"],
      project_submitted: ["approved", "final_changes_requested"],
      final_changes_requested: ["project_submitted"]
    }[cur] || [];
    const opts = base.concat(["on_hold", "withdrawn"]);
    // superadmin can jump anywhere
    if (ME.role === "superadmin") return STATUS_ORDER.concat(["on_hold", "withdrawn", "archived"]);
    return opts.length ? opts : ["on_hold", "withdrawn"];
  }
  function bindSupervisor(proj, projectId) {
    const b = $("#sv_apply");
    if (!b) return;
    b.onclick = async () => {
      const ns = $("#sv_status").value, reason = $("#sv_reason").value.trim() || null;
      if (proj.status === "ideas_under_review" && ns === "project_selected") {
        toast("Select the winning idea from the review screen.", "warn");
      }
      try {
        await guard(sb.rpc("change_project_status", { _project: proj.id, _new: ns, _reason: reason }), "Status updated.");
        viewProject(projectId);
      } catch (_) {}
    };
  }

  // =====================================================================
  //  ADMIN: my learners
  // =====================================================================
  async function viewAdminLearners() {
    busy();
    const { data: learners } = await sb.from("profiles").select("*").eq("supervisor_id", ME.id).eq("role", "learner");
    const ids = (learners || []).map((l) => l.id);
    let projects = [];
    if (ids.length) projects = (await sb.from("projects").select("*").in("learner_id", ids)).data || [];
    const byLearner = {};
    projects.forEach((p) => (byLearner[p.learner_id] = p));

    const queueIdeas = projects.filter((p) => p.status === "ideas_under_review" || p.status === "ideas_submitted").length;
    const queueScope = projects.filter((p) => p.status === "scope_submitted").length;
    const queueFinal = projects.filter((p) => p.status === "project_submitted").length;

    const rows = (learners || []).map((l) => {
      const p = byLearner[l.id];
      const status = p ? p.status : "not_started";
      const waiting = /submitted|under_review/.test(status) ? "You" : /changes/.test(status) ? "Learner" : "—";
      return '<tr class="border-b hover:bg-slate-50">' +
        '<td class="py-2 px-3">' + esc(l.full_name || l.email) + "</td>" +
        '<td class="px-3">' + statusPill(status) + "</td>" +
        '<td class="px-3 text-sm">' + esc(waiting) + "</td>" +
        '<td class="px-3 text-right">' + (p ? '<a href="#/review/' + p.id + '" class="text-brand text-sm">Open</a>' : '<span class="text-slate-400 text-sm">—</span>') + "</td>" +
        "</tr>";
    }).join("");

    chrome(
      '<h2 class="text-xl font-bold mb-4">My learners</h2>' +
      '<div class="grid grid-cols-3 gap-3 mb-4">' +
        stat("Ideas to review", queueIdeas, "text-amber-600") +
        stat("Scopes to approve", queueScope, "text-amber-600") +
        stat("Final reviews", queueFinal, "text-amber-600") +
      "</div>" +
      card("", (learners && learners.length)
        ? '<table class="w-full text-left"><thead><tr class="text-xs text-slate-400 border-b">' +
          '<th class="py-2 px-3">Learner</th><th class="px-3">Status</th><th class="px-3">Waiting on</th><th class="px-3"></th></tr></thead><tbody>' +
          rows + "</tbody></table>"
        : '<p class="text-slate-500">No learners assigned to you yet.</p>')
    );
  }

  // =====================================================================
  //  ADMIN/SUPER: review a project (ideas + scope + select + evaluate)
  // =====================================================================
  async function viewReview(projectId) {
    busy();
    const proj = (await sb.from("projects").select("*").eq("id", projectId).maybeSingle()).data;
    if (!proj) return chrome(card("Review", "<p>Not found.</p>"));
    const learner = (await sb.from("profiles").select("full_name,email").eq("id", proj.learner_id).maybeSingle()).data || {};
    const [ideasRes, scopeRes] = await Promise.all([
      sb.from("ideas").select("*").eq("project_id", proj.id).order("created_at"),
      sb.from("scopes").select("*").eq("project_id", proj.id).maybeSingle()
    ]);
    const ideas = ideasRes.data || [], scope = scopeRes.data;

    const ideaCards = ideas.map((i, n) =>
      '<div class="border rounded-lg p-4 mb-3">' +
        '<div class="flex items-center justify-between mb-2"><h4 class="font-semibold">Idea ' + (n + 1) + ": " + esc(i.title || "Untitled") + "</h4>" +
          '<div class="flex items-center gap-2">' +
          (i.is_selected ? '<span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Selected</span>'
            : '<button class="select-idea text-xs bg-brand text-white px-2 py-1 rounded" data-id="' + i.id + '">Select this idea</button>') +
          '<button class="del-idea-admin text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded" data-id="' + i.id + '">Delete</button>' +
          "</div>" +
        "</div>" +
        '<div class="grid gap-2 md:grid-cols-2 text-sm">' +
          IDEA_FIELDS.filter(([f]) => f !== "title").map(([f, lbl]) =>
            '<div><span class="text-xs text-slate-400">' + esc(lbl) + '</span><div>' + (i[f] ? nl2br(i[f]) : "—") + "</div></div>").join("") +
          '<div><span class="text-xs text-slate-400">Category</span><div>' + esc(i.category || "—") + "</div></div>" +
        "</div>" +
      "</div>").join("");

    const scopeHtml = scope
      ? '<div class="grid gap-2 md:grid-cols-2 text-sm">' +
          SCOPE_FIELDS.map(([f, lbl]) => '<div><span class="text-xs text-slate-400">' + esc(lbl) + '</span><div>' + (scope[f] ? nl2br(scope[f]) : "—") + "</div></div>").join("") +
        "</div>"
      : '<p class="text-slate-500 text-sm">No scope submitted yet.</p>';

    chrome(
      '<div class="flex items-center justify-between mb-4"><div><h2 class="text-xl font-bold">Review · ' +
        esc(learner.full_name || learner.email) + "</h2>" + statusPill(proj.status) + "</div>" +
        '<a href="#/project/' + proj.id + '" class="text-brand text-sm">Full project view →</a></div>' +
      card("Submitted ideas", ideaCards || '<p class="text-slate-500 text-sm">No ideas.</p>') +
      card("Project scope", scopeHtml) +
      card("Approve / move project", approvalButtons(proj) + supervisorRowActions(proj))
    );

    document.querySelectorAll(".select-idea").forEach((b) => (b.onclick = () => selectIdea(proj, b.dataset.id)));
    document.querySelectorAll(".del-idea-admin").forEach((b) => (b.onclick = () => deleteIdeaAdmin(proj, b.dataset.id)));
    document.querySelectorAll(".quick-status").forEach((b) => (b.onclick = () => quickStatus(proj, b.dataset.status, b.dataset.reasonprompt === "1")));
    bindReviewActions(proj);
  }

  function approvalButtons(proj) {
    const s = proj.status;
    let btns = [];
    if (["ideas_submitted", "ideas_under_review"].includes(s)) {
      btns.push(qbtn("changes_requested", "Request changes to ideas", "amber", true));
    } else if (s === "scope_submitted") {
      btns.push(qbtn("scope_approved", "Approve scope", "green", false));
      btns.push(qbtn("changes_requested", "Request scope changes", "amber", true));
    } else if (s === "scope_approved") {
      btns.push(qbtn("building", "Move to Building", "green", false));
    } else if (s === "project_submitted") {
      btns.push(qbtn("approved", "Approve project", "green", false));
      btns.push(qbtn("final_changes_requested", "Request final changes", "amber", true));
    }
    if (!btns.length) return "";
    return '<div class="flex flex-wrap gap-2 mb-3">' + btns.join("") +
      '<span class="w-full text-xs text-slate-400">To select the winning idea, use the "Select this idea" button on an idea above.</span></div>';
  }
  function qbtn(status, label, color, reasonPrompt) {
    const cls = color === "green" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600";
    return '<button class="quick-status text-white rounded-lg px-3 py-1.5 text-sm ' + cls + '" data-status="' + status + '" data-reasonprompt="' + (reasonPrompt ? "1" : "0") + '">' + esc(label) + "</button>";
  }
  async function quickStatus(proj, status, reasonPrompt) {
    let reason = null;
    if (reasonPrompt) {
      reason = prompt("What changes are needed? (this is shown to the learner)");
      if (reason === null) return; // cancelled
    }
    try {
      await guard(sb.rpc("change_project_status", { _project: proj.id, _new: status, _reason: reason || null }), "Updated.");
      if (reason) await sb.from("comments").insert({ project_id: proj.id, author_id: ME.id, body: reason, ctype: "decision" });
      viewReview(proj.id);
    } catch (_) {}
  }
  async function deleteIdeaAdmin(proj, id) {
    if (!confirm("Delete this idea from the learner's submission? This cannot be undone.")) return;
    try {
      await guard(sb.from("ideas").delete().eq("id", id), "Idea deleted.");
      viewReview(proj.id);
    } catch (_) {}
  }

  function supervisorRowActions(proj) {
    const nexts = allowedNext(proj.status);
    return '<div class="flex flex-wrap gap-2 items-center">' +
      '<select id="rv_status" class="border rounded-lg px-2 py-1.5 text-sm">' +
        nexts.map((s) => "<option value=\"" + s + "\">" + pretty(s) + "</option>").join("") + "</select>" +
      '<input id="rv_reason" class="border rounded-lg px-2 py-1.5 text-sm flex-1" placeholder="Reason (optional)">' +
      '<button id="rv_apply" class="bg-brand text-white rounded-lg px-3 py-1.5 text-sm">Apply</button>' +
      '<a href="#/evaluate/' + proj.id + '" class="border rounded-lg px-3 py-1.5 text-sm text-brand">Evaluate</a>' +
      "</div>";
  }
  function bindReviewActions(proj) {
    $("#rv_apply").onclick = async () => {
      try {
        await guard(sb.rpc("change_project_status", { _project: proj.id, _new: $("#rv_status").value, _reason: $("#rv_reason").value.trim() || null }), "Updated.");
        viewReview(proj.id);
      } catch (_) {}
    };
  }
  async function selectIdea(proj, ideaId) {
    if (!confirm("Select this idea as the learner's active project?")) return;
    try {
      await sb.from("ideas").update({ is_selected: false }).eq("project_id", proj.id);
      await sb.from("ideas").update({ is_selected: true }).eq("id", ideaId);
      const idea = (await sb.from("ideas").select("title,category").eq("id", ideaId).maybeSingle()).data;
      await sb.from("projects").update({ selected_idea_id: ideaId, title: idea.title, category: idea.category }).eq("id", proj.id);
      await guard(sb.rpc("change_project_status", { _project: proj.id, _new: "project_selected", _reason: "Idea selected" }));
      await sb.from("comments").insert({ project_id: proj.id, author_id: ME.id, body: "Idea selected: " + (idea.title || ""), ctype: "decision" });
      toast("Idea selected.");
      viewReview(proj.id);
    } catch (_) {}
  }

  // =====================================================================
  //  EVALUATION rubric
  // =====================================================================
  async function viewEvaluate(projectId) {
    busy();
    const proj = (await sb.from("projects").select("*").eq("id", projectId).maybeSingle()).data;
    if (!proj) return chrome(card("Evaluate", "<p>Not found.</p>"));
    const ev = (await sb.from("evaluations").select("*").eq("project_id", projectId).maybeSingle()).data || { scores: {} };
    const criteria = (SETTINGS.rubric_criteria || "").split("|").filter(Boolean);

    chrome(
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Evaluation rubric</h2>' +
        '<a href="#/review/' + projectId + '" class="text-brand text-sm">← Back to review</a></div>' +
      card("Criteria",
        '<div id="rubric" class="space-y-3">' +
          criteria.map((c) =>
            '<div class="flex items-center justify-between gap-3"><span class="text-sm">' + esc(c) + "</span>" +
            '<select data-crit="' + esc(c) + '" class="border rounded-lg px-2 py-1.5 text-sm">' +
              '<option value="">—</option>' +
              RATINGS.map((r) => '<option ' + ((ev.scores || {})[c] === r ? "selected" : "") + ">" + esc(r) + "</option>").join("") +
            "</select></div>").join("") +
        "</div>") +
      card("Decision & feedback",
        ta("ev_feedback", "Overall feedback", ev.overall_feedback) +
        ta("ev_changes", "Required changes", ev.required_changes) +
        '<div class="grid md:grid-cols-2 gap-3 mt-2">' +
          '<div><label class="block text-sm text-slate-600 mb-1">Final decision</label>' +
            '<select id="ev_decision" class="w-full border rounded-lg px-3 py-2 text-sm">' +
              ["", "approved", "changes", "rejected"].map((d) => '<option value="' + d + '" ' + (ev.decision === d ? "selected" : "") + ">" + (d ? pretty(d) : "—") + "</option>").join("") +
            "</select></div>" +
          '<div class="flex items-end"><label class="flex items-center gap-2 text-sm"><input type="checkbox" id="ev_showcase" ' + (ev.showcase ? "checked" : "") + "> Recommend for showcase</label></div>" +
        "</div>" +
        '<button id="ev_save" class="mt-3 bg-brand text-white rounded-lg px-4 py-2 text-sm">Save evaluation</button>')
    );

    $("#ev_save").onclick = async () => {
      const scores = {};
      document.querySelectorAll("#rubric [data-crit]").forEach((s) => { if (s.value) scores[s.dataset.crit] = s.value; });
      await guard(sb.from("evaluations").upsert({
        project_id: projectId, evaluator_id: ME.id, scores,
        overall_feedback: $("#ev_feedback").value.trim() || null,
        required_changes: $("#ev_changes").value.trim() || null,
        decision: $("#ev_decision").value || null, showcase: $("#ev_showcase").checked,
        updated_at: new Date().toISOString()
      }, { onConflict: "project_id" }), "Evaluation saved.");
    };
  }

  // =====================================================================
  //  SUPERADMIN: users
  // =====================================================================
  async function viewUsers() {
    busy();
    const [profRes, invRes] = await Promise.all([
      sb.from("profiles").select("*").order("created_at", { ascending: false }),
      sb.from("invitations").select("*").is("accepted_at", null).order("created_at", { ascending: false })
    ]);
    const profiles = profRes.data || [], invites = invRes.data || [];
    const admins = profiles.filter((p) => p.role === "admin");
    const nameOf = (id) => { const p = profiles.find((x) => x.id === id); return p ? p.full_name || p.email : "—"; };

    const rows = profiles.map((p) =>
      '<tr class="border-b hover:bg-slate-50 text-sm">' +
        '<td class="py-2 px-3">' + esc(p.full_name || "—") + '<div class="text-xs text-slate-400">' + esc(p.email) + "</div></td>" +
        '<td class="px-3">' + roleSelect(p) + "</td>" +
        '<td class="px-3">' + (p.role === "learner" ? supSelect(p, admins) : "—") + "</td>" +
        '<td class="px-3 text-xs">' + fmtDate(p.last_login) + "</td>" +
        '<td class="px-3">' + (p.active ? '<span class="text-emerald-600 text-xs">Active</span>' : '<span class="text-red-500 text-xs">Inactive</span>') + "</td>" +
        '<td class="px-3 text-right"><button class="toggle-active text-xs text-slate-500 hover:text-red-600" data-id="' + p.id + '" data-active="' + p.active + '">' +
          (p.active ? "Deactivate" : "Reactivate") + "</button></td>" +
      "</tr>").join("");

    const invRows = invites.map((i) =>
      '<tr class="border-b text-sm"><td class="py-2 px-3">' + esc(i.email) + "</td><td class=\"px-3\">" + pretty(i.role) + "</td>" +
      '<td class="px-3 text-xs">' + (i.supervisor_id ? esc(nameOf(i.supervisor_id)) : "—") + "</td>" +
      '<td class="px-3 text-xs text-slate-400">Pending — user must create password</td></tr>').join("");

    chrome(
      '<h2 class="text-xl font-bold mb-4">Users</h2>' +
      '<div class="grid gap-4 md:grid-cols-3">' +
        '<div class="md:col-span-2 space-y-4">' +
          card("All users",
            '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="text-xs text-slate-400 border-b">' +
            '<th class="py-2 px-3">User</th><th class="px-3">Role</th><th class="px-3">Supervisor</th><th class="px-3">Last login</th><th class="px-3">State</th><th></th>' +
            "</tr></thead><tbody>" + rows + "</tbody></table></div>") +
          (invites.length ? card("Pending invitations",
            '<table class="w-full text-left"><thead><tr class="text-xs text-slate-400 border-b"><th class="py-2 px-3">Email</th><th class="px-3">Role</th><th class="px-3">Supervisor</th><th class="px-3">Status</th></tr></thead><tbody>' +
            invRows + "</tbody></table>") : "") +
        "</div>" +
        '<div>' + card("Invite a user",
          '<div class="space-y-2">' +
            input("i_name", "text", "Full name", false) +
            input("i_email", "email", "Email", true) +
            '<div><label class="block text-sm text-slate-600 mb-1">Role</label><select id="i_role" class="w-full border rounded-lg px-3 py-2 text-sm">' +
              '<option value="learner">Learner</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></div>' +
            '<div id="i_sup_wrap"><label class="block text-sm text-slate-600 mb-1">Supervisor (for learners)</label>' +
              '<select id="i_sup" class="w-full border rounded-lg px-3 py-2 text-sm"><option value="">—</option>' +
              admins.map((a) => '<option value="' + a.id + '">' + esc(a.full_name || a.email) + "</option>").join("") + "</select></div>" +
            input("i_team", "text", "Team (optional)", false) +
            '<button id="i_create" class="w-full bg-brand text-white rounded-lg py-2 text-sm">Create invitation</button>' +
            '<p class="text-xs text-slate-400">The person then goes to the portal → "First time? Create your password" using this exact email.</p>' +
          "</div>") + "</div>" +
      "</div>"
    );

    document.querySelectorAll(".role-select").forEach((s) => (s.onchange = async () => {
      await guard(sb.from("profiles").update({ role: s.value }).eq("id", s.dataset.id), "Role updated.");
      viewUsers();
    }));
    document.querySelectorAll(".sup-select").forEach((s) => (s.onchange = async () => {
      await guard(sb.from("profiles").update({ supervisor_id: s.value || null }).eq("id", s.dataset.id), "Supervisor updated.");
    }));
    document.querySelectorAll(".toggle-active").forEach((b) => (b.onclick = async () => {
      await guard(sb.from("profiles").update({ active: b.dataset.active !== "true" }).eq("id", b.dataset.id), "Updated.");
      viewUsers();
    }));
    $("#i_create").onclick = createInvite;
  }
  function roleSelect(p) {
    return '<select class="role-select border rounded px-2 py-1 text-xs" data-id="' + p.id + '">' +
      ["learner", "admin", "superadmin"].map((r) => '<option value="' + r + '" ' + (p.role === r ? "selected" : "") + ">" + pretty(r) + "</option>").join("") + "</select>";
  }
  function supSelect(p, admins) {
    return '<select class="sup-select border rounded px-2 py-1 text-xs" data-id="' + p.id + '"><option value="">—</option>' +
      admins.map((a) => '<option value="' + a.id + '" ' + (p.supervisor_id === a.id ? "selected" : "") + ">" + esc(a.full_name || a.email) + "</option>").join("") + "</select>";
  }
  async function createInvite() {
    const email = $("#i_email").value.trim();
    if (!email) return toast("Email required", "warn");
    const row = {
      email, full_name: $("#i_name").value.trim() || null, role: $("#i_role").value,
      supervisor_id: $("#i_role").value === "learner" ? ($("#i_sup").value || null) : null,
      team: $("#i_team").value.trim() || null, created_by: ME.id
    };
    await guard(sb.from("invitations").insert(row), "Invitation created for " + email);
    viewUsers();
  }

  // =====================================================================
  //  SUPERADMIN: programme overview
  // =====================================================================
  async function viewProgram() {
    busy();
    const [projRes, profRes] = await Promise.all([
      sb.from("projects").select("*"),
      sb.from("profiles").select("id,full_name,email,role,supervisor_id,active")
    ]);
    const projects = projRes.data || [], profiles = profRes.data || [];
    const learners = profiles.filter((p) => p.role === "learner");
    const nameOf = (id) => { const p = profiles.find((x) => x.id === id); return p ? p.full_name || p.email : "—"; };
    const count = (fn) => projects.filter(fn).length;

    const dist = {};
    projects.forEach((p) => (dist[p.status] = (dist[p.status] || 0) + 1));
    const distHtml = STATUS_ORDER.concat(["on_hold", "withdrawn", "archived"]).filter((s) => dist[s])
      .map((s) => '<div class="flex items-center gap-2 text-sm mb-1">' + statusPill(s) +
        '<div class="flex-1 bg-slate-100 rounded-full h-2"><div class="bg-brand h-2 rounded-full" style="width:' +
        Math.round((dist[s] / Math.max(projects.length, 1)) * 100) + '%"></div></div><span class="text-xs text-slate-500">' + dist[s] + "</span></div>").join("");

    const rows = learners.map((l) => {
      const p = projects.find((x) => x.learner_id === l.id);
      return '<tr class="border-b text-sm hover:bg-slate-50"><td class="py-2 px-3">' + esc(l.full_name || l.email) + "</td>" +
        '<td class="px-3">' + esc(nameOf(l.supervisor_id)) + "</td>" +
        '<td class="px-3">' + statusPill(p ? p.status : "not_started") + "</td>" +
        '<td class="px-3 text-right">' + (p ? '<a href="#/project/' + p.id + '" class="text-brand">Open</a>' : "—") + "</td></tr>";
    }).join("");

    chrome(
      '<h2 class="text-xl font-bold mb-4">Programme overview</h2>' +
      '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">' +
        stat("Total learners", learners.length) +
        stat("Not started", count((p) => p.status === "not_started"), "text-slate-500") +
        stat("Building", count((p) => p.status === "building"), "text-indigo-600") +
        stat("Submitted", count((p) => p.status === "project_submitted"), "text-amber-600") +
        stat("Approved", count((p) => p.status === "approved"), "text-emerald-600") +
      "</div>" +
      '<div class="grid gap-4 md:grid-cols-2">' +
        card("Status distribution", distHtml || '<p class="text-sm text-slate-500">No projects yet.</p>') +
        card("Waiting for review",
          '<div class="text-sm space-y-1">' +
            '<div class="flex justify-between"><span>Ideas under review</span><b>' + count((p) => p.status === "ideas_under_review" || p.status === "ideas_submitted") + "</b></div>" +
            '<div class="flex justify-between"><span>Scopes to approve</span><b>' + count((p) => p.status === "scope_submitted") + "</b></div>" +
            '<div class="flex justify-between"><span>Final reviews</span><b>' + count((p) => p.status === "project_submitted") + "</b></div>" +
          "</div>") +
      "</div>" +
      card("Progress by learner",
        '<div class="overflow-x-auto"><table class="w-full text-left"><thead><tr class="text-xs text-slate-400 border-b">' +
        '<th class="py-2 px-3">Learner</th><th class="px-3">Supervisor</th><th class="px-3">Status</th><th></th></tr></thead><tbody>' + rows + "</tbody></table></div>")
    );
  }

  // =====================================================================
  //  SUPERADMIN: settings (deadlines, categories, announcements)
  // =====================================================================
  async function viewSettings() {
    busy();
    await loadRefData();
    const ann = (await sb.from("announcements").select("*").order("created_at", { ascending: false })).data || [];
    const dl = [
      ["deadline_ideas_due", "Three ideas due"], ["deadline_idea_selection_due", "Idea selection due"],
      ["deadline_scope_due", "Scope due"], ["deadline_scope_approval_due", "Scope approval due"],
      ["deadline_submission_due", "Project submission due"], ["deadline_final_review_due", "Final review due"]
    ];
    chrome(
      '<h2 class="text-xl font-bold mb-4">Settings</h2>' +
      '<div class="grid gap-4 md:grid-cols-2">' +
        card("Programme deadlines",
          '<div class="space-y-2" id="dl">' + dl.map(([k, l]) =>
            '<div class="flex items-center justify-between gap-2"><label class="text-sm">' + esc(l) + "</label>" +
            '<input type="date" data-key="' + k + '" value="' + esc(SETTINGS[k] || "") + '" class="border rounded-lg px-2 py-1 text-sm"></div>').join("") +
          '</div><button id="save-dl" class="mt-3 bg-brand text-white rounded-lg px-3 py-1.5 text-sm">Save deadlines</button>') +
        card("Project categories",
          '<div id="cats" class="flex flex-wrap gap-2 mb-3">' +
            CATEGORIES.map((c) => '<span class="text-xs bg-slate-100 px-2 py-1 rounded-full">' + esc(c) + "</span>").join("") + "</div>" +
          '<div class="flex gap-2"><input id="new-cat" class="border rounded-lg px-2 py-1 text-sm flex-1" placeholder="New category">' +
          '<button id="add-cat" class="bg-slate-800 text-white rounded-lg px-3 py-1 text-sm">Add</button></div>') +
        card("Post an announcement",
          input("an_title", "text", "Title", false) +
          ta("an_body", "Message", "") +
          '<button id="post-ann" class="mt-2 bg-brand text-white rounded-lg px-3 py-1.5 text-sm">Publish</button>') +
        card("Recent announcements",
          ann.length ? ann.map((a) => '<div class="mb-2 text-sm"><b>' + esc(a.title) + "</b><div class=\"text-xs text-slate-500\">" + fmtDate(a.created_at) + "</div></div>").join("")
            : '<p class="text-sm text-slate-500">None yet.</p>') +
      "</div>"
    );
    $("#save-dl").onclick = async () => {
      const ups = [];
      document.querySelectorAll("#dl [data-key]").forEach((el) => ups.push({ key: el.dataset.key, value: el.value || "", updated_at: new Date().toISOString() }));
      await guard(sb.from("settings").upsert(ups, { onConflict: "key" }), "Deadlines saved.");
    };
    $("#add-cat").onclick = async () => {
      const name = $("#new-cat").value.trim(); if (!name) return;
      await guard(sb.from("categories").insert({ name, sort: CATEGORIES.length + 1 }), "Category added.");
      viewSettings();
    };
    $("#post-ann").onclick = async () => {
      const title = $("#an_title").value.trim(); if (!title) return toast("Title required", "warn");
      await guard(sb.from("announcements").insert({ title, body: $("#an_body").value.trim() || null, created_by: ME.id }), "Announcement posted.");
      viewSettings();
    };
  }

  // =====================================================================
  //  MATERIALS
  // =====================================================================
  async function viewMaterials() {
    busy();
    const staff = ME.role === "superadmin" || ME.role === "admin";
    const q = sb.from("training_materials").select("*").order("created_at", { ascending: false });
    const { data } = await q;
    const mats = data || [];
    const list = mats.map((m) =>
      '<div class="border rounded-lg p-4 flex items-start justify-between">' +
        "<div><div class=\"font-medium\">" + esc(m.title) + (m.status === "draft" ? ' <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Draft</span>' : "") + "</div>" +
        '<div class="text-sm text-slate-500">' + esc(m.description || "") + "</div>" +
        '<div class="text-xs text-slate-400 mt-1">' + esc(m.category || "") + " · " + esc(m.version || "") + "</div></div>" +
        '<div class="text-right space-y-1">' +
          (m.file_url ? '<a href="' + esc(m.file_url) + '" target="_blank" class="text-brand text-sm block">Open</a>' : "") +
          (ME.role === "superadmin"
            ? '<button class="toggle-pub text-xs text-slate-500" data-id="' + m.id + '" data-s="' + m.status + '">' + (m.status === "published" ? "Unpublish" : "Publish") + "</button>"
            : "") +
        "</div>" +
      "</div>").join("");

    chrome(
      '<h2 class="text-xl font-bold mb-4">Training materials</h2>' +
      (ME.role === "superadmin" ? card("Add material",
        '<div class="grid gap-2 md:grid-cols-2">' +
          input("m_title", "text", "Title", true) + input("m_cat", "text", "Category", false) +
          input("m_url", "url", "File or link URL", false) + input("m_ver", "text", "Version", false) +
          '<div class="md:col-span-2">' + ta("m_desc", "Description", "") + "</div>" +
          '<div class="md:col-span-2"><label class="block text-xs text-slate-500 mb-1">Or upload a file</label><input type="file" id="m_file" class="text-sm"></div>' +
          '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="m_pub" checked> Publish immediately</label>' +
        "</div>" +
        '<button id="m_add" class="mt-3 bg-brand text-white rounded-lg px-4 py-2 text-sm">Add material</button>') : "") +
      '<div class="space-y-3 mt-4">' + (list || '<p class="text-slate-500">No materials yet.</p>') + "</div>"
    );

    if (ME.role === "superadmin") {
      $("#m_add").onclick = async () => {
        let url = $("#m_url").value.trim() || null;
        const file = $("#m_file").files[0];
        if (file) {
          const path = Date.now() + "_" + file.name.replace(/[^\w.\-]/g, "_");
          const up = await sb.storage.from("materials").upload(path, file);
          if (up.error) return toast(up.error.message, "error");
          url = sb.storage.from("materials").getPublicUrl(path).data.publicUrl;
        }
        const title = $("#m_title").value.trim(); if (!title) return toast("Title required", "warn");
        await guard(sb.from("training_materials").insert({
          title, description: $("#m_desc").value.trim() || null, category: $("#m_cat").value.trim() || null,
          version: $("#m_ver").value.trim() || "v1", file_url: url, uploaded_by: ME.id,
          status: $("#m_pub").checked ? "published" : "draft"
        }), "Material added.");
        viewMaterials();
      };
      document.querySelectorAll(".toggle-pub").forEach((b) => (b.onclick = async () => {
        await guard(sb.from("training_materials").update({ status: b.dataset.s === "published" ? "draft" : "published" }).eq("id", b.dataset.id), "Updated.");
        viewMaterials();
      }));
    }
  }

  // =====================================================================
  //  NOTIFICATIONS
  // =====================================================================
  async function viewNotifications() {
    busy();
    const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    const ns = data || [];
    chrome(
      '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Notifications</h2>' +
      (ns.some((n) => !n.read) ? '<button id="mark-all" class="text-sm text-brand">Mark all read</button>' : "") + "</div>" +
      card("", ns.length ? ns.map((n) =>
        '<div class="flex items-center gap-3 py-2 border-b text-sm ' + (n.read ? "text-slate-400" : "") + '">' +
          (n.read ? "" : '<span class="w-2 h-2 bg-brand rounded-full"></span>') +
          "<span>" + esc(n.message) + "</span>" +
          '<span class="ml-auto text-xs text-slate-400">' + fmtDateTime(n.created_at) + "</span>" +
          (n.link ? '<a href="' + esc(n.link) + '" class="text-brand text-xs">view</a>' : "") +
        "</div>").join("") : '<p class="text-slate-500">No notifications.</p>')
    );
    const ma = $("#mark-all");
    if (ma) ma.onclick = async () => { await sb.from("notifications").update({ read: true }).eq("user_id", ME.id).eq("read", false); viewNotifications(); };
  }

  // =====================================================================
  //  SUPERADMIN: audit + export
  // =====================================================================
  async function viewAudit() {
    busy();
    const { data } = await sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
    const logs = data || [];
    const profiles = (await sb.from("profiles").select("id,full_name,email")).data || [];
    const nameOf = (id) => { const p = profiles.find((x) => x.id === id); return p ? p.full_name || p.email : "system"; };
    chrome(
      '<h2 class="text-xl font-bold mb-4">Activity history</h2>' +
      card("", '<div class="overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr class="text-xs text-slate-400 border-b">' +
        '<th class="py-2 px-3">When</th><th class="px-3">Who</th><th class="px-3">Action</th><th class="px-3">Entity</th></tr></thead><tbody>' +
        logs.map((l) => '<tr class="border-b"><td class="py-1.5 px-3 text-xs">' + fmtDateTime(l.created_at) + "</td>" +
          '<td class="px-3">' + esc(nameOf(l.actor_id)) + "</td><td class=\"px-3\">" + esc(pretty(l.action)) + "</td>" +
          '<td class="px-3 text-xs text-slate-400">' + esc(l.entity_type || "") + "</td></tr>").join("") +
        "</tbody></table></div>")
    );
  }

  async function viewExport() {
    busy();
    chrome(
      '<h2 class="text-xl font-bold mb-4">Export data (CSV)</h2>' +
      card("Downloads",
        '<div class="space-y-2">' +
          exportBtn("learner_progress", "Learner progress") +
          exportBtn("projects", "Project details") +
          exportBtn("ideas", "Idea backlog (all ideas)") +
          exportBtn("evaluations", "Evaluation scores") +
          exportBtn("status_history", "Status history") +
        "</div>")
    );
    document.querySelectorAll(".exp").forEach((b) => (b.onclick = () => doExport(b.dataset.k)));
  }
  function exportBtn(k, label) {
    return '<button class="exp block w-full text-left border rounded-lg px-3 py-2 text-sm hover:bg-slate-50" data-k="' + k + '">⬇ ' + esc(label) + "</button>";
  }
  async function doExport(kind) {
    let rows = [];
    if (kind === "learner_progress") {
      const profiles = (await sb.from("profiles").select("*").eq("role", "learner")).data || [];
      const projects = (await sb.from("projects").select("*")).data || [];
      rows = profiles.map((p) => {
        const pr = projects.find((x) => x.learner_id === p.id) || {};
        return { name: p.full_name, email: p.email, team: p.team, status: pr.status, project_title: pr.title, last_login: p.last_login };
      });
    } else {
      rows = (await sb.from(kind).select("*")).data || [];
    }
    if (!rows.length) return toast("Nothing to export.", "warn");
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => {
      let v = r[c]; if (v == null) v = ""; if (typeof v === "object") v = JSON.stringify(v);
      v = String(v).replace(/"/g, '""'); return /[",\n]/.test(v) ? '"' + v + '"' : v;
    }).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = kind + ".csv"; a.click();
  }

  // =====================================================================
  //  DASHBOARD dispatcher
  // =====================================================================
  async function viewDashboard() {
    if (ME.role === "learner") return viewLearnerDashboard();
    if (ME.role === "admin") return viewAdminLearners();
    if (ME.role === "superadmin") return viewProgram();
    return chrome(card("Dashboard", "<p>No role assigned. Contact the administrator.</p>"));
  }

  // =====================================================================
  //  ROUTER
  // =====================================================================
  const PUBLIC = ["#/login", "#/setup", "#/forgot", "#/reset"];
  function requireRole(roles) {
    if (roles.indexOf(ME.role) === -1) { chrome(card("Not allowed", '<p class="text-slate-600">You don\'t have access to this page.</p>')); return false; }
    return true;
  }

  async function route() {
    const h = location.hash || "#/dashboard";
    // public pages
    if (h.indexOf("#/reset") === 0) return viewReset();
    if (!ME) {
      if (h === "#/setup") return viewSetup();
      if (h === "#/forgot") return viewForgot();
      return viewLogin();
    }
    if (ME.missing || ME.active === false) {
      return chrome(card("Account inactive",
        '<p class="text-slate-600">Your account exists but is not active yet, or has no invitation on record. ' +
        'Please contact the programme administrator.</p>'));
    }
    if (h === "#/dashboard" || h === "" || h === "#/") return viewDashboard();
    if (h === "#/ideas") return requireRole(["learner"]) && viewIdeas();
    if (h === "#/scope") return requireRole(["learner"]) && viewScope();
    if (h === "#/project") return viewProject(null);
    if (h.indexOf("#/project/") === 0) return viewProject(h.split("/")[2]);
    if (h.indexOf("#/review/") === 0) return requireRole(["admin", "superadmin"]) && viewReview(h.split("/")[2]);
    if (h.indexOf("#/evaluate/") === 0) return requireRole(["admin", "superadmin"]) && viewEvaluate(h.split("/")[2]);
    if (h === "#/admin/learners") return requireRole(["admin", "superadmin"]) && viewAdminLearners();
    if (h === "#/users") return requireRole(["superadmin"]) && viewUsers();
    if (h === "#/program") return requireRole(["superadmin"]) && viewProgram();
    if (h === "#/settings") return requireRole(["superadmin"]) && viewSettings();
    if (h === "#/audit") return requireRole(["superadmin"]) && viewAudit();
    if (h === "#/export") return requireRole(["superadmin"]) && viewExport();
    if (h === "#/materials") return viewMaterials();
    if (h === "#/notifications") return viewNotifications();
    return viewDashboard();
  }

  // =====================================================================
  //  BOOT
  // =====================================================================
  async function boot() {
    busy();
    await loadMe();
    if (ME && !ME.missing) { try { await loadRefData(); } catch (_) {} }
    route();
  }

  window.addEventListener("hashchange", route);
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") { location.hash = "#/reset"; route(); }
  });
  boot();
})();
