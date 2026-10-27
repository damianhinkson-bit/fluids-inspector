/* Fluids Inspector — game logic. Plain JS, no build step. */
(() => {
  const STORE = "fluidsInspector.v1";
  const app = document.getElementById("app");
  const FINAL_COUNT = 12;
  const MAX_XP = CASES.reduce((n, c) => n + c.questions.length, 0) * 10;

  let S = load();
  const session = Math.random().toString(36).slice(2, 10);
  let play = null; // current case run

  /* ---------- storage ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || fresh(); } catch { return fresh(); }
  }
  function fresh() { return { name: "", xp: 0, done: {}, earned: {} }; }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} }

  /* ---------- logging to Google Sheet ---------- */
  function log(event, data = {}) {
    const row = {
      student: S.name, session, event,
      caseId: data.caseId || "", caseTitle: data.caseTitle || "",
      qid: data.qid || "", question: data.question || "", qtype: data.qtype || "",
      chosen: data.chosen || "", correct: data.correct || "",
      isCorrect: data.isCorrect === undefined ? "" : (data.isCorrect ? 1 : 0),
      attempt: data.attempt || "", hint: data.hint === undefined ? "" : (data.hint ? 1 : 0),
      timeSec: data.timeSec === undefined ? "" : data.timeSec,
      xp: S.xp, detail: data.detail || "", clientTime: new Date().toISOString()
    };
    if (!LOG_URL) { console.log("[log]", row); return; }
    const body = JSON.stringify(row);
    if (event === "session_end" && navigator.sendBeacon) {
      navigator.sendBeacon(LOG_URL, new Blob([body], { type: "text/plain" }));
      return;
    }
    fetch(LOG_URL, { method: "POST", mode: "no-cors", keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" }, body }).catch(() => {});
  }
  let started = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && S.name)
      log("session_end", { timeSec: Math.round((Date.now() - started) / 1000) });
    if (document.visibilityState === "visible") started = Date.now();
  });

  /* ---------- helpers ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rank = () => RANKS.filter(r => S.xp >= r.xp).pop();
  const nextRank = () => RANKS.find(r => r.xp > S.xp);
  const starsFor = pct => pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : 1;
  const starStr = n => "★".repeat(n) + "☆".repeat(3 - n);
  const allDone = () => CASES.every(c => S.done[c.id]);
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function topbar() {
    const r = rank(), n = nextRank();
    const lo = r.xp, hi = n ? n.xp : MAX_XP;
    const pct = Math.min(100, ((S.xp - lo) / Math.max(1, hi - lo)) * 100);
    return `<div class="topbar">
      <div class="badge">${esc(S.name[0] || "?").toUpperCase()}</div>
      <div class="who"><span>${r.title}</span><b>${esc(S.name)}</b></div>
      <div class="xpwrap"><div class="xpbar"><i style="width:${pct}%"></i></div>
        <div class="xptext"><span>${S.xp} XP</span><span>${n ? `${n.xp - S.xp} XP to ${n.title}` : "Top rank!"}</span></div></div>
      <button class="iconbtn" data-act="map">🗺️ Cases</button>
    </div>`;
  }

  /* ---------- screens ---------- */
  function welcome() {
    app.innerHTML = `
      <div class="hero pop">
        <div class="kicker">ENVH 112 · Unit 1</div>
        <h1>Fluids Inspector</h1>
        <p>You're the newest Environmental Health Inspector in Barbados. Work through 11 field cases — tankers, refuse trucks, manholes and hurricanes — using density, pressure, buoyancy and flow.</p>
        <form class="namebox" id="nameForm">
          <input id="nameIn" maxlength="40" placeholder="Type your name to start" value="${esc(S.name)}" autocomplete="name" required>
          <button class="btn" type="submit">Start shift →</button>
        </form>
      </div>
      <div class="howto">
        <div><b>🎯 Pick the answer</b>Every question is multiple choice. Two tries per question.</div>
        <div><b>⭐ Earn XP</b>10 XP first try, 5 XP second try. Hints cost 3 XP.</div>
        <div><b>📈 Rank up</b>Trainee → Chief Inspector. Clear all cases to unlock the Final Inspection.</div>
      </div>`;
    document.getElementById("nameForm").onsubmit = e => {
      e.preventDefault();
      const v = document.getElementById("nameIn").value.trim();
      if (!v) return;
      if (S.name && S.name !== v) S = fresh(); // different student on same device
      S.name = v; save();
      log("session_start", { detail: navigator.userAgent.slice(0, 120) });
      map();
    };
  }

  function map() {
    play = null;
    const cards = CASES.map((c, i) => {
      const locked = i > 0 && !S.done[CASES[i - 1].id];
      const d = S.done[c.id];
      return `<button class="case ${locked ? "locked" : ""}" ${locked ? "disabled" : ""} data-case="${c.id}">
        <span class="num">Case ${i + 1}</span><span class="ic">${c.icon}</span>
        <h3>${c.title}</h3><span class="pl">📍 ${c.place} · ${c.questions.length} questions</span>
        <span class="stars">${d ? starStr(d.stars) : ""}</span></button>`;
    }).join("");
    const fin = S.done.final;
    app.innerHTML = topbar() + `
      <div class="sectionhead"><h2>Your case files</h2><small>${Object.keys(S.done).filter(k => k !== "final").length}/${CASES.length} closed</small></div>
      <div class="grid">${cards}
        <button class="case final ${allDone() ? "" : "locked"}" ${allDone() ? "" : "disabled"} data-case="final">
          <span class="num">Final</span><span class="ic">🏅</span><h3>Final Inspection</h3>
          <span class="pl">${FINAL_COUNT} mixed questions from every case</span>
          <span class="stars">${fin ? starStr(fin.stars) : ""}</span></button>
      </div>`;
    bind();
  }

  function startCase(id) {
    let c;
    if (id === "final") {
      const pool = CASES.flatMap(cs => cs.questions.map(q => ({ ...q, _case: cs.id })));
      c = { id: "final", icon: "🏅", title: "Final Inspection", place: "All of Barbados",
        story: "The Chief Inspector is checking your work. Mixed questions from every case — no hints this time.",
        questions: shuffle(pool).slice(0, FINAL_COUNT), noHints: true };
    } else c = CASES.find(x => x.id === id);
    play = { c, i: 0, results: [], missed: [], xpStart: S.xp };
    log("case_start", { caseId: c.id, caseTitle: c.title, detail: c.id === "final" ? c.questions.map(q => q.id).join(",") : "" });
    question();
  }

  function question() {
    const { c, i } = play;
    const q = c.questions[i];
    const opts = shuffle([q.a, ...q.w]);
    play.q = { q, opts, attempt: 1, hint: false, t0: Date.now(), locked: false };
    const dots = c.questions.map((_, k) => `<i class="${k < i ? (play.results[k] ? "ok" : "bad") : k === i ? "now" : ""}"></i>`).join("");
    app.innerHTML = topbar() + `
      <div class="playhead"><span style="font-size:26px">${c.icon}</span><h2>${c.title}</h2>
        <small style="color:var(--muted)">${i + 1} / ${c.questions.length}</small></div>
      <div class="dots">${dots}</div>
      <div class="panel pop">
        ${i === 0 ? `<div class="brief"><b>📍 ${c.place}</b>${c.story}</div>` : ""}
        <span class="qtag ${q.type === "calc" ? "calc" : ""}">${q.type === "calc" ? "🧮 Calculation" : "💡 Concept"}</span>
        <p class="question">${q.q}</p>
        <div class="options">${opts.map((o, k) => `<button class="opt" data-opt="${k}"><span class="k">${"ABCD"[k]}</span><span>${o}</span></button>`).join("")}</div>
        <div id="hintArea"></div>
        <div id="fb"></div>
        <div class="tools">
          ${q.hint && !c.noHints ? `<button class="hintbtn" id="hintBtn">💡 Show hint (−3 XP)</button>` : "<span></span>"}
          <button class="btn" id="nextBtn" style="display:none">Next →</button>
        </div>
      </div>`;
    bind();
    const hb = document.getElementById("hintBtn");
    if (hb) hb.onclick = () => {
      if (play.q.hint) return;
      play.q.hint = true; hb.remove();
      document.getElementById("hintArea").innerHTML = `<div class="hintbox pop">💡 ${q.hint}</div>`;
      log("hint", { caseId: c.id, caseTitle: c.title, qid: q.id, question: q.q, qtype: q.type });
    };
    document.getElementById("nextBtn").onclick = nextQ;
  }

  function choose(k) {
    const P = play.q, { q, opts } = P;
    if (P.locked) return;
    const chosen = opts[k], ok = chosen === q.a;
    const btns = [...document.querySelectorAll(".opt")];
    const timeSec = Math.round((Date.now() - P.t0) / 10) / 100;
    log("answer", { caseId: play.c.id, caseTitle: play.c.title, qid: q.id, question: q.q, qtype: q.type,
      chosen, correct: q.a, isCorrect: ok, attempt: P.attempt, hint: P.hint, timeSec });
    const fb = document.getElementById("fb");

    if (ok) {
      P.locked = true;
      btns[k].classList.add("ok");
      btns.forEach((b, j) => { b.disabled = true; if (j !== k && !b.classList.contains("bad")) b.classList.add("dim"); });
      let pts = P.attempt === 1 ? 10 : 5;
      if (P.hint) pts = Math.max(0, pts - 3);
      const earnedKey = q.id;
      const fresh = !S.earned[earnedKey];
      if (fresh) { S.earned[earnedKey] = true; S.xp += pts; save(); }
      fb.innerHTML = `<div class="feedback ok pop"><b>✅ Correct!${fresh && pts ? ` +${pts} XP` : ""}</b>${q.explain}</div>`;
      finishQ(P.attempt === 1);
    } else if (P.attempt === 1) {
      P.attempt = 2;
      btns[k].classList.add("bad"); btns[k].disabled = true;
      fb.innerHTML = `<div class="feedback retry pop"><b>Not quite — one more try.</b>${q.hint && !play.c.noHints && !P.hint ? "Tip: you can use the hint." : "Re-read the question carefully."}</div>`;
    } else {
      P.locked = true;
      btns[k].classList.add("bad");
      btns.forEach(b => { b.disabled = true; if (b.querySelector("span:last-child").textContent === q.a) b.classList.add("ok"); else if (!b.classList.contains("bad")) b.classList.add("dim"); });
      fb.innerHTML = `<div class="feedback bad pop"><b>❌ The answer is: ${q.a}</b>${q.explain}</div>`;
      finishQ(false);
    }
  }

  function finishQ(firstTry) {
    play.results[play.i] = firstTry;
    if (!firstTry) play.missed.push(play.q.q.q);
    const hb = document.getElementById("hintBtn"); if (hb) hb.remove();
    const nb = document.getElementById("nextBtn");
    nb.style.display = ""; nb.textContent = play.i === play.c.questions.length - 1 ? "Finish case →" : "Next →";
    nb.focus();
  }

  function nextQ() {
    play.i++;
    if (play.i < play.c.questions.length) question(); else results();
  }

  function results() {
    const { c, results: r, missed } = play;
    const right = r.filter(Boolean).length, pct = right / r.length, stars = starsFor(pct);
    const prev = S.done[c.id];
    const before = rank().title;
    S.done[c.id] = { stars: Math.max(stars, prev ? prev.stars : 0), last: Math.round(pct * 100) };
    save();
    log(c.id === "final" ? "final_complete" : "case_complete", { caseId: c.id, caseTitle: c.title,
      detail: `${right}/${r.length} first try (${Math.round(pct * 100)}%), ${stars} stars` });
    const after = rank().title;
    app.innerHTML = topbar() + `
      <div class="panel result pop">
        <div style="font-size:44px">${c.icon}</div>
        <h2>${c.id === "final" ? "Final Inspection complete" : "Case closed!"}</h2>
        <div class="bigstars">${starStr(stars)}</div>
        <div class="stats">
          <div class="stat"><b>${right}/${r.length}</b><span>First-try correct</span></div>
          <div class="stat"><b>+${S.xp - play.xpStart}</b><span>XP earned</span></div>
          <div class="stat"><b>${after}</b><span>Rank</span></div>
        </div>
        ${missed.length ? `<div class="review"><h3>Worth another look</h3><ul>${missed.map(m => `<li>${m}</li>`).join("")}</ul></div>` : `<p>Perfect run — every question right first time. 🔥</p>`}
        <div class="row" style="margin-top:18px">
          <button class="btn secondary" data-case="${c.id}">↻ Replay</button>
          <button class="btn" data-act="map">Back to cases →</button>
        </div>
      </div>`;
    if (before !== after) toast(`🎉 Promoted to ${after}!`);
    bind();
  }

  /* ---------- events ---------- */
  function bind() {
    app.querySelectorAll("[data-act=map]").forEach(b => b.onclick = () => {
      const midCase = play && play.i < play.c.questions.length;
      if (midCase && !confirm("Leave this case? Progress in it won't be saved.")) return;
      if (midCase) log("case_quit", { caseId: play.c.id, caseTitle: play.c.title, detail: `left at question ${play.i + 1}` });
      map();
    });
    app.querySelectorAll("[data-case]").forEach(b => b.onclick = () => !b.disabled && startCase(b.dataset.case));
    app.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => choose(+b.dataset.opt));
  }
  document.addEventListener("keydown", e => {
    if (!play || !play.q) return;
    const k = "abcd".indexOf(e.key.toLowerCase());
    if (k >= 0 && !play.q.locked) { const b = document.querySelectorAll(".opt")[k]; if (b && !b.disabled) choose(k); }
    if (e.key === "Enter" && play.q.locked) { const n = document.getElementById("nextBtn"); if (n && document.activeElement !== n) nextQ(); }
  });

  if (S.name) { log("session_start", { detail: "returning · " + navigator.userAgent.slice(0, 100) }); map(); }
  else welcome();
})();
