export type StudyControlAction = 'start' | 'pause' | 'resume' | 'stop' | 'promote-learning';

export type StudyControlClient = {
  dispatch(action: StudyControlAction): Promise<void>;
};

export function createStudyControlClient(dispatcher: (action: StudyControlAction) => Promise<void>): StudyControlClient {
  return { dispatch: dispatcher };
}
