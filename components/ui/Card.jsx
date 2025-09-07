"use client";
export function Card({ className = "", children }) {
  return <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ className = "", children }) {
  return <div className={`px-5 py-4 border-b border-gray-200 ${className}`}>{children}</div>;
}

export function CardBody({ className = "", children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ className = "", children }) {
  return <div className={`px-5 py-4 border-t border-gray-200 ${className}`}>{children}</div>;
}

