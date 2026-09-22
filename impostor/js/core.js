/* Grundlagen: Speicher, Identitaet, Hilfsfunktionen, gemeinsamer Zustand. */

const ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAXAGE=6*3600*1000;
const app=document.getElementById("app");
const el=i=>document.getElementById(i);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const genCode=()=>Array.from({length:4},()=>ALPHA[(Math.random()*ALPHA.length)|0]).join("");
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const LS={
  get(k,d){ try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(_){return d;} },
  set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(_){} },
  del(k){ try{localStorage.removeItem(k);}catch(_){} },
  /* Nur loeschen, was diesem Tab gehoert – mehrere Tabs teilen sich den Speicher. */
  delMine(k){ const o=this.get(k,null); if(o&&o.owner&&o.owner!==myPid) return; this.del(k); }
};
const EMOJIS=[
  "🐰","🦊","🐼","🐸","🐙","🦉","🐝","🦄","🐺","🦁","🐨","🦈","🐢","🐧","🦋","🐷",
  "🐮","🐹","🐔","🦆","🦅","🦇","🐗","🦝","🦡","🦦","🦥","🦩","🦜","🐬","🐳","🦭",
  "🦖","🦕","🐉","🦂","🕷️","🐌","🦀","🐡","🦑","🐍","🦎","🐊","🦔","🐴","🦒","🐘",
  "🐒","🦍","🦧","🐆","🐅","🐄","🐖","🐑","🐐","🦙","🦌","🦫","🐿️","🦨","🦘","🐇",
  "🦃","🦚","🕊️","🦢","🐓","🐋","🦞","🦐","🦪","🐠","🐟","🐚","🦠","🦓","🦛","🐪",
  "🐫","🐜","🦗","🪲","🪳","🦟","🪰","🐛","🐕","🐈","🐩","🦮","🐕‍🦺","🐈‍⬛","🐁","🐀",
  "👽","🤖","👻","🎃","💀","☠️","🥷","🧙","🧛","🧜","🧟","🤡","🤠","🕶️","🎩","👑",
  "🧑‍🚀","🧑‍🎤","🧑‍🍳","🧑‍🔧","🧑‍🚒","🕵️","💂","🥸","🦸","🦹","🧚","🧞","🧝","👮","👷","🤴",
  "👸","🧑‍⚕️","🧑‍🏫","🧑‍🌾","🧑‍🎨","🧑‍🔬","🧑‍💻","🧑‍⚖️","🧑‍✈️","🤶","🎅","🧌","👼","🙋","🤷","💁",
  "🙆","🧘","🤺","🏇","🤹","🧗","🍕","🌮","🍄","🍩","🍔","🌭","🍟","🍿","🍦","🍪",
  "🥑","🍉","🍒","🌶️","🥕","☕","🍺","🧃","🍫","🍰","🥐","🥨","🧀","🥞","🍣","🍜",
  "🍇","🍌","🍍","🥥","🍑","🥝","🍋","🍅","🥦","🧁","🍭","🥤","🍎","🍐","🍓","🫐",
  "🥭","🍈","🥔","🌽","🥬","🥒","🫑","🧄","🧅","🥜","🌰","🍞","🥖","🥯","🥚","🍳",
  "🥓","🥩","🍗","🍖","🌯","🥙","🧆","🥗","🍝","🍲","🍛","🍱","🍙","🍘","🍢","🍡",
  "🍧","🍨","🥧","🍬","🍯","🥛","🍵","🧉","🍾","🍷","🍸","🍹","🥂","🥃","🧊","⚽",
  "🏀","🏈","🎾","🏐","🥊","🏓","🏸","⛳","🎿","🏂","🛹","🚴","🏋️","🤸","🏆","🥇",
  "🥈","🥉","🏅","🎖️","🏹","🎣","🤿","🏊","🚣","⛸️","🛷","🥌","🏒","🏑","🥍","🏉",
  "🎱","🪀","🪁","🎽","🥋","🤼","⚾","🥎","🏏","🎸","🎹","🎺","🎻","🥁","🎧","🎤",
  "🎬","🎮","🕹️","🎲","🃏","🎯","🎳","🧩","🪗","🪕","🎷","📯","🔔","🎼","🎵","🎶",
  "🎙️","📻","💿","📀","🎞️","📽️","🎪","🎭","🖼️","🎨","🧵","🧶","🚀","🛸","✈️","🚁",
  "🚂","🚗","🏎️","🛵","🚲","⛵","🛶","🚜","🚌","🛻","🏍️","🚓","🚑","🚒","🚕","🚙",
  "🚐","🚚","🚛","🚎","🚊","🚉","🚄","🚅","🛺","🛴","🛼","⚓","🚢","🛩️","🪂","🎡",
  "🎢","🎠","🗼","🗽","🏰","🏯","⛺","🏕️","🏝️","🏔️","🌋","🗻","🌈","⭐","🌙","☀️",
  "⚡","🔥","❄️","🌊","🌵","🌴","🌻","🌸","🍀","🍁","🌍","🪐","🌞","🌝","🌚","🌛",
  "🌜","☄️","💫","✨","🌟","🌤️","⛅","🌦️","🌧️","⛈️","🌩️","🌪️","🌫️","🌬️","💧","☔",
  "⛄","🌱","🌲","🌳","🌾","🌿","☘️","🍂","🍃","🌷","🌹","🌺","🌼","💐","🪷","🪸",
  "💎","🔮","🧲","🎁","🎈","🎉","🧸","🪄","🔑","🗝️","💡","🕯️","📚","🖌️","🧭","🪩",
  "⏰","⌛","🔭","🔬","🧪","🧬","💊","🩺","🛠️","🔧","🔨","⚙️","🧰","🪛","🔒","🛡️",
  "⚔️","🏴‍☠️","🎓","📷","📸","📺","☎️","💰","💳","🧾","✏️","📝","📌","📎","🗂️","📦",
  "🛒","🧳","👓","🥽","👟","👜","🎒","⌚","💍","🪙","🧿","🎰","🚦","🚧","🗿","🧱",
  "🪑","🛋️","🛏️","🚪","🪟","🧹","🧺","🧴","🪥","🧼","🛁","🚿","🦣","🐃","🐂","🦬",
  "🐏","🐎","🦤","🐦","🐥","🐣","🪺","🪹","🕸️","🪱","🐞","🧜‍♂️","🧙‍♀️","🧝‍♂️","🧞‍♀️","🧛‍♀️",
  "🧟‍♂️","🦸‍♀️","🦹‍♂️","👨‍🎤","👩‍🎨","👨‍🚒","👩‍✈️","👨‍🍳","👩‍🔬","👨‍🏭","👩‍💼","🧑‍🎓","🕺","💃","🤾","🏌️",
  "🧖","🧑‍🦽","🧑‍🦯","🍏","🫒","🫘","🫓","🍠","🥟","🥡","🍤","🍥","🥮","🍮","🧇","🥪",
  "🫖","🥣","🍶","🧋","🥄","🍴","🪈","🪘","🎚️","🎛️","🖥️","🖨️","🕰️","⏳","🔎","🔗",
  "📐","📏","🗳️","📊","📈","🧮","🪜","🧯","🔦","🪤","🪝","🩹","🧽","🪣","🚤","🛥️",
  "🚟","🚠","🚡","🛰️","🌌","🏜️","🏞️","🌅","🌄","🌇","🌆","🌉","🎇","🎆","🌠","🗺️",
  "🪵","🪨","🪴","♟️","🀄","🎴","🪆","🪅","🎊","🎏","🎐","🧨","🪃","🥏","🩰","🥾",
  "🧢","⛑️","🪖","💄","💅","🔱","⚗️"
];

/* Kleinere Auswahl fuer den Chat – Mimik, Gesten, Reaktionen. */
const CHATEMOJIS=[
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗",
  "😚","😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","😣",
  "😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥",
  "😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😲","🥱","😴","🤤","😪","😵",
  "🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👻","💀","👽","🤖","🎃","👍",
  "👎","👌","🤌","✌️","🤞","🤟","🤘","👏","🙌","🙏","💪","🤝","👋","🖐️","✋","🫡","🫠","🫣",
  "🫢","👀","🧠","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💯","🔥","✨","⭐","🎉","🎊",
  "🏆","🥇","👑","💩","🤡","🍀","☕","🍺","🍻","🍕","🎁","⏰","✅","❌","⚡","💤","😙","🥲",
  "😝","🫥","😶‍🌫️","😮‍💨","😌","😵‍💫","🥸","🫤","☹️","😮","🥹","😦","😧","☠️","👹","👺","👾","😺",
  "😸","😹","😻","😼","😽","🙀","😿","😾","🤎","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝",
  "💟","💌","💋","💢","💥","💫","💦","💨","🕳️","💬","💭","🗯️","🤏","🫰","🤙","👈","👉","👆",
  "👇","☝️","🫵","🤚","🖖","✍️","💅","🤳","🦾","🦵","🦶","👂","👃","🫀","🫁","🦷","🦴","👁️",
  "👅","👄","🫦","👐","🤲","🫶","🤜","🤛","✊","👊","🙋","🙋‍♂️","🙋‍♀️","🤷","🤷‍♂️","🤷‍♀️","🙆","🙅",
  "💁","🙇","🤦","🧏","🧑‍🦰","👶","🧓","🕺","💃","🕴️","👯","🧖","🧘","🚶","🏃","🧎","🤸","🤼",
  "🤾","🏋️","🚴","🏊","🤺","🏌️","🧗","🤹","🎯","🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨",
  "🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺",
  "🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🕷️","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦀",
  "🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🦓","🦍","🐘","🦛","🐪","🦒","🦘","🐄","🐎",
  "🐖","🐑","🐕","🐈","🐇","🐿️","🦔","🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈",
  "🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🌽","🥕","🧄","🧅","🥔",
  "🍠","🥐","🥯","🍞","🥖","🧀","🥚","🍳","🥞","🧇","🥓","🍔","🍟","🌭","🥪","🌮","🌯","🥙",
  "🍝","🍜","🍲","🍣","🍱","🥟","🍤","🍚","🍥","🥠","🍦","🍩","🍪","🎂","🍰","🧁","🥧","🍫",
  "🍬","🍭","🍮","🍯","🍿","🧂","🍵","🧃","🥤","🧋","🥂","🍷","🥃","🍸","🍹","🍾","🧊","⚽",
  "🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥅","⛳","🏹","🎣","🥊","🥋","🛹","🛼","🎿",
  "⛸️","🥌","🎽","🥈","🥉","🎖️","🎮","🕹️","🎲","🧩","🎰","🎳","🎨","🎬","🎤","🎧","🎼","🎹",
  "🥁","🎷","🎺","🎸","🪕","🎻","🚗","🚕","🚙","🚌","🏎️","🚓","🚑","🚒","🚚","🚜","🛵","🏍️",
  "🚲","✈️","🚀","🛸","🚁","⛵","🚢","🏝️","🏔️","🌋","🏕️","🎡","🎢","🎪","☀️","🌤️","⛅","🌧️",
  "⛈️","❄️","⛄","🌪️","🌈","💧","🌊","🌙","🌟","☄️","🎈","🎀","🪅","🧨","🕯️","💡","🔦","📱",
  "💻","⌨️","🖥️","🖨️","📷","📸","🎥","📺","📻","⏳","⌛","📅","📆","🗓️","📌","📎","✂️","📏",
  "📐","🔒","🔑","🗝️","🔨","🪓","🛠️","🔧","🔩","⚙️","🧲","🔫","💣","🪃","🛡️","🚬","⚰️","🧸",
  "🪄","🔮","🧿","📚","📖","📝","✏️","🖊️","💰","💵","💳","🧾","📦","🛒","🧳","🎩","🕶️","👟",
  "💍","💎","🚽","🧻","🧼","🛁","🧹","🪣","🗑️","🚪","🛏️","🛋️","🪑","⭕","❗","❓","‼️","⁉️",
  "🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","⬛","⬜","🔺","🔻",
  "🔶","🔷","♻️","⚠️","🚫","🔞","📵","🆗","🆒","🆕","🆓","🔝","🔜","➡️","⬅️","⬆️","⬇️","↩️",
  "↪️","🔄","🔀","▶️","⏸️","⏹️","🔇","🔊","🔔","🔕","➕","➖","✖️","➗","💲","🅰️","🆎","🈶",
  "㊗️","🎦","🔍","🔎"
];
/* Farbvorgaben als echte Farbwerte. Eigene Farben werden genauso gespeichert,
   damit der Avatar exakt den gewaehlten Ton zeigt und nicht eine Naeherung. */
const FARBEN=["#a855f7","#d946ef","#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b","#eab308",
              "#84cc16","#22c55e","#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1"];  // Farbtoene
/* Umrechnung fuer den freien Farbwaehler: Wir speichern nur den Farbton,
   damit Avatare ueberall dieselbe kraeftige Abstufung bekommen. */
/* Aus einem Farbwert die Abstufungen fuer den Avatar bilden. */
function farbTeile(hex){
  return [parseInt(hex.substr(1,2),16),parseInt(hex.substr(3,2),16),parseInt(hex.substr(5,2),16)];
}
function mische(hex,f){                       // f<1 dunkler, f>1 heller
  const t=farbTeile(hex).map(v=>Math.max(0,Math.min(255,Math.round(v*f))));
  return "#"+t.map(v=>v.toString(16).padStart(2,"0")).join("");
}
function leuchtkraft(hex){
  const [r,g,b]=farbTeile(hex);
  return (0.299*r+0.587*g+0.114*b)/255;       // grob wahrgenommene Helligkeit
}
/* Aeltere Raeume haben statt eines Farbwerts noch eine Zahl (Farbton) gespeichert. */
function tonZuHex(h){
  const s=.85,l=.58,a=s*Math.min(l,1-l);
  const f=n=>{ const k=(n+h/30)%12;
    return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,Math.min(9-k,1))))).toString(16).padStart(2,"0"); };
  return "#"+f(0)+f(8)+f(4);
}
function farbeVon(p){
  const c=p&&p.color;
  if(typeof c==="string"&&/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if(typeof c==="number") return tonZuHex(c);
  return FARBEN[hue((p&&(p.pid||p.name))||"x")%FARBEN.length];   // ohne Wahl: aus dem Namen abgeleitet
}

let myEmoji=LS.get("fi_emoji","")||"";
let myColor=LS.get("fi_color",null);   // Farbwert wie "#22c55e", aelter: Zahl
function hue(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))%360; return h; }
function avatar(p,cls){
  const c=farbeVon(p);
  const off=(p.online===false)?" off":"";
  const hell=leuchtkraft(c)>0.62;
  if(p.emoji)
    return `<span class="av emo${off}${cls?" "+cls:""}" style="background:linear-gradient(140deg,${c},${mische(c,.6)})">${p.emoji}</span>`;
  return `<span class="av${off}${cls?" "+cls:""}" style="background:linear-gradient(140deg,${mische(c,1.15)},${c});color:${hell?"#0a0b12":"#fff"}">${esc((p.name||"?").trim().charAt(0).toUpperCase())}</span>`;
}

/* Eigene Identität. Überlebt Neuladen (sessionStorage bleibt im Tab bestehen),
   ist aber pro Tab eigen – so kann man auf einem Rechner zu dritt testen.
   Ein frisch geöffneter Tab übernimmt die gespeicherte Identität nur dann,
   wenn sie gerade kein anderer Tab benutzt (Heartbeat). */
const SS={
  get(k){ try{return sessionStorage.getItem(k);}catch(_){return null;} },
  set(k,v){ try{sessionStorage.setItem(k,v);}catch(_){} }
};
let myPid=SS.get("fi_pid");
if(!myPid){
  const base=LS.get("fi_pid",null), claim=LS.get("fi_pid_claim",0);
  if(base&&Date.now()-claim>8000){ myPid=base; }
  else { myPid=uid(); if(!base) LS.set("fi_pid",myPid); }
  SS.set("fi_pid",myPid);
}
if(myPid===LS.get("fi_pid",null)) LS.set("fi_pid_claim",Date.now());
setInterval(()=>{ if(myPid===LS.get("fi_pid",null)) LS.set("fi_pid_claim",Date.now()); },3000);

/* ============================ Zustand ============================ */
let isHost=false,roomCode="",myName="";
let hostConn=null;       // wird beim Aufraeumen zurueckgesetzt
let S=null;              // öffentlich sichtbarer Zustand
let H=null;              // Host: vollständiger Zustand
let myQuestion="";
let screen="start";      // start | invite | connecting | game | error | kicked
let errMsg="",banner="",fehlerRaum="";
let draftAnswer="",draftChat="",chatOpen=LS.get("fi_chatopen",true),chatSeen=0;
let skinOpen=LS.get("fi_skinopen",false);
let offeneKarten=LS.get("fi_offen",null)||{kat:false,zeit:false,skin:false,notif:false};
let chatEmojiOpen=false;           /* Emoji-Feld im Chat auf- oder zugeklappt */
let antwortAuf=null;               /* Nachricht, auf die gerade geantwortet wird */
let menuFuer=null;                 /* Nachricht, deren Aktionen gerade offen sind */
const REAKTIONEN=["👍","😂","❤️","😮","😢","🔥"];   /* Schnellreaktionen im Chat */
const zahlwort=(n,ein,viele)=>n+" "+(n===1?ein:viele);
const uhrzeit=ts=>{ const d=new Date(ts||Date.now());
  return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
let copiedUntil=0;                 /* zeigt kurz "Link kopiert" in der Raum-Pille */

/* Kopiert Text in die Zwischenablage. Die moderne Schnittstelle verlangt einen
   sicheren Kontext und eine echte Nutzergeste; klappt sie nicht, wird der aeltere
   Weg ueber ein verstecktes Textfeld versucht. */
async function inZwischenablage(text){
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(_){}
  try{
    const t=document.createElement("textarea");
    t.value=text; t.setAttribute("readonly","");
    t.style.cssText="position:fixed;top:-1000px;left:0;opacity:0";
    document.body.appendChild(t);
    t.select(); t.setSelectionRange(0,text.length);
    const ok=document.execCommand("copy");
    t.remove();
    return ok;
  }catch(_){ return false; }
}
let retryTimer=null,retries=0;

const url=new URL(location.href);
const rawInvite=(url.searchParams.get("r")||"").toUpperCase();
let inviteCode=/^[A-Z0-9]{4}$/.test(rawInvite)?rawInvite:"";
