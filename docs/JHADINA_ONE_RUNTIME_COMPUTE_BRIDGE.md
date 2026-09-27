# JHADINA-ONE-RUNTIME.5 — WorkSession to Compute Core bridge

## Boundary

Core Spine owns task state.

Compute Core owns provider-neutral resource description and placement.

This adapter only converts a compute-eligible WorkSession task into an existing `ComputeWorkloadDraft`.

It does not:

- claim the task;
- mark the task running;
- place the workload;
- submit Kubernetes/Kueue work;
- authorize cloud spend;
- authorize the task's real-world effect.

## Dispatchable states

Only:

- `ready`;
- `retrying`

may produce compute drafts.

Running work already has an executor/lease. Blocked, approval-waiting, paused, terminal and dependency-waiting tasks are not new compute submissions.

## Lineage

Every draft binds:

- `authority.system = jhadina-work-session-task`;
- `authority.jobId = <workSessionId>:<taskId>`;
- the original task idempotency key;
- WorkSession locality;
- task locality;
- task input references as locality hints.

The bridge includes an assertion helper so lineage mutation can be detected before submission.

## Cloud burst

`allowCloudBurst` remains exactly what Compute Core already defines: eligibility metadata.

It is not spend authority.

Cloud placement must still pass Compute Core privacy/cost rules and the production policy/approval boundary before any paid remote resource is commissioned.

## Execution sequence

```text
WorkSession task READY/RETRYING
        |
        v
compute draft
        |
        v
resource profile resolution
        |
        v
placement/admission
        |
        v
worker starts
        |
        v
task lease claim -> RUNNING
```

This preserves the distinction between scheduling and authority.
