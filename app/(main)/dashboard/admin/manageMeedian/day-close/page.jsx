"use client";
import ManageDayClose from "@/components/manageMeedian/ManageDayClose";

export default function DayClosePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Open/Close Windows</h1>
      <ManageDayClose setError={() => {}} setSuccess={() => {}} />
    </div>
  );
}
