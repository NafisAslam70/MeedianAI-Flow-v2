import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function GeneralLogView({
  generalLog,
  ISGeneralLog,
  setISGeneralLog,
  handlePrevViewStep,
  handleApprove,
  isApproving,
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">General Log</h3>
      <p className="text-sm text-gray-600 mb-4">{generalLog || "No general log provided."}</p>
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-800">Supervisor Comment:</label>
        <textarea
          value={ISGeneralLog}
          onChange={(e) => setISGeneralLog(e.target.value)}
          placeholder="Add your comments on the general log..."
          className="border border-teal-200 p-3 rounded-xl w-full text-sm h-24 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-teal-50/50 resize-none"
        />
      </div>
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
          {isApproving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Approve"}
        </motion.button>
      </div>
    </div>
  );
}