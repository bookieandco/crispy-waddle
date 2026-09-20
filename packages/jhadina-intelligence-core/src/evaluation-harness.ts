export type EvaluationStatus = 'passed' | 'failed';

export interface IntelligenceEvaluationCase {
  readonly id: string;
  readonly category: 'routing'|'evidence'|'critic'|'privacy'|'fallback'|'context'|'cache'|'perception';
  readonly run: () => Promise<void>;
}

export interface IntelligenceEvaluationResult {
  readonly id: string;
  readonly category: IntelligenceEvaluationCase['category'];
  readonly status: EvaluationStatus;
  readonly durationMs: number;
  readonly errorCode?: string;
}

export interface IntelligenceEvaluationReport {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly IntelligenceEvaluationResult[];
}

export class IntelligenceEvaluationHarness {
  constructor(private readonly now:()=>number=()=>Date.now()){}
  async run(cases:readonly IntelligenceEvaluationCase[]):Promise<IntelligenceEvaluationReport>{
    const ids=new Set<string>();const results:IntelligenceEvaluationResult[]=[];
    for(const c of cases){
      if(!c.id.trim()||ids.has(c.id)) throw new Error(`EVALUATION_CASE_ID_INVALID:${c.id}`);
      ids.add(c.id);const start=this.now();
      try{await c.run();results.push(Object.freeze({id:c.id,category:c.category,status:'passed',durationMs:Math.max(0,this.now()-start)}));}
      catch(error){results.push(Object.freeze({id:c.id,category:c.category,status:'failed',durationMs:Math.max(0,this.now()-start),errorCode:error instanceof Error?error.name:'UNKNOWN_EVALUATION_FAILURE'}));}
    }
    const passed=results.filter(r=>r.status==='passed').length;
    return Object.freeze({total:results.length,passed,failed:results.length-passed,results:Object.freeze(results)});
  }
  assertPassing(report:IntelligenceEvaluationReport):void{
    if(report.failed) throw new IntelligenceEvaluationFailedError(report);
  }
}
export class IntelligenceEvaluationFailedError extends Error{
 constructor(public readonly report:IntelligenceEvaluationReport){super(`INTELLIGENCE_EVALUATION_FAILED:${report.failed}/${report.total}`);this.name='IntelligenceEvaluationFailedError';}
}
