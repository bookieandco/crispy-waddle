export type SshCredentialRef = Readonly<{
  id: string;
}>;

export type SshCredentialMaterial = Readonly<{
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}>;

export interface RemoteCredentialProvider<TRef = SshCredentialRef, TMaterial = SshCredentialMaterial> {
  resolve(ref: TRef): Promise<TMaterial>;
}

export class InMemorySshCredentialProvider implements RemoteCredentialProvider {
  private readonly values = new Map<string, SshCredentialMaterial>();

  put(ref: SshCredentialRef, material: SshCredentialMaterial): void {
    this.values.set(ref.id, Object.freeze({ ...material }));
  }

  async resolve(ref: SshCredentialRef): Promise<SshCredentialMaterial> {
    const material = this.values.get(ref.id);
    if (!material) throw new Error(`SSH credential not found: ${ref.id}`);
    return material;
  }
}
