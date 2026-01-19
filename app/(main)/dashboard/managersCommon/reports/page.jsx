"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FileText,
  Plus,
  Save,
  Edit3,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Building2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const REPORT_TYPES = [
  {
    key: "hostel-daily-due",
    label: "Hostel Due Report",
    description: "Daily report for hostel dues and student involvement",
    icon: Building2,
    columns: ["SN", "Particulars", "Student Involved", "Action Type", "Action Details", "Status", "Escalation", "Auth Sign"],
  },
];

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Determine user role for hostel system
  const isHostelIncharge = session?.user?.role === 'team_manager' && session?.user?.team_manager_type === 'hostel_incharge';
  const isHostelAuthority = session?.user?.role === 'admin' || (session?.user?.role === 'team_manager' && session?.user?.team_manager_type !== 'hostel_incharge');
  const canAccessHostelReports = isHostelIncharge || isHostelAuthority;

  // Hostel Daily Due Report state
  const [hostelReport, setHostelReport] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    entries: [
      { 
        sn: 1, 
        particulars: "", 
        studentInvolved: "", 
        actionType: "", 
        assignedHigherAuthority: "",
        actionDetails: "", 
        higherAuthorityAction: "", 
        followUpStatus: "", 
        needsEscalation: "", 
        authSign: "" 
      }
    ]
  });

  const [assignedReports, setAssignedReports] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(true);

  const [students, setStudents] = useState([]);

  useEffect(() => {
    if (status === "authenticated" && canAccessHostelReports && !selectedReport) {
      setSelectedReport("hostel-daily-due");
    }
  }, [status, canAccessHostelReports, selectedReport]);

  useEffect(() => {
    if (selectedReport === "hostel-daily-due" && canAccessHostelReports) {
      fetchStudents();
      if (isHostelAuthority && !isHostelIncharge) {
        fetchAssignedReports();
      } else {
        fetchReports();
      }
    }
  }, [selectedReport, canAccessHostelReports, isHostelAuthority, isHostelIncharge]);

  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/admin/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
    }
  };

  const getStudentsByClass = () => {
    const grouped = {};
    students.forEach(student => {
      const classKey = student.className || "Unknown Class";
      if (!grouped[classKey]) {
        grouped[classKey] = [];
      }
      grouped[classKey].push(student);
    });
    return grouped;
  };

  const getHigherAuthorities = () => {
    return users.filter(user => 
      user.role === 'admin' || 
      (user.role === 'team_manager' && user.team_manager_type !== 'hostel_incharge')
    );
  };

  const fetchAssignedReports = async () => {
    try {
      const res = await fetch(`/api/reports/hostel-daily-due?assignedTo=${session?.user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setAssignedReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to fetch assigned reports:", err);
    }
  };

  const addHostelEntry = () => {
    setHostelReport(prev => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          sn: prev.entries.length + 1,
          particulars: "",
          studentInvolved: "",
          actionType: "",
          assignedHigherAuthority: "",
          actionDetails: "",
          higherAuthorityAction: "",
          followUpStatus: "",
          needsEscalation: "",
          authSign: ""
        }
      ]
    }));
  };

  const updateHostelEntry = (index, field, value) => {
    setHostelReport(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  const removeHostelEntry = (index) => {
    setHostelReport(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index).map((entry, i) => ({
        ...entry,
        sn: i + 1
      }))
    }));
  };

  const saveHostelReport = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Filter out empty entries
      const validEntries = hostelReport.entries.filter(entry => {
        const hasBasicInfo = entry.particulars.trim() || entry.studentInvolved.trim();
        const hasActionType = entry.actionType;
        
        if (isHostelIncharge) {
          // HI only needs basic info and action type, and appropriate details based on action type
          let hasRequiredDetails = false;
          if (entry.actionType === "HI Self") {
            hasRequiredDetails = entry.actionDetails?.trim();
          } else if (entry.actionType === "Higher Authority") {
            hasRequiredDetails = entry.assignedHigherAuthority;
          }
          return hasBasicInfo && hasActionType && hasRequiredDetails;
        } else {
          // HA needs all fields
          const hasActionInfo = (
            (entry.actionType === "HI Self" && entry.actionDetails?.trim()) ||
            (entry.actionType === "Higher Authority" && entry.higherAuthorityAction?.trim())
          );
          const hasStatus = entry.followUpStatus && entry.needsEscalation;
          return hasBasicInfo && hasActionType && hasActionInfo && hasStatus;
        }
      });

      if (validEntries.length === 0) {
        setError("Please add at least one entry with details");
        return;
      }

      const reportData = {
        reportDate: hostelReport.reportDate,
        entries: validEntries,
        submittedBy: session?.user?.id,
        hostelInchargeId: session?.user?.id, // Assuming current user is hostel incharge
        ...(hostelReport.reportId && { reportId: hostelReport.reportId }) // Include reportId for updates
      };

      const res = await fetch("/api/reports/hostel-daily-due", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save report");
      }

      setSuccess(hostelReport.reportId ? "Report updated successfully!" : "Hostel daily due report saved successfully!");
      
      // Only reset form if it's a new report, not an update
      if (!hostelReport.reportId) {
        setHostelReport({
          reportDate: new Date().toISOString().split('T')[0],
          entries: [{ 
            sn: 1, 
            particulars: "", 
            studentInvolved: "", 
            actionType: "", 
            assignedHigherAuthority: "",
            actionDetails: "", 
            higherAuthorityAction: "", 
            followUpStatus: "", 
            needsEscalation: "", 
            authSign: "" 
          }]
        });
      }
      
      await fetchReports();
      if (!isHostelIncharge) {
        await fetchAssignedReports();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReport = (report) => {
    // Set the form to edit mode with the selected report data
    setHostelReport({
      reportDate: report.reportDate,
      entries: report.entries.map(entry => ({
        ...entry,
        // Ensure all required fields are present for HA completion
        higherAuthorityAction: entry.higherAuthorityAction || "",
        followUpStatus: entry.followUpStatus || "",
        needsEscalation: entry.needsEscalation || "",
        authSign: entry.authSign || ""
      })),
      reportId: report.id // Add reportId for updates
    });
    setShowCreateForm(true); // Switch to create form to edit
    setSelectedReport('hostel-daily-due'); // Ensure we're in the right report type
  };

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-2 text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (selectedReport === "hostel-daily-due") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/managersCommon/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> Back to Reports
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {isHostelIncharge ? "Hostel Incharge - Daily Due Report" : "Hostel Authority - Daily Due Report"}
            </h1>
            <p className="text-sm text-slate-600">
              {isHostelIncharge 
                ? "Create initial report entries for hostel dues and assign to higher authority if needed" 
                : "Complete and manage hostel daily due reports"
              }
            </p>
          </div>
        </div>

        {!isHostelIncharge && (
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setShowCreateForm(true)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                showCreateForm 
                  ? "border-slate-900 text-slate-900" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Create Report
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                !showCreateForm 
                  ? "border-slate-900 text-slate-900" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Assigned Reports ({assignedReports.length})
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        )}

        {(isHostelIncharge || showCreateForm) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Report Date
            </label>
            <input
              type="date"
              value={hostelReport.reportDate}
              onChange={(e) => setHostelReport(prev => ({ ...prev, reportDate: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">SN</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Particulars</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student Involved</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Type</th>
                  {isHostelIncharge && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Assign To / Details</th>
                  )}
                  {!isHostelIncharge && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Details</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Escalation</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Auth Sign</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hostelReport.entries.map((entry, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-600">{entry.sn}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entry.particulars}
                        onChange={(e) => updateHostelEntry(index, 'particulars', e.target.value)}
                        placeholder="Enter particulars..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={entry.studentInvolved}
                        onChange={(e) => updateHostelEntry(index, 'studentInvolved', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">Select student...</option>
                        {Object.entries(getStudentsByClass()).map(([className, classStudents]) => (
                          <optgroup key={className} label={className}>
                            {classStudents.map((student) => (
                              <option key={student.id} value={student.name}>
                                {student.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={entry.actionType}
                        onChange={(e) => updateHostelEntry(index, 'actionType', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">Select action type...</option>
                        <option value="HI Self">HI Self</option>
                        <option value="Higher Authority">Higher Authority</option>
                      </select>
                    </td>
                    {isHostelIncharge && (
                      <td className="px-4 py-3">
                        {entry.actionType === "Higher Authority" && (
                          <select
                            value={entry.assignedHigherAuthority}
                            onChange={(e) => updateHostelEntry(index, 'assignedHigherAuthority', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          >
                            <option value="">Select Higher Authority...</option>
                            {getHigherAuthorities().map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.role === 'admin' ? 'Admin' : user.team_manager_type?.replace('_', ' ')})
                              </option>
                            ))}
                          </select>
                        )}
                        {entry.actionType === "HI Self" && (
                          <textarea
                            value={entry.actionDetails}
                            onChange={(e) => updateHostelEntry(index, 'actionDetails', e.target.value)}
                            placeholder="Enter action details..."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          />
                        )}
                        {!entry.actionType && (
                          <span className="text-slate-400 text-sm">Select action type first</span>
                        )}
                      </td>
                    )}
                    {!isHostelIncharge && (
                      <>
                        <td className="px-4 py-3">
                          {entry.actionType === "HI Self" && (
                            <textarea
                              value={entry.actionDetails}
                              onChange={(e) => updateHostelEntry(index, 'actionDetails', e.target.value)}
                              placeholder="Enter action details..."
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                            />
                          )}
                          {entry.actionType === "Higher Authority" && (
                            <textarea
                              value={entry.higherAuthorityAction}
                              onChange={(e) => updateHostelEntry(index, 'higherAuthorityAction', e.target.value)}
                              placeholder="Enter higher authority action..."
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={entry.followUpStatus}
                            onChange={(e) => updateHostelEntry(index, 'followUpStatus', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          >
                            <option value="">Select status...</option>
                            <option value="Needs Follow-up">Needs Follow-up</option>
                            <option value="Done">Done</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={entry.needsEscalation}
                            onChange={(e) => updateHostelEntry(index, 'needsEscalation', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          >
                            <option value="">Select...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.authSign}
                            onChange={(e) => updateHostelEntry(index, 'authSign', e.target.value)}
                            placeholder="Authorization signature..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      {hostelReport.entries.length > 1 && (
                        <button
                          onClick={() => removeHostelEntry(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={addHostelEntry}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Plus size={16} /> Add Entry
            </button>

            <button
              onClick={saveHostelReport}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Report
                </>
              )}
            </button>
          </div>
        </div>
        )}

        {!isHostelIncharge && !showCreateForm && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">Assigned Reports</h2>
            <div className="space-y-4">
              {assignedReports.length === 0 ? (
                <p className="text-slate-600">No assigned reports found.</p>
              ) : (
                assignedReports.map((report) => (
                  <div key={report.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-medium text-slate-800">
                          Report #{report.id} - {report.entries?.studentName || 'Unknown Student'}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Assigned by: {report.entries?.assignedBy || 'Unknown'}
                        </p>
                        <p className="text-sm text-slate-600">
                          Date: {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCompleteReport(report)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Complete Report
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Class:</span> {report.entries?.class || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Amount Due:</span> {report.entries?.amountDue || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Reason:</span> {report.entries?.reason || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {report.entries?.status || 'Pending'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-600">
          Access and manage various reports for hostel operations and management.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map(({ key, label, description, icon: Icon }) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
            onClick={() => setSelectedReport(key)}
          >
            <div className="flex items-start gap-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700">
                <Icon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {reports.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Reports</h2>
          <div className="space-y-3">
            {reports.slice(0, 5).map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Hostel Daily Due Report - {new Date(report.reportDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.entries?.length || 0} entries • Submitted by {report.submittedByName || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(report.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}