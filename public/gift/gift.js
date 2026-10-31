/*! Giftpage renderer — shared by the builder preview, the hosted viewer (/g/:slug) and the demo.
 *  renderGift(G, opts)
 *    G     gift data (see server/sanitize.js for the shape)
 *    opts  { serverNow:number, loadFull:async()=>fullG|null, footerHTML:string }
 */
(function(){
var PLACEHOLDER_PAIRS=[[14,340],[205,262],[42,8],[160,198],[282,322],[30,58],[352,22],[220,182],[96,140],[315,270]];
function placeholder(i){var a=PLACEHOLDER_PAIRS[i%10][0],b=PLACEHOLDER_PAIRS[i%10][1],sx=28+(i*37)%44,sy=24+(i*53)%28;
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+a+' 72% 70%)"/><stop offset="1" stop-color="hsl('+b+' 55% 42%)"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="'+sx*4+'" cy="'+sy*5+'" r="58" fill="hsl(45 100% 88%)" opacity=".85"/><path d="M0 390 Q 110 '+(300+(i%4)*20)+' 220 370 T 400 '+(330+(i%3)*25)+' V500 H0Z" fill="rgba(0,0,0,.18)"/><path d="M0 440 Q 140 400 260 445 T 400 430 V500 H0Z" fill="rgba(0,0,0,.22)"/></svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
var PLACEHOLDERS=[];for(var pi_=0;pi_<12;pi_++)PLACEHOLDERS.push(placeholder(pi_));
window.GIFT_PLACEHOLDERS=PLACEHOLDERS;

window.renderGift=function(G,opts){
opts=opts||{};
var NAME=G.name||'';
var skew=opts.serverNow?opts.serverNow-Date.now():0;
function now(){return Date.now()+skew}
function T(s){return String(s==null?'':s).replace(/\{name\}/g,NAME).replace(/\{date\}/g,(G.unlock&&G.unlock.long)||'')}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function t(s){return esc(T(s))}
function ph(i){var P=(G.photos&&G.photos.length)?G.photos:PLACEHOLDERS;return P[((i%P.length)+P.length)%P.length]}
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed){var s=seed%2147483647||7;return function(){s=s*16807%2147483647;return (s-1)/2147483646}}
function onVisible(el,cb,th){var io=new IntersectionObserver(function(es){es.forEach(function(e){cb(e.isIntersecting)})},{threshold:th||0});io.observe(el)}
document.title='Happy birthday, '+NAME;

var B={}, I={};

/* ---- age ---- */
B.age=function(){var a=G.age;return '<section id="s-age" class="s-age" aria-label="Age reveal"><div><p class="age-above">'+t(a.above)+'</p><p class="age-num display">'+(reduce?(+a.age||0):0)+'</p><p class="age-below">'+t(a.below)+'</p></div></section>'};
I.age=function(sec){var el=sec.querySelector('.age-num'),to=+G.age.age||0,done=false;
  onVisible(sec,function(v){if(!v||done||reduce)return;done=true;var t0=performance.now(),d=1700;
    (function step(n){var k=Math.min(1,(n-t0)/d),e=1-Math.pow(1-k,4);el.textContent=Math.round(to*e);if(k<1)requestAnimationFrame(step)})(t0)},.45)};

/* ---- happy birthday ---- */
B.birthday=function(){var b=G.birthday;return '<section id="s-birthday" class="s-bday" aria-label="Happy birthday"><div class="bday-text"><p class="bday-date">'+t(b.date)+'</p><h1 class="bday-h display"><span class="l1">'+t(b.first)+'</span><span class="l2">'+t(b.second)+'</span><span class="nm">'+esc(NAME)+'</span></h1><div class="bday-rule"></div><p class="bday-wish">'+t(b.wish)+'</p></div><div class="ribbon" aria-hidden="true"></div></section>'};
I.birthday=function(sec){
  var layer=sec.querySelector('.ribbon'),NS='http://www.w3.org/2000/svg';
  var svg=document.createElementNS(NS,'svg');svg.setAttribute('style','position:absolute;width:0;height:0');
  var path=document.createElementNS(NS,'path');
  path.setAttribute('d','M -90 505 C 120 510, 300 495, 430 450 C 560 405, 655 330, 645 230 C 635 130, 520 100, 470 170 C 420 245, 475 360, 605 400 C 735 440, 880 300, 1090 205');
  svg.appendChild(path);layer.appendChild(svg);
  var L=path.getTotalLength(),N=Math.max(24,Math.min(32,((G.photos&&G.photos.length)||PLACEHOLDERS.length)*2)),tiles=[];
  for(var i=0;i<N;i++){var d=document.createElement('div');d.className='tile';d.innerHTML='<img alt="" src="'+ph(i)+'">';layer.appendChild(d);tiles.push(d)}
  var w,h,size,off=0,last=0,vis=false,paused=false;
  function measure(){w=layer.clientWidth;h=layer.clientHeight;size=Math.max(40,Math.min(78,w*.056));layer.style.setProperty('--t',size+'px')}
  function place(){var sx=w/1000,sy=h/600;
    for(var i=0;i<N;i++){var s=(i*L/N+off)%L,p=path.getPointAtLength(s),q=path.getPointAtLength(Math.min(L,s+3));
      var a=Math.atan2((q.y-p.y)*sy,(q.x-p.x)*sx);
      tiles[i].style.transform='translate('+(p.x*sx-size/2)+'px,'+(p.y*sy-size/2)+'px) rotate('+a+'rad)'}}
  function loop(n){if(vis&&!paused&&!reduce){off=(off+(n-(last||n))*.028)%L;place()}last=n;requestAnimationFrame(loop)}
  measure();place();addEventListener('resize',function(){measure();place()});
  layer.addEventListener('mouseenter',function(){paused=true});layer.addEventListener('mouseleave',function(){paused=false});
  onVisible(sec,function(v){vis=v});requestAnimationFrame(loop)};

/* ---- polaroids ---- */
var FLOW=[['#f7a8c4','#f2c14e'],['#ffcfae','#e0703f'],['#cbb8f4','#ffd977'],['#fffaf2','#f2a20c'],['#ff8fa3','#ffe3a3'],['#ffe27a','#c9792a']];
function flower(x,y,s,c,rot){var p='';for(var i=0;i<5;i++)p+='<ellipse cx="0" cy="-8.5" rx="5.8" ry="9" transform="rotate('+(i*72)+')" fill="'+c[0]+'" stroke="rgba(120,60,60,.18)" stroke-width=".6"/>';
  return '<g transform="translate('+x+' '+y+') rotate('+(rot||0)+') scale('+s+')">'+p+'<circle r="4.4" fill="'+c[1]+'"/><circle r="1.6" cx="-1.2" cy="-1.2" fill="rgba(255,255,255,.55)"/></g>'}
function leaf(x,y,rot,s){return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+(11*s)+'" ry="'+(4.6*s)+'" transform="rotate('+rot+' '+x+' '+y+')" fill="'+(rot%2?'#7fa865':'#6a9556')+'"/>'}
function sprig(seed){var r=rng(seed),h='',c1=FLOW[seed%FLOW.length],c2=FLOW[(seed+2)%FLOW.length],c3=FLOW[(seed+4)%FLOW.length];
  var tips=[[38+r()*10,72],[100+r()*10,58],[70+r()*8,22]];
  tips.forEach(function(tp){var mx=(70+tp[0])/2+(r()*20-10);h+='<path d="M70 222 Q'+mx+' '+(tp[1]+70)+' '+tp[0]+' '+tp[1]+'" stroke="#6a9556" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    h+=leaf((70+tp[0])/2+(tp[0]<70?-6:6),(tp[1]+222)/2,tp[0]<70?-35:35,1.1)});
  h+=leaf(62,190,-48,1)+leaf(80,176,44,1);
  h+=flower(tips[0][0],tips[0][1],1.25,c1,r()*60)+flower(tips[1][0],tips[1][1],1.05,c2,r()*60)+flower(tips[2][0],tips[2][1],1.45,c3,r()*60);
  h+='<circle cx="'+(tips[0][0]+16)+'" cy="'+(tips[0][1]+30)+'" r="4" fill="'+c2[0]+'"/><circle cx="'+(tips[1][0]-14)+'" cy="'+(tips[1][1]+34)+'" r="3.4" fill="'+c1[0]+'"/>';
  return '<svg viewBox="0 0 140 225" aria-hidden="true">'+h+'</svg>'}
function bloom(seed){var c=FLOW[seed%FLOW.length],d=FLOW[(seed+3)%FLOW.length];
  return '<svg viewBox="0 0 70 56" aria-hidden="true">'+leaf(20,40,-30,1)+leaf(50,42,25,1)+flower(24,26,1.1,c,10)+flower(46,22,.85,d,40)+'<circle cx="38" cy="42" r="3" fill="'+d[0]+'"/></svg>'}
var BFLY=[['#ff9eb5','#ffd0dc'],['#ffb347','#ffdc9a'],['#8fb8ff','#cfe0ff'],['#c79bff','#e6d4ff'],['#7fd1b9','#c4f0e2'],['#ff7b6b','#ffc0a8']];
function butterfly(c){var wing='<path d="M0 -1 C-7 -21 -29 -27 -27 -9 C-26 2 -12 4 0 1Z" fill="'+c[0]+'" stroke="#3a2a3a" stroke-width=".9"/><path d="M0 1 C-10 3 -23 11 -17 20 C-11 25 -3 14 0 3Z" fill="'+c[1]+'" stroke="#3a2a3a" stroke-width=".9"/><circle cx="-17" cy="-11" r="2.6" fill="#fff" opacity=".8"/><circle cx="-10" cy="12" r="1.8" fill="#fff" opacity=".7"/>';
  return '<svg viewBox="-30 -26 60 52" aria-hidden="true"><g class="wing">'+wing+'</g><g transform="scale(-1 1)"><g class="wing">'+wing+'</g></g><ellipse rx="1.9" ry="10" fill="#2b2230"/><path d="M-.5 -9 Q-4 -18 -7 -21 M.5 -9 Q4 -18 7 -21" stroke="#2b2230" stroke-width=".9" fill="none" stroke-linecap="round"/></svg>'}
B.polaroids=function(){var p=G.polaroids,r=rng(11),caps=p.items.length?p.items:[''],h='',deco='';
  caps.forEach(function(c,i){var bl=p.flowers&&i%2===0?'<span class="pol-bloom '+(i%4===0?'tr':'bl')+'">'+bloom(i+1)+'</span>':'';
    h+='<figure class="pol" style="--r:'+((r()*12-6).toFixed(1))+'deg">'+bl+'<img alt="" src="'+ph(i)+'"><figcaption class="hand">'+t(c)+'</figcaption></figure>'});
  if(p.flowers){[['left:-14px;bottom:-12px',-14,1],['right:-14px;bottom:-12px',14,2],['left:-30px;top:-20px',156,3],['right:-30px;top:-20px',-156,4],['left:-24px;top:42%',62,5],['right:-24px;top:50%',-62,6]].forEach(function(o,i){
    deco+='<div class="sprig" style="'+o[0]+';--rot:'+o[1]+'deg;animation-delay:-'+(i*1.3).toFixed(1)+'s">'+sprig(o[2])+'</div>'})}
  return '<section id="s-polaroids" class="s-pol" aria-label="Polaroid wall">'+deco+'<h2 class="pol-title display">'+t(p.title)+'</h2><p class="pol-sub">Drag them around.</p><div class="pol-board">'+h+'</div>'+(p.butterflies?'<div class="bfly-layer" aria-hidden="true"></div>':'')+'</section>'};
I.polaroids=function(sec){var z=10;
  sec.querySelectorAll('.pol').forEach(function(el){var x=0,y=0,sx,sy,on=false;
    el.addEventListener('pointerdown',function(e){on=true;sx=e.clientX-x;sy=e.clientY-y;el.setPointerCapture(e.pointerId);el.classList.add('drag');el.style.zIndex=++z});
    el.addEventListener('pointermove',function(e){if(!on)return;x=e.clientX-sx;y=e.clientY-sy;el.style.setProperty('--x',x+'px');el.style.setProperty('--y',y+'px')});
    function up(){on=false;el.classList.remove('drag')}
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)});
  var layer=sec.querySelector('.bfly-layer');if(!layer)return;
  /* butterflies: wander between random spots and polaroid corners, rest a moment, and flutter away from the pointer */
  var n=Math.max(1,Math.min(14,+G.polaroids.count||7)),r=rng(77),W=0,H=0,bs=[],px=null,py=null,vis=false,last=0;
  function size(){W=sec.clientWidth;H=sec.clientHeight}size();addEventListener('resize',size);
  function pickTarget(b){var pols=sec.querySelectorAll('.pol');
    if(pols.length&&Math.random()<.45){var sr=sec.getBoundingClientRect(),pr=pols[Math.floor(Math.random()*pols.length)].getBoundingClientRect();
      b.tx=pr.left-sr.left+pr.width*(.15+Math.random()*.7);b.ty=pr.top-sr.top+6;b.land=true}
    else{b.tx=40+Math.random()*(W-80);b.ty=60+Math.random()*(H-120);b.land=false}}
  for(var i=0;i<n;i++){var el=document.createElement('div');el.className='bfly';el.style.setProperty('--b',(W<600?38+r()*14:48+r()*22).toFixed(0)+'px');
    el.innerHTML=butterfly(BFLY[i%BFLY.length]);el.querySelectorAll('.wing').forEach(function(w){w.style.animationDelay='-'+(r()*.2).toFixed(2)+'s'});
    layer.appendChild(el);var b={el:el,half:parseFloat(el.style.getPropertyValue('--b'))/2,x:r()*W,y:80+r()*(H-160),a:r()*6.28,v:1.2+r()*.8,rest:0,ph:r()*6.28};pickTarget(b);bs.push(b)}
  function draw(b,t){var bob=b.rest?0:Math.sin(t/260+b.ph)*5;var deg=b.rest?(b.restDeg||0):b.a*57.3+90;
    b.el.style.transform='translate('+(b.x-b.half).toFixed(1)+'px,'+(b.y-b.half+bob).toFixed(1)+'px) rotate('+deg.toFixed(1)+'deg)'}
  if(reduce){bs.forEach(function(b){b.rest=1;b.restDeg=(Math.random()*40-20);b.el.classList.add('rest');draw(b,0)});return}
  sec.addEventListener('pointermove',function(e){var sr=sec.getBoundingClientRect();px=e.clientX-sr.left;py=e.clientY-sr.top});
  sec.addEventListener('pointerleave',function(){px=py=null});
  function loop(t){var dt=Math.min(50,t-(last||t))/16.7;last=t;
    if(vis)bs.forEach(function(b){
      var fleeing=px!==null&&Math.hypot(b.x-px,b.y-py)<110;
      if(b.rest>0&&!fleeing){b.rest-=dt;if(b.rest<=0){b.rest=0;b.el.classList.remove('rest');pickTarget(b)}draw(b,t);return}
      if(b.rest>0){b.rest=0;b.el.classList.remove('rest')}
      var want;
      if(fleeing){want=Math.atan2(b.y-py,b.x-px);b.v=Math.min(4.2,b.v+.25*dt)}
      else{var dx=b.tx-b.x,dy=b.ty-b.y,d=Math.hypot(dx,dy);want=Math.atan2(dy,dx)+Math.sin(t/420+b.ph)*.6;b.v+=((d<80?.8:1.7)-b.v)*.04*dt;
        if(d<12){if(b.land||Math.random()<.3){b.rest=90+Math.random()*120;b.restDeg=Math.random()*50-25;b.el.classList.add('rest')}else pickTarget(b)}}
      var diff=Math.atan2(Math.sin(want-b.a),Math.cos(want-b.a));b.a+=diff*(fleeing?.25:.06)*dt;
      b.x+=Math.cos(b.a)*b.v*dt;b.y+=Math.sin(b.a)*b.v*dt;
      if(b.x<-30||b.x>W+30||b.y<-30||b.y>H+30){b.x=Math.max(-30,Math.min(W+30,b.x));b.y=Math.max(-30,Math.min(H+30,b.y));pickTarget(b)}
      draw(b,t)});
    requestAnimationFrame(loop)}
  bs.forEach(function(b){draw(b,0)});onVisible(sec,function(v){vis=v;last=0});requestAnimationFrame(loop)};

/* ---- sketchbook ---- */
var STICK=['🌸','⭐','🎀','🍒','🦋','💌','🌷','✨','🍓','🐱','🧸','💐'];
var PAPERS=['paper-lined','paper-grid','paper-kraft','paper-dots'];
var LAYOUTS=[
  {p:[[8,7,44,-5],[47,40,42,4]],q:[6,70,46,-2],s:[[72,8],[34,52]]},
  {p:[[32,6,50,3],[54,56,36,-6]],q:[7,58,48,2],s:[[8,9],[82,46]]},
  {p:[[9,28,40,-3],[52,10,40,5]],q:[44,72,50,-3],s:[[14,7],[62,58]]}];
B.sketchbook=function(){var s=G.sketchbook,quotes=s.items.length?s.items:['always you'],r=rng(5),PAGES=Math.max(2,Math.min(12,+s.pages||6)),LEAVES=PAGES/2+1,faces=[],SP=s.photos||{};
  function sp(k){return SP[k]||ph(k)}
  faces.push('<div class="face cover'+(s.cover?' has-photo':'')+'">'+(s.cover?'<div class="sk-photo cover-ph"><span class="sk-tape"></span><img alt="" src="'+s.cover+'"></div>':'')+'<div class="label"><h3 class="hand">'+t(s.title)+'</h3><p>for '+esc(NAME)+'</p></div><span class="sk-sticker" style="left:8%;top:8%">🍒</span><span class="sk-sticker" style="right:10%;bottom:10%">⭐</span></div>');
  var pi=0;
  for(var f=1;f<LEAVES*2-1;f++){var L=LAYOUTS[(f-1)%3],h='';
    L.p.forEach(function(a){h+='<div class="sk-photo" style="left:'+a[0]+'%;top:'+a[1]+'%;width:'+a[2]+'%;transform:rotate('+a[3]+'deg)"><span class="sk-tape"></span><img alt="" src="'+sp(pi++)+'"></div>'});
    var q=L.q;h+='<div class="sk-quote hand" style="left:'+q[0]+'%;top:'+q[1]+'%;width:'+q[2]+'%;transform:rotate('+q[3]+'deg)">'+t(quotes[(f-1)%quotes.length])+'</div>';
    L.s.forEach(function(p){h+='<span class="sk-sticker" style="left:'+p[0]+'%;top:'+p[1]+'%;transform:rotate('+Math.round(r()*40-20)+'deg)">'+STICK[Math.floor(r()*STICK.length)]+'</span>'});
    faces.push('<div class="face '+PAPERS[(f-1)%PAPERS.length]+'">'+h+'</div>')}
  faces.push('<div class="face paper-dots sk-end"><div class="hand">to be continued…<br>♥</div></div>');
  var leaves='';for(var l=0;l<LEAVES;l++){leaves+='<div class="leaf" style="z-index:'+(LEAVES-l)+'">'+faces[l*2]+faces[l*2+1].replace('class="face','class="face back')+'</div>'}
  var spiral='';for(var k=0;k<18;k++)spiral+='<i></i>';
  var fl='',rr=rng(23);for(var j=0;j<9;j++){fl+='<img class="floaty" alt="" src="'+sp(j+3)+'" style="left:'+(rr()*92).toFixed(1)+'%;top:'+(rr()*86).toFixed(1)+'%;animation-delay:-'+(rr()*9).toFixed(1)+'s">'}
  return '<section id="s-sketchbook" class="s-sketch" aria-label="Sketchbook">'+fl+'<div class="sk-wrap"><div class="sk-head"><h2 class="display">'+t(s.title)+'</h2><p>Tap a page to turn it.</p></div><div class="book closed" tabindex="0" aria-label="Sketchbook, use arrow keys to turn pages">'+leaves+'<div class="spiral">'+spiral+'</div></div><div class="sk-ctrl"><button class="prev">Previous page</button><button class="next">Next page</button></div></div></section>'};
I.sketchbook=function(sec){var book=sec.querySelector('.book'),leaves=[].slice.call(book.querySelectorAll('.leaf')),n=leaves.length,p=0,prev=sec.querySelector('.prev'),next=sec.querySelector('.next');
  var turning=-1,settle=null;
  function render(){leaves.forEach(function(l,i){var f=i<p;l.classList.toggle('flipped',f);
      /* right stack: lower index on top; left stack: higher index on top; the turning leaf stays above both until it lands */
      l.style.zIndex=i===turning?n*3:(f?i+1:n-i)});
    book.classList.toggle('closed',p===0);book.classList.toggle('ended',p===n);prev.disabled=p===0;next.disabled=p===n}
  function go(d){var np=Math.max(0,Math.min(n,p+d));if(np===p)return;
    var leaf=leaves[d>0?p:np];turning=d>0?p:np;p=np;render();
    function land(e){if(e&&(e.target!==leaf||e.propertyName!=='transform'))return;leaf.removeEventListener('transitionend',land);clearTimeout(settle);if(turning===leaves.indexOf(leaf)){turning=-1;render()}}
    clearTimeout(settle);
    if(reduce){land()}else{leaf.addEventListener('transitionend',land);settle=setTimeout(land,3000)}}
  book.addEventListener('click',function(e){var b=book.getBoundingClientRect(),mid=b.left+b.width/2;
    if(p===0)return go(1);if(p===n)return go(-1);go(e.clientX>=mid?1:-1)});
  book.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){go(1);e.preventDefault()}if(e.key==='ArrowLeft'){go(-1);e.preventDefault()}});
  prev.onclick=function(){go(-1)};next.onclick=function(){go(1)};render()};

/* ---- galaxy ---- */
B.galaxy=function(){var g=G.galaxy,names=g.items.length?g.items:[NAME],h='';
  names.forEach(function(nm,i){h+='<button class="gcard" data-i="'+i+'" aria-label="Open '+t(nm)+'"><img alt="" src="'+ph(i)+'"><span>'+t(nm)+'</span></button>'});
  return '<section id="s-galaxy" class="s-galaxy" aria-label="Photo galaxy"><canvas class="stars"></canvas><div class="gal-head"><h2 class="display">'+t(g.title)+'</h2><p>Drag to spin. Tap a card to open it.</p></div><div class="sphere">'+h+'</div><div class="lightbox" hidden><button class="lb-close">Close</button><figure><img alt=""><figcaption></figcaption></figure></div></section>'};
I.galaxy=function(sec){
  var cv=sec.querySelector('.stars'),ctx=cv.getContext('2d'),stars=[],vis=false,r=rng(99);
  for(var i=0;i<260;i++)stars.push([r(),r(),r()*1.4+.2,r()*6.28]);
  var cards=[].slice.call(sec.querySelectorAll('.gcard')),n=cards.length,pts=[];
  cards.forEach(function(c,i){var y=n===1?0:1-(i/(n-1))*2,rad=Math.sqrt(1-y*y),th=i*2.399963;pts.push([Math.cos(th)*rad,y,Math.sin(th)*rad])});
  var rx=-.25,ry=0,vx=0,vy=0,drag=false,moved=0,lx,ly,W,H,R;
  function size(){W=sec.clientWidth;H=sec.clientHeight;var d=devicePixelRatio||1;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);R=Math.min(W*.36,H*.3);sec.style.setProperty('--c',Math.max(70,Math.min(130,R*.42))+'px')}
  /* shooting stars: streak diagonally with a glowing head and a fading tail */
  var shots=[],nextShot=0,lastT=0,SHOOT=G.galaxy.shooting!==false&&!reduce;
  function spawn(){var a=Math.PI*(.13+Math.random()*.14);
    shots.push({x:W*(.25+Math.random()*.85),y:-20+Math.random()*H*.45,a:a,v:.7+Math.random()*.5,len:Math.min(420,W*.2+Math.random()*W*.14),life:0,max:1000+Math.random()*700,w:1.8+Math.random()*1.4})}
  function shoot(n){var dt=lastT?Math.min(50,n-lastT):16;lastT=n;
    if(n>nextShot){spawn();if(Math.random()<.22)spawn();nextShot=n+800+Math.random()*2200}
    shots=shots.filter(function(s){return s.life<s.max});
    shots.forEach(function(s){s.life+=dt;s.x-=Math.cos(s.a)*s.v*dt;s.y+=Math.sin(s.a)*s.v*dt;
      var k=s.life/s.max,al=k<.12?k/.12:Math.max(0,1-(k-.12)/.88),tl=s.len*(k<.2?.4+k*3:1);
      var tx=s.x+Math.cos(s.a)*tl,ty=s.y-Math.sin(s.a)*tl,g=ctx.createLinearGradient(s.x,s.y,tx,ty);
      g.addColorStop(0,'rgba(255,255,255,'+al+')');g.addColorStop(.12,'rgba(225,232,255,'+(al*.85)+')');g.addColorStop(.45,'rgba(170,190,255,'+(al*.35)+')');g.addColorStop(1,'rgba(140,160,255,0)');
      ctx.strokeStyle=g;ctx.lineWidth=s.w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(tx,ty);ctx.stroke();
      var h=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,7*s.w);h.addColorStop(0,'rgba(255,255,255,'+al+')');h.addColorStop(1,'rgba(180,200,255,0)');
      ctx.fillStyle=h;ctx.beginPath();ctx.arc(s.x,s.y,7*s.w,0,6.283);ctx.fill()})}
  function draw(n){ctx.clearRect(0,0,W,H);stars.forEach(function(s){ctx.globalAlpha=reduce?.7:.35+.65*Math.abs(Math.sin(n/900+s[3]));ctx.fillStyle='#fff';ctx.fillRect(s[0]*W,s[1]*H,s[2],s[2])});ctx.globalAlpha=1;
    if(SHOOT&&n)shoot(n);
    var cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx);
    pts.forEach(function(p,i){var x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy,y=p[1]*cx-z*sx;z=p[1]*sx+z*cx;
      var k=.62+.38*(z+1)/2,c=cards[i];c.style.transform='translate(-50%,-50%) translate3d('+(x*R).toFixed(1)+'px,'+(y*R).toFixed(1)+'px,0) scale('+k.toFixed(3)+')';
      c.style.zIndex=Math.round(100+z*100);c.style.opacity=(.3+.7*(z+1)/2).toFixed(2);c.style.filter=z<-.2?'blur(1px)':'none'})}
  function loop(n){if(vis){if(!drag){vy*=.95;vx*=.95;ry+=vy+(reduce?0:.0022);rx+=vx;rx=Math.max(-1.1,Math.min(1.1,rx))}draw(n)}requestAnimationFrame(loop)}
  var sph=sec.querySelector('.sphere');
  sph.addEventListener('pointerdown',function(e){drag=true;moved=0;lx=e.clientX;ly=e.clientY;vx=vy=0;sph.classList.add('dragging')});
  addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-lx,dy=e.clientY-ly;moved+=Math.abs(dx)+Math.abs(dy);lx=e.clientX;ly=e.clientY;vy=dx*.006;vx=dy*.006;ry+=vy;rx+=vx;rx=Math.max(-1.1,Math.min(1.1,rx))});
  addEventListener('pointerup',function(){drag=false;sph.classList.remove('dragging')});
  var lb=sec.querySelector('.lightbox'),names=G.galaxy.items.length?G.galaxy.items:[NAME];
  sph.addEventListener('click',function(e){var c=e.target.closest('.gcard');if(!c||moved>8)return;var i=+c.dataset.i;
    lb.querySelector('img').src=ph(i);lb.querySelector('figcaption').textContent=T(names[i]);lb.hidden=false;lb.querySelector('.lb-close').focus()});
  function close(){lb.hidden=true}
  lb.addEventListener('click',function(e){if(e.target===lb||e.target.classList.contains('lb-close'))close()});
  addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  size();addEventListener('resize',size);onVisible(sec,function(v){vis=v});draw(0);requestAnimationFrame(loop)};

/* ---- chat ---- */
B.chat=function(){var c=G.chat,d=new Date(),tm=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  return '<section id="s-chat" class="s-chat" aria-label="Messages"><div class="phone"><div class="screen"><div class="sbar"><span>'+tm+'</span><span class="island"></span><span>●●●</span></div><div class="chead"><img class="cav" alt="" src="'+ph(0)+'"><div><strong>'+t(c.contact)+'</strong><small>online now</small></div></div><div class="msgs" aria-live="polite"><div class="day">Today '+tm+'</div></div><div class="compose"><span>Message</span><button aria-label="Replay messages">↻</button></div></div></div></section>'};
I.chat=function(sec){var box=sec.querySelector('.msgs'),msgs=G.chat.items,run=0,started=false;
  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function scroll(){box.scrollTop=box.scrollHeight}
  async function play(){var id=++run;box.querySelectorAll('.bubble,.read').forEach(function(e){e.remove()});
    for(var i=0;i<msgs.length;i++){if(id!==run)return;var ty=document.createElement('div');ty.className='bubble typing';ty.innerHTML='<i></i><i></i><i></i>';box.appendChild(ty);scroll();
      await wait(reduce?0:Math.min(1700,650+msgs[i].length*18));if(id!==run)return;ty.remove();
      var b=document.createElement('div');b.className='bubble';b.textContent=T(msgs[i]);box.appendChild(b);scroll();await wait(reduce?0:350)}
    var last=box.querySelector('.bubble:last-of-type');if(last){var re=document.createElement('span');re.className='react';re.textContent='❤️';last.appendChild(re)}
    var rd=document.createElement('div');rd.className='read';rd.textContent='Read just now';box.appendChild(rd);scroll()}
  onVisible(sec,function(v){if(v&&!started){started=true;play()}},.35);
  sec.querySelector('.compose button').onclick=play};

/* ---- assemble (only once the doors are open, so nothing can be scrolled to early) ---- */
var ORDER=['age','birthday','polaroids','sketchbook','galaxy','chat'],app=document.getElementById('gift'),built=false;
function build(){if(built)return;built=true;var html='';
  ORDER.forEach(function(id){if(G.show&&G.show[id]&&G[id])html+=B[id]()});
  html+='<footer class="foot"><span class="h">♥</span> '+t((G.birthday&&G.birthday.footer)||'Made for you')+(opts.footerHTML||'')+'</footer>';
  app.innerHTML=html;ORDER.forEach(function(id){var s=document.getElementById('s-'+id);if(s)I[id](s)})}
function goto(id,smooth){var el=document.getElementById('s-'+id);if(el)el.scrollIntoView({behavior:smooth?'smooth':'auto'})}

/* ---- lock: opens at 12:00 AM on the chosen date ---- */
var U=G.unlock,lockAt=0;
if(U&&U.date){if(U.local){var q=U.date.split('-');lockAt=new Date(+q[0],+q[1]-1,+q[2],0,0,0).getTime()}else lockAt=U.at||0}
function isLocked(){return lockAt>0&&now()<lockAt}

/* ---- curtain ---- */
var cur=null,iv=null;
function openCurtain(instant){build();clearInterval(iv);if(!cur)return;var c=cur;cur=null;document.body.classList.remove('locked');
  if(instant){c.remove();return}c.classList.add('open');setTimeout(function(){c.remove()},1800)}
function pad(n){return n<10?'0'+n:''+n}
function setVal(el,v){if(el.textContent!==v){el.textContent=v;if(!reduce){el.classList.remove('tick');void el.offsetWidth;el.classList.add('tick')}}}
function ready(stage,justOpened){var sub=cur.querySelector('.sub');sub.innerHTML=t(G.curtain.label)+' '+esc(NAME);
  stage.removeAttribute('role');stage.removeAttribute('aria-label');
  stage.innerHTML=(justOpened?'<p class="doors-open">The doors are open</p>':'')+'<button class="go">'+t(G.curtain.button)+'</button>';
  var go=stage.querySelector('.go');
  go.onclick=async function(){
    /* hosted gifts: the server only hands over photos and messages once the doors are open */
    if(opts.loadFull&&!G.complete){go.disabled=true;go.textContent='Opening…';var full=null;
      for(var i=0;i<6&&!full;i++){try{full=await opts.loadFull()}catch(e){}if(!full)await new Promise(function(r){setTimeout(r,2000)})}
      if(!full){go.disabled=false;go.textContent='Try again';return}
      for(var k in full)G[k]=full[k];G.complete=true}
    openCurtain(false)}}
function countdown(stage){
  stage.setAttribute('role','timer');
  stage.innerHTML='<div class="days" aria-hidden="true"></div><p class="lbl" aria-hidden="true">Days to curtain</p><div class="units" aria-hidden="true"><div class="unit"><b></b><small>Hrs</small></div><div class="unit"><b></b><small>Min</small></div><div class="unit"><b></b><small>Sec</small></div></div><p class="doors">Doors open at midnight, '+esc(U.zone||'')+'</p>';
  var days=stage.querySelector('.days'),u=stage.querySelectorAll('.unit b');
  function tick(){var ms=lockAt-now();if(ms<=0){clearInterval(iv);ready(stage,true);return}
    var s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sc=s%60,ds=pad(d);
    if(days.children.length!==ds.length){days.innerHTML=ds.split('').map(function(){return '<span class="d"></span>'}).join('')}
    ds.split('').forEach(function(c,i){setVal(days.children[i],c)});
    setVal(u[0],pad(h));setVal(u[1],pad(m));setVal(u[2],pad(sc));
    stage.setAttribute('aria-label',d+' days, '+h+' hours and '+m+' minutes until it opens')}
  tick();iv=setInterval(tick,1000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&cur)tick()})}
function makeCurtain(){
  cur=document.createElement('div');cur.className='curtain';
  var bulbs='';for(var i=0;i<24;i++)bulbs+='<i style="animation-delay:-'+((i%4)*.4).toFixed(1)+'s"></i>';
  var item='<span>'+t(G.curtain.ticker)+'</span><b>'+esc((U&&U.short)||NAME)+'</b>',track='';for(var k=0;k<10;k++)track+=item;
  var locked=isLocked();
  cur.innerHTML='<div class="half l"></div><div class="half r"></div><div class="frame"><i></i><i></i><i></i><i></i></div><div class="bulbs" aria-hidden="true">'+bulbs+'</div><div class="ticker" aria-hidden="true"><div class="track">'+track+track+'</div></div>'+
    (G.preview?'<button class="pv" title="Only you see this in the builder">Preview · skip</button>':'')+
    '<div class="cmsg"><div class="title"><span class="spark" aria-hidden="true">✦</span><h2>'+t(G.curtain.title)+'</h2><span class="spark" aria-hidden="true">✦</span></div><p class="sub">'+t(G.curtain.subtitle)+'</p><div class="stage"></div></div>';
  document.body.appendChild(cur);document.body.classList.add('locked');
  if(G.preview)cur.querySelector('.pv').onclick=function(){openCurtain(false)};
  var stage=cur.querySelector('.stage');if(locked)countdown(stage);else ready(stage,false)}

if(G.startAt&&G.complete!==false){build();requestAnimationFrame(function(){goto(G.startAt,false)})}
else if((G.show&&G.show.curtain)||isLocked()||G.complete===false)makeCurtain();
else build();

/* the builder can jump around the preview; a downloaded gift ignores this */
if(G.preview)addEventListener('message',function(e){if(e.data&&e.data.goto){openCurtain(true);if(e.data.goto==='curtain'){scrollTo(0,0);return}goto(e.data.goto,true)}});
};
})();
