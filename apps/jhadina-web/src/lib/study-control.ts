export type StudyControlAction = 'start' | 'pause' | 'resume' | 'stop' | 'promote-learning';

export type StudyControlClient = {
  dispatch(action: StudyControlAction): Promise<void>;
};

export function createStudyControlClient(dispatcher: (action: StudyControlAction) => Promise<void>): StudyControlClient {
  return { dispatch: dispatcher };
}

export function createHttpStudyControlClient(studyId: string, fetcher: typeof fetch = fetch): StudyControlClient {
  return {
    async dispatch(action) {
      const response = await fetcher('/api/study/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studyId, action }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(body?.error ?? `Study control failed (${response.status})`);
      }
    },
  };
}
