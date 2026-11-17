(function (root) {
  'use strict';
  const byId = id => document.getElementById(id);
  let levelIndex = 0;
  let storage;
  try { storage = root.localStorage; } catch { storage = null; }
  let progress = SkyProgress.load(storage);
  let stars = 0;
  let state = SkyCore.createState(SkyLevels[0]);
  let screen = 'title';
  let mode = 'stitch';
  let strands = 1;
  function setStrands(value) {
    strands = value;
    selected = null;
    for (const [id,count] of [['single-btn',1],['double-btn',2]]) {
      byId(id).setAttribute('aria-pressed',String(count===strands));
      byId(id).classList.toggle('active',count===strands);
    }
  }
  let flight = null;
  let hover = null;
  let pointer = null;
  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setMode(value) {
    mode = value;
    for (const name of ['stitch','guide','cut']) {
      byId(`${name}-btn`).setAttribute('aria-pressed', String(name === mode));
      byId(`${name}-btn`).classList.toggle('active', name === mode);
    }
    const hints = language==='id' ? {
      stitch:'Klik dua pin atau tarik benang · 1–8 memilih pin',
      guide:'Klik pulau yang tersambung · selamatkan semua cahaya',
      cut:'Klik jembatan untuk mengambil benangnya · atau pilih dua pin'
    } : {
      stitch:'Click two pins or drag between them · 1–8 choose pins',
      guide:'Click a stitched neighboring island · rescue every light',
      cut:'Click a bridge to reclaim its thread · or choose two pins'
    };
    byId('control-hint').textContent=hints[mode];
  }
  function modalOpen() {
    return !byId('help-panel').hidden || !byId('book-panel').hidden;
  }
  function canAct() {
    return screen==='play'&&!flight&&!modalOpen();
  }
  function launch() {
    if (!canAct()) return;
    const result = SkyCore.command(state, {type:'launch'});
    if (result.ok) {state=result.state;selected=null;setMode('guide');audio.play('click');refreshHUD();}
    else feedback(result.code);
  }
  function startEvening(index = levelIndex) {
    levelIndex = Number.isInteger(index) ? Math.max(0,Math.min(SkyLevels.length-1,index)) : levelIndex;
    state = SkyCore.createState(SkyLevels[levelIndex]);
    stars = 0;
    flight = null;
    screen = 'play';
    byId('title-panel').hidden = true;
    for (const id of ['hud','tool-bar','play-footer','hint-note']) byId(id).hidden = false;
    for (const id of ['result-panel','book-panel','help-panel','feedback']) byId(id).hidden = true;
    selected = null;
    downPin = null;
    hover = null;
    pointer = null;
    setMode('stitch');
    setStrands(1);
    byId('hint-text').textContent = state.level.hint;
    refreshHUD();
  }
  const canvas = byId('scene');
  let selected = null;
  let downPin = null;
  function coordinates(event) {
    const bounds = canvas.getBoundingClientRect();
    return {x:(event.clientX-bounds.left)*1280/bounds.width,y:(event.clientY-bounds.top)*720/bounds.height};
  }
  function refreshHUD() {
    const facts = SkyCore.score(state);
    byId('thread-count').textContent = String(state.threadLeft);
    byId('flock-count').textContent = `${state.swarm} / ${facts.totalGlows}`;
    byId('flowers-count').textContent = `${facts.flowers} / ${facts.totalFlowers}`;
    byId('moves-count').textContent = language==='id'?`${state.moves} langkah · target ${state.level.parMoves}`:`${state.moves} moves · target ${state.level.parMoves}`;
    byId('level-number').textContent = `${language==='id'?'MALAM':'EVENING'} ${String(levelIndex+1).padStart(2,'0')} / ${String(SkyLevels.length).padStart(2,'0')}`;
    byId('level-subtitle').textContent = state.level.subtitle;
    byId('launch-btn').hidden=state.phase!=='planning';
    byId('phase-label').textContent=state.phase==='planning'?(language==='id'?'MERENCANAKAN MALAM':'PLANNING THE NIGHT'):(language==='id'?'CAHAYA SEDANG BERJALAN':'THE LIGHT IS WALKING');
    byId('thread-meter').style.width = `${state.threadLeft / state.level.budget * 100}%`;
    byId('level-title').textContent = state.level.title;
  }
  function showResult() {
    screen = state.phase;
    byId('result-panel').hidden = false;
    byId('result-title').textContent=state.phase==='won'?(language==='id'?'Semua cahaya sudah pulang.':'Every light is home.'):(language==='id'?'Benangnya terputus.':'The thread let go.');
    byId('retry-btn').hidden = false;
    const facts = SkyCore.score(state);
    stars = facts.stars;
    byId('star-rating').textContent = '★'.repeat(stars) + '☆'.repeat(3-stars);
    byId('next-btn').hidden = state.phase !== 'won';
    byId('undo-loss-btn').hidden = state.phase !== 'lost';
    byId('star-rating').hidden=state.phase!=='won';
    byId('star-rating').setAttribute('aria-label',`${stars} / 3`);
    byId('result-eyebrow').textContent=state.phase==='won'?(language==='id'?'MALAM TELAH TERJAHIT':'THE NIGHT IS MENDED'):(language==='id'?'JEMBATAN TERPUTUS':'THE BRIDGE SNAPPED');
    byId('result-icon').textContent=state.phase==='won'?'✦':'⌁';
    byId('result-copy').textContent=state.phase==='won'?
      (language==='id'?'Semua cahaya pulang. Bunga dan langkah yang cermat membuat malam ini lebih indah.':'Every light is home. Optional flowers and careful moves make the night brighter.'):
      (language==='id'?'Rombonganmu terlalu berat untuk benang tunggal. Urungkan penyeberangan, lalu kuatkan jembatan dengan benang ganda.':'The flock outgrew a single strand. Undo the crossing, then reinforce the bridge with Double thread.');
    byId('result-stats').replaceChildren();
    for(const [value,label] of [[facts.points,language==='id'?'POIN':'POINTS'],[`${facts.flowers}/${facts.totalFlowers}`,language==='id'?'BUNGA':'FLOWERS'],[`${state.moves}/${state.level.parMoves}`,language==='id'?'LANGKAH / TARGET':'MOVES / TARGET']]) {
      const stat=document.createElement('div');const number=document.createElement('strong');number.textContent=String(value);const caption=document.createElement('span');caption.textContent=label;stat.append(number,caption);byId('result-stats').append(stat);
    }
    audio.play(state.phase==='won'?'win':'lose');
    if (state.phase === 'won') {
      progress = SkyProgress.complete(progress,levelIndex,stars);
      SkyProgress.save(storage,progress);
    }
  }
  function nextEvening() {
    if (screen !== 'won' || state.phase !== 'won' || flight || modalOpen()) return;
    if (levelIndex + 1 < SkyLevels.length) startEvening(levelIndex + 1);
    else {
      screen = 'ending';
      byId('result-title').textContent = language==='id'?'Delapan malam. Langit penuh cahaya.':'Eight nights. A sky full of light.';
      byId('result-copy').textContent = language==='id'?'Langit sudah utuh, satu jahitan setiap saat. Terima kasih telah membawa semua kunang-kunang pulang.':'The sky is whole again, one stitch at a time. Thank you for bringing the fireflies home. Return to the Nightbook to find every flower and earn all 24 stars.';
      byId('result-eyebrow').textContent = language==='id'?'PERJALANAN SELESAI':'THE JOURNEY IS COMPLETE';
      byId('star-rating').textContent = '✦ ✦ ✦';
      byId('next-btn').hidden = true;
    }
  }
  function guide(to) {
    if (!canAct()) return;
    const from = state.current;
    const swarm = state.swarm;
    const result = SkyCore.command(state,{type:'move',to});
    if (result.ok) {
      state = result.state;
      const a = state.level.nodes.find(node => node.id === from);
      const b = state.level.nodes.find(node => node.id === to);
      flight = {from, to, swarm, progress:0, start:performance.now(), duration:reduceMotion ? 100 : Math.max(450, Math.hypot(b.x-a.x,b.y-a.y)*2)};
      byId('feedback').hidden=true;
      audio.play(result.event&&result.event.glows?'rescue':'move');
      refreshHUD();
      if(result.code==='missing-glows')feedback(result.code,false);
    } else feedback(result.code);
  }
  function sew(a,b) {
    if (!canAct()) return;
    const result = SkyCore.command(state,{type:'stitch',a,b,strands});
    if (result.ok) {state=result.state;selected=null;byId('feedback').hidden=true;audio.play('stitch');refreshHUD();}
    else feedback(result.code);
  }
  function undo() {
    if (flight||modalOpen()) return;
    const result=SkyCore.command(state,{type:'undo'});
    if(result.ok) {state=result.state;screen='play';selected=null;downPin=null;byId('result-panel').hidden=true;byId('feedback').hidden=true;audio.play('undo');refreshHUD();}
    else feedback(result.code);
  }
  function cutBridge(point) {
    if (!canAct()) return;
    const edge=SkyRender.hitBridge(state,point.x,point.y);
    if(!edge) return;
    const result=SkyCore.command(state,{type:'cut',a:edge.a,b:edge.b});
    if(result.ok) {state=result.state;selected=null;byId('feedback').hidden=true;audio.play('cut');refreshHUD();}
    else feedback(result.code);
  }
  function selectPin(pin) {
    if (screen !== 'play' || flight || !pin) return;
    if (mode === 'guide') { guide(pin); return; }
    if (mode === 'cut') {
      if (selected && selected !== pin) {
        const result = SkyCore.command(state,{type:'cut',a:selected,b:pin});
        if (result.ok) { state=result.state; refreshHUD(); }
        selected=null;
      } else selected=pin;
      return;
    }
    if (selected && selected !== pin) sew(selected,pin);
    else selected=pin;
  }
  canvas.addEventListener('pointermove',event => {
    pointer=coordinates(event);
    hover=SkyRender.hitPin(state,pointer.x,pointer.y);
  });
  canvas.addEventListener('pointerleave',() => {hover=null;pointer=null;});
  canvas.addEventListener('pointercancel',() => {downPin=null;selected=null;});
  canvas.addEventListener('pointerdown',event => {
    if(!canAct() || event.button !== 0) return;
    const point=coordinates(event);
    downPin=SkyRender.hitPin(state,point.x,point.y);
    if(downPin) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup',event => {
    if(!canAct()) {downPin=null;return;}
    const point=coordinates(event);
    const pin=SkyRender.hitPin(state,point.x,point.y);
    if (mode === 'guide') { if (pin) guide(pin); downPin=null; return; }
    if (mode === 'cut') { cutBridge(point); downPin=null; return; }
    if (mode !== 'stitch') return;
    if(downPin && pin && downPin !== pin) sew(downPin,pin);
    else if(pin) {
      if(selected && selected !== pin) sew(selected,pin);
      else selected=pin;
    }
    downPin=null;
  });
  byId('start-btn').addEventListener('click', () => {if(modalOpen()||flight)return;audio.unlock();startEvening(0);});
  byId('next-btn').addEventListener('click', nextEvening);
  const replayEvening = () => {if(!flight&&!modalOpen())startEvening();};
  byId('restart-btn').addEventListener('click', replayEvening);
  byId('retry-btn').addEventListener('click', replayEvening);
  byId('launch-btn').addEventListener('click', launch);
  byId('undo-btn').addEventListener('click', undo);
  byId('undo-loss-btn').addEventListener('click', undo);
  byId('single-btn').addEventListener('click', () => {if(!modalOpen())setStrands(1);});
  byId('double-btn').addEventListener('click', () => {if(!modalOpen())setStrands(2);});
  for (const name of ['stitch','guide','cut']) byId(`${name}-btn`).addEventListener('click', () => {if(!modalOpen())setMode(name);});
  root.addEventListener('keydown', event => {
    if (event.repeat || ['INPUT','TEXTAREA','SELECT'].includes(event.target && event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      event.preventDefault();
      if (!byId('help-panel').hidden) byId('help-close-btn').click();
      else if (!byId('book-panel').hidden) byId('book-back-btn').click();
      else byId('home-btn').click();
      return;
    }
    if (key === 'h') { event.preventDefault();byId('help-btn').click();return; }
    if (screen !== 'play' || !byId('help-panel').hidden || flight) return;
    if ({s:'stitch',g:'guide',c:'cut'}[key]) { event.preventDefault(); setMode({s:'stitch',g:'guide',c:'cut'}[key]); }
    else if (/^[1-8]$/.test(key)) {event.preventDefault();selectPin(key);}
    else if (key === ' ') {event.preventDefault();launch();}
    else if (key === 'u' || key === 'z') {event.preventDefault();undo();}
    else if (key === 'r') {event.preventDefault();startEvening();}
  });
  const audio = SkyAudio.create(root);
  let language = progress.language;
  let muted = progress.muted;
  audio.setMuted(muted);
  const english = {};
  for (const element of document.querySelectorAll('[data-i18n]')) english[element.dataset.i18n] = element.textContent;
  english.tagline = 'Some nights fall apart.\nA little thread brings the light home.';
  const indonesian = {
    eyebrow:'MALAM YANG DIJAHIT TANGAN / PUZZLE ORIGINAL',
    tagline:'Ada malam yang koyak.\nSeutas benang membawa cahaya pulang.',
    start:'Jahit malam pertama ↗',continue:'Lanjutkan perjalanan',
    rule1:'Jahit jembatan di antara pulau kertas',rule2:'Selamatkan semua kunang-kunang, lalu pulang',rule3:'Gunting di belakangmu. Pakai lagi benangnya.',
    offline:'8 malam buatan tangan · mouse & keyboard · sepenuhnya offline',
    thread:'BENANG',flock:'KUNANG-KUNANG',flowers:'BUNGA',allHome:'bawa semua cahaya pulang',
    sew:'Jahit',guide:'Pandu',cut:'Gunting',single:'Tunggal',double:'Ganda',launch:'Biarkan cahaya berjalan ▶',undo:'Urungkan',restart:'Ulang',
    sewHint:'Klik dua pin atau tarik benang · 1–8 memilih pin',
    next:'Malam berikutnya ↗',replay:'Mainkan malam ini lagi',undoCrossing:'Urungkan penyeberangan',
    nightbook:'BUKU MALAM',choose:'Delapan cara menjahit langit.',bookCopy:'Satu cahaya setiap saat. Bintang terbaikmu tersimpan.',back:'Kembali ke langit',
    how:'CATATAN SANG PENJAHIT',helpTitle:'Jarum. Sedikit cahaya.',
    help1:'Jahit: klik dua pin bernomor, atau tarik. Biaya benang mengikuti jarak. Badai menghalangi jembatan.',
    help2:'Benang tunggal menahan satu kunang-kunang. Benang ganda menahan tiga. Setiap teman yang diselamatkan menambah berat rombongan.',
    help3:'Mulai berjalan, lalu Pandu: klik pulau yang tersambung. Selamatkan semua kunang-kunang sebelum pulang ke rumah.',
    help4:'Di pulau, kamu boleh menjahit lagi, atau menggunting jembatan untuk mengambil seluruh benangnya. Gunting di belakangmu agar bisa melangkah lebih jauh.',
    help5:'Bunga bersifat opsional. Satu bintang untuk selesai, satu untuk semua bunga, satu untuk memenuhi target langkah.',
    understood:'Mari jahit langit ini'
  };
  function storePreferences() {
    progress={...progress,language,muted};
    SkyProgress.save(storage,progress);
  }
  function translate() {
    document.documentElement.lang=language;
    const copy=language==='id'?indonesian:english;
    for(const element of document.querySelectorAll('[data-i18n]')) {
      const text=copy[element.dataset.i18n];
      if(typeof text==='string')element.textContent=text;
    }
    byId('language-btn').textContent=language==='en'?'ID':'EN';
    byId('sound-btn').textContent=language==='id'?(muted?'Suara mati':'Suara aktif'):(muted?'Sound off':'Sound on');
    byId('sound-btn').setAttribute('aria-pressed',String(muted));
    byId('book-btn').textContent=language==='id'?'Buku malam':'Nightbook';
    refreshHUD();setMode(mode);
  }
  const messages = {
    'storm-blocked':['A storm blocks that stitch. Sew around its edge.','Badai menghalangi jahitan itu. Jahit memutari tepinya.'],
    'too-far':['Those islands are too far apart. Choose a closer pin.','Pulau-pulau itu terlalu jauh. Pilih pin yang lebih dekat.'],
    duplicate:['That bridge is already this strong. Use Double to upgrade a Single.','Jembatan itu sudah sekuat ini. Pilih Ganda untuk menguatkan Tunggal.'],
    'not-enough-thread':['Not enough thread. Cut a bridge to reuse its yarn.','Benang tidak cukup. Gunting jembatan untuk memakai ulang benangnya.'],
    'thread_budget':['Not enough thread. Cut a bridge to reuse its yarn.','Benang tidak cukup. Gunting jembatan untuk memakai ulang benangnya.'],
    'no-bridge':['No bridge to that island. Sew a path before crossing.','Belum ada jembatan ke pulau itu. Jahit sebelum menyeberang.'],
    'not-launched':['Let the light walk first, then guide it.','Biarkan cahaya berjalan dulu, lalu pandu.'],
    'missing-glows':['Home will wait. Rescue the remaining lights.','Rumah akan menunggu. Selamatkan cahaya yang tersisa.'],
    'no-history':['Nothing to undo yet.','Belum ada tindakan untuk diurungkan.'],
    'same-node':['Choose a different island.','Pilih pulau lain.']
  };
  function feedback(code,error=true) {
    const pair=messages[code]||['That action cannot be used right now.','Tindakan itu belum bisa dilakukan.'];
    byId('feedback').textContent=pair[language==='id'?1:0];
    byId('feedback').hidden=false;
    byId('feedback').classList.toggle('error',error);
  }
  let previousScreen = 'title';
  function renderBook() {
    byId('level-list').replaceChildren();
    SkyLevels.forEach((level,index) => {
      const card=document.createElement('button');
      card.className='level-card';
      card.disabled=index>=progress.unlocked;
      const label=document.createElement('span');
      label.textContent=`EVENING ${String(index+1).padStart(2,'0')}`;
      const title=document.createElement('b');title.textContent=level.title;
      const rating=document.createElement('small');
      rating.textContent=card.disabled?'LOCKED':'★'.repeat(progress.stars[index]||0)+'☆'.repeat(3-(progress.stars[index]||0));
      card.append(label,title,rating);
      card.addEventListener('click',() => {if(!card.disabled&&!flight&&byId('help-panel').hidden)startEvening(index);});
      byId('level-list').append(card);
    });
  }
  byId('continue-btn').addEventListener('click',() => {if(!modalOpen()&&!flight)startEvening(Math.min(SkyLevels.length-1,progress.unlocked-1));});
  byId('book-btn').addEventListener('click', () => {if(flight||!byId('help-panel').hidden)return;if(screen!=='book')previousScreen=screen;screen='book';renderBook();byId('book-panel').hidden=false;});
  byId('book-back-btn').addEventListener('click', () => {if(byId('book-panel').hidden||!byId('help-panel').hidden)return;screen=previousScreen; byId('book-panel').hidden=true;});
  byId('help-btn').addEventListener('click', () => {byId('help-panel').hidden=false;});
  byId('help-close-btn').addEventListener('click', () => {byId('help-panel').hidden=true;});
  byId('language-btn').addEventListener('click', () => {language=language==='en'?'id':'en';translate();storePreferences();renderBook();});
  byId('sound-btn').addEventListener('click', () => {muted=!muted;audio.setMuted(muted);if(!muted)audio.unlock();translate();storePreferences();});
  byId('home-btn').addEventListener('click', () => {
    if(modalOpen())return;
    screen='title';flight=null;selected=null;downPin=null;
    byId('title-panel').hidden=false;
    for(const id of ['hud','tool-bar','play-footer','hint-note','result-panel','book-panel','help-panel','feedback'])byId(id).hidden=true;
    byId('continue-btn').hidden=progress.unlocked<2;
  });
  function frame(time) {
    byId('interface').style.transform = `scale(${canvas.getBoundingClientRect().width/1280})`;
    if (flight) {
      flight.progress = Math.max(0,Math.min(1,(time-flight.start)/flight.duration));
      if (flight.progress >= 1) {
        flight = null;
        if (state.phase === 'won' || state.phase === 'lost') showResult();
      }
    }
    SkyRender.render(canvas.getContext('2d'),{state,screen,mode,strands,selected:downPin||selected,hover,pointer,time:reduceMotion?0:time,flight,effects:[]});
    requestAnimationFrame(frame);
  }
  for (const id of ['hud','tool-bar','play-footer','hint-note','result-panel','book-panel','help-panel','feedback']) byId(id).hidden = true;
  byId('continue-btn').hidden=progress.unlocked<2;
  translate();
  requestAnimationFrame(frame);
  root.skyDebug = Object.freeze({snapshot: () => JSON.parse(JSON.stringify({screen,state,mode,strands,language,muted,flight,levelIndex,stars}))});
})(globalThis);
