/*! Shared by the builder (create.html) and the demo page: default gift content, time zones and the
 *  data shape handed to renderGift(). Keep TIME ZONES in sync with server/time.js. */
(function(){
const TZ=[['Asia/Kolkata','India (IST)','IST'],['local','Their own time zone','their local time'],['Europe/London','UK','UK time'],['America/New_York','US Eastern','ET'],['America/Chicago','US Central','CT'],['America/Los_Angeles','US Pacific','PT'],['Asia/Dubai','Gulf (GST)','GST'],['Asia/Singapore','Singapore (SGT)','SGT'],['Australia/Sydney','Sydney','Sydney time']];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function makeDefaults(daysAhead=7){
  const base = {
  name: 'Sana',
  photos: [],
  show: { curtain:true, age:true, birthday:true, polaroids:true, sketchbook:true, galaxy:true, chat:true },
  unlock:   { date: '', tz: 'Asia/Kolkata' },
  curtain:  { title: 'Now showing', subtitle: 'Dropping on {date}', ticker: 'Save the date', label: 'A little something for', button: 'Open your gift' },
  age:      { age: 25, above: 'Today, {name} turns', below: 'and somehow gets better every single year.' },
  birthday: { date: 'Oct 2', first: 'Happy', second: 'Birthday',
              wish: 'Wishing you a day filled with love, laughter, and all the happiness your heart can hold. May this year bring you endless joy and unforgettable memories. Happy Birthday!',
              footer: 'Made for you' },
  polaroids:{ title: 'Proof you light up every room', flowers: true, butterflies: true, count: 7, items: ['that one summer','best day ever','us, obviously','golden hour','never growing up','my favourite human'] },
  sketchbook:{ title: '{name}’s sketchbook', pages: 6, cover: '', photos: {}, items: ['it would’ve been you','may the flowers remind us why the rain was so necessary','you make ordinary days feel like a holiday','stay a little weird','here’s to the next chapter','forever my favourite story'] },
  galaxy:   { title: 'Every version of {name}', shooting: true, items: ['Baddie','Angel','Dreamgirl','Sweetheart','Icon','Stunner','Sunshine','Bestie','Queen','Firecracker','Cutie'] },
  chat:     { contact: 'Sweet {name}', items: ['Happpyyyyy birthday love','I wanted this one to be extra special','so I made you a little something','I hope it puts the biggest smile on your face 😊','Happpyyyy bday, {name} 🎂'] }
};
  const d=new Date(); d.setDate(d.getDate()+daysAhead); base.unlock.date=isoDate(d);
  return base;
}
function tzOffset(tz,ts){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ts)).map(x=>[x.type,x.value]));
  return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second)-ts;
}
function midnightIn(dateStr,tz){
  const [y,m,d]=dateStr.split('-').map(Number), guess=Date.UTC(y,m-1,d);
  const first=guess-tzOffset(tz,guess); return guess-tzOffset(tz,first);
}
const ordinal=n=>n+((n%100>=11&&n%100<=13)?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
function unlockInfoFor(u){
  if(!u||!u.date) return null;
  const [y,m,d]=u.date.split('-').map(Number); const z=TZ.find(x=>x[0]===u.tz)||TZ[0];
  const local=z[0]==='local';
  return {date:u.date, local, at: local?null:midnightIn(u.date,z[0]), long:`${ordinal(d)} ${MONTHS[m-1]}`, short:`${MONTHS[m-1]} ${d}`, zone:z[2]};
}
function unlockNoteFor(u){
  const info=unlockInfoFor(u); if(!info) return 'No date set, so they can open it any time.';
  const [y,m,d]=info.date.split('-').map(Number);
  const at=info.local?new Date(y,m-1,d).getTime():info.at, ms=at-Date.now();
  if(ms<=0) return 'That date has already started, so the gift opens right away.';
  const days=Math.floor(ms/864e5), hrs=Math.floor(ms%864e5/36e5);
  const when=info.local?'in their own time zone':info.zone;
  return `Opens at 12:00 AM on ${info.long} ${y} (${when}), in ${days} day${days===1?'':'s'} and ${hrs} hour${hrs===1?'':'s'}.`;
}
/** The object renderGift() expects, built from builder state. */
function giftData(state, opts={}){
  const clean = list => (list||[]).map(s=>String(s).trim()).filter(Boolean);
  return {
    name: (state.name||'').trim() || 'you',
    photos: state.photos,
    show: state.show,
    curtain: state.curtain, age: state.age, birthday: state.birthday,
    polaroids: {...state.polaroids, items: clean(state.polaroids.items)},
    sketchbook:{...state.sketchbook, items: clean(state.sketchbook.items)},
    galaxy:    {...state.galaxy, items: clean(state.galaxy.items)},
    chat:      {...state.chat, items: clean(state.chat.items)},
    unlock: unlockInfoFor(state.unlock),
    preview: !!opts.preview,
    startAt: opts.startAt || null,
    complete: true
  };
}
const FONTS='https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,500;12..96,800&family=Caveat:wght@500;700&family=Anton&family=Yellowtail&family=Space+Mono:wght@400;700&family=Figtree:wght@400;500;600;700&display=swap';
window.GiftShared={TZ,MONTHS,makeDefaults,unlockInfoFor,unlockNoteFor,giftData,isoDate,FONTS};
})();
