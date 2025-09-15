"use client";
import React from "react";
import Link from "next/link";

export default function ManagerialAdminControlsPage() {
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-bold text-gray-900">Managerial Admin Controls</h1>
      <p className="text-sm text-gray-700">Central place for admin-side configuration related to manager access and governance.</p>
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Access Sharing</h2>
        <p className="text-sm text-gray-700 mb-2">Grant specific managers access to admin sections like Slots, Weekly TOD, MSP Codes, Schedules, etc.</p>
        <Link href="/dashboard/admin/manageMeedian/controls-share" className="inline-flex px-3 py-1.5 rounded-lg border text-sm bg-white border-gray-200 text-gray-800 hover:bg-gray-50">Open Controls Share</Link>
      </div>
    </div>
  );
}

