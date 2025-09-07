"use client";
import useSWR from "swr";
import Link from "next/link";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ManageMeedian() {
  const { data } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, { dedupingInterval: 30000 });
  const programs = data?.programs || [];
  const MSP = programs.find((p) => String(p.programKey).toUpperCase() === "MSP");
  const MHCP = programs.find((p) => String(p.programKey).toUpperCase() === "MHCP");

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">ManageMeedian</h1>
          <p className="text-sm text-gray-600">Use the sidebar or quick buttons to jump to schedules.</p>
        </div>
        <div className="flex items-center gap-2">
          {MSP ? (
            <>
              <Link href={`/dashboard/admin/manageMeedian/programs/${MSP.id}?track=pre_primary#schedule`}>
                <Button variant="light">MSP — Pre-Primary</Button>
              </Link>
              <Link href={`/dashboard/admin/manageMeedian/programs/${MSP.id}?track=elementary#schedule`}>
                <Button variant="light">MSP — Elementary</Button>
              </Link>
            </>
          ) : (
            <Link href="/dashboard/admin/manageMeedian/mri-programs">
              <Button variant="light">Add MSP Program</Button>
            </Link>
          )}
          {MHCP ? (
            <Link href={`/dashboard/admin/manageMeedian/programs/${MHCP.id}?track=pre_primary#schedule`}>
              <Button variant="primary">MHCP — Schedule</Button>
            </Link>
          ) : (
            <Link href="/dashboard/admin/manageMeedian/mri-programs">
              <Button variant="primary">Add a new Program</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
