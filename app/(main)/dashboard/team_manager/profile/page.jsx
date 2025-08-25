// app/(main)/team_manager/profile/page.jsx
// import Profile from "@/components/Profile";
// export default function TeamManagerProfilePage() {
//   return <Profile />;
// }
"use client";
import { useState } from "react";
import Profile from "@/components/Profile";
import ChatBox from "@/components/ChatBox";
import { useSession } from "next-auth/react";

export default function TeamManagerProfilePage() {
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
