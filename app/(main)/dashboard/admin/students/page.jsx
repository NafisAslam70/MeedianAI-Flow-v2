"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Students from "../manageMeedian/Students";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(res.statusText || `Request failed (${res.status})`);
    return res.json();
  });

export default function AdminStudentsStandalone() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const { data: grantData, error: grantError, isLoading: grantsLoading } = useSWR(
    role === "team_manager" ? "/api/admin/manageMeedian?section=controlsShareSelf" : null,
    fetcher,
    { dedupingInterval: 30000 }
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasStudentGrant = useMemo(() => {
    if (role === "admin") return true;
    if (role !== "team_manager") return false;
    const sections = new Set((grantData?.grants || []).map((grant) => grant.section));
    return sections.has("students");
  }, [role, grantData]);

  const authLoading = status === "loading" || (role === "team_manager" && grantsLoading && !grantError);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-100 text-sm text-slate-500">
        Checking access…
      </div>
    );
  }

  if (role === "team_manager" && grantError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-100 px-4 text-center text-sm text-rose-600">
        Unable to verify your student access right now. Please refresh or contact an administrator.
      </div>
    );
  }

  if (!hasStudentGrant) {
    return (
      <div className="min-h-screen w-full bg-slate-100 text-gray-900">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 sm:px-6 lg:px-10">
          <div className="rounded-2xl border border-rose-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-700">Access needed</h2>
            <p className="mt-2 text-sm text-rose-600">
              You don&apos;t currently have permission to manage the shared student registry. Ask an admin to grant you
              the <strong>Students</strong> control from the ManageMeedian &rarr; Controls Share page.
            </p>
            <button
              onClick={() => router.push("/dashboard/admin/manageMeedian/controls-share")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-1"
            >
              Go to Controls Share
            </button>
          </div>
        </div>
      </div>
    );
  }

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
