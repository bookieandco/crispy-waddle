import type {
  AcceleratorInventory,
  ComputeNode,
  ComputeWorkload,
  PlacementCandidate,
  PlacementPlan,
  PlacementRejectionCode,
} from './resource-contract.js';

function matchingAccelerators(node: ComputeNode, workload: ComputeWorkload): AcceleratorInventory[] {
  const gpu = workload.resources.gpu;
  if (!gpu) return [];

  return node.accelerators.filter((accelerator) => {
    if (accelerator.vendor === 'cpu') return false;
    if (gpu.vendor && accelerator.vendor !== gpu.vendor) return false;
    return true;
  });
}

function rejectionCodes(node: ComputeNode, workload: ComputeWorkload): PlacementRejectionCode[] {
  const codes: PlacementRejectionCode[] = [];
  const request = workload.resources;

  if (node.status !== 'ready') codes.push('NODE_NOT_READY');
  if (workload.forbiddenNodeIds?.includes(node.id)) codes.push('FORBIDDEN_NODE');
  if (node.cpuCoresFree < request.cpuCores) codes.push('CPU_INSUFFICIENT');
  if (node.ramGiBFree < request.ramGiB) codes.push('RAM_INSUFFICIENT');
  if (node.scratchGiBFree < request.scratchGiB) codes.push('SCRATCH_INSUFFICIENT');

  if (request.networkFabric) {
    const fabric=node.networkFabrics?.find(candidate=>candidate.fabric===request.networkFabric);
    if (!fabric || fabric.status==='offline') {
      codes.push('NETWORK_FABRIC_UNAVAILABLE');
    } else if (
      request.networkMbps !== undefined &&
      fabric.bandwidthMbpsAvailable < request.networkMbps
    ) {
      codes.push('NETWORK_INSUFFICIENT');
    }
  } else if (
    request.networkMbps !== undefined &&
    (node.networkMbpsAvailable ?? 0) < request.networkMbps
  ) {
    codes.push('NETWORK_INSUFFICIENT');
  }

  if (node.provider === 'cloud') {
    if (!request.allowCloudBurst) codes.push('CLOUD_BURST_NOT_ALLOWED');
    if (request.sensitiveData) codes.push('SENSITIVE_DATA_CLOUD_DENIED');
    if (
      request.maxCostUsdPerHour !== undefined &&
      (node.hourlyCostUsd ?? Number.POSITIVE_INFINITY) > request.maxCostUsdPerHour
    ) {
      codes.push('COST_LIMIT_EXCEEDED');
    }
  }

  if (request.gpu) {
    const matches = matchingAccelerators(node, workload);
    const totalCount = matches.reduce((sum, accelerator) => sum + accelerator.count, 0);
    if (totalCount < request.gpu.count) {
      codes.push('GPU_INSUFFICIENT');
    } else {
      if (
        request.gpu.minVramGiBPerDevice !== undefined &&
        !matches.some((accelerator) => {
          const totalOk=(accelerator.vramGiBPerDevice ?? 0)>=request.gpu!.minVramGiBPerDevice!;
          const free=accelerator.vramGiBFreePerDevice;
          const freeOk=free===undefined||free>=request.gpu!.minVramGiBPerDevice!;
          return totalOk&&freeOk&&accelerator.count>=request.gpu!.count;
        })
      ) {
        codes.push('GPU_VRAM_INSUFFICIENT');
      }

      const requiredFeatures = request.gpu.requiredFeatures ?? [];
      if (
        requiredFeatures.length > 0 &&
        !matches.some((accelerator) =>
          requiredFeatures.every((feature) => accelerator.features?.includes(feature)),
        )
      ) {
        codes.push('GPU_FEATURE_MISSING');
      }
    }
  }

  return [...new Set(codes)];
}

function candidateScore(node: ComputeNode, workload: ComputeWorkload): PlacementCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (node.provider === 'homebase') {
    score += 100;
    reasons.push('homebase-local');
  } else if (node.provider === 'remote-homebase') {
    score += 70;
    reasons.push('trusted-remote-homebase');
  } else {
    score += 10;
    reasons.push('explicit-cloud-burst');
  }

  if (workload.preferredNodeIds?.includes(node.id)) {
    score += 80;
    reasons.push('preferred-node');
  }

  const locality = new Set(node.localityKeys ?? []);
  const localityHits = (workload.dataLocalityKeys ?? []).filter((key) => locality.has(key)).length;
  if (localityHits > 0) {
    score += localityHits * 25;
    reasons.push(`data-locality:${localityHits}`);
  }

  const ramHeadroom = node.ramGiBFree - workload.resources.ramGiB;
  const scratchHeadroom = node.scratchGiBFree - workload.resources.scratchGiB;
  score += Math.min(Math.max(ramHeadroom, 0), 64) / 8;
  score += Math.min(Math.max(scratchHeadroom, 0), 512) / 64;

  if (workload.resources.gpu) {
    const matches = matchingAccelerators(node, workload);
    const bestVram = Math.max(...matches.map((accelerator) =>
      accelerator.vramGiBFreePerDevice ?? accelerator.vramGiBPerDevice ?? 0
    ), 0);
    const requestedVram = workload.resources.gpu.minVramGiBPerDevice ?? 0;
    score += Math.min(Math.max(bestVram - requestedVram, 0), 48) / 4;
    reasons.push(`gpu-headroom:${Math.max(bestVram - requestedVram, 0)}GiB`);
  }

  if (node.hourlyCostUsd !== undefined) {
    score -= node.hourlyCostUsd * 2;
    reasons.push(`cost:${node.hourlyCostUsd.toFixed(2)}/hr`);
  }

  return { nodeId: node.id, score: Number(score.toFixed(3)), reasons };
}

/**
 * Pure placement planning only. This function does not start containers,
 * authorize data movement, mutate durable job state, or spend money.
 */
export function planPlacement(nodes: ComputeNode[], workload: ComputeWorkload): PlacementPlan {
  const candidates: PlacementCandidate[] = [];
  const rejected: PlacementPlan['rejected'] = [];

  for (const node of nodes) {
    const codes = rejectionCodes(node, workload);
    if (codes.length > 0) {
      rejected.push({ nodeId: node.id, codes });
      continue;
    }
    candidates.push(candidateScore(node, workload));
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.nodeId.localeCompare(right.nodeId);
  });
  rejected.sort((left, right) => left.nodeId.localeCompare(right.nodeId));

  return {
    workloadId: workload.id,
    selectedNodeId: candidates[0]?.nodeId,
    candidates,
    rejected,
  };
}
