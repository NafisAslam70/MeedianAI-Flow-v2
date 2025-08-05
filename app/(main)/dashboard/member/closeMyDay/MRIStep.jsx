// app/(main)/dashboard/member/closeMyDay/MRIStep.jsx
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export default function MRIStep({ handleNextStep, mriCleared }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        MRI Clearance
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {mriCleared ? "All MRIs cleared." : "MRIs not cleared yet."}
      </p>
      <div className="flex justify-end mt-6">
        <motion.button
          onClick={handleNextStep}
          className="bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}