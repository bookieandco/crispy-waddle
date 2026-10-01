import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {persistRoyaltyAggregateSnapshot} from '@/lib/music/music-royalty-snapshot-service';
import type {RoyaltyAggregateLine} from '@/lib/music/royalty-snapshot';

export const dynamic='force-dynamic';

type Body={
  statementRef?:unknown;
  source?:unknown;
  currency?:unknown;
  reportedTotal?:unknown;
  periodStart?:unknown;
  periodEnd?:unknown;
  observedAt?:unknown;
  lines?:unknown;
};

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as Body;
    const lines=parseLines(body.lines);
    const data=await persistRoyaltyAggregateSnapshot({
      userId:identity.userId,
      snapshot:{
        statementRef:requiredText(body.statementRef,'statementRef'),
        source:requiredText(body.source,'source'),
        currency:requiredText(body.currency,'currency'),
        reportedTotal:requiredMoney(body.reportedTotal,'reportedTotal'),
        periodStart:optionalDate(body.periodStart),
        periodEnd:optionalDate(body.periodEnd),
        observedAt:requiredDateTime(body.observedAt,'observedAt'),
        lines,
      },
    });
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Royalty snapshot import failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:400});
  }
}

function parseLines(value:unknown):RoyaltyAggregateLine[]{
  if(!Array.isArray(value)||!value.length)throw new Error('lines are required');
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=='object')throw new Error('invalid royalty line at index '+index);
    const row=raw as Record<string,unknown>;
    const kind=row.kind==='service'||row.kind==='song'?row.kind:null;
    if(!kind)throw new Error('invalid royalty line kind at index '+index);
    return {
      kind,
      label:requiredText(row.label,'lines['+index+'].label'),
      amount:requiredMoney(row.amount,'lines['+index+'].amount'),
      artistName:optionalText(row.artistName),
      recordingRef:optionalText(row.recordingRef),
      evidenceRef:optionalText(row.evidenceRef),
    };
  });
}
function requiredText(value:unknown,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(field+' is required');
  return value.trim();
}
function optionalText(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value.trim():undefined;
}
function requiredMoney(value:unknown,field:string):number{
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(field+' must be a non-negative number');
  return n;
}
function optionalDate(value:unknown):string|undefined{
  if(value===undefined||value===null||value==='')return undefined;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('invalid date');
  return value;
}
function requiredDateTime(value:unknown,field:string):string{
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error(field+' must be an ISO date-time');
  return value;
}
