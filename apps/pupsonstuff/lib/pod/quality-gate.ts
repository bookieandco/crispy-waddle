export type QualityStatus = "pass" | "warn" | "fail";

export type ImageQualityInput = {
  width: number;
  height: number;
  mimeType?: string;
  fileBytes?: number;
  hasPetSubject?: boolean;
  subjectCoverage?: number;
};

export type PrintProfile = {
  name: string;
  printWidthInches: number;
  printHeightInches: number;
  minDpi: number;
  safeMarginInches: number;
};

export type QualityCheck = {
  id: string;
  label: string;
  status: QualityStatus;
  score: number;
  detail: string;
};

export type QualityReport = {
  status: QualityStatus;
  score: number;
  checks: QualityCheck[];
  productionReady: boolean;
};

const scoreStatus = (score: number): QualityStatus => score >= 90 ? "pass" : score >= 75 ? "warn" : "fail";

export function evaluateImageQuality(input: ImageQualityInput, profile: PrintProfile): QualityReport {
  const requiredWidth = Math.ceil(profile.printWidthInches * profile.minDpi);
  const requiredHeight = Math.ceil(profile.printHeightInches * profile.minDpi);
  const effectiveDpi = Math.min(input.width / profile.printWidthInches, input.height / profile.printHeightInches);

  const resolutionScore = Math.min(100, Math.round((effectiveDpi / profile.minDpi) * 100));
  const subjectScore = input.hasPetSubject === false ? 0 : Math.round(Math.min(1, Math.max(0, input.subjectCoverage ?? 1)) * 100);
  const formatScore = input.mimeType && ["image/png", "image/jpeg", "image/webp"].includes(input.mimeType) ? 100 : 0;
  const checks: QualityCheck[] = [
    { id: "resolution", label: "Print resolution", score: resolutionScore, status: scoreStatus(resolutionScore), detail: `${input.width}×${input.height}px; target ≥ ${requiredWidth}×${requiredHeight}px at ${profile.minDpi} DPI.` },
    { id: "subject", label: "Pet visibility", score: subjectScore, status: scoreStatus(subjectScore), detail: input.hasPetSubject === false ? "No pet subject detected." : "Pet subject is present in the generated image." },
    { id: "format", label: "File format", score: formatScore, status: scoreStatus(formatScore), detail: input.mimeType ?? "Unknown format." },
  ];

  const score = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);
  const status = score < 75 || checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warn") ? "warn" : "pass";
  return { status, score, checks, productionReady: status === "pass" };
}
