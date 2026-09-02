import type { ComfyUIClient } from './generation-provider';

export type ComfyUIHttpClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`ComfyUI request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  if (!body) return {};
  return JSON.parse(body) as Record<string, unknown>;
}

/**
 * Thin HTTP transport for ComfyUI. Workflow construction stays in a separate
 * ComfyUIWorkflowBuilder so DirectorOS does not learn ComfyUI node IDs.
 */
export function createComfyUIHttpClient(options: ComfyUIHttpClientOptions): ComfyUIClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };

  return {
    async queuePrompt(workflow, queueOptions) {
      const response = await fetchImpl(joinUrl(options.baseUrl, '/prompt'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: workflow,
          ...(queueOptions?.clientId ? { client_id: queueOptions.clientId } : {}),
        }),
      });
      const body = await parseJson(response);
      const promptId = typeof body.prompt_id === 'string' ? body.prompt_id : undefined;
      if (!promptId) throw new Error('ComfyUI /prompt response did not contain prompt_id');
      return { promptId };
    },

    async getHistory(promptId) {
      const response = await fetchImpl(joinUrl(options.baseUrl, `/history/${encodeURIComponent(promptId)}`), {
        method: 'GET',
        headers,
      });
      const body = await parseJson(response);
      const entry = body[promptId];
      return entry && typeof entry === 'object' ? entry as Record<string, unknown> : body;
    },

    async interrupt(promptId) {
      const response = await fetchImpl(joinUrl(options.baseUrl, '/interrupt'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt_id: promptId }),
      });
      await parseJson(response);
    },
  };
}
