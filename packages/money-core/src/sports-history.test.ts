import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSportsHistoryView,
  createSportsHistoryFeatureSlice,
  type SportsHistoricalStatRecord,
  type SportsHistoryQuery,
} from './sports-history.js'

const asOf='2026-09-27T20:00:00Z'

function record(input:{
  id:string
  event:string
  date:string
  season?:string
  statKey?:string
  value:number
  opponent?:string
  phase?:SportsHistoricalStatRecord['phase']
  availableAt?:string
}):SportsHistoricalStatRecord{
  return Object.freeze({
    recordId:input.id,
    entityKind:'PLAYER',
    entityId:'player:1',
    entityLabel:'Test Player',
    sport:'BASKETBALL',
    competition:'NBA',
    season:input.season??'2026',
    eventId:input.event,
    eventDate:input.date,
    opponentLabel:input.opponent,
    venue:'HOME',
    phase:input.phase??'REGULAR',
    statKey:input.statKey??'offense.points',
    statLabel:(input.statKey??'offense.points').split('.').at(-1)??'stat',
    value:input.value,
    observedAt:'2026-09-27T19:00:00Z',
    availableAt:input.availableAt??'2026-09-27T19:00:00Z',
    sourceProvider:'test',
    sourceClass:'DATASET',
    evidenceIds:Object.freeze(['evidence:'+input.id]),
    authority:'HISTORICAL_EVIDENCE_ONLY',
    canExecute:false,
  })
}

function query(scopes:SportsHistoryQuery['scopes'],statKeys?:readonly string[]):SportsHistoryQuery{
  return Object.freeze({
    queryId:'q1',
    entityKind:'PLAYER',
    entityId:'player:1',
    competition:'NBA',
    ...(statKeys?.length?{statKeys}:{}),
    scopes,
    asOf,
  })
}

test('SPORT-HISTORY last-N selects N unique events, not N stat cells',()=>{
  const rows:SportsHistoricalStatRecord[]=[]
  for(let game=1;game<=3;game++){
    rows.push(record({id:'p'+game,event:'g'+game,date:`2026-09-0${game}T00:00:00Z`,value:game}))
    rows.push(record({id:'a'+game,event:'g'+game,date:`2026-09-0${game}T00:00:00Z`,statKey:'offense.assists',value:game+10}))
  }
  const view=buildSportsHistoryView({query:query([{kind:'LAST_N',count:2}]),records:rows})
  assert.equal(new Set(view.records.map(r=>r.eventId)).size,2)
  assert.equal(view.records.length,4)
  assert.equal(view.summaries.find(s=>s.statKey==='offense.points')?.sampleSize,2)
  assert.equal(view.summaries.find(s=>s.statKey==='offense.assists')?.sampleSize,2)
})

test('SPORT-HISTORY stat aliases match category-qualified stat keys',()=>{
  const view=buildSportsHistoryView({
    query:query([{kind:'CAREER'}],['points']),
    records:[
      record({id:'p1',event:'g1',date:'2026-09-01T00:00:00Z',statKey:'offense.points',value:31}),
      record({id:'a1',event:'g1',date:'2026-09-01T00:00:00Z',statKey:'offense.assists',value:8}),
    ],
  })
  assert.equal(view.records.length,1)
  assert.equal(view.records[0]?.statKey,'offense.points')
})

test('SPORT-HISTORY opponent matching accepts a stable partial label',()=>{
  const view=buildSportsHistoryView({
    query:query([{kind:'VS_OPPONENT',opponentLabel:'Denver'}]),
    records:[
      record({id:'d1',event:'g1',date:'2026-09-01T00:00:00Z',opponent:'Denver Nuggets',value:28}),
      record({id:'b1',event:'g2',date:'2026-09-02T00:00:00Z',opponent:'Boston Celtics',value:25}),
    ],
  })
  assert.equal(view.records.length,1)
  assert.equal(view.records[0]?.opponentLabel,'Denver Nuggets')
})

test('SPORT-HISTORY as-of gate rejects records not yet available at the query cutoff',()=>{
  const view=buildSportsHistoryView({
    query:query([{kind:'CAREER'}]),
    records:[
      record({id:'known',event:'g1',date:'2026-09-01T00:00:00Z',value:20,availableAt:'2026-09-27T19:00:00Z'}),
      record({id:'future',event:'g2',date:'2026-09-02T00:00:00Z',value:40,availableAt:'2026-09-28T00:00:00Z'}),
    ],
  })
  assert.deepEqual(view.records.map(r=>r.recordId),['known'])
})

test('SPORT-HISTORY playoff, all-time coverage and feature-candidate authority stay separated',()=>{
  const view=buildSportsHistoryView({
    query:query([{kind:'ALL_TIME'},{kind:'PLAYOFFS'}]),
    records:[
      record({id:'reg',event:'g1',date:'2025-01-01T00:00:00Z',season:'2025',phase:'REGULAR',value:22}),
      record({id:'po1',event:'g2',date:'2025-05-01T00:00:00Z',season:'2025',phase:'PLAYOFFS',value:32}),
      record({id:'po2',event:'g3',date:'2026-05-01T00:00:00Z',season:'2026',phase:'PLAYOFFS',value:36}),
    ],
    providerClaimsAllTimeCoverage:true,
  })
  assert.equal(view.allTimeAvailable,true)
  assert.equal(view.records.length,2)
  assert.equal(view.authority,'HISTORICAL_EVIDENCE_ONLY')
  assert.equal(view.predictiveAuthority,'NONE')
  assert.equal(view.bettingAuthority,'NONE')
  assert.equal(view.financialAuthority,'NONE')
  assert.equal(view.canExecute,false)

  const slice=createSportsHistoryFeatureSlice({
    view,
    statKey:'offense.points',
    halfLifeDays:180,
    eraBaselineMean:25,
    eraBaselineStdDev:5,
    scopeLabel:'career-playoffs',
  })
  assert.equal(slice.authority,'FEATURE_CANDIDATE_ONLY')
  assert.equal(slice.admittedToSimulation,false)
  assert.equal(slice.canExecute,false)
  assert.ok(Number.isFinite(slice.recencyWeightedMean))
  assert.ok(Number.isFinite(slice.eraNormalizedMean))
})

test('SPORT-HISTORY does not certify all-time coverage from a partial provider response',()=>{
  const view=buildSportsHistoryView({
    query:query([{kind:'ALL_TIME'}]),
    records:[record({id:'one',event:'g1',date:'2026-09-01T00:00:00Z',value:20})],
    providerClaimsAllTimeCoverage:false,
  })
  assert.equal(view.allTimeAvailable,false)
  assert.ok(view.warnings.some(w=>/did not certify complete all-time/i.test(w)))
})
