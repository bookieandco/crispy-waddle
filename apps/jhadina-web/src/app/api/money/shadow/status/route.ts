import {GET as legacyPursePaperStatus} from '../../purse/status/route'

/** Non-executing SHADOW status; legacy money/purse/status remains readable for old clients. */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const revalidate=0
export async function GET(){return legacyPursePaperStatus()}
