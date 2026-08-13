import { bindAuthenticatedPrincipal, type AuthVerifier } from './auth-binding.js';
import { createSecurityRequest } from './index.js';

const verifier: AuthVerifier = {
  async verifyAccessToken(token) {
    if (token === 'valid-user-1') return { userId: 'user-1', sessionId: 'session-1' };
    return null;
  },
};

const validRequest = createSecurityRequest({
  requestId: 'auth-binding-test',
  actorId: 'user-1',
  domain: 'money',
  capability: 'money.account.read',
});

const bound = await bindAuthenticatedPrincipal(verifier, 'valid-user-1', validRequest);
if (!bound || bound.actorId !== 'user-1') throw new Error('AUTH_BINDING_VALID_CASE_FAILED');

const forgedRequest = { ...validRequest, actorId: 'user-2' };
const forged = await bindAuthenticatedPrincipal(verifier, 'valid-user-1', forgedRequest);
if (forged !== null) throw new Error('AUTH_BINDING_FORGED_ACTOR_NOT_REJECTED');

const invalidToken = await bindAuthenticatedPrincipal(verifier, 'invalid', validRequest);
if (invalidToken !== null) throw new Error('AUTH_BINDING_INVALID_TOKEN_NOT_REJECTED');

console.log('Auth binding security tests passed');
