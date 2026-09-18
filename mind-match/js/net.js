/* Verbindung zwischen den Geraeten.

   Frueher sprachen die Geraete direkt miteinander (WebRTC). Das ist schnell,
   scheitert aber an Netzen, die eine direkte Verbindung von aussen gar nicht
   zulassen - strenge Firmen- und Gaestenetze, manche Mobilfunkanschluesse.
   Genau daran sind Spiele ueber verschiedene Netze hinweg gescheitert.

   Jetzt laeuft alles ueber einen oeffentlichen Relay-Dienst: jedes Geraet baut
   nur eine ausgehende, verschluesselte WebSocket-Verbindung nach aussen auf -
   technisch dasselbe wie das Laden einer Webseite. Es gibt keine Verbindung
   mehr zwischen den Geraeten, die irgendein Router blockieren koennte. Damit
   ist es egal, wer in welchem Netz sitzt.

   Der Host bleibt der Spielserver: alle Nachrichten laufen ueber ihn, er
   rechnet und schickt den Zustand zurueck. Nur der Weg dorthin ist neu.

   Hinweis zur Vertraulichkeit: der Relay-Dienst ist oeffentlich und ohne
   Konto nutzbar. Die Spielnachrichten sind fuer niemanden interessant, aber
   sie sind auch nicht geheim - wer den Raum-Code kennt, koennte mitlesen. */

/* Nachgemessen: broker.hivemq.com stellt auch ganze Schwaelle vollstaendig
   zu, broker.emqx.io verliert dabei Nachrichten – deshalb diese Reihenfolge.
   Der dritte Eintrag ist nur der allerletzte Notnagel. */
const RELAYS=[
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://mqtt-dashboard.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt"
];
const APP="spielraum/mindmatch/";           // eigener Bereich je Spiel

let relais=null;                            // Verbindung zum Relay-Dienst
let relaisNr=0;                             // welcher Dienst gerade dran ist
let ownerTimer=null;                        // haelt die Raum-Anzeige frisch
let raumOffen=false;

const tOwner=c=>APP+c+"/owner";             // wer diesen Raum fuehrt (bleibt stehen)
const tHost =c=>APP+c+"/host";              // Nachrichten an den Host
const tAlle =c=>APP+c+"/all";               // Zustand fuer alle auf einmal
const tMir  =(c,pid)=>APP+c+"/p/"+pid;      // Nachrichten an einen Spieler

function fail(m){ screen="error"; errMsg=m; render(); }

/* --- Grundverbindung ---------------------------------------------------- */

/* Baut die Verbindung zum Relay auf. Klappt der eine Dienst nicht, wird beim
   naechsten Versuch der andere genommen. */
function verbinde(beiVerbindung){
  const url=RELAYS[relaisNr%RELAYS.length];
  let c;
  try{
    c=mqtt.connect(url,{
      clientId:"sr_"+myPid+"_"+Math.random().toString(36).slice(2,7),
      clean:true, connectTimeout:8000, reconnectPeriod:2500, keepalive:30
    });
  }catch(e){
    relaisNr++;
    fail("Der Verbindungsdienst ist nicht erreichbar. Internet prüfen und neu laden.");
    return null;
  }
  relais=c;
  let erste=true;
  c.on("connect",()=>{
    if(banner==="Verbindung unterbrochen – versuche erneut…"){ banner=""; render(); }
    beiVerbindung(erste); erste=false;       // nach einem Abriss neu anmelden
  });
  c.on("error",()=>{ relaisNr++; });          // beim naechsten Anlauf den anderen Dienst
  c.on("close",()=>{
    if(screen==="game"&&!banner){ banner="Verbindung unterbrochen – versuche erneut…"; render(); }
  });
  return c;
}
/* Wichtige Nachrichten werden bestaetigt zugestellt (QoS 1). Vorher ging
   alles unbestaetigt raus – bei mehreren Nachrichten kurz hintereinander kam
   ein Teil schlicht nicht an, und dann stand das Spiel still. Nur der
   Herzschlag darf verlorengehen, der kommt ohnehin gleich wieder. */
/* Auch die Empfangsseite muss bestaetigt zustellen lassen: ein Abo mit QoS 0
   stuft selbst bestaetigt verschickte Nachrichten wieder herunter. Deshalb
   werden alle Themen mit QoS 1 abonniert.

   Ausserdem werden ausgehende Nachrichten leicht entzerrt. Ein ganzer Schwall
   auf einmal kostet bei kostenlosen Diensten Nachrichten, obwohl sie alle
   bestaetigt werden – gedrosselt kommt alles an. Ein noch nicht abgeschickter
   Zustand wird dabei durch den neueren ersetzt, statt beide zu verschicken. */
const ABSTAND=70;
const warteschlange=[];
let schlangeLaeuft=false;

function sende(topic,daten,beilaeufig){
  if(!relais) return;
  if(beilaeufig){ direkt(topic,daten,0); return; }
  if(daten&&daten.t==="state"){
    for(let i=0;i<warteschlange.length;i++)
      if(warteschlange[i].topic===topic&&warteschlange[i].daten.t==="state"){
        warteschlange[i].daten=daten; return;
      }
  }
  if(warteschlange.length>200) warteschlange.shift();     // Notbremse
  warteschlange.push({topic,daten});
  arbeiteAb();
}
function direkt(topic,daten,qos){
  if(!relais||!relais.connected) return;
  try{ relais.publish(topic,JSON.stringify(daten),{qos}); }catch(_){}
}
function arbeiteAb(){
  if(schlangeLaeuft||!warteschlange.length) return;
  schlangeLaeuft=true;
  if(!relais||!relais.connected){                         // warten, nichts wegwerfen
    setTimeout(()=>{ schlangeLaeuft=false; arbeiteAb(); },500);
    return;
  }
  const n=warteschlange.shift();
  direkt(n.topic,n.daten,1);
  setTimeout(()=>{ schlangeLaeuft=false; arbeiteAb(); },ABSTAND);
}
/* Nachricht an einen einzelnen Spieler. */
function sendeAn(pid,msg,beilaeufig){
  if(pid!==myPid&&roomCode) sende(tMir(roomCode,pid),msg,beilaeufig);
}

function teardown(){
  clearInterval(ownerTimer); ownerTimer=null;
  if(relais){
    /* Die Raum-Anzeige loeschen, damit niemand mehr einen toten Raum findet. */
    if(isHost&&raumOffen&&roomCode){
      try{ relais.publish(tOwner(roomCode),"",{qos:0,retain:true}); }catch(_){}
    }
    try{ relais.end(true); }catch(_){}
  }
  relais=null; raumOffen=false; hostConn=null;
}

/* --- Raum eroeffnen ------------------------------------------------------ */

function startHost(name,resume){
  isHost=true; myName=name; screen="connecting"; render();
  const c=verbinde(erste=>{
    if(erste) belegeCode(resume?resume.code:genCode(), resume?resume.state:null, 0);
    else if(roomCode){                       // nach einem Abriss: alles neu anmelden
      relais.subscribe(tHost(roomCode),{qos:1});
      zeigeRaumAn();
      broadcast();
    }
  });
  if(!c) return;
  c.on("message",(topic,nutz)=>{
    if(topic!==tHost(roomCode)) return;
    let d=null; try{ d=JSON.parse(nutz.toString()); }catch(_){ return; }
    if(!d||!d.from) return;
    hostHandle(d.from,d.from,d);
  });
}

/* Der eigene Eintrag – der Host legt sich selbst mit an. */
function neuerSpieler(){
  return {pid:myPid,name:myName,emoji:myEmoji,color:myColor,score:0,
          leben:3,raus:false,antwort:null,getroffen:false,online:true,connId:myPid};
}

/* Prueft, ob der Code frei ist. Der fuehrende Spieler hinterlaesst beim Relay
   eine Notiz, die stehen bleibt – daran erkennt man belegte Raeume. */
function belegeCode(code,restore,versuch){
  let entschieden=false;
  const horcher=(topic,nutz)=>{
    if(entschieden||topic!==tOwner(code)) return;
    const roh=nutz.toString();
    if(!roh) return;                                   // geloeschte Notiz
    let d=null; try{ d=JSON.parse(roh); }catch(_){ return; }
    if(!d||d.pid===myPid) return;                      // unsere eigene alte Notiz
    if(Date.now()-(d.ts||0)>90000) return;             // laengst verwaist
    entschieden=true;
    relais.removeListener("message",horcher);
    relais.unsubscribe(tOwner(code));
    if(!restore){
      if(versuch<8){ belegeCode(genCode(),null,versuch+1); return; }
      fail("Es ließ sich gerade kein freier Raum-Code finden. Versuch es gleich nochmal.");
      return;
    }
    fehlerRaum=code;
    fail("Der Raum "+code+" wird gerade von einem anderen Gerät geführt. Mach mit einem neuen Raum weiter.");
  };
  relais.on("message",horcher);
  relais.subscribe(tOwner(code),{qos:1});
  /* Eine stehengebliebene Notiz kommt sofort. Kommt keine, ist der Code frei. */
  setTimeout(()=>{
    if(entschieden) return;
    entschieden=true;
    relais.removeListener("message",horcher);
    relais.unsubscribe(tOwner(code));
    oeffneRaum(code,restore);
  },1500);
}

function oeffneRaum(code,restore){
  roomCode=code; raumOffen=true;
  if(restore){
    H=restore; H.kicked=H.kicked||[]; H.chat=H.chat||[];
    H.tKing=H.tKing||0; H.tAnswer=H.tAnswer||0;
    H.used=H.used||[]; H.fragen=H.fragen||[]; H.kingAntworten=H.kingAntworten||[]; H.verlauf=H.verlauf||[];
    H.qi=H.qi||0; H.kingZaehler=H.kingZaehler||0;
    if(!Array.isArray(H.kat)||!H.kat.length) H.kat=KATEGORIEN.map(function(k){return k.id;});
    H.maxRounds=H.maxRounds||0; H.proRunde=H.proRunde||5; H.startLeben=H.startLeben||3;
    const me=hp(myPid);
    if(me){ me.online=true; me.connId=myPid; myName=me.name; me.emoji=myEmoji||me.emoji||""; me.color=(myColor===0||myColor)?myColor:me.color; }
    else H.players.push(neuerSpieler());
  }else{
    H=freshState();
    H.players.push(neuerSpieler());
  }
  relais.subscribe(tHost(code),{qos:1});
  zeigeRaumAn();
  clearInterval(ownerTimer);
  ownerTimer=setInterval(zeigeRaumAn,20000);      // Notiz frisch halten
  screen="game"; banner=""; broadcast();
  clearInterval(sweepTimer); sweepTimer=setInterval(hostSweep,2000);
}
function zeigeRaumAn(){
  if(!relais||!relais.connected||!roomCode) return;
  try{ relais.publish(tOwner(roomCode),JSON.stringify({pid:myPid,ts:Date.now()}),{qos:0,retain:true}); }catch(_){}
}

/* --- Raum beitreten ------------------------------------------------------ */

let lastHb=Date.now();

function startClient(code,name){
  isHost=false; myName=name; roomCode=code; screen="connecting"; render();
  LS.set("mm_room",{code,name,ts:Date.now(),owner:myPid});
  let gabsRaum=false;
  const c=verbinde(erste=>{
    relais.subscribe(tMir(code,myPid),{qos:1});
    relais.subscribe(tAlle(code),{qos:1});
    relais.subscribe(tOwner(code),{qos:1});
    meldeAn();
    if(erste) setTimeout(()=>{                       // gibt es den Raum ueberhaupt?
      if(!gabsRaum&&!S) fail("Diesen Raum gibt es nicht (mehr). Prüfe den Code – oder lass dir einen neuen Link schicken.");
    },9000);
  });
  if(!c) return;
  c.on("message",(topic,nutz)=>{
    const roh=nutz.toString();
    if(topic===tOwner(code)){ if(roh) gabsRaum=true; return; }
    if(topic!==tMir(code,myPid)&&topic!==tAlle(code)) return;
    let d=null; try{ d=JSON.parse(roh); }catch(_){ return; }
    if(!d) return;
    gabsRaum=true; lastHb=Date.now(); retries=0;
    if(d.t==="hb"){ if(banner){ banner=""; render(); } return; }
    if(d.t==="state"){ S=d.s; screen="game"; banner=""; render(); }
    else if(d.t==="kick"||d.t==="denied"){ LS.delMine("mm_room"); screen="kicked"; teardown(); render(); }
  });
}
function meldeAn(){
  sende(tHost(roomCode),{t:"join",from:myPid,pid:myPid,name:myName,emoji:myEmoji,color:myColor});
}

/* Der Client meldet sich regelmaessig beim Host. */
setInterval(()=>{
  if(isHost||!relais||!relais.connected||!roomCode||screen==="kicked") return;
  sende(tHost(roomCode),{t:"ping",from:myPid},true);
},BEAT);

/* Und merkt, wenn der Host verstummt. */
setInterval(()=>{
  if(isHost||screen!=="game"||!roomCode) return;
  if(Date.now()-lastHb<=HOSTDEAD) return;
  retries++;
  if(retries>40){ fail("Der Host ist nicht mehr erreichbar. Wahrscheinlich hat er die Seite geschlossen."); return; }
  if(!banner){ banner="Verbindung unterbrochen – versuche erneut…"; render(); }
  meldeAn();                                   // einfach noch einmal anklopfen
},4000);
