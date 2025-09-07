"use client";
export default function Badge({ color = "gray", children, className = "" }) {
  const colors = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

