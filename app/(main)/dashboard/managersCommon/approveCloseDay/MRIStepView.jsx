// app/(main)/dashboard/managersCommon/approveCloseDay/MRIStepView.jsx
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export default function MRIStepView({ mri, handlePrevViewStep, handleNextViewStep }) {
  // Fallback if mri is undefined
  const cleared = mri?.cleared ?? true; // Or false, depending on your logic

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <CheckCircle size={18} className="text-teal-600" />
        MRI Clearance
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {cleared ? "All MRIs cleared." : "MRIs not cleared yet."}
      </p>
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
          onClick={handleNextViewStep}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}