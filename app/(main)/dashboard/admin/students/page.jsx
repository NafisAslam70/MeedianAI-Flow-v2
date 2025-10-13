"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Students from "../manageMeedian/Students";

export default function AdminStudentsStandalone() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return (
    <div className="min-h-screen w-full bg-slate-100 text-gray-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 p-4 shadow">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Students Manager</h1>
            <p className="text-sm text-gray-500">
              Full-screen view of the shared student registry. Finance-only actions remain in MeedianAI-Finance.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/admin/manageMeedian")}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Admin Panel</span>
          </button>
        </div>

        {(error || success) && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}
          </div>
        )}

        <div className="rounded-3xl bg-white shadow-xl ring-1 ring-black/5">
          <Students setError={setError} setSuccess={setSuccess} />
        </div>
      </div>
    </div>
  );
}
