export type FinalExportDefect =
  | 'black-frame'
  | 'media-offline'
  | 'missing-audio'
  | 'audio-dropout'
  | 'sync-error'
  | 'subtitle-error'
  | 'unexpected-frame'
  | 'other';

export interface FinalExportVariant {
  id:string;
  assetId:string;
  purpose:'publish'|'clean-no-subtitles'|'review'|'archive';
  evidenceIds:readonly string[];
}

export interface FinalExportInspection {
  id:string;
  projectId:string;
  variants:readonly FinalExportVariant[];
  watchedStartToFinish:boolean;
  watchPasses:number;
  defects:readonly {
    id:string;
    variantId:string;
    kind:FinalExportDefect;
    startSeconds?:number;
    endSeconds?:number;
    note:string;
    evidenceIds:readonly string[];
  }[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_FINAL_EXPORT_INSPECTION';
}

export interface FinalExportInspectionDecision {
  admissible:boolean;
  reasons:readonly string[];
  authority:'DIRECTOR_FINAL_EXPORT_QC';
}

export function evaluateFinalExportInspection(
  inspection:FinalExportInspection,
):FinalExportInspectionDecision{
  const reasons:string[]=[];
  if(!inspection.id.trim()||!inspection.projectId.trim()) reasons.push('DIRECTOR_FINAL_EXPORT_IDENTITY_REQUIRED');
  if(!inspection.variants.length) reasons.push('DIRECTOR_FINAL_EXPORT_VARIANT_REQUIRED');
  if(!inspection.evidenceIds.length) reasons.push('DIRECTOR_FINAL_EXPORT_EVIDENCE_REQUIRED');
  if(!inspection.watchedStartToFinish||!Number.isInteger(inspection.watchPasses)||inspection.watchPasses<1){
    reasons.push('DIRECTOR_FINAL_EXPORT_FULL_WATCH_REQUIRED');
  }

  const variantIds=new Set<string>();
  for(const variant of inspection.variants){
    if(!variant.id.trim()||variantIds.has(variant.id)||!variant.assetId.trim()||!variant.evidenceIds.length){
      reasons.push(`DIRECTOR_FINAL_EXPORT_VARIANT_INVALID:${variant.id||'unknown'}`);
    }
    variantIds.add(variant.id);
  }

  for(const defect of inspection.defects){
    if(!defect.id.trim()||!variantIds.has(defect.variantId)||!defect.note.trim()||!defect.evidenceIds.length){
      reasons.push(`DIRECTOR_FINAL_EXPORT_DEFECT_INVALID:${defect.id||'unknown'}`);
    }else{
      reasons.push(`DIRECTOR_FINAL_EXPORT_DEFECT_PRESENT:${defect.kind}`);
    }
  }

  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_FINAL_EXPORT_QC',
  });
}
