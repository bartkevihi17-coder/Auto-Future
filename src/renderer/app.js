const { ipcRenderer } = require("electron");

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginEmail = document.querySelector("#login-email");
const loginPassword = document.querySelector("#login-password");

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
const browserSetupModal = document.querySelector("#browser-setup-modal");
const browserSetupDescription = document.querySelector("#browser-setup-description");
const browserSetupCancel = document.querySelector("#browser-setup-cancel");
const browserSetupOpen = document.querySelector("#browser-setup-open");
const browserSetupDone = document.querySelector("#browser-setup-done");
const unsupportedPageModal = document.querySelector("#unsupported-page-modal");
const unsupportedPageDescription = document.querySelector("#unsupported-page-description");
const unsupportedPageUrl = document.querySelector("#unsupported-page-url");
const unsupportedPageDetails = document.querySelector("#unsupported-page-details");
const unsupportedPageClose = document.querySelector("#unsupported-page-close");
const confirmModal = document.querySelector("#confirm-modal");
const confirmModalEyebrow = document.querySelector("#confirm-modal-eyebrow");
const confirmModalTitle = document.querySelector("#confirm-modal-title");
const confirmModalDescription = document.querySelector("#confirm-modal-description");
const confirmModalNote = document.querySelector("#confirm-modal-note");
const confirmModalCancel = document.querySelector("#confirm-modal-cancel");
const confirmModalConfirm = document.querySelector("#confirm-modal-confirm");
const optimizationModal = document.querySelector("#optimization-modal");
const optimizationModalTitle = document.querySelector("#optimization-modal-title");
const optimizationModalDescription = document.querySelector("#optimization-modal-description");
const optimizationModalNote = document.querySelector("#optimization-modal-note");
const optimizationModalCancel = document.querySelector("#optimization-modal-cancel");
const optimizationModalConfirm = document.querySelector("#optimization-modal-confirm");

const scheduleMap = document.querySelector("#schedule-map");
const scheduleList = document.querySelector("#schedule-list");
const scheduleCount = document.querySelector("#schedule-count");
const scheduleRefreshButton = document.querySelector("#schedule-refresh-button");
const runsList = document.querySelector("#runs-list");
const runsEmpty = document.querySelector("#runs-empty");

const scheduleModal = document.querySelector("#schedule-modal");
const scheduleAutomationSelect = document.querySelector("#schedule-automation-select");
const scheduleRepeatInput = document.querySelector("#schedule-repeat-input");
const scheduleVisibleInput = document.querySelector("#schedule-visible-input");
const scheduleRepeatFields = document.querySelector("#schedule-repeat-fields");
const scheduleOneTimeFields = document.querySelector("#schedule-one-time-fields");
const scheduleSameTimeInput = document.querySelector("#schedule-same-time-input");
const scheduleDayPicker = document.querySelector("#schedule-day-picker");
const scheduleBaseTimeInput = document.querySelector("#schedule-base-time-input");
const scheduleBaseTimeField = document.querySelector("#schedule-base-time-field");
const scheduleDifferentTimes = document.querySelector("#schedule-different-times");
const scheduleDateInput = document.querySelector("#schedule-date-input");
const scheduleOneTimeInput = document.querySelector("#schedule-one-time-input");
const scheduleDeleteButton = document.querySelector("#schedule-delete-button");
const scheduleCancelButton = document.querySelector("#schedule-cancel-button");
const scheduleSaveButton = document.querySelector("#schedule-save-button");

const automationLibrarySection = document.querySelector("#automation-library-section");
const automationLibrary = document.querySelector("#automation-library");
const automationLibraryEmpty = document.querySelector("#automation-library-empty");
const automationLibraryCount = document.querySelector("#automation-library-count");
const editorWorkspace = document.querySelector("#editor-workspace");
const editorTitle = document.querySelector("#editor-title");
const editorLibraryButton = document.querySelector("#editor-library-button");
const recordingsLibrary = document.querySelector("#recordings-library");
const recordingsLibraryEmpty = document.querySelector("#recordings-library-empty");
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
const editorScheduleCount = document.querySelector("#editor-schedule-count");
const editorScheduleButton = document.querySelector("#editor-schedule-button");
const editorSpeedGauge = document.querySelector("#editor-speed-gauge");
const executionSpeedGauge = document.querySelector("#execution-speed-gauge");
const executionSpeedText = document.querySelector("#execution-speed-text");
const editorOptimizationButton = document.querySelector("#editor-optimization-button");
const executionOptimizationButton = document.querySelector("#execution-optimization-button");

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

const editorSpeedSection = document.querySelector("#editor-speed-section");
const executionSpeedSection = document.querySelector("#execution-speed-section");
const editorNotificationToggle = document.querySelector("#editor-notification-toggle");

const notificationBell = document.querySelector("#notification-bell");
const notificationBellGlyph = document.querySelector("#notification-bell-glyph");
const notificationBadge = document.querySelector("#notification-badge");
const notificationPanel = document.querySelector("#notification-panel");
const notificationList = document.querySelector("#notification-list");
const notificationMarkRead = document.querySelector("#notification-mark-read");
const swipeToastStack = document.querySelector("#swipe-toast-stack");

const clickSparkCanvas = document.querySelector("#click-spark-canvas");

const recordingFinalizeLoader = document.querySelector("#recording-finalize-loader");
const recordingLoaderLabel = document.querySelector("#recording-loader-label");
const recordingLoaderTimer = document.querySelector("#recording-loader-timer");

const editorCreateFolderButton = document.querySelector("#editor-create-folder-button");
const recordingsCreateFolderButton = document.querySelector("#recordings-create-folder-button");
const editorAutomationSearchForm = document.querySelector("#editor-automation-search");
const editorAutomationSearchInput = document.querySelector("#editor-automation-search-input");
const editorAutomationSearchClear = document.querySelector("#editor-automation-search-clear");
const editorTagFilter = document.querySelector("#editor-tag-filter");
const editorSortSelect = document.querySelector("#editor-sort-select");
const editorFolderGrid = document.querySelector("#editor-folder-grid");
const recordingsFolderGrid = document.querySelector("#recordings-folder-grid");
const editorFolderContext = document.querySelector("#editor-folder-context");
const recordingsFolderContext = document.querySelector("#recordings-folder-context");
const editorFolderContextName = document.querySelector("#editor-folder-context-name");
const recordingsFolderContextName = document.querySelector("#recordings-folder-context-name");
const editorFolderRemoveDrop = document.querySelector("#editor-folder-remove-drop");
const recordingsFolderRemoveDrop = document.querySelector("#recordings-folder-remove-drop");
const editorFolderClose = document.querySelector("#editor-folder-close");
const recordingsFolderClose = document.querySelector("#recordings-folder-close");

const folderCreateModal = document.querySelector("#folder-create-modal");
const folderCreateName = document.querySelector("#folder-create-name");
const folderCreateCancel = document.querySelector("#folder-create-cancel");
const folderCreateConfirm = document.querySelector("#folder-create-confirm");

const automationDetailsModal = document.querySelector("#automation-details-modal");
const automationDetailsTitle = document.querySelector("#automation-details-title");
const automationDetailsDomain = document.querySelector("#automation-details-domain");
const automationDetailsCreated = document.querySelector("#automation-details-created");
const automationDetailsLastRun = document.querySelector("#automation-details-last-run");
const automationDetailsAverage = document.querySelector("#automation-details-average");
const automationDetailsRuns = document.querySelector("#automation-details-runs");
const automationDetailsTags = document.querySelector("#automation-details-tags");
const automationDetailsTagInput = document.querySelector("#automation-details-tag-input");
const automationDetailsTagColor = document.querySelector("#automation-details-tag-color");
const automationDetailsTagAdd = document.querySelector("#automation-details-tag-add");
const automationDetailsClose = document.querySelector("#automation-details-close");

const profileDockButton = document.querySelector("#profile-dock-button");
const profilePopover = document.querySelector("#profile-popover");
const profilePopoverName = document.querySelector("#profile-popover-name");
const profilePopoverRole = document.querySelector("#profile-popover-role");
const profilePopoverEmail = document.querySelector("#profile-popover-email");
const profileQwenStatus = document.querySelector("#profile-qwen-status");
const profileQwenSettingsButton = document.querySelector("#profile-qwen-settings-button");
const profileLogoutButton = document.querySelector("#profile-logout-button");

const qwenSettingsModal = document.querySelector("#qwen-settings-modal");
const qwenModel = document.querySelector("#qwen-model");
const qwenApiKey = document.querySelector("#qwen-api-key");
const qwenKeyHint = document.querySelector("#qwen-key-hint");
const qwenTestResult = document.querySelector("#qwen-test-result");
const qwenSettingsCancel = document.querySelector("#qwen-settings-cancel");
const qwenSettingsSaveTest = document.querySelector("#qwen-settings-save-test");

const aiChatThread = document.querySelector("#ai-chat-thread");
const aiEmptyState = document.querySelector("#ai-empty-state");
const aiConnectionLabel = document.querySelector("#ai-connection-label");
const aiPromptBar = document.querySelector("#ai-prompt-bar");
const aiPromptInput = document.querySelector("#ai-prompt-input");
const aiSendButton = document.querySelector("#ai-send-button");
const aiPlusButton = document.querySelector("#ai-plus-button");
const aiModelButton = document.querySelector("#ai-model-button");
const aiEffortButton = document.querySelector("#ai-effort-button");
const aiEffortButtonLabel = document.querySelector("#ai-effort-button-label");
const aiModelMenu = document.querySelector("#ai-model-menu");
const aiEffortMenu = document.querySelector("#ai-effort-menu");
const aiEffortLabel = document.querySelector("#ai-effort-label");

const rubberTrack = document.querySelector(".rubber-segment");
const rubberThumb = document.querySelector(".rubber-segment__thumb");
const rubberItems = [...document.querySelectorAll(".rubber-segment__item")];

let eventCount = 0;
let currentRecording = null;
let selectedActionId = null;
let browserSetupNextAction = "none";
let savedRecordings = [];
let savedSchedules = [];
let savedNotifications = [];
let savedFolders = [];
let savedRuns = [];
const shownNotificationToastIds = new Set();
let currentScheduleId = null;
let currentVideoPageId = null;
let pendingVideoSeekSeconds = 0;
let pendingConfirmAction = null;
let pendingOptimizationEnabled = null;
let recordingLoaderTimerId = null;
let recordingLoaderMaxTimerId = null;
let recordingLoaderStartedAt = 0;
let currentDetailsRecordingId = null;
let currentUser = null;
let editorSearchQuery = "";
let editorTagFilterValue = "";
let editorSortMode = "default";
let aiBusy = false;
let aiEffort = "Médio";
let aiActiveThought = null;
const activeFolderBySurface = {
  editor: null,
  recordings: null,
};
let rubberActiveIndex = 0;
let rubberDrag = null;
let suppressRubberClick = false;

let timelineZoom = 1;
let timelineActionDurationMs = 1000;

const pageNames = {
  home: "Início",
  recording: "Gravação",
  editor: "Editor",
  execution: "Execução",
  recordings: "Gravações",
  schedules: "Agendamentos",
  ai: "I.A.",
  runs: "Histórico",
};

const WEEK_DAYS = [
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 0, short: "Dom", label: "Domingo" },
];

const SCHEDULE_HOURS = Array.from(
  { length: 24 },
  (_, index) => String(index).padStart(2, "0") + ":00"
);

function setStatus(text, kind = "idle") {
  statusText.textContent = text;
  status.className = "status " + kind;
}

function closeConfirmModal() {
  confirmModal.classList.add("is-hidden");
  confirmModal.classList.remove("is-notice");
  confirmModalConfirm.disabled = false;
  confirmModalCancel.disabled = false;
  confirmModalConfirm.textContent = "Confirmar";
  pendingConfirmAction = null;
}

function openConfirmModal({
  eyebrow = "CONFIRMAÇÃO",
  title = "Confirmar ação",
  description = "",
  note = "",
  confirmLabel = "Confirmar",
  onConfirm,
}) {
  pendingConfirmAction = onConfirm;
  confirmModal.classList.remove("is-notice");
  confirmModalEyebrow.textContent = eyebrow;
  confirmModalTitle.textContent = title;
  confirmModalDescription.textContent = description;
  confirmModalNote.textContent = note;
  confirmModalNote.classList.toggle("is-hidden", !note);
  confirmModalConfirm.textContent = confirmLabel;
  confirmModal.classList.remove("is-hidden");
  requestAnimationFrame(() => confirmModalConfirm.focus());
}

function openNoticeModal({
  eyebrow = "ATENÇÃO",
  title = "Não foi possível continuar",
  description = "",
  note = "",
  confirmLabel = "Entendi",
}) {
  pendingConfirmAction = null;
  confirmModal.classList.add("is-notice");
  confirmModalEyebrow.textContent = eyebrow;
  confirmModalTitle.textContent = title;
  confirmModalDescription.textContent = description;
  confirmModalNote.textContent = note;
  confirmModalNote.classList.toggle("is-hidden", !note);
  confirmModalConfirm.textContent = confirmLabel;
  confirmModal.classList.remove("is-hidden");
  requestAnimationFrame(() => confirmModalConfirm.focus());
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
  if (name === "execution") {
    rubberItems.forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-checked", "false");
      item.tabIndex = -1;
    });
  } else {
    setRubberIndex(pageToRubberIndex(name));
  }
}

function openPage(name, options = {}) {
  if (!pageNames[name]) return;

  document.querySelectorAll("[data-page-view]").forEach((page) => {
    page.classList.toggle("active", page.dataset.pageView === name);
  });

  pageTitle.textContent = pageNames[name];
  updateNavigationState(name);

  if (name === "editor") {
    void refreshRecordings();

    if (!options.keepEditorOpen) {
      currentRecording = null;
      selectedActionId = null;
      showEditorLibrary();
    }
  } else if (name === "recordings") {
    void refreshRecordings();
  } else if (name === "schedules") {
    void Promise.all([refreshRecordings(), refreshSchedules()]);
  } else if (name === "ai") {
    void Promise.all([refreshAiConnectionState(), refreshAiActions()]);
  } else if (name === "runs") {
    void refreshRuns();
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
  if (action.type === "key") return "Tecla";
  if (action.type === "navigate") return "Navegação";
  return action.type;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function recordingMatchesSearch(recording, query) {
  const needle = normalizeSearchText(query);
  if (!needle) return true;

  const folder = savedFolders.find((item) => item.id === recording.folderId);
  const haystack = [
    recording.name,
    recording.initialUrl,
    folder?.name,
    ...recordingTags(recording).map((tag) => tag.name),
  ]
    .map(normalizeSearchText)
    .join(" ");

  return haystack.includes(needle);
}

function openNotificationPanelFromToast() {
  closeProfilePopover();
  notificationPanel.classList.remove("is-hidden");
  notificationBell.setAttribute("aria-expanded", "true");
  void refreshNotifications();
}

function createSwipeToast(notification) {
  if (!swipeToastStack || !notification) return;
  if (shownNotificationToastIds.has(notification.id)) return;

  shownNotificationToastIds.add(notification.id);

  const root = document.createElement("div");
  root.className = "swipe-toast";
  root.dataset.phase = "open";
  root.dataset.mounted = "false";
  root.dataset.status = notification.status === "error" ? "error" : "success";

  const iconPath =
    notification.status === "error"
      ? '<path d="M12 3.5 21 19H3z"></path><path d="M12 9v4"></path><path d="M12 16.4h.01"></path>'
      : '<circle cx="12" cy="12" r="8.5"></circle><path d="m8.5 12.3 2.2 2.2 4.8-5"></path>';

  root.innerHTML =
    '<div class="swipe-toast__gate">' +
      '<div class="swipe-toast__lift">' +
        '<div class="swipe-toast__card" role="status" aria-live="polite" aria-atomic="true" tabindex="0">' +
          '<span class="swipe-toast__icon" aria-hidden="true"><svg viewBox="0 0 24 24">' +
            iconPath +
          "</svg></span>" +
          '<span class="swipe-toast__body">' +
            '<span class="swipe-toast__title">' +
              escapeHtml(notification.title || "Ação encerrada") +
            "</span>" +
            '<span class="swipe-toast__desc">' +
              escapeHtml(notification.message || "") +
            "</span>" +
          "</span>" +
          '<button class="swipe-toast__action" type="button">Ver</button>' +
          '<i class="swipe-toast__fuse" aria-hidden="true"></i>' +
        "</div>" +
      "</div>" +
    "</div>";

  swipeToastStack.appendChild(root);

  while (swipeToastStack.children.length > 4) {
    swipeToastStack.firstElementChild?.remove();
  }

  const card = root.querySelector(".swipe-toast__card");
  const action = root.querySelector(".swipe-toast__action");
  const fuse = root.querySelector(".swipe-toast__fuse");
  const duration = 4_000;
  const slideMs = 400;
  let fuseAnimation = null;
  let closing = false;
  let drag = null;

  const remove = () => {
    root.dataset.phase = "gone";
    window.setTimeout(() => root.remove(), 40);
  };

  const close = (reason = "timeout", instant = false) => {
    if (closing) return;
    closing = true;
    root.dataset.phase = "closing";
    root.dataset.reason = reason;
    fuseAnimation?.pause();

    if (instant) {
      remove();
      return;
    }

    window.setTimeout(remove, Math.round(slideMs * 0.7) + 70);
  };

  const syncFuse = () => {
    if (!fuseAnimation) return;
    const paused =
      card.matches(":hover") ||
      card.matches(":focus-within") ||
      document.hidden ||
      Boolean(drag);

    if (paused && fuseAnimation.playState === "running") {
      fuseAnimation.pause();
    } else if (!paused && fuseAnimation.playState === "paused") {
      fuseAnimation.play();
    }
  };

  fuseAnimation = fuse.animate(
    [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
    { duration, easing: "linear", fill: "forwards" }
  );
  fuseAnimation.onfinish = () => close("timeout");

  card.addEventListener("pointerenter", syncFuse);
  card.addEventListener("pointerleave", syncFuse);
  card.addEventListener("focusin", syncFuse);
  card.addEventListener("focusout", () => requestAnimationFrame(syncFuse));

  const onVisibility = () => syncFuse();
  document.addEventListener("visibilitychange", onVisibility, { once: false });

  action.addEventListener("click", (event) => {
    event.stopPropagation();
    openNotificationPanelFromToast();
    close("action");
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close("escape", true);
  });

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button") || closing) return;

    drag = {
      id: event.pointerId,
      startY: event.clientY,
      startedAt: performance.now(),
      currentY: 0,
    };

    card.setPointerCapture?.(event.pointerId);
    card.dataset.swiping = "";
    syncFuse();
  });

  card.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;

    const raw = event.clientY - drag.startY;
    const y = raw >= 0 ? raw : Math.max(-24, raw * 0.24);
    drag.currentY = y;

    card.style.transform = "translateY(" + y + "px)";
    card.style.opacity = String(Math.max(0.35, 1 - Math.max(0, y) / 170));
  });

  const finishDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;

    const state = drag;
    drag = null;
    delete card.dataset.swiping;
    card.releasePointerCapture?.(event.pointerId);

    const elapsed = Math.max(1, performance.now() - state.startedAt);
    const flick = state.currentY > 18 && elapsed < 180;
    const dismiss = state.currentY >= 40 || flick;

    if (dismiss) {
      closing = true;
      root.dataset.phase = "closing";
      fuseAnimation?.pause();

      const animation = card.animate(
        [
          {
            transform: "translateY(" + state.currentY + "px)",
            opacity: Number(card.style.opacity || 1),
          },
          {
            transform: "translateY(" + (state.currentY + card.offsetHeight + 34) + "px)",
            opacity: 0,
          },
        ],
        { duration: 240, easing: "cubic-bezier(0.23,1,0.32,1)", fill: "forwards" }
      );

      animation.onfinish = remove;
      return;
    }

    card.animate(
      [
        { transform: "translateY(" + state.currentY + "px)" },
        { transform: "translateY(0px)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.34,1.56,0.64,1)" }
    );

    card.style.transform = "";
    card.style.opacity = "";
    syncFuse();
  };

  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", finishDrag);

  requestAnimationFrame(() => {
    root.dataset.mounted = "true";
  });

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibility);
  }, duration + 6_000);
}

function initClickSpark() {
  if (!clickSparkCanvas) return;

  const context = clickSparkCanvas.getContext("2d");
  if (!context) return;

  const sparks = [];
  let frame = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  const resize = () => {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    clickSparkCanvas.width = Math.round(window.innerWidth * dpr);
    clickSparkCanvas.height = Math.round(window.innerHeight * dpr);
    clickSparkCanvas.style.width = window.innerWidth + "px";
    clickSparkCanvas.style.height = window.innerHeight + "px";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (now) => {
    frame = 0;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let index = sparks.length - 1; index >= 0; index -= 1) {
      const spark = sparks[index];
      const elapsed = now - spark.startedAt;

      if (elapsed >= 400) {
        sparks.splice(index, 1);
        continue;
      }

      const progress = elapsed / 400;
      const eased = progress * (2 - progress);
      const distance = eased * 15;
      const lineLength = 10 * (1 - eased);
      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      context.strokeStyle = "rgba(55, 128, 255, " + (1 - progress) + ")";
      context.lineWidth = 2;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }

    if (sparks.length) {
      frame = requestAnimationFrame(draw);
    }
  };

  window.addEventListener("resize", resize);
  resize();

  document.addEventListener("click", (event) => {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;

    const startedAt = performance.now();

    for (let index = 0; index < 8; index += 1) {
      sparks.push({
        x: event.clientX,
        y: event.clientY,
        angle: (Math.PI * 2 * index) / 8,
        startedAt,
      });
    }

    if (!frame) frame = requestAnimationFrame(draw);
  });
}

function automationScheduleCount(automationId) {
  return savedSchedules.filter(
    (schedule) => schedule.automationId === automationId
  ).length;
}

function renderBellToggleState(button, enabled) {
  if (!button) return;

  const on = enabled === true;
  button.dataset.on = on ? "true" : "false";
  button.setAttribute("aria-pressed", on ? "true" : "false");

  const offFace = button.querySelector(".bell-toggle__face--off");
  const onFace = button.querySelector(".bell-toggle__face--on");

  if (offFace) offFace.textContent = "Notificar";
  if (onFace) onFace.textContent = "Você será notificado";
}

async function setAutomationNotifications(recording, button, enabled) {
  button.disabled = true;

  try {
    const result = await ipcRenderer.invoke("recording:set-notifications", {
      id: recording.id,
      enabled,
    });

    recording.notificationsEnabled = result.recording.notificationsEnabled;

    if (currentRecording?.id === recording.id) {
      currentRecording.notificationsEnabled = result.recording.notificationsEnabled;
      renderBellToggleState(
        editorNotificationToggle,
        currentRecording.notificationsEnabled
      );
    }

    renderBellToggleState(button, recording.notificationsEnabled);
    await refreshRecordings();

    setStatus(
      recording.notificationsEnabled
        ? "Notificações ativadas"
        : "Notificações desativadas",
      "success"
    );
  } catch (error) {
    renderBellToggleState(button, recording.notificationsEnabled);
    setStatus("Erro ao alterar notificações", "error");
  } finally {
    button.disabled = false;
  }
}

function animateNotificationBell() {
  if (!notificationBellGlyph) return;
  notificationBellGlyph.classList.remove("is-ringing");
  void notificationBellGlyph.offsetWidth;
  notificationBellGlyph.classList.add("is-ringing");
}

function renderNotifications() {
  const unread = savedNotifications.filter((item) => !item.read).length;

  notificationBadge.textContent = unread > 9 ? "9+" : String(unread);
  notificationBadge.classList.toggle("is-hidden", unread === 0);

  notificationList.innerHTML = "";

  if (!savedNotifications.length) {
    notificationList.innerHTML = '<p class="empty">Nenhuma notificação.</p>';
    return;
  }

  for (const item of savedNotifications) {
    const row = document.createElement("article");
    row.className =
      "notification-item" +
      (item.read ? "" : " is-unread") +
      (item.status === "error" ? " is-error" : "");

    row.innerHTML =
      '<span class="notification-item__dot"></span>' +
      '<div class="notification-item__copy">' +
        "<strong>" + escapeHtml(item.title || "Automação concluída") + "</strong>" +
        "<p>" + escapeHtml(item.message || "") + "</p>" +
        "<small>" +
          (item.source === "schedule" ? "Agendada" : "Manual") +
          " · " +
          escapeHtml(formatDateTime(item.createdAt)) +
        "</small>" +
      "</div>";

    notificationList.appendChild(row);
  }
}

async function refreshNotifications({ ringOnNew = false } = {}) {
  const previousUnread = savedNotifications.filter((item) => !item.read).length;
  const previousIds = new Set(savedNotifications.map((item) => item.id));
  const notifications = await ipcRenderer.invoke("notifications:list");
  savedNotifications = Array.isArray(notifications) ? notifications : [];
  const unread = savedNotifications.filter((item) => !item.read).length;

  renderNotifications();

  if (ringOnNew && unread > previousUnread) {
    animateNotificationBell();

    const fresh = savedNotifications
      .filter((item) => !previousIds.has(item.id))
      .slice()
      .reverse();

    for (const notification of fresh) {
      createSwipeToast(notification);
    }
  }
}

function setFinalizeLoader(status, label) {
  const loader = recordingFinalizeLoader.querySelector(".lattice-loader");
  loader.dataset.status = status;
  recordingLoaderLabel.textContent = label;

  if (status === "working") {
    recordingLoaderStartedAt = performance.now();
    recordingLoaderTimer.textContent = "0.0s";

    if (recordingLoaderTimerId) clearInterval(recordingLoaderTimerId);

    recordingLoaderTimerId = window.setInterval(() => {
      const elapsed = (performance.now() - recordingLoaderStartedAt) / 1000;
      recordingLoaderTimer.textContent = elapsed.toFixed(1) + "s";
    }, 100);
  } else if (recordingLoaderTimerId) {
    clearInterval(recordingLoaderTimerId);
    recordingLoaderTimerId = null;
  }
}

function showFinalizeLoader() {
  if (recordingLoaderMaxTimerId) {
    clearTimeout(recordingLoaderMaxTimerId);
    recordingLoaderMaxTimerId = null;
  }

  setFinalizeLoader("working", "Finalizando gravação");
  recordingFinalizeLoader.classList.remove("is-hidden");

  recordingLoaderMaxTimerId = window.setTimeout(() => {
    if (!recordingFinalizeLoader.classList.contains("is-hidden")) {
      recordingFinalizeLoader.classList.add("is-hidden");

      if (recordingLoaderTimerId) {
        clearInterval(recordingLoaderTimerId);
        recordingLoaderTimerId = null;
      }

      setStatus("Finalização continua em segundo plano", "working");
    }

    recordingLoaderMaxTimerId = null;
  }, 14_000);
}

async function finishFinalizeLoader(status, label, delay = 650) {
  const elapsed = performance.now() - recordingLoaderStartedAt;
  const minimumVisibleMs = 7_000;

  if (elapsed < minimumVisibleMs) {
    await new Promise((resolve) =>
      setTimeout(resolve, minimumVisibleMs - elapsed)
    );
  }

  if (recordingFinalizeLoader.classList.contains("is-hidden")) {
    if (recordingLoaderMaxTimerId) {
      clearTimeout(recordingLoaderMaxTimerId);
      recordingLoaderMaxTimerId = null;
    }
    return;
  }

  setFinalizeLoader(status, label);

  const elapsedAfterMinimum = performance.now() - recordingLoaderStartedAt;
  const remainingToMaximum = Math.max(0, 14_000 - elapsedAfterMinimum);
  const settleDelay = Math.min(delay, remainingToMaximum);

  if (settleDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleDelay));
  }

  if (recordingLoaderMaxTimerId) {
    clearTimeout(recordingLoaderMaxTimerId);
    recordingLoaderMaxTimerId = null;
  }

  recordingFinalizeLoader.classList.add("is-hidden");
}

function setupFuseDelete(root, onFuseEnd) {
  const idle = root.querySelector(".fuse-button__idle");
  const undo = root.querySelector(".fuse-button__undo");
  const rim = root.querySelector(".fuse-button__rim rect");
  let animation = null;
  let phase = "idle";
  let canHoverPause = false;

  const reset = () => {
    animation?.cancel();
    animation = null;
    phase = "idle";
    canHoverPause = false;
    root.dataset.phase = "idle";
  };

  const arm = () => {
    if (phase !== "idle") return;

    phase = "armed";
    root.dataset.phase = "armed";
    canHoverPause = false;

    animation = rim.animate(
      [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }],
      {
        duration: 4000,
        easing: "linear",
        fill: "forwards",
      }
    );

    animation.onfinish = async () => {
      phase = "settled";
      root.dataset.phase = "settled";

      try {
        await onFuseEnd();
      } catch (error) {
        setStatus("Erro ao excluir", "error");
        reset();
      }
    };

    requestAnimationFrame(() => undo.focus({ preventScroll: true }));
  };

  const cancel = () => {
    if (phase !== "armed") return;
    reset();
    requestAnimationFrame(() => idle.focus({ preventScroll: true }));
    setStatus("Exclusão cancelada", "idle");
  };

  idle.addEventListener("click", arm);
  undo.addEventListener("click", cancel);

  root.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    canHoverPause = true;
    if (animation?.playState === "paused") animation.play();
  });

  root.addEventListener("pointerenter", (event) => {
    if (
      event.pointerType === "mouse" &&
      canHoverPause &&
      phase === "armed" &&
      animation?.playState === "running"
    ) {
      animation.pause();
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && phase === "armed") {
      event.preventDefault();
      cancel();
    }
  });
}

function formatDurationMs(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "—";

  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(seconds < 10 ? 1 : 0) + "s";

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return minutes + "m " + String(remaining).padStart(2, "0") + "s";
}

const FRONT_TAG_COLORS = [
  "#7A35D8",
  "#3478F6",
  "#0F9D78",
  "#E36B2C",
  "#D94A72",
  "#6A67CE",
  "#B8860B",
  "#3D8C93",
];

function defaultFrontendTagColor(name) {
  let hash = 0;

  for (const char of String(name || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return FRONT_TAG_COLORS[hash % FRONT_TAG_COLORS.length];
}

function safeTagColor(value, name = "") {
  const color = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color.toUpperCase();
  }

  return defaultFrontendTagColor(name);
}

function recordingTags(recording) {
  if (!Array.isArray(recording?.tags)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of recording.tags) {
    const name =
      entry && typeof entry === "object"
        ? String(entry.name || "").replace(/\s+/g, " ").trim()
        : String(entry || "").replace(/\s+/g, " ").trim();

    if (!name) continue;

    const key = name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      name: name.slice(0, 28),
      color: safeTagColor(
        entry && typeof entry === "object" ? entry.color : null,
        name
      ),
    });

    if (result.length >= 2) break;
  }

  return result;
}

function recordingHasTag(recording, tagName) {
  const expected = normalizeSearchText(tagName);
  if (!expected) return true;

  return recordingTags(recording).some(
    (tag) => normalizeSearchText(tag.name) === expected
  );
}

function lastRunTimestamp(recordingId) {
  let latest = 0;

  for (const run of savedRuns) {
    if (run.automationId !== recordingId) continue;

    const timestamp =
      Date.parse(run.finishedAt || "") ||
      Date.parse(run.startedAt || "") ||
      0;

    if (timestamp > latest) latest = timestamp;
  }

  return latest;
}

function sortRecordings(recordings) {
  const result = recordings.slice();

  switch (editorSortMode) {
    case "alpha":
      return result.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", {
          sensitivity: "base",
        })
      );

    case "created-desc":
      return result.sort(
        (a, b) =>
          (Date.parse(b.createdAt || "") || 0) -
          (Date.parse(a.createdAt || "") || 0)
      );

    case "created-asc":
      return result.sort(
        (a, b) =>
          (Date.parse(a.createdAt || "") || 0) -
          (Date.parse(b.createdAt || "") || 0)
      );

    case "last-run":
      return result.sort(
        (a, b) => lastRunTimestamp(b.id) - lastRunTimestamp(a.id)
      );

    default:
      return result;
  }
}

function refreshTagFilterOptions() {
  const current = editorTagFilterValue;
  const unique = new Map();

  for (const recording of savedRecordings) {
    for (const tag of recordingTags(recording)) {
      const key = normalizeSearchText(tag.name);
      if (!unique.has(key)) unique.set(key, tag);
    }
  }

  const tags = [...unique.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

  editorTagFilter.innerHTML = '<option value="">Todas as tags</option>';

  for (const tag of tags) {
    const option = document.createElement("option");
    option.value = tag.name;
    option.textContent = tag.name;
    option.style.color = tag.color;
    editorTagFilter.appendChild(option);
  }

  if (tags.some((tag) => normalizeSearchText(tag.name) === normalizeSearchText(current))) {
    editorTagFilter.value = current;
  } else {
    editorTagFilterValue = "";
    editorTagFilter.value = "";
  }
}

async function moveRecordingToFolder(recordingId, folderId) {
  setStatus(folderId ? "Movendo para pasta" : "Removendo da pasta", "working");

  await ipcRenderer.invoke("recording:set-folder", {
    id: recordingId,
    folderId: folderId || null,
  });

  await refreshRecordings();
  setStatus(folderId ? "Automação movida" : "Automação fora da pasta", "success");
}

function setupRecordingDropTarget(element, folderId) {
  element.addEventListener("dragover", (event) => {
    const types = Array.from(event.dataTransfer?.types || []);

    if (!types.includes("application/x-auto-future-recording")) {
      return;
    }

    event.preventDefault();
    element.classList.add("is-drag-over");
  });

  element.addEventListener("dragleave", () => {
    element.classList.remove("is-drag-over");
  });

  element.addEventListener("drop", (event) => {
    const recordingId =
      event.dataTransfer?.getData("application/x-auto-future-recording") ||
      event.dataTransfer?.getData("text/plain");

    if (!recordingId) return;

    event.preventDefault();
    element.classList.remove("is-drag-over");
    void moveRecordingToFolder(recordingId, folderId);
  });
}

function setActiveFolder(surface, folderId) {
  activeFolderBySurface[surface] = folderId || null;
  renderAutomationLibraries();
}

function openFolderCreateModal() {
  folderCreateName.value = "";
  folderCreateModal.classList.remove("is-hidden");
  requestAnimationFrame(() => folderCreateName.focus());
}

function closeFolderCreateModal() {
  folderCreateModal.classList.add("is-hidden");
}

function renderAutomationDetailsTags(tags = []) {
  const normalizedTags = tags
    .map((tag) =>
      tag && typeof tag === "object"
        ? {
            name: String(tag.name || "").trim(),
            color: safeTagColor(tag.color, tag.name),
          }
        : {
            name: String(tag || "").trim(),
            color: safeTagColor(null, tag),
          }
    )
    .filter((tag) => tag.name)
    .slice(0, 2);

  automationDetailsTags.innerHTML = "";

  const full = normalizedTags.length >= 2;
  automationDetailsTagInput.disabled = full;
  automationDetailsTagColor.disabled = full;
  automationDetailsTagAdd.disabled = full;

  if (!normalizedTags.length) {
    automationDetailsTags.innerHTML =
      '<span class="automation-tag automation-tag--empty">Sem tags</span>';
    return;
  }

  for (const tag of normalizedTags) {
    const chip = document.createElement("span");
    chip.className = "automation-tag automation-tag--editable";
    chip.style.setProperty("--tag-color", tag.color);

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "automation-tag__color";
    colorInput.value = tag.color;
    colorInput.setAttribute("aria-label", "Alterar cor da tag " + tag.name);

    const label = document.createElement("span");
    label.textContent = tag.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remover tag " + tag.name);
    remove.textContent = "×";

    colorInput.addEventListener("change", () => {
      const next = normalizedTags.map((item) =>
        normalizeSearchText(item.name) === normalizeSearchText(tag.name)
          ? { ...item, color: safeTagColor(colorInput.value, item.name) }
          : item
      );

      void updateCurrentDetailsTags(next);
    });

    remove.addEventListener("click", () => {
      const next = normalizedTags.filter(
        (item) =>
          normalizeSearchText(item.name) !== normalizeSearchText(tag.name)
      );

      void updateCurrentDetailsTags(next);
    });

    chip.append(colorInput, label, remove);
    automationDetailsTags.appendChild(chip);
  }
}

async function updateCurrentDetailsTags(tags) {
  if (!currentDetailsRecordingId) return;

  const result = await ipcRenderer.invoke("recording:set-tags", {
    id: currentDetailsRecordingId,
    tags,
  });

  const index = savedRecordings.findIndex(
    (recording) => recording.id === currentDetailsRecordingId
  );

  if (index >= 0) {
    savedRecordings[index] = result.recording;
  }

  renderAutomationDetailsTags(recordingTags(result.recording));
  renderAutomationLibraries();
}

async function openAutomationDetails(id) {
  try {
    setStatus("Carregando detalhes", "working");
    const details = await ipcRenderer.invoke("recording:details", id);

    currentDetailsRecordingId = id;
    automationDetailsTitle.textContent = details.name || "Automação";
    automationDetailsDomain.textContent =
      "Domínio base · " + (details.baseDomain || "—");
    automationDetailsCreated.textContent = details.createdAt
      ? formatDateTime(details.createdAt)
      : "—";
    automationDetailsLastRun.textContent = details.lastRunAt
      ? formatDateTime(details.lastRunAt)
      : "Nunca executada";
    automationDetailsAverage.textContent =
      details.averageDurationMs == null
        ? "Sem dados"
        : formatDurationMs(details.averageDurationMs);
    automationDetailsRuns.textContent = String(details.totalRuns || 0);
    automationDetailsTagInput.value = "";
    automationDetailsTagColor.value = "#7A35D8";
    renderAutomationDetailsTags(details.tags || []);

    automationDetailsModal.classList.remove("is-hidden");
    setStatus("Detalhes carregados", "success");
  } catch (error) {
    setStatus("Erro nos detalhes", "error");
    alert(error?.message || String(error));
  }
}

function closeAutomationDetails() {
  automationDetailsModal.classList.add("is-hidden");
  currentDetailsRecordingId = null;
  automationDetailsTagInput.value = "";
  automationDetailsTagColor.value = "#7A35D8";
}

function syncProfilePopover() {
  const user = currentUser || {
    name: "Administrador",
    email: "admin@autofuture.local",
    role: "admin",
  };

  profilePopoverName.textContent = user.name || "Administrador";
  profilePopoverEmail.textContent = user.email || "—";
  profilePopoverRole.textContent =
    user.role === "admin" ? "Administrador" : user.role || "Usuário";
}

function closeProfilePopover() {
  profilePopover.classList.add("is-hidden");
  profileDockButton.setAttribute("aria-expanded", "false");
}

function renderQwenProfileStatus(settings) {
  const configured = settings?.configured === true;

  profileQwenStatus.textContent = configured ? "Conectada" : "Não configurada";
  profileQwenStatus.classList.toggle("is-connected", configured);
}

async function refreshQwenProfileStatus() {
  try {
    const settings = await ipcRenderer.invoke("ai:qwen:get-settings");
    renderQwenProfileStatus(settings);
    return settings;
  } catch {
    renderQwenProfileStatus(null);
    return null;
  }
}

function setQwenTestResult(kind, message) {
  qwenTestResult.className = "qwen-test-result " + kind;
  qwenTestResult.textContent = message;
}

function closeQwenSettingsModal() {
  qwenSettingsModal.classList.add("is-hidden");
  qwenSettingsSaveTest.disabled = false;
  qwenSettingsCancel.disabled = false;
  qwenSettingsSaveTest.textContent = "Salvar e testar";
  qwenApiKey.value = "";
}

async function openQwenSettingsModal() {
  closeProfilePopover();
  qwenTestResult.className = "qwen-test-result is-hidden";
  qwenTestResult.textContent = "";
  qwenApiKey.value = "";

  try {
    const settings = await ipcRenderer.invoke("ai:qwen:get-settings");

    qwenModel.value = settings?.model || "qwen/qwen3.8-27b";

    qwenKeyHint.textContent = settings?.configured
      ? "Já existe uma chave Groq salva. Deixe em branco para mantê-la."
      : settings?.secureStorageAvailable
        ? "Cole a chave criada em console.groq.com. Ela será criptografada localmente."
        : "O armazenamento seguro não está disponível neste computador.";

    renderQwenProfileStatus(settings);
  } catch (error) {
    setQwenTestResult("error", error?.message || String(error));
  }

  qwenSettingsModal.classList.remove("is-hidden");
  requestAnimationFrame(() => qwenApiKey.focus());
}

async function saveAndTestQwen() {
  qwenSettingsSaveTest.disabled = true;
  qwenSettingsCancel.disabled = true;
  qwenSettingsSaveTest.textContent = "Testando...";
  setQwenTestResult("working", "Salvando configuração e chamando a Qwen...");

  try {
    const saved = await ipcRenderer.invoke("ai:qwen:save-settings", {
      model: qwenModel.value,
      apiKey: qwenApiKey.value,
    });

    renderQwenProfileStatus(saved);
    await refreshAiConnectionState();

    const result = await ipcRenderer.invoke("ai:qwen:test");
    const latency = Number(result?.latencyMs) || 0;
    const reply = String(result?.content || "").trim();
    const model = result?.model || qwenModel.value;

    setQwenTestResult(
      "success",
      "Conexão confirmada · " +
        model +
        " · " +
        latency +
        " ms · resposta: " +
        (reply || "OK")
    );

    qwenApiKey.value = "";
    qwenKeyHint.textContent =
      "Chave salva com segurança. Deixe em branco para mantê-la.";
    setStatus("Qwen conectada", "success");
  } catch (error) {
    setQwenTestResult("error", error?.message || String(error));
    setStatus("Falha ao conectar Qwen", "error");
  } finally {
    qwenSettingsSaveTest.disabled = false;
    qwenSettingsCancel.disabled = false;
    qwenSettingsSaveTest.textContent = "Salvar e testar";
  }
}

async function refreshAiConnectionState() {
  try {
    const settings = await ipcRenderer.invoke("ai:qwen:get-settings");
    const connected = settings?.configured === true;

    aiConnectionLabel.textContent = connected
      ? "Qwen 3.8 27B · Groq"
      : "Configure sua chave Groq";

    aiConnectionLabel.parentElement?.classList.toggle("is-connected", connected);
    aiPromptBar.classList.toggle("is-disconnected", !connected);
    renderQwenProfileStatus(settings);
    return connected;
  } catch {
    aiConnectionLabel.textContent = "Qwen indisponível";
    aiConnectionLabel.parentElement?.classList.remove("is-connected");
    aiPromptBar.classList.add("is-disconnected");
    return false;
  }
}

function closeAiPromptMenus() {
  aiModelMenu.classList.add("is-hidden");
  aiEffortMenu.classList.add("is-hidden");
  aiModelButton.setAttribute("aria-expanded", "false");
  aiEffortButton.setAttribute("aria-expanded", "false");
}

function resizeAiPrompt() {
  aiPromptInput.style.height = "0px";
  const maxHeight = 22 * 5;
  aiPromptInput.style.height =
    Math.min(aiPromptInput.scrollHeight, maxHeight) + "px";
  aiPromptInput.style.overflowY =
    aiPromptInput.scrollHeight > maxHeight ? "auto" : "hidden";
}

function setAiBusy(busy) {
  aiBusy = busy;
  aiPromptBar.dataset.busy = busy ? "true" : "false";
  aiSendButton.classList.toggle("is-busy", busy);
  aiSendButton.disabled = busy ? false : !aiPromptInput.value.trim();
  aiPromptInput.disabled = busy;
}

function formatThoughtElapsed(deciseconds) {
  if (deciseconds < 600) {
    return (deciseconds / 10).toFixed(1) + "s";
  }

  const minutes = Math.floor(deciseconds / 600);
  const seconds = ((deciseconds % 600) / 10).toFixed(1);
  return minutes + "m " + seconds + "s";
}

function createAiThoughtLine() {
  aiEmptyState.classList.add("is-hidden");

  const wrapper = document.createElement("div");
  wrapper.className = "ai-thought-wrap";

  const root = document.createElement("div");
  root.className = "thought-line";
  root.dataset.working = "";
  root.dataset.open = "";

  const steps = [
    "Lendo o objetivo",
    "Identificando o ponto de partida",
    "Preparando o cadastro",
    "Salvando a ação no Auto Future",
  ];

  root.innerHTML =
    '<button type="button" class="thought-line__head" data-toggle aria-expanded="true">' +
      '<span class="thought-line__glyph" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><path d="M12 3.5c1.1 3.4 2.8 5.1 6.5 6.2-3.7 1.1-5.4 2.8-6.5 6.3-1.1-3.5-2.8-5.2-6.5-6.3C9.2 8.6 10.9 6.9 12 3.5Z"></path></svg>' +
      "</span>" +
      '<span class="thought-line__label">' +
        '<span class="thought-line__text thought-line__text--work" data-active><span class="thought-line__breath" data-shimmer>Processando ação…</span></span>' +
        '<span class="thought-line__text thought-line__text--done">Ação cadastrada em</span>' +
      "</span>" +
      '<span class="thought-line__timer">0.0s</span>' +
      '<span class="thought-line__chevron" data-on aria-hidden="true">⌄</span>' +
    "</button>" +
    '<div class="thought-line__trace" data-open aria-hidden="false">' +
      '<div class="thought-line__fold"><div class="thought-line__steps">' +
        steps
          .map(
            (step, index) =>
              '<div class="thought-line__step" data-step="' +
              index +
              '">' +
                '<span class="thought-line__mark" aria-hidden="true"><i class="thought-line__pulse"></i></span>' +
                '<span class="thought-line__step-text">' +
                  escapeHtml(step) +
                "</span>" +
              "</div>"
          )
          .join("") +
      "</div></div>" +
    "</div>";

  wrapper.appendChild(root);
  aiChatThread.appendChild(wrapper);
  aiChatThread.scrollTop = aiChatThread.scrollHeight;

  const timer = root.querySelector(".thought-line__timer");
  const workText = root.querySelector(".thought-line__text--work");
  const doneText = root.querySelector(".thought-line__text--done");
  const head = root.querySelector(".thought-line__head");
  const trace = root.querySelector(".thought-line__trace");
  const stepNodes = [...root.querySelectorAll(".thought-line__step")];
  const startedAt = performance.now();
  let currentStep = 0;
  let settled = false;

  const paintSteps = () => {
    stepNodes.forEach((node, index) => {
      const done = settled || index < currentStep;
      const active = !settled && index === currentStep;
      node.toggleAttribute("data-done", done);
      node.toggleAttribute("data-current", active);
      node.querySelector(".thought-line__mark").innerHTML = done
        ? '<span class="thought-line__tick">✓</span>'
        : '<i class="thought-line__pulse"></i>';
    });
  };

  paintSteps();

  const timerId = window.setInterval(() => {
    const deciseconds = Math.floor((performance.now() - startedAt) / 100);
    timer.textContent = formatThoughtElapsed(deciseconds);
  }, 100);

  const stepId = window.setInterval(() => {
    if (currentStep < stepNodes.length - 1) {
      currentStep += 1;
      paintSteps();
    }
  }, 850);

  head.addEventListener("click", () => {
    const open = root.hasAttribute("data-open");
    root.toggleAttribute("data-open", !open);
    trace.toggleAttribute("data-open", !open);
    trace.setAttribute("aria-hidden", open ? "true" : "false");
    head.setAttribute("aria-expanded", open ? "false" : "true");
  });

  const finish = (kind, label) => {
    if (settled) return;
    settled = true;

    window.clearInterval(timerId);
    window.clearInterval(stepId);

    currentStep = stepNodes.length;
    paintSteps();

    root.removeAttribute("data-working");
    root.dataset.status = kind;
    doneText.textContent = label;
    workText.removeAttribute("data-active");
    doneText.setAttribute("data-active", "");
    timer.setAttribute("data-done", "");

    window.setTimeout(() => {
      root.removeAttribute("data-open");
      trace.removeAttribute("data-open");
      trace.setAttribute("aria-hidden", "true");
      head.setAttribute("aria-expanded", "false");
    }, 360);
  };

  return {
    element: wrapper,
    settle() {
      finish("done", "Ação cadastrada em");
    },
    fail() {
      finish("error", "Erro após");
    },
    cancel() {
      finish("cancelled", "Cancelado após");
    },
    remove() {
      window.clearInterval(timerId);
      window.clearInterval(stepId);
      wrapper.remove();
    },
  };
}

function renderAiActionCard(action, prepend = true) {
  if (!action?.id) return null;

  aiEmptyState.classList.add("is-hidden");

  const card = document.createElement("section");
  card.className = "surface-card execution-summary ai-action-card";
  card.dataset.aiActionId = action.id;

  const created = new Date(action.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? "Agora"
    : created.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });

  card.innerHTML =
    '<div class="execution-summary-copy">' +
      '<p class="eyebrow">AÇÃO CADASTRADA</p>' +
      "<h3>" + escapeHtml(action.name || "Ação com IA") + "</h3>" +
      '<p class="ai-action-instruction">' + escapeHtml(action.instruction || "") + "</p>" +
    "</div>" +
    '<div class="ai-action-meta">' +
      '<span>Qwen · Groq</span>' +
      (action.domain ? "<span>" + escapeHtml(action.domain) + "</span>" : "") +
      "<span>" + escapeHtml(createdLabel) + "</span>" +
    "</div>" +
    '<button class="button primary execution-start ai-action-execute" type="button">▶ Executar com IA</button>';

  card.querySelector(".ai-action-execute").addEventListener("click", () => {
    openNoticeModal({
      eyebrow: "EXECUÇÃO COM IA",
      title: "A ação já está cadastrada",
      description:
        "O próximo módulo liga esta ação ao navegador ao vivo para a IA observar a página e propor cada clique.",
      note:
        "O cadastro já está salvo. Não é necessário pedir novamente para a Qwen explicar os passos.",
      confirmLabel: "Entendi",
    });
  });

  if (prepend) {
    const firstCard = aiChatThread.querySelector(".ai-action-card");
    const firstThought = aiChatThread.querySelector(".ai-thought-wrap");

    if (firstThought) {
      firstThought.insertAdjacentElement("afterend", card);
    } else if (firstCard) {
      firstCard.insertAdjacentElement("beforebegin", card);
    } else {
      aiChatThread.appendChild(card);
    }
  } else {
    aiChatThread.appendChild(card);
  }

  return card;
}

async function refreshAiActions() {
  let actions = [];

  try {
    const result = await ipcRenderer.invoke("ai:actions:list");
    actions = Array.isArray(result) ? result : [];
  } catch {
    actions = [];
  }

  aiChatThread.querySelectorAll(".ai-action-card").forEach((card) => card.remove());

  for (const action of actions.slice(0, 20)) {
    renderAiActionCard(action, false);
  }

  aiEmptyState.classList.toggle(
    "is-hidden",
    actions.length > 0 || Boolean(aiChatThread.querySelector(".ai-thought-wrap"))
  );
}

let aiRequestSerial = 0;

async function sendAiPrompt() {
  const prompt = aiPromptInput.value.trim();
  if (!prompt || aiBusy) return;

  const connected = await refreshAiConnectionState();

  if (!connected) {
    openQwenSettingsModal();
    return;
  }

  aiPromptInput.value = "";
  resizeAiPrompt();
  closeAiPromptMenus();

  const requestId = ++aiRequestSerial;
  const thought = createAiThoughtLine();
  aiActiveThought = thought;
  setAiBusy(true);

  try {
    const startedAt = performance.now();

    const [result] = await Promise.all([
      ipcRenderer.invoke("ai:action:register", {
        instruction: prompt,
        effort: aiEffort,
      }),
      new Promise((resolve) => window.setTimeout(resolve, 1100)),
    ]);

    if (requestId !== aiRequestSerial) return;

    if (!result?.action) {
      throw new Error("A ação não foi cadastrada.");
    }

    const remaining = Math.max(0, 1450 - (performance.now() - startedAt));
    if (remaining > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }

    thought.settle();

    window.setTimeout(() => {
      if (requestId !== aiRequestSerial) return;
      renderAiActionCard(result.action, true);
      aiChatThread.scrollTop = aiChatThread.scrollHeight;
    }, 420);

    setStatus("Ação cadastrada", "success");
  } catch (error) {
    if (requestId !== aiRequestSerial) return;

    thought.fail();

    const message = error?.message || String(error);

    openNoticeModal({
      eyebrow: message.includes("401") ? "GROQ · AUTENTICAÇÃO" : "I.A. · ERRO",
      title: message.includes("401")
        ? "A chave da Groq foi recusada"
        : "Não foi possível cadastrar a ação",
      description: message.includes("401")
        ? "Confira se a chave foi criada em console.groq.com/keys e salve novamente em Perfil → Configurar IA."
        : message,
      note: message.includes("401")
        ? "O Auto Future usa https://api.groq.com/openai/v1."
        : "Nenhuma ação incompleta foi cadastrada.",
      confirmLabel: "Entendi",
    });

    setStatus("Falha ao cadastrar ação", "error");
  } finally {
    if (requestId === aiRequestSerial) {
      setAiBusy(false);
      aiActiveThought = null;
      aiPromptInput.focus();
    }
  }
}

function stopAiPrompt() {
  if (!aiBusy) return;

  aiRequestSerial += 1;
  aiActiveThought?.cancel();
  aiActiveThought = null;
  setAiBusy(false);
  aiPromptInput.focus();
}

function renderFolderCard(folder, surface) {
  const card = document.createElement("article");
  const total = savedRecordings.filter(
    (recording) => recording.folderId === folder.id
  ).length;

  card.className = "folder-card";
  card.dataset.folderId = folder.id;
  card.innerHTML =
    '<button class="folder-card__open" type="button">' +
      '<span class="folder-card__icon">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2-2h9a1.5 1.5 0 0 1 1.5 1.5v10.5A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5V9a1.5 1.5 0 0 1 1.5-1.5z"></path></svg>' +
      "</span>" +
      '<span class="folder-card__copy">' +
        "<strong>" + escapeHtml(folder.name) + "</strong>" +
        "<small>" + total + " automaç" + (total === 1 ? "ão" : "ões") + "</small>" +
      "</span>" +
    "</button>" +
    '<button class="folder-card__delete" type="button" aria-label="Excluir pasta">×</button>';

  setupRecordingDropTarget(card, folder.id);

  card.querySelector(".folder-card__open").addEventListener("click", () => {
    setActiveFolder(surface, folder.id);
  });

  card.querySelector(".folder-card__delete").addEventListener("click", (event) => {
    event.stopPropagation();

    openConfirmModal({
      eyebrow: "EXCLUIR PASTA",
      title: 'Excluir "' + folder.name + '"?',
      description:
        "As automações não serão apagadas. Elas voltarão para a lista principal.",
      note:
        total > 0
          ? total + " automaç" + (total === 1 ? "ão será movida" : "ões serão movidas") +
            " para fora da pasta."
          : "A pasta está vazia.",
      confirmLabel: "Excluir pasta",
      onConfirm: async () => {
        await ipcRenderer.invoke("folder:delete", folder.id);

        if (activeFolderBySurface.editor === folder.id) {
          activeFolderBySurface.editor = null;
        }

        if (activeFolderBySurface.recordings === folder.id) {
          activeFolderBySurface.recordings = null;
        }

        await Promise.all([refreshFolders(), refreshRecordings()]);
        setStatus("Pasta excluída", "success");
      },
    });
  });

  return card;
}

function domainFaviconFallback(initialUrl) {
  try {
    return new URL("/favicon.ico", initialUrl).href;
  } catch {
    return "";
  }
}

function renderAutomationCard(recording, surface = "editor") {
  const card = document.createElement("article");
  card.className = "automation-card surface-card";
  card.draggable = true;
  card.dataset.recordingId = recording.id;
  card.dataset.surface = surface;

  const scheduleTotal = automationScheduleCount(recording.id);
  const modeLabel =
    recording.optimizationEnabled !== false
      ? "Otimizada"
      : speedLabel(recording.executionSpeed);
  const actions = recording.actions?.length || 0;
  const tags = recordingTags(recording);
  const domainIconUrl =
    recording.domainIconUrl || domainFaviconFallback(recording.initialUrl);

  const domainIconHtml =
    '<div class="automation-card__icon">' +
      '<span class="automation-card__icon-fallback" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"></circle><path d="M3.8 12h16.4M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5S14.4 18.1 12 20.5M12 3.5C9.6 5.9 8.5 8.8 8.5 12s1.1 6.1 3.5 8.5"></path></svg>' +
      "</span>" +
      (domainIconUrl
        ? '<img class="automation-card__domain-icon" src="' +
          escapeHtml(domainIconUrl) +
          '" alt="" draggable="false" />'
        : "") +
    "</div>";

  if (tags.length) {
    card.classList.add("has-tags");
  }

  const tagHtml = tags.length
    ? '<div class="automation-card__bookmarks">' +
      tags
        .slice(0, 2)
        .map(
          (tag) =>
            '<span class="automation-bookmark" style="--tag-color:' +
            safeTagColor(tag.color, tag.name) +
            '" title="' +
            escapeHtml(tag.name) +
            '">' +
            '<span>' + escapeHtml(tag.name) + '</span>' +
            "</span>"
        )
        .join("") +
      "</div>"
    : "";

  card.innerHTML =
    tagHtml +
    '<div class="automation-card__top">' +
      domainIconHtml +
      '<div class="automation-card__meta">' +
        "<span>" + escapeHtml(modeLabel) + "</span>" +
        "<span>" + actions + " ações</span>" +
      "</div>" +
    "</div>" +
    '<div class="automation-card__body">' +
      "<h3>" + escapeHtml(recording.name || "Automação") + "</h3>" +
      "<p>" + escapeHtml(recording.initialUrl || "") + "</p>" +
    "</div>" +
    '<div class="automation-card__foot">' +
      "<span>" +
        (scheduleTotal
          ? scheduleTotal + " agendamento" + (scheduleTotal === 1 ? "" : "s")
          : "Sem agendamento") +
      "</span>" +
      "<span>" + escapeHtml(formatDateTime(recording.updatedAt || recording.createdAt)) + "</span>" +
    "</div>" +
    '<button class="bell-toggle automation-card__notify" type="button" aria-pressed="false">' +
      '<span class="bell-toggle__bell" aria-hidden="true">' +
        '<span class="bell-toggle__glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V10a6 6 0 0 1 12 0v6.5l1.6 2.3H4.4L6 16.5z"></path><path d="M12 2.5V4"></path></svg></span>' +
        '<span class="bell-toggle__wave bell-toggle__wave--left"></span>' +
        '<span class="bell-toggle__wave bell-toggle__wave--right"></span>' +
      "</span>" +
      '<span class="bell-toggle__say">' +
        '<span class="bell-toggle__face bell-toggle__face--off">Notificar</span>' +
        '<span class="bell-toggle__face bell-toggle__face--on">Você será notificado</span>' +
      "</span>" +
    "</button>" +
    '<div class="automation-card__actions">' +
      '<button class="button compact automation-edit-button" type="button">Editar</button>' +
      '<button class="button compact automation-details-button" type="button">Detalhes</button>' +
      '<button class="button compact automation-schedule-button" type="button">Agendar</button>' +
      '<span class="fuse-button automation-delete-fuse" data-phase="idle">' +
        '<button class="fuse-button__face fuse-button__idle" type="button"><span class="fuse-button__icon">⌫</span>Excluir</button>' +
        '<button class="fuse-button__face fuse-button__undo" type="button"><span class="fuse-button__icon">↶</span>Desfazer</button>' +
        '<span class="fuse-button__face fuse-button__settled"><span class="fuse-button__icon">✓</span>Excluída</span>' +
        '<svg class="fuse-button__rim" aria-hidden="true"><rect pathLength="1"></rect></svg>' +
      "</span>" +
    "</div>";

  card.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData(
      "application/x-auto-future-recording",
      recording.id
    );
    event.dataTransfer?.setData("text/plain", recording.id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }

    card.classList.add("is-dragging");
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
  });

  const domainIcon = card.querySelector(".automation-card__domain-icon");
  const domainIconBox = card.querySelector(".automation-card__icon");

  if (domainIcon && domainIconBox) {
    const syncDomainIcon = () => {
      domainIconBox.classList.toggle(
        "has-image",
        domainIcon.complete && domainIcon.naturalWidth > 0
      );
    };

    domainIcon.addEventListener("load", syncDomainIcon);
    domainIcon.addEventListener("error", () => {
      domainIconBox.classList.remove("has-image");
      domainIcon.remove();
    });

    if (domainIcon.complete) {
      requestAnimationFrame(syncDomainIcon);
    }
  }

  card
    .querySelector(".automation-edit-button")
    .addEventListener("click", () => void openAutomationForEdit(recording.id));

  card
    .querySelector(".automation-details-button")
    .addEventListener("click", () => void openAutomationDetails(recording.id));

  card
    .querySelector(".automation-schedule-button")
    .addEventListener("click", () => {
      openPage("schedules");
      openScheduleModal({
        automationId: recording.id,
      });
    });

  const notifyButton = card.querySelector(".automation-card__notify");
  renderBellToggleState(notifyButton, recording.notificationsEnabled === true);

  notifyButton.addEventListener("click", () => {
    void setAutomationNotifications(
      recording,
      notifyButton,
      recording.notificationsEnabled !== true
    );
  });

  setupFuseDelete(
    card.querySelector(".automation-delete-fuse"),
    async () => {
      setStatus("Excluindo automação", "working");
      await ipcRenderer.invoke("recording:delete", recording.id);

      if (currentRecording?.id === recording.id) {
        currentRecording = null;
        selectedActionId = null;
      }

      await Promise.all([refreshRecordings(), refreshSchedules()]);

      const activePage =
        document.querySelector("[data-page-view].active")?.dataset.pageView;

      if (activePage === "editor") {
        showEditorLibrary();
      }

      setStatus("Automação excluída", "success");
    }
  );

  return card;
}

function renderSurfaceLibrary(surface) {
  const isEditor = surface === "editor";
  const library = isEditor ? automationLibrary : recordingsLibrary;
  const folderGrid = isEditor ? editorFolderGrid : recordingsFolderGrid;
  const context = isEditor ? editorFolderContext : recordingsFolderContext;
  const contextName = isEditor
    ? editorFolderContextName
    : recordingsFolderContextName;
  const emptyState = isEditor
    ? automationLibraryEmpty
    : recordingsLibraryEmpty;

  library.innerHTML = "";
  folderGrid.innerHTML = "";

  for (const folder of savedFolders) {
    folderGrid.appendChild(renderFolderCard(folder, surface));
  }

  const activeFolderId = activeFolderBySurface[surface];
  let activeFolder = savedFolders.find((folder) => folder.id === activeFolderId);

  if (activeFolderId && !activeFolder) {
    activeFolderBySurface[surface] = null;
    activeFolder = null;
  }

  const searchActive = isEditor && Boolean(editorSearchQuery.trim());
  const tagFilterActive = isEditor && Boolean(editorTagFilterValue);
  const globalFilterActive = searchActive || tagFilterActive;

  context.classList.toggle("is-hidden", !activeFolder || globalFilterActive);

  if (activeFolder) {
    contextName.textContent = activeFolder.name;
  }

  let visibleRecordings = globalFilterActive
    ? savedRecordings.filter(
        (recording) =>
          recordingMatchesSearch(recording, editorSearchQuery) &&
          recordingHasTag(recording, editorTagFilterValue)
      )
    : savedRecordings.filter((recording) =>
        activeFolder
          ? recording.folderId === activeFolder.id
          : !recording.folderId
      );

  if (isEditor) {
    visibleRecordings = sortRecordings(visibleRecordings);
  }

  for (const recording of visibleRecordings) {
    library.appendChild(renderAutomationCard(recording, surface));
  }

  const hasAnything = savedFolders.length > 0 || savedRecordings.length > 0;
  emptyState.classList.toggle("is-hidden", hasAnything || globalFilterActive);

  if (globalFilterActive && visibleRecordings.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "folder-empty-state search-empty-state";
    placeholder.innerHTML =
      "<strong>Nenhuma automação encontrada</strong>" +
      "<span>Tente outro nome, tag, domínio ou pasta.</span>";
    library.appendChild(placeholder);
  } else if (activeFolder && visibleRecordings.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "folder-empty-state";
    placeholder.innerHTML =
      "<strong>Pasta vazia</strong>" +
      "<span>Arraste uma automação até esta pasta para guardar aqui.</span>";
    library.appendChild(placeholder);
  }
}

function renderAutomationLibraries() {
  refreshTagFilterOptions();

  const editorVisibleCount = savedRecordings.filter(
    (recording) =>
      recordingMatchesSearch(recording, editorSearchQuery) &&
      recordingHasTag(recording, editorTagFilterValue)
  ).length;

  automationLibraryCount.textContent = String(editorVisibleCount);
  renderSurfaceLibrary("editor");
  renderSurfaceLibrary("recordings");
}

async function refreshRecordings() {
  savedRecordings = await ipcRenderer.invoke("recordings:list");
  renderAutomationLibraries();
  populateScheduleAutomationSelect();
}

async function refreshFolders() {
  savedFolders = await ipcRenderer.invoke("folders:list");
  renderAutomationLibraries();
}

async function openAutomationForEdit(id) {
  try {
    setStatus("Abrindo automação", "working");
    const result = await ipcRenderer.invoke("recording:load", id);
    loadEditor(result.recording);
    openPage("editor", { keepEditorOpen: true });
    setStatus("Automação carregada", "success");
  } catch (error) {
    setStatus("Erro ao abrir", "error");
    alert(error?.message || String(error));
  }
}

function showEditorLibrary() {
  recordingVideo.pause();
  automationLibrarySection.classList.remove("is-hidden");
  editorWorkspace.classList.add("is-hidden");
  editorLibraryButton.classList.add("is-hidden");
  saveEditorButton.classList.add("is-hidden");
  editorTitle.textContent = "Automações";
  pageTitle.textContent = "Editor";
}

function nextDateForWeekday(weekday) {
  const date = new Date();
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

function selectedScheduleAutomationIds() {
  if (!scheduleAutomationSelect) return [];

  return [...scheduleAutomationSelect.selectedOptions]
    .map((option) => option.value)
    .filter(Boolean);
}

function setSelectedScheduleAutomationIds(ids = []) {
  const wanted = new Set(ids.filter(Boolean));

  [...scheduleAutomationSelect.options].forEach((option) => {
    option.selected = wanted.has(option.value);
  });
}

function populateScheduleAutomationSelect() {
  if (!scheduleAutomationSelect) return;

  const current = selectedScheduleAutomationIds();
  scheduleAutomationSelect.innerHTML = "";

  if (!savedRecordings.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma automação salva";
    option.disabled = true;
    scheduleAutomationSelect.appendChild(option);
    return;
  }

  for (const recording of savedRecordings) {
    const option = document.createElement("option");
    option.value = recording.id;
    option.textContent = recording.name || "Automação";
    scheduleAutomationSelect.appendChild(option);
  }

  const stillAvailable = current.filter((id) =>
    savedRecordings.some((recording) => recording.id === id)
  );

  if (stillAvailable.length) {
    setSelectedScheduleAutomationIds(stillAvailable);
  }
}

function selectedScheduleDays() {
  return [...scheduleDayPicker.querySelectorAll(".schedule-day-button.is-selected")]
    .map((button) => Number(button.dataset.weekday))
    .filter((weekday) => Number.isInteger(weekday));
}

function buildScheduleDayPicker(selected = []) {
  scheduleDayPicker.innerHTML = "";

  for (const day of WEEK_DAYS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "schedule-day-button";
    button.dataset.weekday = String(day.value);
    button.textContent = day.short;
    button.classList.toggle("is-selected", selected.includes(day.value));

    button.addEventListener("click", () => {
      button.classList.toggle("is-selected");

      if (!scheduleSameTimeInput.checked) {
        renderDifferentScheduleTimes();
      }
    });

    scheduleDayPicker.appendChild(button);
  }
}

function renderDifferentScheduleTimes(existingSlots = null) {
  const previous = {};

  scheduleDifferentTimes
    .querySelectorAll("input[data-weekday]")
    .forEach((input) => {
      previous[input.dataset.weekday] = input.value;
    });

  if (Array.isArray(existingSlots)) {
    for (const slot of existingSlots) {
      previous[String(slot.weekday)] = slot.time;
    }
  }

  scheduleDifferentTimes.innerHTML = "";

  for (const weekday of selectedScheduleDays()) {
    const day = WEEK_DAYS.find((item) => item.value === weekday);
    if (!day) continue;

    const row = document.createElement("label");
    row.className = "schedule-time-row";

    const label = document.createElement("span");
    label.textContent = day.label;

    const input = document.createElement("input");
    input.type = "time";
    input.dataset.weekday = String(weekday);
    input.value =
      previous[String(weekday)] ||
      scheduleBaseTimeInput.value ||
      "09:00";

    row.append(label, input);
    scheduleDifferentTimes.appendChild(row);
  }
}

function updateScheduleModalMode(existingSlots = null) {
  const repeat = scheduleRepeatInput.checked;
  const sameTime = scheduleSameTimeInput.checked;

  scheduleRepeatFields.classList.toggle("is-hidden", !repeat);
  scheduleOneTimeFields.classList.toggle("is-hidden", repeat);

  scheduleBaseTimeField.classList.toggle(
    "is-hidden",
    repeat && !sameTime
  );

  scheduleDifferentTimes.classList.toggle(
    "is-hidden",
    !repeat || sameTime
  );

  if (repeat && !sameTime) {
    renderDifferentScheduleTimes(existingSlots);
  }
}

function openScheduleModal(options = {}) {
  if (!savedRecordings.length) {
    alert("Grave e salve uma automação antes de criar um agendamento.");
    return;
  }

  const schedule = options.schedule || null;
  currentScheduleId = schedule?.id || null;

  populateScheduleAutomationSelect();

  const automationIds = schedule?.automationId
    ? [schedule.automationId]
    : options.automationId
      ? [options.automationId]
      : [savedRecordings[0]?.id].filter(Boolean);

  setSelectedScheduleAutomationIds(automationIds);
  scheduleAutomationSelect.disabled = Boolean(schedule);
  scheduleRepeatInput.checked = schedule ? Boolean(schedule.repeat) : true;
  scheduleVisibleInput.checked = schedule ? schedule.visible !== false : true;
  scheduleSameTimeInput.checked = true;

  let selectedDays = [];
  let baseTime = options.time || "09:00";

  if (schedule?.repeat) {
    selectedDays = [...new Set((schedule.slots || []).map((slot) => slot.weekday))];

    const uniqueTimes = [
      ...new Set((schedule.slots || []).map((slot) => slot.time)),
    ];

    if (uniqueTimes.length === 1) {
      baseTime = uniqueTimes[0];
      scheduleSameTimeInput.checked = true;
    } else {
      scheduleSameTimeInput.checked = false;
    }
  } else if (Number.isInteger(options.weekday)) {
    selectedDays = [options.weekday];
  }

  if (!selectedDays.length && Number.isInteger(options.weekday)) {
    selectedDays = [options.weekday];
  }

  if (!selectedDays.length) {
    selectedDays = [new Date().getDay()];
  }

  scheduleBaseTimeInput.value = baseTime;
  scheduleOneTimeInput.value =
    schedule?.oneTime ||
    options.time ||
    "09:00";

  scheduleDateInput.value =
    schedule?.runDate ||
    nextDateForWeekday(
      Number.isInteger(options.weekday)
        ? options.weekday
        : selectedDays[0]
    );

  buildScheduleDayPicker(selectedDays);
  updateScheduleModalMode(schedule?.slots || null);

  scheduleDeleteButton.classList.toggle("is-hidden", !schedule);
  scheduleModal.classList.remove("is-hidden");
  requestAnimationFrame(() => scheduleAutomationSelect.focus());
}

function closeScheduleModal() {
  scheduleModal.classList.add("is-hidden");
  scheduleAutomationSelect.disabled = false;
  currentScheduleId = null;
}

function renderScheduleMap() {
  scheduleMap.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "schedule-map-head schedule-map-corner";
  corner.textContent = "Hora";
  scheduleMap.appendChild(corner);

  for (const day of WEEK_DAYS) {
    const header = document.createElement("div");
    header.className = "schedule-map-head";
    header.textContent = day.short;
    scheduleMap.appendChild(header);
  }

  for (const hour of SCHEDULE_HOURS) {
    const timeLabel = document.createElement("div");
    timeLabel.className = "schedule-time-label";
    timeLabel.textContent = hour;
    scheduleMap.appendChild(timeLabel);

    for (const day of WEEK_DAYS) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "schedule-cell";
      cell.dataset.weekday = String(day.value);
      cell.dataset.time = hour;

      cell.addEventListener("click", () => {
        openScheduleModal({
          weekday: day.value,
          time: hour,
        });
      });

      const schedulesInCell = [];

      for (const schedule of savedSchedules) {
        if (!schedule.enabled) continue;

        if (schedule.repeat) {
          for (const slot of schedule.slots || []) {
            if (
              slot.weekday === day.value &&
              slot.time.slice(0, 2) === hour.slice(0, 2)
            ) {
              schedulesInCell.push({
                schedule,
                time: slot.time,
              });
            }
          }
        } else if (schedule.runDate && schedule.oneTime) {
          const date = new Date(schedule.runDate + "T12:00:00");

          if (
            date.getDay() === day.value &&
            schedule.oneTime.slice(0, 2) === hour.slice(0, 2)
          ) {
            schedulesInCell.push({
              schedule,
              time: schedule.oneTime,
            });
          }
        }
      }

      for (const item of schedulesInCell.slice(0, 3)) {
        const chip = document.createElement("span");
        chip.className = "schedule-chip";
        chip.innerHTML =
          "<strong>" + escapeHtml(item.time) + "</strong>" +
          "<span>" + escapeHtml(item.schedule.name) + "</span>";

        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          openScheduleModal({
            schedule: item.schedule,
          });
        });

        cell.appendChild(chip);
      }

      scheduleMap.appendChild(cell);
    }
  }
}

function renderScheduleList() {
  scheduleList.innerHTML = "";
  scheduleCount.textContent = String(savedSchedules.length);

  if (!savedSchedules.length) {
    scheduleList.innerHTML =
      '<p class="empty">Nenhum agendamento configurado.</p>';
    return;
  }

  for (const schedule of savedSchedules) {
    const automation = savedRecordings.find(
      (recording) => recording.id === schedule.automationId
    );

    const card = document.createElement("button");
    card.type = "button";
    card.className = "schedule-list-item";

    const when = schedule.repeat
      ? (schedule.slots || [])
          .map((slot) => {
            const day = WEEK_DAYS.find((item) => item.value === slot.weekday);
            return (day?.short || "?") + " " + slot.time;
          })
          .join(" · ")
      : (schedule.runDate || "—") + " " + (schedule.oneTime || "");

    card.innerHTML =
      '<div class="schedule-list-item__top">' +
        "<strong>" + escapeHtml(automation?.name || schedule.name) + "</strong>" +
        '<span class="' + (schedule.enabled ? "is-on" : "is-off") + '">' +
          (schedule.enabled ? "Ativo" : "Pausado") +
        "</span>" +
      "</div>" +
      "<p>" + escapeHtml(when) + "</p>" +
      "<small>" +
        (schedule.visible ? "Visível" : "Background") +
        " · " +
        (schedule.repeat ? "Repete" : "Uma vez") +
      "</small>";

    card.addEventListener("click", () =>
      openScheduleModal({
        schedule,
      })
    );

    scheduleList.appendChild(card);
  }
}

async function refreshSchedules() {
  savedSchedules = await ipcRenderer.invoke("schedules:list");
  renderScheduleMap();
  renderScheduleList();
  renderAutomationLibraries();

  if (currentRecording) {
    const count = savedSchedules.filter(
      (schedule) => schedule.automationId === currentRecording.id
    ).length;

    editorScheduleCount.textContent = count
      ? count + " agendamento" + (count === 1 ? "" : "s")
      : "Sem agendamentos";
  }
}

function renderRuns(runs) {
  runsList.innerHTML = "";
  runsEmpty.classList.toggle("is-hidden", runs.length > 0);

  for (const run of runs) {
    const item = document.createElement("article");
    item.className = "run-card surface-card";

    const statusClass =
      run.status === "success"
        ? "success"
        : run.status === "error"
          ? "error"
          : "working";

    item.innerHTML =
      '<div class="run-card__status ' + statusClass + '"></div>' +
      '<div class="run-card__copy">' +
        "<strong>" + escapeHtml(run.automationName || "Automação") + "</strong>" +
        "<span>" +
          (run.source === "schedule" ? "Agendada" : "Manual") +
          " · " +
          (run.visible ? "Visível" : "Background") +
        "</span>" +
      "</div>" +
      '<div class="run-card__time">' +
        "<strong>" +
          escapeHtml(
            run.status === "success"
              ? "Concluída"
              : run.status === "error"
                ? "Erro"
                : "Executando"
          ) +
        "</strong>" +
        "<span>" + escapeHtml(formatDateTime(run.startedAt)) + "</span>" +
      "</div>";

    if (run.error) {
      item.title = run.error;
    }

    runsList.appendChild(item);
  }
}

async function refreshRuns() {
  const runs = await ipcRenderer.invoke("runs:list");
  savedRuns = Array.isArray(runs) ? runs : [];
  renderRuns(savedRuns);

  if (editorSortMode === "last-run") {
    renderAutomationLibraries();
  }
}

async function refreshPersistentData() {
  const [recordings, schedules, runs, notifications, folders] = await Promise.all([
    ipcRenderer.invoke("recordings:list"),
    ipcRenderer.invoke("schedules:list"),
    ipcRenderer.invoke("runs:list"),
    ipcRenderer.invoke("notifications:list"),
    ipcRenderer.invoke("folders:list"),
  ]);

  savedRecordings = recordings;
  savedSchedules = schedules;
  savedRuns = Array.isArray(runs) ? runs : [];
  savedNotifications = Array.isArray(notifications) ? notifications : [];
  savedFolders = Array.isArray(folders) ? folders : [];

  renderAutomationLibraries();
  populateScheduleAutomationSelect();
  renderScheduleMap();
  renderScheduleList();
  renderRuns(runs);
  renderNotifications();
}

function videoSegmentForPage(pageId) {
  const segments = currentRecording?.videoSegments || [];

  if (pageId) {
    const exact = segments.find((segment) => segment.pageId === pageId);
    if (exact?.videoUrl) return exact;
  }

  return segments.find((segment) => segment.videoUrl) || null;
}

function setEditorVideoPage(pageId, seekSeconds = null, autoplay = false) {
  if (!currentRecording) return;

  const segment = videoSegmentForPage(pageId);
  const url = segment?.videoUrl || currentRecording.videoUrl || null;

  if (!url) {
    recordingVideo.pause();
    recordingVideo.removeAttribute("src");
    recordingVideo.load();
    recordingVideo.classList.add("is-hidden");
    videoMissing.classList.remove("is-hidden");
    currentVideoPageId = null;
    return;
  }

  const resolvedPageId = segment?.pageId || pageId || "primary";

  if (Number.isFinite(seekSeconds)) {
    pendingVideoSeekSeconds = Math.max(0, Number(seekSeconds));
  } else {
    pendingVideoSeekSeconds = 0;
  }

  if (
    currentVideoPageId === resolvedPageId &&
    recordingVideo.src === url
  ) {
    if (Number.isFinite(seekSeconds)) {
      const total = Number(recordingVideo.duration) || 0;
      if (total) {
        recordingVideo.currentTime = Math.min(total, pendingVideoSeekSeconds);
      }
    }

    if (autoplay) {
      void recordingVideo.play().catch(() => undefined);
    }

    return;
  }

  currentVideoPageId = resolvedPageId;
  recordingVideo.dataset.autoplayAfterLoad = autoplay ? "1" : "0";
  recordingVideo.pause();
  recordingVideo.src = url;
  recordingVideo.load();
  recordingVideo.classList.remove("is-hidden");
  videoMissing.classList.add("is-hidden");
}

function sortedVideoSegments() {
  return [...(currentRecording?.videoSegments || [])]
    .filter((segment) => segment.videoUrl)
    .sort((a, b) => (Number(a.startedAtMs) || 0) - (Number(b.startedAtMs) || 0));
}

function currentEditorSegment() {
  return sortedVideoSegments().find(
    (segment) => segment.pageId === currentVideoPageId
  ) || null;
}

function setEditorGlobalTimeMs(globalMs, autoplay = false) {
  const targetMs = Math.max(0, Number(globalMs) || 0);
  const segments = sortedVideoSegments();

  if (!segments.length) {
    const total = Number(recordingVideo.duration) || 0;
    if (total) {
      recordingVideo.currentTime = Math.min(total, targetMs / 1000);
      if (autoplay) void recordingVideo.play().catch(() => undefined);
    }
    return;
  }

  let segment = segments[0];

  for (const candidate of segments) {
    if ((Number(candidate.startedAtMs) || 0) <= targetMs) {
      segment = candidate;
    } else {
      break;
    }
  }

  const relativeSeconds = Math.max(
    0,
    (targetMs - (Number(segment.startedAtMs) || 0)) / 1000
  );

  setEditorVideoPage(segment.pageId, relativeSeconds, autoplay);
}


const SPEED_VALUES = [1, 1.5, 2];
const speedGaugeControllers = new WeakMap();

function normalizeSpeed(value) {
  const numeric = Number(value);
  if (numeric === 1.5) return 1.5;
  if (numeric === 2) return 2;
  return 1;
}

function speedLabel(speed) {
  const normalized = normalizeSpeed(speed);
  return normalized === 1 ? "1x" : normalized.toFixed(1) + "x";
}

function speedToLevel(speed) {
  const normalized = normalizeSpeed(speed);
  if (normalized === 2) return 100;
  if (normalized === 1.5) return 50;
  return 0;
}

function levelToSpeed(level) {
  if (level >= 75) return 2;
  if (level >= 25) return 1.5;
  return 1;
}

function initSpeedGauge(root, onChange) {
  if (!root) return null;

  const liquid = root.querySelector(".slosh-gauge__liquid");
  const marker = root.querySelector(".slosh-gauge__marker");
  const valueNodes = [...root.querySelectorAll(".speed-gauge__value")];

  const state = {
    x: speedToLevel(root.dataset.speed),
    target: speedToLevel(root.dataset.speed),
    velocity: 0,
    raf: 0,
    last: 0,
    dragging: false,
  };

  function paint() {
    const rect = root.getBoundingClientRect();
    const tiltDegrees = Math.max(-13, Math.min(13, state.velocity * 0.035));
    const lean = (Math.tan((tiltDegrees * Math.PI) / 180) * rect.width) / 2;
    const top = 100 - state.x;

    if (liquid) {
      liquid.style.clipPath =
        "polygon(0 calc(" + top + "% + " + lean + "px), " +
        "100% calc(" + top + "% - " + lean + "px), 100% 100%, 0 100%)";
    }

    if (marker) {
      marker.style.transform =
        "translateY(" + (((100 - state.target) * rect.height) / 100) + "px)";
    }
  }

  function wake() {
    if (!state.raf) {
      state.last = performance.now();
      state.raf = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const dt = Math.min((now - state.last) / 1000, 0.05) || 1 / 120;
    state.last = now;

    const stiffness = 240;
    const damping = 19;

    state.velocity += (state.target - state.x) * stiffness * dt;
    state.velocity *= Math.exp(-damping * dt);
    state.x += state.velocity * dt;

    if (state.x > 100) {
      state.x = 100;
      state.velocity *= -0.22;
    } else if (state.x < 0) {
      state.x = 0;
      state.velocity *= -0.22;
    }

    paint();

    if (
      !state.dragging &&
      Math.abs(state.target - state.x) < 0.05 &&
      Math.abs(state.velocity) < 0.45
    ) {
      state.x = state.target;
      state.velocity = 0;
      state.raf = 0;
      state.last = 0;
      paint();
      return;
    }

    state.raf = requestAnimationFrame(tick);
  }

  function setSpeed(speed, emit = false) {
    const normalized = normalizeSpeed(speed);
    const label = speedLabel(normalized);

    root.dataset.speed = String(normalized);
    root.setAttribute("aria-valuenow", String(normalized));
    root.setAttribute("aria-valuetext", label);
    valueNodes.forEach((node) => {
      node.textContent = label;
    });

    state.target = speedToLevel(normalized);
    wake();

    if (emit) onChange?.(normalized);
  }

  function setFromPointer(event) {
    const rect = root.getBoundingClientRect();
    const level = Math.max(
      0,
      Math.min(100, ((rect.bottom - event.clientY) / rect.height) * 100)
    );
    setSpeed(levelToSpeed(level), true);
  }

  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    state.dragging = true;
    root.dataset.held = "true";
    root.setPointerCapture?.(event.pointerId);
    setFromPointer(event);
  });

  root.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    setFromPointer(event);
  });

  function finishPointer(event) {
    if (!state.dragging) return;
    state.dragging = false;
    root.dataset.held = "false";
    try {
      root.releasePointerCapture?.(event.pointerId);
    } catch {}
    wake();
  }

  root.addEventListener("pointerup", finishPointer);
  root.addEventListener("pointercancel", finishPointer);

  root.addEventListener("keydown", (event) => {
    const current = normalizeSpeed(root.dataset.speed);
    let index = SPEED_VALUES.indexOf(current);
    if (index < 0) index = 0;

    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      index = Math.min(SPEED_VALUES.length - 1, index + 1);
      setSpeed(SPEED_VALUES[index], true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      index = Math.max(0, index - 1);
      setSpeed(SPEED_VALUES[index], true);
    } else if (event.key === "Home") {
      event.preventDefault();
      setSpeed(1, true);
    } else if (event.key === "End") {
      event.preventDefault();
      setSpeed(2, true);
    }
  });

  setSpeed(root.dataset.speed || 1, false);
  paint();

  const controller = { setSpeed };
  speedGaugeControllers.set(root, controller);
  return controller;
}

function refreshExecutionMeta() {
  if (!currentRecording) return;

  const actions = currentRecording.actions || [];
  const optimized = currentRecording.optimizationEnabled !== false;

  if (optimized) {
    executionMeta.textContent =
      actions.length +
      " ações · otimização ativa · executa conforme cada alvo fica pronto";
    return;
  }

  const speed = normalizeSpeed(currentRecording.executionSpeed);
  const times = cumulativeTimes(actions);
  const recordedMs = times[times.length - 1] || 0;

  executionMeta.textContent =
    actions.length + " ações · " +
    formatSeconds(recordedMs / speed) +
    " estimados em " + speedLabel(speed);
}

function renderOptimizationState() {
  const enabled = currentRecording?.optimizationEnabled !== false;

  editorSpeedSection?.classList.toggle("is-collapsed", enabled);
  executionSpeedSection?.classList.toggle("is-collapsed", enabled);

  [editorOptimizationButton, executionOptimizationButton].forEach((button) => {
    if (!button) return;

    button.classList.toggle("is-active", enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");

    const mark = button.querySelector(".optimization-toggle__mark");
    const state = button.querySelector(".optimization-toggle__state");

    if (mark) mark.textContent = enabled ? "✓" : "○";
    if (state) state.textContent = enabled ? "Ativada" : "Desativada";
  });
}

function closeOptimizationModal() {
  optimizationModal.classList.add("is-hidden");
  optimizationModalConfirm.disabled = false;
  optimizationModalCancel.disabled = false;
  pendingOptimizationEnabled = null;
}

function openOptimizationModal() {
  if (!currentRecording) return;

  const enabled = currentRecording.optimizationEnabled !== false;
  pendingOptimizationEnabled = !enabled;

  if (enabled) {
    optimizationModalTitle.textContent = "Desativar otimização?";
    optimizationModalDescription.textContent =
      "Com a otimização desligada, a execução volta a depender dos intervalos gravados entre as ações.";
    optimizationModalNote.textContent =
      "Os delays da timeline voltam a ser respeitados e a velocidade 1x / 1.5x / 2x passa a controlar esses intervalos.";
    optimizationModalConfirm.textContent = "Desativar otimização";
    optimizationModalConfirm.classList.remove("primary");
    optimizationModalConfirm.classList.add("danger");
  } else {
    optimizationModalTitle.textContent = "Ativar otimização?";
    optimizationModalDescription.textContent =
      "O Auto Future vai ignorar os delays gravados e avançar assim que a página e o alvo específico estiverem prontos para interação.";
    optimizationModalNote.textContent =
      "Botões aguardam ficar visíveis e acionáveis; campos aguardam ficar disponíveis; navegações aguardam o carregamento da página.";
    optimizationModalConfirm.textContent = "Ativar otimização";
    optimizationModalConfirm.classList.remove("danger");
    optimizationModalConfirm.classList.add("primary");
  }

  optimizationModal.classList.remove("is-hidden");
  requestAnimationFrame(() => optimizationModalConfirm.focus());
}

async function setOptimizationState(enabled, persist = true) {
  if (!currentRecording) return;

  currentRecording.optimizationEnabled = enabled !== false;
  renderOptimizationState();
  refreshExecutionMeta();

  if (persist) {
    await ipcRenderer.invoke(
      "recording:update-optimization",
      currentRecording.optimizationEnabled
    );
  }
}

function setCurrentExecutionSpeed(speed, source = "editor") {
  const normalized = normalizeSpeed(speed);

  if (currentRecording) {
    currentRecording.executionSpeed = normalized;
  }

  executionSpeedText.textContent = speedLabel(normalized);

  if (source !== "editor") {
    speedGaugeControllers.get(editorSpeedGauge)?.setSpeed(normalized, false);
  }

  if (source !== "execution") {
    speedGaugeControllers.get(executionSpeedGauge)?.setSpeed(normalized, false);
  }

  if (currentRecording) {
    refreshExecutionMeta();

    if (source === "editor" || source === "execution") {
      void ipcRenderer.invoke("recording:update-speed", normalized).catch(() => undefined);
    }
  }
}


function updateVideoUI() {
  const current = Number(recordingVideo.currentTime) || 0;
  const segment = currentEditorSegment();
  const segmentStartMs = Number(segment?.startedAtMs) || 0;
  const globalCurrentMs = segmentStartMs + current * 1000;
  const totalGlobalMs = Math.max(
    timelineActionDurationMs,
    globalCurrentMs,
    (Number(recordingVideo.duration) || 0) * 1000
  );
  const fraction =
    totalGlobalMs > 0
      ? Math.min(1, Math.max(0, globalCurrentMs / totalGlobalMs))
      : 0;

  playerCurrent.textContent = formatClock(globalCurrentMs / 1000);
  playerTotal.textContent = formatClock(totalGlobalMs / 1000);
  playerProgress.value = String(Math.round(fraction * 1000));
  playerProgress.style.setProperty("--progress", fraction * 100 + "%");

  playerPlay.textContent = recordingVideo.paused ? "▶" : "❚❚";
  timelinePlay.textContent = recordingVideo.paused ? "▶" : "❚❚";

  timelinePlayhead.style.left = fraction * 100 + "%";

  if (!recordingVideo.paused && segment) {
    const segments = sortedVideoSegments();
    const index = segments.findIndex(
      (candidate) => candidate.pageId === segment.pageId
    );
    const next = index >= 0 ? segments[index + 1] : null;

    if (
      next &&
      globalCurrentMs + 80 >= (Number(next.startedAtMs) || 0)
    ) {
      const relativeSeconds = Math.max(
        0,
        (globalCurrentMs - (Number(next.startedAtMs) || 0)) / 1000
      );

      setEditorVideoPage(next.pageId, relativeSeconds, true);
    }
  }
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
  const segment = currentEditorSegment();
  const segmentStartMs = Number(segment?.startedAtMs) || 0;
  const currentGlobalMs =
    segmentStartMs + (Number(recordingVideo.currentTime) || 0) * 1000;
  const targetMs = Math.max(
    0,
    Math.min(
      timelineActionDurationMs,
      currentGlobalMs + deltaSeconds * 1000
    )
  );

  setEditorGlobalTimeMs(targetMs, !recordingVideo.paused);
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

    const icon = action.type === "click" ? "●" : (action.type === "input" || action.type === "key") ? "⌨" : "↗";
    button.innerHTML =
      "<strong>" + icon + " " + actionLabel(action) + "</strong>" +
      "<small>" + formatSeconds(times[index]) + "</small>";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectAction(action.id);

      const segment = videoSegmentForPage(action.pageId);
      if (segment?.videoUrl) {
        const relativeSeconds = Math.max(
          0,
          (times[index] - (Number(segment.startedAtMs) || 0)) / 1000
        );
        setEditorVideoPage(action.pageId, relativeSeconds);
      } else {
        setEditorGlobalTimeMs(times[index]);
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

  inspectorValue.disabled =
    (action.type !== "input" && action.type !== "key") || action.isSecret;

  inspectorValue.value = action.isSecret
    ? ""
    : action.type === "key"
      ? action.key || ""
      : action.value || "";

  deleteActionButton.disabled = false;
  setEditorVideoPage(action.pageId);
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

  if (action.type === "key" && !action.isSecret) {
    action.key = inspectorValue.value;
  }

  renderTimeline();
}

function loadEditor(recording) {
  currentRecording = {
    ...recording,
    executionSpeed: normalizeSpeed(recording.executionSpeed),
    optimizationEnabled: recording.optimizationEnabled !== false,
    notificationsEnabled: recording.notificationsEnabled === true,
  };
  selectedActionId = currentRecording.actions?.[0]?.id || null;
  timelineZoom = 1;

  automationLibrarySection.classList.add("is-hidden");
  editorWorkspace.classList.remove("is-hidden");
  editorLibraryButton.classList.remove("is-hidden");
  saveEditorButton.classList.remove("is-hidden");
  editorTitle.textContent = currentRecording.name || "Gravação";

  saveEditorButton.disabled = false;
  setCurrentExecutionSpeed(currentRecording.executionSpeed, "load");
  renderOptimizationState();
  renderBellToggleState(
    editorNotificationToggle,
    currentRecording.notificationsEnabled
  );

  const editorSchedules = savedSchedules.filter(
    (schedule) => schedule.automationId === currentRecording.id
  );

  editorScheduleCount.textContent = editorSchedules.length
    ? editorSchedules.length + " agendamento" + (editorSchedules.length === 1 ? "" : "s")
    : "Sem agendamentos";

  playerProgress.value = "0";
  playerProgress.style.setProperty("--progress", "0%");
  playerCurrent.textContent = "0:00";
  playerTotal.textContent = "0:00";
  timelinePlayhead.style.left = "0%";

  currentVideoPageId = null;
  setEditorVideoPage(currentRecording.actions?.[0]?.pageId);

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
  const speed = normalizeSpeed(recording?.executionSpeed);

  currentRecording = {
    ...recording,
    executionSpeed: speed,
    optimizationEnabled: recording?.optimizationEnabled !== false,
    notificationsEnabled: recording?.notificationsEnabled === true,
  };

  executionTitle.textContent = currentRecording?.name || "Automação pronta";
  executionName.textContent = currentRecording?.name || "Automação";
  setCurrentExecutionSpeed(speed, "load");
  renderOptimizationState();
  renderBellToggleState(
    editorNotificationToggle,
    currentRecording.notificationsEnabled
  );
  refreshExecutionMeta();

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
  if (type === "key") return "tecla";
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
      setRubberIndex(index);
      openPage(item.dataset.page);
    });
  });
}

ipcRenderer.on("recording:action", (_event, action) => addEvent(action));

ipcRenderer.on("recording:unsupported-page", (_event, info) => {
  recordButton.disabled = false;
  stopButton.disabled = true;
  setStatus("Página não compatível", "error");

  unsupportedPageDescription.textContent =
    "O Auto Future detectou que essa tela não ficou acessível ao gravador. " +
    "O navegador foi fechado automaticamente para evitar uma gravação incompleta.";

  unsupportedPageUrl.textContent = info?.url || "URL não identificada";
  unsupportedPageDetails.textContent =
    info?.details ||
    "A página pode estar usando iframe isolado, canvas, WebView, Shadow DOM fechado ou alguma proteção contra automação.";

  unsupportedPageModal.classList.remove("is-hidden");
  requestAnimationFrame(() => unsupportedPageClose.focus());
});

unsupportedPageClose.addEventListener("click", () => {
  unsupportedPageModal.classList.add("is-hidden");
});

confirmModalCancel.addEventListener("click", closeConfirmModal);

confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmModal();
  }
});

confirmModalConfirm.addEventListener("click", async () => {
  if (typeof pendingConfirmAction !== "function") {
    closeConfirmModal();
    return;
  }

  const action = pendingConfirmAction;
  confirmModalConfirm.disabled = true;
  confirmModalCancel.disabled = true;
  confirmModalConfirm.textContent = "Excluindo...";

  try {
    await action();
    closeConfirmModal();
  } catch (error) {
    confirmModalNote.textContent = error?.message || String(error);
    confirmModalNote.classList.remove("is-hidden");
    confirmModalConfirm.disabled = false;
    confirmModalCancel.disabled = false;
    confirmModalConfirm.textContent = "Tentar novamente";
    setStatus("Erro ao excluir", "error");
  }
});

editorAutomationSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

editorAutomationSearchInput.addEventListener("input", () => {
  editorSearchQuery = editorAutomationSearchInput.value;
  editorAutomationSearchForm.classList.toggle(
    "is-active",
    Boolean(editorSearchQuery.trim())
  );
  editorAutomationSearchClear.classList.toggle(
    "is-hidden",
    !editorSearchQuery.length
  );
  renderAutomationLibraries();
});

editorAutomationSearchClear.addEventListener("click", () => {
  editorAutomationSearchInput.value = "";
  editorSearchQuery = "";
  editorAutomationSearchForm.classList.remove("is-active");
  editorAutomationSearchClear.classList.add("is-hidden");
  renderAutomationLibraries();
  editorAutomationSearchInput.focus();
});

editorTagFilter.addEventListener("change", () => {
  editorTagFilterValue = editorTagFilter.value;
  renderAutomationLibraries();
});

editorSortSelect.addEventListener("change", () => {
  editorSortMode = editorSortSelect.value || "default";
  renderAutomationLibraries();
});

[editorCreateFolderButton, recordingsCreateFolderButton].forEach((button) => {
  button.addEventListener("click", openFolderCreateModal);
});

folderCreateCancel.addEventListener("click", closeFolderCreateModal);

folderCreateModal.addEventListener("click", (event) => {
  if (event.target === folderCreateModal) {
    closeFolderCreateModal();
  }
});

folderCreateConfirm.addEventListener("click", async () => {
  const name = folderCreateName.value.trim();

  if (!name) {
    folderCreateName.focus();
    return;
  }

  folderCreateConfirm.disabled = true;
  folderCreateConfirm.textContent = "Criando...";

  try {
    await ipcRenderer.invoke("folder:create", { name });
    closeFolderCreateModal();
    await refreshFolders();
    setStatus("Pasta criada", "success");
  } catch (error) {
    setStatus("Erro ao criar pasta", "error");
    alert(error?.message || String(error));
  } finally {
    folderCreateConfirm.disabled = false;
    folderCreateConfirm.textContent = "Criar pasta";
  }
});

folderCreateName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    folderCreateConfirm.click();
  }
});

editorFolderClose.addEventListener("click", () => {
  setActiveFolder("editor", null);
});

recordingsFolderClose.addEventListener("click", () => {
  setActiveFolder("recordings", null);
});

setupRecordingDropTarget(editorFolderRemoveDrop, null);
setupRecordingDropTarget(recordingsFolderRemoveDrop, null);

automationDetailsClose.addEventListener("click", closeAutomationDetails);

automationDetailsModal.addEventListener("click", (event) => {
  if (event.target === automationDetailsModal) {
    closeAutomationDetails();
  }
});

automationDetailsTagAdd.addEventListener("click", () => {
  if (!currentDetailsRecordingId) return;

  const value = automationDetailsTagInput.value.replace(/\s+/g, " ").trim();
  if (!value) return;

  const recording = savedRecordings.find(
    (item) => item.id === currentDetailsRecordingId
  );

  const currentTags = recordingTags(recording);
  const exists = currentTags.some(
    (tag) => normalizeSearchText(tag.name) === normalizeSearchText(value)
  );

  if (exists) {
    automationDetailsTagInput.value = "";
    setStatus("Essa tag já existe", "error");
    return;
  }

  if (currentTags.length >= 2) {
    setStatus("Limite de 2 tags atingido", "error");
    return;
  }

  const color = safeTagColor(automationDetailsTagColor.value, value);
  automationDetailsTagInput.value = "";
  void updateCurrentDetailsTags([
    ...currentTags,
    {
      name: value,
      color,
    },
  ]);
});

automationDetailsTagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    automationDetailsTagAdd.click();
  }
});

profileDockButton.addEventListener("click", (event) => {
  event.stopPropagation();

  const opening = profilePopover.classList.contains("is-hidden");
  notificationPanel.classList.add("is-hidden");
  notificationBell.setAttribute("aria-expanded", "false");

  if (opening) {
    syncProfilePopover();
    void refreshQwenProfileStatus();
  }

  profilePopover.classList.toggle("is-hidden", !opening);
  profileDockButton.setAttribute("aria-expanded", opening ? "true" : "false");
});

profilePopover.addEventListener("click", (event) => {
  event.stopPropagation();
});

async function performLogout() {
  await ipcRenderer.invoke("auth:logout");

  closeProfilePopover();
  currentUser = null;
  appShell.classList.add("is-hidden");
  loginScreen.classList.remove("is-hidden", "leaving");
  document.body.classList.remove("logged-in");
  loginPassword.value = "";
}

profileQwenSettingsButton.addEventListener("click", () => {
  void openQwenSettingsModal();
});

qwenSettingsCancel.addEventListener("click", closeQwenSettingsModal);

qwenSettingsSaveTest.addEventListener("click", () => {
  void saveAndTestQwen();
});

qwenSettingsModal.addEventListener("click", (event) => {
  if (event.target === qwenSettingsModal) {
    closeQwenSettingsModal();
  }
});

aiPromptInput.addEventListener("input", () => {
  resizeAiPrompt();
  aiSendButton.disabled = aiBusy ? false : !aiPromptInput.value.trim();
});

aiPromptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendAiPrompt();
  }
});

aiSendButton.addEventListener("click", () => {
  if (aiBusy) {
    stopAiPrompt();
    return;
  }

  void sendAiPrompt();
});

aiPlusButton.addEventListener("click", () => {
  closeAiPromptMenus();
  openNoticeModal({
    eyebrow: "CRIAR COM IA",
    title: "Contexto do navegador vem na próxima etapa",
    description:
      "O botão de fontes será usado para anexos, mapa da página atual e outros contextos para a Qwen.",
    note:
      "Por enquanto, já podemos testar a conversa e o planejamento da automação pela Groq.",
    confirmLabel: "Entendi",
  });
});

aiModelButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const opening = aiModelMenu.classList.contains("is-hidden");
  closeAiPromptMenus();
  aiModelMenu.classList.toggle("is-hidden", !opening);
  aiModelButton.setAttribute("aria-expanded", opening ? "true" : "false");
});

aiModelMenu.querySelectorAll("[data-ai-model]").forEach((button) => {
  button.addEventListener("click", () => {
    closeAiPromptMenus();
    aiPromptInput.focus();
  });
});

aiEffortButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const opening = aiEffortMenu.classList.contains("is-hidden");
  closeAiPromptMenus();
  aiEffortMenu.classList.toggle("is-hidden", !opening);
  aiEffortButton.setAttribute("aria-expanded", opening ? "true" : "false");
});

aiEffortMenu.querySelectorAll("[data-effort]").forEach((button) => {
  button.addEventListener("click", () => {
    aiEffort = button.dataset.effort || "Médio";
    aiEffortLabel.textContent = aiEffort;
    aiEffortButtonLabel.textContent = aiEffort;

    aiEffortMenu.querySelectorAll("[data-effort]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    closeAiPromptMenus();
    aiPromptInput.focus();
  });
});

document.addEventListener("pointerdown", (event) => {
  if (!aiPromptBar.contains(event.target)) {
    closeAiPromptMenus();
  }
});

profileLogoutButton.addEventListener("click", () => {
  void performLogout();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginButton.disabled = true;
  loginButton.textContent = "Entrando...";

  try {
    const loginResult = await ipcRenderer.invoke("auth:login", {
      email: loginEmail.value,
      password: loginPassword.value,
    });

    currentUser = loginResult?.user || null;
    syncProfilePopover();

    loginScreen.classList.add("leaving");

    window.setTimeout(() => {
      loginScreen.classList.add("is-hidden");
      appShell.classList.remove("is-hidden");
      document.body.classList.add("logged-in");

      openPage("home", { collapse: false });
      requestAnimationFrame(measureRubber);
      void ensureBrowserProfileOnAccess();
      void refreshPersistentData();
    }, 110);
  } finally {
    window.setTimeout(() => {
      loginButton.disabled = false;
      loginButton.textContent = "Entrar";
    }, 130);
  }
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

function showBrowserSetup(profile, nextAction = "none") {
  browserSetupNextAction = nextAction;
  hideRecordingWarning();
  browserSetupDescription.textContent =
    "Não encontrei uma sessão Google válida no perfil do " +
    (profile?.browserName || "navegador") +
    " reservado ao Auto Future. Faça o login uma vez para que as próximas gravações já abram autenticadas.";
  browserSetupModal.classList.remove("is-hidden");
  requestAnimationFrame(() => browserSetupOpen.focus());
}

async function ensureBrowserProfileOnAccess() {
  try {
    const profile = await ipcRenderer.invoke("browser:profile-status");

    if (!profile.ready) {
      showBrowserSetup(profile, "none");
    }
  } catch (error) {
    setStatus("Sessão do navegador indisponível", "error");
  }
}

function hideBrowserSetup() {
  browserSetupModal.classList.add("is-hidden");
}

async function startRecordingNow() {
  try {
    hideRecordingWarning();
    hideBrowserSetup();
    resetEventList();

    recordButton.disabled = true;
    recordWarningContinue.disabled = true;
    setStatus("Preparando navegador", "working");

    const result = await ipcRenderer.invoke("recording:start", {
      url: recordUrl.value.trim(),
      name: recordName.value.trim(),
    });

    stopButton.disabled = false;
    const browserLabel = result.browserName || "navegador";
    setStatus("Gravando · " + browserLabel, "recording");
  } catch (error) {
    recordButton.disabled = false;
    stopButton.disabled = true;
    setStatus("Erro", "error");

    const message = error?.message || String(error);

    if (
      message.includes("Ja existe uma automacao chamada") ||
      message.includes("Já existe uma automação chamada")
    ) {
      openNoticeModal({
        eyebrow: "NOME JÁ EM USO",
        title: "Escolha outro nome",
        description: message,
        note: "Cada automação precisa ter um nome único para evitar confusão na biblioteca e nos agendamentos.",
        confirmLabel: "Entendi",
      });
    } else {
      alert(message);
    }
  } finally {
    recordWarningContinue.disabled = false;
    recordWarningContinue.textContent = "Entendi, começar";
  }
}

async function continueFromRecordingWarning() {
  recordWarningContinue.disabled = true;
  recordWarningContinue.textContent = "Verificando sessão...";

  try {
    const profile = await ipcRenderer.invoke("browser:profile-status");

    if (!profile.ready) {
      showBrowserSetup(profile, "recording");
      return;
    }

    await startRecordingNow();
  } catch (error) {
    setStatus("Erro", "error");
    alert(error?.message || String(error));
  } finally {
    recordWarningContinue.disabled = false;
    recordWarningContinue.textContent = "Entendi, começar";
  }
}

recordButton.addEventListener("click", showRecordingWarning);
recordWarningCancel.addEventListener("click", hideRecordingWarning);
recordWarningContinue.addEventListener("click", continueFromRecordingWarning);

browserSetupCancel.addEventListener("click", hideBrowserSetup);

browserSetupOpen.addEventListener("click", async () => {
  browserSetupOpen.disabled = true;
  browserSetupOpen.textContent = "Abrindo...";

  try {
    const profile = await ipcRenderer.invoke("browser:setup-profile");
    browserSetupDescription.textContent =
      "O " + profile.browserName +
      " foi aberto em modo normal. Faça login, feche essa janela do navegador e depois clique em “Já fiz login e fechei”.";
  } catch (error) {
    alert(error?.message || String(error));
  } finally {
    browserSetupOpen.disabled = false;
    browserSetupOpen.textContent = "Abrir navegador";
  }
});

browserSetupDone.addEventListener("click", async () => {
  browserSetupDone.disabled = true;
  browserSetupDone.textContent = "Verificando...";

  try {
    const profile = await ipcRenderer.invoke("browser:complete-profile-setup");
    hideBrowserSetup();
    setStatus("Sessão pronta · " + profile.browserName, "success");

    if (browserSetupNextAction === "recording") {
      browserSetupNextAction = "none";
      await startRecordingNow();
    } else {
      browserSetupNextAction = "none";
    }
  } catch (error) {
    setStatus("Erro", "error");
    alert(
      (error?.message || String(error)) +
      "\n\nConfirme que fechou a janela de configuração do navegador antes de continuar."
    );
  } finally {
    browserSetupDone.disabled = false;
    browserSetupDone.textContent = "Já fiz login e fechei";
  }
});

recordingWarningModal.addEventListener("click", (event) => {
  if (event.target === recordingWarningModal) {
    hideRecordingWarning();
  }
});

browserSetupModal.addEventListener("click", (event) => {
  if (event.target === browserSetupModal) {
    hideBrowserSetup();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (!qwenSettingsModal.classList.contains("is-hidden")) {
    closeQwenSettingsModal();
    return;
  }

  if (!automationDetailsModal.classList.contains("is-hidden")) {
    closeAutomationDetails();
    return;
  }

  if (!folderCreateModal.classList.contains("is-hidden")) {
    closeFolderCreateModal();
    return;
  }

  if (!profilePopover.classList.contains("is-hidden")) {
    closeProfilePopover();
    return;
  }

  if (!optimizationModal.classList.contains("is-hidden")) {
    closeOptimizationModal();
    return;
  }

  if (!confirmModal.classList.contains("is-hidden")) {
    closeConfirmModal();
    return;
  }

  if (!scheduleModal.classList.contains("is-hidden")) {
    closeScheduleModal();
    return;
  }

  if (!browserSetupModal.classList.contains("is-hidden")) {
    hideBrowserSetup();
    return;
  }

  if (!recordingWarningModal.classList.contains("is-hidden")) {
    hideRecordingWarning();
  }
});

stopButton.addEventListener("click", async () => {
  stopButton.disabled = true;
  showFinalizeLoader();

  try {
    setStatus("Finalizando gravação", "working");

    const result = await ipcRenderer.invoke("recording:stop");

    recordButton.disabled = false;
    stopButton.disabled = true;

    setStatus("Salva · " + result.recording.actions.length + " ações", "success");

    await refreshRecordings();
    await finishFinalizeLoader("done", "Gravação pronta");

    currentRecording = null;
    selectedActionId = null;
    openPage("editor");
  } catch (error) {
    recordButton.disabled = false;
    stopButton.disabled = true;
    setStatus("Erro", "error");
    await finishFinalizeLoader("error", "Erro ao finalizar", 950);
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
      executionSpeed: normalizeSpeed(currentRecording.executionSpeed),
      optimizationEnabled: currentRecording.optimizationEnabled !== false,
      notificationsEnabled: currentRecording.notificationsEnabled === true,
    });

    currentRecording = result.recording;
    await refreshRecordings();
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
    const updated = await ipcRenderer.invoke("recording:update-last", {
      actions: currentRecording.actions,
      executionSpeed: normalizeSpeed(currentRecording.executionSpeed),
      optimizationEnabled: currentRecording.optimizationEnabled !== false,
      notificationsEnabled: currentRecording.notificationsEnabled === true,
    });
    currentRecording = updated.recording;

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


editorLibraryButton.addEventListener("click", () => {
  currentRecording = null;
  selectedActionId = null;
  showEditorLibrary();
  void refreshRecordings();
});

editorScheduleButton.addEventListener("click", () => {
  if (!currentRecording) return;

  const matches = savedSchedules.filter(
    (schedule) => schedule.automationId === currentRecording.id
  );

  openPage("schedules");

  if (matches.length === 0) {
    openScheduleModal({
      automationId: currentRecording.id,
    });
  } else if (matches.length === 1) {
    openScheduleModal({
      schedule: matches[0],
    });
  }
});

scheduleRepeatInput.addEventListener("change", () => {
  updateScheduleModalMode();
});

scheduleSameTimeInput.addEventListener("change", () => {
  updateScheduleModalMode();
});

scheduleAutomationSelect.addEventListener("change", () => {
  if (currentScheduleId) return;

  const selected = [...scheduleAutomationSelect.selectedOptions];

  if (selected.length <= 3) return;

  selected[selected.length - 1].selected = false;
  alert("O limite é de 3 automações no mesmo agendamento.");
});

scheduleCancelButton.addEventListener("click", closeScheduleModal);

scheduleRefreshButton.addEventListener("click", () => {
  void Promise.all([refreshRecordings(), refreshSchedules()]);
});

scheduleSaveButton.addEventListener("click", async () => {
  const automationIds = selectedScheduleAutomationIds();

  if (!automationIds.length) {
    alert("Escolha pelo menos uma automação.");
    return;
  }

  if (automationIds.length > 3) {
    alert("Você pode selecionar no máximo 3 automações por vez.");
    return;
  }

  const repeat = scheduleRepeatInput.checked;
  const visible = scheduleVisibleInput.checked;
  let slots = [];

  if (repeat) {
    const days = selectedScheduleDays();

    if (!days.length) {
      alert("Escolha pelo menos um dia da semana.");
      return;
    }

    if (scheduleSameTimeInput.checked) {
      slots = days.map((weekday) => ({
        weekday,
        time: scheduleBaseTimeInput.value || "09:00",
      }));
    } else {
      slots = days.map((weekday) => {
        const input = scheduleDifferentTimes.querySelector(
          'input[data-weekday="' + weekday + '"]'
        );

        return {
          weekday,
          time: input?.value || scheduleBaseTimeInput.value || "09:00",
        };
      });
    }
  }

  const existing = savedSchedules.find(
    (schedule) => schedule.id === currentScheduleId
  );

  scheduleSaveButton.disabled = true;
  scheduleSaveButton.textContent = "Salvando...";

  try {
    if (currentScheduleId) {
      const automationId = automationIds[0];
      const automation = savedRecordings.find(
        (recording) => recording.id === automationId
      );

      if (!automation) {
        throw new Error("Automação não encontrada.");
      }

      await ipcRenderer.invoke("schedule:save", {
        id: currentScheduleId,
        automationId,
        name: automation.name || "Agendamento",
        enabled: existing?.enabled !== false,
        visible,
        repeat,
        slots,
        runDate: repeat ? undefined : scheduleDateInput.value,
        oneTime: repeat ? undefined : scheduleOneTimeInput.value,
        createdAt: existing?.createdAt,
        lastTriggeredKey: existing?.lastTriggeredKey,
      });
    } else {
      await ipcRenderer.invoke("schedule:save-batch", {
        automationIds,
        visible,
        repeat,
        slots,
        runDate: repeat ? undefined : scheduleDateInput.value,
        oneTime: repeat ? undefined : scheduleOneTimeInput.value,
      });
    }

    closeScheduleModal();
    await refreshSchedules();

    setStatus(
      automationIds.length > 1
        ? automationIds.length + " agendamentos salvos"
        : "Agendamento salvo",
      "success"
    );
  } catch (error) {
    setStatus("Erro no agendamento", "error");
    alert(error?.message || String(error));
  } finally {
    scheduleSaveButton.disabled = false;
    scheduleSaveButton.textContent = "Salvar agendamento";
  }
});

scheduleDeleteButton.addEventListener("click", () => {
  if (!currentScheduleId) return;

  const schedule = savedSchedules.find(
    (item) => item.id === currentScheduleId
  );

  openConfirmModal({
    eyebrow: "EXCLUIR AGENDAMENTO",
    title: "Excluir este agendamento?",
    description:
      "A automação continuará salva, mas deixará de ser executada automaticamente nesse horário.",
    note: schedule?.repeat
      ? "A repetição semanal configurada também será removida."
      : "Essa execução agendada será removida.",
    confirmLabel: "Excluir agendamento",
    onConfirm: async () => {
      await ipcRenderer.invoke("schedule:delete", currentScheduleId);
      closeScheduleModal();
      await refreshSchedules();
      setStatus("Agendamento excluído", "success");
    },
  });
});

scheduleModal.addEventListener("click", (event) => {
  if (event.target === scheduleModal) {
    closeScheduleModal();
  }
});

ipcRenderer.on("recordings:changed", () => {
  void refreshRecordings();
});

ipcRenderer.on("folders:changed", () => {
  void refreshFolders();
});

ipcRenderer.on("schedules:changed", () => {
  void refreshSchedules();
});

ipcRenderer.on("runs:changed", () => {
  void refreshRuns();
});

ipcRenderer.on("notifications:changed", () => {
  void refreshNotifications({ ringOnNew: true });
});

ipcRenderer.on("schedule:execution-error", (_event, payload) => {
  setStatus("Agendamento falhou", "error");

  if (payload?.message) {
    console.error("Scheduled automation failed:", payload.message);
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
  const fraction = Number(playerProgress.value) / 1000;
  const targetMs = timelineActionDurationMs * fraction;
  setEditorGlobalTimeMs(targetMs);
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
  const fraction = Math.min(
    1,
    Math.max(0, (event.clientX - rect.left) / rect.width)
  );

  setEditorGlobalTimeMs(timelineActionDurationMs * fraction);
});

recordingVideo.addEventListener("loadedmetadata", () => {
  const total = Number(recordingVideo.duration) || 0;

  if (total && pendingVideoSeekSeconds > 0) {
    recordingVideo.currentTime = Math.min(total, pendingVideoSeekSeconds);
  }

  const autoplay = recordingVideo.dataset.autoplayAfterLoad === "1";
  recordingVideo.dataset.autoplayAfterLoad = "0";

  updateVideoUI();

  if (autoplay) {
    void recordingVideo.play().catch(() => undefined);
  }
});
recordingVideo.addEventListener("timeupdate", updateVideoUI);
recordingVideo.addEventListener("play", updateVideoUI);
recordingVideo.addEventListener("pause", updateVideoUI);
recordingVideo.addEventListener("ended", updateVideoUI);

notificationBell.addEventListener("click", (event) => {
  event.stopPropagation();
  closeProfilePopover();
  const willOpen = notificationPanel.classList.contains("is-hidden");
  notificationPanel.classList.toggle("is-hidden", !willOpen);
  notificationBell.setAttribute("aria-expanded", willOpen ? "true" : "false");

  if (willOpen) {
    void refreshNotifications();
  }
});

notificationPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  if (!notificationPanel.classList.contains("is-hidden")) {
    notificationPanel.classList.add("is-hidden");
    notificationBell.setAttribute("aria-expanded", "false");
  }

  if (!profilePopover.classList.contains("is-hidden")) {
    closeProfilePopover();
  }
});

notificationMarkRead.addEventListener("click", async () => {
  notificationMarkRead.disabled = true;

  try {
    await ipcRenderer.invoke("notifications:mark-all-read");
    await refreshNotifications();
  } finally {
    notificationMarkRead.disabled = false;
  }
});

editorNotificationToggle.addEventListener("click", () => {
  if (!currentRecording) return;

  void setAutomationNotifications(
    currentRecording,
    editorNotificationToggle,
    currentRecording.notificationsEnabled !== true
  );
});

editorOptimizationButton.addEventListener("click", openOptimizationModal);
executionOptimizationButton.addEventListener("click", openOptimizationModal);

optimizationModalCancel.addEventListener("click", closeOptimizationModal);

optimizationModal.addEventListener("click", (event) => {
  if (event.target === optimizationModal) {
    closeOptimizationModal();
  }
});

optimizationModalConfirm.addEventListener("click", async () => {
  if (pendingOptimizationEnabled === null || !currentRecording) {
    closeOptimizationModal();
    return;
  }

  const targetState = pendingOptimizationEnabled;
  optimizationModalConfirm.disabled = true;
  optimizationModalCancel.disabled = true;
  optimizationModalConfirm.textContent = targetState
    ? "Ativando..."
    : "Desativando...";

  try {
    await setOptimizationState(targetState, true);
    setStatus(
      targetState ? "Otimização ativada" : "Otimização desativada",
      "success"
    );
    closeOptimizationModal();
  } catch (error) {
    optimizationModalConfirm.disabled = false;
    optimizationModalCancel.disabled = false;
    optimizationModalConfirm.textContent = targetState
      ? "Tentar ativar"
      : "Tentar desativar";
    optimizationModalNote.textContent = error?.message || String(error);
    setStatus("Erro ao alterar otimização", "error");
  }
});

initSpeedGauge(editorSpeedGauge, (speed) => {
  setCurrentExecutionSpeed(speed, "editor");
});

initSpeedGauge(executionSpeedGauge, (speed) => {
  setCurrentExecutionSpeed(speed, "execution");
});

initClickSpark();
initMagicCards();
initRubberSegment();
