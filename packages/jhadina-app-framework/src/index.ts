export * from './data-boundary';

export type JhadinaAppLifecycleState =
  | 'installed'
  | 'registered'
  | 'enabled'
  | 'starting'
  | 'running'
  | 'background'
  | 'suspended'
  | 'stopped'
  | 'failed'
  | 'disabled';

export type JhadinaPermissionRisk =
  | 'read'
  | 'write'
  | 'external'
  | 'financial'
  | 'destructive';

export interface JhadinaAppCapability {
  readonly name: string;
  readonly version: number;
  readonly risk: JhadinaPermissionRisk;
  readonly reason: string;
}

export interface JhadinaAppManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly icon: string;
  readonly description: string;
  readonly minOsVersion: string;
  readonly capabilities: readonly JhadinaAppCapability[];
  readonly permissions: readonly string[];
  readonly routes: readonly string[];
  readonly commands: readonly string[];
  readonly events: readonly string[];
  readonly widgets?: readonly string[];
  readonly backgroundJobs?: readonly string[];
  readonly dataBoundary: DataBoundary;
}

export interface RegisteredJhadinaApp {
  readonly manifest: JhadinaAppManifest;
  readonly state: JhadinaAppLifecycleState;
  readonly installedAt: string;
  readonly updatedAt: string;
}

export class JhadinaAppRegistry {
  private readonly apps = new Map<string, RegisteredJhadinaApp>();

  register(manifest: JhadinaAppManifest, now = new Date().toISOString()): RegisteredJhadinaApp {
    if (!manifest.id.trim()) throw new Error('App id is required');
    if (!manifest.name.trim()) throw new Error(`App name is required: ${manifest.id}`);
    if (this.apps.has(manifest.id)) throw new Error(`App already registered: ${manifest.id}`);
    if (manifest.dataBoundary.customerDataToPersonalMemory !== false) {
      throw new Error(`Invalid data boundary for ${manifest.id}`);
    }

    const registered: RegisteredJhadinaApp = Object.freeze({
      manifest: Object.freeze({ ...manifest }),
      state: 'registered',
      installedAt: now,
      updatedAt: now,
    });

    this.apps.set(manifest.id, registered);
    return registered;
  }

  get(id: string): RegisteredJhadinaApp | undefined {
    return this.apps.get(id);
  }

  list(): readonly RegisteredJhadinaApp[] {
    return [...this.apps.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }

  setState(id: string, state: JhadinaAppLifecycleState, now = new Date().toISOString()): RegisteredJhadinaApp {
    const current = this.apps.get(id);
    if (!current) throw new Error(`Unknown Jhadina app: ${id}`);

    const next = Object.freeze({ ...current, state, updatedAt: now });
    this.apps.set(id, next);
    return next;
  }
}

export const JHADINA_SYSTEM_APP_IDS = [
  'jhadina', 'memory', 'money', 'media', 'overage', 'music', 'directoros',
  'pupsonstuff', 'social', 'government', 'files', 'developer', 'home', 'safety',
] as const;

export type JhadinaSystemAppId = (typeof JHADINA_SYSTEM_APP_IDS)[number];
