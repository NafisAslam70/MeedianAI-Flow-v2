"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
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

const fetcher = async (url) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const error = new Error(payload?.error || res.statusText);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

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
  const isHostelInchargeByRole =
    session?.user?.role === 'team_manager' && session?.user?.team_manager_type === 'hostel_incharge';

  // Report type view state
  const [reportType, setReportType] = useState(isHostelInchargeByRole ? "incharge" : "admin"); // "incharge" or "admin"

  const { data: mriRolesData } = useSWR(
    status === "authenticated" ? "/api/member/mris/roles" : null,
    fetcher,
    { dedupingInterval: 60000 }
  );

  const { data: hostelAssignmentsData } = useSWR(
    status === "authenticated" ? "/api/reports/hostel-daily-due/assignments" : null,
    fetcher,
    { dedupingInterval: 30000 }
  );

  const userMriRoles = useMemo(() => mriRolesData?.roles || [], [mriRolesData?.roles]);
  const hostelAssignments = useMemo(
    () => hostelAssignmentsData?.assignments || [],
    [hostelAssignmentsData?.assignments]
  );

  const hasHostelAuthorityAssignment = hostelAssignments.some(
    (assignment) => assignment.role === "hostel_authority"
  );
  const hasHostelInchargeAssignment = hostelAssignments.some(
    (assignment) => assignment.role !== "hostel_authority"
  );
  const hasHostelAssignment = hasHostelAuthorityAssignment || hasHostelInchargeAssignment;

  // Determine user role for hostel system
  const isHostelIncharge = isHostelInchargeByRole || hasHostelInchargeAssignment;

  // Hostel Admin = system admin OR has any MRI roles assigned OR assigned as hostel authority
  const isHostelAdmin =
    session?.user?.role === 'admin' ||
    hasHostelAuthorityAssignment ||
    (Array.isArray(userMriRoles) && userMriRoles.length > 0);
  const canAccessHostelReports = isHostelIncharge || isHostelAdmin;
  const canLoadHostelOptions =
    selectedReport === "hostel-daily-due" &&
    canAccessHostelReports &&
    (hasHostelAssignment || session?.user?.role === "admin");

  useEffect(() => {
    if (isHostelIncharge && !isHostelAdmin && reportType !== "incharge") {
      setReportType("incharge");
    } else if (isHostelAdmin && !isHostelIncharge && reportType !== "admin") {
      setReportType("admin");
    }
  }, [isHostelIncharge, isHostelAdmin, reportType]);

  // Hostel Daily Due Report state for Incharge
  const [hiReport, setHiReport] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    entries: [
      { 
        sn: 1, 
        classId: "",
        particulars: "", 
        studentInvolved: [], 
        actionType: "",
        actionDetails: "",
        authSign: "" 
      }
    ]
  });

  // Hostel Daily Due Report state for Admin
  const [haReport, setHaReport] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    entries: [
      { 
        sn: 1, 
        classId: "",
        particulars: "", 
        studentInvolved: [], 
        actionType: "",
        actionDetails: "",
        status: "",
        needsEscalation: "",
        escalationDetails: "",
        authSign: "" 
      }
    ]
  });

  const [assignedReports, setAssignedReports] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(true);

  // Fetch data using useSWR pattern
  const {
    data: classesData,
    isLoading: classesLoading,
  } = useSWR(
    canLoadHostelOptions
      ? "/api/reports/hostel-daily-due/options?section=classes"
      : null,
    fetcher,
    { dedupingInterval: 60000 }
  );

  const {
    data: usersData,
    isLoading: usersLoading,
  } = useSWR(
    canLoadHostelOptions
      ? "/api/reports/hostel-daily-due/options?section=users"
      : null,
    fetcher,
    { dedupingInterval: 60000 }
  );

  const classes = useMemo(() => classesData?.classes || [], [classesData?.classes]);
  const users = useMemo(() => usersData?.users || [], [usersData?.users]);

  // Cache students by classId using a Map
  const [studentsByClassCache, setStudentsByClassCache] = useState(new Map());

  // Get unique classIds from the active report (HI or HA)
  const currentReport = reportType === "incharge" ? hiReport : haReport;
  const uniqueClassIds = useMemo(
    () => [...new Set(currentReport.entries.map(e => e.classId).filter(Boolean))],
    [currentReport.entries, reportType]
  );

  // Fetch students for each class
  const studentsUrls = useMemo(
    () => uniqueClassIds.map(classId => ({
      classId,
      url: `/api/managersCommon/guardian-calls?section=students&classId=${classId}`
    })),
    [uniqueClassIds]
  );

  // Use multiple SWR calls - one for each unique classId
  useEffect(() => {
    const fetchAllStudents = async () => {
      const newCache = new Map(studentsByClassCache);
      
      for (const { classId, url } of studentsUrls) {
        if (!newCache.has(classId)) {
          try {
            const res = await fetcher(url);
            newCache.set(classId, res?.students || []);
          } catch (err) {
            console.error(`Failed to fetch students for class ${classId}:`, err);
            newCache.set(classId, []);
          }
        }
      }
      
      setStudentsByClassCache(newCache);
    };

    if (studentsUrls.length > 0) {
      fetchAllStudents();
    }
  }, [studentsUrls, studentsByClassCache]);

  // Get students for a specific class
  const getStudentsByClass = (classId) => {
    if (!classId) return [];
    return studentsByClassCache.get(classId) || [];
  };

  // Helper function to update HI report entries
  const updateHiEntry = (index, field, value) => {
    setHiReport(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Helper function to update HA report entries
  const updateHaEntry = (index, field, value) => {
    setHaReport(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Helper function to add HI entry
  const addHiEntry = () => {
    setHiReport(prev => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          sn: prev.entries.length + 1,
          classId: "",
          particulars: "",
          studentInvolved: [],
          actionType: "",
          actionDetails: "",
          authSign: ""
        }
      ]
    }));
  };

  // Helper function to add HA entry
  const addHaEntry = () => {
    setHaReport(prev => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          sn: prev.entries.length + 1,
          classId: "",
          particulars: "",
          studentInvolved: [],
          actionType: "",
          actionDetails: "",
          status: "",
          needsEscalation: "",
          escalationDetails: "",
          authSign: ""
        }
      ]
    }));
  };

  // Helper function to remove HI entry
  const removeHiEntry = (index) => {
    setHiReport(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index).map((entry, i) => ({
        ...entry,
        sn: i + 1
      }))
    }));
  };

  // Helper function to remove HA entry
  const removeHaEntry = (index) => {
    setHaReport(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index).map((entry, i) => ({
        ...entry,
        sn: i + 1
      }))
    }));
  };

  useEffect(() => {
    if (status === "authenticated" && canAccessHostelReports && !selectedReport) {
      setSelectedReport("hostel-daily-due");
    }
  }, [status, canAccessHostelReports, selectedReport]);

  useEffect(() => {
    if (selectedReport === "hostel-daily-due" && canAccessHostelReports) {
      if (isHostelAdmin && !isHostelIncharge) {
        fetchAssignedReports();
      } else {
        fetchReports();
      }
    }
  }, [selectedReport, canAccessHostelReports, isHostelAdmin, isHostelIncharge]);

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

  const saveHostelReport = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const reportToSave = reportType === "incharge" ? hiReport : haReport;
      
      // Filter out empty entries based on report type
      let validEntries;
      if (reportType === "incharge") {
        // HI needs: particulars/students, actionType, and details if HI Self
        validEntries = reportToSave.entries.filter(entry => {
          const hasBasicInfo = entry.particulars.trim() || entry.studentInvolved.length > 0;
          const hasActionType = entry.actionType;
          if (entry.actionType === "HI Self") {
            return hasBasicInfo && hasActionType && entry.actionDetails?.trim();
          } else if (entry.actionType === "Admin") {
            return hasBasicInfo && hasActionType;
          }
          return false;
        });
      } else {
        // Admin needs: particulars/students, actionDetails, status
        validEntries = reportToSave.entries.filter(entry => {
          const hasBasicInfo = entry.particulars.trim() || entry.studentInvolved.length > 0;
          const hasActionDetails = entry.actionDetails?.trim();
          const hasStatus = entry.status;
          return hasBasicInfo && hasActionDetails && hasStatus;
        });
      }

      if (validEntries.length === 0) {
        setError("Please add at least one entry with all required details");
        return;
      }

      const reportData = {
        reportDate: reportToSave.reportDate,
        reportType: reportType,
        entries: validEntries,
        submittedBy: session?.user?.id,
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

      setSuccess("Hostel daily due report saved successfully!");
      
      // Reset form
      if (reportType === "incharge") {
        setHiReport({
          reportDate: new Date().toISOString().split('T')[0],
          entries: [{ 
            sn: 1, 
            classId: "",
            particulars: "", 
            studentInvolved: [], 
            actionType: "",
            actionDetails: "",
            authSign: "" 
          }]
        });
      } else {
        setHaReport({
          reportDate: new Date().toISOString().split('T')[0],
          entries: [{ 
            sn: 1, 
            classId: "",
            particulars: "", 
            studentInvolved: [], 
            actionType: "",
            actionDetails: "",
            status: "",
            needsEscalation: "",
            escalationDetails: "",
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
    setHaReport({
      reportDate: report.reportDate,
      entries: report.entries.map(entry => ({
        ...entry,
        // Ensure all required fields are present for Admin completion
        actionDetails: entry.actionDetails || "",
        status: entry.status || "",
        needsEscalation: entry.needsEscalation || "",
        authSign: entry.authSign || ""
      })),
      reportId: report.id // Add reportId for updates
    });
    setShowCreateForm(true); // Switch to create form to edit
    setSelectedReport('hostel-daily-due'); // Ensure we're in the right report type
  };

  if (!canAccessHostelReports) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-600 mb-4">
            You do not have permission to access the Hostel Due Reports.
          </p>
          <p className="text-xs text-slate-500">
            Only Hostel Incharge, Hostel Higher Authority assignees, and users assigned MRI roles in ManageMeedian can access this section.
          </p>
        </div>
      </div>
    );
  }

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
            href="/dashboard/managersCommon/managerial-club"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} /> Back to Reports
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Hostel Due Register
            </h1>
            <p className="text-sm text-slate-600">
              {reportType === "incharge" 
                ? "Hostel Incharge Report - Create initial entries for hostel dues" 
                : "Hostel Admin Report - Review, complete, and escalate reports"
              }
            </p>
          </div>
        </div>

        {/* Report Type Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {isHostelIncharge && (
            <button
              onClick={() => setReportType("incharge")}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                reportType === "incharge" 
                  ? "border-slate-900 text-slate-900" 
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              HI Report
            </button>
          )}
          {isHostelAdmin && (
            <>
              {!isHostelIncharge && (
                <button
                  onClick={() => setReportType("incharge")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    reportType === "incharge" 
                      ? "border-slate-900 text-slate-900" 
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  HI Reports
                </button>
              )}
              <button
                onClick={() => setReportType("admin")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  reportType === "admin" 
                    ? "border-slate-900 text-slate-900" 
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Admin Report
              </button>
            </>
          )}
        </div>

        {/* Sub-tabs for Admin view */}
        {reportType === "admin" && isHostelAdmin && (
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

        {/* HOSTEL INCHARGE REPORT */}
        {reportType === "incharge" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Report Date
              </label>
              <input
                type="date"
                value={hiReport.reportDate}
                onChange={(e) => setHiReport(prev => ({ ...prev, reportDate: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">SN</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Particulars</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Class</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student Involved</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Details</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Auth Sign</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hiReport.entries.map((entry, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.sn}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.particulars}
                          onChange={(e) => updateHiEntry(index, 'particulars', e.target.value)}
                          placeholder="Enter particulars..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.classId}
                          onChange={(e) => updateHiEntry(index, 'classId', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">Select class...</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} {cls.section ? `- ${cls.section}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {entry.classId ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {entry.studentInvolved.length > 0 && getStudentsByClass(entry.classId).filter(s => entry.studentInvolved.includes(String(s.id))).map(student => (
                                <div key={student.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-1 rounded text-sm">
                                  <span>{student.name}</span>
                                  <button
                                    onClick={() => updateHiEntry(index, 'studentInvolved', entry.studentInvolved.filter(sid => sid !== String(student.id)))}
                                    className="text-blue-900 hover:text-blue-700 font-bold">×</button>
                                </div>
                              ))}
                            </div>
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                              {getStudentsByClass(entry.classId).map((student) => (
                                <label key={student.id} className="flex items-center px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0">
                                  <input
                                    type="checkbox"
                                    checked={entry.studentInvolved.includes(String(student.id))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        updateHiEntry(index, 'studentInvolved', [...entry.studentInvolved, String(student.id)]);
                                      } else {
                                        updateHiEntry(index, 'studentInvolved', entry.studentInvolved.filter(sid => sid !== String(student.id)));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 mr-2"
                                  />
                                  <span className="text-sm text-slate-700">{student.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 italic px-3 py-2">Select class first</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.actionType}
                          onChange={(e) => updateHiEntry(index, 'actionType', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">Select action type...</option>
                          <option value="HI Self">HI Self</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {entry.actionType === "HI Self" && (
                          <input
                            type="text"
                            value={entry.actionDetails}
                            onChange={(e) => updateHiEntry(index, 'actionDetails', e.target.value)}
                            placeholder="Enter action details..."
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                          />
                        )}
                        {entry.actionType === "Admin" && (
                          <div className="text-sm text-slate-500 italic px-3 py-2">Sent to Admin</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.authSign}
                          onChange={(e) => updateHiEntry(index, 'authSign', e.target.value)}
                          placeholder="Sign/Initial..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeHiEntry(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={addHiEntry}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                <Plus size={16} /> Add Entry
              </button>
              <button
                onClick={saveHostelReport}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save size={16} /> {loading ? 'Saving...' : 'Save Report'}
              </button>
            </div>
          </div>
        )}

        {/* HOSTEL ADMIN REPORT */}
        {reportType === "admin" && isHostelAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Report Date
              </label>
              <input
                type="date"
                value={haReport.reportDate}
                onChange={(e) => setHaReport(prev => ({ ...prev, reportDate: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">SN</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Particulars</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Class</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student Involved</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action Details</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Escalate</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Auth Sign</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {haReport.entries.map((entry, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.sn}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.particulars}
                          onChange={(e) => updateHaEntry(index, 'particulars', e.target.value)}
                          placeholder="Enter particulars..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.classId}
                          onChange={(e) => updateHaEntry(index, 'classId', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">Select class...</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name} {cls.section ? `- ${cls.section}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {entry.classId ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {entry.studentInvolved.length > 0 && getStudentsByClass(entry.classId).filter(s => entry.studentInvolved.includes(String(s.id))).map(student => (
                                <div key={student.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-1 rounded text-sm">
                                  <span>{student.name}</span>
                                  <button
                                    onClick={() => updateHaEntry(index, 'studentInvolved', entry.studentInvolved.filter(sid => sid !== String(student.id)))}
                                    className="text-blue-900 hover:text-blue-700 font-bold">×</button>
                                </div>
                              ))}
                            </div>
                            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                              {getStudentsByClass(entry.classId).map((student) => (
                                <label key={student.id} className="flex items-center px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0">
                                  <input
                                    type="checkbox"
                                    checked={entry.studentInvolved.includes(String(student.id))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        updateHaEntry(index, 'studentInvolved', [...entry.studentInvolved, String(student.id)]);
                                      } else {
                                        updateHaEntry(index, 'studentInvolved', entry.studentInvolved.filter(sid => sid !== String(student.id)));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 mr-2"
                                  />
                                  <span className="text-sm text-slate-700">{student.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 italic px-3 py-2">Select class first</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.actionType}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-600"
                          disabled
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.actionDetails}
                          onChange={(e) => updateHaEntry(index, 'actionDetails', e.target.value)}
                          placeholder="Enter action details..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.status}
                          onChange={(e) => updateHaEntry(index, 'status', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">Select status...</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={entry.needsEscalation}
                          onChange={(e) => updateHaEntry(index, 'needsEscalation', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        >
                          <option value="">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={entry.authSign}
                          onChange={(e) => updateHaEntry(index, 'authSign', e.target.value)}
                          placeholder="Sign/Initial..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeHaEntry(index)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={addHaEntry}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                <Plus size={16} /> Add Entry
              </button>
              <button
                onClick={saveHostelReport}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <Save size={16} /> {loading ? 'Saving...' : 'Save Report'}
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
