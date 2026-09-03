import type { PluginDescriptor } from "./plugin-automation.js";

export interface Vst3ClassInfo { classId: string; name: string; vendor: string; version: string; category: string; }
export interface Vst3FactoryInfo { vendor: string; url: string; email: string; }
export interface Vst3DiscoveryResult { pluginPath: string; binaryHash: string; factory: Vst3FactoryInfo; classes: readonly Vst3ClassInfo[]; }
export interface Vst3DiscoveryHost { discover(pluginPath: string): Promise<Vst3DiscoveryResult>; }

function assertSafeWorkspacePath(pluginPath: string): void {
  if (!pluginPath.startsWith("/workspace/plugins/") || pluginPath.includes("..") || /[\r\n\0]/.test(pluginPath)) throw new Error("VST3 plugin path is outside the authorized workspace");
}
function assertHash(hash: string): void { if (!/^[a-f0-9]{32,128}$/i.test(hash)) throw new Error("VST3 binary hash is invalid"); }
function assertExact(actual: string, expected: string, field: string): void { if (actual !== expected) throw new Error(`VST3 ${field} does not match authorized descriptor`); }

/** Discovery is evidence only; it cannot authorize execution or promotion. */
export async function discoverAuthorizedVst3(host: Vst3DiscoveryHost, descriptor: PluginDescriptor, pluginPath: string): Promise<Vst3DiscoveryResult> {
  assertSafeWorkspacePath(pluginPath);
  if (descriptor.format !== "vst3") throw new Error("VST3 discovery requires a VST3 descriptor");
  const result = await host.discover(pluginPath);
  assertSafeWorkspacePath(result.pluginPath);
  assertExact(result.pluginPath, pluginPath, "plugin path");
  assertHash(result.binaryHash);
  assertExact(result.binaryHash, descriptor.binaryHash, "binary hash");
  const matchingClass = result.classes.find((item) => item.classId === descriptor.id);
  if (!matchingClass) throw new Error("VST3 authorized class ID was not discovered");
  assertExact(matchingClass.vendor, descriptor.vendor, "vendor");
  assertExact(matchingClass.name, descriptor.name, "name");
  assertExact(matchingClass.version, descriptor.version, "version");
  return result;
}
