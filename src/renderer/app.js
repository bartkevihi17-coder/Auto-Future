const { ipcRenderer } = require("electron");

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");

const sidebarToggle = document.querySelector("#sidebar-toggle");
const lineSidebar = document.querySelector("#line-sidebar");
const logoutButton = document.querySelector("#logout-button");
const pageTitle = document.querySelector("#page-title");

const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const recordUrl = document.querySelector("#record-url");
const recordName = document.querySelector("#record-name");
const headlessInput = document.querySelector("#headless-input");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const events = document.querySelector("#events");
const eventCountElement = document.querySelector("#event-count");
const recordingWarningModal = document.querySelector("#recording-warning-modal");
const recordWarningCancel = document.querySelector("#record-warning-cancel");
const recordWarningContinue = document.querySelector("#record-warning-continue");

const editorEmpty = document.querySelector("#editor-empty");
const editorWorkspace = document.querySelector("#editor-workspace");
const editorTitle = document.querySelector("#editor-title");
const recordingVideo = document.querySelector("#recording-video");
const videoMissing = document.querySelector("#video-missing");
const timelineActions = document.querySelector("#timeline-actions");
const timelineRuler = document.querySelector("#timeline-ruler");
const timelineDuration = document.querySelector("#timeline-duration");
const timelineScroll = document.querySelector("#timeline-scroll");
const timelineCanvas = document.querySelector("#timeline-canvas");
const timelinePlayhead = document.querySelector("#timeline-playhead");
const timelinePlay = document.querySelector("#timeline-play");
const timelineBack = document.querySelector("#timeline-back");
const timelineForward = document.querySelector("#timeline-forward");
const timelineZoomIn = document.querySelector("#timeline-zoom-in");
const timelineZoomOut = document.querySelector("#timeline-zoom-out");
const timelineZoomLabel = document.querySelector("#timeline-zoom-label");

const playerPlay = document.querySelector("#player-play");
const playerMute = document.querySelector("#player-mute");
const playerCurrent = document.querySelector("#player-current");
const playerTotal = document.querySelector("#player-total");
const playerProgress = document.querySelector("#player-progress");

const inspectorType = document.querySelector("#inspector-type");
const inspectorDelay = document.querySelector("#inspector-delay");
const inspectorSelector = document.querySelector("#inspector-selector");
const inspectorValue = document.querySelector("#inspector-value");
const deleteActionButton = document.querySelector("#delete-action-button");
const saveEditorButton = document.querySelector("#save-editor-button");

const executionTitle = document.querySelector("#execution-title");
const executionName = document.querySelector("#execution-name");
const executionMeta = document.querySelector("#execution-meta");
const executionStartButton = document.querySelector("#execution-start-button");
const executionProgressValue = document.querySelector("#execution-progress-value");
const executionProgressLabel = document.querySelector("#execution-progress-label");
const executionProgressStep = document.querySelector("#execution-progress-step");
const executionDialTrack = document.querySelector("#execution-dial-track");
const executionDialLit = document.querySelector("#execution-dial-lit");
const executionDialHead = document.querySelector("#execution-dial-head");
const executionCometPaths = [...document.querySelectorAll("#execution-dial-comet path")];

const rubberTrack = document.querySelector(".rubber-segment");
const rubberThumb = document.querySelector(".rubber-segment__thumb");
const rubberItems = [...document.querySelectorAll(".rubber-segment__item")];
const sideItems = [...document.querySelectorAll(".line-sidebar__item")];

let eventCount = 0;
let sidebarCollapsed = false;
let currentRecording = null;
let selectedActionId = null;
let rubberActiveIndex = 0;
let rubberDrag = null;
let suppressRubberClick = false;

let sidebarRaf = null;
let sidebarLast = performance.now();
const sidebarTargets = sideItems.map((_, index) => (index === 0 ? 1 : 0));
const sidebarCurrent = [...sidebarTargets];

let timelineZoom = 1;
let timelineActionDurationMs = 1000;

const pageNames = {
  home: "Início",
  recording: "Gravação",
  editor: "Editor",
  execution: "Execução",
  recordings: "Gravações",
  schedules: "Agendamentos",
  runs: "Histórico",
};

function setStatus(text, kind = "idle") {
  statusText.textContent = text;
  status.className = "status " + kind;
}

function setSidebarCollapsed(collapsed) {
  sidebarCollapsed = collapsed;
  appShell.classList.toggle("sidebar-collapsed", collapsed);
  sidebarToggle.querySelector("span").textContent = collapsed ? "›" : "‹";
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");

  if (!collapsed) startSidebarAnimation();
}

function collapseSidebarForNavigation() {
  if (!sidebarCollapsed) setSidebarCollapsed(true);
}

function pageToRubberIndex(name) {
  const index = rubberItems.findIndex((item) => item.dataset.page === name);
  return index >= 0 ? index : rubberActiveIndex;
}

function measureRubber() {
  if (!rubberTrack || !rubberThumb || !rubberItems.length) return;

  const item = rubberItems[rubberActiveIndex];
  if (!item) return;

  const trackRect = rubberTrack.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const inset = 3;

  rubberThumb.style.width = itemRect.width + "px";
  rubberThumb.style.height = itemRect.height + "px";
  rubberThumb.style.transform =
    "translate3d(" + (itemRect.left - trackRect.left - inset) + "px, 0, 0)";
}

function setRubberIndex(index, animate = true) {
  if (index < 0 || index >= rubberItems.length) return;

  rubberActiveIndex = index;
  rubberTrack.classList.toggle("no-transition", !animate);

  rubberItems.forEach((item, itemIndex) => {
    const active = itemIndex === index;
    item.classList.toggle("active", active);
    item.setAttribute("aria-checked", active ? "true" : "false");
    item.tabIndex = active ? 0 : -1;
  });

  measureRubber();

  if (!animate) {
    requestAnimationFrame(() => rubberTrack.classList.remove("no-transition"));
  }
}

function updateNavigationState(name) {
  sideItems.forEach((item, index) => {
    const active = name !== "execution" && item.dataset.page === name;
    item.classList.toggle("active", active);
    sidebarTargets[index] = active ? 1 : 0;
  });

  if (name === "execution") {
    rubberItems.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-checked", "false");
      item.tabIndex = -1;
    });
  } else {
    setRubberIndex(pageToRubberIndex(name));
  }

  startSidebarAnimation();
}

function openPage(name, options = {}) {
  if (!pageNames[name]) return;

  document.querySelectorAll("[data-page-view]").forEach((page) => {
    page.classList.toggle("active", page.dataset.pageView === name);
  });

  pageTitle.textContent = pageNames[name];
  updateNavigationState(name);

  if (options.collapse !== false) {
    collapseSidebarForNavigation();
  }
}

function addEvent(action) {
  if (eventCount === 0) events.innerHTML = "";

  eventCount += 1;
  eventCountElement.textContent = String(eventCount);

  const row = document.createElement("div");
  row.className = "event-row";

  const type = document.createElement("strong");
  type.textContent = action.type.toUpperCase();

  const detail = document.createElement("span");
  detail.textContent = action.selector || action.url || "";

  const delay = document.createElement("small");
  delay.textContent = action.delayMs + " ms";

  row.append(type, detail, delay);
  events.prepend(row);
}

function resetEventList() {
  eventCount = 0;
  eventCountElement.textContent = "0";
  events.innerHTML = '<p class="empty">Aguardando suas ações no navegador...</p>';
}

function cumulativeTimes(actions) {
  let total = 0;

  return actions.map((action) => {
    total += Math.max(0, Number(action.delayMs) || 0);
    return total;
  });
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(1) + "s";
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return minutes + ":" + String(secs).padStart(2, "0");
}

function actionLabel(action) {
  if (action.type === "click") return "Clique";
  if (action.type === "input") return "Digitação";
  if (action.type === "navigate") return "Navegação";
  return action.type;
}

function updateVideoUI() {
  const current = Number(recordingVideo.currentTime) || 0;
  const total = Number(recordingVideo.duration) || 0;
  const fraction = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;

  playerCurrent.textContent = formatClock(current);
  playerTotal.textContent = formatClock(total);
  playerProgress.value = String(Math.round(fraction * 1000));
  playerProgress.style.setProperty("--progress", fraction * 100 + "%");

  playerPlay.textContent = recordingVideo.paused ? "▶" : "❚❚";
  timelinePlay.textContent = recordingVideo.paused ? "▶" : "❚❚";

  timelinePlayhead.style.left = fraction * 100 + "%";
}

function togglePlayback() {
  if (!recordingVideo.src) return;

  if (recordingVideo.paused) {
    void recordingVideo.play();
  } else {
    recordingVideo.pause();
  }
}

function seekRelative(deltaSeconds) {
  const total = Number(recordingVideo.duration) || 0;
  if (!total) return;

  recordingVideo.currentTime = Math.max(
    0,
    Math.min(total, (Number(recordingVideo.currentTime) || 0) + deltaSeconds)
  );
}

function applyTimelineZoom() {
  const widthPercent = Math.round(timelineZoom * 100);
  timelineCanvas.style.width = widthPercent + "%";
  timelineZoomLabel.textContent = widthPercent + "%";
}

function renderTimeline() {
  if (!currentRecording) return;

  const actions = currentRecording.actions || [];
  const times = cumulativeTimes(actions);

  timelineActionDurationMs = Math.max(times[times.length - 1] || 0, 1000);
  timelineDuration.textContent = formatSeconds(timelineActionDurationMs);

  timelineActions.innerHTML = "";
  timelineRuler.innerHTML = "";

  for (let i = 0; i <= 8; i += 1) {
    const tick = document.createElement("span");
    tick.style.left = (i * 12.5) + "%";
    tick.textContent = formatSeconds((timelineActionDurationMs * i) / 8);
    timelineRuler.appendChild(tick);
  }

  actions.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "timeline-action action-" + action.type;
    button.dataset.actionId = action.id;
    button.classList.toggle("selected", action.id === selectedActionId);

    const left = Math.min(96, Math.max(0, (times[index] / timelineActionDurationMs) * 100));
    button.style.left = left + "%";

    const icon = action.type === "click" ? "●" : action.type === "input" ? "⌨" : "↗";
    button.innerHTML =
      "<strong>" + icon + " " + actionLabel(action) + "</strong>" +
      "<small>" + formatSeconds(times[index]) + "</small>";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectAction(action.id);

      const videoTotal = Number(recordingVideo.duration) || 0;
      if (videoTotal) {
        recordingVideo.currentTime = Math.min(videoTotal, times[index] / 1000);
      }
    });

    timelineActions.appendChild(button);
  });

  applyTimelineZoom();
}

function selectAction(actionId) {
  selectedActionId = actionId;
  const action = currentRecording?.actions?.find((item) => item.id === actionId);

  if (!action) {
    inspectorType.textContent = "Selecione uma ação";
    inspectorDelay.value = "";
    inspectorSelector.value = "";
    inspectorValue.value = "";

    inspectorDelay.disabled = true;
    inspectorSelector.disabled = true;
    inspectorValue.disabled = true;
    deleteActionButton.disabled = true;

    renderTimeline();
    return;
  }

  inspectorType.textContent = actionLabel(action);

  inspectorDelay.disabled = false;
  inspectorDelay.value = String(action.delayMs ?? 0);

  inspectorSelector.disabled = false;
  inspectorSelector.value =
    action.type === "navigate" ? action.url || "" : action.selector || "";

  inspectorValue.disabled = action.type !== "input" || action.isSecret;
  inspectorValue.value = action.isSecret ? "" : action.value || "";

  deleteActionButton.disabled = false;
  renderTimeline();
}

function updateSelectedAction() {
  if (!currentRecording || !selectedActionId) return;

  const action = currentRecording.actions.find((item) => item.id === selectedActionId);
  if (!action) return;

  action.delayMs = Math.max(0, Number(inspectorDelay.value) || 0);

  if (action.type === "navigate") {
    action.url = inspectorSelector.value;
  } else {
    action.selector = inspectorSelector.value;
  }

  if (action.type === "input" && !action.isSecret) {
    action.value = inspectorValue.value;
  }

  renderTimeline();
}

function loadEditor(recording) {
  currentRecording = recording;
  selectedActionId = recording.actions?.[0]?.id || null;
  timelineZoom = 1;

  editorEmpty.classList.add("is-hidden");
  editorWorkspace.classList.remove("is-hidden");
  editorTitle.textContent = recording.name || "Gravação";

  saveEditorButton.disabled = false;

  playerProgress.value = "0";
  playerProgress.style.setProperty("--progress", "0%");
  playerCurrent.textContent = "0:00";
  playerTotal.textContent = "0:00";
  timelinePlayhead.style.left = "0%";

  if (recording.videoUrl) {
    videoMissing.classList.add("is-hidden");
    recordingVideo.classList.remove("is-hidden");
    recordingVideo.src = recording.videoUrl;
    recordingVideo.load();
  } else {
    recordingVideo.pause();
    recordingVideo.removeAttribute("src");
    recordingVideo.load();
    recordingVideo.classList.add("is-hidden");
    videoMissing.classList.remove("is-hidden");
  }

  selectAction(selectedActionId);
  renderTimeline();
  updateVideoUI();
}

const EXEC_DIAL_R = 80;
const EXEC_DIAL_SWEEP = 320;
const EXEC_DIAL_START = 110;
const EXEC_DIAL_END = EXEC_DIAL_START + EXEC_DIAL_SWEEP;
let executionDialValue = 0;
let executionDialTargetValue = 0;
let executionDialAnimation = null;

function executionDialPoint(deg) {
  const angle = (deg * Math.PI) / 180;
  return [
    100 + Math.cos(angle) * EXEC_DIAL_R,
    100 + Math.sin(angle) * EXEC_DIAL_R,
  ];
}

function executionDialArc(startDeg, endDeg) {
  const [x0, y0] = executionDialPoint(startDeg);
  const [x1, y1] = executionDialPoint(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return (
    "M " + x0.toFixed(3) + " " + y0.toFixed(3) +
    " A " + EXEC_DIAL_R + " " + EXEC_DIAL_R +
    " 0 " + largeArc + " 1 " + x1.toFixed(3) + " " + y1.toFixed(3)
  );
}

function paintExecutionDial(value) {
  const clamped = Math.min(100, Math.max(0, value));
  const fraction = clamped / 100;
  const angle = EXEC_DIAL_START + fraction * EXEC_DIAL_SWEEP;

  executionDialTrack.setAttribute("d", executionDialArc(EXEC_DIAL_START, EXEC_DIAL_END));
  executionDialLit.setAttribute(
    "d",
    fraction > 0.0005 ? executionDialArc(EXEC_DIAL_START, angle) : ""
  );

  const [cx, cy] = executionDialPoint(angle);
  executionDialHead.setAttribute("cx", cx.toFixed(3));
  executionDialHead.setAttribute("cy", cy.toFixed(3));

  const motionStrength = Math.min(
    1,
    Math.max(0.12, Math.abs(executionDialTargetValue - executionDialValue) / 18)
  );
  const reach = 54 * motionStrength;
  const segment = reach / executionCometPaths.length;

  executionCometPaths.forEach((path, index) => {
    const weight = 1 - index / executionCometPaths.length;
    const a0 = Math.max(
      EXEC_DIAL_START,
      angle - (index + 1) * segment
    );
    const a1 = Math.max(
      EXEC_DIAL_START,
      angle - index * segment
    );

    if (a1 - a0 < 0.01 || fraction === 0) {
      path.style.opacity = "0";
      path.setAttribute("d", "");
      return;
    }

    path.setAttribute("d", executionDialArc(a0, a1));
    path.setAttribute("stroke-width", (5 + 9 * weight * motionStrength).toFixed(2));
    path.style.opacity = (weight * motionStrength * 0.78).toFixed(3);
  });

  executionProgressValue.textContent = String(Math.round(clamped));
}

function setExecutionProgress(value, label, stepText) {
  executionDialTargetValue = Math.min(100, Math.max(0, value));

  if (label) executionProgressLabel.textContent = label;
  if (stepText) executionProgressStep.textContent = stepText;

  if (executionDialAnimation) {
    cancelAnimationFrame(executionDialAnimation);
    executionDialAnimation = null;
  }

  const from = executionDialValue;
  const to = executionDialTargetValue;
  const start = performance.now();
  const duration = 420;

  const animate = (now) => {
    const raw = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - raw, 3);
    executionDialValue = from + (to - from) * eased;
    paintExecutionDial(executionDialValue);

    if (raw < 1) {
      executionDialAnimation = requestAnimationFrame(animate);
    } else {
      executionDialAnimation = null;
      executionDialValue = to;
      paintExecutionDial(to);

      if (to >= 100) {
        window.setTimeout(() => {
          executionCometPaths.forEach((path) => {
            path.style.opacity = "0";
          });
        }, 240);
      }
    }
  };

  executionDialAnimation = requestAnimationFrame(animate);
}

function prepareExecution(recording) {
  const actions = recording?.actions || [];
  const times = cumulativeTimes(actions);
  const totalMs = times[times.length - 1] || 0;

  executionTitle.textContent = recording?.name || "Automação pronta";
  executionName.textContent = recording?.name || "Automação";
  executionMeta.textContent =
    actions.length + " ações · " + formatSeconds(totalMs) + " de tempo gravado";

  executionStartButton.disabled = actions.length === 0;
  executionDialValue = 0;
  executionDialTargetValue = 0;
  setExecutionProgress(
    0,
    "Pronta para executar",
    "0 de " + actions.length + " ações"
  );
}

function executionActionLabel(type) {
  if (type === "click") return "clique";
  if (type === "input") return "digitação";
  if (type === "navigate") return "navegação";
  return "ação";
}

ipcRenderer.on("execution:progress", (_event, progress) => {
  const total = Number(progress.total) || 0;
  const index = Number(progress.index) || 0;
  const percent = Number(progress.percent) || 0;

  if (progress.phase === "completed" && percent >= 100) {
    setExecutionProgress(100, "Execução concluída", total + " de " + total + " ações");
    return;
  }

  const currentNumber = Math.min(total, Math.max(1, index + (progress.phase === "starting" ? 1 : 0)));
  const verb = progress.phase === "starting" ? "Executando" : "Concluída";

  setExecutionProgress(
    percent,
    verb + " " + executionActionLabel(progress.type),
    currentNumber + " de " + total + " ações"
  );
});

function sidebarFrame(now) {
  const dt = Math.min((now - sidebarLast) / 1000, 0.05);
  sidebarLast = now;

  const k = 1 - Math.exp(-dt / 0.075);
  let moving = false;

  sideItems.forEach((item, index) => {
    const target = item.classList.contains("active")
      ? 1
      : sidebarTargets[index] || 0;

    const current = sidebarCurrent[index] || 0;
    const next = current + (target - current) * k;
    const settled = Math.abs(target - next) < 0.002;
    const value = settled ? target : next;

    sidebarCurrent[index] = value;
    item.style.setProperty("--effect", value.toFixed(4));

    if (!settled) moving = true;
  });

  sidebarRaf = moving ? requestAnimationFrame(sidebarFrame) : null;
}

function startSidebarAnimation() {
  if (sidebarRaf) cancelAnimationFrame(sidebarRaf);

  sidebarLast = performance.now();
  sidebarRaf = requestAnimationFrame(sidebarFrame);
}

function initLineSidebar() {
  lineSidebar.addEventListener(
    "pointermove",
    (event) => {
      if (sidebarCollapsed) return;

      const rect = lineSidebar.getBoundingClientRect();
      const pointerY = event.clientY - rect.top;
      const radius = 82;

      sideItems.forEach((item, index) => {
        const center = item.offsetTop + item.offsetHeight / 2;
        const raw = Math.max(0, 1 - Math.abs(pointerY - center) / radius);
        sidebarTargets[index] = raw * raw * (3 - 2 * raw);
      });

      startSidebarAnimation();
    },
    { passive: true }
  );

  lineSidebar.addEventListener("pointerleave", () => {
    sideItems.forEach((item, index) => {
      sidebarTargets[index] = item.classList.contains("active") ? 1 : 0;
    });

    startSidebarAnimation();
  });

  startSidebarAnimation();
}

function initMagicCards() {
  document.querySelectorAll(".magic-card").forEach((card) => {
    let frame = null;
    let pendingX = 50;
    let pendingY = 50;

    card.addEventListener("pointerenter", () => {
      card.style.setProperty("--glow-intensity", "1");
    });

    card.addEventListener(
      "pointermove",
      (event) => {
        const rect = card.getBoundingClientRect();
        pendingX = ((event.clientX - rect.left) / rect.width) * 100;
        pendingY = ((event.clientY - rect.top) / rect.height) * 100;

        if (frame) return;

        frame = requestAnimationFrame(() => {
          card.style.setProperty("--glow-x", pendingX + "%");
          card.style.setProperty("--glow-y", pendingY + "%");
          frame = null;
        });
      },
      { passive: true }
    );

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--glow-intensity", "0");
    });
  });
}

function initRubberSegment() {
  requestAnimationFrame(() => setRubberIndex(0, false));

  rubberItems.forEach((item, index) => {
    item.addEventListener("click", () => {
      if (suppressRubberClick || rubberDrag?.moved) return;

      setRubberIndex(index);
      openPage(item.dataset.page);
    });
  });

  rubberTrack.addEventListener("pointerdown", (event) => {
    const item = event.target.closest(".rubber-segment__item");
    if (!item) return;

    const index = rubberItems.indexOf(item);
    if (index !== rubberActiveIndex) return;

    const trackRect = rubberTrack.getBoundingClientRect();
    const thumbRect = rubberThumb.getBoundingClientRect();

    rubberDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      offset: event.clientX - thumbRect.left,
      trackLeft: trackRect.left,
      minX: 0,
      maxX: trackRect.width - thumbRect.width - 6,
      moved: false,
    };

    rubberTrack.setPointerCapture(event.pointerId);
    rubberTrack.dataset.held = "true";
    rubberTrack.classList.add("dragging");
  });

  rubberTrack.addEventListener(
    "pointermove",
    (event) => {
      if (!rubberDrag || event.pointerId !== rubberDrag.pointerId) return;

      const delta = Math.abs(event.clientX - rubberDrag.startX);
      if (delta > 4) rubberDrag.moved = true;
      if (!rubberDrag.moved) return;

      const x = Math.min(
        rubberDrag.maxX,
        Math.max(
          rubberDrag.minX,
          event.clientX - rubberDrag.trackLeft - rubberDrag.offset
        )
      );

      rubberThumb.style.transform = "translate3d(" + x + "px, 0, 0)";
    },
    { passive: true }
  );

  function finishRubberDrag(event) {
    if (!rubberDrag || event.pointerId !== rubberDrag.pointerId) return;

    const wasMoved = rubberDrag.moved;

    rubberTrack.dataset.held = "false";
    rubberTrack.classList.remove("dragging");

    if (wasMoved) {
      const thumbRect = rubberThumb.getBoundingClientRect();
      const center = thumbRect.left + thumbRect.width / 2;

      let nearest = 0;
      let nearestDistance = Infinity;

      rubberItems.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(center - (rect.left + rect.width / 2));

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });

      rubberDrag = null;
      suppressRubberClick = true;

      setRubberIndex(nearest);
      openPage(rubberItems[nearest].dataset.page);

      window.setTimeout(() => {
        suppressRubberClick = false;
      }, 0);

      return;
    }

    rubberDrag = null;
    measureRubber();
  }

  rubberTrack.addEventListener("pointerup", finishRubberDrag);
  rubberTrack.addEventListener("pointercancel", finishRubberDrag);
  window.addEventListener("resize", measureRubber, { passive: true });
}

ipcRenderer.on("recording:action", (_event, action) => addEvent(action));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  try {
    await ipcRenderer.invoke("auth:login", {
      email: loginEmail.value,
      password: loginPassword.value,
    });

    loginScreen.classList.add("leaving");

    window.setTimeout(() => {
      loginScreen.classList.add("is-hidden");
      appShell.classList.remove("is-hidden");
      document.body.classList.add("logged-in");

      setSidebarCollapsed(false);
      openPage("home", { collapse: false });
      requestAnimationFrame(measureRubber);
    }, 110);
  } finally {
    window.setTimeout(() => {
      loginButton.disabled = false;
      loginButton.textContent = "Entrar";
    }, 130);
  }
});

sidebarToggle.addEventListener("click", () => {
  setSidebarCollapsed(!sidebarCollapsed);
});

logoutButton.addEventListener("click", async () => {
  await ipcRenderer.invoke("auth:logout");

  appShell.classList.add("is-hidden");
  loginScreen.classList.remove("is-hidden", "leaving");
  document.body.classList.remove("logged-in");
  loginPassword.value = "";
});

document.querySelectorAll(".line-sidebar__label[data-page]").forEach((button) => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

document.querySelectorAll("[data-open-page]").forEach((button) => {
  button.addEventListener("click", () => openPage(button.dataset.openPage));
});

function showRecordingWarning() {
  recordingWarningModal.classList.remove("is-hidden");
  requestAnimationFrame(() => recordWarningContinue.focus());
}

function hideRecordingWarning() {
  recordingWarningModal.classList.add("is-hidden");
}

async function startRecording() {
  try {
    hideRecordingWarning();
    resetEventList();

    recordButton.disabled = true;
    recordWarningContinue.disabled = true;
    recordWarningContinue.textContent = "Abrindo navegador...";
    setStatus("Preparando navegador", "working");

    const result = await ipcRenderer.invoke("recording:start", {
      url: recordUrl.value.trim(),
      name: recordName.value.trim(),
    });

    stopButton.disabled = false;
    const browserLabel = result.browserName || "navegador";
    setStatus(
      result.firstUse
        ? "Gravando · " + browserLabel + " · primeiro uso"
        : "Gravando · " + browserLabel,
      "recording"
    );
  } catch (error) {
    recordButton.disabled = false;
    stopButton.disabled = true;
    setStatus("Erro", "error");
    alert(error?.message || String(error));
  } finally {
    recordWarningContinue.disabled = false;
    recordWarningContinue.textContent = "Entendi, começar";
  }
}

recordButton.addEventListener("click", showRecordingWarning);
recordWarningCancel.addEventListener("click", hideRecordingWarning);
recordWarningContinue.addEventListener("click", startRecording);

recordingWarningModal.addEventListener("click", (event) => {
  if (event.target === recordingWarningModal) {
    hideRecordingWarning();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !recordingWarningModal.classList.contains("is-hidden")) {
    hideRecordingWarning();
  }
});

stopButton.addEventListener("click", async () => {
  try {
    setStatus("Salvando", "working");

    const result = await ipcRenderer.invoke("recording:stop");

    recordButton.disabled = false;
    stopButton.disabled = true;

    setStatus("Salva · " + result.recording.actions.length + " ações", "success");

    loadEditor(result.recording);
    openPage("editor");
  } catch (error) {
    setStatus("Erro", "error");
    alert(error?.message || String(error));
  }
});

[inspectorDelay, inspectorSelector, inspectorValue].forEach((input) => {
  input.addEventListener("input", updateSelectedAction);
});

deleteActionButton.addEventListener("click", () => {
  if (!currentRecording || !selectedActionId) return;

  currentRecording.actions = currentRecording.actions.filter(
    (action) => action.id !== selectedActionId
  );

  selectedActionId = currentRecording.actions[0]?.id || null;
  selectAction(selectedActionId);
});

saveEditorButton.addEventListener("click", async () => {
  if (!currentRecording) return;

  saveEditorButton.disabled = true;
  saveEditorButton.textContent = "Salvando...";

  try {
    const result = await ipcRenderer.invoke("recording:update-last", {
      actions: currentRecording.actions,
    });

    currentRecording = result.recording;
    prepareExecution(currentRecording);
    setStatus("Edição salva", "success");
    openPage("execution");
  } catch (error) {
    setStatus("Erro ao salvar", "error");
    alert(error?.message || String(error));
  } finally {
    saveEditorButton.disabled = false;
    saveEditorButton.textContent = "Salvar e continuar";
  }
});

executionStartButton.addEventListener("click", async () => {
  if (!currentRecording) return;

  executionStartButton.disabled = true;
  executionStartButton.textContent = "Executando...";
  setExecutionProgress(
    0,
    "Iniciando automação",
    "0 de " + currentRecording.actions.length + " ações"
  );
  setStatus("Executando", "working");

  try {
    await ipcRenderer.invoke("recording:run-last", {
      headless: headlessInput.checked,
    });

    setExecutionProgress(
      100,
      "Execução concluída",
      currentRecording.actions.length + " de " + currentRecording.actions.length + " ações"
    );
    setStatus("Execução concluída", "success");
  } catch (error) {
    executionProgressLabel.textContent = "Execução interrompida";
    setStatus("Falhou", "error");
    alert(error?.message || String(error));
  } finally {
    executionStartButton.disabled = false;
    executionStartButton.textContent = "▶ Executar novamente";
  }
});

playerPlay.addEventListener("click", togglePlayback);
timelinePlay.addEventListener("click", togglePlayback);

timelineBack.addEventListener("click", () => seekRelative(-1));
timelineForward.addEventListener("click", () => seekRelative(1));

playerMute.addEventListener("click", () => {
  recordingVideo.muted = !recordingVideo.muted;
  playerMute.textContent = recordingVideo.muted ? "🔈" : "🔊";
});

playerProgress.addEventListener("input", () => {
  const total = Number(recordingVideo.duration) || 0;
  if (!total) return;

  const fraction = Number(playerProgress.value) / 1000;
  recordingVideo.currentTime = total * fraction;
  updateVideoUI();
});

timelineZoomIn.addEventListener("click", () => {
  timelineZoom = Math.min(3, Math.round((timelineZoom + 0.25) * 100) / 100);
  applyTimelineZoom();
});

timelineZoomOut.addEventListener("click", () => {
  timelineZoom = Math.max(1, Math.round((timelineZoom - 0.25) * 100) / 100);
  applyTimelineZoom();
});

timelineCanvas.addEventListener("click", (event) => {
  if (event.target.closest(".timeline-action")) return;

  const rect = timelineCanvas.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const total = Number(recordingVideo.duration) || 0;

  if (total) {
    recordingVideo.currentTime = total * fraction;
  }
});

recordingVideo.addEventListener("loadedmetadata", updateVideoUI);
recordingVideo.addEventListener("timeupdate", updateVideoUI);
recordingVideo.addEventListener("play", updateVideoUI);
recordingVideo.addEventListener("pause", updateVideoUI);
recordingVideo.addEventListener("ended", updateVideoUI);

initLineSidebar();
initMagicCards();
initRubberSegment();
