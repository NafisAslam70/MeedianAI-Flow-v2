// app/(main)/admin/profile/page.jsx
// import Profile from "@/components/Profile";
// export default function AdminProfilePage() {
//   return <Profile />;
// }

// app/(main)/admin/profile/page.jsx
"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import Profile from "@/components/Profile";
import ChatBox from "@/components/ChatBox";

export default function AdminProfilePage() {
  const [chatboxOpen, setChatboxOpen] = useState(false);
  const [chatRecipient, setChatRecipient] = useState("");
  const { data: session } = useSession();

  return (
    <>
      <Profile
        setChatboxOpen={setChatboxOpen}
        setChatRecipient={setChatRecipient}
      />
      <ChatBox
        userDetails={session?.user}
        isOpen={chatboxOpen}
        setIsOpen={setChatboxOpen}
        recipientId={chatRecipient}
      />
    </>
  );
}
