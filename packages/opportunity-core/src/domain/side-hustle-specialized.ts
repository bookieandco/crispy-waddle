import {ownedMediaRecordKind,type OwnedMediaRecord} from './side-hustle-owned-media.js'
import {physicalAssetRecordKind,type PhysicalAssetRecord} from './side-hustle-physical-assets.js'

export type SideHustleSpecializedRecord=OwnedMediaRecord|PhysicalAssetRecord

export type SideHustleSpecializedRecordKind=
  | 'owned_media_property'
  | 'owned_media_cycle'
  | 'owned_media_publication'
  | 'owned_media_analytics'
  | 'owned_media_monetization'
  | 'physical_asset'
  | 'physical_booking'
  | 'physical_custody'
  | 'physical_maintenance'

export function sideHustleSpecializedRecordKind(
  record:SideHustleSpecializedRecord,
):SideHustleSpecializedRecordKind{
  if(record.family==='owned_media'){
    return `owned_media_${ownedMediaRecordKind(record)}` as SideHustleSpecializedRecordKind
  }
  return `physical_${physicalAssetRecordKind(record)}` as SideHustleSpecializedRecordKind
}
