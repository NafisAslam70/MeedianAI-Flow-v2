"use client";
import { useState } from "react";
import useSWR from "swr";
import jsPDF from "jspdf";

const fetcher = (u) => fetch(u).then((r) => r.json());

export default function AttendanceReportPage() {
  const today = new Date().toISOString().slice(0,10);
  const [date, setDate] = useState(today);
  const [programKey, setProgramKey] = useState("MSP");
  const [track, setTrack] = useState(""); // pre_primary | elementary | both
  const params = new URLSearchParams({ section: 'report', date });
  if (programKey) params.set('programKey', programKey);
  if (track) params.set('track', track);
  const { data, isLoading, error } = useSWR(`/api/attendance?${params.toString()}`, fetcher);

  const generatePdf = () => {
    if (!data) return;
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(14);
    doc.text(`Daily Attendance — ${data.date}${data.programKey ? ` (${data.programKey}${data.track?'/'+data.track:''})` : ''}`, 10, y); y += 8;
    doc.setFontSize(11);
    const t = data.totals || {};
    doc.text(`Present: ${t.present} (Teachers: ${t.presentTeachers}, Non-Teachers: ${t.presentNonTeachers})`, 10, y); y += 6;
    doc.text(`Absent:  ${t.absent} (Teachers: ${t.absentTeachers}, Non-Teachers: ${t.absentNonTeachers})`, 10, y); y += 8;
    doc.setFontSize(12); doc.text('Presents', 10, y); y += 6; doc.setFontSize(10);
    (data.presents || []).forEach((p) => { if (y > 280) { doc.addPage(); y = 10;} doc.text(`- ${p.name || ('User #'+p.userId)}  at ${p.at ? new Date(p.at).toLocaleTimeString() : '-'}`, 12, y); y += 5; });
    y += 4; if (y > 280) { doc.addPage(); y = 10; }
    doc.setFontSize(12); doc.text('Absentees', 10, y); y += 6; doc.setFontSize(10);
    (data.absentees || []).forEach((p) => { if (y > 280) { doc.addPage(); y = 10;} doc.text(`- ${p.name || ('User #'+p.userId)}`, 12, y); y += 5; });
    doc.save(`attendance_${data.date}${data.programKey?`_${data.programKey}`:''}${data.track?`_${data.track}`:''}.pdf`);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Daily Attendance Report</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-700">Date</label>
          <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="mt-1 p-2 border rounded bg-white" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Program</label>
          <select value={programKey} onChange={(e)=>setProgramKey(e.target.value)} className="mt-1 p-2 border rounded bg-white">
            <option value="">(Any)</option>
            <option value="MSP">MSP</option>
            <option value="MHCP">MHCP</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Track</label>
          <select value={track} onChange={(e)=>setTrack(e.target.value)} className="mt-1 p-2 border rounded bg-white">
            <option value="">(Any)</option>
            <option value="pre_primary">Pre-Primary</option>
            <option value="elementary">Elementary</option>
          </select>
        </div>
        <button onClick={generatePdf} disabled={!data} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60">Export PDF</button>
      </div>

      {isLoading && <div className="text-sm text-gray-600">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error.message || 'Failed to load report'}</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded border p-3">
            <div className="font-semibold mb-2">Presents ({data.totals?.present})</div>
            <ul className="text-sm list-disc pl-5">
              {(data.presents||[]).map((p)=> (
                <li key={`p_${p.userId}`}>{p.name || `User #${p.userId}`} <span className="text-gray-500">— {p.at ? new Date(p.at).toLocaleTimeString() : '-'}</span> {p.isTeacher ? <span className="ml-2 text-xs text-indigo-600">Teacher</span> : null}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded border p-3">
            <div className="font-semibold mb-2">Absentees ({data.totals?.absent})</div>
            <ul className="text-sm list-disc pl-5">
              {(data.absentees||[]).map((p)=> (
                <li key={`a_${p.userId}`}>{p.name || `User #${p.userId}`} {p.isTeacher ? <span className="ml-2 text-xs text-indigo-600">Teacher</span> : null}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

