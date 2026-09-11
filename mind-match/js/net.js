/* Verbindungsaufbau und Herzschlag zwischen den Geraeten. */

function fail(m){ screen="error"; errMsg=m; render(); }

function startHost(name,resume){
  isHost=true; myName=name; screen="connecting"; render();
  claim(resume?resume.code:genCode(),resume?resume.state:null,0);
}
/* Der eigene Eintrag – der Host legt sich selbst mit an. */
function neuerSpieler(){
  return {pid:myPid,name:myName,emoji:myEmoji,color:myColor,score:0,
          leben:3,raus:false,antwort:null,getroffen:false,online:true,connId:null};
}
function claim(code,restore,attempt){
  const p=new Peer(PREFIX+code,{debug:0});
  let opened=false;
  p.on("open",()=>{
    opened=true; peer=p; roomCode=code;
    if(restore){
      H=restore; H.kicked=H.kicked||[]; H.chat=H.chat||[];
      H.tKing=H.tKing||0; H.tAnswer=H.tAnswer||0;
      H.used=H.used||[]; H.fragen=H.fragen||[]; H.kingAntworten=H.kingAntworten||[]; H.verlauf=H.verlauf||[];
      H.qi=H.qi||0; H.kingZaehler=H.kingZaehler||0;
      if(!Array.isArray(H.kat)||!H.kat.length) H.kat=KATEGORIEN.map(function(k){return k.id;});
      H.maxRounds=H.maxRounds||0; H.proRunde=H.proRunde||5; H.startLeben=H.startLeben||3;
      const me=hp(myPid);
      if(me){ me.online=true; me.connId=null; myName=me.name; me.emoji=myEmoji||me.emoji||""; me.color=(myColor===0||myColor)?myColor:me.color; }
      else H.players.push(neuerSpieler());
    }else{
      H=freshState();
      H.players.push(neuerSpieler());
    }
    screen="game"; banner=""; broadcast();
    clearInterval(sweepTimer); sweepTimer=setInterval(hostSweep,2000);
  });
  p.on("connection",c=>{
    let pid=null;
    c.on("open",()=>{ conns[c.peer]=c; });
    c.on("data",d=>{
      conns[c.peer]=c;
      if(d&&d.t==="join") pid=d.pid;
      hostHandle(c.peer,pid,d);
    });
    c.on("close",()=>hostOffline(c.peer));
    c.on("error",()=>{});
  });
  p.on("error",e=>{
    if(opened) return;
    if(e.type==="unavailable-id"&&attempt<6){
      try{p.destroy();}catch(_){}
      setTimeout(()=>claim(restore?code:genCode(),restore,attempt+1),restore?1800:120);
      return;
    }
    fail(peerErr(e));
  });
  p.on("disconnected",()=>{ try{p.reconnect();}catch(_){} });
}

function startClient(code,name){
  isHost=false; myName=name; roomCode=code; screen="connecting"; render();
  LS.set("mm_room",{code,name,ts:Date.now(),owner:myPid});
  const p=new Peer({debug:0});
  peer=p;
  p.on("open",()=>connectHost());
  p.on("error",e=>{
    if(e.type==="peer-unavailable"){ scheduleRetry(); return; }
    if(screen==="connecting"&&retries===0) fail(peerErr(e)); else scheduleRetry();
  });
  p.on("disconnected",()=>{ try{p.reconnect();}catch(_){} });
}
function connectHost(){
  if(!peer||peer.destroyed) return;
  let c;
  try{ c=peer.connect(PREFIX+roomCode,{reliable:true}); }catch(_){ scheduleRetry(); return; }
  hostConn=c;
  const guard=setTimeout(()=>{ if(!c.open) scheduleRetry(); },9000);
  c.on("open",()=>{
    clearTimeout(guard); retries=0; banner=""; lastHb=Date.now();
    screen="game"; c.send({t:"join",pid:myPid,name:myName,emoji:myEmoji,color:myColor}); render();
  });
  c.on("data",d=>{
    if(!d) return;
    lastHb=Date.now();
    if(d.t==="hb"){ if(banner){ banner=""; render(); } return; }
    if(d.t==="state"){ S=d.s; screen="game"; banner=""; render(); }
    else if(d.t==="kick"||d.t==="denied"){ LS.delMine("mm_room"); screen="kicked"; teardown(); render(); }
  });
  c.on("close",()=>{ clearTimeout(guard); scheduleRetry(); });
  c.on("error",()=>{ clearTimeout(guard); scheduleRetry(); });
}
function scheduleRetry(){
  if(screen==="kicked"||isHost) return;
  if(retryTimer) return;
  retries++;
  if(retries>40){ fail("Der Host ist nicht mehr erreichbar. Wahrscheinlich hat er die Seite geschlossen."); return; }
  banner="Verbindung unterbrochen – versuche erneut…";
  if(!S) screen="connecting";
  render();
  retryTimer=setTimeout(()=>{ retryTimer=null; connectHost(); },2000);
}
let lastHb=Date.now();
setInterval(()=>{                                   // Client meldet sich beim Host
  if(isHost||!hostConn||!hostConn.open) return;
  try{ hostConn.send({t:"ping"}); }catch(_){}
},BEAT);
setInterval(()=>{                                   // Client merkt, wenn der Host verstummt
  if(isHost||screen!=="game"||retryTimer) return;
  if(Date.now()-lastHb>HOSTDEAD){ try{hostConn&&hostConn.close();}catch(_){} scheduleRetry(); }
},4000);
function teardown(){ try{peer&&peer.destroy();}catch(_){} peer=null;hostConn=null; }
function peerErr(e){
  if(e.type==="peer-unavailable") return "Diesen Raum gibt es nicht (mehr).";
  if(e.type==="network"||e.type==="server-error") return "Keine Verbindung zum Vermittlungsserver. Internet prüfen und neu laden.";
  if(e.type==="browser-incompatible") return "Dieser Browser unterstützt WebRTC leider nicht.";
  return "Verbindungsfehler: "+(e.type||e.message||"unbekannt");
}
