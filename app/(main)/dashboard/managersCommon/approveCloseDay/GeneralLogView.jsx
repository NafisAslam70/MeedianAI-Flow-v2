// app/(main)/dashboard/managersCommon/approveCloseDay/GeneralLogView.jsx
import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";

export default function GeneralLogView({
  generalLog,
  handlePrevViewStep,
  handleApprove,
  isApproving,
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        General Log
      </h3>
      <p className="border p-2 rounded w-full text-sm bg-gray-50 mb-4">{generalLog || "No general log provided"}</p>
      <div className="flex justify-between mt-6 gap-4">
        <motion.button
          onClick={handlePrevViewStep}
          className="flex-1 bg-gray-600 text-white py-3 rounded-xl font-semibold hover:bg-gray-500 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Previous
        </motion.button>
        <motion.button
          onClick={handleApprove}
          disabled={isApproving}
          className={`flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold transition-all duration-300 ${isApproving ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isApproving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Approve Day Close"}
        </motion.button>
      </div>
    </div>
  );
}