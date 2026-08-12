export interface AdobeRuntimeDeploymentRequest {
  projectId: string;
  actionName: string;
  parameters: Record<string, unknown>;
}

export interface AdobeRuntimeDeploymentResult {
  status: "configured" | "not-configured";
  activationId?: string;
  message: string;
}

/**
 * Optional infrastructure adapter for deploying/invoking Studio workloads
 * through Adobe I/O Runtime. Secrets stay server-side; the Studio client never
 * receives Adobe credentials.
 */
export class AdobeRuntimeAdapter {
  readonly name = "adobe-io-runtime";

  isConfigured(): boolean {
    return Boolean(process.env.ADOBE_IO_RUNTIME_API_HOST && process.env.ADOBE_IO_RUNTIME_AUTH);
  }

  async invoke(request: AdobeRuntimeDeploymentRequest): Promise<AdobeRuntimeDeploymentResult> {
    if (!this.isConfigured()) {
      return {
        status: "not-configured",
        message: "Adobe I/O Runtime is not configured for this environment.",
      };
    }

    // The deployment/invocation transport belongs in the server-side runtime
    // integration. Keep credentials and provider-specific authentication out
    // of browser code and out of Studio action payloads.
    return {
      status: "configured",
      message: `Adobe I/O Runtime action ${request.actionName} is ready for server-side invocation.`,
    };
  }
}
