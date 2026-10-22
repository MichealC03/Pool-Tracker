/* ---------- state ---------- */
// Starting records carried over from the previous tally (wins / games)
const SEED={players:{
  Anders:{w:9,g:40}, Mike:{w:11,g:20}, CJ:{w:15,g:52}, Ivan:{w:14,g:27},
  Chandler:{w:5,g:14}, Paige:{w:2,g:11}, Daniel:{w:0,g:1}}, games:[]};
let state={players:{},games:[]};
let db=null, signedIn=true;
let played=new Set(), winner=null, rankBy='pct';
let teams=[new Set(),new Set()], winTeam=null;

const MODES={
  cutthroat:{label:'Cutthroat',hint:'3+ players, last one standing wins.'},
  solos:{label:'Solos',hint:'1 vs 1.'},
  doubles:{label:'Doubles',hint:'2 vs 2. Both players on the winning team get the win.'}
};
// Records that existed before the tabs were added (the starting wins/games on each player)
// are counted under this mode. Games saved without a mode count here too.
const LEGACY_MODE='cutthroat';
let mode='cutthroat';
try{const m=localStorage.getItem('pool-mode');if(MODES[m])mode=m}catch(e){}
const gameMode=g=>g.mode||LEGACY_MODE;
const winnersOf=g=>g.winners||[g.winner];
function baseOf(p,m){
  if(p.b&&p.b[m])return {w:p.b[m].w||0,g:p.b[m].g||0};
  return m===LEGACY_MODE?{w:p.w||0,g:p.g||0}:{w:0,g:0};
}

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- stats ---------- */
function stats(){
  const m={};
  for(const [n,p] of Object.entries(state.players)){const b=baseOf(p,mode);m[n]={name:n,w:b.w,g:b.g}}
  for(const game of state.games){
    if(gameMode(game)!==mode)continue;
    for(const p of game.players) if(m[p]) m[p].g++;
    for(const w of winnersOf(game)) if(m[w]) m[w].w++;
  }
  const arr=Object.values(m); arr.forEach(p=>p.pct=p.g?p.w/p.g:0);
  const key=rankBy==='wins'?'w':'pct', tie=rankBy==='wins'?'pct':'w';
  arr.sort((a,b)=>b[key]-a[key]||b[tie]-a[tie]||a.g-b.g||a.name.localeCompare(b.name));
  // ranks with ties
  arr.forEach((p,i)=>{p.rank=i&&p[key]===arr[i-1][key]&&p[tie]===arr[i-1][tie]?arr[i-1].rank:i+1});
  return arr;
}
const pct=p=>p.g?Math.round(p.pct*1000)/10+'%':'—';

/* ---------- render ---------- */
function render(){
  $('logPanel').hidden=!signedIn;$('playerPanel').hidden=!signedIn;
  document.querySelector('.grid2').style.display=signedIn?'':'none';
  const s=stats(), names=Object.keys(state.players).sort((a,b)=>a.localeCompare(b));
  played=new Set([...played].filter(n=>state.players[n]));
  if(!played.has(winner)) winner=null;
  teams=teams.map(t=>new Set([...t].filter(n=>state.players[n])));
  document.querySelectorAll('.tab').forEach(b=>{const on=b.dataset.mode===mode;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});
  $('boardTitle').textContent=MODES[mode].label+' Leaderboard';
  $('histTitle').textContent='Recent '+MODES[mode].label+' Games';
  $('modeHint').textContent=MODES[mode].hint;
  $('startHint').textContent='Starting wins/games carry over an existing '+MODES[mode].label+' record.';
  const isD=mode==='doubles';
  $('singlesLog').hidden=isD;$('doublesLog').hidden=!isD;

  // leader banner
  const top=s.filter(p=>p.rank===1);
  const L=$('leader');
  if(!s.length||s.every(p=>!p.g)){
    L.innerHTML=`<div class="crown">🎱</div><div><div class="lbl">Current leader</div><div class="name">Nobody yet</div><div class="sub">Log a ${MODES[mode].label.toLowerCase()} game to get started.</div></div>`;
  }else{
    const second=s.find(p=>p.rank>1);
    const val=rankBy==='wins'?top[0].w:null;
    const gapVal=second?(rankBy==='wins'?top[0].w-second.w:Math.round((top[0].pct-second.pct)*1000)/10):0;
    L.innerHTML=`<div class="crown">👑</div>
      <div><div class="lbl">${top.length>1?'Tied for the lead':'Current leader'}</div>
      <div class="name">${esc(top.map(p=>p.name).join(' & '))}</div>
      <div class="sub">${top[0].w} wins in ${top[0].g} games · ${pct(top[0])} win rate</div></div>
      ${second&&top.length===1?`<div class="gap">+${gapVal}${rankBy==='wins'?'':' pts'}<span>ahead of ${esc(second.name)}</span></div>`:''}`;
  }

  // chips
  const chip=(cls,attr,n,on,pre='')=>`<span class="chip${cls}${on?' on':''}" role="button" tabindex="0" ${attr}="${esc(n)}">${pre}${esc(n)}</span>`;
  const none='<span class="hint">Add some players first →</span>';
  let ready=false, hint='';
  if(!isD){
    $('playedChips').innerHTML=names.length?names.map(n=>chip('','data-p',n,played.has(n))).join(''):none;
    $('winnerChips').innerHTML=played.size?[...played].map(n=>chip(' win','data-w',n,winner===n,winner===n?'🏆 ':'')).join(''):'<span class="hint">Choose who played first.</span>';
    const need=mode==='solos'?2:3;
    ready=mode==='solos'?played.size===2&&!!winner:played.size>=3&&!!winner;
    hint=played.size<need?(mode==='solos'?'Pick exactly two players.':'Pick at least three players.'):winner?`Ready: ${winner} wins.`:'Tap the winner.';
  }else{
    [0,1].forEach(i=>{$('team'+i).innerHTML=names.length?names.map(n=>chip('',`data-t${i}`,n,teams[i].has(n))).join(''):none});
    const lbl=i=>[...teams[i]].join(' & ');
    $('winTeams').innerHTML=[0,1].map(i=>`<span class="chip win${winTeam===i?' on':''}" role="button" tabindex="0" data-wt="${i}">${winTeam===i?'🏆 ':''}${teams[i].size?esc(lbl(i)):'Team '+(i+1)}</span>`).join('');
    const full=teams[0].size===2&&teams[1].size===2;
    ready=full&&winTeam!==null;
    hint=!full?'Pick two players for each team.':winTeam!==null?`Ready: ${lbl(winTeam)} win.`:'Tap the winning team.';
  }
  $('saveGame').disabled=!ready;
  $('logHint').textContent=hint;

  // leaderboard
  const max=Math.max(1,...s.map(p=>rankBy==='wins'?p.w:p.pct));
  $('board').innerHTML=s.length?`<table><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Games</th><th>Win %</th></tr></thead><tbody>`+
    s.map(p=>`<tr class="${p.rank===1&&p.g?'first':''}"><td class="rank">${p.rank}</td>
      <td class="nm">${esc(p.name)}<div class="bar"><i style="width:${((rankBy==='wins'?p.w:p.pct)/max*100).toFixed(1)}%"></i></div></td>
      <td class="w">${p.w}</td><td>${p.g}</td><td>${pct(p)}</td>
      </tr>`).join('')+'</tbody></table>'
    :'<div class="empty">No players yet.</div>';
  $('byWins').classList.toggle('on',rankBy==='wins');
  $('byPct').classList.toggle('on',rankBy==='pct');

  // history
  const fmt=t=>new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const games=state.games.filter(g=>gameMode(g)===mode);
  const line=g=>{
    const w=winnersOf(g), losers=g.players.filter(p=>!w.includes(p));
    return `<b>${esc(w.join(' & '))}</b> ${g.mode==='doubles'?'beat':'won vs'} <span class="vs">${esc(losers.join(g.mode==='doubles'?' & ':', '))}</span>`;
  };
  $('hist').innerHTML=games.length?[...games].reverse().slice(0,50).map(g=>
    `<li><span class="when">${fmt(g.t)}</span><span class="res">${line(g)}</span>
     ${signedIn?`<button class="x" title="Undo this game" data-undo="${g.id}">↶</button>`:''}</li>`).join('')
    :'<li><span class="res vs">No games logged yet.</span></li>';
}

/* ---------- events ---------- */
const act=(e,sel,fn)=>{const t=e.target.closest(sel);if(t)fn(t)};
function chipHandler(e){
  if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
  const hit=sel=>e.target.closest(sel);
  let t;
  if(t=hit('[data-p]')){const n=t.dataset.p;
    if(played.has(n))played.delete(n);else if(mode==='solos'&&played.size>=2)return;else played.add(n);
    e.preventDefault();render()}
  else if(t=hit('[data-w]')){const n=t.dataset.w;winner=winner===n?null:n;e.preventDefault();render()}
  else if(t=hit('[data-t0],[data-t1]')){
    const i=t.hasAttribute('data-t0')?0:1, n=t.dataset['t'+i];
    if(teams[i].has(n))teams[i].delete(n);
    else{teams[1-i].delete(n);if(teams[i].size>=2)return;teams[i].add(n)}
    winTeam=null;e.preventDefault();render()}
  else if(t=hit('[data-wt]')){const i=+t.dataset.wt;winTeam=winTeam===i?null:i;e.preventDefault();render()}
}
['playedChips','winnerChips','team0','team1','winTeams'].forEach(id=>['click','keydown'].forEach(ev=>$(id).addEventListener(ev,chipHandler)));

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  mode=b.dataset.mode;try{localStorage.setItem('pool-mode',mode)}catch(e){}
  played=new Set();winner=null;teams=[new Set(),new Set()];winTeam=null;render();
});

$('saveGame').onclick=()=>{
  let game,winners;
  if(mode==='doubles'){
    winners=[...teams[winTeam]];
    game={t:gameTime(),mode,players:[...teams[0],...teams[1]],team1:[...teams[0]],team2:[...teams[1]],winners,winner:winners.join(' & ')};
  }else{
    winners=[winner];
    game={t:gameTime(),mode,players:[...played],winner,winners};
  }
  try{db.collection('pool_games').add(game).catch(fail)}catch(e){fail(e);return}
  celebrate(winners);
  whenTouched=false;setNow();
  winner=null;winTeam=null;
  if(mode==='doubles')teams=[new Set(),new Set()];
  render();
};
function addPlayer(){
  const n=$('newName').value.trim();
  if(!n)return;
  if(Object.keys(state.players).some(x=>x.toLowerCase()===n.toLowerCase())){$('newName').select();return}
  const g=Math.max(0,parseInt($('newG').value)||0), w=Math.min(g,Math.max(0,parseInt($('newW').value)||0));
  const doc=mode===LEGACY_MODE?{name:n,w,g}:{name:n,w:0,g:0,b:{[mode]:{w,g}}};
  db.collection('pool_players').doc(n).set(doc).catch(fail);
  $('newName').value='';$('newW').value=0;$('newG').value=0;$('newName').focus();
}
$('addPlayer').onclick=addPlayer;
$('newName').addEventListener('keydown',e=>{if(e.key==='Enter')addPlayer()});
$('hist').addEventListener('click',e=>act(e,'[data-undo]',t=>{
  db.collection('pool_games').doc(t.dataset.undo).delete().catch(fail);
}));
$('byWins').onclick=()=>{rankBy='wins';render()};
$('byPct').onclick=()=>{rankBy='pct';render()};

$('exportBtn').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
  a.download='pool-tracker.json';a.click();URL.revokeObjectURL(a.href);
};

/* ---------- Firebase ---------- */
const SEED_STAMP='pool-seeded';
function setConn(st,txt){$('connDot').className=st;$('connText').textContent=txt}
function fail(e){console.error(e);alert(e.code==='permission-denied'?'You need to sign in to make changes.':'Save failed: '+(e.message||e))}

async function seedIfEmpty(){
  const ref=db.collection('meta').doc('poolSeed');
  const go=await db.runTransaction(async tx=>{const d=await tx.get(ref);if(d.exists)return false;tx.set(ref,{done:true});return true});
  if(!go)return;
  const b=db.batch();
  Object.entries(SEED.players).forEach(([n,v])=>b.set(db.collection('pool_players').doc(n),{name:n,w:v.w,g:v.g}));
  await b.commit();
}
function initFirebase(){
  try{
    if(!firebaseConfig.apiKey||firebaseConfig.apiKey.includes('PASTE_YOUR')){setConn('error','Add your Firebase keys in firebase-config.js');return}
    firebase.initializeApp(firebaseConfig);
    db=firebase.firestore();
    db.collection('pool_players').onSnapshot(snap=>{
      if(snap.empty){seedIfEmpty().catch(console.error);}
      state.players={};snap.docs.forEach(d=>{const v=d.data();state.players[d.id]={w:v.w||0,g:v.g||0,b:v.b||null}});
      setConn('live','Synced');render();
    },e=>{console.error(e);setConn('error','Sync error')});
    db.collection('pool_games').orderBy('t').onSnapshot(snap=>{
      state.games=snap.docs.map(d=>({id:d.id,...d.data()}));render();
    },e=>{console.error(e);setConn('error','Sync error')});
  }catch(e){console.error(e);setConn('error','Check firebase-config.js')}
}

render();
initFirebase();

/* ---------- celebration ---------- */
function celebrate(winners){
  const who=winners.join(' & ');
  const cj=winners.some(w=>w.trim().toLowerCase()==='cj');
  const layer=document.createElement('div');
  layer.className='fx';document.body.appendChild(layer);
  const colors=['#f2c14e','#e4574b','#4cd77a','#4aa3ff','#c77dff','#ff9f43','#ffffff'];
  const n=cj?40:110;
  for(let i=0;i<n;i++){
    const p=document.createElement('span');
    const dur=2.4+Math.random()*2, delay=Math.random()*.6, x=Math.random()*100, drift=(Math.random()-.5)*200, rot=(Math.random()*900-450)|0;
    p.style.cssText=`left:${x}vw;animation-duration:${dur}s;animation-delay:${delay}s;--dx:${drift}px;--rot:${rot}deg`;
    if(cj){p.className='trash';p.textContent='💩';p.style.fontSize=(28+Math.random()*34)+'px'}
    else{p.className='conf';const w=6+Math.random()*8;p.style.width=w+'px';p.style.height=w*(.5+Math.random())+'px';p.style.background=colors[i%colors.length]}
    layer.appendChild(p);
  }
  const m=document.createElement('div');m.className='fxmsg';m.textContent=who+' Won!';layer.appendChild(m);
  setTimeout(()=>layer.remove(),6000);
}


/* ---------- game time (defaults to now, adjustable) ---------- */
let whenTouched=false;
const pad=n=>String(n).padStart(2,'0');
const toDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toTime=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
function whenValue(){
  const d=new Date(`${$('gDate').value}T${$('gTime').value||'00:00'}`);
  return isNaN(d)?new Date():d;
}
function gameTime(){return whenValue().getTime()}
function showWhen(){
  const d=whenValue(),now=new Date(),days=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
  const time=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  const day=days===0?'Today':days===1?'Yesterday':d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
  $('whenLabel').textContent=whenTouched?`Logged as ${day}, ${time}.`:`Using the current time, rounded down to 5 min (${time}).`;
}
function setNow(){const d=new Date();d.setMinutes(d.getMinutes()-d.getMinutes()%5,0,0);$('gDate').value=toDate(d);$('gTime').value=toTime(d);showWhen()}
['gDate','gTime'].forEach(id=>$(id).addEventListener('input',()=>{whenTouched=true;showWhen()}));
$('whenNow').onclick=()=>{whenTouched=false;setNow()};
document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>{
  const d=whenValue();d.setMinutes(d.getMinutes()+(+b.dataset.nudge));
  $('gDate').value=toDate(d);$('gTime').value=toTime(d);whenTouched=true;showWhen();
});
setNow();
setInterval(()=>{if(!whenTouched)setNow()},20000);