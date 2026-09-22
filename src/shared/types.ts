export type AutomationActionType = "navigate" | "click" | "input";

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  timestamp: number;
  delayMs: number;
  url: string;
  selector?: string;
  value?: string;
  isSecret?: boolean;
}

export interface AutomationRecording {
  id: string;
  name: string;
  initialUrl: string;
  createdAt: string;
  actions: AutomationAction[];
}

export interface RunOptions {
  headless: boolean;
}
