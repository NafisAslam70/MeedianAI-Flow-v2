// "use client";
import { Suspense } from "react";
import LoginInner from "./LoginInner";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center mt-10 text-gray-600">Loading login...</div>}>
      <LoginInner />
    </Suspense>
  );
}
