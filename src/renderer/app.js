const { ipcRenderer } = require("electron");

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");
const loginError = document.querySelector("#login-error");
const loginButton = document.querySelector("#login-button");

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

let eventCount = 0;
let sidebarCollapsed = false;

const pageNames = {
  home: "Inicio",
  recording: "Gravacao",
  recordings: "Gravacoes",
  schedules: "Agendamentos",
  runs: "Execucoes",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(text, kind = "idle") {
  statusText.textContent = text;
  status.className = "status " + kind;
}

async function pulseLoading(duration = 220) {
  viewLoading.classList.add("visible");
  viewLoading.setAttribute("aria-hidden", "false");
  await sleep(duration);
  viewLoading.classList.remove("visible");
  viewLoading.setAttribute("aria-hidden", "true");
}

async function openPage(name, useLoading = true) {
  if (!pageNames[name]) return;

  if (useLoading) {
    viewLoading.classList.add("visible");
    viewLoading.setAttribute("aria-hidden", "false");
    await sleep(150);
  }

  document.querySelectorAll("[data-page-view]").forEach((page) => {
    page.classList.toggle("active", page.dataset.pageView === name);
  });

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === name);
  });

  pageTitle.textContent = pageNames[name];

  if (useLoading) {
    await sleep(90);
    viewLoading.classList.remove("visible");
    viewLoading.setAttribute("aria-hidden", "true");
  }
}

function addEvent(action) {
  if (eventCount === 0) {
    events.innerHTML = "";
  }

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
  events.innerHTML = '<p class="empty">Aguardando suas acoes no navegador...</p>';
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

ipcRenderer.on("recording:action", (_event, action) => {
  addEvent(action);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  try {
    const result = await ipcRenderer.invoke("auth:login", {
      email: loginEmail.value,
      password: loginPassword.value,
    });

    if (!result.ok) {
      loginError.textContent = result.message || "Nao foi possivel entrar.";
      loginForm.classList.remove("shake");
      void loginForm.offsetWidth;
      loginForm.classList.add("shake");
      return;
    }

    viewLoading.classList.add("visible");
    await sleep(250);

    loginScreen.classList.add("leaving");
    await sleep(180);

    loginScreen.classList.add("is-hidden");
    appShell.classList.remove("is-hidden");
    await openPage("home", false);

    await sleep(80);
    viewLoading.classList.remove("visible");
  } catch (error) {
    loginError.textContent = error?.message || String(error);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Entrar";
  }
});

sidebarToggle.addEventListener("click", () => {
  sidebarCollapsed = !sidebarCollapsed;
  appShell.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  sidebarToggle.querySelector("span").textContent = sidebarCollapsed ? "›" : "‹";
  sidebarToggle.setAttribute("aria-label", sidebarCollapsed ? "Expandir menu" : "Recolher menu");
});

brandHome.addEventListener("click", () => {
  void openPage("home");
});

logoutButton.addEventListener("click", async () => {
  await pulseLoading(180);
  await ipcRenderer.invoke("auth:logout");

  appShell.classList.add("is-hidden");
  loginScreen.classList.remove("is-hidden", "leaving");
  loginPassword.value = "";
  loginError.textContent = "";
  loginEmail.focus();
});

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    void openPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-open-page]").forEach((button) => {
  button.addEventListener("click", () => {
    void openPage(button.dataset.openPage);
  });
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

    setStatus("Salva · " + result.recording.actions.length + " acoes", "success");
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

    setStatus("Execucao concluida", "success");
  } catch (error) {
    setStatus("Falhou", "error");
    alert(error?.message || String(error));
  } finally {
    runButton.disabled = false;
  }
});

enableGlowPointer();
loginEmail.focus();
