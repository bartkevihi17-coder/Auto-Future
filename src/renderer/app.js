const { ipcRenderer } = require("electron");

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");

const sidebarToggle = document.querySelector("#sidebar-toggle");
const lineSidebar = document.querySelector("#line-sidebar");
const brandHome = document.querySelector("#brand-home");
const logoutButton = document.querySelector("#logout-button");
const pageTitle = document.querySelector("#page-title");
const viewLoading = document.querySelector("#view-loading");

const recordButton = document.querySelector("#record-button");
const stopButton = document.querySelector("#stop-button");
const runButton = document.querySelector("#run-button");
const recordUrl = document.querySelector("#record-url");
const recordName = document.querySelector("#record-name");
const headlessInput = document.querySelector("#headless-input");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const events = document.querySelector("#events");
const eventCountElement = document.querySelector("#event-count");

const editorEmpty = document.querySelector("#editor-empty");
const editorWorkspace = document.querySelector("#editor-workspace");
const editorTitle = document.querySelector("#editor-title");
const recordingVideo = document.querySelector("#recording-video");
const videoMissing = document.querySelector("#video-missing");
const timelineActions = document.querySelector("#timeline-actions");
const timelineRuler = document.querySelector("#timeline-ruler");
const timelineDuration = document.querySelector("#timeline-duration");
const inspectorType = document.querySelector("#inspector-type");
const inspectorDelay = document.querySelector("#inspector-delay");
const inspectorSelector = document.querySelector("#inspector-selector");
const inspectorValue = document.querySelector("#inspector-value");
const deleteActionButton = document.querySelector("#delete-action-button");
const saveEditorButton = document.querySelector("#save-editor-button");
const testEditorButton = document.querySelector("#test-editor-button");

const rubberTrack = document.querySelector(".rubber-segment");
const rubberThumb = document.querySelector(".rubber-segment__thumb");
const rubberItems = [...document.querySelectorAll(".rubber-segment__item")];
const sideItems = [...document.querySelectorAll(".line-sidebar__item")];

let eventCount = 0;
let sidebarCollapsed = false;
let currentRecording = null;
let selectedActionId = null;
let activePage = "home";
let rubberActiveIndex = 0;
let rubberDrag = null;
let suppressRubberClick = false;
let sidebarRaf = null;
let sidebarLast = performance.now();
const sidebarTargets = sideItems.map((_, index) => (index === 0 ? 1 : 0));
const sidebarCurrent = [...sidebarTargets];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const pageNames = {
  home: "Início",
  recording: "Gravação",
  editor: "Editor",
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

  if (!collapsed) {
    startSidebarAnimation();
  }
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
  rubberThumb.style.transform = "translate3d(" + (itemRect.left - trackRect.left - inset) + "px, 0, 0)";
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
  activePage = name;

  sideItems.forEach((item, index) => {
    const active = item.dataset.page === name;
    item.classList.toggle("active", active);
    sidebarTargets[index] = active ? 1 : 0;
  });

  setRubberIndex(pageToRubberIndex(name));
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

function enableGlowPointer() {
  document.querySelectorAll(".glow-button").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--mx", event.clientX - rect.left + "px");
      button.style.setProperty("--my", event.clientY - rect.top + "px");
    }, { passive: true });
  });
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

function actionLabel(action) {
  if (action.type === "click") return "Clique";
  if (action.type === "input") return "Digitação";
  if (action.type === "navigate") return "Navegação";
  return action.type;
}

function renderTimeline() {
  if (!currentRecording) return;

  const actions = currentRecording.actions || [];
  const times = cumulativeTimes(actions);
  const duration = Math.max(times[times.length - 1] || 0, 1000);

  timelineDuration.textContent = formatSeconds(duration);
  timelineActions.innerHTML = "";
  timelineRuler.innerHTML = "";

  for (let i = 0; i <= 5; i += 1) {
    const tick = document.createElement("span");
    tick.style.left = (i * 20) + "%";
    tick.textContent = formatSeconds((duration * i) / 5);
    timelineRuler.appendChild(tick);
  }

  actions.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "timeline-action action-" + action.type;
    button.dataset.actionId = action.id;
    button.classList.toggle("selected", action.id === selectedActionId);

    const left = Math.min(94, Math.max(0, (times[index] / duration) * 100));
    button.style.left = left + "%";

    const icon = action.type === "click" ? "●" : action.type === "input" ? "⌨" : "↗";
    button.innerHTML = '<strong>' + icon + " " + actionLabel(action) + '</strong><small>' + formatSeconds(times[index]) + "</small>";

    button.addEventListener("click", () => {
      selectAction(action.id);

      if (recordingVideo.duration && Number.isFinite(recordingVideo.duration)) {
        recordingVideo.currentTime = Math.min(recordingVideo.duration, times[index] / 1000);
      }
    });

    timelineActions.appendChild(button);
  });
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
  inspectorSelector.value = action.type === "navigate" ? action.url || "" : action.selector || "";

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

  editorEmpty.classList.add("is-hidden");
  editorWorkspace.classList.remove("is-hidden");
  editorTitle.textContent = recording.name || "Gravação";
  saveEditorButton.disabled = false;
  testEditorButton.disabled = false;

  if (recording.videoUrl) {
    videoMissing.classList.add("is-hidden");
    recordingVideo.classList.remove("is-hidden");
    recordingVideo.src = recording.videoUrl;
    recordingVideo.load();
  } else {
    recordingVideo.removeAttribute("src");
    recordingVideo.classList.add("is-hidden");
    videoMissing.classList.remove("is-hidden");
  }

  selectAction(selectedActionId);
}

function sidebarFrame(now) {
  const dt = Math.min((now - sidebarLast) / 1000, 0.05);
  sidebarLast = now;
  const k = 1 - Math.exp(-dt / 0.085);
  let moving = false;

  sideItems.forEach((item, index) => {
    const target = item.classList.contains("active") ? 1 : sidebarTargets[index] || 0;
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
  lineSidebar.addEventListener("pointermove", (event) => {
    if (sidebarCollapsed) return;
    const rect = lineSidebar.getBoundingClientRect();
    const pointerY = event.clientY - rect.top;
    const radius = 92;

    sideItems.forEach((item, index) => {
      const center = item.offsetTop + item.offsetHeight / 2;
      const raw = Math.max(0, 1 - Math.abs(pointerY - center) / radius);
      sidebarTargets[index] = raw * raw * (3 - 2 * raw);
    });

    startSidebarAnimation();
  }, { passive: true });

  lineSidebar.addEventListener("pointerleave", () => {
    sideItems.forEach((item, index) => {
      sidebarTargets[index] = item.classList.contains("active") ? 1 : 0;
    });
    startSidebarAnimation();
  });

  startSidebarAnimation();
}

function spawnCardStars(card) {
  if (reduceMotion || card.dataset.starsActive === "true") return;

  card.dataset.starsActive = "true";
  const count = 5;

  for (let i = 0; i < count; i += 1) {
    const star = document.createElement("span");
    star.className = "magic-particle";
    star.style.left = 12 + Math.random() * 76 + "%";
    star.style.top = 10 + Math.random() * 78 + "%";
    star.style.animationDelay = i * 50 + "ms";
    card.appendChild(star);
    window.setTimeout(() => star.remove(), 780);
  }

  window.setTimeout(() => {
    card.dataset.starsActive = "false";
  }, 820);
}

function addCardRipple(card, event) {
  if (reduceMotion) return;

  const rect = card.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const maxDistance = Math.max(
    Math.hypot(x, y),
    Math.hypot(x - rect.width, y),
    Math.hypot(x, y - rect.height),
    Math.hypot(x - rect.width, y - rect.height)
  );

  const ripple = document.createElement("span");
  ripple.className = "magic-ripple";
  ripple.style.width = maxDistance * 2 + "px";
  ripple.style.height = maxDistance * 2 + "px";
  ripple.style.left = x - maxDistance + "px";
  ripple.style.top = y - maxDistance + "px";
  card.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function initMagicCards() {
  document.querySelectorAll(".magic-card").forEach((card) => {
    let moveRaf = null;
    let pendingX = 50;
    let pendingY = 50;

    card.addEventListener("pointerenter", () => {
      card.style.setProperty("--glow-intensity", "1");
      spawnCardStars(card);
    });

    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      pendingX = ((event.clientX - rect.left) / rect.width) * 100;
      pendingY = ((event.clientY - rect.top) / rect.height) * 100;

      if (moveRaf) return;
      moveRaf = requestAnimationFrame(() => {
        card.style.setProperty("--glow-x", pendingX + "%");
        card.style.setProperty("--glow-y", pendingY + "%");
        moveRaf = null;
      });
    }, { passive: true });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--glow-intensity", "0");
    });

    card.addEventListener("click", (event) => addCardRipple(card, event));
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

  rubberTrack.addEventListener("pointermove", (event) => {
    if (!rubberDrag || event.pointerId !== rubberDrag.pointerId) return;

    const delta = Math.abs(event.clientX - rubberDrag.startX);
    if (delta > 4) rubberDrag.moved = true;
    if (!rubberDrag.moved) return;

    const x = Math.min(
      rubberDrag.maxX,
      Math.max(rubberDrag.minX, event.clientX - rubberDrag.trackLeft - rubberDrag.offset)
    );

    rubberThumb.style.transform = "translate3d(" + x + "px, 0, 0)";
  }, { passive: true });

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
      window.setTimeout(() => { suppressRubberClick = false; }, 0);
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
    }, 120);
  } finally {
    window.setTimeout(() => {
      loginButton.disabled = false;
      loginButton.textContent = "Entrar";
    }, 140);
  }
});

sidebarToggle.addEventListener("click", () => setSidebarCollapsed(!sidebarCollapsed));
brandHome.addEventListener("click", () => openPage("home"));

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

recordButton.addEventListener("click", async () => {
  try {
    resetEventList();
    setStatus("Gravando", "recording");

    await ipcRenderer.invoke("recording:start", {
      url: recordUrl.value.trim(),
      name: recordName.value.trim(),
    });

    recordButton.disabled = true;
    stopButton.disabled = false;
    runButton.disabled = true;
  } catch (error) {
    setStatus("Erro", "error");
    alert(error?.message || String(error));
  }
});

stopButton.addEventListener("click", async () => {
  try {
    setStatus("Salvando", "working");
    const result = await ipcRenderer.invoke("recording:stop");

    recordButton.disabled = false;
    stopButton.disabled = true;
    runButton.disabled = false;

    setStatus("Salva · " + result.recording.actions.length + " ações", "success");
    loadEditor(result.recording);
    openPage("editor");
  } catch (error) {
    setStatus("Erro", "error");
    alert(error?.message || String(error));
  }
});

runButton.addEventListener("click", async () => {
  try {
    runButton.disabled = true;
    setStatus("Executando", "working");

    await ipcRenderer.invoke("recording:run-last", {
      headless: headlessInput.checked,
    });

    setStatus("Execução concluída", "success");
  } catch (error) {
    setStatus("Falhou", "error");
    alert(error?.message || String(error));
  } finally {
    runButton.disabled = false;
  }
});

[inspectorDelay, inspectorSelector, inspectorValue].forEach((input) => {
  input.addEventListener("input", updateSelectedAction);
});

deleteActionButton.addEventListener("click", () => {
  if (!currentRecording || !selectedActionId) return;

  currentRecording.actions = currentRecording.actions.filter((action) => action.id !== selectedActionId);
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
    setStatus("Edição salva", "success");
  } catch (error) {
    setStatus("Erro ao salvar", "error");
    alert(error?.message || String(error));
  } finally {
    saveEditorButton.disabled = false;
    saveEditorButton.textContent = "Salvar alterações";
  }
});

testEditorButton.addEventListener("click", async () => {
  if (!currentRecording) return;

  try {
    await ipcRenderer.invoke("recording:update-last", {
      actions: currentRecording.actions,
    });

    testEditorButton.disabled = true;
    testEditorButton.textContent = "Executando...";
    setStatus("Testando edição", "working");

    await ipcRenderer.invoke("recording:run-last", { headless: false });
    setStatus("Teste concluído", "success");
  } catch (error) {
    setStatus("Teste falhou", "error");
    alert(error?.message || String(error));
  } finally {
    testEditorButton.disabled = false;
    testEditorButton.textContent = "▶ Testar automação";
  }
});

enableGlowPointer();
initLineSidebar();
initMagicCards();
initRubberSegment();
