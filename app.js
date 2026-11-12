// 물 한잔 — 기록은 이 기기 안(localStorage)에만 저장해요.
// 저장 이름은 바꾸지 않아요 (바꾸면 지난 기록이 안 보여요).
const RECORDS_KEY = 'my-app-water-records'; // { "2026-11-12": 3, ... }
const LAST_KEY = 'my-app-water-last';       // 마지막으로 마신 시간 (숫자)
const ML_PER_CUP = 250;
const GOAL = 8;
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

// ---------- 화면 요소 ----------
const $ = (id) => document.getElementById(id);
const el = {
  todayDate: $('todayDate'), todayCups: $('todayCups'), todayMl: $('todayMl'),
  progress: $('progress'), progressFill: $('progressFill'), todayMsg: $('todayMsg'),
  todayLast: $('todayLast'), removeBtn: $('removeBtn'), addBtn: $('addBtn'),
  tabWeek: $('tabWeek'), tabMonth: $('tabMonth'), prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
  periodTitle: $('periodTitle'), chart: $('chart'), summary: $('summary'),
  dialog: $('confirmDialog'), okBtn: $('okBtn'), cancelBtn: $('cancelBtn')
};

let view = 'week'; // 'week' 또는 'month'
let offset = 0;    // 0 = 이번 주/이번 달, -1 = 지난 주/지난 달

// ---------- 오늘의 기록 ----------
function renderToday() {
  const now = new Date();
  const records = loadRecords();
  const cups = records[dateKey(now)] || 0;

  el.todayDate.textContent = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + DAY_NAMES[now.getDay()] + '요일';
  el.todayCups.textContent = cups;
  el.todayMl.textContent = (cups * ML_PER_CUP) + ' mL 마셨어요';
  el.progressFill.style.width = Math.min(100, (cups / GOAL) * 100) + '%';
  el.progress.setAttribute('aria-valuenow', String(cups));

  if (cups === 0) el.todayMsg.textContent = '오늘 첫 잔을 마셔 볼까요?';
  else if (cups < GOAL) el.todayMsg.textContent = '목표까지 ' + (GOAL - cups) + '잔 남았어요';
  else el.todayMsg.textContent = '오늘 목표 ' + GOAL + '잔 달성! 잘했어요';

  const last = loadLast();
  el.todayLast.textContent = last ? '마지막 한 잔: ' + timeText(last) + ' · ' + agoText(last) : '';
  el.removeBtn.disabled = cups === 0;
}

// ---------- 주 / 월 기록 ----------
function summaryHtml(days, records) {
  // 아직 오지 않은 날은 평균에서 빼요
  const today = startOfDay(new Date());
  const past = days.filter((d) => d <= today);
  const total = past.reduce((s, d) => s + (records[dateKey(d)] || 0), 0);
  const avg = past.length ? total / past.length : 0;
  const goalDays = past.filter((d) => (records[dateKey(d)] || 0) >= GOAL).length;
  return '<div><dt>합계</dt><dd>' + total + '잔</dd></div>' +
         '<div><dt>하루 평균</dt><dd>' + (Math.round(avg * 10) / 10) + '잔</dd></div>' +
         '<div><dt>목표 달성</dt><dd>' + goalDays + '일</dd></div>';
}

function renderWeek() {
  const records = loadRecords();
  const todayKey = dateKey(new Date());
  const start = addDays(mondayOf(new Date()), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = days[6];

  el.periodTitle.textContent = offset === 0 ? '이번 주' :
    (start.getMonth() + 1) + '/' + start.getDate() + ' ~ ' + (end.getMonth() + 1) + '/' + end.getDate();

  const max = Math.max(GOAL, ...days.map((d) => records[dateKey(d)] || 0));
  let html = '<div class="week">';
  days.forEach((d) => {
    const k = dateKey(d);
    const c = records[k] || 0;
    html += '<div class="bar-col' + (k === todayKey ? ' is-today' : '') + '">' +
      '<span class="bar-num">' + (c || '') + '</span>' +
      '<div class="bar-track"><div class="bar' + (c < GOAL ? ' low' : '') + '" style="height:' + (c / max * 100) + '%"></div></div>' +
      '<span class="bar-day">' + DAY_NAMES[d.getDay()] + '</span></div>';
  });
  html += '</div>';
  el.chart.innerHTML = html;
  el.summary.innerHTML = summaryHtml(days, records);
}

function renderMonth() {
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
    if (c >= GOAL) lv = ' lv4';
    else if (c >= GOAL * 0.75) lv = ' lv3';
    else if (c >= GOAL * 0.4) lv = ' lv2';
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
  renderAll();
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
}

// 지우기 전에 "정말 지울까요?" 묻기
el.removeBtn.addEventListener('click', () => {
  if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
  else if (window.confirm('정말 지울까요?')) removeOne();
});
el.okBtn.addEventListener('click', () => { el.dialog.close(); removeOne(); });
el.cancelBtn.addEventListener('click', () => el.dialog.close());

el.tabWeek.addEventListener('click', () => { view = 'week'; offset = 0; renderStats(); });
el.tabMonth.addEventListener('click', () => { view = 'month'; offset = 0; renderStats(); });
el.prevBtn.addEventListener('click', () => { offset -= 1; renderStats(); });
el.nextBtn.addEventListener('click', () => { if (offset < 0) { offset += 1; renderStats(); } });

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
