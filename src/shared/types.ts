export type AutomationActionType = "navigate" | "click" | "input" | "key";
export type ExecutionSpeed = 1 | 1.5 | 2;

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  timestamp: number;
  delayMs: number;
  url: string;
  selector?: string;
  targetText?: string;
  targetAriaLabel?: string;
  targetRole?: string;
  targetTitle?: string;
  value?: string;
  dynamicValuePrompt?: string;
  dynamicValueContext?: string;
  dynamicValueSequence?: string[];
  hybridDirectiveId?: string;
  isSecret?: boolean;
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  frameUrl?: string;
  frameName?: string;
  pageId?: string;
  x?: number;
  y?: number;
}

export interface AutomationVideoSegment {
  pageId: string;
  startedAtMs: number;
  videoPath?: string;
  url?: string;
  title?: string;
}

export interface AutomationTag {
  name: string;
  color: string;
}

export interface AutomationHybridPattern {
  detected: boolean;
  confidence: number;
  description: string;
  collectionDetected?: boolean;
  collectionDescription?: string;
  itemSelector?: string;
  itemLinkSelector?: string;
  paginationDetected?: boolean;
  paginationDescription?: string;
  nextSelector?: string;
  nextText?: string;
}

export interface AutomationHybridInputPlan {
  mode: "fixed" | "sequence" | "ai";
  values?: string[];
  prompt?: string;
}

export interface AutomationHybridDirective {
  id: string;
  scope: "from_here";
  anchorActionId?: string;
  anchorSelector: string;
  anchorUrl: string;
  anchorPageId?: string;
  fieldLabel?: string;
  startActionIndex?: number;
  instruction: string;
  summary: string;
  runtimeObjective: string;
  inputPlan?: AutomationHybridInputPlan;
  pattern: AutomationHybridPattern;
  adjustments?: string[];
  demonstrationActionIds?: string[];
  consumeFollowingActions?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AutomationRecording {
  id: string;
  name: string;
  initialUrl: string;
  createdAt: string;
  updatedAt?: string;
  actions: AutomationAction[];
  videoPath?: string;
  videoSegments?: AutomationVideoSegment[];
  domainIconPath?: string;
  domainIconSourceUrl?: string;
  executionSpeed?: ExecutionSpeed;
  optimizationEnabled?: boolean;
  notificationsEnabled?: boolean;
  loopCount?: number;
  hybridDirectives?: AutomationHybridDirective[];
  folderId?: string;
  tags?: AutomationTag[];
}

export interface RunOptions {
  headless: boolean;
}

export interface ScheduleSlot {
  weekday: number;
  time: string;
}

export interface AutomationSchedule {
  id: string;
  automationId: string;
  name: string;
  enabled: boolean;
  visible: boolean;
  repeat: boolean;
  slots: ScheduleSlot[];
  runDate?: string;
  oneTime?: string;
  createdAt: string;
  updatedAt: string;
  lastTriggeredKey?: string;
}

export type AutomationRunSource = "manual" | "schedule";
export type AutomationRunStatus = "running" | "success" | "error";
export type AutomationRunReportEntryKind =
  | "copied"
  | "written"
  | "important";

export interface AutomationRunReportEntry {
  id: string;
  kind: AutomationRunReportEntryKind;
  label: string;
  value: string;
  url?: string;
  actionId?: string;
  hybridDirectiveId?: string;
  loopIndex?: number;
  createdAt: string;
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  automationName: string;
  scheduleId?: string;
  source: AutomationRunSource;
  visible: boolean;
  startedAt: string;
  finishedAt?: string;
  status: AutomationRunStatus;
  error?: string;
  reportEntries?: AutomationRunReportEntry[];
}

export interface AutomationFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationNotificationRecord {
  id: string;
  automationId: string;
  automationName: string;
  scheduleId?: string;
  source: AutomationRunSource;
  status: "success" | "error";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}
