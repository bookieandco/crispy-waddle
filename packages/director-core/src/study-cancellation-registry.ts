export type StudyCancellationRegistry = {
  signalFor(studyId: string): AbortSignal;
  cancel(studyId: string): boolean;
  remove(studyId: string): void;
};

export function createStudyCancellationRegistry(): StudyCancellationRegistry {
  const controllers = new Map<string, AbortController>();
  return {
    signalFor(studyId) {
      let controller = controllers.get(studyId);
      if (!controller || controller.signal.aborted) {
        controller = new AbortController();
        controllers.set(studyId, controller);
      }
      return controller.signal;
    },
    cancel(studyId) {
      const controller = controllers.get(studyId);
      if (!controller || controller.signal.aborted) return false;
      controller.abort();
      return true;
    },
    remove(studyId) {
      controllers.delete(studyId);
    },
  };
}
