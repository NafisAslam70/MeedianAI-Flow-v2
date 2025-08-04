/* ------------------------------------------------------------------
   Wizard component – save as _CloseDayWizard.jsx in same directory.
   ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";

export default function CloseDayWizard({ userId, onClose }) {
  const [step, setStep] = useState(1);          // 1‑4
  const [loading,setLoading]  = useState(true);
  const [payload,setPayload]  = useState(null); // data from prepare‑API
  const [form, setForm]       = useState({
    assigned: {},   // {taskId:{ action:'keep'|'done'|'move', moveTo:'YYYY‑MM‑DD' }}
    routine : {},   // {taskId:true/false}
    comment : "",
  });
  const [error,setError]      = useState("");

  /* fetch everything once */
  useEffect(()=>{
    (async()=>{
      try{
        const r = await fetch("/api/member/close-day/prepare");
        if(!r.ok) throw new Error(await r.text());
        const d = await r.json();
        setPayload(d);
      }catch(e){ setError(e.message) }
      finally{ setLoading(false); }
    })();
  },[]);

  const next = ()=> setStep(s=>Math.min(s+1,4));
  const prev = ()=> setStep(s=>Math.max(s-1,1));

  /* submit */
  const finish = async () => {
    try{
      const r = await fetch("/api/member/close-day/submit",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      });
      if(!r.ok) throw new Error(await r.text());
      onClose("done");
    }catch(e){ setError(e.message) }
  };

  if(loading) return (
    <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
      className="bg-white rounded-3xl p-8 w-full max-w-2xl border border-teal-200 text-center relative">
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto"/>
      <p className="mt-4 text-sm text-gray-600">Preparing your day…</p>
    </motion.div>
  );

  if(error) return (
    <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
      className="bg-white rounded-3xl p-8 w-full max-w-md border border-rose-300 text-center relative">
      <p className="text-rose-700 font-semibold">{error}</p>
      <button onClick={()=>onClose("cancel")} className="mt-6 px-4 py-2 bg-gray-600 text-white rounded-xl">Close</button>
    </motion.div>
  );

  const { mriCleared, assignedTasks, routineTasks } = payload;

  /* render per‑step */
  return (
    <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
      className="bg-white rounded-3xl p-8 w-full max-w-3xl border border-teal-200 relative">
      <button onClick={()=>onClose("cancel")} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"><X size={20}/></button>
      <h2 className="text-xl font-bold mb-6">Close Day – Step {step} / 4</h2>

      {step===1 && (
        <div className="space-y-4">
          <p className="font-medium">All MRIs cleared?</p>
          <p className={`px-4 py-2 rounded-xl inline-block ${mriCleared?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{mriCleared?"Yes – cleared":"No – pending"}</p>
          {!mriCleared && <p className="text-sm text-gray-600">Contact your Superintendent to clear remaining MRIs before closing the day.</p>}
        </div>) }

      {step===2 && (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
          <p className="font-medium mb-2">Assigned tasks status</p>
          {assignedTasks.length===0 && <p className="text-sm text-gray-600">No assigned tasks.</p>}
          {assignedTasks.map(t=>{
            const sel = form.assigned[t.id] ?? {action:"keep",moveTo:""};
            return (
              <div key={t.id} className="border rounded-xl p-4 mb-3">
                <p className="font-semibold">{t.title}</p>
                <select value={sel.action} onChange={e=>setForm(f=>({...f,assigned:{...f.assigned,[t.id]:{...sel,action:e.target.value}}}))}
                  className="mt-2 px-2 py-1 border rounded">
                  <option value="keep">Keep as‑is</option>
                  <option value="done">Mark done</option>
                  <option value="move">Move to another date</option>
                </select>
                {sel.action==='move' && (
                  <input type="date" value={sel.moveTo} onChange={e=>setForm(f=>({...f,assigned:{...f.assigned,[t.id]:{...sel,moveTo:e.target.value}}}))}
                    className="ml-2 px-2 py-1 border rounded" />)}
              </div>);
          })}
        </div>) }

      {step===3 && (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
          <p className="font-medium mb-2">Routine tasks</p>
          {routineTasks.length===0 && <p className="text-sm text-gray-600">No routine tasks.</p>}
          {routineTasks.map(rt=>(
            <label key={rt.id} className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={form.routine[rt.id]??false}
                onChange={e=>setForm(f=>({...f,routine:{...f.routine,[rt.id]:e.target.checked}}))}/>
              <span>{rt.description}</span>
            </label>))}
        </div>) }

      {step===4 && (
        <div className="space-y-4">
          <p className="font-medium">Any note for Superintendent?</p>
          <textarea value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))}
            className="w-full min-h-[120px] p-3 border rounded-xl" placeholder="Optional message…" />
        </div>) }

      {/* nav buttons */}
      <div className="mt-8 flex justify-between">
        {step>1 ? <button onClick={prev} className="px-4 py-2 bg-gray-200 rounded-lg">Back</button> : <span/>}
        {step<4 ? (
          <button onClick={next} className="px-4 py-2 bg-teal-600 text-white rounded-lg">Next</button>) : (
          <button onClick={finish} className="px-4 py-2 bg-teal-600 text-white rounded-lg">Submit</button>)}
      </div>
    </motion.div>
  );
}
