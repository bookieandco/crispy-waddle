# Jhadina AI cluster network fabrics

Reference input: Juniper `terraform-apstra-examples/ai-cluster-designs/storage_racks.tf`.

The reference models L3 Clos AI storage racks with 200GbE/400GbE server access
and multiple 400G spine uplinks, including dedicated Weka storage-node racks.

Jhadina adopts the **fabric-role abstraction**, not those exact port counts.

## Canonical fabric roles

- `converged` — small Homebase deployments where management, storage and
  workload traffic safely share links.
- `frontend` — API/user/ingress and ordinary service traffic.
- `storage` — CephFS/RGW, checkpoint, dataset and media traffic.
- `gpu-backend` — distributed training/inference collective traffic when
  required.

Compute resource profiles may request a named fabric plus minimum available
bandwidth. Hardware inventory reports current fabric health/capacity. Placement
fails closed if the requested fabric is absent/offline.

## Scale rule

Do not buy or configure a dedicated storage fabric merely because large AI
clusters use one. Split the fabrics when measured evidence shows that converged
traffic cannot meet queue latency, storage throughput, collective traffic or
failure-domain targets.

Juniper's 200/400GbE examples are useful reference scale designs for a future
multi-rack cluster. They are not current Homebase hardware claims.
