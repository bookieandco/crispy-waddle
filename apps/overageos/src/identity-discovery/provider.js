/**
 * Provider boundary for identity discovery.
 * Providers return public/authorized observations only; they do not verify entitlement.
 */
class IdentityDiscoveryProvider {
  constructor(name, sourceClass) {
    this.name = name;
    this.sourceClass = sourceClass;
  }

  async discover(_candidate) {
    throw new Error(`${this.name}.discover() is not implemented`);
  }
}

function createProviderAdapter({ name, sourceClass, discover }) {
  if (!name || !sourceClass || typeof discover !== 'function') {
    throw new Error('Provider requires name, sourceClass, and discover function');
  }
  return Object.freeze({
    name,
    sourceClass,
    discover,
  });
}

module.exports = { IdentityDiscoveryProvider, createProviderAdapter };
