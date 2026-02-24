"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function DirectMessagePage({ basePath = "/dashboard/team_manager/profile" }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [form, setForm] = useState({
    recipientType: "existing",
    recipientId: "",
    customName: "",
    customWhatsappNumber: "",
    subject: "",
    message: "",
    note: "",
    contact: "admin@mymeedai.org",
    includeFooter: true,
  });
  const [selectedTemplate, setSelectedTemplate] = useState("welcome");

  const messageTemplates = [
    {
      key: "welcome",
      label: "Welcome",
      subject: "Welcome to MeedianAI",
      body: "Hi {name}, welcome to MeedianAI. If you need anything, contact {contact}. - {sender}",
    },
    {
      key: "reminder",
      label: "Gentle Reminder",
      subject: "Gentle Reminder",
      body: "Hi {name}, this is a friendly reminder about your pending item. Please review at your convenience. - {sender}",
    },
    {
      key: "update",
      label: "Important Update",
      subject: "Important Update",
      body: "Hi {name}, here's an important update for you. Please check the portal for details. - {sender}",
    },
    {
      key: "appreciation",
      label: "Appreciation",
      subject: "Thank You",
      body: "Hi {name}, thank you for your great work and dedication. - {sender}",
    },
    {
      key: "credentials",
      label: "Share Credentials",
      subject: "Your MeedianAI Login Credentials",
      body: "Hi {name}, welcome onboard. Your MeedianAI access is ready. Username: {username}. Temporary password: {password}. Login here: https://meedian-ai-flow-v2.vercel.app/. Please change your password after first login. For help, contact {contact}. - {sender}",
    },
  ];

  useEffect(() => {
    let dead = false;
    (async () => {
      setLoadingUsers(true);
      try {
        let res = await fetch("/api/managersCommon/users", { credentials: "include" });
        let data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Fallback for environments where managersCommon endpoint is restricted/missing
          res = await fetch("/api/member/users", { credentials: "include" });
          data = await res.json().catch(() => ({}));
        }
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (!dead) setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        if (!dead) setError(e.message || "Failed to load users");
      } finally {
        if (!dead) setLoadingUsers(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  const recipients = useMemo(() => {
    const me = Number(session?.user?.id);
    const q = recipientQuery.trim().toLowerCase();
    return users
      .filter((u) => Number(u.id) !== me)
      .filter((u) => (roleFilter === "all" ? true : String(u.role) === roleFilter))
      .filter((u) => {
        if (!q) return true;
        return (
          String(u.name || "").toLowerCase().includes(q) ||
          String(u.role || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q)
        );
      });
  }, [users, session?.user?.id, recipientQuery, roleFilter]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const applyTemplate = (key) => {
    const t = messageTemplates.find((x) => x.key === key);
    if (!t) return;
    const sender = session?.user?.name || "Admin";
    let name = form.customName?.trim() || "there";
    if (form.recipientType === "existing") {
      const u = recipients.find((x) => String(x.id) === String(form.recipientId));
      name = u?.name || "there";
    }
    const contact = form.contact || "";
    setForm((p) => ({
      ...p,
      subject: t.subject,
      message: t.body
        .replaceAll("{name}", name)
        .replaceAll("{sender}", sender)
        .replaceAll("{contact}", contact)
        .replaceAll("{username}", "[enter username]")
        .replaceAll("{password}", "[enter temporary password]"),
    }));
  };

  useEffect(() => {
    if (!form.subject && !form.message && selectedTemplate) {
      applyTemplate(selectedTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  const buildPreview = () => {
    let recipientName = form.customName?.trim() || "there";
    if (form.recipientType === "existing") {
      const u = recipients.find((x) => String(x.id) === String(form.recipientId));
      recipientName = u?.name || "there";
    }
    const senderName = session?.user?.name || "System";
    const now = new Date();
    const footer = `Sent on ${now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. Please kindly check the MeedianAI portal for more information [https://meedian-ai-flow-v2.vercel.app/]`;
    return `Hi ${recipientName}, ${senderName} (from Meed Leadership Group) has sent you a new message. Subject: ${form.subject}. Message: ${form.message}${form.note.trim() ? `. Additional note: ${form.note.trim()}` : ""}. If you need assistance, please contact ${form.contact}. ${form.includeFooter ? footer : ""}`.trim();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setPreviewText(buildPreview());
    setShowPreview(true);
  };

  const confirmSend = async () => {
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const body =
        form.recipientType === "existing"
          ? {
              recipientId: Number(form.recipientId),
              subject: form.subject,
              message: form.message,
              note: form.note || "",
              contact: form.contact,
              includeFooter: form.includeFooter,
            }
          : {
              customName: form.customName,
              customWhatsappNumber: form.customWhatsappNumber,
              subject: form.subject,
              message: form.message,
              note: form.note || "",
              contact: form.contact,
              includeFooter: form.includeFooter,
            };

      const res = await fetch("/api/managersCommon/direct-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuccess(data?.warning ? `Saved with warning: ${data.warning}` : "Message sent.");
      setShowPreview(false);
      setForm((p) => ({
        ...p,
        recipientId: "",
        customName: "",
        customWhatsappNumber: "",
        subject: "",
        message: "",
        note: "",
      }));
    } catch (e2) {
      setError(e2.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Send Direct Message</h1>
        <button type="button" onClick={() => router.push(basePath)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600">
          Back to Profile
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-red-700 bg-red-100 rounded p-2">{error}</p>}
      {success && <p className="mb-3 text-sm text-green-700 bg-green-100 rounded p-2">{success}</p>}

      <form onSubmit={submit} className="grid gap-4">
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="recipientType" value="existing" checked={form.recipientType === "existing"} onChange={onChange} />
            Existing User
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="recipientType" value="custom" checked={form.recipientType === "custom"} onChange={onChange} />
            Custom Recipient
          </label>
        </div>

        {form.recipientType === "existing" ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2">
              <input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder="Search name / role / email"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="team_manager">Team Manager</option>
                <option value="member">Member</option>
              </select>
            </div>
            <label className="text-xs font-medium">Recipient</label>
            <select name="recipientId" value={form.recipientId} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" required>
              <option value="">Select recipient</option>
              {!loadingUsers &&
                recipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Recipient Name</label>
              <input name="customName" value={form.customName} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="text-xs font-medium">WhatsApp Number</label>
              <input name="customWhatsappNumber" value={form.customWhatsappNumber} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" placeholder="+1234567890" required />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium">Template</label>
          <div className="mt-1 flex gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
            >
              {messageTemplates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
              <option value="">Custom (no template)</option>
            </select>
            <button
              type="button"
              onClick={() => selectedTemplate && applyTemplate(selectedTemplate)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
            >
              Apply
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Subject</label>
          <input name="subject" value={form.subject} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" required />
        </div>
        <div>
          <label className="text-xs font-medium">Message</label>
          <textarea name="message" value={form.message} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg min-h-[140px]" required />
        </div>
        <div>
          <label className="text-xs font-medium">Additional Note (optional)</label>
          <textarea name="note" value={form.note} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg min-h-[90px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <label className="text-xs font-medium">Contact Info</label>
            <input name="contact" value={form.contact} onChange={onChange} className="w-full mt-1 px-3 py-2 border rounded-lg" required />
          </div>
          <label className="inline-flex items-center gap-2 text-sm mt-5">
            <input type="checkbox" name="includeFooter" checked={form.includeFooter} onChange={onChange} />
            Include footer
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={sending} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-60">
            Preview Message
          </button>
        </div>
      </form>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-[1200]">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 md:p-5">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Confirm Message</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Please review before sending:</p>
            <div className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm whitespace-pre-wrap max-h-[45vh] overflow-auto">
              {previewText}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                disabled={sending}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSend}
                disabled={sending}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
