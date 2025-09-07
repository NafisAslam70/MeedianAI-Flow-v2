"use client";
import { useState } from "react";
import Students from "../Students";

export default function StudentsPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Students setError={setError} setSuccess={setSuccess} />
    </div>
  );
}
