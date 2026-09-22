const { ipcRenderer } = require("electron");

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");

const sidebarToggle = document.querySelector("#sidebar-toggle");
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

let eventCount = 0;
let sidebarCollapsed = false;
let currentRecording = null;
let selectedActionId = null;

const pageNames = {
  home: "Início",
  recording: "Gravação",
  editor: "Editor",
  recordings: "Gravações",
  schedules: "Agendamentos",
  runs: "Execuções",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(text, kind = "idle") {
  statusText.textContent = text;
  status.className = "status " + kind;
}

async function openPage(name, useLoading = true) {
  if (!pageNames[name]) return;

  if (useLoading) {
    viewLoading.classList.add("visible");
    await sleep(120);
  }

  document.querySelectorAll("[data-page-view]").forEach((page) => {
    page.classList.toggle("active", page.dataset.pageView === name);
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === name);
  });

  pageTitle.textContent = pageNames[name];

  if (useLoading) {
    await sleep(80);
    viewLoading.classList.remove("visible");
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
    });
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

    const left = Math.min(96, Math.max(0, (times[index] / duration) * 100));
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

  inspectorSelector.disabled = action.type === "navigate";
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

  renderTimeline();
  selectAction(selectedActionId);
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

    viewLoading.classList.add("visible");
    await sleep(150);

    loginScreen.classList.add("leaving");
    await sleep(160);

    loginScreen.classList.add("is-hidden");
    appShell.classList.remove("is-hidden");
    document.body.classList.add("logged-in");
    await openPage("home", false);

    await sleep(70);
    viewLoading.classList.remove("visible");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Entrar";
  }
});

sidebarToggle.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  appShell.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  sidebarToggle.querySelector("span").textContent = sidebarCollapsed ? "›" : "‹";
});

brandHome.addEventListener("click", () => void openPage("home"));

logoutButton.addEventListener("click", async () => {
  viewLoading.classList.add("visible");
  await sleep(130);
  await ipcRenderer.invoke("auth:logout");

  appShell.classList.add("is-hidden");
  loginScreen.classList.remove("is-hidden", "leaving");
  document.body.classList.remove("logged-in");
  loginPassword.value = "";

  await sleep(70);
  viewLoading.classList.remove("visible");
});

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => void openPage(button.dataset.page));
});

document.querySelectorAll("[data-open-page]").forEach((button) => {
  button.addEventListener("click", () => void openPage(button.dataset.openPage));
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
    await openPage("editor");
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
