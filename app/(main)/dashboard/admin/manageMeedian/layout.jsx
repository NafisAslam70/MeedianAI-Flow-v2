"use client";
import AdminSidebar from "@/components/manageMeedian/AdminSidebar";

export default function ManageMeedianLayout({ children }) {
  return (
    <div className="w-full bg-gray-50 text-gray-900 rounded-2xl border border-gray-200 min-h-screen">
      <div className="min-h-screen overflow-hidden grid grid-cols-[12rem_1fr]">
        {/* Fixed (sticky) sidebar using full viewport height */}
        <aside className="sticky top-0 self-start h-screen overflow-y-auto border-r border-gray-200 bg-white">
          <AdminSidebar />
        </aside>
        {/* Content-only scroll on the right pane */}
        <main className="min-h-screen overflow-y-auto p-4 md:p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
