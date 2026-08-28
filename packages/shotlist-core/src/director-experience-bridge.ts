import type { ExperienceEvent } from '@jhadina/core-spine';
import { createDirectorTakeFeedbackEvent, createDirectorTakeGeneratedEvent, type DirectorTakeFeedbackInput, type DirectorTakeGeneratedInput } from './director-experience-events.js';

export interface DirectorExperienceWriter {
  append(event: ExperienceEvent): Promise<unknown>;
}

export function createDirectorExperienceBridge(writer: DirectorExperienceWriter) {
  return {
    appendGenerated(input: DirectorTakeGeneratedInput) {
      return writer.append(createDirectorTakeGeneratedEvent(input));
    },
    appendFeedback(input: DirectorTakeFeedbackInput) {
      return writer.append(createDirectorTakeFeedbackEvent(input));
    },
  };
}
