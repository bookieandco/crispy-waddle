import type {
  ActionHandler,
  ActionRequest,
} from "../../jhadina-action-core/src/action-executor";
import { JhadinaMusicCapability, type MusicAction, type MusicActionResult } from "./jhadina-music";

export class JhadinaMusicActionHandler implements ActionHandler<MusicAction, MusicActionResult> {
  constructor(private readonly capability: JhadinaMusicCapability) {}

  supports(type: string): boolean {
    return type.startsWith("music.");
  }

  execute(
    action: MusicAction,
    _request: ActionRequest<MusicAction>,
  ): Promise<MusicActionResult> {
    return this.capability.execute(action);
  }
}
