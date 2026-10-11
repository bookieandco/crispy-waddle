import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync('apps/jhadina-web/public/gaming/neon-run/engine.js','utf8');
const scope={};runInNewContext(source,scope,{filename:'neon-run/engine.js'});
const E=scope.JhadinaNeonRun;
const s=E.create(42);
assert.equal(s.status,'ready');
E.step(s,.02,{x:1});assert.equal(s.time,0);
E.start(s);E.step(s,.5,{x:1});assert(s.ship.x>480);assert(s.time<=.05);
E.pause(s);const x=s.ship.x;E.step(s,.05,{x:1});assert.equal(s.ship.x,x);
E.start(s);E.add(s,'star',s.ship.x,s.ship.y,0);
const previous=s.score;E.step(s,0);assert(s.score>previous&&s.combo===1);
E.add(s,'shield',s.ship.x,s.ship.y,0);E.step(s,0);assert.equal(s.ship.shield,1);
E.add(s,'meteor',s.ship.x,s.ship.y,0);E.step(s,0);assert.equal(s.lives,3);assert.equal(s.ship.shield,0);
s.ship.immune=0;
for(let i=0;i<3;i++){
 E.add(s,'meteor',s.ship.x,s.ship.y,0);E.step(s,0);s.ship.immune=0;
}
assert.equal(s.status,'over');assert.equal(s.lives,0);
const oldScore=s.score;E.step(s,.05,{x:1});assert.equal(s.score,oldScore);
assert.throws(()=>E.step(E.start(E.create()),-1),/timestep/);
assert.equal(E.create(42).seed,42);
const a=E.start(E.create(99)),b=E.start(E.create(99));
for(let i=0;i<80;i++){E.step(a,.04);E.step(b,.04);}
assert.equal(JSON.stringify(a),JSON.stringify(b));
console.log('PASS: Neon Run state machine, scoring, shield, collisions, pause, game over, deterministic seed');
