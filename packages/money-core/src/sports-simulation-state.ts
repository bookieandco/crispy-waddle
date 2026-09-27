export type SportsSimSport='FOOTBALL'|'BASKETBALL'|'BASEBALL'|'HOCKEY'|'TENNIS'|'BOXING'|'SOCCER'

export type FootballSimState=Readonly<{sport:'FOOTBALL';homeScore:number;awayScore:number;secondsRemaining:number;possession:'HOME'|'AWAY';down:1|2|3|4;distance:number;yardLine:number;drive:number}>
export type BasketballSimState=Readonly<{sport:'BASKETBALL';homeScore:number;awayScore:number;secondsRemaining:number;period:number;possession:'HOME'|'AWAY';homeFouls:number;awayFouls:number}>
export type BaseballSimState=Readonly<{sport:'BASEBALL';homeScore:number;awayScore:number;inning:number;half:'TOP'|'BOTTOM';outs:0|1|2;runners:readonly [boolean,boolean,boolean];batting:'HOME'|'AWAY'}>
export type HockeySimState=Readonly<{sport:'HOCKEY';homeScore:number;awayScore:number;secondsRemaining:number;period:number;strength:'EVEN'|'HOME_PP'|'AWAY_PP';possession:'HOME'|'AWAY'}>
export type TennisSimState=Readonly<{sport:'TENNIS';playerASets:number;playerBSets:number;playerAGames:number;playerBGames:number;playerAPoints:0|15|30|40;playerBPoints:0|15|30|40;server:'A'|'B'}>
export type BoxingSimState=Readonly<{sport:'BOXING';round:number;secondsRemainingInRound:number;redPoints:number;bluePoints:number;redDamage:number;blueDamage:number;redFatigue:number;blueFatigue:number}>
export type SoccerSimState=Readonly<{sport:'SOCCER';homeScore:number;awayScore:number;secondsRemaining:number;possession:'HOME'|'AWAY';homeRedCards:number;awayRedCards:number;homeSubsUsed:number;awaySubsUsed:number}>
export type SportsSimState=FootballSimState|BasketballSimState|BaseballSimState|HockeySimState|TennisSimState|BoxingSimState|SoccerSimState

export type SportsSimTransition=
  |Readonly<{sport:'FOOTBALL';kind:'PLAY';team:'HOME'|'AWAY';yards:number;secondsElapsed:number;scoreDelta?:0|2|3|6|7;turnover?:boolean}>
  |Readonly<{sport:'BASKETBALL';kind:'POSSESSION';team:'HOME'|'AWAY';points:0|1|2|3;secondsElapsed:number;foul?:boolean}>
  |Readonly<{sport:'BASEBALL';kind:'PLATE_APPEARANCE';runs:number;outsAdded:0|1|2|3;advanceBases?:number}>
  |Readonly<{sport:'HOCKEY';kind:'SHIFT';team:'HOME'|'AWAY';goal:boolean;secondsElapsed:number;nextStrength?:HockeySimState['strength']}>
  |Readonly<{sport:'TENNIS';kind:'POINT';winner:'A'|'B'}>
  |Readonly<{sport:'BOXING';kind:'EXCHANGE';redPoints:number;bluePoints:number;redDamage:number;blueDamage:number;secondsElapsed:number}>
  |Readonly<{sport:'SOCCER';kind:'SEQUENCE';team:'HOME'|'AWAY';goal:boolean;secondsElapsed:number;redCardTo?:'HOME'|'AWAY';subBy?:'HOME'|'AWAY'}>

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))

export function transitionSportsState(state:SportsSimState,event:SportsSimTransition):SportsSimState{
  if(state.sport!==event.sport)throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
  switch(state.sport){
    case 'FOOTBALL':{
      if(event.sport!=='FOOTBALL')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      const offense=state.possession
      let homeScore=state.homeScore,awayScore=state.awayScore
      if(event.scoreDelta){
        if(event.team==='HOME')homeScore+=event.scoreDelta
        else awayScore+=event.scoreDelta
      }
      const scored=(event.scoreDelta??0)>0
      const turnover=event.turnover===true
      const gained=Math.max(-99,Math.min(99,event.yards))
      let yardLine=clamp(state.yardLine+(event.team==='HOME'?gained:-gained),1,99)
      let down=state.down,distance=Math.max(1,state.distance-gained),possession=state.possession,drive=state.drive
      if(scored||turnover){
        possession=offense==='HOME'?'AWAY':'HOME';down=1;distance=10;yardLine=25;drive++
      }else if(gained>=state.distance){
        down=1;distance=10
      }else if(state.down===4){
        possession=offense==='HOME'?'AWAY':'HOME';down=1;distance=10;yardLine=100-yardLine;drive++
      }else{
        down=(state.down+1) as 1|2|3|4
      }
      return Object.freeze({...state,homeScore,awayScore,secondsRemaining:clamp(state.secondsRemaining-event.secondsElapsed,0,state.secondsRemaining),possession,down,distance,yardLine,drive})
    }
    case 'BASKETBALL':{
      if(event.sport!=='BASKETBALL')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      return Object.freeze({...state,
        homeScore:state.homeScore+(event.team==='HOME'?event.points:0),
        awayScore:state.awayScore+(event.team==='AWAY'?event.points:0),
        secondsRemaining:clamp(state.secondsRemaining-event.secondsElapsed,0,state.secondsRemaining),
        possession:event.team==='HOME'?'AWAY':'HOME',
        homeFouls:state.homeFouls+(event.foul&&event.team==='AWAY'?1:0),
        awayFouls:state.awayFouls+(event.foul&&event.team==='HOME'?1:0),
      })
    }
    case 'BASEBALL':{
      if(event.sport!=='BASEBALL')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      let outs=state.outs+event.outsAdded
      let inning=state.inning,half=state.half,batting=state.batting
      let homeScore=state.homeScore,awayScore=state.awayScore
      if(state.batting==='HOME')homeScore+=event.runs;else awayScore+=event.runs
      if(outs>=3){
        outs=0
        if(state.half==='TOP'){half='BOTTOM';batting='HOME'}
        else {half='TOP';batting='AWAY';inning++}
      }
      return Object.freeze({...state,homeScore,awayScore,inning,half,outs:outs as 0|1|2,batting,runners:Object.freeze([false,false,false]) as readonly [boolean,boolean,boolean]})
    }
    case 'HOCKEY':{
      if(event.sport!=='HOCKEY')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      return Object.freeze({...state,
        homeScore:state.homeScore+(event.goal&&event.team==='HOME'?1:0),
        awayScore:state.awayScore+(event.goal&&event.team==='AWAY'?1:0),
        secondsRemaining:clamp(state.secondsRemaining-event.secondsElapsed,0,state.secondsRemaining),
        possession:event.team==='HOME'?'AWAY':'HOME',
        strength:event.nextStrength??state.strength,
      })
    }
    case 'TENNIS':{
      if(event.sport!=='TENNIS')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      const key=event.winner==='A'?'playerAPoints':'playerBPoints'
      const opp=event.winner==='A'?'playerBPoints':'playerAPoints'
      const current=state[key],other=state[opp]
      if(current===40&&other!==40){
        const aGames=state.playerAGames+(event.winner==='A'?1:0)
        const bGames=state.playerBGames+(event.winner==='B'?1:0)
        return Object.freeze({...state,playerAGames:aGames,playerBGames:bGames,playerAPoints:0,playerBPoints:0,server:state.server==='A'?'B':'A'})
      }
      const next=current===0?15:current===15?30:40
      return Object.freeze({...state,[key]:next})
    }
    case 'BOXING':{
      if(event.sport!=='BOXING')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      let seconds=clamp(state.secondsRemainingInRound-event.secondsElapsed,0,state.secondsRemainingInRound)
      let round=state.round
      if(seconds===0){round++;seconds=180}
      return Object.freeze({...state,round,secondsRemainingInRound:seconds,redPoints:state.redPoints+event.redPoints,bluePoints:state.bluePoints+event.bluePoints,redDamage:clamp(state.redDamage+event.redDamage,0,1),blueDamage:clamp(state.blueDamage+event.blueDamage,0,1),redFatigue:clamp(state.redFatigue+event.secondsElapsed/1800,0,1),blueFatigue:clamp(state.blueFatigue+event.secondsElapsed/1800,0,1)})
    }
    case 'SOCCER':{
      if(event.sport!=='SOCCER')throw new Error('SPORT_SIM_STATE_TRANSITION_SPORT_MISMATCH')
      return Object.freeze({...state,
        homeScore:state.homeScore+(event.goal&&event.team==='HOME'?1:0),
        awayScore:state.awayScore+(event.goal&&event.team==='AWAY'?1:0),
        secondsRemaining:clamp(state.secondsRemaining-event.secondsElapsed,0,state.secondsRemaining),
        possession:event.team==='HOME'?'AWAY':'HOME',
        homeRedCards:state.homeRedCards+(event.redCardTo==='HOME'?1:0),
        awayRedCards:state.awayRedCards+(event.redCardTo==='AWAY'?1:0),
        homeSubsUsed:state.homeSubsUsed+(event.subBy==='HOME'?1:0),
        awaySubsUsed:state.awaySubsUsed+(event.subBy==='AWAY'?1:0),
      })
    }
  }
}
