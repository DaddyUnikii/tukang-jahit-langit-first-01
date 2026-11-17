import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const elements = new Map();
  class Element {
    constructor(id) { this.id=id; this.hidden=false; this.textContent=''; this.innerHTML=''; this.disabled=false; this.children=[]; this.listeners={}; this.style={setProperty(){}}; this.dataset={}; this.attributes={}; this.classList={add(){},remove(){},toggle(){}}; }
    addEventListener(type,fn) { (this.listeners[type] ??= []).push(fn); }
    click() { if(!this.disabled) for(const f of this.listeners.click ?? []) f({target:this,preventDefault(){}}); }
    setAttribute(k,v) { this.attributes[k]=String(v); }
    getAttribute(k) { return this.attributes[k]; }
    append(...xs) { this.children.push(...xs); }
    replaceChildren(...xs) { this.children=[...xs]; }
    getBoundingClientRect() { return {left:0,top:0,width:1280,height:720}; }
    getContext() { return {}; }
    focus() {}
    setPointerCapture() {}
    releasePointerCapture() {}
  }
  const node = id => { if(!elements.has(id)) elements.set(id,new Element(id)); return elements.get(id); };
  const document={getElementById:node, querySelectorAll:()=>[],createElement:tag=>new Element(tag),documentElement:{lang:'en'},hidden:false,addEventListener(){}};
  const context=vm.createContext({document,console,performance:{now:()=>0},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},matchMedia:()=>({matches:false}),SkyLevels:[{id:1,title:'The first stitch',subtitle:'a fixture evening',hint:'sew',budget:40,maxSpan:300,parMoves:2,start:'1',goal:'3',nodes:[{id:'1',x:100,y:200,glow:0,flower:false},{id:'2',x:250,y:200,glow:0,flower:true},{id:'3',x:400,y:200,glow:0,flower:false}],storms:[]}],SkyCore:{createState:level=>({level,phase:'planning',current:level.start,bridges:[],threadLeft:level.budget,lostThread:0,swarm:1,rescued:[],collected:[],moves:0,history:[],lastEvent:null}),score:s=>({points:0,stars:0,flowers:0,totalFlowers:1,rescued:0,totalGlows:1,threadLeft:s.threadLeft,moves:s.moves}),command:s=>({ok:false,code:'test-noop',state:s})},SkyRender:{render(){},hitPin(){return null},hitBridge(){return null}},SkyProgress:{load:()=>({unlocked:1,stars:[],language:'en',muted:false}),save:()=>true,complete:p=>p},SkyAudio:{create:()=>({unlock(){},play(){},enabled:()=>false,setMuted(){},pause(){}})}});
  context.window=context;
  return {context,node};
}

test('title start button creates a real planning session and replay is a fresh evening',()=>{
  const path=new URL('../game/sky-game.js',import.meta.url);
  assert.ok(existsSync(path),'the start/game/replay controller is missing');
  const {context,node}=fixture();
  vm.runInContext(readFileSync(path,'utf8'),context,{filename:'sky-game.js'});
  assert.equal(context.skyDebug.snapshot().screen,'title');
  node('start-btn').click();
  const playing=context.skyDebug.snapshot();
  assert.equal(playing.screen,'play');
  assert.equal(playing.state.phase,'planning');
  assert.equal(playing.state.current,'1');
  node('restart-btn').click();
  assert.equal(context.skyDebug.snapshot().state.threadLeft,40);
  assert.equal(context.skyDebug.snapshot().state.bridges.length,0);
  assert.equal(typeof context.skyDebug.setState,'undefined','debug cannot grant an injected win');
});

export {fixture};

test('starting and restarting reveal the playable toolbar and clear stale selections and result panels',()=>{
  const {context,node}=fixture();
  for(const id of ['hud','tool-bar','play-footer','hint-note','result-panel']) node(id).hidden=true;
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  for(const id of ['hud','tool-bar','play-footer','hint-note']) assert.equal(node(id).hidden,false,`${id} must be visible`);
  node('cut-btn').click();
  node('result-panel').hidden=false;
  node('restart-btn').click();
  assert.equal(node('result-panel').hidden,true);
  assert.equal(context.skyDebug.snapshot().mode,'stitch');
  assert.equal(node('thread-count').textContent,'40');
});

test('tool modes and keyboard launch go through the same command boundary',()=>{
  const {context,node}=fixture();
  const keys={};
  context.addEventListener=(type,fn)=>{keys[type]=fn;};
  context.SkyCore.command=(state,action)=>({ok:true,code:'ok',state:{...state,phase:action.type==='launch'?'journey':state.phase,lastEvent:{type:action.type}},event:{type:action.type}});
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  node('cut-btn').click();
  assert.equal(context.skyDebug.snapshot().mode,'cut');
  assert.equal(node('cut-btn').attributes['aria-pressed'],'true');
  node('launch-btn').click();
  assert.equal(context.skyDebug.snapshot().state.phase,'journey');
  assert.equal(context.skyDebug.snapshot().mode,'guide');
  assert.equal(typeof keys.keydown,'function');
  keys.keydown({key:'s',target:{tagName:'BODY'},preventDefault(){},repeat:false});
  assert.equal(context.skyDebug.snapshot().mode,'stitch');
});

test('dragging between pins submits a stitch, refreshes the HUD and never edits state directly',()=>{
  const {context,node}=fixture();
  const calls=[];
  context.SkyCore.command=(state,action)=>{calls.push(action); return {ok:true,code:'stitched',state:{...state,threadLeft:25,bridges:[{a:action.a,b:action.b,strands:action.strands,cost:15}],lastEvent:{type:'stitch'}},event:{type:'stitch',a:action.a,b:action.b}};};
  context.SkyRender.hitPin=(state,x)=>x<175?'1':'2';
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  const canvas=node('scene');
  assert.ok(canvas.listeners.pointerdown?.length,'canvas drag start must be wired');
  assert.ok(canvas.listeners.pointerup?.length,'canvas drag end must be wired');
  const event=x=>({clientX:x,clientY:200,button:0,pointerId:1,preventDefault(){},target:canvas});
  for(const f of canvas.listeners.pointerdown) f(event(100));
  for(const f of canvas.listeners.pointerup) f(event(250));
  assert.equal(calls.length,1);
  assert.equal(calls[0].type,'stitch');
  assert.equal(calls[0].a,'1');
  assert.equal(calls[0].b,'2');
  assert.equal(calls[0].strands,1);
  assert.equal(context.skyDebug.snapshot().state.threadLeft,25);
  assert.equal(node('thread-count').textContent,'25');
});

test('guiding crosses through the engine and a won evening shows results with next and replay',()=>{
  const {context,node}=fixture();
  let commanded='';
  context.SkyCore.command=(state,action)=>{
    commanded=action.type;
    if(action.type==='launch') return {ok:true,state:{...state,phase:'journey'},event:{type:'launch'}};
    if(action.type==='move') return {ok:true,state:{...state,phase:'won',current:action.to,moves:2},event:{type:'win',from:state.current,to:action.to}};
    return {ok:false,code:'invalid',state};
  };
  context.SkyCore.score=s=>({points:200,stars:s.phase==='won'?3:0,flowers:1,totalFlowers:1,rescued:1,totalGlows:1,threadLeft:s.threadLeft,moves:s.moves});
  context.SkyRender.hitPin=()=>'3';
  const frames=[];
  context.requestAnimationFrame=fn=>{frames.push(fn); return frames.length;};
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  node('launch-btn').click();
  const canvas=node('scene');
  for(const fn of canvas.listeners.pointerup) fn({clientX:400,clientY:200,pointerId:1,target:canvas,preventDefault(){}});
  assert.equal(commanded,'move','guide uses the command boundary');
  for(let n=0;n<4;n++) { const fn=frames.shift(); if(fn) fn(5000+n*5000); }
  assert.equal(context.skyDebug.snapshot().screen,'won');
  assert.equal(node('result-panel').hidden,false);
  assert.equal(node('retry-btn').hidden,false);
  assert.equal(node('result-title').textContent,'Every light is home.');
  node('retry-btn').click();
  assert.equal(context.skyDebug.snapshot().state.phase,'planning');
});

test('failed actions leave model unchanged and show feedback; cut and undo are reachable buttons',()=>{
  const {context,node}=fixture();
  const seen=[];
  context.SkyCore.command=(state,action)=>{
    seen.push(action.type);
    if(action.type==='cut' || action.type==='undo') return {ok:true,state:{...state,threadLeft:40,bridges:[]},event:{type:action.type}};
    return {ok:false,code:'thread_budget',state};
  };
  context.SkyRender.hitPin=(state,x)=>x<175?'1':'2';
  context.SkyRender.hitBridge=()=>({a:'1',b:'2'});
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  const canvas=node('scene');
  const event=x=>({clientX:x,clientY:200,button:0,pointerId:1,preventDefault(){},target:canvas});
  for(const f of canvas.listeners.pointerdown) f(event(100));
  for(const f of canvas.listeners.pointerup) f(event(250));
  assert.equal(context.skyDebug.snapshot().state.threadLeft,40);
  assert.ok(node('feedback').textContent.length>0,'a rejected sew action is explained');
  node('cut-btn').click();
  for(const f of canvas.listeners.pointerup) f(event(200));
  assert.ok(seen.includes('cut'));
  node('undo-btn').click();
  assert.ok(seen.includes('undo'));
});

test('nightbook, help, audio, language and title are usable without discarding active progress',()=>{
  const {context,node}=fixture();
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  node('book-btn').click();
  assert.equal(context.skyDebug.snapshot().screen,'book');
  assert.equal(node('book-panel').hidden,false);
  node('book-back-btn').click();
  assert.equal(context.skyDebug.snapshot().screen,'play');
  node('help-btn').click();
  assert.equal(node('help-panel').hidden,false);
  node('help-close-btn').click();
  assert.equal(node('help-panel').hidden,true);
  node('language-btn').click();
  assert.equal(context.skyDebug.snapshot().language,'id');
  node('sound-btn').click();
  assert.equal(context.skyDebug.snapshot().muted,true);
  node('home-btn').click();
  assert.equal(context.skyDebug.snapshot().screen,'title');
});

test('render loop letterboxes the logical canvas, advances real crossing animation and prevents actions in flight',()=>{
  const {context,node}=fixture();
  const frames=[]; let painted=0;
  context.requestAnimationFrame=fn=>{frames.push(fn); return frames.length;};
  context.SkyRender.render=()=>{painted++;};
  context.SkyRender.hitPin=()=>'2';
  const calls=[];
  context.SkyCore.command=(s,a)=>{calls.push(a); return {ok:true,state:{...s,phase:'journey',current:a.type==='move'?a.to:s.current},event:{type:a.type,from:s.current,to:a.to}};};
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  assert.ok(frames.length,'requestAnimationFrame must paint the real scene');
  frames.shift()(0);
  assert.ok(painted>0);
  assert.ok(node('interface').style.transform.includes('scale('));
  node('start-btn').click(); node('launch-btn').click();
  const canvas=node('scene');
  const e={clientX:250,clientY:200,pointerId:1,preventDefault(){},target:canvas};
  for(const f of canvas.listeners.pointerup) f(e);
  assert.ok(context.skyDebug.snapshot().flight,'crossing has an actual animation');
  const before=calls.length;
  node('cut-btn').click();
  for(const f of canvas.listeners.pointerup) f(e);
  assert.equal(calls.length,before,'cannot cut while physically crossing');
  for(let n=0;n<4;n++){const f=frames.shift();if(f)f(5000+n*2000);}
  assert.equal(context.skyDebug.snapshot().flight,null);
});

test('keyboard pins, undo, restart and modal Escape use the visible controls',()=>{
  const {context,node}=fixture();
  const keys={};
  context.addEventListener=(type,fn)=>{keys[type]=fn;};
  const actions=[];
  context.SkyCore.command=(s,a)=>{actions.push(a);return {ok:true,state:{...s,threadLeft:a.type==='stitch'?25:s.threadLeft},event:{type:a.type}};};
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  const key=k=>keys.keydown({key:k,target:{tagName:'BODY'},preventDefault(){},repeat:false});
  node('start-btn').click();
  key('1');key('2');
  assert.equal(actions[0]?.type,'stitch');
  assert.equal(actions[0]?.a,'1');
  assert.equal(actions[0]?.b,'2');
  key('u');
  assert.equal(actions.at(-1).type,'undo');
  key('r');
  assert.equal(context.skyDebug.snapshot().state.threadLeft,40);
  key('h');
  assert.equal(node('help-panel').hidden,false);
  const before=actions.length;
  key('1');key('2');
  assert.equal(actions.length,before,'open help intercepts game keys');
  key('Escape');
  assert.equal(node('help-panel').hidden,true);
  assert.equal(context.skyDebug.snapshot().screen,'play');
  key('Escape');
  assert.equal(context.skyDebug.snapshot().screen,'title');
});

test('the strand buttons affect the actual command and preview gets pointer coordinates',()=>{
  const {context,node}=fixture();
  const actions=[];
  context.SkyCore.command=(s,a)=>{actions.push(a);return {ok:true,state:s,event:{type:a.type}};};
  context.SkyRender.hitPin=(state,x)=>x<175?'1':'2';
  const frames=[];let lastView;
  context.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
  context.SkyRender.render=(ctx,view)=>{lastView=view;};
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();node('double-btn').click();
  const canvas=node('scene');
  const e=x=>({clientX:x,clientY:200,button:0,pointerId:1,preventDefault(){},target:canvas});
  for(const fn of canvas.listeners.pointerdown)fn(e(100));
  for(const fn of canvas.listeners.pointermove??[])fn(e(230));
  frames.shift()(0);
  assert.equal(lastView.pointer?.x,230);
  assert.equal(lastView.strands,2);
  for(const fn of canvas.listeners.pointerup)fn(e(250));
  assert.equal(actions.at(-1).strands,2);
});

test('nightbook enables earned evenings, blocks locked choices and hides game controls on the title',()=>{
  const {context,node}=fixture();
  context.SkyLevels=[context.SkyLevels[0],{...context.SkyLevels[0],id:2,title:'The second evening'},{...context.SkyLevels[0],id:3,title:'Locked evening'}];
  context.SkyProgress.load=()=>({unlocked:2,stars:[3],language:'en',muted:false});
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  assert.equal(node('continue-btn').hidden,false,'stored progress has a continue action');
  node('book-btn').click();
  const cards=node('level-list').children;
  assert.equal(cards.length,3);
  assert.equal(cards[0].disabled,false);
  assert.equal(cards[1].disabled,false);
  assert.equal(cards[2].disabled,true);
  cards[2].click();
  assert.equal(context.skyDebug.snapshot().screen,'book');
  cards[1].click();
  assert.equal(context.skyDebug.snapshot().state.level.id,2);
  assert.equal(node('book-panel').hidden,true);
  node('home-btn').click();
  for(const id of ['hud','tool-bar','play-footer','hint-note','result-panel','book-panel','help-panel']) assert.equal(node(id).hidden,true,`${id} hidden on title`);
});

test('language changes visible copy and saved preference; audio unlock is limited to a gesture',()=>{
  const {context,node}=fixture();
  const tagline=node('translated-tagline');tagline.dataset.i18n='tagline';
  context.document.querySelectorAll=()=>[tagline];
  let unlocked=0;const sounds=[];const saves=[];
  context.SkyAudio.create=()=>({unlock(){unlocked++;},play(kind){sounds.push(kind);},setMuted(){}});
  context.SkyProgress.save=(storage,p)=>{saves.push(JSON.parse(JSON.stringify(p)));return true;};
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  assert.equal(unlocked,0,'no audio context before a player gesture');
  node('start-btn').click();
  assert.ok(unlocked>0,'play unlocks generated audio');
  node('language-btn').click();
  assert.equal(context.document.documentElement.lang,'id');
  assert.equal(node('language-btn').textContent,'EN');
  assert.match(tagline.textContent,/malam|cahaya/i);
  assert.equal(saves.at(-1).language,'id');
  node('sound-btn').click();
  assert.equal(node('sound-btn').attributes['aria-pressed'],'true');
  assert.equal(saves.at(-1).muted,true);
});

test('reject feedback distinguishes storms, range, duplicate and thread budget',()=>{
  const {context,node}=fixture();let code='storm-blocked';
  context.SkyCore.command=(state,action)=>({ok:false,code,state,event:{type:'reject',reason:code}});
  context.SkyRender.hitPin=(s,x)=>x<175?'1':'2';
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  const canvas=node('scene');
  const e=x=>({clientX:x,clientY:200,button:0,pointerId:1,target:canvas,preventDefault(){}});
  for(const [reason,pattern] of [['storm-blocked',/storm/i],['too-far',/far|reach|distance/i],['duplicate',/already|same|strong/i],['not-enough-thread',/thread/i]]) {
    code=reason;
    for(const fn of canvas.listeners.pointerdown)fn(e(100));
    for(const fn of canvas.listeners.pointerup)fn(e(250));
    assert.match(node('feedback').textContent,pattern,reason);
  }
});

test('flight blocks keyboard and canvas commands while modal help blocks all game gestures',()=>{
  const {context,node}=fixture();const keys={};const actions=[];const frames=[];
  context.addEventListener=(type,fn)=>{keys[type]=fn;};
  context.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
  context.SkyCore.command=(s,a)=>{actions.push(a);return {ok:true,state:{...s,phase:'journey',current:a.type==='move'?a.to:s.current},event:{type:a.type,from:s.current,to:a.to}};};
  context.SkyRender.hitPin=()=>'2';
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  const canvas=node('scene');const e={clientX:250,clientY:200,button:0,pointerId:1,target:canvas,preventDefault(){}};
  const key=k=>keys.keydown({key:k,target:{tagName:'BODY'},preventDefault(){},repeat:false});
  node('start-btn').click();node('launch-btn').click();
  for(const fn of canvas.listeners.pointerup)fn(e);
  const before=actions.length;
  node('undo-btn').click();
  assert.equal(actions.length,before,'undo cannot change a physically crossing flock');
  key('s');key('1');key('2');
  assert.equal(actions.length,before);
  for(let n=0;n<5;n++){const fn=frames.shift();if(fn)fn(5000+n*5000);}
  node('help-btn').click();
  for(const fn of canvas.listeners.pointerup)fn(e);
  node('launch-btn').click();node('undo-btn').click();
  assert.equal(actions.length,before,'help stops all game commands while open');
});

test('HUD shows evening index, move target, phase, hints, and outcome explains earned stars and points',()=>{
  const {context,node}=fixture();
  const frames=[];context.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
  context.SkyRender.hitPin=()=>'3';
  context.SkyCore.command=(s,a)=>({ok:true,state:{...s,phase:a.type==='move'?'won':'journey',current:a.type==='move'?a.to:s.current,moves:2},event:{type:a.type==='move'?'win':a.type,from:s.current,to:a.to}});
  context.SkyCore.score=s=>({points:270,stars:s.phase==='won'?3:0,flowers:1,totalFlowers:1,totalGlows:1,threadLeft:s.threadLeft,moves:s.moves});
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  node('start-btn').click();
  assert.match(node('level-number').textContent,/01/);
  assert.equal(node('level-subtitle').textContent,'a fixture evening');
  assert.match(node('moves-count').textContent,/2/,'the target is communicated before playing');
  assert.match(node('phase-label').textContent,/PLANNING/i);
  node('launch-btn').click();
  assert.equal(node('launch-btn').hidden,true);
  assert.match(node('control-hint').textContent,/click|island/i);
  const canvas=node('scene');
  for(const fn of canvas.listeners.pointerup)fn({clientX:400,clientY:200,pointerId:1,target:canvas,preventDefault(){}});
  for(let n=0;n<4;n++){const fn=frames.shift();if(fn)fn(5000+n*5000);}
  assert.match(node('result-copy').textContent,/flower|light/i);
  assert.ok(node('result-stats').children.length>=3,'score facts are visible');
});

test('title illustration does not seed free bridges or alter the real first-night player state',()=>{
  const {context,node}=fixture();const frames=[];const views=[];
  context.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
  context.SkyRender.render=(ctx,view)=>views.push(view);
  vm.runInContext(readFileSync(new URL('../game/sky-game.js',import.meta.url),'utf8'),context);
  const original=context.skyDebug.snapshot().state;
  frames.shift()(0);
  assert.equal(views.at(-1).screen,'title','renderer selects its dedicated non-playable title composition');
  assert.deepEqual(context.skyDebug.snapshot().state,original,'painting the title does not mutate the model');
  node('start-btn').click();
  assert.equal(context.skyDebug.snapshot().state.level.id,1);
  assert.equal(context.skyDebug.snapshot().state.bridges.length,0,'no illustration bridges carry into the game');
});

