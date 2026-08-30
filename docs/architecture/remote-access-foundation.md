# Remote Access Foundation

Status: foundation / contract-only

## Scope

Remote Access is a separate infrastructure capability family. It is not part of the Storage provider chain.

mRemoteNG is treated as an architectural reference for multi-protocol connection abstraction only. Its connection-management behavior is not imported into Jhadina.

## Boundary

```text
Application
    |
    v
Capability / Grant
    |
    v
Policy Enforcement
    |
    v
Remote Access Runtime
    |
    v
Protocol Provider
    |
    v
Remote Endpoint
```

## Initial protocol vocabulary

- RDP
- SSH
- VNC
- Telnet
- HTTP / HTTPS
- rlogin
- raw sockets
- PowerShell remoting
- AnyDesk

The vocabulary does not imply that a provider has been implemented for every protocol.

## Security invariants

1. Application code does not call a remote provider directly.
2. A remote operation requires an explicit capability grant.
3. The grant constrains protocol, operation, and optionally endpoint identity.
4. Expired grants are rejected before provider execution.
5. Session lifecycle operations are independently authorized.
6. Provider registration is deterministic: one provider per protocol in a runtime instance.
7. Provider implementations own protocol mechanics; policy remains outside providers.
8. Credentials and secrets are intentionally absent from the foundation contract.
9. Remote access must not be wired into Storage merely to reuse infrastructure code.

## Current implementation

`@jhadina/remote-access-core` contains:

- protocol and endpoint contracts;
- capability/grant contracts;
- policy enforcement;
- provider contract;
- in-memory runtime for deterministic integration testing;
- tests proving protocol, endpoint, expiry, and operation authorization.

Production providers, credential brokers, audit sinks, network discovery, and UI are intentionally deferred.
