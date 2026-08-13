import type { PlacementCommandAuthorizer } from "./command-api.js";
import { PlacementCommandApi } from "./command-api.js";
import type { PlacementRepository, PlacementEventSink, ConsentGateway, PlacementPolicy, StaffingIds, StaffingClock } from "./vertical-slice.js";
import { PlacementVerticalSlice } from "./vertical-slice.js";

export interface PlacementDependencies {
  repository: PlacementRepository;
  events: PlacementEventSink;
  consent: ConsentGateway;
  policy: PlacementPolicy;
  authorization: PlacementCommandAuthorizer;
  ids: StaffingIds;
  clock: StaffingClock;
}

export function composePlacementCommands(deps: PlacementDependencies): PlacementCommandApi {
  const service = new PlacementVerticalSlice(
    deps.repository,
    deps.events,
    deps.consent,
    deps.policy,
    deps.ids,
    deps.clock,
  );

  return new PlacementCommandApi(service, deps.authorization);
}
