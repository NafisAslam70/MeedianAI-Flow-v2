"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PhoneCall, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

export default function StudentEnquiryPage() {
  const [form, setForm] = useState({
    guardianName: "",
    studentName: "",
    desiredClass: "",
    phone: "",
    location: "",
    source: "call",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState("");

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  useEffect(() => {
    let active = true;
    const loadLeads = async () => {
      setLeadsLoading(true);
      setLeadsError("");
      try {
        const res = await fetch("/api/enrollment/mgcp/belts?include=details", {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Failed to load enquiries");
        if (!active) return;
        const rows = Array.isArray(payload?.randomLeads) ? payload.randomLeads : [];
        // sort newest first
        rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setLeads(rows.slice(0, 12));
      } catch (error) {
        if (!active) return;
        setLeadsError(error.message || "Failed to load enquiries");
        setLeads([]);
      } finally {
        if (active) setLeadsLoading(false);
      }
    };
    loadLeads();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setMessage("");

    if (!form.guardianName.trim() || !form.phone.trim()) {
      setMessage("Guardian name and phone are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/enrollment/mgcp/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beltId: null,
          guardianId: null,
          name: form.guardianName,
          phone: form.phone,
          whatsapp: form.phone,
          location: form.location || null,
          notes: [form.studentName, form.desiredClass, form.notes].filter(Boolean).join(" | "),
          source: form.source || "enquiry",
          category: "MGCP Lead",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save enquiry");
      setMessage("Enquiry saved and pushed to Random Leads.");
      setForm({ guardianName: "", studentName: "", desiredClass: "", phone: "", location: "", source: "call", notes: "" });
      // refresh recent list
      setLeads((prev) => [
        {
          id: payload?.lead?.id || Date.now(),
          name: form.guardianName,
          phone: form.phone,
          whatsapp: form.phone,
          location: form.location || null,
          notes: [form.studentName, form.desiredClass, form.notes].filter(Boolean).join(" | "),
          source: form.source || "enquiry",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 12));
    } catch (error) {
      setMessage(error.message || "Failed to save enquiry.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/managersCommon/managerial-club"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Managerial Club
          </Link>
          <Link
            href="/dashboard/managersCommon/guardian-relationship?tab=mgcp&section=random"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
          >
            <Sparkles className="h-4 w-4" />
            Random Leads
          </Link>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <PhoneCall className="h-4 w-4" /> Student Enquiry Intake
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Log admission enquiry calls</h1>
        <p className="text-sm text-slate-600">
          Capture caller details and push directly to King's Place → MGCP → Random Leads.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">New enquiry</h2>
        </CardHeader>
        <CardBody>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <Input
              label="Guardian name"
              value={form.guardianName}
              onChange={updateField("guardianName")}
              placeholder="Caller / Guardian"
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={updateField("phone")}
              placeholder="WhatsApp / Phone"
              required
            />
            <Input
              label="Student name"
              value={form.studentName}
              onChange={updateField("studentName")}
              placeholder="Ward"
            />
            <Input
              label="Desired class"
              value={form.desiredClass}
              onChange={updateField("desiredClass")}
              placeholder="e.g., Grade 4 / Hostel"
            />
            <Input
              label="Location"
              value={form.location}
              onChange={updateField("location")}
              placeholder="Village / Area"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.source}
                onChange={updateField("source")}
              >
                <option value="call">Call</option>
                <option value="walk-in">Walk-in</option>
                <option value="referral">Referral</option>
                <option value="social">Social / Online</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={form.notes}
                onChange={updateField("notes")}
                placeholder="Any specific needs or questions"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save & Send to Random Leads"}
              </Button>
              {message && (
                <span className="text-sm text-emerald-700 flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" /> {message}
                </span>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent enquiries</h2>
              <p className="text-sm text-slate-500">Latest random leads captured from this form.</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {leadsLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : leadsError ? (
            <p className="text-sm text-rose-600">{leadsError}</p>
          ) : leads.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4">Guardian</th>
                    <th className="py-2 pr-4">Phone</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2 pr-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="py-2 pr-4 text-slate-800">{lead.name || "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">{lead.phone || lead.whatsapp || "—"}</td>
                      <td className="py-2 pr-4 text-slate-700 capitalize">{lead.source || "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{lead.notes || "—"}</td>
                      <td className="py-2 pr-4 text-slate-500 text-xs">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No enquiries logged yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
