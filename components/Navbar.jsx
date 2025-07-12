"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Debug session
  useEffect(() => {
    console.log("Navbar session:", { status, session });
  }, [status, session]);

  if (!mounted || status === "loading") return null;

  const role = session?.user?.role;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/");
  };

  const handleLogin = (role) => {
    router.push(`/login?role=${role}`);
  };

  const handleAddUser = () => {
    router.push("/dashboard/admin/addUser");
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="text-xl font-bold">
        {role === "admin" ? "MEEDian" : "MEEDian"}
      </div>

      {role === "admin" && (
        <div className="flex-1 flex justify-center space-x-6">
          <Link href="/dashboard/admin" className="hover:text-gray-300 transition-colors">
            Dashboard
          </Link>
          <Link href="/status-board" className="hover:text-gray-300 transition-colors">
            Status Board
          </Link>
          <Link href="/dashboard/admin/manageMeedian" className="hover:text-gray-300 transition-colors">
            Manage Meedian
          </Link>
          <Link href="/dashboard/admin/assignTask" className="hover:text-gray-300 transition-colors">
            Assign Task
          </Link>
        </div>
      )}

      <div className="space-x-4">
        {status === "unauthenticated" && (
          <>
            <button
              onClick={() => handleLogin("admin")}
              className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 active:scale-95 transition-transform transition-colors duration-200"
              aria-label="Login as Admin"
            >
              Login as Admin
            </button>
            <button
              onClick={() => handleLogin("member")}
              className="px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 active:scale-95 transition-transform transition-colors duration-200"
              aria-label="Login as Team Member"
            >
              Login as Team Member
            </button>
          </>
        )}

        {role === "member" && (
          <>
            <Link href="/dashboard/member" className="hover:text-gray-300 transition-colors">
              My Tasks
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 active:scale-95 transition-transform transition-colors duration-200"
              aria-label="Log out of the application"
            >
              Logout
            </button>
          </>
        )}

        {role === "admin" && (
          <>
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 active:scale-95 transition-transform transition-colors duration-200"
              aria-label="Add new user"
            >
              Add User
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 rounded-md hover:bg-red-700 active:scale-95 transition-transform transition-colors duration-200"
              aria-label="Log out of the application"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}