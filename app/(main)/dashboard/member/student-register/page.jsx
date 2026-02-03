"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(res.statusText || `Request failed (${res.status})`);
    return res.json();
  });

export default function MemberStudentRegisterPage() {
  const { data, error } = useSWR("/api/admin/manageMeedian?section=students", fetcher);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => data?.students || [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const roll = String(r.rollNumber || "").toLowerCase();
      const klass = (r.class_name || "").toLowerCase();
      return name.includes(q) || roll.includes(q) || klass.includes(q);
    });
  }, [rows, query]);

  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Unable to load student register. Please ask admin to grant read access.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Student Register (Read-only)</h1>
        <p className="text-sm text-slate-500">Search students without edit access.</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search by name, roll, class..."
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600 mb-2">
          Showing {filtered.length} students
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Roll</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-4 text-slate-800">{row.name || "—"}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.class_name || "—"}</td>
                  <td className="py-2 pr-4 text-slate-700">{row.rollNumber || "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{row.status || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

