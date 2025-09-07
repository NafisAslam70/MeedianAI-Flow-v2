"use client";
import useSWR from "swr";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then((r) => r.json());

export default function ProgramsIndexPage() {
  const { data, error } = useSWR("/api/admin/manageMeedian?section=metaPrograms", fetcher, { dedupingInterval: 30000 });
  const programs = data?.programs || [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Programs</h1>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">All Programs</h2>
            <p className="text-xs text-gray-500">Manage aims/SOP, schedule/duties, trackers, and evaluators.</p>
          </div>
          <Link href="/dashboard/admin/manageMeedian/mri-programs">
            <Button variant="primary">Create / Edit Programs</Button>
          </Link>
        </CardHeader>
        <CardBody>
          {error && <div className="text-sm text-red-600">Failed to load programs</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Scope</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Manage</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="border-t border-gray-200">
                    <td className="py-2 pr-4 font-semibold">{p.programKey}</td>
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4">{p.scope}</td>
                    <td className="py-2 pr-4">{p.active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">
                      <Link href={`/dashboard/admin/manageMeedian/programs/${p.id}`}>
                        <Button variant="light" size="sm">Open</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

