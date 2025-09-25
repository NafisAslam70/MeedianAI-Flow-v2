"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fetcher = (url) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export default function MemberNotificationsPage() {
  const router = useRouter();
  const { data, isLoading, error, mutate } = useSWR("/api/member/notifications?limit=100", fetcher);
  const items = data?.notifications || [];

  useEffect(() => {
    // mark all as read when visiting the page
    (async () => {
      try {
        await fetch("/api/member/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true, read: true }),
        });
        mutate();
      } catch {}
    })();
  }, [mutate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <button
            type="button"
            onClick={() => mutate()}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-6 text-sm text-rose-700">Failed to load notifications.</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            No notifications yet.
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {items.map((n) => {
              const isTicket = n.entityKind === "ticket" && n.entityId;
              const href = isTicket ? `/dashboard/member/tickets?ticketId=${n.entityId}` : null;
              const el = (
                <div className={`rounded-2xl border px-4 py-3 ${n.read ? "bg-white border-slate-200" : "bg-indigo-50 border-indigo-200"}`}>
                  <div className="text-sm font-semibold text-slate-900">{n.title || "Notification"}</div>
                  {n.body && <div className="text-sm text-slate-700">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              );
              return (
                <div key={n.id}>
                  {href ? (
                    <Link href={href}>{el}</Link>
                  ) : (
                    el
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

