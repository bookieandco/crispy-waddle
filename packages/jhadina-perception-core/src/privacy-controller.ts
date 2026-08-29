import type { PerceptionEvent, PerceptionPrivacyPort } from "./perception-contract";

export type PerceptionPrivacyState = "off" | "manual" | "active" | "private" | "paused";

export class PerceptionPrivacyController implements PerceptionPrivacyPort {
  constructor(private state: PerceptionPrivacyState = "off") {}

  getState(): PerceptionPrivacyState {
    return this.state;
  }

  setState(state: PerceptionPrivacyState): void {
    this.state = state;
  }

  isAllowed(event: PerceptionEvent): boolean {
    if (this.state === "private" || this.state === "paused" || this.state === "off") return false;
    if (event.sensitivity === "private") return false;
    return true;
  }
}
