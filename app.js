/* Fiato e Ferro · Ciclo 2 — logica dell'app.
   I dati del programma stanno in program.json: per cambiare carichi o esercizi si modifica solo quello. */
(() => {
  'use strict';

  const APP_VERSION = '1.5.0';
  const KEY = 'fef.v1';
  const DAY_MS = 864e5;
  const CIRC = 339.292; // 2 * PI * 54, anello del timer
  const WD = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const WD3 = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const MO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const MO3 = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  let P = null; // program.json
  const S = { tab: 'oggi', today: '', viewDate: '', schede: 'A', schedeVar: 'full', viaggio: 'spinta', regWeek: '', segFrom: {}, cur: null };

  /* ---------- helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const low = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');
  const ico = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const fmtN = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  const commas = (v) => String(v).replace('.', ',');
  const cleanNum = (raw) => {
    let v = String(raw).replace(/[^\d.,]/g, '').replace(/\./g, ',');
    const i = v.indexOf(',');
    if (i > -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '');
    return v;
  };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /* ---------- date ---------- */

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const dnum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const wday = (s) => parse(s).getDay();
  const monday = (s) => { const w = wday(s); return addDays(s, w === 0 ? -6 : 1 - w); };
  const fmtLong = (s) => { const d = parse(s); return `${cap(WD[d.getDay()])} ${d.getDate()} ${MO[d.getMonth()]}`; };
  const fmtDM = (s) => { const d = parse(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const fmtDay = (s) => `${WD3[wday(s)]} ${fmtDM(s)}`;
  const fmtRange = (a, b) => {
    const x = parse(a), y = parse(b);
    return x.getMonth() === y.getMonth()
      ? `${x.getDate()}–${y.getDate()} ${MO3[y.getMonth()]}`
      : `${x.getDate()} ${MO3[x.getMonth()]} – ${y.getDate()} ${MO3[y.getMonth()]}`;
  };
  const between = (d, a, b) => dnum(d) >= dnum(a) && dnum(d) <= dnum(b);
  function todayISO() {
    try {
      const q = new URLSearchParams(location.search).get('data');
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    } catch (e) { /* ignora */ }
    return iso(new Date());
  }
  function relLabel(d) {
    const diff = dnum(d) - dnum(S.today);
    return diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : diff === -1 ? 'Ieri' : '';
  }

  /* ---------- registro locale ---------- */

  const DB = { days: {}, sat: {}, measures: {}, prefs: {} };
  let storageOK = true;

  function loadDB() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOK = false; return; }
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') for (const k of Object.keys(DB)) if (d[k] && typeof d[k] === 'object') DB[k] = d[k];
      } catch (e) {
        try { localStorage.setItem(KEY + '.illeggibile', raw); } catch (e2) { /* ignora */ }
      }
    }
    try {
      localStorage.setItem(KEY + '.probe', '1');
      localStorage.removeItem(KEY + '.probe');
    } catch (e) { storageOK = false; }
  }
  function save() {
    if (!storageOK) return;
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { storageOK = false; toast('Il telefono non sta salvando il registro: copia il riepilogo prima di chiudere.'); }
  }
  const dayRec = (date, make) => {
    let r = DB.days[date];
    if (!r && make) r = DB.days[date] = { ex: {} };
    if (r && !r.ex) r.ex = {};
    return r || null;
  };
  const exLog = (rec, id) => (rec && rec.ex && rec.ex[id]) || null;
  const exDone = (l) => !!l && (l.done != null ? !!l.done : !!(l.kg || l.reps));
  const recHasData = (r) => !!r && Object.values(r.ex || {}).some((l) => l && (l.done || l.kg || l.reps || l.sets));
  const recDone = (r) => !!r && !r.skipped && (r.done != null ? !!r.done : recHasData(r));
  const dayStatus = (r) => (r && r.skipped ? 'skipped' : recDone(r) ? 'done' : '');

  /* ---------- calendario del ciclo ---------- */

  function ctx(date) {
    const c = { date, wd: wday(date), status: 'in', phase: null, week: null, block: null, deload: false, pause: false, pauseWeek: null, sets: null, slot: null, required: [] };
    if (dnum(date) < dnum(P.cycle.start)) { c.status = 'before'; return c; }
    if (dnum(date) > dnum(P.cycle.end)) { c.status = 'after'; return c; }
    const ph = P.phases.find((p) => between(date, p.from, p.to));
    if (!ph) { c.status = 'gap'; return c; }
    c.phase = ph;
    const wi = Math.floor((dnum(date) - dnum(ph.from)) / 7);
    if (ph.pause) {
      c.pause = true; c.pauseWeek = wi + 1;
      c.pauseWeeks = Math.round((dnum(ph.to) - dnum(ph.from) + 1) / 7);
      c.block = ph.effectiveBlock; c.week = ph.effectiveWeek; c.sets = ph.sets;
    } else {
      c.block = ph.block; c.week = ph.firstWeek + wi; c.deload = c.week === ph.deloadWeek;
      if (c.deload) c.sets = P.deload.sets;
    }
    const sched = Object.assign({}, P.schedule, ph.schedule || {});
    c.slot = sched[c.wd];
    c.required = [...new Set(Object.values(sched).filter((v) => P.sessions[v]))];
    return c;
  }
  function refCtx() {
    const c = ctx(S.today);
    if (c.status === 'in') return c;
    if (c.status === 'before') return Object.assign(ctx(P.cycle.start), { ref: true });
    return { status: 'in', week: 12, block: 3, deload: false, sets: null, ref: true };
  }
  function weekLabel(c) {
    if (c.status === 'before') return 'Prima del ciclo';
    if (c.status === 'after') return 'Ciclo concluso';
    if (c.pause) return `Pausa festiva · settimana ${c.pauseWeek} di ${c.pauseWeeks}`;
    return `Settimana ${c.week} di 12 · ${c.phase.label}${c.deload ? ' · scarico' : ''}`;
  }

  function adjSets(n, rule) {
    if (!rule) return n;
    let v = n * rule.factor;
    v = rule.rounding === 'floor' ? Math.floor(v + 1e-9) : Math.round(v);
    return Math.min(n, Math.max(rule.min || 2, v));
  }
  function resolveEx(ex, c) {
    const v = Object.assign({}, ex);
    for (const o of ex.overrides || []) {
      const okW = o.fromWeek == null || (c.week != null && c.week >= o.fromWeek);
      const okB = o.fromBlock == null || (c.block != null && c.block >= o.fromBlock);
      if (okW && okB) Object.assign(v, o);
    }
    // Pump (dal 24/11/2026): recupero corto e drop set sull'ultima serie, mai in scarico o in pausa festiva.
    const pp = ex.pump;
    if (pp && c.week != null && !c.deload && !c.pause && c.week >= (pp.fromWeek || 1) && (pp.toWeek == null || c.week <= pp.toWeek)) {
      v.pumpOn = true; v.pumpText = pp.text || '';
      if (pp.rest) v.rest = pp.rest;
    }
    v.setsOrig = v.sets;
    if (v.sets && c.sets) v.sets = adjSets(v.sets, c.sets);
    return v;
  }
  function exercisesFor(id, variant) {
    const sess = P.sessions[id];
    if (variant === 'bw') return P.bodyweight[sess.bodyweight].exercises;
    if (variant === 'short') {
      const ids = new Set(sess.short);
      sess.exercises.forEach((e) => { if ((e.flags || []).includes('keep')) ids.add(e.id); });
      return sess.exercises.filter((e) => ids.has(e.id));
    }
    return sess.exercises;
  }
  const loggedSession = (date) => {
    const r = DB.days[date];
    if (r && P.sessions[r.session]) return r.session;
    const c = ctx(date);
    return c.status === 'in' && P.sessions[c.slot] ? c.slot : null;
  };
  function doneSet(from, to) {
    const out = new Set();
    for (let d = from; dnum(d) <= dnum(to); d = addDays(d, 1)) {
      if (recDone(DB.days[d])) { const s = loggedSession(d); if (s) out.add(s); }
    }
    return out;
  }
  function weekDone(mon) {
    const set = doneSet(mon, addDays(mon, 6));
    const sr = DB.sat[addDays(mon, 5)];
    if (sr && Array.isArray(sr.done)) sr.done.forEach((s) => set.add(s));
    return set;
  }
  function weekHasAnyData(mon) {
    for (let i = 0; i < 7; i++) if (DB.days[addDays(mon, i)]) return true;
    return !!DB.sat[addDays(mon, 5)];
  }
  function cMissedPrev(mon) {
    const pm = addDays(mon, -7);
    const pc = ctx(pm);
    if (pc.status !== 'in' || !pc.required.includes('C')) return false;
    if (!weekHasAnyData(pm)) return false;
    return !weekDone(pm).has('C');
  }
  function recovery(date) {
    const c = ctx(date);
    const mon = monday(date);
    const req = c.required;
    const auto = doneSet(mon, addDays(mon, 4));
    const sr = DB.sat[date] || {};
    const manual = Array.isArray(sr.done);
    const done = manual ? new Set(sr.done) : auto;
    const missed = req.filter((s) => !done.has(s));
    const cPrevAuto = cMissedPrev(mon);
    const cPrev = typeof sr.cPrev === 'boolean' ? sr.cPrev : cPrevAuto;
    let order = (P.priority || ['A', 'D', 'B', 'C']).filter((s) => req.includes(s));
    if (cPrev && missed.includes('C')) order = ['C'].concat(order.filter((s) => s !== 'C'));
    if (c.phase && c.phase.noRecovery) return { req, done, manual, missed, cPrev: false, cPrevAuto: false, type: 'pause', session: null, lost: missed };
    const pick = order.find((s) => missed.includes(s)) || null;
    return { req, done, manual, missed, cPrev, cPrevAuto, type: missed.length ? 'recover' : 'free', session: pick, lost: missed.filter((s) => s !== pick) };
  }
  function sessionFor(date) {
    const c = ctx(date);
    if (c.status !== 'in') return null;
    const r = DB.days[date];
    if (r && r.forced && P.sessions[r.session]) return { id: r.session, forced: true, c };
    if (P.sessions[c.slot]) return { id: c.slot, c };
    if (c.slot === 'sat') {
      if (r && P.sessions[r.session] && recHasData(r)) return { id: r.session, recovery: true, c };
      const rv = recovery(date);
      if (rv.type === 'recover') return { id: rv.session, recovery: true, c };
    }
    return null;
  }
  function threeDayWarning(mon, current) {
    const c = ctx(mon), pc = ctx(addDays(mon, -7));
    if (c.status !== 'in' || pc.status !== 'in' || c.pause || pc.pause) return false;
    if (!weekHasAnyData(addDays(mon, -7))) return false;
    return current < 3 && weekDone(addDays(mon, -7)).size < 3;
  }

  /* ---------- spalla sinistra ---------- */

  function shoulderStreak(upto) {
    const keys = Object.keys(DB.days).filter((d) => dnum(d) <= dnum(upto) && DB.days[d].shoulder).sort();
    let n = 0;
    for (let i = keys.length - 1; i >= 0; i--) { if (DB.days[keys[i]].shoulder === 'ok') n++; else break; }
    const last = keys.length ? DB.days[keys[keys.length - 1]].shoulder : null;
    return { n, last, any: keys.length > 0 };
  }
  function capLoad() {
    for (const sess of Object.values(P.sessions)) {
      const e = sess.exercises.find((x) => (x.flags || []).includes('cap'));
      if (e) return String(e.load).replace(/\s*kg.*$/i, '');
    }
    return '';
  }
  function shoulderText(upto) {
    const s = shoulderStreak(upto);
    const cap = capLoad();
    if (!cap) return s.last === 'talked' ? "L'ultima volta la spalla ha parlato." : `Silenziosa da ${s.n} ${s.n === 1 ? 'seduta' : 'sedute'} di fila.`;
    if (!s.any) return `Tetto a ${cap} finché la spalla non resta silenziosa per tre sedute di fila.`;
    if (s.last === 'talked') return `L'ultima volta ha parlato: il conteggio riparte da zero. Tetto a ${cap}.`;
    if (s.n >= 3) return `Silenziosa da ${s.n} sedute di fila. Puoi chiedere a Claude se salire; fino ad allora resta a ${cap}.`;
    return `Silenziosa da ${s.n} ${s.n === 1 ? 'seduta' : 'sedute'} di fila su 3. Il tetto resta ${cap}.`;
  }

  /* ---------- formati degli esercizi ---------- */

  function restSecs(rest) {
    const m = String(rest || '').match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(min|s)\b/i);
    if (!m) return null;
    const mul = m[3].toLowerCase() === 'min' ? 60 : 1;
    const a = Math.round(num(m[1]) * mul);
    const b = m[2] ? Math.round(num(m[2]) * mul) : null;
    return b ? [a, Math.round((a + b) / 2), b] : [a];
  }
  function repsParts(reps) {
    const m = String(reps).match(/^(.+?)\s+((?:per|discese)\s.+)$/);
    return m ? [m[1], m[2]] : [String(reps), ''];
  }
  function splitUnit(s) {
    const m = String(s).match(/^(.*?)\s*(min|s|kg)$/);
    return m ? [m[1], m[2]] : [String(s), ''];
  }
  function loadHTML(load) {
    const m = String(load).match(/^([\d.,]+(?:\s*\+\s*[\d.,]+)?)\s*kg\b\s*(.*)$/i);
    if (m) {
      const sub = m[2].replace(/^\(|\)$/g, '').trim();
      return `<span class="num-v">${esc(m[1].replace(/\s*\+\s*/, ' + '))}</span>${sub ? `<span class="num-sub">${esc(sub)}</span>` : ''}`;
    }
    return `<span class="num-v num-text">${esc(cap(load))}</span>`;
  }
  const isBodyweight = (v) => !v.cardio && !/\d/.test(v.load || '');
  const isTimed = (v) => /\d\s*s(\s|$)/.test(v.reps || '');
  const yt = (v) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${v.video || v.name} esecuzione corretta`);
  function lastLog(id, before) {
    const keys = Object.keys(DB.days).filter((d) => dnum(d) < dnum(before)).sort().reverse();
    for (const d of keys) {
      const l = exLog(DB.days[d], id);
      if (l && (l.kg || l.reps)) return { date: d, kg: l.kg, reps: l.reps };
    }
    return null;
  }
  function logText(v, l) {
    if (!l) return '';
    const setsTxt = l.sets ? `${l.sets}/${l.setsOf || v.sets || l.sets} serie` : '';
    if (!l.kg && !l.reps) return setsTxt;
    const base = logTextNums(v, l);
    return setsTxt ? `${base} · ${setsTxt}` : base;
  }
  // Campi vuoti = Francesco ha fatto quanto previsto dalla scheda (scelta sua, 23/11/2026).
  function effLog(v, l) {
    if (!l || !(l.kg || l.reps || l.sets || exDone(l))) return null;
    const f = { kg: l.kg || '', reps: l.reps || '', sets: l.sets || 0, setsOf: l.setsOf || v.sets || 0, kgDefault: false, repsDefault: false };
    if (!f.sets && exDone(l) && v.sets) f.sets = v.sets;
    if (!(f.sets || exDone(l))) return f;
    if (v.cardio) {
      if (!f.reps && v.duration) { f.reps = splitUnit(v.duration)[0]; f.repsDefault = true; }
      return f;
    }
    if (!f.kg && /\d/.test(v.load || '')) { f.kg = (String(v.load).match(/[\d.,]+/) || [''])[0]; f.kgDefault = true; }
    if (!f.reps && v.reps) { f.reps = repsParts(v.reps)[0].replace(/\s*s$/, ''); f.repsDefault = true; }
    return f;
  }
  function defNote(f) {
    if (!f) return '';
    if (f.kgDefault && f.repsDefault) return ', come previsto';
    if (f.kgDefault) return ', carico previsto';
    if (f.repsDefault) return ', ripetizioni previste';
    return '';
  }
  function logTextNums(v, l) {
    if (v.cardio) return [l.reps ? `${commas(l.reps)} min` : '', l.kg ? `liv. ${commas(l.kg)}` : ''].filter(Boolean).join(', ');
    if (isBodyweight(v)) return l.reps ? `${commas(l.reps)}${isTimed(v) ? ' s' : ' rip'}` : '';
    if (!l.kg) return `${commas(l.reps)} rip`;
    return [`${commas(l.kg)} kg`, l.reps ? `× ${commas(l.reps)}` : ''].filter(Boolean).join(' ');
  }
  const field = (id, f, label, val, ph, mode, off) =>
    `<label class="field"><span class="field-l">${esc(label)}</span><input class="input" type="text" inputmode="${mode}" autocomplete="off" autocorrect="off" enterkeyhint="done" maxlength="8" data-ex="${esc(id)}" data-f="${f}" value="${esc(val || '')}" placeholder="${esc(ph || '')}"${off ? ' disabled' : ''}></label>`;

  function exCard(ex, c, i, o) {
    const v = resolveEx(ex, c);
    const flags = v.flags || [];
    const l = o.rec ? exLog(o.rec, v.id) : null;
    const done = exDone(l);
    const tags = [];
    if (flags.includes('keep')) tags.push('<span class="tag tag-keep">Non si toglie</span>');
    if (flags.includes('cap')) tags.push('<span class="tag tag-cap">Tetto</span>');
    if (flags.includes('proposal')) tags.push('<span class="tag tag-proposal">Carico da confermare</span>');
    if (flags.includes('new') && (c.block || 1) === 1) tags.push('<span class="tag tag-new">Nuovo</span>');
    if (v.pumpOn) tags.push('<span class="tag tag-pump">Pump</span>');

    let nums;
    if (v.cardio) {
      const [dv, du] = splitUnit(v.duration);
      nums = `<div class="num"><span class="num-l">Durata</span><span class="num-v">${esc(dv)} <small>${esc(du)}</small></span></div>
        <div class="num"><span class="num-l">Carico</span><span class="num-v num-text">${esc(v.load)}</span></div>`;
    } else {
      const [rm, rs] = repsParts(v.reps);
      const was = v.sets !== v.setsOrig ? `<span class="num-sub"><span class="num-was">${c.deload ? 'Scarico' : 'Pausa'}</span>, da ${v.setsOrig} serie</span>` : '';
      nums = `<div class="num"><span class="num-l">Serie × rip</span><span class="num-v">${esc(v.sets)} × ${esc(rm)}</span>${rs ? `<span class="num-sub">${esc(rs)}</span>` : ''}${was}</div>
        <div class="num"><span class="num-l">${/^[\d.,]+(\s*\+\s*[\d.,]+)?\s*kg/i.test(v.load) ? 'Carico, kg' : 'Carico'}</span>${loadHTML(v.load)}</div>`;
    }

    let callout = v.callout || '';
    const calib = flags.includes('new') && c.week === 1 && !c.pause && !c.ref;
    if (v.id === 'shoulder-press-a' && o.date) callout = shoulderText(o.date);

    const rs = restSecs(v.rest);
    const actions = [];
    if (rs) actions.push(`<button type="button" class="chip chip-rest" data-act="timer-start" data-rest="${rs.join(',')}" data-name="${esc(v.name)}">${ico('timer')}Recupero ${esc(v.rest)}</button>`);
    else if (v.cardio) actions.push('<span class="chip chip-static">Continuo, senza recupero</span>');
    actions.push(`<a class="chip" href="${yt(v)}" target="_blank" rel="noopener">${ico('play')}Esecuzione</a>`);

    let log = '';
    const off = !o.editable;
    if (o.editable || o.future) {
      const last = lastLog(v.id, o.date);
      const [rm] = repsParts(v.reps || '');
      const repsPh = rm.replace(/\s*s$/, '');
      const fields = [];
      if (v.cardio) {
        fields.push(field(v.id, 'reps', 'Minuti fatti', l && l.reps, (last && last.reps) || splitUnit(v.duration)[0], 'numeric', off));
        fields.push(field(v.id, 'kg', 'Livello o km/h', l && l.kg, (last && last.kg) || '5', 'decimal', off));
      } else if (isBodyweight(v)) {
        fields.push(field(v.id, 'reps', isTimed(v) ? 'Secondi fatti' : 'Ripetizioni fatte', l && l.reps, repsPh, 'numeric', off));
      } else {
        const kgPh = (String(v.load).match(/[\d.,]+/) || [''])[0];
        fields.push(field(v.id, 'kg', /\+/.test(v.load) ? 'Kg per manubrio' : 'Kg fatti', l && l.kg, kgPh, 'decimal', off));
        fields.push(field(v.id, 'reps', 'Ripetizioni fatte', l && l.reps, repsPh, 'numeric', off));
      }
      const lastTxt = off ? '<p class="ex-last">Si compila il giorno della seduta.</p>' : `<p class="ex-last">${last ? `Ultima volta: ${esc(logText(v, last))} · ${esc(fmtDay(last.date))}. ` : ''}Lascia vuoto se hai fatto il previsto.</p>`;
      log = `<div class="ex-log${fields.length === 1 ? ' single' : ''}">${fields.join('')}${lastTxt}</div>`;
    }

    let setsRow = '';
    if ((o.editable || o.future) && !v.cardio && v.sets) {
      const n = (l && l.sets) || 0;
      const dots = Array.from({ length: v.sets }, (_, k) => `<button type="button" class="set-dot" data-act="set" data-ex="${esc(v.id)}" data-k="${k + 1}" data-total="${v.sets}" aria-pressed="${k < n}" aria-label="Serie ${k + 1} di ${v.sets}"${off ? ' disabled' : ''}>${k + 1}</button>`).join('');
      setsRow = `<div class="sets"><span class="field-l">Serie fatte</span><div class="set-dots">${dots}</div></div>`;
    }
    const doneBtn = o.editable || o.future
      ? `<button type="button" class="ex-done" data-act="ex-toggle" data-ex="${esc(v.id)}" aria-pressed="${done}" aria-label="${esc(v.name)}: fatto"${off ? ' disabled' : ''}>${ico('check')}<span>Fatto</span></button>`
      : '';

    return `<article class="ex${done ? ' is-done' : ''}" data-card="${esc(v.id)}">
      <div class="ex-h"><span class="ex-idx" aria-hidden="true">${i + 1}</span><div class="ex-title"><h3 class="ex-name">${esc(v.name)}</h3>${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}</div>${doneBtn}</div>
      <div class="ex-nums">${nums}</div>
      ${v.note ? `<p class="ex-note">${esc(v.note)}</p>` : ''}
      ${callout ? `<p class="ex-callout">${esc(callout)}</p>` : ''}
      ${calib ? `<p class="ex-callout ex-calib">${esc(P.rules.calibration)}</p>` : ''}
      ${v.pumpOn && v.pumpText ? `<p class="ex-callout ex-pump">${esc(v.pumpText)}</p>` : ''}
      ${v.how ? `<details class="ex-how"><summary>Come si esegue</summary><p>${esc(v.how)}</p></details>` : ''}
      ${setsRow}
      <div class="ex-actions">${actions.join('')}</div>
      ${log}
    </article>`;
  }

  /* ---------- controlli segmentati ---------- */

  function seg(key, opts, cur, label) {
    const i = Math.max(0, opts.findIndex((o) => o[0] === cur));
    const from = S.segFrom[key] != null ? S.segFrom[key] : i;
    delete S.segFrom[key];
    return `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${key}" data-to="${i}">
      <span class="seg-thumb" style="width:calc((100% - 6px) / ${opts.length});transform:translateX(${from * 100}%)"></span>
      ${opts.map((o, k) => `<button type="button" class="seg-btn" data-act="seg" data-key="${key}" data-i="${k}" data-v="${esc(o[0])}" aria-pressed="${k === i}">${esc(o[1])}</button>`).join('')}
    </div>`;
  }
  function animateSegs() {
    $$('.seg').forEach((el) => {
      const t = el.querySelector('.seg-thumb');
      const to = +el.dataset.to;
      requestAnimationFrame(() => requestAnimationFrame(() => { t.style.transform = `translateX(${to * 100}%)`; }));
    });
  }

  /* ---------- blocchi della vista Oggi ---------- */

  function banners(c, date) {
    let h = '';
    if (c.deload) h += `<div class="banner banner-warn">${ico('alert')}<div>${esc(P.deload.banner)}</div></div>`;
    if (c.pause) h += `<div class="banner banner-warn">${ico('alert')}<div>${esc(c.phase.banner)}</div></div>`;
    if (P.checks.includes(date)) h += `<div class="banner">${ico('log')}<div><strong>Controllo di fine blocco.</strong> Misure, circonferenza spalle e riferimenti di forza: li trovi qui sotto.</div></div>`;
    return h;
  }

  function sessionBlock(date, s, editable) {
    const c = s.c;
    const sess = P.sessions[s.id];
    const rec = dayRec(date, false);
    const variant = (rec && rec.variant) || 'full';
    const list = exercisesFor(s.id, variant);
    const doneN = list.filter((e) => exDone(exLog(rec, e.id))).length;
    S.cur = { date, id: s.id, total: list.length };

    const eyebrow = s.recovery ? `Recupero del sabato · ${sess.name}` : s.forced ? `Scelta da te · ${sess.name}` : `${sess.day} · ${sess.name}`;
    const pills = [];
    if (sess.tag) pills.push(`<span class="pill pill-accent">${esc(sess.tag)}</span>`);
    if (c.deload) pills.push('<span class="pill pill-warn">Scarico</span>');
    if (c.pause) pills.push('<span class="pill pill-warn">Pausa festiva</span>');
    if (variant === 'short') pills.push('<span class="pill">Versione da 30 min</span>');
    if (variant === 'bw') pills.push(`<span class="pill">${esc(P.bodyweight[sess.bodyweight].name)}</span>`);

    let h = `<div class="session-head${s.recovery ? ' sep' : ''}">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h${s.recovery ? 2 : 1} class="h1${s.recovery ? ' h1-s' : ''}">${esc(sess.title)}</h${s.recovery ? 2 : 1}>
      <p class="session-sub">${list.length} esercizi</p>
      ${pills.length ? `<div class="pill-row">${pills.join('')}</div>` : ''}
    </div>`;
    if (s.forced) h += `<button type="button" class="btn btn-plain btn-block" data-act="unforce" style="margin-bottom:12px">Torna alla seduta del calendario</button>`;
    const st = dayStatus(rec);
    h += `<section class="card day-status">
      <div class="kv"><h2 class="card-title" style="margin:0">${date === S.today ? 'Allenamento di oggi' : `Allenamento di ${esc(fmtDay(date))}`}</h2><span class="muted small" id="progress">${doneN} di ${list.length} fatti</span></div>
      <div class="choice">
        <button type="button" class="choice-btn" data-act="day-status" data-v="done" aria-pressed="${st === 'done'}" ${editable ? '' : 'disabled'}>${ico('check')}Fatto</button>
        <button type="button" class="choice-btn bad" data-act="day-status" data-v="skipped" aria-pressed="${st === 'skipped'}" ${editable ? '' : 'disabled'}>Saltato</button>
      </div>
      <p class="muted small" style="margin:10px 0 0">${editable ? 'Si segna fatto da solo quando registri un esercizio. Se oggi non ti alleni, tocca Saltato.' : 'Si segna il giorno stesso.'}</p>
    </section>`;
    h += seg('variant', [['full', 'Completa'], ['short', '30 min'], ['bw', 'Corpo libero']], variant, 'Versione della seduta');
    if (variant === 'bw') h += `<div class="banner">${ico('bag')}<div>${esc(P.bodyweight.rule)}</div></div>`;
    if (variant === 'short') h += `<div class="banner">${ico('timer')}<div>Versione corta per le mattine strette. Rotazioni esterne e face pull restano sempre.</div></div>`;
    if (date === S.today && !recDone(rec)) h += `<div class="banner">${ico('timer')}<div>Caffè doppio 30-45 min prima, niente grassi, fibre o barrette nell'ora prima. ${variant === 'bw' ? '' : esc(P.rules.warmup)}</div></div>`;

    h += list.map((e, i) => exCard(e, c, i, { rec, date, editable, future: !editable })).join('');

    if (sess.push) {
      const sh = rec && rec.shoulder;
      h += `<section class="card">
        <h2 class="card-title">Spalla sinistra oggi</h2>
        <p class="muted small">${esc(shoulderText(date))}</p>
        <div class="choice">
          <button type="button" class="choice-btn" data-act="shoulder" data-v="ok" aria-pressed="${sh === 'ok'}" ${editable ? '' : 'disabled'}>Silenziosa</button>
          <button type="button" class="choice-btn bad" data-act="shoulder" data-v="talked" aria-pressed="${sh === 'talked'}" ${editable ? '' : 'disabled'}>Ha parlato</button>
        </div>
        ${sh === 'talked' ? '<p class="ex-callout" style="margin-top:12px">Il venerdì lo shoulder press è il primo da togliere. Scrivilo nel riepilogo della settimana.</p>' : ''}
      </section>`;
    }

    if (editable) {
      h += `<section class="card">
        <label class="field"><span class="field-l">Nota della seduta</span>
        <textarea class="input" data-note="1" rows="3" placeholder="Come è andata, cosa hai cambiato, cosa dire a Claude">${esc((rec && rec.note) || '')}</textarea></label>
      </section>`;
      h += sendCard('session', date, rec && rec.sentAt);
      const b = P.food.breakfast[Math.abs(dnum(date)) % P.food.breakfast.length];
      h += `<section class="card" style="margin-top:12px"><h2 class="card-title">Dopo: colazione</h2><p>${esc(P.food.breakfastGoal.replace(/^Colazione dopo l'allenamento: /, 'Obiettivo '))}</p><p class="muted">Oggi, per esempio: ${esc(low(b))}</p></section>`;
    }
    return h;
  }

  function restBlock(date, c) {
    const tm = addDays(date, 1);
    const ts = sessionFor(tm);
    const full = c.slot === 'sun';
    const sub = c.pause ? 'Pausa festiva: oggi niente palestra.' : full ? 'Domenica sempre riposo.' : c.wd === 3 ? 'Metà settimana. Recupera, domani si lavora.' : 'Oggi niente palestra.';
    let h = `<div class="session-head">
      <p class="eyebrow">${esc(cap(WD[c.wd]))}</p>
      <h1 class="h1">${full ? 'Riposo completo' : 'Riposo'}</h1>
      <p class="session-sub">${esc(sub)}</p>
    </div>`;
    if (ts) {
      const t = P.sessions[ts.id];
      h += `<section class="card"><p class="eyebrow">${ts.recovery ? 'Domani, recupero del sabato' : 'Domani'}</p><h2 class="card-title" style="margin-top:2px">${esc(t.name)}: ${esc(low(t.title))}</h2>
        <button type="button" class="btn btn-soft btn-block" data-act="goto-date" data-date="${tm}" style="margin-top:10px">Guarda la seduta di domani</button></section>`;
    }
    if (full && c.status === 'in') h += feedbackCard(monday(date));
    return h;
  }

  function feedbackCard(mon) {
    return `<section class="card">
      <h2 class="card-title">Riscontro della settimana</h2>
      <p>Manda a Claude la settimana: carichi e ripetizioni veri, sedute ed esercizi saltati, stato della spalla, carichi reali al posto delle proposte. Serve a ricalibrare la scheda.</p>
      ${emailField()}
      <button type="button" class="btn btn-primary btn-block" data-act="send-week" data-mon="${mon}" style="margin-top:6px">${ico('mail')}Invia la settimana a Claude</button>
      <button type="button" class="btn btn-plain btn-block" data-act="copy-week" data-mon="${mon}" style="margin-top:8px">${ico('copy')}Copia il testo</button>
    </section>`;
  }

  function saturdayBlock(date, c, editable) {
    const rv = recovery(date);
    const chips = rv.req.map((s) => `<button type="button" class="sess-chip" data-act="sat-chip" data-s="${s}" aria-pressed="${rv.done.has(s)}" ${editable ? '' : 'disabled'}><b>${s}</b><span>${esc(P.sessions[s].day.slice(0, 3))}</span></button>`).join('');
    let result;
    if (rv.type === 'pause') {
      result = `<div class="result"><p class="result-k">Pausa festiva</p><p class="result-v">Weekend libero</p><p class="result-s">${rv.missed.length ? `${rv.missed.length > 1 ? 'Saltate' : 'Saltata'}: ${esc(rv.missed.join(', '))}. ${rv.missed.length > 1 ? 'Si perdono' : 'Si perde'}, e va bene così.` : 'Settimana di mantenimento completa.'} Lunedì si riparte.</p></div>`;
    } else if (rv.type === 'free') {
      result = `<div class="result"><p class="result-k">Risultato</p><p class="result-v">Weekend libero</p><p class="result-s">Settimana completa: ${rv.req.length} su ${rv.req.length}.</p></div>`;
    } else {
      const t = P.sessions[rv.session];
      const lost = rv.lost.length ? ` Le altre si perdono: ${rv.lost.join(', ')}.` : '';
      result = `<div class="result"><p class="result-k">Stamattina recuperi</p><p class="result-v">${esc(t.name)}, ${esc(low(t.title))}</p><p class="result-s">Identica, stessi carichi.${esc(lost)}</p></div>`;
    }
    const showCPrev = rv.type === 'recover' && rv.req.includes('C') && rv.missed.includes('C') && rv.missed.length >= 2 && ctx(addDays(monday(date), -7)).status === 'in';
    const predicted = rv.done.size + (rv.type === 'recover' ? 1 : 0);
    let h = `<div class="session-head">
      <p class="eyebrow">${rv.type === 'pause' ? 'Sabato · pausa festiva' : 'Sabato · slot di recupero'}</p>
      <h1 class="h1">${rv.type === 'recover' ? `Recupera la ${esc(P.sessions[rv.session].name)}` : rv.type === 'pause' ? 'Niente recuperi' : 'Weekend libero'}</h1>
      <p class="session-sub">Prima le misure, a digiuno.</p>
    </div>`;
    h += measuresCard(date, editable);
    h += `<section class="card">
      <h2 class="card-title">Quali schede hai fatto questa settimana?</h2>
      <p class="muted small">${rv.manual ? 'Corretto da te.' : 'Preso dal registro. Tocca per correggere.'}${rv.manual ? ' <button type="button" class="link-btn" data-act="sat-reset">Riprendi dal registro</button>' : ''}</p>
      <div class="sess-chips" style="grid-template-columns:repeat(${rv.req.length},1fr)">${chips}</div>
      ${showCPrev ? `<div class="switch-row"><span>La C è saltata anche la settimana scorsa</span><button type="button" class="switch" role="switch" aria-checked="${rv.cPrev}" aria-label="La C è saltata anche la settimana scorsa" data-act="sat-cprev" ${editable ? '' : 'disabled'}></button></div>` : ''}
      ${result}
    </section>`;
    if (threeDayWarning(monday(date), predicted)) h += `<div class="banner banner-danger">${ico('alert')}<div><strong>Due settimane sotto le tre sedute.</strong> Il programma va riscritto su tre giorni: scrivilo a Claude.</div></div>`;
    return { html: h, rv };
  }

  function measuresCard(sat, editable) {
    const isCheck = P.checks.includes(sat);
    const m = DB.measures[sat] || {};
    const fields = P.measures.weekly.concat(isCheck ? P.measures.check : []);
    const avg = weightAvg(sat);
    const grid = fields.map((f) => `<label class="field"><span class="field-l">${esc(f.label)}</span><span class="unit-wrap"><input class="input" type="text" inputmode="decimal" autocomplete="off" maxlength="6" data-m="${esc(f.id)}" data-date="${sat}" value="${esc(m[f.id] || '')}" ${editable ? '' : 'disabled'}><span class="unit">${esc(f.unit)}</span></span></label>`).join('');
    return `<section class="card">
      <h2 class="card-title">${isCheck ? 'Controllo di fine blocco' : dnum(sat) < dnum(P.cycle.start) ? 'Misure di partenza' : 'Misure del sabato'}</h2>
      <p class="muted small">${isCheck ? 'A digiuno. Più circonferenza spalle e i carichi con cui fai 8 ripetizioni.' : 'A digiuno, appena alzato.'} Del peso conta solo la media a 4 settimane.</p>
      <div class="m-grid">${grid}</div>
      <div class="switch-row"><span>${esc(P.measures.photo)}</span><button type="button" class="switch" role="switch" aria-checked="${!!m.foto}" aria-label="${esc(P.measures.photo)} fatte" data-act="m-photo" data-date="${sat}" ${editable ? '' : 'disabled'}></button></div>
      ${avg ? `<p class="muted small" style="margin-top:10px">Media del peso sulle ultime 4 settimane: <b>${fmtN(avg.v)} kg</b> (${avg.n} ${avg.n === 1 ? 'pesata' : 'pesate'}).</p>` : ''}
    </section>`;
  }
  function weightAvg(sat) {
    const vals = [];
    for (let i = 0; i < 4; i++) { const d = addDays(sat, -7 * i); const v = num(DB.measures[d] && DB.measures[d].peso); if (v) vals.push(v); }
    return vals.length ? { v: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
  }

  function eveningCard(date) {
    const wd = wday(date);
    const tm = addDays(date, 1);
    const ts = ctx(tm).status === 'in' ? sessionFor(tm) : null;
    const sup = P.food.supplements;
    const day = sup.filter((x) => !x.evening && !x.trainingOnly).map((x) => x.short).join(', ');
    const eve = sup.filter((x) => x.evening).map((x) => x.short).join(' e ');
    const next = ts ? `Domani: ${P.sessions[ts.id].name}${ts.recovery ? ' (recupero)' : ''}.` : 'Domani niente palestra.';
    return `<section class="card">
      <h2 class="card-title">Stasera a cena</h2>
      <p>${esc(P.food.dinner[wd])}</p>
      <p class="muted small">${esc(next)} ${esc(P.food.dinnerNote)}</p>
      <p class="muted small" style="margin-top:8px">Integratori: ${esc(day)} in giornata; la sera ${esc(eve)}, lontano dal caffè.</p>
    </section>`;
  }

  /* ---------- viste ---------- */

  function viewOggi() {
    const date = S.viewDate;
    const c = ctx(date);
    const editable = dnum(date) <= dnum(S.today);
    S.cur = null;
    let h = '';
    if (c.status === 'before') {
      const left = dnum(P.cycle.start) - dnum(date);
      const first = P.sessions[P.schedule[wday(P.cycle.start)]];
      h += `<div class="session-head"><p class="eyebrow">${esc(P.cycle.name)}</p><h1 class="h1">Si parte ${esc(low(fmtLong(P.cycle.start)))}</h1>
        <p class="session-sub">${left === 1 ? 'Manca un giorno.' : `Mancano ${left} giorni.`} Prima seduta: ${esc(first.name)}, ${esc(low(first.title))}.</p></div>
        <button type="button" class="btn btn-primary btn-block" data-act="goto-date" data-date="${P.cycle.start}" style="margin-bottom:12px">Vedi la ${esc(first.name)} di ${esc(WD[wday(P.cycle.start)])}</button>`;
      if (c.wd === 6 && left <= 7 && editable) h += measuresCard(date, true);
      h += eveningCard(date);
      return h;
    }
    if (c.status === 'after') {
      return `<div class="session-head"><p class="eyebrow">${esc(P.cycle.name)}</p><h1 class="h1">Ciclo concluso</h1>
        <p class="session-sub">Il ciclo è finito il ${esc(fmtDM(P.cycle.end))}. Le schede restano consultabili; per il prossimo ciclo serve un programma nuovo.</p></div>
        <button type="button" class="btn btn-soft btn-block" data-tab="registro">Apri il registro</button>`;
    }
    if (c.status === 'gap') return '<div class="card">Questa data non rientra nel calendario del ciclo.</div>';

    h += banners(c, date);
    let rv = null;
    if (c.slot === 'sat') {
      const sb = saturdayBlock(date, c, editable);
      h += sb.html; rv = sb.rv;
    }
    const s = sessionFor(date);
    if (s) h += sessionBlock(date, s, editable);
    else if (c.slot !== 'sat') h += restBlock(date, c);
    if (c.slot === 'sat' && rv && rv.type === 'free') h += `<div class="banner">${ico('moon')}<div>Niente da recuperare: domani riposo completo.</div></div>`;
    h += eveningCard(date);
    return h;
  }

  function viewSchede() {
    const id = S.schede;
    const sess = P.sessions[id];
    const c = refCtx();
    const list = exercisesFor(id, S.schedeVar);
    let h = seg('schede', ['A', 'B', 'C', 'D'].map((x) => [x, `${x} · ${P.sessions[x].day.slice(0, 3)}`]), id, 'Scheda');
    h += `<div class="session-head"><p class="eyebrow">${esc(sess.day)} · ${esc(sess.name)}</p><h1 class="h1">${esc(sess.title)}</h1>
      <p class="session-sub">${list.length} esercizi${c.ref ? '' : ` · valori della settimana ${c.pause ? 'di pausa' : c.week}`}</p></div>`;
    h += seg('schedeVar', [['full', 'Completa'], ['short', 'Versione da 30 min']], S.schedeVar, 'Versione');
    if (c.deload) h += `<div class="banner banner-warn">${ico('alert')}<div>${esc(P.deload.banner)} Valori già ridotti.</div></div>`;
    if (c.pause) h += `<div class="banner banner-warn">${ico('alert')}<div>Pausa festiva: serie già ridotte di un terzo.</div></div>`;
    h += list.map((e, i) => exCard(e, c, i, { editable: false })).join('');
    const tc = ctx(S.today);
    const todays = tc.status === 'in' ? sessionFor(S.today) : null;
    if (tc.status === 'in' && tc.wd !== 0 && tc.required.includes(id) && (!todays || todays.id !== id)) {
      h += `<button type="button" class="btn btn-soft btn-block" data-act="force" data-s="${id}" style="margin:4px 0 8px">Falla oggi al posto del calendario</button>
        <p class="footer-note" style="margin-top:4px">Ricorda: si recupera il sabato la seduta che manca, mai due sedute in un giorno, mai due giorni di gambe di fila.</p>`;
    }
    h += calendarCard() + rulesCard() + constraintsCard();
    return h;
  }

  function calendarCard() {
    const t = S.today;
    const rows = P.phases.map((p) => {
      const now = between(t, p.from, p.to);
      const detail = p.pause ? 'Solo A e C, serie −33%, carichi fermi' : `Settimane ${p.firstWeek}-${p.firstWeek + 3}, scarico la ${p.deloadWeek}ª`;
      return `<li class="${now ? 'is-now' : ''}"><span class="cal-k">${now ? '<span class="now-dot"></span>' : ''}${esc(p.label)}</span><span class="muted small">${esc(fmtRange(p.from, p.to))}</span><span class="cal-d">${esc(detail)}</span></li>`;
    }).join('');
    const checks = P.checks.map((d) => fmtDay(d)).join(' · ');
    return `<h2 class="h2">Calendario</h2><section class="card"><ul class="list cal">${rows}</ul>
      <p class="muted small" style="margin-top:12px">Controlli con misure e forza: ${esc(checks)}.</p></section>`;
  }
  function rulesCard() {
    const pr = P.priority.map((s) => `<li><b>${s}</b><span>${esc(P.sessions[s].day.slice(0, 3))}</span></li>`).join('');
    return `<h2 class="h2">Sabato e priorità</h2><section class="card">
      <ul class="bullets">${P.rules.saturday.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="field-l" style="margin-top:16px">Scala di priorità</p><ol class="prio">${pr}</ol>
      <p class="muted small" style="margin-top:10px">${esc(P.rules.priorityNote)}</p>
      <p class="muted small">${esc(P.rules.threeDays)}</p></section>
      <h2 class="h2">Come si sale di carico</h2><section class="card"><p>${esc(P.rules.progression)}</p><p class="muted small">${esc(P.rules.warmup)}</p>${P.rules.pump ? `<p class="muted small">${esc(P.rules.pump)}</p>` : ''}</section>`;
  }
  function constraintsCard() {
    return `<h2 class="h2">Vincoli fissi</h2><section class="card"><ul class="bullets">${P.rules.constraints.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>`;
  }

  function viewViaggio() {
    const key = S.viaggio;
    const bw = P.bodyweight[key];
    const c = refCtx();
    let h = `<div class="banner">${ico('bag')}<div>${esc(P.bodyweight.rule)}</div></div>`;
    h += seg('viaggio', [['spinta', 'Spinta'], ['gambe', 'Gambe e dorso']], key, 'Seduta a corpo libero');
    h += `<div class="session-head"><p class="eyebrow">Nessun attrezzo · ${esc(bw.duration)}</p><h1 class="h1">${esc(bw.name.replace(/^Corpo libero · /, ''))}</h1>
      <p class="session-sub">Al posto di ${esc(bw.replaces)}. Per registrarla: in Oggi scegli «Corpo libero».</p></div>`;
    h += bw.exercises.map((e, i) => exCard(e, c, i, { editable: false })).join('');
    return h;
  }

  function viewCibo() {
    const wd = wday(S.today);
    const order = [1, 2, 3, 4, 5, 6, 0];
    const dinners = order.map((d) => `<li class="${d === wd ? 'is-now' : ''}"><span class="dn-day">${esc(cap(WD[d]))}${d === wd ? ', oggi' : ''}</span><span>${esc(P.food.dinner[d])}</span></li>`).join('');
    const sup = P.food.supplements.map((x) => `<li><div style="font-weight:650">${esc(x.name)}${x.dose ? ` · ${esc(x.dose)}` : ''}</div><div class="muted small">${esc(x.when)}</div></li>`).join('');
    return `<section class="card"><p class="eyebrow">Stasera</p><h2 class="card-title" style="margin-top:2px">${esc(P.food.dinner[wd])}</h2><p class="muted small">${esc(P.food.dinnerNote)}</p></section>
      <h2 class="h2">Cena, giorno per giorno</h2><section class="card"><ul class="list dinners">${dinners}</ul></section>
      <h2 class="h2">Prima dell'allenamento</h2><section class="card"><ul class="bullets">${P.food.before.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <h2 class="h2">Colazione dopo</h2><section class="card"><p><b>${esc(P.food.breakfastGoal.replace(/^Colazione dopo l'allenamento: /, 'Obiettivo: '))}</b></p><ul class="bullets">${P.food.breakfast.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <h2 class="h2">Integratori</h2><section class="card"><ul class="list">${sup}</ul></section>
      <section class="card"><ul class="bullets">${P.food.never.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  }

  function viewRegistro() {
    const mon = S.regWeek;
    const sun = addDays(mon, 6);
    const c = ctx(mon);
    const minMon = monday(P.cycle.start);
    const maxMon = monday(dnum(S.today) > dnum(P.cycle.end) ? P.cycle.end : S.today);
    const req = c.status === 'in' ? c.required : ['A', 'B', 'C', 'D'];
    const doneMap = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      if (recDone(DB.days[d])) { const s = loggedSession(d); if (s && !doneMap[s]) doneMap[s] = d; }
    }
    const sr = DB.sat[addDays(mon, 5)];
    if (sr && Array.isArray(sr.done)) sr.done.forEach((s) => { if (!doneMap[s]) doneMap[s] = 'manual'; });
    const count = Object.keys(doneMap).filter((s) => req.includes(s)).length;
    const stats = req.map((s) => `<div class="stat${doneMap[s] ? ' ok' : ''}"><b>${s}</b><span>${doneMap[s] ? (doneMap[s] === 'manual' ? 'fatta' : esc(WD3[wday(doneMap[s])])) : 'manca'}</span></div>`).join('');

    let h = `<div class="week-nav">
      <button type="button" class="icon-btn" data-act="reg-prev" aria-label="Settimana precedente" ${dnum(mon) <= dnum(minMon) ? 'disabled' : ''}>${ico('left')}</button>
      <div class="week-label"><b>${esc(weekLabel(c))}</b><span>${esc(fmtRange(mon, sun))}</span></div>
      <button type="button" class="icon-btn" data-act="reg-next" aria-label="Settimana successiva" ${dnum(mon) >= dnum(maxMon) ? 'disabled' : ''}>${ico('right')}</button>
    </div>`;
    h += `<section class="card"><h2 class="card-title">Sedute: ${count} su ${req.length}</h2><div class="stat-row" style="grid-template-columns:repeat(${req.length},1fr)">${stats}</div>
      ${shoulderWeekLine(mon) ? `<p class="muted small" style="margin-top:12px">${esc(shoulderWeekLine(mon))}</p>` : ''}</section>`;
    if (threeDayWarning(mon, count) && dnum(sun) <= dnum(S.today)) h += `<div class="banner banner-danger">${ico('alert')}<div>${esc(P.rules.threeDays)} Scrivilo a Claude.</div></div>`;

    let days = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const r = DB.days[d];
      const sid = loggedSession(d);
      const st = dayStatus(r);
      const hasAny = !!r && (recHasData(r) || !!r.note || !!r.shoulder || r.done === true || !!r.skipped);
      const missedDay = isMissedDay(d);
      if (!hasAny && !missedDay) continue;
      const note = r && r.note ? `<p class="muted small" style="margin-top:8px">Nota: ${esc(r.note)}</p>` : '';
      if (missedDay && !recHasData(r)) {
        const recd = recoveredOn(d, sid);
        days += `<div class="log-day card is-skipped"><h4>${esc(cap(fmtDay(d)))}${sid ? ` · ${esc(P.sessions[sid].name)}` : ''}</h4>
          <p class="muted small">Saltata${recd ? `, recuperata ${esc(fmtDay(recd))}` : ''}.</p>${note}</div>`;
        continue;
      }
      const lines = [];
      let miss = [];
      if (sid) {
        sessionExercises(sid).forEach((e) => { const l = exLog(r, e.id); const f = effLog(e, l); const t = f ? logText(e, f) : ''; if (t) lines.push(`<div class="log-line"><span>${esc(e.name)}</span><span>${esc(t)}</span></div>`); });
        miss = exercisesFor(sid, (r && r.variant) || 'full').filter((e) => !exDone(exLog(r, e.id))).map((e) => e.name);
      }
      const variant = r && r.variant;
      days += `<div class="log-day card"><h4>${esc(cap(fmtDay(d)))}${sid ? ` · ${esc(P.sessions[sid].name)}` : ''}${variant === 'short' ? ', 30 min' : variant === 'bw' ? ', corpo libero' : ''}${st === 'done' ? '' : ', non segnata come fatta'}</h4>
        ${lines.join('') || '<p class="muted small">Seduta segnata, senza numeri.</p>'}
        ${miss.length ? `<p class="muted small" style="margin-top:8px">Non fatti: ${esc(miss.join(', '))}</p>` : ''}
        ${note}</div>`;
    }
    h += days || `<section class="card"><p class="muted">Niente registrato in questa settimana.</p></section>`;

    h += cycleCard();

    const sat = addDays(mon, 5);
    if (c.status === 'in' || dnum(sat) === dnum(addDays(P.cycle.start, -2))) h += measuresCard(sat, dnum(sat) <= dnum(S.today));

    const text = weekSummary(mon);
    h += `<section class="card"><h2 class="card-title">Invia a Claude</h2><p class="muted small">Si apre Mail con la settimana già scritta: tocchi Invia e Claude la legge da Gmail per ricalibrare la scheda.</p>${emailField(true)}
      <button type="button" class="btn btn-primary btn-block" data-act="send-week" data-mon="${mon}" style="margin-top:6px">${ico('mail')}Invia la settimana a Claude</button>
      <button type="button" class="btn btn-plain btn-block" data-act="copy-week" data-mon="${mon}" style="margin-top:8px">${ico('copy')}Copia il testo</button></section>
      <details class="card" style="margin-top:12px" id="previewBox"><summary>Vedi il testo che copi</summary><pre class="preview" id="previewText">${esc(text)}</pre></details>
      <p class="footer-note">Il registro resta su questo telefono e non arriva a Claude da solo. Apri l'app sempre dall'icona sulla Home: Safari e l'icona tengono due registri separati.</p>`;
    return h;
  }
  function isMissedDay(d) {
    const c = ctx(d);
    if (c.status !== 'in' || !P.sessions[c.slot]) return false;
    const st = dayStatus(DB.days[d]);
    if (st === 'done') return false;
    if (st === 'skipped') return true;
    if (DB.days[d] && DB.days[d].forced) return false;
    return dnum(d) < dnum(S.today);
  }
  function recoveredOn(d, sid) {
    if (!sid) return null;
    const sat = addDays(monday(d), 5);
    if (dnum(sat) <= dnum(d)) return null;
    const r = DB.days[sat];
    return r && recDone(r) && loggedSession(sat) === sid ? sat : null;
  }
  function cycleStats() {
    const last = dnum(S.today) < dnum(P.cycle.end) ? S.today : P.cycle.end;
    if (dnum(last) < dnum(P.cycle.start)) return null;
    const out = { done: 0, extra: 0, skipped: [], miss: {}, seen: {} };
    for (let d = P.cycle.start; dnum(d) <= dnum(last); d = addDays(d, 1)) {
      const c = ctx(d);
      const r = DB.days[d];
      if (dayStatus(r) === 'done') {
        const sid = loggedSession(d);
        if (P.sessions[c.slot] && !(r && r.forced)) out.done++; else out.extra++;
        if (sid) {
          exercisesFor(sid, (r && r.variant) || 'full').forEach((e) => {
            out.seen[e.name] = (out.seen[e.name] || 0) + 1;
            if (!exDone(exLog(r, e.id))) out.miss[e.name] = (out.miss[e.name] || 0) + 1;
          });
        }
      } else if (isMissedDay(d)) {
        const sid = loggedSession(d);
        out.skipped.push({ d, sid, rec: recoveredOn(d, sid) });
      }
    }
    return out;
  }
  function cycleCard() {
    const cs = cycleStats();
    if (!cs) return `<h2 class="h2">Tutto il ciclo</h2><section class="card"><p class="muted">Il conteggio di sedute fatte e saltate parte ${esc(low(fmtLong(P.cycle.start)))}.</p></section>`;
    const recovered = cs.skipped.filter((x) => x.rec).length;
    const skippedList = cs.skipped.slice(-8).reverse().map((x) => `<li class="kv"><span>${esc(cap(fmtDay(x.d)))}${x.sid ? ` · ${esc(P.sessions[x.sid].name)}` : ''}</span><span class="muted small">${x.rec ? `recuperata ${esc(fmtDay(x.rec))}` : 'persa'}</span></li>`).join('');
    const missList = Object.keys(cs.miss).sort((a, b) => cs.miss[b] - cs.miss[a]).slice(0, 6)
      .map((n) => `<li class="kv"><span>${esc(n)}</span><span class="kv-v">${cs.miss[n]} su ${cs.seen[n]}</span></li>`).join('');
    return `<h2 class="h2">Tutto il ciclo finora</h2><section class="card">
      <div class="stat-row" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat ok"><b>${cs.done}</b><span>fatte</span></div>
        <div class="stat"><b>${cs.skipped.length}</b><span>saltate</span></div>
        <div class="stat"><b>${cs.extra}</b><span>recuperi</span></div>
      </div>
      <p class="field-l" style="margin:16px 0 6px">Giorni di allenamento saltati${cs.skipped.length > 8 ? ', gli ultimi 8' : ''}</p>
      ${skippedList ? `<ul class="list">${skippedList}</ul>` : '<p class="muted small">Nessuno finora.</p>'}
      ${cs.skipped.length ? `<p class="muted small" style="margin-top:6px">${recovered} ${recovered === 1 ? "recuperata" : "recuperate"} il sabato.</p>` : ''}
      <p class="field-l" style="margin:16px 0 6px">Esercizi non fatti nelle sedute fatte</p>
      ${missList ? `<ul class="list">${missList}</ul>` : '<p class="muted small">Nessuno finora.</p>'}
    </section>`;
  }
  function sessionExercises(sid) {
    const seen = new Set();
    const out = [];
    const sess = P.sessions[sid];
    sess.exercises.concat(P.bodyweight[sess.bodyweight].exercises).forEach((e) => { if (!seen.has(e.id)) { seen.add(e.id); out.push(e); } });
    return out;
  }
  function shoulderWeekLine(mon) {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const r = DB.days[d];
      if (r && r.shoulder) parts.push(`${fmtDay(d)} ${r.shoulder === 'ok' ? 'silenziosa' : 'ha parlato'}`);
    }
    return parts.length ? `Spalla sinistra: ${parts.join(', ')}.` : '';
  }

  /* ---------- riepilogo da incollare in chat ---------- */

  function weekSummary(mon) {
    const sun = addDays(mon, 6);
    const c = ctx(mon);
    const req = c.status === 'in' ? c.required : ['A', 'B', 'C', 'D'];
    const L = [];
    L.push(`Fiato e Ferro · ${P.cycle.name}`);
    L.push(`${weekLabel(c)} · ${fmtDM(mon)}–${fmtDM(sun)}/${parse(sun).getFullYear()}`);
    const done = {};
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      if (recDone(DB.days[d])) { const s = loggedSession(d); if (s && !done[s]) done[s] = d; }
    }
    const sr = DB.sat[addDays(mon, 5)];
    if (sr && Array.isArray(sr.done)) sr.done.forEach((s) => { if (!done[s]) done[s] = null; });
    const doneIds = req.filter((s) => s in done);
    const missed = req.filter((s) => !(s in done));
    L.push(`Sedute fatte: ${doneIds.length} su ${req.length}${doneIds.length ? ` (${doneIds.map((s) => (done[s] ? `${s} ${fmtDay(done[s])}` : `${s}`)).join(', ')})` : ''}.${missed.length ? ` Mancano: ${missed.join(', ')}.` : ''}`);
    const missedDays = [];
    for (let i = 0; i < 7; i++) { const d = addDays(mon, i); if (isMissedDay(d)) { const sid = loggedSession(d); const recd = recoveredOn(d, sid); missedDays.push(`${fmtDay(d)}${sid ? ` (${sid}${recd ? `, recuperata ${fmtDay(recd)}` : ''})` : ''}`); } }
    if (missedDays.length) L.push(`Giorni di allenamento saltati: ${missedDays.join(', ')}.`);
    const satRec = DB.days[addDays(mon, 5)];
    if (satRec && recDone(satRec) && P.sessions[satRec.session]) L.push(`Sabato: recuperata la ${P.sessions[satRec.session].name}.`);
    const sh = shoulderWeekLine(mon);
    if (sh) { const n = shoulderStreak(sun).n; L.push(`${sh} Silenziosa da ${n} ${n === 1 ? 'seduta' : 'sedute'} di fila.`); }

    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const r = DB.days[d];
      if (!r || (!recHasData(r) && !r.note && !r.done)) continue;
      const sid = loggedSession(d);
      if (!sid) continue;
      if (dayStatus(r) === 'skipped' && !recHasData(r)) { if (r.note) { L.push(''); L.push(`${fmtDay(d).toUpperCase()} · saltata. Nota: ${r.note.replace(/\s+/g, ' ').trim()}`); } continue; }
      const dc = ctx(d);
      const variant = r.variant || 'full';
      const vName = variant === 'short' ? 'versione da 30 min' : variant === 'bw' ? P.bodyweight[P.sessions[sid].bodyweight].name.toLowerCase() : 'completa';
      L.push('');
      L.push(`${fmtDay(d).toUpperCase()} · ${P.sessions[sid].name} (${vName})${recDone(r) ? '' : ', non segnata come fatta'}`);
      const list = exercisesFor(sid, variant);
      const skipped = [];
      list.forEach((e) => {
        const v = resolveEx(e, dc);
        const l = exLog(r, e.id);
        const f = effLog(v, l);
        const t = f ? logText(v, f) + defNote(f) : '';
        const plan = v.cardio ? `${v.duration}, ${v.load}` : `${v.sets} × ${v.reps}, ${v.load}`;
        if (t) L.push(`- ${v.name} (previsto ${plan}): ${t}`);
        else if (exDone(l)) L.push(`- ${v.name} (previsto ${plan}): fatto, senza numeri`);
        else skipped.push(v.name);
      });
      if (skipped.length) L.push(`- Non fatti: ${skipped.join(', ')}`);
      if (r.note) L.push(`Nota: ${r.note.replace(/\s+/g, ' ').trim()}`);
    }

    const cs = cycleStats();
    if (cs) {
      L.push('');
      L.push(`Ciclo finora: ${cs.done} sedute fatte, ${cs.skipped.length} saltate, ${cs.extra} recuperi o spostate.`);
      const top = Object.keys(cs.miss).sort((a, b) => cs.miss[b] - cs.miss[a]).slice(0, 4);
      if (top.length) L.push(`Esercizi saltati più spesso: ${top.map((n) => `${n} ${cs.miss[n]} su ${cs.seen[n]}`).join('; ')}.`);
    }

    const props = [];
    Object.values(P.sessions).forEach((sess) => sess.exercises.forEach((e) => {
      if (!(e.flags || []).includes('proposal')) return;
      let found = null;
      for (let i = 6; i >= 0 && !found; i--) { const l = exLog(DB.days[addDays(mon, i)], e.id); if (l && (l.kg || l.reps)) found = l; }
      props.push(`- ${e.name}: proposta ${e.load}${found ? `, fatto ${logText(e, found)}` : ', non fatto questa settimana'}`);
    }));
    if (props.length) { L.push(''); L.push('Carichi da confermare (proposte):'); props.forEach((p) => L.push(p)); }

    const sat = addDays(mon, 5);
    const m = DB.measures[sat];
    if (m) {
      const all = P.measures.weekly.concat(P.measures.check);
      const parts = all.filter((f) => m[f.id]).map((f) => `${f.label.toLowerCase()} ${commas(m[f.id])} ${f.unit}`);
      if (m.foto) parts.push('foto fatte');
      if (parts.length) {
        L.push('');
        L.push(`Misure ${fmtDay(sat)}: ${parts.join(', ')}.`);
        const avg = weightAvg(sat);
        if (avg) L.push(`Media peso ultime 4 settimane: ${fmtN(avg.v)} kg (${avg.n} pesate).`);
      }
    }
    const baseDate = addDays(P.cycle.start, -2);
    const base = DB.measures[baseDate];
    if (base && mon === monday(P.cycle.start)) {
      const bp = P.measures.weekly.filter((f) => base[f.id]).map((f) => `${f.label.toLowerCase()} ${commas(base[f.id])} ${f.unit}`);
      if (bp.length) { L.push(''); L.push(`Misure di partenza ${fmtDay(baseDate)}: ${bp.join(', ')}.`); }
    }
    if (base && base.vita && m && m.vita && dnum(sat) > dnum(P.cycle.start)) {
      const dv = num(m.vita) - num(base.vita);
      if (Number.isFinite(dv)) L.push(`Vita rispetto alla partenza: ${dv > 0 ? '+' : dv < 0 ? '−' : ''}${fmtN(Math.abs(dv))} cm.`);
    }
    return L.join('\n');
  }

  /* ---------- invio a Claude via email ---------- */

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const userEmail = () => (DB.prefs && typeof DB.prefs.email === 'string' ? DB.prefs.email : '');
  function emailField(always) {
    const e = userEmail();
    if (e && !always) return '';
    return `<label class="field" style="margin:4px 0 10px"><span class="field-l">${e ? 'Indirizzo a cui arriva' : 'La tua email (la chiede solo la prima volta)'}</span>
      <input class="input input-text" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" data-pref="email" value="${esc(e)}" placeholder="nome@gmail.com"></label>`;
  }
  function sendCard(kind, date, sentAt) {
    const when = sentAt ? new Date(sentAt) : null;
    const sentTxt = when ? `Inviata ${dnum(iso(when)) === dnum(date) ? 'alle' : `il ${fmtDM(iso(when))} alle`} ${when.getHours()}:${pad(when.getMinutes())}. Se hai cambiato qualcosa, inviala di nuovo.` : '';
    return `<section class="card send-card">
      <h2 class="card-title">Invia la seduta a Claude</h2>
      <p class="muted small">Si apre Mail con esercizi, serie, ripetizioni e pesi già scritti: tocchi Invia. Claude la legge da Gmail e ogni settimana ricalibra carichi ed effort. Funziona anche senza rete: parte quando torna.</p>
      ${emailField()}
      <button type="button" class="btn btn-primary btn-block" data-act="send-session" data-date="${date}">${ico('mail')}${sentAt ? 'Invia di nuovo' : 'Invia a Claude'}</button>
      ${sentTxt ? `<p class="muted small" style="margin:10px 0 0">${esc(sentTxt)}</p>` : ''}
    </section>`;
  }
  function planOf(v) { return v.cardio ? `${v.duration}` : `${v.sets} × ${v.reps}`; }
  function sessionData(date, sid) {
    const r = DB.days[date];
    const c = ctx(date);
    const variant = (r && r.variant) || 'full';
    const ex = exercisesFor(sid, variant).map((e) => {
      const v = resolveEx(e, c);
      const l = exLog(r, e.id) || {};
      const f = effLog(v, l);
      return {
        id: e.id, name: v.name, plan: planOf(v), load: v.load,
        kg: (f && f.kg) || null, reps: (f && f.reps) || null,
        kgDefault: (f && f.kgDefault) || undefined, repsDefault: (f && f.repsDefault) || undefined,
        sets: f ? f.sets : 0, of: v.sets || null, done: exDone(l), proposal: (v.flags || []).includes('proposal') || undefined,
        pump: v.pumpOn || undefined,
      };
    });
    return {
      v: 1, kind: 'session', date, week: c.pause ? null : c.week, block: c.block, deload: !!c.deload, pause: !!c.pause,
      session: sid, variant, status: dayStatus(r) || 'aperta', shoulder: (r && r.shoulder) || null, note: (r && r.note) || '', ex,
    };
  }
  function sessionMail(date, sid) {
    const d = sessionData(date, sid);
    const sess = P.sessions[sid];
    const c = ctx(date);
    const vName = d.variant === 'short' ? 'versione da 30 min' : d.variant === 'bw' ? P.bodyweight[sess.bodyweight].name.toLowerCase() : 'versione completa';
    const doneN = d.ex.filter((e) => e.done).length;
    const L = [];
    L.push(`Fiato e Ferro · ${P.cycle.name} · seduta`);
    L.push(`${cap(WD[wday(date)])} ${fmtDM(date)}/${parse(date).getFullYear()} · ${weekLabel(c)}`);
    L.push(`${sess.name}, ${low(sess.title)} · ${vName}`);
    L.push(`Stato: ${d.status === 'done' ? 'fatta' : d.status === 'skipped' ? 'saltata' : 'non segnata'} · ${doneN} di ${d.ex.length} esercizi fatti`);
    if (sess.push) L.push(`Spalla sinistra: ${d.shoulder === 'ok' ? 'silenziosa' : d.shoulder === 'talked' ? 'ha parlato' : 'non indicata'}`);
    L.push('');
    const miss = [];
    d.ex.forEach((e) => {
      const src = { kg: e.kg, reps: e.reps, sets: e.sets, setsOf: e.of };
      const base = exercisesFor(sid, d.variant).find((x) => x.id === e.id);
      const t = logText(resolveEx(base, c), src);
      const note = defNote({ kgDefault: e.kgDefault, repsDefault: e.repsDefault });
      if (t) L.push(`- ${e.name} (previsto ${e.plan}, ${e.load}): ${t}${note}${e.done ? '' : ', non completato'}`);
      else if (e.done) L.push(`- ${e.name} (previsto ${e.plan}, ${e.load}): fatto, senza numeri`);
      else miss.push(e.name);
    });
    if (miss.length) L.push(`Non fatti: ${miss.join(', ')}`);
    if (d.note) { L.push(''); L.push(`Nota: ${d.note.replace(/\s+/g, ' ').trim()}`); }
    L.push('');
    L.push('---DATI---');
    L.push(JSON.stringify(d));
    L.push('---FINE---');
    return { subject: `[Fiato e Ferro] Seduta ${fmtDay(date)} · ${sess.name}`, body: L.join('\n') };
  }
  function weekMail(mon) {
    const sun = addDays(mon, 6);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(mon, i);
      const r = DB.days[d];
      const sid = loggedSession(d);
      if (!sid) continue;
      if (r && (recHasData(r) || r.done === true || r.skipped || r.shoulder || r.note)) {
        const sd = sessionData(d, sid);
        sd.ex = sd.ex.filter((e) => e.done || e.kg || e.reps || e.sets);
        days.push(sd);
      } else if (isMissedDay(d)) days.push({ date: d, session: sid, status: 'saltata' });
    }
    const m = DB.measures[addDays(mon, 5)] || null;
    const data = { v: 1, kind: 'week', from: mon, to: sun, days, measures: m };
    const body = `${weekSummary(mon)}\n\n---DATI---\n${JSON.stringify(data)}\n---FINE---`;
    return { subject: `[Fiato e Ferro] Settimana ${fmtRange(mon, sun)}`, body };
  }
  function openMail(to, subject, body) {
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function readEmail(btn) {
    const box = btn.closest('.card');
    const input = box && box.querySelector('input[data-pref="email"]');
    const v = (input ? input.value : userEmail()).trim();
    if (!EMAIL_RE.test(v)) {
      toast('Scrivi prima la tua email: la chiedo solo la prima volta.');
      if (input) input.focus();
      return '';
    }
    if (v !== userEmail()) { DB.prefs.email = v; save(); }
    return v;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fallback sotto */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;left:0;font-size:16px;';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- intestazione e rendering ---------- */

  function renderTop() {
    const top = $('#top');
    if (S.tab === 'oggi') {
      const d = S.viewDate;
      const c = ctx(d);
      const rel = relLabel(d);
      const short = c.status !== 'in' ? weekLabel(c) : c.pause ? `Pausa festiva ${c.pauseWeek}/${c.pauseWeeks}` : `Sett. ${c.week}/12 · ${c.deload ? 'scarico' : c.phase.label}`;
      const meta = c.status === 'before' ? `${rel ? rel + ' · ' : ''}${P.cycle.name} parte ${low(fmtLong(P.cycle.start))}` : `${rel ? rel + ' · ' : ''}${short}`;
      top.innerHTML = `<div class="top-row">
        <button type="button" class="icon-btn" data-act="day-prev" aria-label="Giorno precedente">${ico('left')}</button>
        <div class="top-text"><p class="top-title">${esc(fmtLong(d))}</p><p class="top-meta">${esc(meta)}</p></div>
        ${d !== S.today ? '<button type="button" class="today-btn" data-act="day-today">Oggi</button>' : ''}
        <button type="button" class="icon-btn" data-act="day-next" aria-label="Giorno successivo">${ico('right')}</button>
      </div>`;
    } else {
      const titles = { schede: 'Schede', viaggio: 'Viaggio', registro: 'Registro', cibo: 'Cibo e integratori' };
      const metas = { schede: `${P.cycle.name} · ${weekLabel(ctx(S.today))}`, viaggio: 'Senza attrezzi, 25 minuti', registro: 'Kg, ripetizioni e misure', cibo: 'Cena, colazione, integratori' };
      const tag = S.tab === 'schede' || S.tab === 'viaggio' ? 'p' : 'h1';
      top.innerHTML = `<div class="top-row" style="padding-left:4px"><div class="top-text"><${tag} class="top-title">${esc(titles[S.tab])}</${tag}><p class="top-meta">${esc(metas[S.tab])}</p></div></div>`;
    }
  }

  function footer() {
    return `${storageOK ? '' : `<div class="banner banner-danger" style="margin-top:16px">${ico('alert')}<div>Questo browser non salva il registro: i numeri si perdono alla chiusura. Copia il riepilogo prima di uscire.</div></div>`}
      <p class="footer-note"><b>Allenatore, non medico.</b> ${esc(P.disclaimer.replace(/^Allenatore, non medico\.\s*/, ''))}</p>
      <p class="footer-note" style="margin-top:6px">Programma del ${esc(fmtDM(P.version))} · app ${APP_VERSION}</p>`;
  }

  function render(opts = {}) {
    renderTop();
    const views = { oggi: viewOggi, schede: viewSchede, viaggio: viewViaggio, registro: viewRegistro, cibo: viewCibo };
    const main = $('#main');
    main.innerHTML = `<div class="${opts.fade ? 'view' : ''}">${views[S.tab]()}${footer()}</div>`;
    animateSegs();
    $$('.tab').forEach((t) => { if (t.dataset.tab === S.tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  }
  function go(tab) {
    if (tab === S.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    S.tab = tab;
    if (tab === 'oggi') S.viewDate = S.today;
    render({ fade: true });
    window.scrollTo(0, 0);
  }
  function setDate(d) {
    S.viewDate = d;
    render({ fade: true });
    window.scrollTo(0, 0);
  }

  /* ---------- aggiornamenti mirati (senza ridisegnare mentre scrivi) ---------- */

  function touchRec() {
    const rec = dayRec(S.viewDate, true);
    if (S.cur && S.cur.date === S.viewDate && !rec.forced) rec.session = S.cur.id;
    return rec;
  }
  function refreshCard(id) {
    const rec = DB.days[S.viewDate];
    const done = exDone(exLog(rec, id));
    $$(`[data-card="${CSS.escape(id)}"]`).forEach((card) => {
      card.classList.toggle('is-done', done);
      const b = card.querySelector('.ex-done');
      if (b) b.setAttribute('aria-pressed', String(done));
    });
    refreshProgress();
  }
  function refreshProgress() {
    const p = $('#progress');
    if (!p || !S.cur) return;
    const n = $$('.ex.is-done').length;
    p.textContent = `${n} di ${S.cur.total} fatti`;
    const st = dayStatus(DB.days[S.viewDate]);
    $$('[data-act="day-status"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st)));
  }

  /* ---------- eventi ---------- */

  function onClick(e) {
    const t = e.target.closest('[data-act],[data-tab]');
    if (!t || t.disabled) return;
    if (t.dataset.tab && !t.dataset.act) { go(t.dataset.tab); return; }
    const a = t.dataset.act;
    switch (a) {
      case 'day-prev': setDate(addDays(S.viewDate, -1)); break;
      case 'day-next': setDate(addDays(S.viewDate, 1)); break;
      case 'day-today': setDate(S.today); break;
      case 'goto-date': S.tab = 'oggi'; setDate(t.dataset.date); break;
      case 'seg': {
        const key = t.dataset.key, v = t.dataset.v;
        const segEl = t.closest('.seg');
        S.segFrom[key] = +segEl.dataset.to;
        if (key === 'variant') { const r = dayRec(S.viewDate, true); r.variant = v; save(); }
        else S[key] = v;
        if (key === 'schede') S.segFrom.schedeVar = null;
        render();
        break;
      }
      case 'ex-toggle': {
        const rec = touchRec();
        const id = t.dataset.ex;
        const l = rec.ex[id] || (rec.ex[id] = {});
        l.done = !exDone(l);
        delete l.auto;
        save(); refreshCard(id);
        break;
      }
      case 'set': {
        const rec = touchRec();
        const id = t.dataset.ex;
        const k = +t.dataset.k;
        const total = +t.dataset.total;
        const l = rec.ex[id] || (rec.ex[id] = {});
        const cur = l.sets || 0;
        l.sets = k > cur ? k : k - 1;
        l.setsOf = total;
        if (l.sets >= total && l.done !== true) { l.done = true; l.auto = true; }
        if (l.sets < total && l.auto && !l.kg && !l.reps) { l.done = undefined; l.auto = undefined; }
        if (rec.skipped && l.sets) { rec.skipped = false; if (rec.done === false) rec.done = undefined; }
        save();
        const card = t.closest('.ex');
        if (card) card.querySelectorAll('.set-dot').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.k <= l.sets)));
        refreshCard(id);
        if (l.sets > cur && l.sets < total && card) {
          const chip = card.querySelector('[data-act="timer-start"]');
          if (chip) {
            const presets = chip.dataset.rest.split(',').map(Number);
            timerStart(presets[0], `${chip.dataset.name} · dopo la serie ${l.sets} di ${total}`, presets);
          }
        } else if (l.sets >= total) toast('Esercizio completato.');
        break;
      }
      case 'send-session': {
        const to = readEmail(t);
        if (!to) break;
        const date = t.dataset.date;
        const sid = S.cur && S.cur.date === date ? S.cur.id : loggedSession(date);
        if (!sid) { toast('Niente da inviare per questo giorno.'); break; }
        const rec = touchRec();
        const mail = sessionMail(date, sid);
        rec.sentAt = Date.now();
        save();
        openMail(to, mail.subject, mail.body);
        toast('Si apre Mail: tocca Invia.');
        setTimeout(() => render(), 600);
        break;
      }
      case 'send-week': {
        const to = readEmail(t);
        if (!to) break;
        const mail = weekMail(t.dataset.mon);
        openMail(to, mail.subject, mail.body);
        toast('Si apre Mail: tocca Invia.');
        break;
      }
      case 'day-status': {
        const rec = touchRec();
        const v = t.dataset.v;
        const cur = dayStatus(rec);
        if (v === 'done') {
          if (cur === 'done') rec.done = false; else { rec.done = true; rec.skipped = false; }
        } else if (cur === 'skipped') rec.skipped = false;
        else { rec.skipped = true; rec.done = false; }
        save(); refreshProgress();
        const now = dayStatus(rec);
        toast(now === 'done' ? 'Allenamento segnato come fatto.' : now === 'skipped' ? 'Allenamento segnato come saltato.' : 'Stato tolto.');
        break;
      }
      case 'shoulder': {
        const rec = touchRec();
        rec.shoulder = rec.shoulder === t.dataset.v ? undefined : t.dataset.v;
        save(); render();
        break;
      }
      case 'sat-chip': {
        const rv = recovery(S.viewDate);
        const set = new Set(rv.done);
        const s = t.dataset.s;
        if (set.has(s)) set.delete(s); else set.add(s);
        const sr = DB.sat[S.viewDate] || (DB.sat[S.viewDate] = {});
        sr.done = [...set];
        save(); render();
        break;
      }
      case 'sat-reset': { const sr = DB.sat[S.viewDate]; if (sr) delete sr.done; save(); render(); break; }
      case 'sat-cprev': {
        const rv = recovery(S.viewDate);
        const sr = DB.sat[S.viewDate] || (DB.sat[S.viewDate] = {});
        sr.cPrev = !rv.cPrev;
        save(); render();
        break;
      }
      case 'm-photo': {
        const d = t.dataset.date;
        const m = DB.measures[d] || (DB.measures[d] = {});
        m.foto = !m.foto;
        t.setAttribute('aria-checked', String(!!m.foto));
        save();
        break;
      }
      case 'force': {
        const r = dayRec(S.today, true);
        r.session = t.dataset.s; r.forced = true;
        save();
        S.tab = 'oggi'; setDate(S.today);
        toast(`Oggi: ${P.sessions[r.session].name}.`);
        break;
      }
      case 'unforce': {
        const r = dayRec(S.viewDate, true);
        delete r.forced; delete r.session;
        save(); render();
        break;
      }
      case 'reg-prev': S.regWeek = addDays(S.regWeek, -7); render(); break;
      case 'reg-next': S.regWeek = addDays(S.regWeek, 7); render(); break;
      case 'copy-week': {
        const text = weekSummary(t.dataset.mon);
        copyText(text).then((ok) => {
          if (ok) toast('Copiato. Incollalo in chat a Claude.');
          else {
            toast('Non riesco a copiare: tieni premuto sul testo e copialo.');
            if (!$('#previewBox')) { S.tab = 'registro'; S.regWeek = t.dataset.mon; render(); }
            const box = $('#previewBox');
            if (box) { box.open = true; box.scrollIntoView({ block: 'center' }); }
          }
        });
        break;
      }
      case 'timer-start': {
        const presets = t.dataset.rest.split(',').map(Number);
        timerStart(presets[0], t.dataset.name, presets);
        openSheet();
        break;
      }
      case 'timer-open': openSheet(); break;
      case 'timer-close': closeSheet(); break;
      case 'timer-stop': timerStop(); break;
      case 'timer-add': timerAdd(+t.dataset.sec); break;
      case 'timer-preset': timerStart(+t.dataset.sec, null, null); break;
      case 'timer-sound': toggleSound(); break;
      default: break;
    }
  }

  function onInput(e) {
    const el = e.target;
    if (el.matches('input[data-ex]')) {
      const rec = touchRec();
      const id = el.dataset.ex;
      const l = rec.ex[id] || (rec.ex[id] = {});
      const v = cleanNum(el.value);
      if (v !== el.value) el.value = v;
      l[el.dataset.f] = v;
      if (v && l.done !== true) { l.done = true; l.auto = true; }
      if (v && rec.skipped) { rec.skipped = false; if (rec.done === false) rec.done = undefined; }
      if (!l.kg && !l.reps && l.auto) { delete l.done; delete l.auto; }
      save(); refreshCard(id);
    } else if (el.matches('input[data-m]')) {
      const d = el.dataset.date;
      const v = cleanNum(el.value);
      if (v !== el.value) el.value = v;
      const m = DB.measures[d] || (DB.measures[d] = {});
      m[el.dataset.m] = v;
      save();
    } else if (el.matches('input[data-pref="email"]')) {
      const v = el.value.trim();
      if (!v || EMAIL_RE.test(v)) { DB.prefs.email = v; save(); }
    } else if (el.matches('textarea[data-note]')) {
      const rec = touchRec();
      rec.note = el.value;
      save();
    }
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  /* ---------- timer di recupero ---------- */

  const T = { end: 0, total: 0, running: false, over: false, name: '', presets: [], iv: 0, wake: null, ac: null, hideT: 0 };
  let pill, pillTime, pillBar, sheet, scrim, ring, bigTime, face;

  function setupTimer() {
    pill = $('#timerPill'); pillTime = $('#timerPillTime'); pillBar = $('#timerPillBar');
    sheet = $('#timerSheet'); scrim = $('#sheetScrim'); ring = $('#timerRing'); bigTime = $('#timerTime');
    face = $('.timer-face');
    soundButton();
    let drag = null;
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      drag = { y: e.clientY, dy: 0, t: performance.now(), lastY: e.clientY, lastT: performance.now(), v: 0 };
      sheet.setPointerCapture(e.pointerId);
      sheet.style.transition = 'none';
    });
    sheet.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const now = performance.now();
      let dy = e.clientY - drag.y;
      if (dy < 0) dy = dy * 0.2;
      drag.v = (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
      drag.lastY = e.clientY; drag.lastT = now; drag.dy = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      const { dy, v } = drag;
      drag = null;
      sheet.style.transition = '';
      if (dy > 110 || (dy > 20 && v > 0.5)) closeSheet();
      else sheet.style.transform = '';
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  }
  function renderPresets(cur) {
    const box = $('#timerPresets');
    if (!T.presets || T.presets.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = T.presets.map((s) => `<button type="button" class="chip" data-act="timer-preset" data-sec="${s}" aria-pressed="${s === cur}">${mmss(s)}</button>`).join('');
  }
  function timerStart(secs, name, presets) {
    clearTimeout(T.hideT);
    if (name != null) T.name = name;
    if (presets) T.presets = presets;
    T.total = secs; T.end = Date.now() + secs * 1000; T.running = true; T.over = false;
    $('#timerExercise').textContent = T.name;
    renderPresets(secs);
    pill.hidden = false;
    pill.classList.remove('is-over'); face.classList.remove('is-over');
    $('#timerStop').textContent = 'Stop';
    wakeOn(); audioUnlock();
    clearInterval(T.iv); T.iv = setInterval(tick, 200);
    tick();
  }
  function tick() {
    if (!T.running) return;
    const left = T.end - Date.now();
    if (left <= 0) { timerDone(); return; }
    const txt = mmss(Math.ceil(left / 1000));
    if (pillTime.textContent !== txt) { pillTime.textContent = txt; bigTime.textContent = txt; }
    const frac = Math.min(1, Math.max(0, 1 - left / (T.total * 1000)));
    pillBar.style.transform = `scaleX(${frac})`;
    ring.style.strokeDashoffset = String(CIRC * frac);
  }
  function timerDone() {
    T.running = false; T.over = true;
    clearInterval(T.iv);
    pillTime.textContent = 'Via'; bigTime.textContent = 'Via';
    ring.style.strokeDashoffset = String(CIRC);
    pill.classList.add('is-over'); face.classList.add('is-over');
    $('#timerStop').textContent = 'Chiudi';
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) { /* non supportata */ }
    beep();
    wakeOff();
    T.hideT = setTimeout(() => { if (T.over && sheet.hidden) pill.hidden = true; }, 20000);
  }
  function timerStop() {
    T.running = false; T.over = false;
    clearInterval(T.iv); clearTimeout(T.hideT);
    wakeOff();
    pill.hidden = true;
    closeSheet();
  }
  function timerAdd(sec) {
    if (T.running) {
      T.end = Math.max(Date.now() + 1000, T.end + sec * 1000);
      T.total = Math.max(1, T.total + sec);
      renderPresets(-1);
      tick();
    } else if (sec > 0) timerStart(sec, null, null);
  }
  function openSheet() {
    clearTimeout(T.hideT);
    sheet.classList.remove('is-closing'); scrim.classList.remove('is-closing');
    sheet.style.transform = '';
    scrim.hidden = false; sheet.hidden = false;
    $('#app').inert = true; $('#tabbar').inert = true; pill.inert = true;
    setTimeout(() => { try { $('#timerStop').focus({ preventScroll: true }); } catch (e) { /* ignora */ } }, 50);
  }
  let closeT = 0;
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.style.transform = '';
    $('#app').inert = false; $('#tabbar').inert = false; pill.inert = false;
    sheet.classList.add('is-closing'); scrim.classList.add('is-closing');
    clearTimeout(closeT);
    closeT = setTimeout(() => {
      sheet.hidden = true; scrim.hidden = true;
      sheet.classList.remove('is-closing'); scrim.classList.remove('is-closing');
      if (T.over) pill.hidden = true;
    }, 240);
  }
  async function wakeOn() {
    try {
      if ('wakeLock' in navigator && !T.wake) {
        T.wake = await navigator.wakeLock.request('screen');
        T.wake.addEventListener('release', () => { T.wake = null; });
      }
    } catch (e) { T.wake = null; }
  }
  function wakeOff() { try { if (T.wake) T.wake.release(); } catch (e) { /* ignora */ } T.wake = null; }
  function audioUnlock() {
    if (!DB.prefs.sound) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch (e) { /* non supportato */ }
      T.ac = T.ac || new AC();
      if (T.ac.state === 'suspended') T.ac.resume();
    } catch (e) { /* niente audio */ }
  }
  function beep() {
    if (!DB.prefs.sound || !T.ac) return;
    try {
      const t0 = T.ac.currentTime;
      [0, 0.24, 0.48].forEach((off) => {
        const o = T.ac.createOscillator(), g = T.ac.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.18);
        o.connect(g); g.connect(T.ac.destination);
        o.start(t0 + off); o.stop(t0 + off + 0.2);
      });
    } catch (e) { /* niente audio */ }
  }
  function soundButton() {
    const b = $('#timerSound');
    const on = !!DB.prefs.sound;
    b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `${ico(on ? 'sound' : 'mute')}<span>Suono a fine recupero: ${on ? 'acceso' : 'spento'}</span>`;
  }
  function toggleSound() {
    DB.prefs.sound = !DB.prefs.sound;
    save(); soundButton();
    if (DB.prefs.sound) audioUnlock();
  }

  /* ---------- ciclo di vita ---------- */

  function onVisible() {
    if (document.visibilityState !== 'visible') return;
    if (T.running) { tick(); wakeOn(); }
    const t = todayISO();
    if (t !== S.today) {
      const wasToday = S.viewDate === S.today;
      S.today = t;
      if (wasToday) S.viewDate = t;
      S.regWeek = monday(t);
      render();
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const doReload = () => {
      if (T.running || T.over) { setTimeout(doReload, 3000); return; }
      if (reloading) return;
      reloading = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) doReload(); });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => { /* senza offline */ });
  }

  async function init() {
    loadDB();
    S.today = todayISO();
    S.viewDate = S.today;
    try {
      const r = await fetch('program.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(String(r.status));
      P = await r.json();
    } catch (e) {
      $('#main').innerHTML = '<div class="card"><h2 class="card-title">Non riesco a caricare la scheda</h2><p class="muted">Controlla la connessione e riapri l\'app. Dopo la prima apertura funziona anche offline.</p></div>';
      return;
    }
    const startMon = monday(P.cycle.start), endMon = monday(P.cycle.end), tMon = monday(S.today);
    S.regWeek = dnum(tMon) < dnum(startMon) ? startMon : dnum(tMon) > dnum(endMon) ? endMon : tMon;
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('visibilitychange', onVisible);
    setupTimer();
    render({ fade: true });
    registerSW();
  }

  init();
})();
