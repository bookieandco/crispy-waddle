export type EquipmentMode = "full_rig" | "bobtail" | "hotshot" | "double_triple";
export type TrailerType = "dry_van" | "reefer" | "flatbed" | "tanker" | "other";
export type ParkingMode = "full_rig" | "bobtail" | "truck_only" | "unknown";
export type MobilityMode = "walk_out" | "rideshare" | "bobtail" | "rest_only";
export type StopRecommendationStatus = "recommended" | "conditional" | "rejected";
export type DataConfidence = "verified" | "attested" | "estimated" | "unknown";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Corridor {
  corridorId: string;
  name: string;
  routeNumber?: string;
  region?: string;
}

export interface RouteSegment {
  segmentId: string;
  corridorId?: string;
  origin: GeoPoint;
  destination: GeoPoint;
  distanceMiles: number;
  etaMinutes?: number;
}

export interface Route {
  routeId: string;
  origin: GeoPoint;
  destination: GeoPoint;
  corridorIds: string[];
  segments: RouteSegment[];
  totalDistanceMiles: number;
  estimatedMinutes?: number;
  observedAt: string;
}

export interface ParkingProfile {
  modes: ParkingMode[];
  spacesTotal?: number;
  pullThroughSpaces?: number;
  backInSpaces?: number;
  maximumWeightLbs?: number;
  maximumTrailerLengthFeet?: number;
  maximumClearanceInches?: number;
  securityLevel?: "unknown" | "basic" | "high";
}

export interface ParkingStatus {
  status: "open" | "limited" | "full" | "closed" | "unknown";
  spacesAvailable?: number;
  observedAt: string;
  sourceConfidence: DataConfidence;
}

export interface AccessConstraint {
  kind:
    | "low_clearance"
    | "weight_limit"
    | "truck_restriction"
    | "turning_radius"
    | "road_closure"
    | "hazmat_restriction"
    | "other";
  description: string;
  appliesToEquipment?: EquipmentMode[];
  verified: boolean;
}

export interface Amenity {
  id: string;
  name: string;
  category: "fuel" | "food" | "laundry" | "shower" | "restroom" | "wifi" | "other";
}

export interface TransitAccess {
  ridesharePickup: boolean;
  ridesharePickupNotes?: string;
  publicTransitNearby: boolean;
  pedestrianAccess: boolean;
  walkingDistanceMeters?: number;
}

export interface LifestyleVenue {
  venueId: string;
  name: string;
  category: "dining" | "entertainment" | "park" | "shopping" | "coffee" | "errands" | "other";
  location: GeoPoint;
  openNow?: boolean;
  transit: TransitAccess;
  allowedMobilityModes: MobilityMode[];
  distanceFromStopMeters: number;
  sourceConfidence: DataConfidence;
}

export interface Stop {
  stopId: string;
  canonicalKey: string;
  name: string;
  location: GeoPoint;
  address?: string;
  corridorIds: string[];
  exitNumber?: string;
  parking: ParkingProfile;
  parkingStatus: ParkingStatus;
  accessConstraints: AccessConstraint[];
  amenities: Amenity[];
  transit: TransitAccess;
  lifestyleVenues: LifestyleVenue[];
  source: StopSourceProvenance;
  updatedAt: string;
}

export interface StopSourceProvenance {
  providerId: string;
  providerName: string;
  sourceRecordId: string;
  observedAt: string;
  confidence: DataConfidence;
  sourceUrl?: string;
}

export interface StopQuery {
  near: GeoPoint;
  radiusMiles: number;
  corridorIds?: string[];
  observedAfter?: string;
}

export interface StopDataSource {
  readonly providerId: string;
  readonly providerName: string;
  searchStops(query: StopQuery): Promise<StopSourceRecord[]>;
  healthCheck(): Promise<StopSourceHealth>;
}

export interface StopSourceRecord {
  providerId: string;
  providerName: string;
  sourceRecordId: string;
  name: string;
  location: GeoPoint;
  address?: string;
  corridorIds?: string[];
  exitNumber?: string;
  parking: ParkingProfile;
  parkingStatus: ParkingStatus;
  accessConstraints?: AccessConstraint[];
  amenities?: Amenity[];
  transit: TransitAccess;
  lifestyleVenues?: LifestyleVenue[];
  observedAt: string;
  confidence: DataConfidence;
  sourceUrl?: string;
}

export interface StopSourceHealth {
  providerId: string;
  healthy: boolean;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
}

export interface StopRegistry {
  search(query: StopQuery): Promise<Stop[]>;
  refresh(query: StopQuery): Promise<Stop[]>;
  health(): Promise<StopSourceHealth[]>;
}

export interface DriverStopContext {
  driverId: string;
  carrierId?: string;
  truckId: string;
  equipment: {
    mode: EquipmentMode;
    trailerType?: TrailerType;
    trailerLengthFeet?: number;
    weightLbs?: number;
    hazmat?: boolean;
  };
  availableDowntimeMinutes: number;
  mobilityModes: MobilityMode[];
  preferredAmenities?: string[];
  preferredCorridors?: string[];
}

export interface DriverStopRecommendation {
  stopId: string;
  status: StopRecommendationStatus;
  score: number;
  estimatedArrivalMinutes?: number;
  estimatedDwellFitMinutes?: number;
  routeContext: {
    corridorId?: string;
    segmentId?: string;
    distanceMiles?: number;
  };
  reasons: string[];
  warnings: string[];
  qualifiedMobilityModes: MobilityMode[];
  provenance: StopSourceProvenance;
}

export interface StopQualification {
  status: StopRecommendationStatus;
  reasons: string[];
  warnings: string[];
  mobilityModes: MobilityMode[];
}

export const ROUTE_STOP_INTELLIGENCE_CORE_VERSION = "0.1.0" as const;

const DEFAULT_MAX_STOP_STALENESS_MINUTES = 120;
const DEFAULT_PARKING_STALENESS_MINUTES = 120;

function isFinitePoint(point: GeoPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function minutesSince(timestamp: string, now: Date): number {
  const observed = Date.parse(timestamp);
  if (!Number.isFinite(observed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - observed) / 60_000);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function distanceMiles(a: GeoPoint, b: GeoPoint): number {
  const radians = Math.PI / 180;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function preferredMobility(context: DriverStopContext, stop: Stop): MobilityMode[] {
  const modes: MobilityMode[] = [];
  for (const mode of context.mobilityModes) {
    if (mode === "rideshare" && stop.transit.ridesharePickup) modes.push(mode);
    if (mode === "walk_out" && stop.transit.pedestrianAccess) modes.push(mode);
    if (mode === "bobtail" && stop.parking.modes.includes("bobtail")) modes.push(mode);
    if (mode === "rest_only") modes.push(mode);
  }
  return [...new Set(modes)];
}

function equipmentCanPark(context: DriverStopContext, stop: Stop): boolean {
  const fullRig = context.equipment.mode === "full_rig" || context.equipment.mode === "double_triple";
  if (fullRig && !stop.parking.modes.includes("full_rig")) return false;
  if (context.equipment.mode === "bobtail" && !stop.parking.modes.some((mode) => mode === "bobtail" || mode === "truck_only")) return false;
  if (context.equipment.mode === "hotshot" && !stop.parking.modes.some((mode) => mode === "full_rig" || mode === "bobtail" || mode === "truck_only")) return false;

  if (context.equipment.trailerLengthFeet && stop.parking.maximumTrailerLengthFeet !== undefined) {
    if (context.equipment.trailerLengthFeet > stop.parking.maximumTrailerLengthFeet) return false;
  }
  if (context.equipment.weightLbs && stop.parking.maximumWeightLbs !== undefined) {
    if (context.equipment.weightLbs > stop.parking.maximumWeightLbs) return false;
  }
  return true;
}

function hasBlockingConstraint(context: DriverStopContext, stop: Stop): string | undefined {
  const applicable = stop.accessConstraints.filter((constraint) => {
    if (!constraint.appliesToEquipment?.length) return true;
    return constraint.appliesToEquipment.includes(context.equipment.mode);
  });

  for (const constraint of applicable) {
    if (!constraint.verified) continue;
    if (constraint.kind === "hazmat_restriction" && context.equipment.hazmat) return constraint.description;
    if (["low_clearance", "weight_limit", "truck_restriction", "turning_radius", "road_closure"].includes(constraint.kind)) return constraint.description;
  }
  return undefined;
}

export function normalizeStop(record: StopSourceRecord): Stop {
  if (!record.sourceRecordId || !record.name || !isFinitePoint(record.location)) {
    throw new Error("Stop source record is missing a stable identity, name, or valid coordinates");
  }
  return {
    stopId: `${record.providerId}:${record.sourceRecordId}`,
    canonicalKey: `${normalizeKey(record.name)}:${record.location.latitude.toFixed(4)}:${record.location.longitude.toFixed(4)}`,
    name: record.name.trim(),
    location: record.location,
    address: record.address,
    corridorIds: record.corridorIds ?? [],
    exitNumber: record.exitNumber,
    parking: record.parking,
    parkingStatus: record.parkingStatus,
    accessConstraints: record.accessConstraints ?? [],
    amenities: record.amenities ?? [],
    transit: record.transit,
    lifestyleVenues: record.lifestyleVenues ?? [],
    source: {
      providerId: record.providerId,
      providerName: record.providerName,
      sourceRecordId: record.sourceRecordId,
      observedAt: record.observedAt,
      confidence: record.confidence,
      sourceUrl: record.sourceUrl,
    },
    updatedAt: record.observedAt,
  };
}

export function qualifyStop(
  context: DriverStopContext,
  stop: Stop,
  now = new Date(),
  options: { maxStopStalenessMinutes?: number; maxParkingStalenessMinutes?: number } = {},
): StopQualification {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const maxStopStaleness = options.maxStopStalenessMinutes ?? DEFAULT_MAX_STOP_STALENESS_MINUTES;
  const maxParkingStaleness = options.maxParkingStalenessMinutes ?? DEFAULT_PARKING_STALENESS_MINUTES;

  if (context.availableDowntimeMinutes <= 0) {
    return { status: "rejected", reasons: ["No available downtime remains"], warnings, mobilityModes: [] };
  }
  if (!equipmentCanPark(context, stop)) {
    return { status: "rejected", reasons: ["Parking profile does not support the current equipment configuration"], warnings, mobilityModes: [] };
  }

  const blocking = hasBlockingConstraint(context, stop);
  if (blocking) {
    return { status: "rejected", reasons: [blocking], warnings, mobilityModes: [] };
  }

  const stopAge = minutesSince(stop.updatedAt, now);
  if (stopAge > maxStopStaleness) {
    return { status: "conditional", reasons: [], warnings: ["Stop infrastructure data is stale and requires revalidation"], mobilityModes: [] };
  }

  const parkingAge = minutesSince(stop.parkingStatus.observedAt, now);
  if (parkingAge > maxParkingStaleness) {
    warnings.push("Parking status is stale");
  }
  if (stop.parkingStatus.status === "closed" || stop.parkingStatus.status === "full") {
    return { status: "rejected", reasons: ["Current parking status does not support arrival"], warnings, mobilityModes: [] };
  }
  if (stop.parkingStatus.sourceConfidence === "unknown") {
    warnings.push("Parking status has unknown source confidence");
  }

  const mobilityModes = preferredMobility(context, stop);
  if (context.mobilityModes.length > 0 && mobilityModes.length === 0) {
    warnings.push("No requested off-truck mobility mode is verified at this stop");
  } else if (mobilityModes.length > 0) {
    reasons.push(`Verified mobility: ${mobilityModes.join(", ")}`);
  }

  if (stop.parking.securityLevel === "high") reasons.push("High-security parking profile");
  if (stop.parkingStatus.status === "open") reasons.push("Parking is currently reported open");
  if (stop.parkingStatus.status === "limited") warnings.push("Parking availability is limited");
  if (context.preferredCorridors?.some((id) => stop.corridorIds.includes(id))) reasons.push("Stop is on a preferred corridor");
  if (context.preferredAmenities?.some((name) => stop.amenities.some((amenity) => amenity.name.toLowerCase() === name.toLowerCase()))) {
    reasons.push("Stop provides a preferred amenity");
  }

  return {
    status: warnings.length > 0 ? "conditional" : "recommended",
    reasons,
    warnings,
    mobilityModes,
  };
}

export function rankDriverStops(
  route: Route,
  context: DriverStopContext,
  stops: Stop[],
  now = new Date(),
): DriverStopRecommendation[] {
  return stops.map((stop) => {
    const qualification = qualifyStop(context, stop, now);
    const nearestSegment = route.segments.reduce<RouteSegment | undefined>((best, segment) => {
      if (!best) return segment;
      const currentDistance = distanceMiles(stop.location, segment.destination);
      const bestDistance = distanceMiles(stop.location, best.destination);
      return currentDistance < bestDistance ? segment : best;
    }, undefined);
    const distanceFromOrigin = distanceMiles(route.origin, stop.location);
    const estimatedArrivalMinutes = route.estimatedMinutes !== undefined && route.totalDistanceMiles > 0
      ? Math.round((distanceFromOrigin / route.totalDistanceMiles) * route.estimatedMinutes)
      : nearestSegment?.etaMinutes;

    let score = 0;
    if (qualification.status === "recommended") score += 60;
    if (qualification.status === "conditional") score += 30;
    if (qualification.status === "rejected") score -= 100;
    if (stop.parking.securityLevel === "high") score += 15;
    if (stop.parkingStatus.status === "open") score += 10;
    if (stop.parkingStatus.status === "limited") score -= 10;
    if (qualification.mobilityModes.length > 0) score += 10;
    if (stop.lifestyleVenues.length > 0 && context.availableDowntimeMinutes >= 60) score += 5;
    if (context.preferredCorridors?.some((id) => stop.corridorIds.includes(id))) score += 5;
    score -= Math.min(20, Math.round(distanceFromOrigin / 25));

    return {
      stopId: stop.stopId,
      status: qualification.status,
      score,
      estimatedArrivalMinutes,
      estimatedDwellFitMinutes: context.availableDowntimeMinutes,
      routeContext: {
        corridorId: nearestSegment?.corridorId ?? stop.corridorIds[0],
        segmentId: nearestSegment?.segmentId,
        distanceMiles: distanceFromOrigin,
      },
      reasons: qualification.reasons,
      warnings: qualification.warnings,
      qualifiedMobilityModes: qualification.mobilityModes,
      provenance: stop.source,
    } satisfies DriverStopRecommendation;
  }).sort((a, b) => b.score - a.score || a.stopId.localeCompare(b.stopId));
}

export function createInMemoryStopRegistry(sources: StopDataSource[]): StopRegistry {
  const load = async (query: StopQuery): Promise<Stop[]> => {
    const records = await Promise.all(sources.map((source) => source.searchStops(query)));
    const normalized = records.flat().map(normalizeStop);
    const byCanonicalKey = new Map<string, Stop>();
    for (const stop of normalized) {
      const existing = byCanonicalKey.get(stop.canonicalKey);
      if (!existing || Date.parse(stop.updatedAt) > Date.parse(existing.updatedAt)) {
        byCanonicalKey.set(stop.canonicalKey, stop);
      }
    }
    return [...byCanonicalKey.values()].filter((stop) => distanceMiles(query.near, stop.location) <= query.radiusMiles);
  };

  return {
    search: load,
    refresh: load,
    health: () => Promise.all(sources.map((source) => source.healthCheck())),
  };
}
