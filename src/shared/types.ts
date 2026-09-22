export type AutomationActionType = "navigate" | "click" | "input";
export type ExecutionSpeed = 1 | 1.5 | 2;

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  timestamp: number;
  delayMs: number;
  url: string;
  selector?: string;
  value?: string;
  isSecret?: boolean;
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

export interface AutomationRecording {
  id: string;
  name: string;
  initialUrl: string;
  createdAt: string;
  updatedAt?: string;
  actions: AutomationAction[];
  videoPath?: string;
  videoSegments?: AutomationVideoSegment[];
  executionSpeed?: ExecutionSpeed;
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
}
