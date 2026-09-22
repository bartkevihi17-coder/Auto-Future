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
  x?: number;
  y?: number;
}

export interface AutomationRecording {
  id: string;
  name: string;
  initialUrl: string;
  createdAt: string;
  actions: AutomationAction[];
  videoPath?: string;
  executionSpeed?: ExecutionSpeed;
}

export interface RunOptions {
  headless: boolean;
}
