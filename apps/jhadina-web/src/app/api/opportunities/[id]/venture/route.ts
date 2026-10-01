import { NextResponse } from 'next/server'
import type {
  SideHustleFamily,
  VentureAgent,
  VentureHqRoom,
  VentureWorkflow,
} from '@jhadina/opportunity-core'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import {
  createAndPersistVentureRuntime,
  createAndPersistVentureValidationExperiment,
  loadVentureRuntimeState,
  recordAndPersistVentureCommercialOutcome,
  recordAndPersistVentureSpatialRuntime,
  repairAndPersistVentureSupervisorIssue,
  runAndPersistVentureSupervisor,
  ventureRuntimeSoftwareEvidence,
} from '@/lib/opportunities/venture-runtime'

export const dynamic = 'force-dynamic'

type InitializeBody = {
  action: 'initialize'
  family: SideHustleFamily
  demandThesis: Parameters<typeof createAndPersistVentureRuntime>[1]['demandThesis']
  signals: Parameters<typeof createAndPersistVentureRuntime>[1]['signals']
  unitEconomics?: Parameters<typeof createAndPersistVentureRuntime>[1]['unitEconomics']
  scoreFactors: Parameters<typeof createAndPersistVentureRuntime>[1]['scoreFactors']
  makeSense: Parameters<typeof createAndPersistVentureRuntime>[1]['makeSense']
  originalityInput: Parameters<typeof createAndPersistVentureRuntime>[1]['originalityInput']
  automationMaturity?: Parameters<typeof createAndPersistVentureRuntime>[1]['automationMaturity']
  evidenceRefs: string[]
}

type ExperimentBody = {
  action: 'experiment'
  targetCustomer?: string
  offer?: string
  currency?: string
  maxSpend?: number
  maxHours?: number
  maxDurationDays?: number
  evidenceRefs?: string[]
}

type SupervisorBody = {
  action: 'supervise'
  evidenceRefs: string[]
  staleAfterHours?: number
  queuePressureThreshold?: number
  marginFloor?: number
  refundRate?: number
}

type RepairBody = {
  action: 'repair'
  issueId: string
  repairSummary: string
  evidenceRefs: string[]
}

type SpatialBody = {
  action: 'spatial'
  rooms: VentureHqRoom[]
  agents: VentureAgent[]
  workflows: VentureWorkflow[]
  evidenceRefs: string[]
}

type OutcomeBody = {
  action: 'outcome'
  outcomeRef: string
  amount?: number
  currency?: string
}

type VentureBody =
  | InitializeBody
  | ExperimentBody
  | SupervisorBody
  | RepairBody
  | SpatialBody
  | OutcomeBody

async function authenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  const user = await authenticated()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  try {
    const state = await loadVentureRuntimeState(context.params.id)
    if (!state) {
      return NextResponse.json({ success: false, error: 'Venture runtime not initialized' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      data: {
        state,
        softwareEvidence: ventureRuntimeSoftwareEvidence(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load venture runtime'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(
  req: Request,
  context: { params: { id: string } },
) {
  const user = await authenticated()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json() as VentureBody
    const repository = createSupabaseOpportunityRepository()

    if (body.action === 'initialize') {
      const stored = await repository.get(context.params.id)
      if (!stored) {
        return NextResponse.json({ success: false, error: 'Opportunity not found' }, { status: 404 })
      }
      const result = await createAndPersistVentureRuntime(user.id, {
        opportunity: stored.opportunity,
        family: body.family,
        demandThesis: body.demandThesis,
        signals: body.signals,
        unitEconomics: body.unitEconomics,
        scoreFactors: body.scoreFactors,
        makeSense: body.makeSense,
        originalityInput: body.originalityInput,
        automationMaturity: body.automationMaturity,
        evidenceRefs: body.evidenceRefs,
        createdAt: new Date().toISOString(),
      }, repository)
      return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    if (body.action === 'experiment') {
      const result = await createAndPersistVentureValidationExperiment({
        userId: user.id,
        opportunityId: context.params.id,
        generatedAt: new Date().toISOString(),
        targetCustomer: body.targetCustomer,
        offer: body.offer,
        currency: body.currency,
        maxSpend: body.maxSpend,
        maxHours: body.maxHours,
        maxDurationDays: body.maxDurationDays,
        evidenceRefs: body.evidenceRefs,
        repository,
      })
      return NextResponse.json({ success: true, data: result }, { status: 201 })
    }

    if (body.action === 'supervise') {
      const result = await runAndPersistVentureSupervisor({
        userId: user.id,
        opportunityId: context.params.id,
        now: new Date().toISOString(),
        evidenceRefs: body.evidenceRefs,
        staleAfterHours: body.staleAfterHours,
        queuePressureThreshold: body.queuePressureThreshold,
        marginFloor: body.marginFloor,
        refundRate: body.refundRate,
        repository,
      })
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'repair') {
      const result = await repairAndPersistVentureSupervisorIssue({
        userId: user.id,
        opportunityId: context.params.id,
        issueId: body.issueId,
        repairSummary: body.repairSummary,
        evidenceRefs: body.evidenceRefs,
        repairedAt: new Date().toISOString(),
        repository,
      })
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'spatial') {
      const result = await recordAndPersistVentureSpatialRuntime({
        userId: user.id,
        opportunityId: context.params.id,
        rooms: body.rooms,
        agents: body.agents,
        workflows: body.workflows,
        generatedAt: new Date().toISOString(),
        evidenceRefs: body.evidenceRefs,
        repository,
      })
      return NextResponse.json({ success: true, data: result })
    }

    if (body.action === 'outcome') {
      const result = await recordAndPersistVentureCommercialOutcome({
        userId: user.id,
        opportunityId: context.params.id,
        outcomeRef: body.outcomeRef,
        amount: body.amount,
        currency: body.currency,
        occurredAt: new Date().toISOString(),
        repository,
      })
      return NextResponse.json({ success: true, data: result })
    }

    return NextResponse.json({ success: false, error: 'Unsupported venture action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update venture runtime'
    const status = message.toLowerCase().includes('not found') ? 404 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
