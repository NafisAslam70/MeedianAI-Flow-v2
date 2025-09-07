"use client";
import Link from "next/link";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Workflow, Boxes, ListChecks } from "lucide-react";

export default function MRIRolesHubPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">MRI & Roles</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <span className="rounded-md p-2 bg-teal-100 text-teal-700"><Workflow className="w-5 h-5" /></span>
            <div className="font-semibold text-gray-900">MRI Families</div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">Define MRI families (AMRI/NMRI/RMRI/OMRI) and manage their lifecycle.</p>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Link href="/dashboard/admin/manageMeedian/mri-families">
              <Button variant="light" size="sm">Open</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <span className="rounded-md p-2 bg-teal-100 text-teal-700"><Boxes className="w-5 h-5" /></span>
            <div className="font-semibold text-gray-900">Role Definitions</div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">Manage MRI role definitions and categories for staffing and permissions.</p>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Link href="/dashboard/admin/manageMeedian/meta-roles">
              <Button variant="light" size="sm">Open</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <span className="rounded-md p-2 bg-teal-100 text-teal-700"><ListChecks className="w-5 h-5" /></span>
            <div className="font-semibold text-gray-900">Daily Slot Management</div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600">Set timings and assign members for NMRI daily slots in bulk.</p>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Link href="/dashboard/admin/manageMeedian/bulk">
              <Button variant="light" size="sm">Open</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

