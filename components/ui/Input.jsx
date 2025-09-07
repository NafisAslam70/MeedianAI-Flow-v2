"use client";
export default function Input({ label, helper, error, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <input
        className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
          error ? "border-red-300" : "border-gray-300"
        }`}
        {...props}
      />
      {helper && !error && <span className="text-xs text-gray-500 mt-1 block">{helper}</span>}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}

