import type { PodEvent } from "./events";
import type { PodJob } from "./workflow";

export type AutomationTarget = "n8n" | "activepieces" | "internal";

export type AutomationDispatch = {
  target: AutomationTarget;
  event: PodEvent;
  creationId: string;
  job?: PodJob;
};

/** Provider-neutral contract. Keep automation credentials and webhook URLs server-side. */
export function buildAutomationDispatch(event: PodEvent, job?: PodJob): AutomationDispatch {
  return { target: "internal", event, creationId: event.creationId, job };
}

export function canDispatchToProvider(dispatch: AutomationDispatch) {
  return dispatch.target === "internal" || dispatch.target === "n8n" || dispatch.target === "activepieces";
}
