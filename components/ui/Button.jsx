"use client";
export default function Button({ variant = "primary", size = "md", className = "", children, ...props }) {
  const base = "inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  const sizes = {
    xs: "px-2 py-1 text-xs",
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    secondary: "bg-gray-900 text-white hover:bg-black/80",
    light: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
