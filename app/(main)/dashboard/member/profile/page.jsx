// app/(main)/member/profile/page.jsx
// import Profile from "@/components/Profile";
// export default function MemberProfilePage() {
//   return <Profile />;
// }

"use client";
import { useState } from "react";
import Profile from "@/components/Profile";
import ChatBox from "@/components/ChatBox";
import { useSession } from "next-auth/react";

export default function MemberProfilePage() {
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
        userDetails={session?.user}       // who is logged in
        isOpen={chatboxOpen}             // open state
        setIsOpen={setChatboxOpen}       // allow ChatBox to close itself
        recipientId={chatRecipient}      // e.g. "43"
      />
    </>
  );
}
