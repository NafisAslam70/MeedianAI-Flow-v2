"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PhoneCall, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

const DEFAULT_PHONE_PREFIX = "+91";
const ensureDefaultPhonePrefix = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_PHONE_PREFIX;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return DEFAULT_PHONE_PREFIX;
  if (digits.startsWith("91")) return `+${digits}`;
  return `${DEFAULT_PHONE_PREFIX}${digits}`;
};
const isLikelyValidPhone = (value) => String(value || "").replace(/\D/g, "").length >= 12;

export default function StudentEnquiryPage() {
  const [form, setForm] = useState({
    guardianName: "",
    studentName: "",
    desiredClass: "",
    phone: DEFAULT_PHONE_PREFIX,
    location: "",
    source: "call",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [pendingLead, setPendingLead] = useState(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const updateField = (field) => (event) => {
    const value =
      field === "phone" ? ensureDefaultPhonePrefix(event.target.value) : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
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
        setLeads(rows);
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

  const filteredLeads = leads.filter((lead) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [lead.name, lead.phone, lead.whatsapp, lead.location, lead.notes, lead.createdByName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));

    const matchesSource = sourceFilter === "all" || (lead.source || "").toLowerCase() === sourceFilter;
    const matchesStatus = statusFilter === "all" || (lead.status || "new").toLowerCase() === statusFilter;

    const createdAt = lead.createdAt ? new Date(lead.createdAt) : null;
    const matchesDate = (() => {
      if (dateFilter === "all" || !createdAt || isNaN(createdAt)) return true;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const startOfDay = (daysAgo) => {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - daysAgo);
        return d;
      };

      switch (dateFilter) {
        case "today":
          return createdAt >= startOfToday;
        case "yesterday": {
          const start = startOfDay(1);
          const end = startOfToday;
          return createdAt >= start && createdAt < end;
        }
        case "last3": {
          const start = startOfDay(2);
          return createdAt >= start;
        }
        case "last7": {
          const start = startOfDay(6);
          return createdAt >= start;
        }
        case "last30": {
          const start = startOfDay(29);
          return createdAt >= start;
        }
        default:
          return true;
      }
    })();

    return matchesSearch && matchesSource && matchesStatus && matchesDate;
  });

  const buildPayload = () => ({
    beltId: null,
    guardianId: null,
    name: form.guardianName,
    phone: ensureDefaultPhonePrefix(form.phone),
    whatsapp: ensureDefaultPhonePrefix(form.phone),
    location: form.location || null,
    notes: [form.studentName, form.desiredClass, form.notes].filter(Boolean).join(" | "),
    source: "student_enquiry",
    category: "MGCP Lead",
  });

  const pushToRandomLeads = async (payload) => {
    const res = await fetch("/api/enrollment/mgcp/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to send to Random Leads");
    const leadRow = {
      id: data?.lead?.id || Date.now(),
      ...payload,
      status: payload.status || "new",
      createdAt: new Date().toISOString(),
      createdByName: "You",
    };
    setLeads((prev) => [
      leadRow,
      ...prev.filter((lead) => lead.status !== "pending-send"),
    ]);
    return leadRow;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setMessage("");

    if (!form.guardianName.trim() || !isLikelyValidPhone(form.phone)) {
      setMessage("Guardian name and phone are required.");
      return;
    }

    const payload = buildPayload();
    setPendingLead(payload);
    setLeads((prev) => [
      {
        id: payload?.id || Date.now(),
        ...payload,
        status: "pending-send",
        createdAt: new Date().toISOString(),
        createdByName: "You",
      },
      ...prev,
    ]);
    setConfirmSendOpen(true);
    setMessage("Enquiry saved. Send to Random Leads?");
    setForm({
      guardianName: "",
      studentName: "",
      desiredClass: "",
      phone: DEFAULT_PHONE_PREFIX,
      location: "",
      source: "call",
      notes: "",
    });
    setTimeout(() => setMessage(""), 2500);
  };

  const handleSendNow = async () => {
    if (!pendingLead || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await pushToRandomLeads(pendingLead);
      setMessage("Sent to Random Leads.");
      setPendingLead(null);
      setConfirmSendOpen(false);
    } catch (error) {
      setMessage(error.message || "Failed to send.");
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">All enquiries</h2>
              <p className="text-sm text-slate-500">Search and filter every intake captured from Managerial Club.</p>
              <p className="text-xs text-slate-400 mt-1">Showing {leads.length ? `${filteredLeads.length} of ${leads.length}` : "0 of 0"} enquiries</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, phone, notes, created by"
                  className="w-60 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                {[...new Set(leads.map((lead) => (lead.source || "").toLowerCase()).filter(Boolean))].map((source) => (
                  <option key={source} value={source}>{source === "student_enquiry" ? "Student Enquiry" : source}</option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All status</option>
                {[...new Set(leads.map((lead) => (lead.status || "new").toLowerCase()))].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last3">Last 3 days</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {leadsLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : leadsError ? (
            <p className="text-sm text-rose-600">{leadsError}</p>
          ) : leads.length ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-2 pr-2 text-center">#</th>
                      <th className="py-2 pr-4">Guardian</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Notes</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Created By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLeads.map((lead, idx) => (
                      <tr key={lead.id}>
                        <td className="py-2 pr-2 text-center text-slate-500">{filteredLeads.length - idx}</td>
                        <td className="py-2 pr-4 text-slate-800">{lead.name || "—"}</td>
                        <td className="py-2 pr-4 text-slate-700">{lead.phone || lead.whatsapp || "—"}</td>
                        <td className="py-2 pr-4 text-slate-700 capitalize">{lead.source || "—"}</td>
                        <td className="py-2 pr-4 text-slate-700 capitalize">{lead.status || "new"}</td>
                        <td className="py-2 pr-4 text-slate-600">{lead.notes || "—"}</td>
                        <td className="py-2 pr-4 text-slate-500 text-xs">
                          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-700">
                          {lead.createdByName || (lead.createdBy ? `User ${lead.createdBy}` : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingLead && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-sm text-amber-800">
                    1 enquiry is saved but not yet in Random Leads.
                  </span>
                  <Button size="sm" onClick={handleSendNow} disabled={saving}>
                    {saving ? "Sending…" : "Send pending to Random Leads"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No enquiries logged yet.</p>
          )}
        </CardBody>
      </Card>

      {confirmSendOpen && pendingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Send to Random Leads?</h3>
            <p className="text-sm text-slate-600">
              The enquiry for <span className="font-semibold">{pendingLead.name}</span> is saved. Do you want to push it
              to Managerial Club → Random Leads right now?
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
              <p><span className="font-semibold">Phone:</span> {pendingLead.phone}</p>
              {pendingLead.location && <p><span className="font-semibold">Location:</span> {pendingLead.location}</p>}
              {pendingLead.notes && <p><span className="font-semibold">Notes:</span> {pendingLead.notes}</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="light" onClick={() => setConfirmSendOpen(false)}>
                Keep for now
              </Button>
              <Button onClick={handleSendNow} disabled={saving}>
                {saving ? "Sending…" : "Send to Random Leads"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
