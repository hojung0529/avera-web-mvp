"use strict";

const $ = id => document.getElementById(id);
const all = selector => Array.from(document.querySelectorAll(selector));
const views = {
  angle: ["hardware-studio.jpg", "청색 조명 아래 은색 아베라 기기의 외관 콘셉트", "01"],
  front: ["device-front.jpg", "화면과 버튼이 보이는 기기 정면 콘셉트", "02"],
  side: ["device-side.jpg", "기기의 두께와 연결 단자가 보이는 측면 콘셉트", "03"]
};
const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)");
const studyFilm = $("study-film");
const filmToggle = $("film-toggle");
let filmInView = false;
let playPreference = null;
function updateFilm() {
  const shouldPlay = filmInView && !document.hidden && (playPreference ?? motionOK.matches);
  if (shouldPlay) studyFilm.play().catch(() => {});
  else studyFilm.pause();
}
for (const type of ["play", "pause"]) {
  studyFilm.addEventListener(type, () => { filmToggle.textContent = studyFilm.paused ? "영상 재생" : "일시정지"; });
}
filmToggle.addEventListener("click", () => {
  playPreference = studyFilm.paused;
  filmInView = true;
  updateFilm();
});
if ("IntersectionObserver" in window) new IntersectionObserver(([entry]) => {
  filmInView = entry.isIntersecting;
  updateFilm();
}, {threshold:.25}).observe(studyFilm);
motionOK.addEventListener("change", updateFilm);
document.addEventListener("visibilitychange", updateFilm);
for (const button of all("button[data-view]")) {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    const photo = $("device-image");
    if (document.querySelector(".product").dataset.view === view) return;
    const [src, alt, index] = views[view];
    photo.src = src;
    photo.alt = alt;
    document.querySelector(".product").dataset.view = view;
    $("view-count").textContent = index + " / 03";
    for (const item of all("button[data-view]")) item.setAttribute("aria-pressed", String(item === button));
    if (motionOK.matches) photo.animate([{opacity:.3, transform:"translateX(8px)"}, {opacity:1, transform:"none"}], {duration:320});
  });
}

const spots = {
  a: {name:"A · 정수리 왼쪽", x:.40, y:.46},
  b: {name:"B · 정수리 오른쪽", x:.64, y:.55}
};
// Keep controller arithmetic in whole microlitres and milliseconds.
const settings = {
  total: {label:"총 도포량", min:0, max:2000, tick:10, scale:1000, digits:2, unit:"mL"},
  step: {label:"1포인트", min:1, max:100, tick:1, scale:1000, digits:3, unit:"mL"},
  interval: {label:"도포 간격", min:100, max:2000, tick:100, scale:1000, digits:1, unit:"s"}
};
const capacity = 30000;
const key = "avera.web-experience.v2";
const oldKey = "avera.web-experience.v1";
const initial = () => ({spot:null, mode:"continuous", total:100, step:10, interval:500, amount:0, count:0, tank:capacity, log:[]});
const validSpot = key => Object.hasOwn(spots, key);
const whole = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const validTime = time => typeof time === "string" && Number.isFinite(Date.parse(time));
let canSave = true;

function readState() {
  const clean = initial();
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (!saved) {
      const old = JSON.parse(sessionStorage.getItem(oldKey));
      if (old && validSpot(old.point)) {
        clean.spot = old.point;
        if (["applied", "record"].includes(old.stage) && validTime(old.time)) {
          clean.log.push({spot:old.point, time:old.time, count:1, volume:null, mode:"legacy"});
        }
      }
      return clean;
    }
    for (const [name, spec] of Object.entries(settings)) {
      if (whole(saved[name], spec.min, spec.max) && (saved[name] - spec.min) % spec.tick === 0) clean[name] = saved[name];
    }
    if (validSpot(saved.spot)) clean.spot = saved.spot;
    if (saved.mode === "point") clean.mode = saved.mode;
    if (whole(saved.amount, 0, settings.total.max)) clean.amount = saved.amount;
    if (whole(saved.count, 0, settings.total.max)) clean.count = saved.count;
    if (whole(saved.tank, 0, capacity)) clean.tank = saved.tank;
    if (Array.isArray(saved.log)) clean.log = saved.log.filter(row => row && validSpot(row.spot) &&
      validTime(row.time) && whole(row.count, 1, settings.total.max) &&
      (row.mode === "legacy" && row.volume === null || ["point","continuous"].includes(row.mode) && whole(row.volume, 1, settings.total.max)));
  } catch {
    // The page can also run with storage disabled.
  }
  return clean;
}
let state = readState();
function save() {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
    sessionStorage.removeItem(oldKey);
    canSave = true;
  } catch { canSave = false; }
}

const frame = document.querySelector(".image-frame");
const scalp = frame.querySelector("img");
const points = all("button[data-point]");
const act = $("act");
const panel = $("panel");
const body = $("panel-body");
const ml = n => (n / 1000).toFixed(3);
const scaled = (n, spec) => (n / spec.scale).toFixed(spec.digits);
const modeName = mode => mode === "point" ? "포인트" : "연속";
const dateFormat = new Intl.DateTimeFormat("ko-KR", {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit"});
let timer = null;
let activeInput = null;
let currentEntry = null;

function locateMarkers() {
  if (!scalp.naturalWidth || !frame.clientWidth) return;
  const scale = Math.max(frame.clientWidth / scalp.naturalWidth, frame.clientHeight / scalp.naturalHeight);
  for (const button of points) {
    const spot = spots[button.dataset.point];
    button.style.left = (frame.clientWidth / 2 + scalp.naturalWidth * scale * (spot.x - .5)) + "px";
    button.style.top = (frame.clientHeight / 2 + scalp.naturalHeight * scale * (spot.y - .5)) + "px";
  }
}
function locateLens(lens, spot) {
  const pos = fraction => 100 * (3.6 * fraction - .5) / 2.6 + "%";
  lens.style.backgroundPosition = pos(spot.x) + " " + pos(spot.y);
}
function flash(item, className) {
  item.classList.remove(className);
  void item.offsetWidth;
  item.classList.add(className);
}
function render() {
  const spot = spots[state.spot];
  const counts = {a:0, b:0};
  for (const row of state.log) counts[row.spot] += row.count;
  for (const button of points) {
    button.setAttribute("aria-pressed", String(button.dataset.point === state.spot));
    button.classList.toggle("has-record", counts[button.dataset.point] > 0);
  }
  $("camera-loupe").hidden = !spot;
  if (spot) {
    $("zoom-caption").textContent = state.spot.toUpperCase() + " 지점 확대";
    locateLens(document.querySelector("#camera-loupe .lens"), spot);
  }
  $("spot-label").textContent = spot ? spot.name + " · " + counts[state.spot] + "회" : "위치를 선택하세요";
  for (const button of all("[data-mode]")) button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  for (const [name, spec] of Object.entries(settings)) $(name + "-value").textContent = scaled(state[name], spec) + " " + spec.unit;
  $("plan-count").textContent = "총 " + Math.ceil(state.total / state.step) + "회";
  $("amount").textContent = ml(state.amount);
  $("gauge").setAttribute("aria-label", "회차 누적 " + ml(state.amount) + " mL · 초기화");
  document.querySelector(".meter-face").style.setProperty("--fill", (state.total ? Math.min(100, state.amount * 100 / state.total) : 0) + "%");
  $("remaining").textContent = (state.tank / 1000).toFixed(3) + " / 30 mL";
  $("capacity-count").textContent = state.total ? Math.floor(state.tank / state.total) + "회분" : "—";
  $("tank-level").style.width = state.tank / capacity * 100 + "%";
  $("history-count").textContent = counts.a + counts.b;
  act.disabled = !spot || !state.total;
  $("hint").textContent = !spot ? "두피의 A 또는 B를 선택하세요." :
    !state.total ? "총 도포량을 설정하면 도포 키가 켜집니다." : !state.tank ? "카트리지를 눌러 가상으로 교체하세요." :
    state.amount >= state.total ? "이 회차를 완료했습니다. 누적 게이지를 눌러 다시 시작하세요." :
    state.mode === "point" ? "한 번 누르면 선택한 위치에 1포인트가 기록됩니다." : "도포 키를 누르고 있는 동안 반복하고, 떼면 멈춥니다.";
}
function sync() { save(); render(); }
function stop() {
  clearInterval(timer);
  timer = null;
  activeInput = null;
  currentEntry = null;
  act.classList.remove("pressed");
}
function node(tag, label, className) {
  const el = document.createElement(tag);
  if (label !== undefined) el.textContent = label;
  if (className) el.className = className;
  return el;
}
function button(label, handler, className) {
  const el = node("button", label, className);
  el.type = "button";
  el.addEventListener("click", handler);
  return el;
}
function showPanel(title) {
  stop();
  $("panel-title").textContent = title;
  body.replaceChildren();
  if (!panel.open) panel.showModal();
  $("close-panel").focus();
}
function actions(...buttons) {
  const row = node("div", undefined, "panel-actions");
  row.append(...buttons);
  body.append(row);
}
const close = () => panel.close();
$("close-panel").addEventListener("click", close);
function confirmAction(title, message, label, handler) {
  showPanel(title);
  body.append(node("p", message));
  actions(button("닫기", close), button(label, () => {
    handler();
    sync();
    close();
    $("announce").textContent = label + " 완료";
  }, "confirm"));
}
function resetRound() { state.amount = 0; state.count = 0; }
function roundDialog() {
  confirmAction("회차 누적 초기화", "누적 " + ml(state.amount) + " mL를 초기화합니다. 위치별 기록은 보관됩니다.", "새 회차 시작", resetRound);
}
function replaceDialog() {
  confirmAction("가상 카트리지 교체", "가상 카트리지를 30 mL로 채웁니다. 진행 중인 회차와 기록은 보관됩니다.", "교체하기", () => { state.tank = capacity; });
}
$("gauge").addEventListener("click", roundDialog);
$("replace").addEventListener("click", replaceDialog);

function edit(name) {
  const spec = settings[name];
  showPanel(spec.label + " 설정");
  const form = node("form");
  const label = node("label", spec.label + " (" + spec.unit + ")");
  label.htmlFor = "setting-input";
  const row = node("div", undefined, "stepper");
  const input = node("input");
  input.type = "number";
  input.id = "setting-input";
  input.inputMode = "decimal";
  input.required = true;
  input.min = scaled(spec.min, spec);
  input.max = scaled(spec.max, spec);
  input.step = scaled(spec.tick, spec);
  input.value = scaled(state[name], spec);
  const change = delta => {
    if (!input.value || !input.validity.valid) input.value = scaled(state[name], spec);
    if (delta > 0) input.stepUp(); else input.stepDown();
  };
  const minus = button("−", () => change(-1));
  const plus = button("+", () => change(1));
  minus.setAttribute("aria-label", "한 단계 줄이기");
  plus.setAttribute("aria-label", "한 단계 늘리기");
  row.append(minus, input, plus);
  form.append(label, row, node("p", input.min + " – " + input.max + " " + spec.unit + " · " + input.step + " " + spec.unit + " 단위"));
  const controls = node("div", undefined, "panel-actions");
  const submit = node("button", "적용", "confirm");
  submit.type = "submit";
  controls.append(button("취소", close), submit);
  form.append(controls);
  body.append(form);
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state[name] = Math.round(input.valueAsNumber * spec.scale);
    sync();
    close();
    $("announce").textContent = spec.label + " " + scaled(state[name], spec) + " " + spec.unit + " 적용";
  });
}
for (const item of all("[data-setting]")) item.addEventListener("click", () => edit(item.dataset.setting));

function history() {
  showPanel("내 체험 기록");
  const note = canSave ? "이 탭에 저장된 가상 기록입니다." : "현재 화면에서 확인할 수 있습니다. 새로고침하면 기록이 지워질 수 있습니다.";
  body.append(node("p", state.log.length ? note : "아직 기록이 없습니다. 두피에서 위치를 고르고 도포 키를 눌러보세요."));
  for (const row of [...state.log].reverse()) {
    const record = node("div", undefined, "log-row");
    const lens = node("div", undefined, "lens");
    locateLens(lens, spots[row.spot]);
    const detail = node("div");
    const line = row.mode === "legacy" ? "이전 체험 · 1회" : modeName(row.mode) + " · " + row.count + "회 · 가상 " + ml(row.volume) + " mL";
    const time = node("time", dateFormat.format(new Date(row.time)));
    time.dateTime = row.time;
    detail.append(node("strong", spots[row.spot].name), node("small", line), time);
    record.append(lens, detail);
    body.append(record);
  }
  actions(button("체험 초기화", () => confirmAction("체험을 초기화할까요?", "이 탭의 가상 기록과 설정을 지우고 처음 상태로 돌아갑니다.", "초기화하기", () => { state = initial(); })), button("닫기", close, "confirm"));
}
$("history").addEventListener("click", history);
for (const item of points) item.addEventListener("click", () => {
  stop();
  state.spot = item.dataset.point;
  sync();
  flash(frame, "scanning");
  $("announce").textContent = spots[state.spot].name + " 선택";
});
for (const item of all("[data-mode]")) item.addEventListener("click", () => {
  stop();
  state.mode = item.dataset.mode;
  sync();
});

function pulse() {
  if (!state.tank) { replaceDialog(); return; }
  if (state.amount >= state.total) { roundDialog(); return; }
  const volume = Math.min(state.step, state.total - state.amount, state.tank);
  state.amount += volume;
  state.tank -= volume;
  state.count += 1;
  if (!currentEntry) {
    currentEntry = {spot:state.spot, mode:state.mode, volume:0, count:0, time:new Date().toISOString()};
    state.log.push(currentEntry);
  }
  currentEntry.volume += volume;
  currentEntry.count += 1;
  sync();
  flash(points.find(item => item.dataset.point === state.spot), "fired");
  $("announce").textContent = spots[state.spot].name + " · 이번 회차 " + ml(state.amount) + " mL";
  if (!state.tank) replaceDialog();
  else if (state.amount >= state.total) {
    confirmAction("설정량 도달", "가상으로 " + ml(state.amount) + " mL를 기록했습니다. 새 회차에서도 위치별 기록을 볼 수 있습니다.", "새 회차 시작", resetRound);
  }
}
function start(source) {
  if (activeInput !== null || act.disabled || panel.open) return;
  activeInput = source;
  act.classList.add("pressed");
  pulse();
  if (activeInput !== null && state.mode === "continuous") timer = setInterval(pulse, state.interval);
}
act.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0 || activeInput !== null) return;
  act.setPointerCapture(event.pointerId);
  start(event.pointerId);
});
act.addEventListener("pointermove", event => {
  if (activeInput !== event.pointerId) return;
  const rect = act.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) stop();
});
for (const type of ["pointerup","pointercancel","lostpointercapture"]) {
  act.addEventListener(type, event => { if (activeInput === event.pointerId) stop(); });
}
act.addEventListener("keydown", event => {
  if (![" ", "Enter"].includes(event.key)) return;
  event.preventDefault();
  if (!event.repeat) start("keyboard");
});
act.addEventListener("keyup", event => {
  if ([" ", "Enter"].includes(event.key)) {
    event.preventDefault();
    if (activeInput === "keyboard") stop();
  }
});
act.addEventListener("click", event => {
  if (event.detail === 0 && activeInput === null) { start("assistive"); stop(); }
});
act.addEventListener("contextmenu", event => event.preventDefault());
act.addEventListener("blur", stop);
window.addEventListener("blur", stop);
window.addEventListener("pagehide", stop);
document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
if ("ResizeObserver" in window) new ResizeObserver(locateMarkers).observe(frame);
else window.addEventListener("resize", locateMarkers);
scalp.addEventListener("load", locateMarkers);
locateMarkers();
sync();
