/* Living pool-table background: balls get broken, rolled, and potted. */
(function(){
  const cv=document.getElementById('bg'), ctx=cv.getContext('2d');
  const reduced=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS=['#f5c518','#1f4fd8','#d62828','#5b2a9b','#f07a14','#0f8a3c','#7a1f1f','#111111'];
  const INSET=12;                       // matches the wooden rail frame
  let W=0,H=0,R=24,PR=40,pockets=[],balls=[],sinking=[],cue=null;
  let phase='rest',phaseT=0,shot=null,reracking=false,cueRespawn=0;
  let effects=[],shotsSinceCorner=0,restFor=3.5,eightWait=0;
  const TS=.5;                         // global slow-motion factor: keeps it a calm background piece

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    R=Math.max(15,Math.min(30,Math.min(W,H)*.035));PR=R*1.55;
    const L=INSET,T=INSET,Rt=W-INSET,B=H-INSET;
    pockets=[[L,T],[Rt,T],[L,B],[Rt,B],[W/2,T],[W/2,B]].map(([x,y],i)=>({x,y,r:R*(i<4?1.85:1.55)}));
    [...balls,cue].forEach(b=>{if(!b)return;b.x=Math.min(Rt-R,Math.max(L+R,b.x));b.y=Math.min(B-R,Math.max(T+R,b.y))});
    if(reduced)draw();
  }

  function mk(n,x,y){return {n,x,y,vx:0,vy:0,a:Math.random()*6.28,alpha:0,scale:1}}
  function rack(){
    const fx=W*.7,fy=H*.5,dx=R*Math.sqrt(3)+.6,nums=[1,2,3,4,5,6,7,9,10,11,12,13,14,15].sort(()=>Math.random()-.5);
    nums.splice(4,0,8);               // 8-ball in the middle of the third row
    balls=[];let k=0;
    for(let row=0;row<5;row++)for(let j=0;j<=row;j++)balls.push(mk(nums[k++],fx+row*dx,fy+(j-row/2)*(2*R+.6)));
    reracking=true;
  }
  function placeCue(){
    for(let t=0;t<40;t++){
      const x=t?INSET+R+Math.random()*(W*.5):W*.22,y=t?INSET+R+Math.random()*(H-2*INSET-2*R):H/2;
      if(balls.every(b=>Math.hypot(b.x-x,b.y-y)>R*2.4)){cue=mk(0,x,y);return}
    }
    cue=mk(0,W*.2,H/2);
  }

  /* ---- physics ---- */
  function step(dt){
    dt*=TS;
    let all=cue?[...balls,cue]:[...balls];
    let vmax=0;all.forEach(b=>{vmax=Math.max(vmax,Math.hypot(b.vx,b.vy))});
    const n=Math.max(1,Math.ceil(vmax*dt/(R*.025))),h=dt/n;
    for(let s=0;s<n;s++){
      all.forEach(b=>{b.x+=b.vx*h;b.y+=b.vy*h;b.a+=Math.hypot(b.vx,b.vy)*h/R*.4});
      const L=INSET+R,Rt=W-INSET-R,T=INSET+R,B=H-INSET-R;
      all.forEach(b=>{
        const e=.9;
        if(b.x<L){b.x=L;b.vx=Math.abs(b.vx)*e}else if(b.x>Rt){b.x=Rt;b.vx=-Math.abs(b.vx)*e}
        if(b.y<T){b.y=T;b.vy=Math.abs(b.vy)*e}else if(b.y>B){b.y=B;b.vy=-Math.abs(b.vy)*e}
      });
      for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
        const a=all[i],b=all[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
        if(d>=2*R||d===0)continue;
        const nx=dx/d,ny=dy/d,ov=2*R-d;
        a.x-=nx*ov/2;a.y-=ny*ov/2;b.x+=nx*ov/2;b.y+=ny*ov/2;
        const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(rv<0){const j2=-rv*.97;a.vx-=j2*nx;a.vy-=j2*ny;b.vx+=j2*nx;b.vy+=j2*ny}
      }
      // pockets
      for(const b of all){
        for(const p of pockets){
          if(Math.hypot(b.x-p.x,b.y-p.y)<p.r*.9){sink(b,p);all=all.filter(x=>x!==b);break}
        }
      }
    }
    // friction
    const f=Math.exp(-.55*dt);
    all.forEach(b=>{
      let v=Math.hypot(b.vx,b.vy);if(!v)return;
      v=v*f-95*dt;
      if(v<6){b.vx=b.vy=0}else{const k=v/Math.hypot(b.vx,b.vy);b.vx*=k;b.vy*=k}
    });
  }
  function sink(b,p){
    if(b.sunk)return;b.sunk=true;
    if(b===cue){cue=null;cueRespawn=1.3}
    else{
      const i=balls.indexOf(b);if(i>=0)balls.splice(i,1);
      // the 8-ball only goes last: if it drops early it gets spotted again
      if(b.n===8&&balls.length>0)eightWait=1.6;
    }
    sinking.push({n:b.n,x:b.x,y:b.y,px:p.x,py:p.y,a:b.a,t:0});
    if(pockets.indexOf(p)<4)effects.push({x:p.x,y:p.y,t:0});
  }
  const moving=()=>[...balls,cue].some(b=>b&&(b.vx||b.vy));

  /* ---- shot planning: aim the cue ball at a ghost ball so it pots something ---- */
  function planShot(breaking){
    if(!cue)return null;
    if(breaking||!balls.length){
      const t=balls[0]||{x:W*.7,y:H/2};
      return {ang:Math.atan2(H/2-cue.y,t.x-cue.x)+(Math.random()-.5)*.04,power:2300};
    }
    const opts=[];
    // the 8-ball is only a target once it is the last ball left
    const targets=balls.filter(t=>t.n!==8);const aimAt=targets.length?targets:balls;
    for(const t of aimAt)for(const p of pockets){
      const tx=p.x-t.x,ty=p.y-t.y,td=Math.hypot(tx,ty);
      const gx=t.x-tx/td*2*R,gy=t.y-ty/td*2*R;
      const cx=gx-cue.x,cy=gy-cue.y,cd=Math.hypot(cx,cy);
      if(cd<R*2||gx<INSET+R||gx>W-INSET-R||gy<INSET+R||gy>H-INSET-R)continue;
      const cut=(cx*tx+cy*ty)/(cd*td);if(cut<.7)continue;
      // reject if another ball sits on the cue->ghost line
      let blocked=false;
      for(const o of balls){if(o===t)continue;
        const ox=o.x-cue.x,oy=o.y-cue.y,pr=(ox*cx+oy*cy)/cd;
        if(pr>0&&pr<cd&&Math.abs(ox*cy-oy*cx)/cd<R*2){blocked=true;break}}
      // ...and the object ball's route to the pocket must be clear too
      for(const o of balls){if(o===t||blocked)continue;
        const ox=o.x-t.x,oy=o.y-t.y,pr=(ox*tx+oy*ty)/td;
        if(pr>0&&pr<td&&Math.abs(ox*ty-oy*tx)/td<R*2.1)blocked=true}
      if(blocked)continue;
      opts.push({corner:pockets.indexOf(p)<4,ang:Math.atan2(cy,cx),score:cut-cd/(W+H)*.5+Math.random()*.25,power:Math.min(1900,650+cd*1.5+td*.8)});
    }
    if(!opts.length){const t=aimAt[(Math.random()*aimAt.length)|0];
      return {ang:Math.atan2(t.y-cue.y,t.x-cue.x),power:900+Math.random()*700}}
    // every so often go for a corner pocket: a real cut shot, no tricks
    const corners=opts.filter(o=>o.corner);
    const wantCorner=corners.length&&(Math.random()<.35||shotsSinceCorner>=4);
    const pool=wantCorner?corners:opts;
    shotsSinceCorner=wantCorner?0:shotsSinceCorner+1;
    pool.sort((a,b)=>b.score-a.score);
    const o=pool[0];// most attempts are dead on; some are slightly off so they miss now and then
    o.ang+=(Math.random()-.5)*(Math.random()<.3?.07:.003);return o;
  }

  /* ---- drawing ---- */
  function drawBall(b,alpha,scale){
    const r=R*scale;if(r<1)return;
    ctx.save();ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.ellipse(b.x+r*.28,b.y+r*.36,r,r*.92,0,0,6.283);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fill();
    ctx.translate(b.x,b.y);
    ctx.save();ctx.beginPath();ctx.arc(0,0,r,0,6.283);ctx.clip();
    const n=b.n,col=n===0?'#f6f3e8':COLORS[(n-1)%8];
    ctx.fillStyle=(n>8)?'#f6f3e8':col;ctx.fillRect(-r,-r,2*r,2*r);
    ctx.rotate(b.a);
    if(n>8){ctx.fillStyle=col;ctx.fillRect(-r,-r*.52,2*r,r*1.04)}
    if(n>0){ctx.beginPath();ctx.arc(r*.28,0,r*.42,0,6.283);ctx.fillStyle='#fff';ctx.fill();
      ctx.fillStyle='#111';ctx.font='700 '+(r*.5)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(n,r*.28,r*.03)}
    ctx.rotate(-b.a);
    const g=ctx.createRadialGradient(-r*.35,-r*.4,r*.05,0,0,r*1.05);
    g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.22,'rgba(255,255,255,.12)');g.addColorStop(.6,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.5)');
    ctx.fillStyle=g;ctx.fillRect(-r,-r,2*r,2*r);
    ctx.restore();ctx.restore();
  }
  function drawPockets(){
    for(const p of pockets){
      const g=ctx.createRadialGradient(p.x,p.y,p.r*.2,p.x,p.y,p.r*1.15);
      g.addColorStop(0,'#000');g.addColorStop(.78,'#020a05');g.addColorStop(.9,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.15,0,6.283);ctx.fill();
    }
  }
  function drawCue(t){
    if(!cue||!shot)return;
    const k=Math.min(1,phaseT/1.4),pull=Math.sin(Math.min(k,.8)/.8*Math.PI*.5)*R*2.6-(k>.8?(k-.8)/.2*R*2.6:0);
    const ux=Math.cos(shot.ang),uy=Math.sin(shot.ang),gap=R*1.2+pull,len=Math.max(W,H)*.32;
    ctx.save();ctx.globalAlpha=.9;
    // aim line
    ctx.setLineDash([6,10]);ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(cue.x+ux*R,cue.y+uy*R);ctx.lineTo(cue.x+ux*R*14,cue.y+uy*R*14);ctx.stroke();ctx.setLineDash([]);
    // stick
    const x0=cue.x-ux*gap,y0=cue.y-uy*gap,x1=x0-ux*len,y1=y0-uy*len;
    const g=ctx.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#f1d9a5');g.addColorStop(.35,'#d9a85b');g.addColorStop(1,'#4a2c14');
    ctx.strokeStyle=g;ctx.lineCap='round';ctx.lineWidth=R*.32;
    ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
    ctx.strokeStyle='#5aa9d8';ctx.lineWidth=R*.34;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0-ux*R*.25,y0-uy*R*.25);ctx.stroke();
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    drawPockets();
    for(const b of balls)drawBall(b,Math.min(1,b.alpha),1);
    if(cue)drawBall(cue,Math.min(1,cue.alpha),1);
    for(const s of sinking){
      const k=Math.min(1,s.t/.4);
      drawBall({n:s.n,x:s.x+(s.px-s.x)*k,y:s.y+(s.py-s.y)*k,a:s.a},1-k,1-k*.7);
    }
    if(phase==='aim')drawCue();
    for(const e of effects){
      const k=e.t/1.1,rr=PR*(.9+k*1.9);
      ctx.save();ctx.globalAlpha=(1-k)*(e.big?.9:.55);
      ctx.strokeStyle='#ffe28a';ctx.lineWidth=(e.big?5:3)*(1-k)+1;
      ctx.beginPath();ctx.arc(e.x,e.y,rr,0,6.283);ctx.stroke();
      if(e.big){ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(e.x,e.y,rr*.7,0,6.283);ctx.stroke()}
      ctx.restore();
    }
  }

  /* ---- loop ---- */
  let last=0;
  function frame(ts){
    requestAnimationFrame(frame);
    if(document.hidden){last=0;return}
    const dt=Math.min(.033,last?(ts-last)/1000:.016);last=ts;
    [...balls,cue].forEach(b=>{if(b&&b.alpha<1)b.alpha+=dt*2.5});
    sinking.forEach(s=>s.t+=dt);sinking=sinking.filter(s=>s.t<.4);
    effects.forEach(e=>e.t+=dt);effects=effects.filter(e=>e.t<1.1);
    if(phase==='live'){
      step(dt);
      if(!moving()){phase='rest';phaseT=0}
    }else{
      phaseT+=dt;
      if(!cue){cueRespawn-=dt;if(cueRespawn<=0&&!moving())placeCue()}
      if(eightWait>0){eightWait-=dt;if(eightWait<=0&&!moving()){
        const e=mk(8,0,0);e.alpha=0;
        for(let t=0;t<60;t++){
          const x=t?INSET+R+Math.random()*(W-2*INSET-2*R):W*.7,y=t?INSET+R+Math.random()*(H-2*INSET-2*R):H/2;
          if([...balls,cue].every(b=>!b||Math.hypot(b.x-x,b.y-y)>R*2.4)&&pockets.every(p=>Math.hypot(p.x-x,p.y-y)>p.r*1.5)){e.x=x;e.y=y;break}
        }
        balls.push(e);eightWait=0;
      }else if(eightWait<=0)eightWait=.3}
      if(phase==='rest'&&cue&&phaseT>(reracking?2:restFor)){
        if(!balls.length&&!eightWait){rack();placeCue();phaseT=-.4;shot=null;draw();return}
        restFor=3.2+Math.random()*2.6;
        shot=planShot(reracking);phase='aim';phaseT=0;
      }else if(phase==='aim'&&phaseT>1.4){
        cue.vx=Math.cos(shot.ang)*shot.power;cue.vy=Math.sin(shot.ang)*shot.power;
        reracking=false;phase='live';
      }
    }
    draw();
  }

  addEventListener('resize',resize);
  resize();rack();placeCue();
  balls.forEach(b=>b.alpha=1);cue.alpha=1;
  if(reduced){draw();return}
  phaseT=0;requestAnimationFrame(frame);
})();