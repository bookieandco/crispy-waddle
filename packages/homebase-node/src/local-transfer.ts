export interface LocalTransferFile {
  id: string;
  path: string;
  sizeBytes: number;
  sha256?: string;
  contentType?: string;
}

export interface LocalTransferPeer {
  id: string;
  label: string;
  address: string;
  port: number;
  fingerprint?: string;
  trusted: boolean;
}

export interface LocalTransferAdapter {
  discover(): Promise<LocalTransferPeer[]>;
  prepare(peer: LocalTransferPeer, files: LocalTransferFile[]): Promise<string>;
  send(sessionId: string, files: LocalTransferFile[]): Promise<void>;
  cancel(sessionId: string): Promise<void>;
}

/**
 * Local transfer is an optimization, not a trust boundary. The Homebase
 * still authenticates the device and validates file hashes before ingestion.
 */
export function verifyTransferHash(expected: string, actual: string): boolean {
  return expected === actual;
}
