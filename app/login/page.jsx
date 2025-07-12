"use client";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const roleHint = searchParams.get("role");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    errorParam === "CredentialsSignin"
      ? "Invalid email or password. Please try again."
      : errorParam
      ? "Authentication failed. Please try again."
      : ""
  );

  // Debug session
  useEffect(() => {
    console.log("Login session:", { status, session });
  }, [status, session]);

  // Redirect if authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const role = session.user.role;
      console.log("Redirecting to:", role === "admin" ? "/dashboard/admin" : "/dashboard/member");
      router.push(role === "admin" ? "/dashboard/admin" : "/dashboard/member");
    }
  }, [status, session, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Login button clicked:", { email, password }); // Debug click
    setError("");

    const result = await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirect: false,
    });

    console.log("SignIn result:", result); // Debug signIn result

    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password. Please try again."
          : result.error || "Authentication failed. Please check your credentials."
      );
    } else if (result?.ok && session?.user?.role) {
      const role = session.user.role;
      router.push(role === "admin" ? "/dashboard/admin" : "/dashboard/member");
    }
  };

  const handleGoBack = () => {
    console.log("Go Back button clicked"); // Debug click
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md pointer-events-auto"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Login as {roleHint ? roleHint.charAt(0).toUpperCase() + roleHint.slice(1) : "User"}
        </h2>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <form onSubmit={handleSubmit} className="space-y-6 pointer-events-auto">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              required
              placeholder="e.g., user@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              required
            />
          </div>
          <motion.button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold transition-colors duration-200 active:scale-95 pointer-events-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Login"
          >
            Login
          </motion.button>
        </form>
        <motion.button
          onClick={handleGoBack}
          className="w-full mt-4 text-sm text-gray-600 hover:text-blue-600 underline text-center cursor-pointer pointer-events-auto"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Go back to previous page"
        >
          ← Go Back
        </motion.button>
      </motion.div>
    </div>
  );
}