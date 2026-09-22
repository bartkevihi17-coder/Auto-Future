const { ipcRenderer } = require("electron");

const recordButton = document.querySelector("#record");
const stopButton = document.querySelector("#stop");
const runButton = document.querySelector("#run");
const urlInput = document.querySelector("#url");
const nameInput = document.querySelector("#name");
const headlessInput = document.querySelector("#headless");
const status = document.querySelector("#status");
const events = document.querySelector("#events");
const count = document.querySelector("#count");

let eventCount = 0;

function setStatus(text, kind = "idle") {
  status.textContent = text;
  status.className = "status " + kind;
}

function addEvent(action) {
  if (eventCount === 0) events.innerHTML = "";
  eventCount += 1;
  count.textContent = String(eventCount);

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

ipcRenderer.on("recording:action", (_event, action) => {
  addEvent(action);
});

recordButton.addEventListener("click", async () => {
  try {
    eventCount = 0;
    count.textContent = "0";
    events.innerHTML = '<p class="empty">Aguardando suas acoes no navegador...</p>';
    setStatus("Gravando", "recording");

    await ipcRenderer.invoke("recording:start", {
      url: urlInput.value.trim(),
      name: nameInput.value.trim(),
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
