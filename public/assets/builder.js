const { TZ, makeDefaults, unlockInfoFor, unlockNoteFor, giftData, FONTS } = window.GiftShared;

const SCHEMA = {
  basics:    { label:'Basics', title:'Basics', desc:'Who the gift is for, and the photos used across every section.' },
  curtain:   { label:'Curtain', title:'Curtain', desc:'A theatre marquee with a countdown. It stays closed until 12:00 AM on the date set in Basics, then they open the curtains.',
               fields:[{k:'title',label:'Marquee title'},{k:'subtitle',label:'Line under the title'},{k:'ticker',label:'Scrolling banner text'},{k:'label',label:'Line before their name, once it opens'},{k:'button',label:'Button text'}],
               hint:'Use {date} for the opening date, like “2nd October”. While the date is still ahead, the countdown shows even if this section is hidden.' },
  puzzle:    { label:'Photo puzzle', title:'Photo puzzle', desc:'They swap the pieces of a photo back into place. When it’s solved, the sky turns to night, the moon rises and your message appears.',
               fields:[{k:'title',label:'Heading'},{k:'size',label:'Difficulty',type:'select',options:[[3,'Easy · 3 × 3 (9 pieces)'],[4,'Harder · 4 × 4 (16 pieces)']]},{k:'message',label:'Message revealed when it’s solved',type:'textarea'},{k:'closing',label:'Closing line'}],
               extra:'puzzlePhoto', hint:'If they get stuck, a “Solve it for me” button appears after a while, so they always reach your message.' },
  age:       { label:'Age reveal', title:'Age reveal', desc:'A huge number that counts up to their new age.',
               fields:[{k:'age',label:'Age they’re turning',type:'number'},{k:'above',label:'Line above the number'},{k:'below',label:'Line below the number'}] },
  birthday:  { label:'Happy birthday', title:'Happy birthday', desc:'Their name in big type, your wish, and a ribbon of photos.',
               fields:[{k:'date',label:'Date label'},{k:'first',label:'First line',half:true},{k:'second',label:'Second line',half:true},{k:'wish',label:'Your wish',type:'textarea'},{k:'footer',label:'Footer'}],
               hint:'Their name is filled in from Basics.' },
  polaroids: { label:'Polaroid wall', title:'Polaroid wall', desc:'Pinned polaroids they can drag around, each with a handwritten caption, among flowers and fluttering butterflies.',
               fields:[{k:'title',label:'Heading'},{k:'flowers',label:'Flowers around the wall and on the polaroids',type:'check'},{k:'butterflies',label:'Flying butterflies',type:'check'},{k:'count',label:'How many butterflies',type:'number',min:1,max:14}], list:{label:'Polaroids',add:'Add polaroid',offset:0} },
  sketchbook:{ label:'Sketchbook', title:'Sketchbook', desc:'A spiral scrapbook of stickers, quotes and photos, with pages that turn.',
               fields:[{k:'title',label:'Cover title'},{k:'pages',label:'Number of pages',type:'select',options:[[4,'4 pages (2 spreads)'],[6,'6 pages (3 spreads)'],[8,'8 pages (4 spreads)'],[10,'10 pages (5 spreads)']],rerender:true}],
               extra:'sketchPhotos', list:{label:'Quotes',add:'Add quote',offset:null,hint:'One quote is written on each page, in order. If there are more pages than quotes, they repeat.'} },
  galaxy:    { label:'Photo galaxy', title:'Photo galaxy', desc:'Photo cards on a sphere in space, each with a nickname. They drag to spin it and tap a card to open it.',
               fields:[{k:'title',label:'Heading'},{k:'shooting',label:'Shooting stars in the background',type:'check'}], list:{label:'Cards',add:'Add card',offset:0} },
  chat:      { label:'Chat', title:'Chat', desc:'A phone that receives your messages one by one, with typing dots in between.',
               fields:[{k:'contact',label:'Contact name'}], list:{label:'Messages',add:'Add message',offset:null} }
};
const ORDER = ['basics','curtain','puzzle','age','birthday','polaroids','sketchbook','galaxy','chat'];

let state = makeDefaults();
let active = 'basics';
let device = 'desktop';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- placeholder photos (drawn by gift.js) ---------- */
const PLACEHOLDERS = window.GIFT_PLACEHOLDERS;
const photoAt = i => { const p = state.photos.length ? state.photos : PLACEHOLDERS; return p[i % p.length]; };

/* ---------- opening date ---------- */
const unlockInfo = () => unlockInfoFor(state.unlock);
const unlockNote = () => unlockNoteFor(state.unlock);

/* ---------- preview document (iframe srcdoc resolves /gift/... against this page) ---------- */
const ASSET_V = '1';
function previewDoc(opts={}){
  const json = JSON.stringify(giftData(state, opts)).replace(/</g,'\\u003c');
  const close = '</' + 'script>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title>`+
    `<link href="${FONTS}" rel="stylesheet"><link rel="stylesheet" href="/gift/gift.css?v=${ASSET_V}"></head>`+
    `<body><main id="gift"></main><script src="/gift/gift.js?v=${ASSET_V}">${close}<script>renderGift(${json});${close}</body></html>`;
}

/* ---------- preview ---------- */
let timer=null;
function setStatus(busy){
  const s=$('#status'), f=$('#foot-chip');
  [s,f].forEach(el=>{el.textContent=busy?'Updating…':'Up to date';el.classList.toggle('busy',busy)});
  $('#foot-status').textContent = busy ? 'Updating the preview…' : 'The preview is up to date.';
}
function refresh(now){
  setStatus(true); clearTimeout(timer); scheduleSave();
  timer=setTimeout(()=>{
    const start = (active==='basics'||active==='curtain'||!state.show[active]) ? null : active;
    $('#preview').srcdoc = previewDoc({startAt:start, preview:true});
    setStatus(false);
  }, now?0:450);
}
function fitPhone(){
  const st=$('#stage'), fr=$('#preview');
  if(device!=='phone'){fr.style.transform='';return}
  const k=Math.min(1,(st.clientHeight-40)/800,(st.clientWidth-40)/390);
  fr.style.transform=`translate(-50%,-50%) scale(${k})`;
}
addEventListener('resize',fitPhone);

/* ---------- editor UI ---------- */
function renderTabs(){
  $('#tabs').innerHTML = ORDER.map(id=>{
    const off = id!=='basics' && !state.show[id];
    return `<button class="tab" role="tab" data-id="${id}" aria-selected="${id===active}">${off?'<span class="off" title="Hidden"></span>':''}${SCHEMA[id].label}</button>`;
  }).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
    active=b.dataset.id; renderTabs(); renderPanel();
    if(active!=='basics') postGoto(active);
  });
  const sel=$('#jump');
  sel.innerHTML = ORDER.filter(id=>id!=='basics'&&state.show[id]).map(id=>`<option value="${id}">${SCHEMA[id].label}</option>`).join('');
  if(state.show[active]) sel.value=active;
  $('#crumb-name').textContent = `Birthday gift for ${state.name.trim()||'someone'}`;
}
function postGoto(id){ const w=$('#preview').contentWindow; if(w) w.postMessage({goto:id},'*'); }

function fieldHTML(sec,f){
  const v = state[sec][f.k] ?? '';
  const id = `f-${sec}-${f.k}`;
  if(f.type==='select') return `<div class="field"><label for="${id}">${f.label}</label><select class="inp" style="width:100%" id="${id}" data-sec="${sec}" data-k="${f.k}" ${f.rerender?'data-rerender':''}>${f.options.map(o=>`<option value="${o[0]}" ${String(o[0])===String(v)?'selected':''}>${o[1]}</option>`).join('')}</select></div>`;
  if(f.type==='check') return `<label class="check"><input type="checkbox" id="${id}" data-sec="${sec}" data-k="${f.k}" ${v?'checked':''}> ${f.label}</label>`;
  const input = f.type==='textarea'
    ? `<textarea class="inp" id="${id}" data-sec="${sec}" data-k="${f.k}">${esc(v)}</textarea>`
    : `<input class="inp" id="${id}" data-sec="${sec}" data-k="${f.k}" type="${f.type==='number'?'number':'text'}" ${f.type==='number'?`min="${f.min||1}" max="${f.max||120}"`:''} value="${esc(v)}">`;
  return `<div class="field"><label for="${id}">${f.label}</label>${input}</div>`;
}

/* ---------- puzzle photo ---------- */
function puzzlePhotoHTML(){
  const own=state.puzzle.photo, img=own||(state.photos.length?state.photos[0]:window.GIFT_PUZZLE_DEFAULT);
  const note=own?'Your photo':state.photos.length?'Using your first photo from Basics':'Using the birthday-cake picture';
  return `<span class="flabel">Puzzle photo</span>
  <div class="slots"><div class="slot ${own?'':'auto'}" id="pz-slot">
    <button class="slot-pic" id="pz-pick" aria-label="${own?'Replace':'Choose'} the puzzle photo"><img src="${img}" alt=""></button>
    <input type="file" accept="image/*" hidden id="pz-file">
    <div class="slot-meta"><span>Photo to put back together</span><small>${note}</small></div>
    ${own?'<button class="icon-btn" id="pz-rm" aria-label="Remove the puzzle photo">×</button>':'<span></span>'}
  </div></div>
  <p class="hint" style="margin:-4px 0 16px">Tap the photo, or drop one on it, to choose. A picture with clear shapes and colours is easiest to solve. It’s cropped to a square.</p>`;
}
function wirePuzzlePhoto(p){
  const file=p.querySelector('#pz-file'), slot=p.querySelector('#pz-slot');
  p.querySelector('#pz-pick').onclick=()=>file.click();
  const set=async f=>{ if(!f||!f.type.startsWith('image/')) return; setStatus(true);
    try{ state.puzzle.photo=await uploadPhoto(f); }catch(e){ toast(e.message||'That photo could not be uploaded.',true); }
    renderPanel(); refresh(true); };
  file.onchange=()=>set(file.files[0]);
  slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('over')});
  slot.addEventListener('dragleave',()=>slot.classList.remove('over'));
  slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('over');set(e.dataTransfer.files[0])});
  const rm=p.querySelector('#pz-rm'); if(rm) rm.onclick=()=>{ state.puzzle.photo=''; renderPanel(); refresh(true); };
}

/* ---------- sketchbook photo spots ---------- */
function slotLabel(i){ const page=Math.floor(i/2)+1, spread=Math.ceil(page/2); return `Spread ${spread} · ${page%2?'left':'right'} page, ${i%2?'second':'first'} photo`; }
function slotHTML(key,label){
  const sb=state.sketchbook, src = key==='cover' ? sb.cover : sb.photos[key];
  const fallback = key==='cover' ? '' : photoAt(key), img = src || fallback, custom=!!src;
  return `<div class="slot ${custom?'':'auto'}" data-slot="${key}">
    <button class="slot-pic" data-pick="${key}" aria-label="${custom?'Replace':'Add'} photo: ${label}">${img?`<img src="${img}" alt="">`:'<span aria-hidden="true">+</span>'}</button>
    <input type="file" accept="image/*" hidden data-slot-file="${key}">
    <div class="slot-meta"><span>${label}</span><small>${custom?'Your photo':key==='cover'?'Optional · shows the title only if empty':'Using a Basics photo'}</small></div>
    ${custom?`<button class="icon-btn" data-slot-rm="${key}" aria-label="Remove photo: ${label}">×</button>`:'<span></span>'}
  </div>`;
}
function sketchPhotosHTML(){
  const n=state.sketchbook.pages*2, own=Object.keys(state.sketchbook.photos).filter(k=>+k<n).length;
  let h=`<span class="flabel">Photos on the pages</span><p class="hint" style="margin:-2px 0 10px">${own} of ${n} spots have their own photo. Empty spots use your Basics photos. Tap a photo, or drop one on it, to replace it.</p><div class="slots">`;
  h+=slotHTML('cover','Cover');
  for(let i=0;i<n;i++) h+=slotHTML(i,slotLabel(i));
  h+=`</div><label class="add-btn bulk"><input type="file" id="sb-bulk" accept="image/*" multiple hidden>+ Upload several to fill the empty spots</label><div style="height:18px"></div>`;
  return h;
}
async function setSlot(key,file){
  if(!file||!file.type.startsWith('image/')) return;
  setStatus(true);
  try{ const url=await uploadPhoto(file); if(key==='cover') state.sketchbook.cover=url; else state.sketchbook.photos[key]=url; }
  catch(e){ toast(e.message||'That photo could not be uploaded.', true); }
  renderPanel(); refresh(true);
}
function wireSlots(p){
  p.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>p.querySelector(`[data-slot-file="${b.dataset.pick}"]`).click());
  p.querySelectorAll('[data-slot-file]').forEach(inp=>inp.onchange=()=>{ const k=inp.dataset.slotFile; setSlot(k==='cover'?'cover':+k, inp.files[0]); });
  p.querySelectorAll('[data-slot-rm]').forEach(b=>b.onclick=()=>{ const k=b.dataset.slotRm; if(k==='cover') state.sketchbook.cover=''; else delete state.sketchbook.photos[k]; renderPanel(); refresh(true); });
  p.querySelectorAll('.slot').forEach(el=>{
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('over')});
    el.addEventListener('dragleave',()=>el.classList.remove('over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('over');const k=el.dataset.slot;setSlot(k==='cover'?'cover':+k,e.dataTransfer.files[0]);});
  });
  const bulk=p.querySelector('#sb-bulk');
  if(bulk) bulk.onchange=async()=>{
    const files=[...bulk.files].filter(f=>f.type.startsWith('image/')), n=state.sketchbook.pages*2;
    const empty=[]; for(let i=0;i<n;i++) if(!state.sketchbook.photos[i]) empty.push(i);
    setStatus(true);
    for(let j=0;j<files.length&&j<empty.length;j++){
      bulk.parentElement.lastChild.textContent=` Uploading ${j+1} of ${Math.min(files.length,empty.length)}…`;
      try{ state.sketchbook.photos[empty[j]]=await uploadPhoto(files[j]); }catch(e){ toast(e.message, true); break; }
    }
    renderPanel(); refresh(true);
  };
}

function renderPanel(){
  const S=SCHEMA[active], p=$('#panel');
  let h = `<div class="p-head"><h2>${S.title}</h2>`;
  if(active!=='basics') h += `<button class="toggle" role="switch" aria-checked="${state.show[active]}" id="shown"><span class="sw"></span>${state.show[active]?'Shown':'Hidden'}</button>`;
  h += `</div><p class="p-desc">${S.desc}</p>`;

  if(active==='basics'){
    h += `<div class="field"><label for="f-name">Their name</label><input class="inp" id="f-name" value="${esc(state.name)}"><p class="hint">Type {name} in any text and it becomes their name.</p></div>`;
    h += `<div class="field"><label for="f-date">Opens on</label><div class="row2"><input class="inp" type="date" id="f-date" value="${esc(state.unlock.date)}"><select class="inp" id="f-tz" style="width:100%" aria-label="Time zone for midnight">${TZ.map(z=>`<option value="${z[0]}" ${z[0]===state.unlock.tz?'selected':''}>${z[1]}</option>`).join('')}</select></div><p class="hint" id="unlock-note">${esc(unlockNote())}</p>${state.unlock.date?'<button class="link-btn" id="clear-date" style="padding:4px 0">Remove date</button>':''}</div>`;
    h += `<span class="flabel">Photos</span>`;
    if(!state.photos.length) h += `<p class="empty-note">Placeholder images are showing. Add 10 or more photos of them for the best result.</p>`;
    h += `<div class="photos">${state.photos.map((src,i)=>`<div class="ph"><img src="${src}" alt="Photo ${i+1}"><span class="n">${i+1}</span><button data-rm="${i}" aria-label="Remove photo ${i+1}">×</button></div>`).join('')}</div>`;
    h += `<label class="drop" id="drop"><input type="file" id="file" accept="image/*" multiple hidden><strong>Add photos</strong><br>or drop them here</label><p class="hint">Photos are reused in order across sections. Up to ${siteCfg.maxPhotos||80} per gift.</p>`;
    if(session) h += `<div class="danger-zone"><button class="link-btn danger" id="delete-gift">Delete this gift</button><p class="hint">Removes the gift, its link and every photo for good.${meta.status==='paid'?' The link will stop working. This does not refund the payment.':''}</p></div>`;
  } else {
    let half=[];
    (S.fields||[]).forEach(f=>{
      if(f.half){ half.push(fieldHTML(active,f)); if(half.length===2){ h+=`<div class="row2">${half.join('')}</div>`; half=[]; } }
      else h+=fieldHTML(active,f);
    });
    if(S.hint) h+=`<p class="hint" style="margin-top:-8px;margin-bottom:16px">${S.hint}</p>`;
    if(S.extra==='sketchPhotos') h+=sketchPhotosHTML();
    if(S.extra==='puzzlePhoto') h+=puzzlePhotoHTML();
    if(S.list){
      const items=state[active].items;
      h += `<span class="flabel">${S.list.label}</span>`;
      h += items.map((v,i)=>`<div class="list-row" ${S.list.offset===null?'style="grid-template-columns:1fr 30px"':''}>${S.list.offset!==null?`<img src="${photoAt(i+S.list.offset)}" alt="">`:''}<input class="inp" data-item="${i}" value="${esc(v)}" aria-label="${S.list.label} ${i+1}"><button class="icon-btn" data-del="${i}" aria-label="Remove ${i+1}">×</button></div>`).join('');
      h += `<button class="add-btn" id="add-item">+ ${S.list.add}</button>`;
      if(S.list.hint) h+=`<p class="hint">${S.list.hint}</p>`;
      else if(S.list.offset!==null) h+=`<p class="hint">Each one uses the next photo from Basics.</p>`;
    }
  }
  p.innerHTML=h;
  wirePanel();
}

function wirePanel(){
  const p=$('#panel');
  if(active==='sketchbook') wireSlots(p);
  if(active==='puzzle') wirePuzzlePhoto(p);
  const t=$('#shown'); if(t) t.onclick=()=>{ state.show[active]=!state.show[active]; renderTabs(); renderPanel(); refresh(true); };
  p.querySelectorAll('[data-sec]').forEach(el=>el.oninput=()=>{
    state[el.dataset.sec][el.dataset.k] = el.type==='checkbox' ? el.checked : (el.type==='number'||el.tagName==='SELECT') ? Math.max(0,parseInt(el.value)||0) : el.value;
    if('rerender' in el.dataset) renderPanel(); refresh();
  });
  p.querySelectorAll('[data-item]').forEach(el=>el.oninput=()=>{ state[active].items[+el.dataset.item]=el.value; refresh(); });
  p.querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{ state[active].items.splice(+el.dataset.del,1); renderPanel(); refresh(); });
  const add=$('#add-item'); if(add) add.onclick=()=>{ state[active].items.push(''); renderPanel(); const ins=p.querySelectorAll('[data-item]'); ins[ins.length-1]?.focus(); };
  const nm=$('#f-name'); if(nm) nm.oninput=()=>{ state.name=nm.value; renderTabs(); renderTop(); refresh(); };
  const del=$('#delete-gift'); if(del) del.onclick=async()=>{
    if(!confirm(`Delete this gift for ${state.name.trim()||'them'}? This can't be undone.`)) return;
    try{ await api(`gifts/${session.id}`,{method:'DELETE'}); forget(session.id); dirty=false; location.href='/create'; }catch(e){ toast(e.message,true); }
  };
  const fd=$('#f-date'), ftz=$('#f-tz');
  if(fd){ fd.onchange=()=>{ state.unlock.date=fd.value; renderPanel(); refresh(true); };
          ftz.onchange=()=>{ state.unlock.tz=ftz.value; $('#unlock-note').textContent=unlockNote(); refresh(true); }; }
  const cd=$('#clear-date'); if(cd) cd.onclick=()=>{ state.unlock.date=''; renderPanel(); refresh(true); };
  p.querySelectorAll('[data-rm]').forEach(el=>el.onclick=()=>{ state.photos.splice(+el.dataset.rm,1); renderPanel(); refresh(); });
  const file=$('#file'), drop=$('#drop');
  if(file){
    file.onchange=()=>addFiles(file.files);
    ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
    drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  }
}

/* Photos are resized in the browser (max 1600px JPEG), then uploaded to storage. Only URLs are saved. */
function shrink(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      const max=1600, k=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url);
      c.toBlob(b=>b?res(b):rej(new Error('Could not read that image.')),'image/jpeg',.84);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error(`${file.name} isn't an image we can read. Try a JPEG or PNG.`))};
    img.src=url;
  });
}
async function uploadPhoto(file){
  const blob=await shrink(file);
  await ensureGift();
  const r=await api(`gifts/${session.id}/photos`,{method:'POST',body:blob,raw:true,headers:{'content-type':'image/jpeg'}});
  return r.url;
}
async function addFiles(list){
  const files=[...list].filter(f=>f.type.startsWith('image/'));
  if(!files.length) return;
  const label=$('#drop strong');
  for(let i=0;i<files.length;i++){
    if(label) label.textContent=`Uploading ${i+1} of ${files.length}…`;
    try{ state.photos.push(await uploadPhoto(files[i])); }catch(e){ toast(e.message||'Upload failed.', true); break; }
  }
  renderPanel(); refresh(true);
}

/* ---------- server: session, autosave ---------- */
let session=null;      // { id, key }
let meta={status:'draft', slug:null, url:null, email:'', phone:''};
let lastSaveError='';
let booted=false, saveTimer=null, saving=false, saveAgain=false, dirty=false;
let siteCfg={priceInr:299, payments:'off', brand:'Giftpage'};

async function api(path,{method='GET',body,headers={},raw=false}={}){
  const h={...headers}; if(session) h['x-edit-key']=session.key;
  let b=body; if(body!==undefined&&!raw){ h['content-type']='application/json'; b=JSON.stringify(body); }
  let r; try{ r=await fetch('/api/'+path,{method,headers:h,body:b}); }catch(e){ throw new Error("You seem to be offline. We'll keep trying."); }
  const data=await r.json().catch(()=>({}));
  if(!r.ok){ const e=new Error(data.error||`Request failed (${r.status})`); e.status=r.status; e.data=data; throw e; }
  return data;
}
async function ensureGift(){
  if(session) return session;
  if(ensureGift.p) return ensureGift.p;
  ensureGift.p=(async()=>{
    const r=await api('gifts',{method:'POST',body:{config:state}});
    session={id:r.id,key:r.key};
    history.replaceState(null,'',`/create?id=${r.id}&key=${encodeURIComponent(r.key)}`);
    remember(); return session;
  })();
  try{ return await ensureGift.p; } finally{ ensureGift.p=null; }
}
function setSave(text,warn){ const el=$('#save-status'); el.textContent=text; el.classList.toggle('warn',!!warn); }
function scheduleSave(){
  if(!booted) return;
  dirty=true; setSave('Unsaved changes');
  clearTimeout(saveTimer); saveTimer=setTimeout(saveNow,1200);
}
async function saveNow(){
  clearTimeout(saveTimer);
  if(saving){ saveAgain=true; return; }
  if(!dirty && session) return;
  saving=true; setSave('Saving…');
  try{
    await ensureGift();
    dirty=false;
    await api(`gifts/${session.id}`,{method:'PUT',body:{config:state}});
    setSave(meta.status==='paid'?'Saved · changes are live':'Saved'); remember(); lastSaveError='';
  }catch(e){
    if(e.message!==lastSaveError){ lastSaveError=e.message; toast(`Couldn't save: ${e.message}`,true); }
    dirty=true; setSave('Not saved yet, retrying…',true); saveTimer=setTimeout(saveNow,5000);
    if(e.status===403||e.status===404) { setSave(e.message,true); clearTimeout(saveTimer); }
  }finally{
    saving=false; if(saveAgain){ saveAgain=false; saveNow(); }
  }
}
addEventListener('beforeunload',e=>{ if(dirty||saving){ e.preventDefault(); e.returnValue=''; } });

/* ---------- "Your gifts" (kept on this device) ---------- */
const MINE='giftpage:gifts';
const mine=()=>{ try{ return JSON.parse(localStorage.getItem(MINE))||[]; }catch{ return []; } };
function remember(){
  if(!session) return;
  const list=mine().filter(g=>g.id!==session.id);
  list.unshift({id:session.id,key:session.key,name:state.name.trim()||'Untitled',status:meta.status,slug:meta.slug,updated:Date.now()});
  try{ localStorage.setItem(MINE,JSON.stringify(list.slice(0,30))); }catch{}
}
function forget(id){ try{ localStorage.setItem(MINE,JSON.stringify(mine().filter(g=>g.id!==id))); }catch{} }
function renderMine(){
  const list=mine(), box=$('#mine-list');
  box.innerHTML = list.length ? list.map(g=>`<a class="mine-item${session&&g.id===session.id?' current':''}" href="/create?id=${g.id}&key=${encodeURIComponent(g.key)}">
      <span>${esc(g.name)}</span><small>${g.status==='paid'?'Live':'Draft'} · ${new Date(g.updated).toLocaleDateString()}</small></a>`).join('')
    : `<p class="hint" style="padding:8px 10px">Gifts you make on this device show up here.</p>`;
}

/* ---------- toasts ---------- */
function toast(msg,warn){
  const t=document.createElement('div'); t.className='toast'+(warn?' warn':''); t.setAttribute('role','status'); t.textContent=msg;
  $('#toasts').appendChild(t); setTimeout(()=>t.remove(),5200);
}

/* ---------- top bar ---------- */
function renderTop(){
  const price=`₹${siteCfg.priceInr}`;
  const pub=$('#publish'), live=$('#live');
  if(meta.status==='paid'){
    pub.textContent='Share link'; pub.dataset.mode='share';
    live.hidden=false; live.href=meta.url; live.textContent=meta.url.replace(/^https?:\/\//,'');
  } else {
    pub.textContent=`Publish · ${price}`; pub.dataset.mode='publish'; live.hidden=true;
  }
  document.title=`${state.name.trim()||'Gift'} · ${siteCfg.brand}`;
}

/* ---------- publish ---------- */
const slugify=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
let slugTimer=null, slugOk=false;
function openPublish(){
  const d=$('#dlg-publish');
  const nm=state.name.trim(), n=state.photos.length;
  $('#pub-checks').innerHTML=[
    nm?`<li class="ok">For <strong>${esc(nm)}</strong></li>`:`<li class="bad">Add their name in Basics first.</li>`,
    n?`<li class="ok">${n} photo${n===1?'':'s'}</li>`:`<li class="bad">No photos yet, so they'll see placeholder art. Add photos in Basics.</li>`,
    `<li class="ok">${esc(unlockNote())}</li>`
  ].join('');
  const s=$('#pub-slug'); if(!s.value){ s.value=slugify(nm?`${nm}-birthday`:''); s.dataset.auto=s.value; }
  $('#pub-email').value ||= meta.email||''; $('#pub-phone').value ||= meta.phone||'';
  $('#pub-host').textContent=location.host+'/g/';
  $('#pub-price').textContent=`₹${siteCfg.priceInr}`;
  $('#pub-mode').textContent = siteCfg.payments==='test' ? 'Test mode: no real money is charged.' : siteCfg.payments==='off' ? "Payments aren't set up on this site yet." : 'Secure payment by Razorpay: UPI, cards, netbanking and wallets.';
  $('#pub-error').textContent=''; $('#pub-go').disabled=false; $('#pub-go').textContent=`Pay ₹${siteCfg.priceInr} and publish`;
  d.showModal(); checkSlug();
}
function checkSlug(){
  clearTimeout(slugTimer); const el=$('#pub-slug-msg'); slugOk=false;
  const v=slugify($('#pub-slug').value);
  if(!v){ el.textContent='Pick a link name.'; el.className='slug-msg'; return; }
  el.textContent='Checking…'; el.className='slug-msg';
  slugTimer=setTimeout(async()=>{
    try{
      let r=await api(`slugs/${encodeURIComponent(v)}?gift=${session?session.id:''}`);
      // our own suggestion is taken: quietly try name-2, name-3 …
      if(!r.available && $('#pub-slug').dataset.auto===v){
        for(let n=2;n<8&&!r.available;n++){ r=await api(`slugs/${encodeURIComponent(v+'-'+n)}?gift=${session?session.id:''}`); }
        if(r.available){ $('#pub-slug').value=r.slug; $('#pub-slug').dataset.auto=r.slug; }
      }
      slugOk=r.available; el.textContent=r.available?`✓ ${location.host}/g/${r.slug} is available`:r.reason; el.className='slug-msg '+(r.available?'ok':'bad');
    }catch(e){ el.textContent=e.message; el.className='slug-msg bad'; }
  },350);
}
function loadRazorpay(){
  if(window.Razorpay) return Promise.resolve();
  return new Promise((res,rej)=>{ const sc=document.createElement('script'); sc.src='https://checkout.razorpay.com/v1/checkout.js'; sc.onload=res; sc.onerror=()=>rej(new Error("Couldn't load the payment window. Check your connection and try again.")); document.head.appendChild(sc); });
}
function testCheckout(order){
  return new Promise(resolve=>{
    const d=$('#dlg-test'); $('#test-amt').textContent=`₹${(order.amount/100).toFixed(0)}`;
    $('#test-pay').onclick=()=>{ d.close(); resolve({orderId:order.orderId,paymentId:'pay_test_'+Date.now(),signature:'test'}); };
    $('#test-cancel').onclick=()=>{ d.close(); resolve(null); };
    d.showModal();
  });
}
function razorpayCheckout(order){
  return new Promise((resolve,reject)=>{
    const rz=new window.Razorpay({
      key:order.keyId, amount:order.amount, currency:order.currency, order_id:order.orderId,
      name:order.name, description:order.description, prefill:order.prefill, theme:{color:'#8E1F33'},
      handler:r=>resolve({orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature}),
      modal:{ondismiss:()=>resolve(null), confirm_close:true}
    });
    rz.on('payment.failed',r=>reject(new Error(r.error&&r.error.description?`Payment failed: ${r.error.description}`:'Payment failed. No money was taken.')));
    rz.open();
  });
}
async function publish(){
  const go=$('#pub-go'), err=$('#pub-error'); err.textContent='';
  const slug=slugify($('#pub-slug').value), email=$('#pub-email').value.trim(), phone=$('#pub-phone').value.trim();
  if(!state.name.trim()){ err.textContent='Add their name in Basics before publishing.'; return; }
  if(!slugOk){ err.textContent='Choose an available link name.'; $('#pub-slug').focus(); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ err.textContent='Enter your email so we can send you the links.'; $('#pub-email').focus(); return; }
  if(!$('#pub-agree').checked){ err.textContent='Please accept the terms and refund policy.'; return; }
  go.disabled=true; go.textContent='Getting things ready…';
  try{
    dirty=true; await saveNow();
    const order=await api(`gifts/${session.id}/checkout`,{method:'POST',body:{slug,email,phone}});
    meta.email=email; meta.phone=phone;
    if(order.alreadyPaid){ $('#dlg-publish').close(); return showLive(order.url); }
    go.textContent='Waiting for payment…';
    let paid;
    if(order.mode==='test') paid=await testCheckout(order);
    else { await loadRazorpay(); paid=await razorpayCheckout(order); }
    if(!paid){ err.textContent=`Payment cancelled. Your link name is held for 20 minutes.`; go.disabled=false; go.textContent=`Pay ₹${siteCfg.priceInr} and publish`; return; }
    go.textContent='Confirming payment…';
    const v=await api(`gifts/${session.id}/verify`,{method:'POST',body:paid});
    meta.status='paid'; meta.slug=v.slug; meta.url=v.url; remember(); renderTop();
    $('#dlg-publish').close(); showLive(v.url,true);
  }catch(e){
    err.textContent=e.message; go.disabled=false; go.textContent=`Pay ₹${siteCfg.priceInr} and publish`;
    if(e.data&&e.data.field==='slug'){ $('#pub-slug').focus(); checkSlug(); }
  }
}
function showLive(url,fresh){
  const d=$('#dlg-live');
  $('#live-title').textContent=fresh?"It's live! 🎉":'Share your gift';
  $('#live-url').value=url;
  $('#live-open').href=url;
  const msg=`I made something for you 🎁 ${url}`;
  $('#live-wa').href='https://wa.me/?text='+encodeURIComponent(msg);
  $('#live-note').textContent = meta.email ? `We've emailed this link and your private edit link to ${meta.email}. Keep this page bookmarked to make changes later.` : 'Keep this page bookmarked to make changes later.';
  d.showModal();
}

/* ---------- top-level actions ---------- */
$('#publish').onclick=()=>{ $('#publish').dataset.mode==='share' ? showLive(meta.url) : openPublish(); };
$('#pub-slug').oninput=()=>{ delete $('#pub-slug').dataset.auto; checkSlug(); };
$('#pub-go').onclick=publish;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#live-copy').onclick=async()=>{ try{ await navigator.clipboard.writeText($('#live-url').value); $('#live-copy').textContent='Copied'; setTimeout(()=>$('#live-copy').textContent='Copy',1600); }catch{ $('#live-url').select(); } };
$('#live-resend').onclick=async()=>{ try{ await api(`gifts/${session.id}/email`,{method:'POST',body:{}}); toast('Sent. Check your inbox and spam folder.'); }catch(e){ toast(e.message,true); } };
$('#new-gift').onclick=async()=>{ if(dirty) await saveNow(); location.href='/create'; };
$('#mine-btn').onclick=e=>{ const m=$('#mine'); const open=m.hidden; m.hidden=!open; $('#mine-btn').setAttribute('aria-expanded',open); if(open) renderMine(); e.stopPropagation(); };
document.addEventListener('click',e=>{ if(!e.target.closest('#mine')&&!e.target.closest('#mine-btn')) $('#mine').hidden=true; });
$('#jump').onchange=e=>postGoto(e.target.value);
function setDevice(d){
  device=d; $('#stage').classList.toggle('phone',d==='phone');
  $('#dev-desktop').setAttribute('aria-pressed',d==='desktop'); $('#dev-phone').setAttribute('aria-pressed',d==='phone');
  fitPhone();
}
$('#dev-desktop').onclick=()=>setDevice('desktop');
$('#dev-phone').onclick=()=>setDevice('phone');

/* ---------- boot ---------- */
function mergeDefaults(cfg){
  const s=makeDefaults();
  for(const k in cfg){
    const v=cfg[k];
    if(v&&typeof v==='object'&&!Array.isArray(v)&&s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])) s[k]={...s[k],...v};
    else if(v!==undefined) s[k]=v;
  }
  s.sketchbook.photos=s.sketchbook.photos||{};
  return s;
}
async function boot(){
  try{ siteCfg={...siteCfg,...await api('config')}; }catch{}
  const q=new URLSearchParams(location.search), id=q.get('id'), key=q.get('key');
  if(id&&key){
    session={id,key};
    try{
      const {gift}=await api(`gifts/${id}`);
      state=mergeDefaults(gift.config||{});
      meta={status:gift.status, slug:gift.slug, url:gift.url, email:gift.email||'', phone:gift.phone||''};
      setSave(meta.status==='paid'?'Saved · changes are live':'Saved'); remember();
    }catch(e){
      session=null; history.replaceState(null,'','/create');
      toast(e.status===404?"We couldn't open that gift. The edit link may be incomplete, or the gift was deleted.":e.message,true);
      setSave('Not saved yet');
    }
  } else setSave('Not saved yet');
  renderTabs(); renderPanel(); renderTop(); refresh(true);
  booted=true;
  if(meta.status==='paid'&&q.get('share')==='1') showLive(meta.url);
}
boot();
