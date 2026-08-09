import {
  InMemoryOsRegistry,
  createOsRegistrySnapshot,
  type OsImplementationRegistration,
} from '@jhadina/integration';

/** Application-level OS registry. Concrete adapters are attached during composition. */
export const osRegistry = new InMemoryOsRegistry();

export function getOsRegistrySnapshot() {
  return createOsRegistrySnapshot(osRegistry);
}

export function registerOsImplementation(registration: OsImplementationRegistration): void {
  osRegistry.register(registration);
}
