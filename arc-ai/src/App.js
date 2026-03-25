import { useState, useRef, useEffect, useCallback } from "react";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const THEMES = {
  dark:  { bg:"#0d0f12", s1:"#13161b", s2:"#1a1e25", s3:"#21262f", b1:"rgba(148,163,184,0.1)", b2:"rgba(148,163,184,0.18)", ab:"#cbd5e1", am:"#94a3b8", ad:"#475569", text:"#e2e8f0", g:"#4ade80", gd:"rgba(74,222,128,0.12)", gb:"rgba(74,222,128,0.25)", gc:"#052e16" },
  light: { bg:"#f8fafc", s1:"#ffffff", s2:"#f1f5f9", s3:"#e2e8f0", b1:"rgba(100,116,139,0.15)", b2:"rgba(100,116,139,0.25)", ab:"#1e293b", am:"#64748b", ad:"#94a3b8", text:"#1e293b", g:"#16a34a", gd:"rgba(22,163,74,0.08)", gb:"rgba(22,163,74,0.2)", gc:"#ffffff" },
};

const ask = async (messages, system, maxTokens = 1200) => {
  const r = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:MODEL, max_tokens:maxTokens, system, messages }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content?.map(b => b.text).join("") || "";
};

const analyzeImages = async (images) => {
  const content = images.flatMap(({ b64, mediaType, label }) => ([
    { type:"text", text:label },
    { type:"image", source:{ type:"base64", media_type: mediaType||"image/jpeg", data:b64 } }
  ]));
  content.push({ type:"text", text:`You are ARC AI, a friendly basketball coach. Analyze the player's form in simple everyday language — like talking to a friend. Keep it short and easy to understand.\n\nReturn EXACTLY two sections split by ---WORKOUTS---\n\nSECTION 1: In 3–5 short sentences say what you see, 2 things they're doing well, and 3 simple things to fix. Plain language. Use 🏀 once or twice.\n\n---WORKOUTS---\n\nSECTION 2: Raw JSON array (no fences) of 6 drills. Each: {"name":"...","sets":N,"reps":"...","category":"...","icon":"emoji","reason":"one short plain sentence"}` });
  const r = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:MODEL, max_tokens:1800, messages:[{ role:"user", content }] }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.content?.map(b => b.text).join("") || "";
};

const parseAnalysis = raw => {
  const si = raw.indexOf("---WORKOUTS---");
  const feedback = si !== -1 ? raw.slice(0, si).trim() : raw.trim();
  let drills = null;
  if (si !== -1) {
    try {
      const jp = raw.slice(si+14).replace(/```json|```/g,"").trim();
      const s = jp.indexOf("["), e = jp.lastIndexOf("]");
      if (s !== -1 && e !== -1) drills = JSON.parse(jp.slice(s, e+1));
    } catch {}
  }
  return { feedback, drills };
};

// Snap a frame from a video element
const snapFrame = (v) => {
  if (!v || v.readyState < 2 || !v.videoWidth) return null;
  const c = document.createElement("canvas");
  c.width = Math.min(v.videoWidth, 640);
  c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  const preview = c.toDataURL("image/jpeg", 0.75);
  return { b64: preview.split(",")[1], preview, t: v.currentTime.toFixed(1) };
};

const DEFAULT_WORKOUTS = [
  { id:1, name:"Treadmill Sprints", sets:6, reps:"30s on/30s off", category:"Cardio", icon:"🏃", reason:null },
  { id:2, name:"Barbell Squat", sets:4, reps:"8 reps @ 70%", category:"Lifting", icon:"🏋️", reason:null },
  { id:3, name:"Lateral Bounds", sets:3, reps:"12 each side", category:"Agility", icon:"⚡", reason:null },
  { id:4, name:"Bench Press", sets:4, reps:"10 reps", category:"Lifting", icon:"💪", reason:null },
  { id:5, name:"Box Jumps", sets:4, reps:"8 reps", category:"Plyometric", icon:"🚀", reason:null },
  { id:6, name:"Pull-Ups", sets:3, reps:"Max reps", category:"Lifting", icon:"🔥", reason:null },
  { id:7, name:"Defensive Slides", sets:3, reps:"30 sec", category:"Basketball", icon:"🏀", reason:null },
  { id:8, name:"Free Throws", sets:2, reps:"20 shots", category:"Basketball", icon:"🎯", reason:null },
];
const PLANS = [
  { id:1, title:"Rookie Grind", level:"Beginner", days:3, focus:"Fundamentals" },
  { id:2, title:"Varsity Edge", level:"Intermediate", days:5, focus:"Strength + Speed" },
  { id:3, title:"Pro Protocol", level:"Advanced", days:6, focus:"Full Athletic Development" },
];
const PLAN_DAYS = ["Sprints + Ballhandling","Lifting (Upper) + Shooting","Agility + Defense","Lifting (Lower) + Conditioning","Game Drills + Film Review","Full Athlete Workout"];
const CATEGORIES = ["Basketball","Lifting","Cardio","Agility","Plyometric","Mobility","Defense"];
const ICONS = ["🏀","🎯","🔥","⚡","🛡️","🚀","💪","🏃","🏋️","🦵","🧘","🥊"];
const TABS = [
  { id:"dashboard", l:"Home",     s:"⬡" },
  { id:"workout",   l:"Workout",  s:"◈" },
  { id:"plans",     l:"Plans",    s:"▦" },
  { id:"film",      l:"Film",     s:"◉" },
  { id:"coach",     l:"Coach",    s:"◎" },
  { id:"settings",  l:"Settings", s:"⚙" },
];

const ArcLogo = ({ g }) => (
  <svg width="40" height="32" viewBox="0 0 120 100">
    <defs><linearGradient id="ag"><stop offset="0%" stopColor="#86efac"/><stop offset="100%" stopColor={g}/></linearGradient></defs>
    <path d="M10 80 A50 50 0 0 1 110 80" fill="none" stroke="url(#ag)" strokeWidth="18" strokeLinecap="round"/>
    <text x="60" y="78" textAnchor="middle" fontSize="28" fontWeight="900" fill={g} fontFamily="Arial Black,sans-serif" stroke="#14532d" strokeWidth="1.2" paintOrder="stroke">ARC</text>
    <line x1="34" y1="84" x2="86" y2="84" stroke={g} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export default function App() {
  const [dark, setDark] = useState(true);
  const C = THEMES[dark ? "dark" : "light"];
  const [tab, setTab] = useState("dashboard");

  // workout
  const [workouts, setWorkouts] = useState(DEFAULT_WORKOUTS);
  const [done, setDone] = useState({});
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [newDrill, setNewDrill] = useState({ name:"", sets:3, reps:"10 reps", category:"Basketball", icon:"🏀" });
  const [generating, setGenerating] = useState(false);
  const [filmDrills, setFilmDrills] = useState(null);
  const [plan, setPlan] = useState(null);

  // film
  const [filmMode, setFilmMode] = useState("photo");
  const [photos, setPhotos] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [autoStatus, setAutoStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [filmResult, setFilmResult] = useState("");
  const [filmError, setFilmError] = useState("");

  // coach
  const [msgs, setMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [coachErr, setCoachErr] = useState("");

  const photoRef = useRef();
  const videoRef = useRef();
  const videoElRef = useRef();
  const chatEnd = useRef();

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  // Assign blob URL directly to video DOM element on file select


  const completed = Object.values(done).filter(Boolean).length;
  const progress = workouts.length ? Math.round(completed / workouts.length * 100) : 0;
  const isPersonalised = workouts.some(w => w.reason);

  // workout helpers
  const toggleDone = id => { if (editId===id) return; setDone(p => ({ ...p, [id]:!p[id] })); };
  const startEdit  = (w,e) => { e.stopPropagation(); setEditId(w.id); setDraft({ name:w.name, sets:w.sets, reps:w.reps, category:w.category, icon:w.icon }); };
  const saveEdit   = id => { setWorkouts(p => p.map(w => w.id===id ? { ...w, ...draft } : w)); setEditId(null); };
  const delDrill   = (id,e) => { e.stopPropagation(); setWorkouts(p => p.filter(w => w.id!==id)); setDone(p => { const n={...p}; delete n[id]; return n; }); if (editId===id) setEditId(null); };
  const addDrill   = () => { if (!newDrill.name.trim()) return; setWorkouts(p => [...p, { ...newDrill, id:Date.now(), sets:Number(newDrill.sets), reason:null }]); setNewDrill({ name:"", sets:3, reps:"10 reps", category:"Basketball", icon:"🏀" }); setAddOpen(false); };
  const applyFilm  = () => { if (!filmDrills) return; setWorkouts(filmDrills.map((w,i) => ({ ...w, id:Date.now()+i, sets:Number(w.sets) }))); setDone({}); setTab("workout"); };

  const genAI = async () => {
    setGenerating(true);
    try {
      const r = await ask([{ role:"user", content:"Generate 8 basketball athlete drills: cardio, lifting, agility, basketball." }],
        `You are ARC AI. Return ONLY a raw JSON array of 8 objects: {"name":"...","sets":N,"reps":"...","category":"...","icon":"single emoji","reason":"..."}. No markdown.`);
      const s=r.indexOf("["), e=r.lastIndexOf("]");
      setWorkouts(JSON.parse(r.slice(s,e+1)).map((w,i) => ({ ...w, id:Date.now()+i, sets:Number(w.sets) })));
      setDone({});
    } catch(err) { alert("Error: "+err.message); }
    setGenerating(false);
  };

  // film — photo
  const handlePhotoUpload = e => {
    const files = Array.from(e.target.files).slice(0,4);
    Promise.all(files.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res({ b64:ev.target.result.split(",")[1], mediaType:f.type||"image/jpeg", preview:ev.target.result });
      r.readAsDataURL(f);
    }))).then(imgs => { setPhotos(p => [...p,...imgs].slice(0,4)); setFilmResult(""); setFilmError(""); setFilmDrills(null); });
    e.target.value="";
  };

  // film — video: assign blob URL directly to DOM element (works in real browser)
  const handleVideoUpload = e => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value="";
    setCaptures([]); setFilmResult(""); setFilmError(""); setFilmDrills(null);
    setVideoReady(false); setAutoStatus("");
    const el = videoElRef.current;
    if (el) {
      if (el._blobUrl) URL.revokeObjectURL(el._blobUrl);
      el._blobUrl = URL.createObjectURL(f);
      el.src = el._blobUrl;
      el.load();
    }
  };

  // manual capture
  const captureFrame = useCallback(() => {
    const f = snapFrame(videoElRef.current);
    if (!f) return;
    setCaptures(p => p.length >= 5 ? p : [...p, f]);
  }, []);

  // auto capture — seek-based with play fallback
  const autoCapture = useCallback(async () => {
    const v = videoElRef.current;
    if (!v || autoCapturing) return;
    setAutoCapturing(true);
    setCaptures([]);
    setAutoStatus("Starting...");

    // wait for canplay
    if (v.readyState < 2) {
      setAutoStatus("Waiting for video...");
      await new Promise(res => {
        const h = () => { v.removeEventListener("canplay", h); res(); };
        v.addEventListener("canplay", h);
        setTimeout(res, 8000);
      });
    }

    if (!v.videoWidth) {
      setAutoStatus("Video not ready. Press play first then try again.");
      setAutoCapturing(false);
      return;
    }

    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : null;
    const grabbed = [];

    // Strategy A: seek
    if (dur) {
      const times = Array.from({ length:5 }, (_,i) => +(dur*0.08 + i*(dur*0.84/4)).toFixed(2));
      for (let i=0; i<times.length; i++) {
        setAutoStatus(`Capturing frame ${i+1} of 5...`);
        await new Promise(res => {
          const tid = setTimeout(() => { v.removeEventListener("seeked",h); res(); }, 2500);
          const h = () => { clearTimeout(tid); v.removeEventListener("seeked",h); const f=snapFrame(v); if(f) grabbed.push(f); res(); };
          v.addEventListener("seeked", h);
          v.currentTime = times[i];
        });
      }
    }

    if (grabbed.length >= 2) {
      setCaptures(grabbed);
      setAutoStatus(`✓ ${grabbed.length} frames captured`);
      setAutoCapturing(false);
      return;
    }

    // Strategy B: play at 4x and poll
    setAutoStatus("Playing to capture frames...");
    grabbed.length = 0;
    const savedRate = v.playbackRate;
    v.muted = true; v.playbackRate = 4;
    const clipDur = dur || 15;
    const step = clipDur * 0.84 / 4;
    let next = clipDur * 0.08;
    let last = 0;

    await new Promise(res => {
      const poll = setInterval(() => {
        if (grabbed.length >= 5 || v.ended) { clearInterval(poll); v.pause(); v.playbackRate=savedRate; res(); return; }
        if (v.currentTime >= next) {
          const f = snapFrame(v);
          if (f) { grabbed.push(f); next += step; if (grabbed.length !== last) { last=grabbed.length; setAutoStatus(`Captured ${grabbed.length} of 5...`); } }
        }
      }, 120);
      v.play().catch(() => {});
      setTimeout(() => { clearInterval(poll); v.pause(); v.playbackRate=savedRate; res(); }, ((clipDur/4)+5)*1000);
    });

    if (grabbed.length >= 1) {
      setCaptures(grabbed);
      setAutoStatus(`✓ ${grabbed.length} frames captured`);
    } else {
      setAutoStatus("Auto-capture failed — try manual capture instead.");
    }
    setAutoCapturing(false);
  }, [autoCapturing]);

  const runAnalysis = async images => {
    setAnalyzing(true); setFilmResult(""); setFilmError(""); setFilmDrills(null);
    try {
      const raw = await analyzeImages(images);
      const { feedback, drills } = parseAnalysis(raw);
      setFilmResult(feedback); setFilmDrills(drills);
    } catch(err) { setFilmError("Analysis failed: "+err.message); }
    setAnalyzing(false);
  };

  const analyzePhotos   = () => runAnalysis(photos.map((p,i)   => ({ b64:p.b64,  mediaType:p.mediaType,   label:`Photo ${i+1}:` })));
  const analyzeCaptures = () => runAnalysis(captures.map((c,i) => ({ b64:c.b64,  mediaType:"image/jpeg",  label:`Frame ${i+1} at ${c.t}s:` })));

  // coach
  const sendChat = async () => {
    if (!chatInput.trim() || thinking) return;
    const msg=chatInput.trim(); setChatInput(""); setCoachErr("");
    setMsgs(p => [...p, { role:"user", content:msg }]);
    setThinking(true);
    try {
      const r = await ask([...msgs, { role:"user", content:msg }],
        "You are ARC AI, a friendly basketball coach. Give helpful, plain-language advice on shooting, lifting, conditioning, agility, and game IQ. Keep it simple and motivating. Use 🏀 occasionally.");
      setMsgs(p => [...p, { role:"assistant", content:r }]);
    } catch(err) { setCoachErr("Error: "+err.message); }
    setThinking(false);
  };

  const card     = { background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14 };
  const inp      = { background:C.s2, border:`1px solid ${C.b2}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:16, outline:"none", width:"100%", fontFamily:"inherit", WebkitAppearance:"none" };
  const gBtn     = (dis=false) => ({ background:dis?"rgba(148,163,184,0.15)":C.g, border:"none", borderRadius:10, padding:"13px", fontSize:14, fontWeight:700, color:dis?C.ad:C.gc, cursor:dis?"not-allowed":"pointer", opacity:dis?0.6:1, width:"100%", fontFamily:"inherit", touchAction:"manipulation" });
  const ghostBtn = { background:C.s2, border:`1px solid ${C.b1}`, borderRadius:10, padding:"13px 16px", fontSize:14, color:C.ad, cursor:"pointer", fontFamily:"inherit", touchAction:"manipulation" };

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif", color:C.text, fontSize:15, WebkitTextSizeAdjust:"100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:${C.s3};border-radius:2px;}
        .tb{background:none;border:none;cursor:pointer;touch-action:manipulation;}
        @keyframes su{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pd{0%,100%{opacity:1}50%{opacity:.25}}
        .au{animation:su 0.2s ease forwards;}
        .sp{width:14px;height:14px;border:2px solid ${C.s3};border-top-color:${C.am};border-radius:50%;animation:spin .7s linear infinite;display:inline-block;flex-shrink:0;}
        .pf{height:100%;background:${C.g};border-radius:99px;transition:width .5s ease;}
        .dot{width:5px;height:5px;border-radius:50%;background:${C.am};animation:pd 1.4s infinite;}
        .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
        .rh:active{background:${C.s2} !important;}
        .cu{background:${C.s3};border:1px solid ${C.b2};border-radius:14px 14px 3px 14px;padding:10px 14px;max-width:82%;align-self:flex-end;font-size:14px;line-height:1.55;}
        .ca{background:${C.s1};border:1px solid ${C.b1};border-radius:14px 14px 14px 3px;padding:10px 14px;max-width:88%;align-self:flex-start;font-size:14px;line-height:1.75;color:${C.am};white-space:pre-wrap;}
        .er{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px 14px;font-size:13px;color:#f87171;line-height:1.55;}
        .tog{width:44px;height:26px;border-radius:99px;cursor:pointer;transition:background .2s;display:flex;align-items:center;padding:3px;touch-action:manipulation;}
        .tt{width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.25);}
        .plc{background:${C.s1};border:1px solid ${C.b1};border-radius:14px;padding:16px;cursor:pointer;transition:border-color .15s;}
        .plc.act{border-color:${C.g};}
        input,select{-webkit-appearance:none;appearance:none;font-size:16px!important;}
        select option{background:${C.s2};color:${C.text};}
        .ia{background:none;border:none;padding:8px;border-radius:8px;font-size:15px;cursor:pointer;color:${C.ad};touch-action:manipulation;}
        .ia:active{background:${C.s3};}
        .mb{flex:1;padding:10px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;border:1px solid ${C.b2};font-family:inherit;touch-action:manipulation;}
      `}</style>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:C.bg, borderBottom:`1px solid ${C.b1}`, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <ArcLogo g={C.g}/>
          <span style={{ fontSize:10, color:C.ad, letterSpacing:3, fontWeight:500 }}>AI</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:C.g, animation:"pd 2s infinite" }}/>
          <span style={{ fontSize:10, color:C.ad, letterSpacing:1.5 }}>ONLINE</span>
        </div>
      </div>

      <div style={{ paddingBottom:"calc(64px + env(safe-area-inset-bottom))" }}>

        {/* DASHBOARD */}
        {tab==="dashboard" && (
          <div className="au" style={{ padding:"20px 16px" }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>DASHBOARD</div>
              <div style={{ fontSize:26, fontWeight:800, color:C.ab, lineHeight:1.2 }}>Ready to work?</div>
            </div>
            <div style={{ ...card, padding:16, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:600, color:C.am, letterSpacing:1 }}>TODAY'S PROGRESS</span>
                <span style={{ fontSize:16, fontWeight:800, color:C.ab }}>{progress}%</span>
              </div>
              <div style={{ height:4, background:C.s3, borderRadius:99 }}><div className="pf" style={{ width:`${progress}%` }}/></div>
              <div style={{ fontSize:11, color:C.ad, marginTop:8 }}>
                {completed}/{workouts.length} drills{isPersonalised && <span style={{ color:C.g, marginLeft:8 }}>· film-personalised</span>}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[{ l:"Start Workout", s:`${workouts.length} drills`, t:"workout" }, { l:"Film Room", s:"Analyze your form", t:"film" }, { l:"AI Coach", s:"Ask anything", t:"coach" }, { l:"Training Plans", s:"3 plans", t:"plans" }].map(a => (
                <button key={a.t} onClick={() => setTab(a.t)} className="rh tb" style={{ ...card, padding:"14px", textAlign:"left" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.ab, marginBottom:3 }}>{a.l}</div>
                  <div style={{ fontSize:11, color:C.ad }}>{a.s}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WORKOUT */}
        {tab==="workout" && (
          <div className="au" style={{ padding:"20px 16px" }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>SESSION</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.ab }}>Workout Tracker</div>
              {isPersonalised && <div style={{ fontSize:10, color:C.g, letterSpacing:1, marginTop:3 }}>· FILM-PERSONALISED</div>}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {[
                { l:generating?"Generating...":"AI Generate", fn:genAI, dis:generating },
                filmDrills ? { l:"Apply Film Plan", fn:applyFilm, dis:false } : null,
                { l:"Reset", fn:() => { setWorkouts(DEFAULT_WORKOUTS); setDone({}); }, dis:false },
              ].filter(Boolean).map((b,i) => (
                <button key={i} onClick={b.fn} disabled={b.dis} className="tb" style={{ background:C.s2, border:`1px solid ${C.b2}`, borderRadius:8, padding:"9px 14px", fontSize:12, fontWeight:600, color:b.dis?C.ad:C.ab, cursor:b.dis?"not-allowed":"pointer", fontFamily:"inherit" }}>{b.l}</button>
              ))}
            </div>
            <div style={{ height:3, background:C.s3, borderRadius:99, marginBottom:6 }}><div className="pf" style={{ width:`${progress}%` }}/></div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.ad, marginBottom:14 }}>
              <span>{completed} done</span><span>{workouts.length-completed} left</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {workouts.map(w => (
                <div key={w.id}>
                  {editId===w.id ? (
                    <div style={{ ...card, background:C.s2, padding:14 }}>
                      <div style={{ fontSize:9, color:C.ad, letterSpacing:2, marginBottom:10 }}>EDIT DRILL</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        <div style={{ display:"flex", gap:8 }}>
                          <select value={draft.icon} onChange={e => setDraft(p => ({ ...p, icon:e.target.value }))} style={{ ...inp, width:58 }}>{ICONS.map(ic => <option key={ic}>{ic}</option>)}</select>
                          <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name:e.target.value }))} style={{ ...inp, flex:1 }} placeholder="Name"/>
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.ad, marginBottom:4 }}>SETS</div><input type="number" inputMode="numeric" min={1} max={20} value={draft.sets} onChange={e => setDraft(p => ({ ...p, sets:e.target.value }))} style={inp}/></div>
                          <div style={{ flex:2 }}><div style={{ fontSize:10, color:C.ad, marginBottom:4 }}>REPS</div><input value={draft.reps} onChange={e => setDraft(p => ({ ...p, reps:e.target.value }))} style={inp}/></div>
                        </div>
                        <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category:e.target.value }))} style={inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => saveEdit(w.id)} style={{ ...gBtn(), flex:1 }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ ...ghostBtn, flex:1 }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rh" onClick={() => toggleDone(w.id)} style={{ ...card, padding:"13px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", opacity:done[w.id]?0.45:1, transition:"opacity .2s" }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:done[w.id]?C.gd:C.s2, border:`1px solid ${done[w.id]?C.gb:C.b1}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{done[w.id]?"✓":w.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:done[w.id]?C.ad:C.ab, textDecoration:done[w.id]?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.name}</div>
                        <div style={{ fontSize:12, color:C.ad, marginTop:2 }}>{w.sets} sets · {w.reps} · <span style={{ color:C.am }}>{w.category}</span></div>
                        {w.reason && <div style={{ fontSize:11, color:C.g, marginTop:3 }}>· {w.reason}</div>}
                      </div>
                      <div style={{ display:"flex", flexShrink:0 }}>
                        <button className="ia" onClick={e => startEdit(w,e)}>✏</button>
                        <button className="ia" onClick={e => delDrill(w.id,e)}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {addOpen ? (
                <div style={{ ...card, background:C.s2, padding:14 }}>
                  <div style={{ fontSize:9, color:C.ad, letterSpacing:2, marginBottom:10 }}>NEW DRILL</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <select value={newDrill.icon} onChange={e => setNewDrill(p => ({ ...p, icon:e.target.value }))} style={{ ...inp, width:58 }}>{ICONS.map(ic => <option key={ic}>{ic}</option>)}</select>
                      <input value={newDrill.name} onChange={e => setNewDrill(p => ({ ...p, name:e.target.value }))} placeholder="Exercise name" style={{ ...inp, flex:1 }}/>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ flex:1 }}><div style={{ fontSize:10, color:C.ad, marginBottom:4 }}>SETS</div><input type="number" inputMode="numeric" min={1} max={20} value={newDrill.sets} onChange={e => setNewDrill(p => ({ ...p, sets:e.target.value }))} style={inp}/></div>
                      <div style={{ flex:2 }}><div style={{ fontSize:10, color:C.ad, marginBottom:4 }}>REPS</div><input value={newDrill.reps} onChange={e => setNewDrill(p => ({ ...p, reps:e.target.value }))} style={inp}/></div>
                    </div>
                    <select value={newDrill.category} onChange={e => setNewDrill(p => ({ ...p, category:e.target.value }))} style={inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={addDrill} style={{ ...gBtn(), flex:1 }}>Add</button>
                      <button onClick={() => setAddOpen(false)} style={{ ...ghostBtn, flex:1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddOpen(true)} className="tb" style={{ background:"none", border:`1px dashed ${C.b2}`, borderRadius:12, padding:"14px", width:"100%", fontSize:13, color:C.ad, cursor:"pointer", fontFamily:"inherit" }}>+ Add Exercise</button>
              )}
            </div>
          </div>
        )}

        {/* PLANS */}
        {tab==="plans" && (
          <div className="au" style={{ padding:"20px 16px" }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>TRAINING</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.ab }}>Your Plans</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {PLANS.map(p => (
                <div key={p.id} className={`plc ${plan?.id===p.id?"act":""}`} onClick={() => setPlan(p)}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:10, color:C.ad, letterSpacing:2, marginBottom:4 }}>{p.level.toUpperCase()}</div>
                      <div style={{ fontSize:17, fontWeight:700, color:C.ab }}>{p.title}</div>
                      <div style={{ fontSize:12, color:C.ad, marginTop:4 }}>{p.days}×/week · {p.focus}</div>
                    </div>
                    {plan?.id===p.id && <div style={{ background:C.gd, border:`1px solid ${C.gb}`, borderRadius:6, padding:"3px 10px", fontSize:10, fontWeight:700, color:C.g }}>ACTIVE</div>}
                  </div>
                </div>
              ))}
            </div>
            {plan && (
              <div style={{ ...card, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.am, letterSpacing:1, marginBottom:14 }}>{plan.title.toUpperCase()} — WEEK 1</div>
                {PLAN_DAYS.slice(0,plan.days).map((d,i) => (
                  <div key={i} style={{ display:"flex", gap:14, padding:"10px 0", borderBottom:i<plan.days-1?`1px solid ${C.b1}`:"none", alignItems:"center" }}>
                    <div style={{ fontSize:10, color:C.g, fontWeight:700, width:30, letterSpacing:1, flexShrink:0 }}>{"MON TUE WED THU FRI SAT".split(" ")[i]}</div>
                    <div style={{ fontSize:13, color:C.am }}>{d}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FILM */}
        {tab==="film" && (
          <div className="au" style={{ padding:"20px 16px" }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>AI ANALYSIS</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.ab }}>Film Room</div>
            </div>

            {/* mode toggle */}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[{ id:"photo", l:"📸 Photos" }, { id:"video", l:"🎬 Video" }].map(m => (
                <button key={m.id} className="mb" onClick={() => { setFilmMode(m.id); setFilmResult(""); setFilmError(""); setFilmDrills(null); }}
                  style={{ background:filmMode===m.id?C.gd:C.s1, color:filmMode===m.id?C.g:C.ad, borderColor:filmMode===m.id?C.gb:C.b2 }}>{m.l}</button>
              ))}
            </div>

            {/* PHOTO MODE */}
            {filmMode==="photo" && (
              <div>
                <input ref={photoRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display:"none" }}/>
                {photos.length===0 ? (
                  <div onClick={() => photoRef.current.click()} style={{ border:`1.5px dashed ${C.b2}`, borderRadius:14, padding:"44px 20px", textAlign:"center", cursor:"pointer", background:C.s2, marginBottom:12 }}>
                    <div style={{ fontSize:40, marginBottom:10, opacity:.5 }}>📸</div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.ab, marginBottom:6 }}>Tap to add photos</div>
                    <div style={{ fontSize:12, color:C.ad }}>Up to 4 photos of your form</div>
                  </div>
                ) : (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {photos.map((p,i) => (
                        <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", aspectRatio:"4/3", background:C.s3 }}>
                          <img src={p.preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                          <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))} style={{ position:"absolute", top:5, right:5, background:"rgba(0,0,0,.6)", border:"none", borderRadius:"50%", width:26, height:26, color:"#fff", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                          <div style={{ position:"absolute", bottom:4, left:6, fontSize:10, color:"rgba(255,255,255,0.9)", background:"rgba(0,0,0,0.5)", borderRadius:4, padding:"1px 6px" }}>Photo {i+1}</div>
                        </div>
                      ))}
                      {photos.length<4 && (
                        <div onClick={() => photoRef.current.click()} style={{ border:`1.5px dashed ${C.b2}`, borderRadius:10, aspectRatio:"4/3", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", background:C.s2, gap:6 }}>
                          <span style={{ fontSize:26, color:C.ad }}>+</span>
                          <span style={{ fontSize:11, color:C.ad }}>Add photo</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={analyzePhotos} disabled={analyzing} style={{ ...gBtn(analyzing), flex:1 }}>
                        {analyzing ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="sp"/>Analyzing...</span> : `Analyze ${photos.length} Photo${photos.length>1?"s":""}`}
                      </button>
                      <button onClick={() => { setPhotos([]); setFilmResult(""); setFilmError(""); setFilmDrills(null); }} style={{ ...ghostBtn }}>Clear</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIDEO MODE */}
            {filmMode==="video" && (
              <div>
                <input ref={videoRef} type="file" accept="video/*" onChange={handleVideoUpload} style={{ display:"none" }}/>

                {/* Always-mounted video element */}
                <video
                  ref={videoElRef}
                  controls
                  playsInline
                  webkit-playsinline="true"
                  style={{ width:"100%", maxHeight:220, borderRadius:12, background:"#000", display: videoFile ? "block" : "none", marginBottom:10 }}
                />

                {!videoFile ? (
                  <div onClick={() => videoRef.current.click()} style={{ border:`1.5px dashed ${C.b2}`, borderRadius:14, padding:"44px 20px", textAlign:"center", cursor:"pointer", background:C.s2, marginBottom:12 }}>
                    <div style={{ fontSize:40, marginBottom:10, opacity:.5 }}>🎬</div>
                    <div style={{ fontSize:16, fontWeight:700, color:C.ab, marginBottom:6 }}>Tap to select video</div>
                    <div style={{ fontSize:12, color:C.ad, marginBottom:10 }}>Play, pause at key moments, then capture frames</div>
                    <div style={{ display:"flex", justifyContent:"center", gap:5, flexWrap:"wrap" }}>
                      {["MP4","MOV","HEVC","WEBM"].map(f => <span key={f} style={{ background:C.s3, borderRadius:5, padding:"3px 8px", fontSize:10, color:C.am }}>{f}</span>)}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* status bar */}
                    {autoStatus && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, padding:"9px 12px", background:autoStatus.startsWith("✓")?C.gd:C.s2, border:`1px solid ${autoStatus.startsWith("✓")?C.gb:C.b2}`, borderRadius:10, marginBottom:10, color:autoStatus.startsWith("✓")?C.g:C.am }}>
                        {autoCapturing && <span className="sp"/>}
                        {autoStatus}
                      </div>
                    )}

                    {/* capture buttons */}
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <button onClick={captureFrame} disabled={captures.length>=5||autoCapturing} className="tb"
                        style={{ flex:1, background:captures.length>=5?C.s2:C.gd, border:`1.5px solid ${captures.length>=5?C.b2:C.gb}`, borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, color:captures.length>=5?C.ad:C.g, cursor:captures.length>=5?"not-allowed":"pointer", fontFamily:"inherit" }}>
                        {captures.length>=5 ? "5/5 captured" : `📸 Capture (${captures.length}/5)`}
                      </button>
                      <button onClick={autoCapture} disabled={autoCapturing||captures.length>=5} className="tb"
                        style={{ flex:1, background:C.s2, border:`1px solid ${C.b2}`, borderRadius:10, padding:"12px", fontSize:13, fontWeight:600, color:autoCapturing||captures.length>=5?C.ad:C.am, cursor:autoCapturing||captures.length>=5?"not-allowed":"pointer", fontFamily:"inherit" }}>
                        {autoCapturing ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><span className="sp"/>Working...</span> : "⚡ Auto-Capture"}
                      </button>
                    </div>
                    <div style={{ fontSize:11, color:C.ad, textAlign:"center", marginBottom:10 }}>Pause at a key moment → Capture · or tap Auto-Capture</div>

                    {/* captured thumbnails */}
                    {captures.length>0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:10, color:C.g, letterSpacing:2, marginBottom:6 }}>CAPTURED ({captures.length}/5)</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          {captures.map((f,i) => (
                            <div key={i} style={{ position:"relative", width:"calc(33% - 4px)", aspectRatio:"16/9", borderRadius:8, overflow:"hidden", background:C.s3 }}>
                              <img src={f.preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                              <div style={{ position:"absolute", bottom:2, left:3, fontSize:9, color:"rgba(255,255,255,0.85)", background:"rgba(0,0,0,0.5)", borderRadius:3, padding:"1px 4px" }}>{f.t}s</div>
                              <button onClick={() => setCaptures(p => p.filter((_,j) => j!==i))} style={{ position:"absolute", top:3, right:3, background:"rgba(0,0,0,.55)", border:"none", borderRadius:"50%", width:20, height:20, color:"#fff", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={analyzeCaptures} disabled={analyzing||captures.length===0} style={{ ...gBtn(analyzing||captures.length===0), flex:1 }}>
                        {analyzing ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="sp"/>Analyzing...</span> : captures.length===0 ? "Capture frames first" : "Analyze Frames"}
                      </button>
                      <button onClick={() => {                       setVideoFile(null); setCaptures([]); setAutoStatus(""); setFilmResult(""); setFilmError(""); setFilmDrills(null); const el=videoElRef.current; if(el){if(el._blobUrl)URL.revokeObjectURL(el._blobUrl);el.src="";el.load();} }} style={{ ...ghostBtn }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {filmError && <div className="er" style={{ marginTop:10 }}>{filmError}</div>}
            {filmResult && (
              <div style={{ marginTop:14 }}>
                <div style={{ ...card, padding:16, marginBottom:10 }}>
                  <div style={{ fontSize:10, color:C.g, letterSpacing:2, marginBottom:10, fontWeight:600 }}>SHOT ANALYSIS</div>
                  <div style={{ fontSize:13, color:C.am, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{filmResult}</div>
                </div>
                {filmDrills && (
                  <div style={{ ...card, border:`1px solid ${C.gb}`, padding:16 }}>
                    <div style={{ fontSize:10, color:C.g, letterSpacing:2, marginBottom:12, fontWeight:600 }}>PERSONALISED WORKOUT</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                      {filmDrills.map((w,i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                          <span style={{ fontSize:16, marginTop:1, flexShrink:0 }}>{w.icon}</span>
                          <div>
                            <div style={{ fontSize:14, fontWeight:600, color:C.ab }}>{w.name} <span style={{ color:C.ad, fontWeight:400 }}>· {w.sets}×{w.reps}</span></div>
                            <div style={{ fontSize:12, color:C.g, marginTop:2 }}>{w.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={applyFilm} style={gBtn()}>Load into Workout Tracker →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COACH */}
        {tab==="coach" && (
          <div className="au" style={{ display:"flex", flexDirection:"column", height:"calc(100dvh - 130px)" }}>
            <div style={{ padding:"20px 16px 12px", flexShrink:0 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>POWERED BY CLAUDE</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.ab }}>AI Coach</div>
            </div>
            {msgs.length===0 && (
              <div style={{ padding:"0 16px 14px", flexShrink:0 }}>
                <div style={{ ...card, padding:14, marginBottom:12, display:"flex", gap:12 }}>
                  <ArcLogo g={C.g}/>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.ab, marginBottom:4 }}>ARC AI</div>
                    <div style={{ fontSize:13, color:C.am, lineHeight:1.65 }}>What's up! Ask me anything — shot mechanics, lifting programs, conditioning, game IQ, or mental performance. 🏀</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {["Fix my jump shot","Build a lifting program","Improve my vertical","Best cardio for hoops"].map(q => (
                    <button key={q} onClick={() => setChatInput(q)} className="tb" style={{ ...card, padding:"11px 12px", fontSize:12, color:C.ad, textAlign:"left", lineHeight:1.4, fontFamily:"inherit" }}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"0 16px", display:"flex", flexDirection:"column", gap:8 }}>
              {msgs.map((m,i) => <div key={i} className={m.role==="user"?"cu":"ca"}>{m.content}</div>)}
              {thinking && <div className="ca"><div style={{ display:"flex", gap:4, alignItems:"center" }}><div className="dot"/><div className="dot"/><div className="dot"/></div></div>}
              {coachErr && <div className="er">{coachErr}</div>}
              <div ref={chatEnd}/>
            </div>
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.b1}`, flexShrink:0 }}>
              <div style={{ display:"flex", gap:8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&sendChat()} placeholder="Ask your coach..." enterKeyHint="send"
                  style={{ flex:1, background:C.s2, border:`1px solid ${C.b2}`, borderRadius:10, padding:"12px 14px", color:C.text, fontSize:16, outline:"none" }}/>
                <button onClick={sendChat} disabled={thinking||!chatInput.trim()} className="tb"
                  style={{ background:chatInput.trim()?C.g:C.s2, border:"none", borderRadius:10, padding:"12px 16px", fontSize:16, cursor:chatInput.trim()?"pointer":"not-allowed", color:chatInput.trim()?C.gc:C.ad, transition:"background .2s", flexShrink:0 }}>↑</button>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab==="settings" && (
          <div className="au" style={{ padding:"20px 16px" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, color:C.ad, letterSpacing:3, marginBottom:6 }}>PREFERENCES</div>
              <div style={{ fontSize:24, fontWeight:800, color:C.ab }}>Settings</div>
            </div>
            <div style={{ ...card, overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"12px 16px 4px", fontSize:10, color:C.ad, letterSpacing:2, fontWeight:600 }}>APPEARANCE</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:C.ab }}>Dark Mode</div>
                  <div style={{ fontSize:12, color:C.ad, marginTop:2 }}>Switch between light and dark</div>
                </div>
                <div className="tog" onClick={() => setDark(d => !d)} style={{ background:dark?C.g:C.s3 }}>
                  <div className="tt" style={{ transform:dark?"translateX(18px)":"translateX(0)" }}/>
                </div>
              </div>
            </div>
            <div style={{ ...card, overflow:"hidden", marginBottom:14 }}>
              <div style={{ padding:"12px 16px 4px", fontSize:10, color:C.ad, letterSpacing:2, fontWeight:600 }}>ABOUT</div>
              {[{ l:"Version", v:"1.0.0" }, { l:"Model", v:"Claude Sonnet 4" }, { l:"Video", v:"Works when hosted" }].map((s,i,a) => (
                <div key={s.l}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 16px" }}>
                    <div style={{ fontSize:14, fontWeight:500, color:C.ab }}>{s.l}</div>
                    <div style={{ fontSize:12, color:C.ad }}>{s.v}</div>
                  </div>
                  {i<a.length-1 && <div style={{ height:1, background:C.b1, margin:"0 16px" }}/>}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:28 }}>
              <ArcLogo g={C.g}/><span style={{ fontSize:10, color:C.ad, letterSpacing:3 }}>AI · BASKETBALL</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.bg, borderTop:`1px solid ${C.b1}`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)", paddingTop:8 }}>
        {TABS.map(t => {
          const active = tab===t.id;
          return (
            <button key={t.id} className="tb" onClick={() => setTab(t.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, paddingBottom:6 }}>
              <div style={{ fontSize:16, color:active?C.g:C.ad, transition:"color .15s", position:"relative" }}>
                {t.s}
                {t.id==="workout"&&filmDrills&&<span style={{ position:"absolute", top:-1, right:-4, width:5, height:5, background:C.g, borderRadius:"50%" }}/>}
              </div>
              <div style={{ fontSize:9, letterSpacing:.8, color:active?C.g:C.ad, fontWeight:active?700:400 }}>{t.l.toUpperCase()}</div>
              {active && <div style={{ width:14, height:1.5, background:C.g, borderRadius:99, opacity:.7 }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
