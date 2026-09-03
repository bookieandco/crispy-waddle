import type { PluginAutomationPlan, PluginDescriptor } from "./plugin-automation.js";
import type { PluginHostFormat, PluginHostRequest, PluginHostResult } from "./plugin-host.js";
import { validatePluginHostRequest } from "./plugin-host.js";

export interface NativePluginParameter { id: string; name: string; stepCount: number; defaultNormalizedValue: number; automatable: boolean; }
export interface NativePluginIdentity { id: string; vendor: string; name: string; version: string; format: PluginHostFormat; binaryHash: string; parameters: NativePluginParameter[]; }
export interface NativePluginHost {
  discover(input: { format: PluginHostFormat; pluginPath: string }): Promise<NativePluginIdentity>;
  render(input: { identity: NativePluginIdentity; request: PluginHostRequest; automation: PluginAutomationPlan }): Promise<PluginHostResult>;
}

function sandboxPath(path: string): boolean { return path.startsWith("/workspace/") && !path.includes("..") && !/[\r\n]/.test(path); }

function assertIdentityMatchesDescriptor(descriptor: PluginDescriptor, identity: NativePluginIdentity): void {
  if (identity.id !== descriptor.id) throw new Error("Native plugin ID does not match registered descriptor.");
  if (identity.vendor !== descriptor.vendor || identity.name !== descriptor.name || identity.version !== descriptor.version) throw new Error("Native plugin identity does not match registered descriptor.");
  if (identity.format !== descriptor.format) throw new Error("Native plugin format does not match registered descriptor.");
  if (identity.binaryHash !== descriptor.binaryHash) throw new Error("Native plugin binary hash does not match registered descriptor.");
  const expected = new Map(descriptor.parameters.map((p) => [p.id, p]));
  const observed = new Map(identity.parameters.map((p) => [p.id, p]));
  if (expected.size !== observed.size) throw new Error("Native plugin parameter set does not match registered descriptor.");
  for (const [id, parameter] of expected) {
    const actual = observed.get(id);
    if (!actual) throw new Error(`Native plugin is missing registered parameter: ${id}`);
    if (actual.name !== parameter.name || actual.stepCount !== parameter.stepCount || actual.automatable !== parameter.automatable) throw new Error(`Native plugin parameter metadata changed: ${id}`);
  }
}

export async function discoverAuthorizedPlugin(descriptor: PluginDescriptor, pluginPath: string, host: NativePluginHost): Promise<NativePluginIdentity> {
  if (!sandboxPath(pluginPath)) throw new Error("Native plugin path must remain inside the sandbox workspace.");
  const identity = await host.discover({ format: descriptor.format, pluginPath });
  assertIdentityMatchesDescriptor(descriptor, identity);
  return identity;
}

export async function renderAuthorizedPlugin(descriptor: PluginDescriptor, request: PluginHostRequest, host: NativePluginHost): Promise<PluginHostResult> {
  validatePluginHostRequest(request);
  if (request.plugin.id !== descriptor.id) throw new Error("Host request plugin does not match registered descriptor.");
  if (request.plugin.binaryHash !== descriptor.binaryHash) throw new Error("Host request binary hash does not match registered descriptor.");
  const identity = await discoverAuthorizedPlugin(descriptor, `/workspace/plugins/${descriptor.id}`, host);
  if (request.automation.pluginBinaryHash !== identity.binaryHash) throw new Error("Automation binary hash does not match discovered native plugin.");
  return host.render({ identity, request, automation: request.automation });
}
