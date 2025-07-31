"use client";

import { useCallback } from "react";

function ChatMessage({ message }) {
  const handleTaskClick = useCallback((taskId, sprintId) => {
    const event = new CustomEvent("member-open-task", {
      detail: { taskId: parseInt(taskId), sprintId: sprintId ? parseInt(sprintId) : undefined },
    });
    window.dispatchEvent(event);
  }, []);

  const parseContent = (content) => {
    const regex = /\[task:(\d+)(?:\s+sprint:(\d+))?\]/g;
    let lastIndex = 0;
    const parts = [];

    content.replace(regex, (match, taskId, sprintId, index) => {
      if (index > lastIndex) {
        parts.push(content.slice(lastIndex, index));
      }
      parts.push(
        <button
          key={index}
          onClick={() => handleTaskClick(taskId, sprintId)}
          className="text-teal-600 hover:underline font-medium cursor-pointer"
        >
          {match} {/* Or "View Task" for better UX */}
        </button>
      );
      lastIndex = index + match.length;
    });

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-700">
        {parseContent(message.content)}
      </p>
      {/* Sender, timestamp, etc. */}
    </div>
  );
}

export default ChatMessage;