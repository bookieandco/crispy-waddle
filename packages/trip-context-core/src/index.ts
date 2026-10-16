export type EquipmentMode = "full_rig" | "bobtail" | "hotshot" | "double_triple";

export type OperatingStatus = "driving" | "on_duty" | "off_duty" | "sleeper_berth" | "unknown";
export type ResetWindow = "none" | "short_break" | "rest_period" | "reset_period" | "unknown";
export type MobilityMode = "walk_out" | "rideshare" | "bobtail" | "errands" | "rest_only";
export type Mood = "social" | "quiet_chill" | "errands";

export interface GeoPoint { latitude: number; longitude: number; }

export interface EquipmentContext {
  mode: EquipmentMode;
  trailerLengthFeet?: number;
  trailerType?: "dry_van" | "reefer" | "flatbed" | "tanker" | "other";
  hazmat?: boolean;
}

export interface OperatingContext {
  status: OperatingStatus;
  resetWindow: ResetWindow;
  availableMinutes?: number;
  source?: "eld" | "manual" | "system";
  observedAt: string;
}

export interface TripContext {
  tripId: string;
  carrierId?: string;
  driverId: string;
  truckId: string;
  currentLocation: GeoPoint;
  equipment: EquipmentContext;
  operating: OperatingContext;
  route?: { origin?: GeoPoint; destination?: GeoPoint; corridorId?: string };
  preferredMood?: Mood;
  createdAt: string;
}

export interface LogisticsConstraints {
  fullRigAccessible: boolean;
  bobtailAccessible: boolean;
  ridesharePickupAvailable: boolean;
  pedestrianAccess: boolean;
  maxClearanceInches?: number;
  weightLimitLbs?: number;
  truckRestrictions?: string[];
  verifiedAt?: string;
}

export interface StopContext {
  stopId: string;
  name: string;
  location: GeoPoint;
  distanceMeters: number;
  geofenceRadiusMeters?: number;
  logistics: LogisticsConstraints;
  parking?: {
    spacesTotal?: number;
    spacesAvailable?: number;
    availabilityObservedAt?: string;
    securityLevel?: "unknown" | "basic" | "high";
  };
}

export interface LifestyleDestination {
  destinationId: string;
  name: string;
  location: GeoPoint;
  supportedMoods: Mood[];
  allowedMobilityModes: MobilityMode[];
  distanceMeters: number;
  openNow?: boolean;
  logistics: LogisticsConstraints;
}

export interface QualificationResult {
  destinationId: string;
  qualified: boolean;
  mobilityMode?: MobilityMode;
  reasons: string[];
  warnings: string[];
}

const DEFAULT_TRAILER_LENGTH_FEET = 53;
const STANDARD_CLEARANCE_INCHES = 162;

function isFiniteCoordinate(point: GeoPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function equipmentNeedsFullRigAccess(equipment: EquipmentContext): boolean {
  return equipment.mode === "full_rig" || equipment.mode === "double_triple";
}

function stopSupportsEquipment(equipment: EquipmentContext, logistics: LogisticsConstraints): boolean {
  return equipmentNeedsFullRigAccess(equipment) ? logistics.fullRigAccessible : logistics.fullRigAccessible || logistics.bobtailAccessible;
}

function chooseMobilityMode(
  equipment: EquipmentContext,
  stop: StopContext,
  destination: LifestyleDestination,
): MobilityMode | undefined {
  const candidates: MobilityMode[] = equipment.mode === "bobtail" ? ["bobtail", "rideshare", "walk_out"] : ["rideshare", "walk_out"];
  if (equipment.mode === "hotshot") candidates.unshift("bobtail");
  if (destination.logistics.fullRigAccessible && stopSupportsEquipment(equipment, stop.logistics)) candidates.unshift("errands");
  return candidates.find((mode) => destination.allowedMobilityModes.includes(mode) && (
    mode === "rideshare" ? stop.logistics.ridesharePickupAvailable && destination.logistics.ridesharePickupAvailable :
    mode === "walk_out" ? stop.logistics.pedestrianAccess && destination.logistics.pedestrianAccess :
    mode === "bobtail" ? stop.logistics.bobtailAccessible && destination.logistics.bobtailAccessible :
    mode === "errands" ? stop.logistics.fullRigAccessible && destination.logistics.fullRigAccessible :
    true
  ));
}

export function validateTripContext(context: TripContext): string[] {
  const errors: string[] = [];
  if (!context.tripId) errors.push("tripId is required");
  if (!context.driverId) errors.push("driverId is required");
  if (!context.truckId) errors.push("truckId is required");
  if (!isFiniteCoordinate(context.currentLocation)) errors.push("currentLocation must contain finite coordinates");
  if (!context.operating.observedAt) errors.push("operating.observedAt is required");
  return errors;
}

export function qualifyDestination(
  context: TripContext,
  stop: StopContext,
  destination: LifestyleDestination,
): QualificationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (context.operating.status === "driving" || context.operating.status === "on_duty") {
    return { destinationId: destination.destinationId, qualified: false, reasons: ["Driver is not currently in an off-duty state"], warnings };
  }

  if (!stopSupportsEquipment(context.equipment, stop.logistics)) {
    return { destinationId: destination.destinationId, qualified: false, reasons: ["Current stop is not verified for the current equipment configuration"], warnings };
  }

  if (context.equipment.trailerType === "reefer") warnings.push("Confirm reefer/noise restrictions before leaving the equipment unattended");
  if (context.equipment.hazmat) warnings.push("Hazmat-specific parking and routing restrictions require verified local data");

  const mobilityMode = chooseMobilityMode(context.equipment, stop, destination);
  if (!mobilityMode) {
    return { destinationId: destination.destinationId, qualified: false, reasons: ["No verified mobility mode is available"], warnings };
  }

  if (mobilityMode === "rideshare" || mobilityMode === "walk_out") {
    if (destination.openNow === false) {
      return { destinationId: destination.destinationId, qualified: false, mobilityMode, reasons: ["Destination is currently closed"], warnings };
    }
  } else {
    const clearance = destination.logistics.maxClearanceInches;
    if (clearance !== undefined && clearance < STANDARD_CLEARANCE_INCHES) {
      return { destinationId: destination.destinationId, qualified: false, mobilityMode, reasons: ["Destination approach has insufficient verified clearance"], warnings };
    }
  }

  if (context.preferredMood && !destination.supportedMoods.includes(context.preferredMood)) warnings.push("Destination does not match the driver's preferred mood");
  if (destination.logistics.verifiedAt) reasons.push("Destination logistics have a verification timestamp");
  else warnings.push("Destination logistics are not timestamp-verified");
  if (context.equipment.trailerLengthFeet && context.equipment.trailerLengthFeet > DEFAULT_TRAILER_LENGTH_FEET) warnings.push("Equipment exceeds the default 53-foot trailer profile; verify local access independently");

  return { destinationId: destination.destinationId, qualified: true, mobilityMode, reasons, warnings };
}

export function rankResetDestinations(context: TripContext, stop: StopContext, destinations: LifestyleDestination[]): QualificationResult[] {
  return destinations.map((destination) => qualifyDestination(context, stop, destination)).sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (a.warnings.length !== b.warnings.length) return a.warnings.length - b.warnings.length;
    return a.destinationId.localeCompare(b.destinationId);
  });
}

export const TRIP_CONTEXT_CORE_VERSION = "0.1.0" as const;
