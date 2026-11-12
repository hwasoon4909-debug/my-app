// 물 한잔 — 기록은 이 기기 안(localStorage)에만 저장해요.
// 저장 이름은 바꾸지 않아요 (바꾸면 지난 기록이 안 보여요).
const RECORDS_KEY = 'my-app-water-records';   // { "2026-11-12": 3, ... } 날짜별 잔 수
const LAST_KEY = 'my-app-water-last';         // 마지막으로 마신 시간 (숫자)
const SOUND_KEY = 'my-app-water-sound';       // 'off'면 소리 끔
const SETTINGS_KEY = 'my-app-water-settings'; // { goal: 8, cupMl: 250 }
const CUP_SIZES = [150, 200, 250, 300, 350, 500];
const GOAL_MIN = 1;
const GOAL_MAX = 20;
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// ---------- 저장 ----------
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch (e) { return {}; }
}
function saveRecords(r) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch (e) {}
}
function loadLast() {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch (e) { return 0; }
}
function saveLast(t) {
  try {
    if (t) localStorage.setItem(LAST_KEY, String(t));
    else localStorage.removeItem(LAST_KEY);
  } catch (e) {}
}

// ---------- 설정 (하루 목표 · 한 잔의 양) ----------
function cleanSettings(s) {
  const goal = Math.round(Number(s && s.goal));
  const cupMl = Number(s && s.cupMl);
  return {
    goal: goal >= GOAL_MIN && goal <= GOAL_MAX ? goal : 8,
    cupMl: CUP_SIZES.includes(cupMl) ? cupMl : 250
  };
}
function loadSettings() {
  try { return cleanSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch (e) { return cleanSettings(null); }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}
let settings = loadSettings();

// ---------- 시원한 물소리 (음원 파일 없이 직접 만들어요) ----------
let soundOn = true;
try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) {}
let audioCtx = null;

function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// level: 0(비었음) ~ 1(가득) — 찰수록 소리가 높아져요
function playWater(level) {
  if (!soundOn) return;
  const ctx = getAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.22; // 떨어지는 물방울이 닿는 순간에 맞춰요

  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  // 1) "찰랑" — 물 튀는 소리 (거르고 다듬은 잡음)
  const len = Math.floor(ctx.sampleRate * 0.7);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(3200, t0);
  band.frequency.exponentialRampToValueAtTime(700, t0 + 0.55);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.22, t0 + 0.025);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
  noise.connect(band).connect(ng).connect(master);
  noise.start(t0);
  noise.stop(t0 + 0.7);

  // 2) "퐁" — 물방울이 수면에 닿는 소리
  plink(ctx, master, t0, 380 + level * 320, 0.5, 0.16);

  // 3) "보글보글" — 작은 방울 소리 몇 개
  const base = 650 + level * 650;
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = t0 + 0.06 + i * 0.065 + Math.random() * 0.04;
    plink(ctx, master, t, base * (0.75 + Math.random() * 0.7), 0.18 + Math.random() * 0.12, 0.08);
  }
}

function plink(ctx, out, t, freq, vol, dur) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 2.3, t + dur * 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ---------- 날짜 도우미 ----------
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const day = (d.getDay() + 6) % 7; return addDays(startOfDay(d), -day); }
function timeText(t) {
  const d = new Date(t);
  const h = d.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return ampm + ' ' + h12 + ':' + String(d.getMinutes()).padStart(2, '0');
}
function agoText(t) {
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return min + '분 전';
  const h = Math.floor(min / 60);
  if (h < 24) return h + '시간 ' + (min % 60 ? (min % 60) + '분 ' : '') + '전';
  return Math.floor(h / 24) + '일 전';
}
function mlText(ml) { return ml.toLocaleString('ko-KR') + ' mL'; }

// ---------- 화면 요소 ----------
const $ = (id) => document.getElementById(id);
const el = {
  todayDate: $('todayDate'), todayCups: $('todayCups'), todayMl: $('todayMl'),
  progress: $('progress'), water: $('water'), bottleBody: $('bottleBody'), todayMsg: $('todayMsg'),
  todayLast: $('todayLast'), removeBtn: $('removeBtn'), addBtn: $('addBtn'),
  tabWeek: $('tabWeek'), tabMonth: $('tabMonth'), prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
  periodTitle: $('periodTitle'), chart: $('chart'), summary: $('summary'),
  dialog: $('confirmDialog'), confirmTitle: $('confirmTitle'), confirmText: $('confirmText'),
  okBtn: $('okBtn'), cancelBtn: $('cancelBtn'),
  soundBtn: $('soundBtn'),
  settingsBtn: $('settingsBtn'), settingsDialog: $('settingsDialog'), settingsClose: $('settingsClose'),
  goalMinus: $('goalMinus'), goalPlus: $('goalPlus'), goalValue: $('goalValue'),
  cupChips: $('cupChips'), goalTotal: $('goalTotal'),
  exportBtn: $('exportBtn'), importBtn: $('importBtn'), importFile: $('importFile'), backupStatus: $('backupStatus')
};

// ---------- 묻는 창 ("정말 지울까요?" 등) ----------
let askResolve = null;
function ask(title, text, okLabel) {
  if (typeof el.dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(title + '\n' + text));
  }
  el.confirmTitle.textContent = title;
  el.confirmText.textContent = text;
  el.okBtn.textContent = okLabel;
  el.dialog.showModal();
  return new Promise((resolve) => { askResolve = resolve; });
}
function finishAsk(answer) {
  if (el.dialog.open) el.dialog.close();
  if (askResolve) { const r = askResolve; askResolve = null; r(answer); }
}
el.okBtn.addEventListener('click', () => finishAsk(true));
el.cancelBtn.addEventListener('click', () => finishAsk(false));
el.dialog.addEventListener('close', () => finishAsk(false)); // 뒤로가기 · Esc

// ---------- 소리 켜기/끄기 ----------
function renderSound() {
  el.soundBtn.setAttribute('aria-pressed', String(soundOn));
  el.soundBtn.setAttribute('aria-label', soundOn ? '물소리 켜짐' : '물소리 꺼짐');
}
el.soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) {}
  renderSound();
  if (soundOn) playWater(0.3); // 켰을 때 살짝 들려 줘요
});
renderSound();

const WAVE_SVG = '<svg class="wave wave-front" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">' +
  '<path d="M0 10 Q12.5 2 25 10 T50 10 T75 10 T100 10 T125 10 T150 10 T175 10 T200 10 V20 H0 Z"/></svg>';

// 한 잔 누르면: 물방울이 떨어지고, 물이 출렁이고, 거품이 올라와요
function splash(strong) {
  const w = el.water;
  w.classList.remove('slosh');
  void w.offsetWidth;
  w.classList.add('slosh');

  const body = el.bottleBody;
  const waterTop = body.clientHeight - (w.offsetHeight - 30);
  if (strong) {
    const drop = document.createElement('span');
    drop.className = 'drop';
    drop.style.setProperty('--fall', Math.max(20, waterTop) + 'px');
    body.appendChild(drop);
    setTimeout(() => drop.remove(), 500);
  }
  const n = strong ? 6 : 3;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('span');
    const s = 4 + Math.random() * 7;
    b.className = 'bubble';
    b.style.width = b.style.height = s + 'px';
    b.style.left = (15 + Math.random() * 65) + '%';
    b.style.animationDelay = (0.25 + i * 0.09) + 's';
    b.style.setProperty('--rise', -Math.max(30, body.clientHeight - waterTop - 10) + 'px');
    body.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }
}

let view = 'week'; // 'week' 또는 'month'
let offset = 0;    // 0 = 이번 주/이번 달, -1 = 지난 주/지난 달

// ---------- 오늘의 기록 ----------
function renderToday() {
  const now = new Date();
  const goal = settings.goal;
  const records = loadRecords();
  const cups = records[dateKey(now)] || 0;

  el.todayDate.textContent = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 (' + DAY_NAMES[now.getDay()] + ')';
  el.todayCups.textContent = cups;
  el.todayMl.textContent = mlText(cups * settings.cupMl);
  // 물통: 목표면 거의 가득 (물결이 보이도록 94%까지)
  const level = Math.min(1, cups / goal) * 94;
  el.water.style.height = 'calc(' + level + '% + 30px)';
  el.water.classList.toggle('empty', cups === 0);
  el.progress.setAttribute('aria-valuemax', String(goal));
  el.progress.setAttribute('aria-valuenow', String(Math.min(cups, goal)));

  if (cups === 0) el.todayMsg.textContent = '첫 잔 시작해 볼까요?';
  else if (cups < goal / 2) el.todayMsg.textContent = (goal - cups) + '잔만 더 마시면 돼요';
  else if (cups < goal) el.todayMsg.textContent = '거의 다 왔어요! ' + (goal - cups) + '잔 남음';
  else el.todayMsg.textContent = '목표 달성! 오늘 촉촉해요';

  const last = loadLast();
  el.todayLast.textContent = last ? '마지막 한 잔 · ' + agoText(last) + ' (' + timeText(last) + ')' : '아직 기록이 없어요';
  el.removeBtn.disabled = cups === 0;
}

// ---------- 주 / 월 기록 ----------
function summaryHtml(days, records) {
  // 아직 오지 않은 날은 평균에서 빼요
  const today = startOfDay(new Date());
  const past = days.filter((d) => d <= today);
  const total = past.reduce((s, d) => s + (records[dateKey(d)] || 0), 0);
  const avg = past.length ? total / past.length : 0;
  const goalDays = past.filter((d) => (records[dateKey(d)] || 0) >= settings.goal).length;
  return '<div><dt>합계</dt><dd>' + total + '잔</dd></div>' +
         '<div><dt>하루 평균</dt><dd>' + (Math.round(avg * 10) / 10) + '잔</dd></div>' +
         '<div><dt>목표 달성</dt><dd>' + goalDays + '일</dd></div>';
}

function renderWeek() {
  const goal = settings.goal;
  const records = loadRecords();
  const todayKey = dateKey(new Date());
  const start = addDays(mondayOf(new Date()), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];

  el.periodTitle.textContent = offset === 0 ? '이번 주' :
    (start.getMonth() + 1) + '/' + start.getDate() + ' ~ ' + (end.getMonth() + 1) + '/' + end.getDate();

  const max = Math.max(goal, ...days.map((d) => records[dateKey(d)] || 0));
  let html = '<div class="week">';
  days.forEach((d) => {
    const k = dateKey(d);
    const c = records[k] || 0;
    const h = c ? (c / max) * 92 : 0;
    html += '<div class="bar-col' + (k === todayKey ? ' is-today' : '') + '">' +
      '<span class="bar-num">' + (c || '') + '</span>' +
      '<div class="bar-track"><div class="bar' + (c < goal ? ' low' : '') + (c ? '' : ' zero') + '" data-h="' + h + '">' +
      WAVE_SVG + '</div></div>' +
      '<span class="bar-day">' + DAY_NAMES[d.getDay()] + '</span></div>';
  });
  html += '</div>';
  el.chart.innerHTML = html;
  el.summary.innerHTML = summaryHtml(days, records);
  // 작은 물통에 물이 차오르게: 0에서 시작해 높이로
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.chart.querySelectorAll('.bar').forEach((b) => { b.style.height = b.dataset.h + '%'; });
  }));
}

function renderMonth() {
  const goal = settings.goal;
  const records = loadRecords();
  const now = new Date();
  const todayKey = dateKey(now);
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1));

  el.periodTitle.textContent = first.getFullYear() + '년 ' + (first.getMonth() + 1) + '월';

  let html = '<div class="month">';
  ['월', '화', '수', '목', '금', '토', '일'].forEach((n) => { html += '<div class="m-head">' + n + '</div>'; });
  const blanks = (first.getDay() + 6) % 7;
  for (let i = 0; i < blanks; i++) html += '<div class="m-cell m-empty"></div>';
  days.forEach((d) => {
    const k = dateKey(d);
    const c = records[k] || 0;
    let lv = '';
    if (c >= goal) lv = ' lv4';
    else if (c >= goal * 0.75) lv = ' lv3';
    else if (c >= goal * 0.4) lv = ' lv2';
    else if (c > 0) lv = ' lv1';
    html += '<div class="m-cell' + lv + (k === todayKey ? ' is-today' : '') + '" aria-label="' + d.getDate() + '일 ' + c + '잔">' +
      '<span>' + d.getDate() + '</span><span class="m-cups">' + (c || '') + '</span></div>';
  });
  html += '</div>';
  el.chart.innerHTML = html;
  el.summary.innerHTML = summaryHtml(days, records);
}

function renderStats() {
  el.tabWeek.setAttribute('aria-selected', String(view === 'week'));
  el.tabMonth.setAttribute('aria-selected', String(view === 'month'));
  el.nextBtn.disabled = offset >= 0;
  if (view === 'week') renderWeek(); else renderMonth();
}

function renderAll() { renderToday(); renderStats(); }

// ---------- 버튼 ----------
el.addBtn.addEventListener('click', () => {
  const records = loadRecords();
  const k = dateKey(new Date());
  records[k] = (records[k] || 0) + 1;
  saveRecords(records);
  saveLast(Date.now());
  if (navigator.vibrate) navigator.vibrate(30);
  playWater(Math.min(1, records[k] / settings.goal));
  renderAll();
  splash(true);
  el.todayCups.parentElement.classList.remove('pop');
  void el.todayCups.parentElement.offsetWidth;
  el.todayCups.parentElement.classList.add('pop');
});

function removeOne() {
  const records = loadRecords();
  const k = dateKey(new Date());
  if (!records[k]) return;
  records[k] -= 1;
  if (records[k] <= 0) { delete records[k]; saveLast(0); }
  saveRecords(records);
  renderAll();
  splash(false);
}

// 지우기 전에 "정말 지울까요?" 묻기
el.removeBtn.addEventListener('click', () => {
  ask('정말 지울까요?', '오늘 기록에서 한 잔을 뺄게요.\n지우면 되돌릴 수 없어요.', '지우기')
    .then((yes) => { if (yes) removeOne(); });
});

el.tabWeek.addEventListener('click', () => { view = 'week'; offset = 0; renderStats(); });
el.tabMonth.addEventListener('click', () => { view = 'month'; offset = 0; renderStats(); });
el.prevBtn.addEventListener('click', () => { offset -= 1; renderStats(); });
el.nextBtn.addEventListener('click', () => { if (offset < 0) { offset += 1; renderStats(); } });

// ---------- 설정: 하루 목표 · 한 잔의 양 ----------
function renderSettings() {
  el.goalValue.textContent = settings.goal;
  el.goalMinus.disabled = settings.goal <= GOAL_MIN;
  el.goalPlus.disabled = settings.goal >= GOAL_MAX;
  el.cupChips.innerHTML = CUP_SIZES.map((ml) =>
    '<button type="button" class="chip" role="radio" aria-checked="' + (ml === settings.cupMl) + '" data-ml="' + ml + '">' + ml + ' mL</button>'
  ).join('');
  el.goalTotal.textContent = '하루 ' + mlText(settings.goal * settings.cupMl) + '를 목표로 해요';
}
function changeSettings(next) {
  settings = cleanSettings(next);
  saveSettings(settings);
  renderSettings();
  renderAll();
}
el.goalMinus.addEventListener('click', () => changeSettings({ goal: settings.goal - 1, cupMl: settings.cupMl }));
el.goalPlus.addEventListener('click', () => changeSettings({ goal: settings.goal + 1, cupMl: settings.cupMl }));
el.cupChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) changeSettings({ goal: settings.goal, cupMl: Number(chip.dataset.ml) });
});
el.settingsBtn.addEventListener('click', () => {
  renderSettings();
  el.backupStatus.textContent = '';
  if (typeof el.settingsDialog.showModal === 'function') el.settingsDialog.showModal();
});
el.settingsClose.addEventListener('click', () => el.settingsDialog.close());

// ---------- 기록 백업 · 복원 ----------
function backupData() {
  return {
    app: '물 한잔',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settings,
    records: loadRecords(),
    last: loadLast()
  };
}

el.exportBtn.addEventListener('click', () => {
  const name = '물한잔-백업-' + dateKey(new Date()) + '.json';
  const text = JSON.stringify(backupData(), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const done = () => { el.backupStatus.textContent = '백업 파일을 만들었어요: ' + name; };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    done();
  };
  // 휴대폰에서는 공유 창으로 열어서 드라이브 · 파일 앱 등에 저장할 수 있어요
  let file = null;
  try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '물 한잔 백업' })
      .then(done)
      .catch((err) => { if (!err || err.name !== 'AbortError') download(); });
  } else {
    download();
  }
});

el.importBtn.addEventListener('click', () => { el.importFile.value = ''; el.importFile.click(); });

function validRecords(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const out = {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Number.isInteger(v) || v < 0 || v > 200) return null;
    if (v > 0) out[k] = v;
  }
  return out;
}

el.importFile.addEventListener('change', () => {
  const f = el.importFile.files && el.importFile.files[0];
  if (!f) return;
  f.text().then((text) => {
    let data = null;
    try { data = JSON.parse(text); } catch (e) {}
    const records = data && validRecords(data.records);
    if (!records) { el.backupStatus.textContent = '물 한잔 백업 파일이 아니에요. 다른 파일을 골라 주세요.'; return; }
    const days = Object.keys(records).length;
    return ask('기록을 불러올까요?',
      '백업 파일의 ' + days + '일치 기록으로 바꿔요.\n지금 이 휴대폰에 있는 기록은 사라져요.',
      '불러오기')
      .then((yes) => {
        if (!yes) return;
        saveRecords(records);
        saveLast(Number(data.last) || 0);
        if (data.settings) changeSettings(data.settings);
        renderSettings();
        renderAll();
        el.backupStatus.textContent = days + '일치 기록을 불러왔어요.';
      });
  }).catch(() => { el.backupStatus.textContent = '파일을 읽지 못했어요. 다시 해 볼까요?'; });
});

// 앱을 다시 열거나 날짜가 바뀌면 화면을 새로 그려요
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });
setInterval(renderToday, 60000);

renderAll();

// ---------- 웹앱(PWA): 서비스 워커 ----------
if ('serviceWorker' in navigator) {
  // 새 버전이 적용되면 화면을 한 번 자동으로 새로고침해요
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      reg.update();
    }).catch(() => {});
  });
}
