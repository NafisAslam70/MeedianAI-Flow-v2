/* ------------------------------------------------------------------
   Close‑My‑Day page **with inside flow implemented**
   – Ready to drop into `app/(main)/dashboard/member/closeMyDay/page.jsx`
   – Includes the multi‑step wizard component at the bottom of this file.
   – Relies on two backend endpoints you’ll add next:
        GET  /api/member/close-day/prepare
        POST /api/member/close-day/submit
   ------------------------------------------------------------------ */

"use client";
import { useSession }   from "next-auth/react";
import { useState }     from "react";
import { motion, AnimatePresence } from "framer-motion";
import useOpenCloseTimes from "@/lib/hooks/useOpenCloseTimes";
import CloseDayWizard    from "./_CloseDayWizard";  // ⬅ wizard is in same folder

const pad = (n)=>String(n).padStart(2,"0");
const fmt = (s)=>`${pad(Math.floor(s/3600))}:${pad(Math.floor(s/60)%60)}:${pad(s%60)}`;

export default function CloseMyDay() {
  const { data:session, status } = useSession();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [flash, setFlash]           = useState({ type:"", msg:"" });

  const { canClose, secsLeft, windowStart, windowEnd } = useOpenCloseTimes();

  /* guards */
  if (status === "loading") return <p className="p-8">Loading…</p>;
  if (!["member","team_manager"].includes(session?.user?.role ?? ""))
    return <p className="p-8">Access Denied</p>;

  /* feedback helpers */
  const toast = (type,msg)=>{ setFlash({type,msg}); setTimeout(()=>setFlash({type:"",msg:""}),3000); };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Close My Day</h1>

      <div className={`rounded-xl p-6 text-center border ${canClose?"bg-teal-50 border-teal-300 text-teal-900":"bg-rose-50 border-rose-300 text-rose-900"}`}>
        {canClose ? (
          <>
            <p className="text-lg font-medium">Window <b>OPEN</b></p>
            <p className="text-sm">Time left: <b>{fmt(secsLeft)}</b></p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Window <b>CLOSED</b></p>
            <p className="text-sm">Opens {windowStart} – {windowEnd}</p>
          </>
        )}
      </div>

      <motion.button
        whileHover={{ scale: canClose?1.05:1 }} whileTap={{ scale: canClose?0.95:1 }}
        disabled={!canClose}
        onClick={()=>setWizardOpen(true)}
        className={`w-full py-4 rounded-xl text-lg font-semibold transition ${canClose?"bg-teal-600 hover:bg-teal-700 text-white":"bg-gray-400 text-gray-200"}`}
      >Close Day</motion.button>

      {/* flash */}
      <AnimatePresence>
        {flash.msg && (
          <motion.p initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className={`text-center ${flash.type==='ok'?'text-green-700':'text-red-700'}`}>{flash.msg}</motion.p>) }
      </AnimatePresence>

      {/* wizard modal */}
      <AnimatePresence>
        {wizardOpen && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <CloseDayWizard
              userId={session.user.id}
              onClose={(reason)=>{ setWizardOpen(false); if(reason==='done') toast('ok','Day submitted for approval!'); }}
            />
          </motion.div>) }
      </AnimatePresence>
    </div>
  );
}

