"use strict";

const views = {
  angle: ["device-angle.jpg", "비스듬히 본 은색 아베라 기기 외관 콘셉트", "01"],
  front: ["device-front.jpg", "디스플레이와 버튼이 보이는 아베라 정면 콘셉트", "02"],
  side: ["device-side.jpg", "연결 단자가 보이는 아베라 측면 콘셉트", "03"]
};
const figure = document.querySelector(".product");
const device = document.getElementById("device-image");
const viewButtons = [...document.querySelectorAll("button[data-view]")];
viewButtons.forEach(button => button.addEventListener("click", () => {
  const view = button.dataset.view;
  const [src, alt, index] = views[view];
  device.src = src;
  device.alt = alt;
  figure.dataset.view = view;
  document.getElementById("view-count").textContent = index + " / 03";
  viewButtons.forEach(option => option.setAttribute("aria-pressed", String(option === button)));
}));

const spots = {
  a: {label: "A · 정수리 왼쪽", x: 0.40, y: 0.46},
  b: {label: "B · 정수리 오른쪽", x: 0.64, y: 0.55}
};
const key = "avera.web-experience.v1";
const initial = () => ({point: null, stage: "select", time: null});
const get = id => document.getElementById(id);
const points = [...document.querySelectorAll(".point")];
const frame = document.querySelector(".image-frame");
const photo = frame.querySelector("img");
let hasStorage = true;
let state = readState();

function readState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    if (!saved || !Object.hasOwn(spots, saved.point)) return initial();
    if (saved.stage === "select") return {point: saved.point, stage: "select", time: null};
    if (["applied", "record"].includes(saved.stage) && typeof saved.time === "string"
        && Number.isFinite(Date.parse(saved.time))) return saved;
  } catch {
    // A browser may disable storage for files or private sessions.
  }
  return initial();
}
function save() {
  try {
    if (!state.point) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(state));
    hasStorage = true;
  } catch {
    hasStorage = false;
  }
}
function locateMarkers() {
  if (!photo.naturalWidth || !frame.clientWidth) return;
  const width = frame.clientWidth;
  const height = frame.clientHeight;
  const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
  const drawWidth = photo.naturalWidth * scale;
  const drawHeight = photo.naturalHeight * scale;
  for (const button of points) {
    const spot = spots[button.dataset.point];
    button.style.left = ((width - drawWidth) / 2 + drawWidth * spot.x) + "px";
    button.style.top = ((height - drawHeight) / 2 + drawHeight * spot.y) + "px";
  }
}
function render() {
  const spot = spots[state.point];
  const applied = state.stage === "applied";
  const recorded = state.stage === "record";
  const step = state.stage === "select" && !spot ? 0 : recorded ? 2 : 1;
  [...document.querySelectorAll(".steps li")].forEach((item, index) => {
    if (index === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  points.forEach(button => {
    button.disabled = state.stage !== "select";
    button.setAttribute("aria-pressed", String(button.dataset.point === state.point));
  });
  get("live-detail").hidden = recorded;
  get("receipt").hidden = !recorded;
  get("reset").hidden = !recorded && !applied;
  get("act").disabled = !spot;
  get("camera-loupe").hidden = !spot;
  get("zoom-caption").textContent = spot ? state.point.toUpperCase() + " 지점 확대" : "";
  frame.classList.toggle("has-record", Boolean(state.time));
  for (const lens of document.querySelectorAll(".lens")) {
    lens.classList.toggle("selected", Boolean(spot));
    if (spot) {
      const zoom = 3.6;
      const position = fraction => 100 * (zoom * fraction - 0.5) / (zoom - 1) + "%";
      lens.style.backgroundPosition = position(spot.x) + " " + position(spot.y);
    } else lens.style.removeProperty("background-position");
  }
  get("detail-title").textContent = spot ? spot.label : "지점을 선택하세요";
  get("detail-note").textContent = spot ? "선택 위치 확대 · 설정량 예시" : "선택한 위치가 여기에 표시됩니다.";
  get("monitor-status").textContent = spot ? spot.label + (state.time ? " · 모의 작동 1회" : " · 선택됨") : "위치 선택 대기";
  const title = recorded ? "방금 고른 위치가 남았어요." : applied ? "한 번의 작동을 기록했어요." : spot ? "이 위치에서 가상 도포해 보세요." : "어디에 도포해 볼까요?";
  get("task-title").textContent = title;
  get("task-desc").textContent = recorded ? "따로 촬영하거나 메모하지 않아도 위치, 예시 이미지, 시각을 한 건에서 확인할 수 있어요." : applied ? "사진을 찍거나 메모할 필요 없이, 방금 고른 지점이 어떻게 남았는지 열어보세요." : spot ? "예시 설정이 준비됐어요. 아래 버튼을 누르면 선택한 지점에 모의 작동 한 건이 남습니다." : "사진 속 A 또는 B를 눌러보세요. 선택한 지점의 두피 모습을 확대해 볼 수 있어요.";
  get("act").textContent = recorded ? "개발 계획과 가격 보기" : applied ? "내 체험 기록 보기" : "가상 도포";
  get("session-note").textContent = !hasStorage ? "현재 브라우저에서는 이 화면을 닫거나 새로고침하면 기록이 지워집니다." : state.time ? "예시 기록은 현재 탭에만 저장됩니다." : "로그인·카메라 권한 없이 체험할 수 있어요.";
  if (recorded) {
    get("record-place").textContent = spot.label;
    get("record-time").textContent = new Intl.DateTimeFormat("ko-KR", {dateStyle:"medium", timeStyle:"medium"}).format(new Date(state.time));
  }
}
points.forEach(button => button.addEventListener("click", () => {
  if (state.stage !== "select") return;
  state.point = button.dataset.point;
  save();
  render();
  get("announce").textContent = spots[state.point].label + " 선택. 가상 도포를 누를 수 있습니다.";
}));
get("act").addEventListener("click", event => {
  if (!state.point || event.detail > 1) return;
  if (state.stage === "record") {
    window.location.hash = "development";
    get("development-title").setAttribute("tabindex", "-1");
    get("development-title").focus({preventScroll:true});
    return;
  }
  if (state.stage === "select") {
    state.time = new Date().toISOString();
    state.stage = "applied";
  } else state.stage = "record";
  save();
  render();
  get("task-title").focus({preventScroll:true});
  get("announce").textContent = get("task-title").textContent;
});
get("reset").addEventListener("click", () => {
  state = initial();
  save();
  render();
  points[0].focus();
  get("announce").textContent = "체험을 초기화했습니다. 지점을 다시 선택하세요.";
});
if (typeof ResizeObserver === "function") new ResizeObserver(locateMarkers).observe(frame);
else window.addEventListener("resize", locateMarkers);
photo.addEventListener("load", locateMarkers);
locateMarkers();
render();
