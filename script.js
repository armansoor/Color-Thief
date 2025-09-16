/* Color Thief — Deluxe
   Single-file client-only game ready for GitHub Pages.
   Features:
   - Procedural levels
   - Moving orbs (collectibles) with different color energies
   - Obstacles and moving hazards
   - Power-ups (blend booster, slow-time, magnet)
   - Local storage save for level, score, settings
   - Sound (optional), UI, tutorial tips
*/

(() => {
  // ---------- Config ----------
  const ARENA = { w: 1200, h: 700 };
  const SAVE_KEY = 'colorThiefDeluxe_v1';

  // ---------- DOM ----------
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const btnStart = document.getElementById('btn-start');
  const btnContinue = document.getElementById('btn-continue');
  const btnReset = document.getElementById('btn-reset');
  const muteCheckbox = document.getElementById('mute');
  const levelLabel = document.getElementById('level');
  const scoreLabel = document.getElementById('score');
  const targetSwatch = document.getElementById('targetSwatch');
  const playerSwatch = document.getElementById('playerSwatch');
  const inventoryDiv = document.getElementById('inventory');
  const tipDiv = document.getElementById('tip');

  // ---------- State ----------
  let state = null; // full game state
  let lastTs = 0;
  let canvasScale = 1, offsetX = 0, offsetY = 0;

  // ---------- Utilities ----------
  function rand(min, max){ return Math.random() * (max - min) + min; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify({level: state.level, score: state.score, settings: state.settings})); }
  function loadSave(){ try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s; } catch(e){return null} }
  function clearSave(){ localStorage.removeItem(SAVE_KEY); }

  // Color helpers
  function rgb(r,g,b){ return {r:Math.round(r), g:Math.round(g), b:Math.round(b)}; }
  function rgbToCSS(c){ return `rgb(${c.r}, ${c.g}, ${c.b})`; }
  function mixColors(a,b,ratio=0.5){ return rgb(a.r*(1-ratio)+b.r*ratio, a.g*(1-ratio)+b.g*ratio, a.b*(1-ratio)+b.b*ratio); }
  function colorDistance(a,b){ // Euclidean in RGB
    const dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b; return Math.sqrt(dr*dr+dg*dg+db*db);
  }
  function randomColor(){ return rgb(rand(40,240), rand(40,240), rand(40,240)); }

  // ---------- Game Objects ----------
  function createPlayer(){
    return {
      x: ARENA.w/2, y: ARENA.h/2, r:14,
      color: rgb(220,220,220), inventory: [],
      speed: 260, cooldown: 0,
      power: { magnet:0, slow:0, boost:0 }
    };
  }

  function createOrb(x,y,energyColor,energy){
    return { id: Math.random().toString(36).slice(2,9), x, y, vx: rand(-30,30), vy: rand(-30,30), r: 12 + energy*6, color: energyColor, energy };
  }
  function createHazard(x,y,pattern='patrol'){ return { x,y, vx: rand(-60,60), vy: rand(-60,60), r: 18, pattern }; }
  function createPowerup(x,y,type){ return { x,y,type, r:10, ttl: 18 }; }

  // ---------- Level generator ----------
  function generateLevel(n){
    const level = { numOrbs: 6 + n*2, numHazards: Math.floor(n/2), target: randomColor(), orbSpeed: 1 + n*0.15, powerups: [] };
    const orbs = [];
    for(let i=0;i<level.numOrbs;i++){
      orbs.push(createOrb(rand(60, ARENA.w-60), rand(60, ARENA.h-60), randomColor(), rand(0.6, 1.6)));
    }
    const hazards = [];
    for(let i=0;i<level.numHazards;i++) hazards.push(createHazard(rand(80,ARENA.w-80), rand(80,ARENA.h-80)));
    // occasional powerup spawn map (empty; spawn at runtime)
    return { levelCfg: level, orbs, hazards, powerups: [] };
  }

  // ---------- Init / Start / Reset ----------
  function resetGame() {
    const save = loadSave();
    state = {
      level: save ? (save.level || 1) : 1,
      score: save ? (save.score || 0) : 0,
      settings: save && save.settings ? save.settings : { mute:false },
      player: createPlayer(),
      world: generateLevel(save ? save.level || 1 : 1),
      time:0,
      running:true
    };
    if(state.settings.mute) muteCheckbox.checked = true;
    updateHUD();
  }

  function newLevel(){ state.level++; state.world = generateLevel(state.level); state.player.x = ARENA.w/2; state.player.y = ARENA.h/2; }

  // ---------- Input ----------
  const input = { up:false,down:false,left:false,right:false,shoot:false,mouseAngle:0 };
  window.addEventListener('keydown', e=>{
    if(e.code==='ArrowUp' || e.code==='KeyW') input.up=true;
    if(e.code==='ArrowDown' || e.code==='KeyS') input.down=true;
    if(e.code==='ArrowLeft' || e.code==='KeyA') input.left=true;
    if(e.code==='ArrowRight' || e.code==='KeyD') input.right=true;
    if(e.code==='Space') fireCollector();
  });
  window.addEventListener('keyup', e=>{
    if(e.code==='ArrowUp' || e.code==='KeyW') input.up=false;
    if(e.code==='ArrowDown' || e.code==='KeyS') input.down=false;
    if(e.code==='ArrowLeft' || e.code==='KeyA') input.left=false;
    if(e.code==='ArrowRight' || e.code==='KeyD') input.right=false;
  });

  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - offsetX)/canvasScale;
    const cy = (e.clientY - rect.top - offsetY)/canvasScale;
    input.mouseAngle = Math.atan2(cy - state.player.y, cx - state.player.x);
  });
  canvas.addEventListener('click', ()=> fireCollector());

  // ---------- Collector (shoot) ----------
  const collectors = []; // local collectors (visual sensors) that attract color
  function fireCollector(){
    if(state.player.cooldown > 0) return;
    const s = 420 + Math.random()*80;
    collectors.push({ x: state.player.x, y: state.player.y, vx: Math.cos(input.mouseAngle)*s, vy: Math.sin(input.mouseAngle)*s, r:6, life:1.0 });
    state.player.cooldown = 0.22 - (state.player.power.boost?0.1:0);
    playTone(880, 0.03, 0.08);
  }

  // ---------- Powerups spawn logic ----------
  let powerSpawnTimer = 8.0;

  // ---------- Update Loop ----------
  function update(dt){
    if(!state.running) return;
    state.time += dt;

    // player movement
    let mvx=0,mvy=0;
    if(input.left) mvx -= 1;
    if(input.right) mvx += 1;
    if(input.up) mvy -= 1;
    if(input.down) mvy += 1;
    const len = Math.max(1, Math.hypot(mvx,mvy));
    const speed = state.player.speed * (state.player.power.boost ? 1.35 : 1);
    state.player.x += (mvx/len) * speed * dt;
    state.player.y += (mvy/len) * speed * dt;
    state.player.x = clamp(state.player.x, 16, ARENA.w-16);
    state.player.y = clamp(state.player.y, 16, ARENA.h-16);

    // cooldowns
    state.player.cooldown = Math.max(0, state.player.cooldown - dt);
    if(state.player.power.magnet > 0){ state.player.power.magnet -= dt; }
    if(state.player.power.slow > 0){ state.player.power.slow -= dt; }
    if(state.player.power.boost > 0){ state.player.power.boost -= dt; }

    // update orbs
    for(const orb of state.world.orbs){
      orb.x += orb.vx * dt * state.world.levelCfg.orbSpeed;
      orb.y += orb.vy * dt * state.world.levelCfg.orbSpeed;
      if(orb.x < 20 || orb.x > ARENA.w-20) orb.vx *= -1;
      if(orb.y < 20 || orb.y > ARENA.h-20) orb.vy *= -1;
    }

    // update hazards
    for(const h of state.world.hazards){
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if(h.x < 30 || h.x > ARENA.w-30) h.vx *= -1;
      if(h.y < 30 || h.y > ARENA.h-30) h.vy *= -1;
      // collision with player -> penalty
      if(distance(h, state.player) < h.r + state.player.r){
        // penalty: lose some inventory or score
        if(state.player.inventory.length) state.player.inventory.pop();
        state.score = Math.max(0, state.score - 8);
        playTone(160, 0.04, 0.3);
      }
    }

    // update collectors
    for(let i=collectors.length-1;i>=0;i--){
      const c = collectors[i];
      c.x += c.vx * dt * (state.player.power.slow ? 0.5 : 1);
      c.y += c.vy * dt * (state.player.power.slow ? 0.5 : 1);
      c.life -= dt;
      c.r = 6 + (1 - c.life) * 20;
      if(c.life <= 0){ collectors.splice(i,1); continue; }

      // attract orbs if collector near
      for(let j=state.world.orbs.length-1;j>=0;j--){
        const orb = state.world.orbs[j];
        const d = Math.hypot(orb.x - c.x, orb.y - c.y);
        if(d < orb.r + c.r){
          // collect: push color to inventory based on orb.energy
          const stolen = mixColors(orb.color, state.player.color, 0.25);
          state.player.inventory.push({ color: stolen, energy: orb.energy });
          state.score += Math.round(5 * orb.energy);
          // visual + sound
          playTone(540, 0.04, 0.12);
          // remove orb, spawn smaller gems if energy large
          if(orb.energy > 1.2){
            for(let k=0;k<2;k++) state.world.orbs.push(createOrb(orb.x + rand(-12,12), orb.y + rand(-12,12), randomColor(), orb.energy*0.6));
          }
          state.world.orbs.splice(j,1);
          break;
        }
      }
    }

    // player magnet: pull nearby orbs
    if(state.player.power.magnet > 0){
      for(const orb of state.world.orbs){
        const d = Math.hypot(orb.x - state.player.x, orb.y - state.player.y);
        if(d < 160){ orb.x += (state.player.x - orb.x) * dt * 2.4; orb.y += (state.player.y - orb.y) * dt * 2.4; }
      }
    }

    // powerup spawns
    powerSpawnTimer -= dt;
    if(powerSpawnTimer <= 0){
      powerSpawnTimer = 10 + Math.random()*10;
      state.world.powerups.push(createPowerup(rand(60,ARENA.w-60), rand(60,ARENA.h-60), Math.random()<0.5? 'magnet':'boost'));
    }

    // collect powerups
    for(let i=state.world.powerups.length-1;i>=0;i--){
      const p = state.world.powerups[i];
      p.ttl -= dt; if(p.ttl <= 0){ state.world.powerups.splice(i,1); continue; }
      if(Math.hypot(p.x - state.player.x, p.y - state.player.y) < p.r + state.player.r){
        if(p.type === 'magnet'){ state.player.power.magnet = Math.max(state.player.power.magnet, 8); }
        else if(p.type === 'boost'){ state.player.power.boost = Math.max(state.player.power.boost, 6); }
        state.world.powerups.splice(i,1);
        playTone(720, 0.04, 0.12);
      }
    }

    // win condition: inventory combined close to target
    if(state.player.inventory.length >= Math.max(2, Math.floor(state.world.levelCfg.numOrbs/3))){
      // compute blended color
      let blended = { r:0,g:0,b:0 };
      for(const it of state.player.inventory){ blended.r += it.color.r; blended.g += it.color.g; blended.b += it.color.b; }
      blended.r /= state.player.inventory.length; blended.g /= state.player.inventory.length; blended.b /= state.player.inventory.length;
      const dist = colorDistance(blended, state.world.levelCfg.target);
      if(dist < Math.max(30, 160 - state.level*6)){
        // level clear
        playTone(1100, 0.08, 0.14);
        state.score += 50 + Math.floor(20 * state.level);
        state.player.inventory = [];
        newLevel();
        save();
      }
    }

    state.time += 0;
    updateHUD();
  }

  // ---------- Rendering ----------
  function fitCanvas(){
    const rect = canvas.getBoundingClientRect();
    canvasScale = Math.min(canvas.width/ARENA.w, canvas.height/ARENA.h);
    offsetX = (canvas.width - ARENA.w*canvasScale)/2;
    offsetY = (canvas.height - ARENA.h*canvasScale)/2;
  }

  function clearScreen(){ ctx.fillStyle = '#07111a'; ctx.fillRect(0,0,canvas.width,canvas.height); }

  function draw(){
    clearScreen();
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(canvasScale, canvasScale);

    // arena background subtle grid
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#ffffff';
    for(let gx=0; gx<ARENA.w; gx+=80) ctx.fillRect(gx,0,1,ARENA.h);
    for(let gy=0; gy<ARENA.h; gy+=80) ctx.fillRect(0,gy,ARENA.w,1);
    ctx.globalAlpha = 1;

    // powerups
    for(const p of state.world.powerups){
      ctx.beginPath(); ctx.fillStyle = p.type==='magnet'? '#8ef':'#ffd37f'; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
    }

    // orbs
    for(const orb of state.world.orbs){
      const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r*3);
      const c = rgbToCSS(orb.color);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(8,12,18,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(orb.x,orb.y,orb.r*2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(orb.x,orb.y,orb.r,0,Math.PI*2); ctx.fill();
    }

    // hazards
    for(const h of state.world.hazards){ ctx.beginPath(); ctx.fillStyle = '#ff6b6b'; ctx.arc(h.x,h.y,h.r,0,Math.PI*2); ctx.fill(); }

    // collectors
    for(const c of collectors){ ctx.beginPath(); ctx.fillStyle = 'rgba(170,230,255,0.9)'; ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill(); }

    // player
    const p = state.player;
    ctx.beginPath(); ctx.fillStyle = rgbToCSS(p.color); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle = '#07111a'; ctx.arc(p.x,p.y,p.r*0.48,0,Math.PI*2); ctx.fill();

    // HUD in-canvas: target marker
    ctx.beginPath(); ctx.strokeStyle = '#ffffff33'; ctx.lineWidth=2; ctx.rect(ARENA.w-90,12,72,32); ctx.stroke();
    ctx.fillStyle = rgbToCSS(state.world.levelCfg.target); ctx.fillRect(ARENA.w-86,16,64,24);

    ctx.restore();
  }

  // ---------- HUD / UI ----------
  function updateHUD(){
    levelLabel.innerText = state.level;
    scoreLabel.innerText = state.score;
    targetSwatch.style.background = rgbToCSS(state.world.levelCfg.target);
    playerSwatch.style.background = rgbToCSS(state.player.color);

    // inventory
    inventoryDiv.innerHTML = '';
    for(const it of state.player.inventory.slice(-8)){
      const s = document.createElement('div'); s.className='inventory-slot'; s.style.background = rgbToCSS(it.color); inventoryDiv.appendChild(s);
    }
  }

  // ---------- Audio ----------
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playTone(freq, duration=0.05, gain=0.08){
    if(!audioCtx) return; if(document.getElementById('mute').checked) return;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type='sine'; o.frequency.value = freq; g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + duration);
  }

  // ---------- Main loop ----------
  function loop(ts){
    if(!lastTs) lastTs = ts; const dt = Math.min(0.06, (ts - lastTs)/1000); lastTs = ts;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Controls binding ----------
  btnStart.addEventListener('click', ()=>{ resetGame(); lastTs=0; requestAnimationFrame(loop); });
  btnContinue.addEventListener('click', ()=>{    const s = loadSave(); if(s){ resetGame(); } else { resetGame(); }    lastTs=0; requestAnimationFrame(loop);   });
  btnReset.addEventListener('click', ()=>{ clearSave(); resetGame(); });
  muteCheckbox.addEventListener('change', ()=>{ save(); });

  // Resize handling
  function onResize(){ const r = canvas.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height; fitCanvas(); }
  window.addEventListener('resize', onResize);

  // initial fit
  function initCanvasSize(){ const container = canvas.parentElement; canvas.width = container.clientWidth - 0; canvas.height = window.innerHeight - 160; fitCanvas(); }
  initCanvasSize();

  // Start with a fresh game
  resetGame();
  requestAnimationFrame(loop);

})();
