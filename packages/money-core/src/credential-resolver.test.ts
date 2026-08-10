import { credentialRefToEnvKey, EnvironmentCredentialResolver } from './credential-resolver.js';

if (credentialRefToEnvKey('money/coinbase/default') !== 'JHADINA_SECRET_COINBASE_DEFAULT') {
  throw new Error('CREDENTIAL_REF_MAPPING_FAILED');
}

const resolver = new EnvironmentCredentialResolver({ JHADINA_SECRET_COINBASE_DEFAULT: 'test-secret' });
const resolved = await resolver.resolve('money/coinbase/default');
if (resolved.secret !== 'test-secret') throw new Error('CREDENTIAL_RESOLUTION_FAILED');

let invalidRejected = false;
try {
  await resolver.resolve('money/../secret');
} catch {
  invalidRejected = true;
}
if (!invalidRejected) throw new Error('INVALID_CREDENTIAL_REF_ACCEPTED');

let missingRejected = false;
try {
  await new EnvironmentCredentialResolver({}).resolve('money/coinbase/default');
} catch {
  missingRejected = true;
}
if (!missingRejected) throw new Error('MISSING_CREDENTIAL_NOT_REJECTED');

console.log('Credential resolver passed');
