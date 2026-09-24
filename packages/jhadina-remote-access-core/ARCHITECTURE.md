# Remote Access Architecture

Remote access is an infrastructure capability family, independent of Storage.

## Boundary

Application code requests a named capability and receives no provider directly.

`request → grant → policy → runtime → provider registry → protocol adapter → endpoint`

## Provider registry invariants

- One provider per protocol.
- Resolution is deterministic by protocol.
- Missing providers fail closed.
- Provider implementations are not policy authorities.

## Security invariants

- Every open/close/execute operation is policy-authorized.
- Grants may restrict protocols, operations, endpoints, and lifetime.
- A session is bound to the provider selected for its protocol.
- Execution requires an existing session and matching endpoint.
- Credentials/secrets are outside this foundation layer.

## mRemoteNG relationship

mRemoteNG is an architectural reference for multi-protocol remote-session abstraction. It is not a dependency, provider, credential manager, or Storage component.
