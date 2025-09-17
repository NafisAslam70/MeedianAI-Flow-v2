"use client";

import { motion } from "framer-motion";
import { Loader2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import GeneralConversationThread from "@/components/GeneralConversationThread";
import { useState } from "react";

export default function GeneralLogView({
  memberId,
  generalLog,
  ISGeneralLog,
  setISGeneralLog,
  handlePrevViewStep,
  handleApprove,
  handleReject,
  isApproving,
  isRejecting,
  isReadOnly = false,
}) {
  const [showLogs, setShowLogs] = useState(true);

  const toggleLogs = () => setShowLogs(!showLogs);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <MessageSquare size={18} className="text-teal-600" />
        General Log
      </h3>

      {/* Two-column layout for Member Note and Supervisor Reply */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Member Note */}
        <div>
          <div className="text-[11px] font-semibold text-gray-600 mb-1">Member Note</div>
          <div className="border border-teal-100 rounded-xl bg-teal-50/40 p-3 text-sm text-gray-800 whitespace-pre-wrap h-40 overflow-y-auto">
            {generalLog?.trim() ? generalLog : "No general log provided."}
          </div>
        </div>

        {/* Supervisor Reply */}
        <div>
          <div className="text-[11px] font-semibold text-gray-600 mb-1">Supervisor Reply</div>
          <textarea
            value={ISGeneralLog}
            onChange={(e) => setISGeneralLog(e.target.value)}
            placeholder="Add your reply to the member’s note…"
            disabled={isReadOnly}
            className={`border border-teal-200 p-3 rounded-xl w-full text-sm h-40 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 resize-none ${
              isReadOnly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-teal-50/50"
            }`}
          />
        </div>
      </div>

      {/* Toggle for Past Conversation Thread */}
      <div className="mt-5">
        <button
          onClick={toggleLogs}
          className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors"
        >
          {showLogs ? (
            <>
              <ChevronUp size={16} /> Hide Past Conversations
            </>
          ) : (
            <>
              <ChevronDown size={16} /> Show Past Conversations
            </>
          )}
        </button>
        {showLogs && memberId && (
          <div className="mt-3 max-h-64 overflow-y-auto">
            <GeneralConversationThread memberId={memberId} limitDays={14} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`mt-6 flex flex-col sm:flex-row gap-4 ${isReadOnly ? "sm:items-center" : "sm:items-stretch"}`}>
        <motion.button
          onClick={handlePrevViewStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        {!isReadOnly ? (
          <div className="flex-1 flex flex-col sm:flex-row gap-4">
            <motion.button
              onClick={handleReject}
              disabled={isRejecting || isApproving}
              className={`flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 ${
                isRejecting || isApproving ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isRejecting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Reject"}
            </motion.button>
            <motion.button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className={`flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 ${
                isApproving || isRejecting ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isApproving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Approve"}
            </motion.button>
          </div>
        ) : (
          <div className="flex-1 flex items-center sm:justify-end text-sm text-gray-500">
            Actions are unavailable because this request is already processed.
          </div>
        )}
      </div>
    </div>
  );
}
