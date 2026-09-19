# Replacement service GPU compositor

`GpuCompositeEngine` consumes masks bound to approved character track IDs and applies a fixed safe recipe: motion preservation, optional source-light preservation, color matching, and edge blending. The media backend owns actual GPU frame decode, model/kernel execution, and encode/persistence.

Every output carries measured temporal-consistency, edge-quality, and lighting-match evidence. Those measurements are evidence for the existing Studio QC gate; they do **not** approve the asset.

A deployment backend may use CUDA/Metal/native video processing without changing Director governance. It must resolve only the governed asset IDs supplied to this service and persist the output under the deterministic artifact ID supplied by the engine.
