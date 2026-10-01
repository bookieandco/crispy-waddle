export type RoyaltyAggregateLineKind='service'|'song';

export interface RoyaltyAggregateLine {
  kind:RoyaltyAggregateLineKind;
  label:string;
  amount:number;
  artistName?:string;
  recordingRef?:string;
  evidenceRef?:string;
}

export interface RoyaltyAggregateSnapshotInput {
  statementRef:string;
  source:string;
  currency:string;
  reportedTotal:number;
  lines:readonly RoyaltyAggregateLine[];
  periodStart?:string;
  periodEnd?:string;
  observedAt:string;
}

export interface RoyaltyTitleGroup {
  titleGroupKey:string;
  displayTitle:string;
  total:number;
  rows:number;
  labels:readonly string[];
  evidenceRefs:readonly string[];
}

export interface RoyaltyAggregateSummary {
  statementRef:string;
  currency:string;
  reportedTotal:number;
  serviceSubtotal:number;
  songSubtotal:number;
  serviceRoundingDelta:number;
  serviceTotalReconciles:boolean;
  topService?:Readonly<{label:string;amount:number;share:number}>;
  topSongTitle?:RoyaltyTitleGroup;
  titleGroups:readonly RoyaltyTitleGroup[];
  warnings:readonly string[];
}

export interface ParsedRoyaltyDashboard {
  snapshot:RoyaltyAggregateSnapshotInput;
  serviceLineCount:number;
  songLineCount:number;
  warnings:readonly string[];
}

export function parseRoyaltyDashboardText(input:{
  rawText:string;
  statementRef:string;
  source?:string;
  currency?:string;
  artistName?:string;
  observedAt:string;
  periodStart?:string;
  periodEnd?:string;
}):ParsedRoyaltyDashboard {
  requireText(input.rawText,'rawText');
  requireText(input.statementRef,'statementRef');
  const lines=input.rawText
    .split(/\r?\n/)
    .map((line)=>line.replace(/\*\*/g,'').trim())
    .filter(Boolean);
  const artistName=(input.artistName??'Atwood Bookie').trim();
  let section:'service'|'song'|null=null;
  let reportedTotal:number|undefined;
  let expectingTotal=false;
  const parsed:RoyaltyAggregateLine[]=[];
  const warnings:string[]=[];
  let serviceLineCount=0;
  let songLineCount=0;

  for(const line of lines){
    const lower=line.toLowerCase();
    if(lower==='by service'){section='service';expectingTotal=false;continue;}
    if(lower==='by song'){section='song';expectingTotal=false;continue;}
    if(lower==='total earnings'){expectingTotal=true;continue;}
    if(expectingTotal){
      const total=moneyFromLine(line);
      if(total!==null){
        reportedTotal=total;
        expectingTotal=false;
        continue;
      }
    }
    if(!section)continue;
    const amountMatch=line.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/);
    if(!amountMatch){
      if(line.includes('
export function summarizeRoyaltyAggregateSnapshot(input:RoyaltyAggregateSnapshotInput):RoyaltyAggregateSummary {
  requireText(input.statementRef,'statementRef');
  requireText(input.source,'source');
  requireText(input.currency,'currency');
  requireMoney(input.reportedTotal,'reportedTotal');
  if(!Number.isFinite(Date.parse(input.observedAt)))throw new Error('ROYALTY_SNAPSHOT_OBSERVED_AT_INVALID');

  const serviceLines=input.lines.filter((line)=>line.kind==='service');
  const songLines=input.lines.filter((line)=>line.kind==='song');
  for(const line of input.lines){
    requireText(line.label,'line.label');
    requireMoney(line.amount,'line.amount');
  }

  const serviceSubtotal=money(serviceLines.reduce((sum,line)=>sum+line.amount,0));
  const songSubtotal=money(songLines.reduce((sum,line)=>sum+line.amount,0));
  const serviceRoundingDelta=money(serviceSubtotal-input.reportedTotal);
  const serviceTotalReconciles=Math.abs(serviceRoundingDelta)<=0.02;

  const topServiceRow=[...serviceLines].sort((a,b)=>b.amount-a.amount)[0];
  const groups=new Map<string,{displayTitle:string;total:number;labels:Set<string>;evidenceRefs:Set<string>;rows:number}>();
  for(const line of songLines){
    const key=royaltyTitleGroupKey(line.label);
    const current=groups.get(key)??{
      displayTitle:line.label.trim(),
      total:0,
      labels:new Set<string>(),
      evidenceRefs:new Set<string>(),
      rows:0,
    };
    current.total+=line.amount;
    current.rows+=1;
    current.labels.add(line.label.trim());
    if(line.evidenceRef)current.evidenceRefs.add(line.evidenceRef);
    groups.set(key,current);
  }

  const titleGroups=Object.freeze([...groups.entries()]
    .map(([titleGroupKey,value])=>Object.freeze({
      titleGroupKey,
      displayTitle:value.displayTitle,
      total:money(value.total),
      rows:value.rows,
      labels:Object.freeze([...value.labels]),
      evidenceRefs:Object.freeze([...value.evidenceRefs]),
    }))
    .sort((a,b)=>b.total-a.total));
  const topSongTitle=titleGroups[0];
  const warnings:string[]=[];
  if(!serviceTotalReconciles){
    warnings.push('Service subtotal does not reconcile to the reported statement total within two cents.');
  }else if(serviceRoundingDelta!==0){
    warnings.push('Service subtotal differs from the reported statement total only by line-item rounding.');
  }
  if(songLines.length&&Math.abs(songSubtotal-input.reportedTotal)>0.02){
    warnings.push('Song subtotal differs from the reported statement total; preserve rows as statement evidence until distributor lineage is available.');
  }
  if(titleGroups.some((group)=>group.rows>1)){
    warnings.push('Repeated/variant song titles were grouped for analytics only; recording identity was not collapsed.');
  }

  return Object.freeze({
    statementRef:input.statementRef,
    currency:input.currency,
    reportedTotal:money(input.reportedTotal),
    serviceSubtotal,
    songSubtotal,
    serviceRoundingDelta,
    serviceTotalReconciles,
    topService:topServiceRow?Object.freeze({
      label:topServiceRow.label,
      amount:money(topServiceRow.amount),
      share:ratio(topServiceRow.amount,input.reportedTotal),
    }):undefined,
    topSongTitle,
    titleGroups,
    warnings:Object.freeze(warnings),
  });
}

export function royaltyTitleGroupKey(title:string):string {
  requireText(title,'title');
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\bremastered\b/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\s/g,'-');
}

export function royaltyLineKey(line:RoyaltyAggregateLine,index:number):string {
  const base=line.kind==='song'?royaltyTitleGroupKey(line.label):slug(line.label);
  return line.kind+':'+base+':'+String(index+1).padStart(4,'0');
}

function moneyFromLine(value:string):number|null{
  const match=value.match(/^\$\s*([0-9]+(?:\.[0-9]{1,2})?)\s*$/);
  return match?Number(match[1]):null;
}
function requireMoney(value:number,field:string):void{
  if(!Number.isFinite(value)||value<0)throw new Error('ROYALTY_SNAPSHOT_MONEY_INVALID:'+field);
}
function requireText(value:string,field:string):void{
  if(!value||!value.trim())throw new Error('ROYALTY_SNAPSHOT_TEXT_REQUIRED:'+field);
}
function money(value:number):number{return Math.round(value*100)/100;}
function ratio(value:number,total:number):number{
  if(total<=0)return 0;
  return Math.round((value/total)*10000)/10000;
}
function slug(value:string):string{
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'line';
}
))warnings.push('Skipped unparseable '+section+' line: '+line);
      continue;
    }
    const amount=Number(amountMatch[1]);
    const labelPart=line.slice(0,amountMatch.index).trim();
    if(!labelPart)continue;
    if(section==='service'){
      parsed.push({
        kind:'service',
        label:labelPart,
        amount,
        evidenceRef:'royalty-dashboard:'+input.statementRef+':service:'+(serviceLineCount+1),
      });
      serviceLineCount+=1;
      continue;
    }
    let title=labelPart;
    let rowArtist:string|undefined;
    if(artistName){
      const idx=labelPart.toLowerCase().lastIndexOf(artistName.toLowerCase());
      if(idx>=0){
        title=labelPart.slice(0,idx).trim();
        rowArtist=labelPart.slice(idx).trim();
      }
    }
    if(!title){
      warnings.push('Skipped song row without a title: '+line);
      continue;
    }
    parsed.push({
      kind:'song',
      label:title,
      amount,
      artistName:rowArtist||artistName||undefined,
      evidenceRef:'royalty-dashboard:'+input.statementRef+':song:'+(songLineCount+1),
    });
    songLineCount+=1;
  }

  if(reportedTotal===undefined)throw new Error('ROYALTY_DASHBOARD_TOTAL_NOT_FOUND');
  if(serviceLineCount===0&&songLineCount===0)throw new Error('ROYALTY_DASHBOARD_LINES_NOT_FOUND');

  return Object.freeze({
    snapshot:Object.freeze({
      statementRef:input.statementRef.trim(),
      source:(input.source??'owner-supplied-streaming-dashboard').trim(),
      currency:(input.currency??'USD').trim().toUpperCase(),
      reportedTotal,
      lines:Object.freeze(parsed),
      periodStart:input.periodStart,
      periodEnd:input.periodEnd,
      observedAt:input.observedAt,
    }),
    serviceLineCount,
    songLineCount,
    warnings:Object.freeze(warnings),
  });
}

export function summarizeRoyaltyAggregateSnapshot(input:RoyaltyAggregateSnapshotInput):RoyaltyAggregateSummary {
  requireText(input.statementRef,'statementRef');
  requireText(input.source,'source');
  requireText(input.currency,'currency');
  requireMoney(input.reportedTotal,'reportedTotal');
  if(!Number.isFinite(Date.parse(input.observedAt)))throw new Error('ROYALTY_SNAPSHOT_OBSERVED_AT_INVALID');

  const serviceLines=input.lines.filter((line)=>line.kind==='service');
  const songLines=input.lines.filter((line)=>line.kind==='song');
  for(const line of input.lines){
    requireText(line.label,'line.label');
    requireMoney(line.amount,'line.amount');
  }

  const serviceSubtotal=money(serviceLines.reduce((sum,line)=>sum+line.amount,0));
  const songSubtotal=money(songLines.reduce((sum,line)=>sum+line.amount,0));
  const serviceRoundingDelta=money(serviceSubtotal-input.reportedTotal);
  const serviceTotalReconciles=Math.abs(serviceRoundingDelta)<=0.02;

  const topServiceRow=[...serviceLines].sort((a,b)=>b.amount-a.amount)[0];
  const groups=new Map<string,{displayTitle:string;total:number;labels:Set<string>;evidenceRefs:Set<string>;rows:number}>();
  for(const line of songLines){
    const key=royaltyTitleGroupKey(line.label);
    const current=groups.get(key)??{
      displayTitle:line.label.trim(),
      total:0,
      labels:new Set<string>(),
      evidenceRefs:new Set<string>(),
      rows:0,
    };
    current.total+=line.amount;
    current.rows+=1;
    current.labels.add(line.label.trim());
    if(line.evidenceRef)current.evidenceRefs.add(line.evidenceRef);
    groups.set(key,current);
  }

  const titleGroups=Object.freeze([...groups.entries()]
    .map(([titleGroupKey,value])=>Object.freeze({
      titleGroupKey,
      displayTitle:value.displayTitle,
      total:money(value.total),
      rows:value.rows,
      labels:Object.freeze([...value.labels]),
      evidenceRefs:Object.freeze([...value.evidenceRefs]),
    }))
    .sort((a,b)=>b.total-a.total));
  const topSongTitle=titleGroups[0];
  const warnings:string[]=[];
  if(!serviceTotalReconciles){
    warnings.push('Service subtotal does not reconcile to the reported statement total within two cents.');
  }else if(serviceRoundingDelta!==0){
    warnings.push('Service subtotal differs from the reported statement total only by line-item rounding.');
  }
  if(songLines.length&&Math.abs(songSubtotal-input.reportedTotal)>0.02){
    warnings.push('Song subtotal differs from the reported statement total; preserve rows as statement evidence until distributor lineage is available.');
  }
  if(titleGroups.some((group)=>group.rows>1)){
    warnings.push('Repeated/variant song titles were grouped for analytics only; recording identity was not collapsed.');
  }

  return Object.freeze({
    statementRef:input.statementRef,
    currency:input.currency,
    reportedTotal:money(input.reportedTotal),
    serviceSubtotal,
    songSubtotal,
    serviceRoundingDelta,
    serviceTotalReconciles,
    topService:topServiceRow?Object.freeze({
      label:topServiceRow.label,
      amount:money(topServiceRow.amount),
      share:ratio(topServiceRow.amount,input.reportedTotal),
    }):undefined,
    topSongTitle,
    titleGroups,
    warnings:Object.freeze(warnings),
  });
}

export function royaltyTitleGroupKey(title:string):string {
  requireText(title,'title');
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\bremastered\b/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\s/g,'-');
}

export function royaltyLineKey(line:RoyaltyAggregateLine,index:number):string {
  const base=line.kind==='song'?royaltyTitleGroupKey(line.label):slug(line.label);
  return line.kind+':'+base+':'+String(index+1).padStart(4,'0');
}

function requireMoney(value:number,field:string):void{
  if(!Number.isFinite(value)||value<0)throw new Error('ROYALTY_SNAPSHOT_MONEY_INVALID:'+field);
}
function requireText(value:string,field:string):void{
  if(!value||!value.trim())throw new Error('ROYALTY_SNAPSHOT_TEXT_REQUIRED:'+field);
}
function money(value:number):number{return Math.round(value*100)/100;}
function ratio(value:number,total:number):number{
  if(total<=0)return 0;
  return Math.round((value/total)*10000)/10000;
}
function slug(value:string):string{
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'line';
}
