import type { MemoryRepository } from "../repositories/MemoryRepository.js";
import type { PreferenceRepository } from "../repositories/PreferenceRepository.js";
import type { AuditService } from "./AuditService.js";
import type { InteractionEventType, Memory, MemoryCandidate, Place, ProposedPreference } from "../types.js";
import { resolveTruckAttribute } from "../types.js";

export interface ProposeFromInteractionInput {
  driverId: string;
  place: Place;
  eventType: InteractionEventType;
}

/**
 * The Memory Core pipeline:
 *
 *   Observation -> Memory Candidate -> Driver Approval -> Preference
 *
 * Nothing in this class writes to `preferences` (the table FunFinder reads
 * to personalize ranking) except `approve()`, and `approve()` only runs
 * when a driver explicitly calls it. A candidate that is never approved
 * never influences a search. That's the whole point.
 */
export class MemoryService {
  constructor(
    private readonly memoryRepo: MemoryRepository,
    private readonly preferenceRepo: PreferenceRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Turns a positive interaction (saved/liked) into a candidate the driver
   * can review. Returns null when the interaction isn't the kind of signal
   * worth proposing a memory from (e.g. a "dismissed" or "viewed" event).
   */
  async proposeFromInteraction(input: ProposeFromInteractionInput): Promise<MemoryCandidate | null> {
    if (input.eventType !== "saved" && input.eventType !== "liked") return null;

    const attrs = input.place.truckAttributes;
    const hasParkingSignal =
      resolveTruckAttribute(attrs, "large_vehicle_parking").value === true ||
      resolveTruckAttribute(attrs, "truck_accessible").value === true;

    const categoryLabel = input.place.category.replace(/_/g, " ");
    const observationText = hasParkingSignal
      ? `Driver ${input.eventType} a ${categoryLabel} place with truck parking: "${input.place.name}".`
      : `Driver ${input.eventType} a ${categoryLabel} place: "${input.place.name}".`;

    const proposedPreference: ProposedPreference = hasParkingSignal
      ? { key: "preferred_category_with_parking", value: input.place.category, weight: 5 }
      : { key: "preferred_category", value: input.place.category, weight: 3 };

    const triggeredBy = `interaction:${input.eventType}:place:${input.place.id}`;

    const candidate = await this.memoryRepo.createCandidate({
      driverId: input.driverId,
      observationText,
      proposedPreference,
      triggeredBy,
    });

    await this.auditService.record({
      actorType: "system",
      actorId: input.driverId,
      eventName: "memory.candidate_proposed",
      payload: { candidateId: candidate.id, observationText, proposedPreference },
      triggeredBy,
      driverApproved: null,
    });

    return candidate;
  }

  async listPendingCandidates(driverId: string): Promise<MemoryCandidate[]> {
    return this.memoryRepo.listPendingCandidates(driverId);
  }

  async listMemories(driverId: string): Promise<Memory[]> {
    return this.memoryRepo.listMemories(driverId);
  }

  async approve(driverId: string, candidateId: string): Promise<Memory> {
    const candidate = await this.memoryRepo.getCandidate(candidateId);
    if (!candidate) throw new Error(`Memory candidate not found: ${candidateId}`);
    if (candidate.driverId !== driverId) throw new Error("Driver is not authorized for this candidate");

    const { memory } = await this.memoryRepo.approveCandidate(candidateId);

    // The approved rule becomes an active preference immediately — this is
    // the only path by which FunFinder's ranking can be influenced by a
    // memory, and it only exists after this explicit call.
    await this.preferenceRepo.upsert({
      driverId,
      key: memory.compiledPreferenceRule.key,
      value: memory.compiledPreferenceRule.value,
      weight: memory.compiledPreferenceRule.weight,
      sourceMemoryId: memory.id,
    });

    await this.auditService.record({
      actorType: "driver",
      actorId: driverId,
      eventName: "memory.approved",
      payload: { candidateId, memoryId: memory.id, rule: memory.compiledPreferenceRule },
      triggeredBy: "driver_action:approve_memory",
      driverApproved: true,
    });

    return memory;
  }

  async reject(driverId: string, candidateId: string): Promise<MemoryCandidate> {
    const candidate = await this.memoryRepo.getCandidate(candidateId);
    if (!candidate) throw new Error(`Memory candidate not found: ${candidateId}`);
    if (candidate.driverId !== driverId) throw new Error("Driver is not authorized for this candidate");

    const rejected = await this.memoryRepo.rejectCandidate(candidateId);

    await this.auditService.record({
      actorType: "driver",
      actorId: driverId,
      eventName: "memory.rejected",
      payload: { candidateId },
      triggeredBy: "driver_action:reject_memory",
      driverApproved: false,
    });

    return rejected;
  }
}
