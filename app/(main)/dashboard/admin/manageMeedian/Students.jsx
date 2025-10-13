"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useSWR, { mutate } from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then(async (res) => {
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      throw new Error(message || `HTTP ${res.status}`);
    }
    return res.json();
  });

const defaultFormState = {
  name: "",
  admissionNumber: "",
  admissionDate: "",
  aadharNumber: "",
  dateOfBirth: "",
  gender: "",
  classId: "",
  sectionType: "",
  academicYear: "",
  isHosteller: false,
  transportChosen: false,
  guardianName: "",
  guardianPhone: "",
  guardianWhatsappNumber: "",
  motherName: "",
  address: "",
  bloodGroup: "",
  status: "active",
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const mapStudentToForm = (student) => ({
  name: student.name || "",
  admissionNumber: student.admissionNumber || "",
  admissionDate: toDateInput(student.admissionDate),
  aadharNumber: student.aadharNumber || "",
  dateOfBirth: toDateInput(student.dateOfBirth),
  gender: student.gender || "",
  classId: student.classId ? String(student.classId) : "",
  sectionType: student.sectionType || "",
  academicYear: student.academicYear || "",
  isHosteller: Boolean(student.isHosteller),
  transportChosen: Boolean(student.transportChosen),
  guardianName: student.guardianName || "",
  guardianPhone: student.guardianPhone || "",
  guardianWhatsappNumber: student.guardianWhatsappNumber || "",
  motherName: student.motherName || "",
  address: student.address || "",
  bloodGroup: student.bloodGroup || "",
  status: student.status || "active",
});

export default function Students({ setError, setSuccess }) {
  const [academicYear, setAcademicYear] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [residencyFilter, setResidencyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formData, setFormData] = useState(defaultFormState);
  const [activeStudent, setActiveStudent] = useState(null);
  const [confirmingStudent, setConfirmingStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: yearsData } = useSWR("/api/member/student?type=years", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: classData } = useSWR("/api/member/student?type=classes", fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!academicYear && yearsData?.academicYears?.length) {
      const current = yearsData.academicYears.find((year) => year.isCurrent);
      setAcademicYear(current?.code || yearsData.academicYears[0].code);
    }
  }, [academicYear, yearsData]);

  const studentKey = useMemo(() => {
    const params = new URLSearchParams();
    if (academicYear && academicYear !== "all") params.set("academicYear", academicYear);
    if (classFilter !== "all") params.set("classId", classFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (residencyFilter !== "all") params.set("residentialStatus", residencyFilter);
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    const qs = params.toString();
    return `/api/member/student${qs ? `?${qs}` : ""}`;
  }, [academicYear, classFilter, statusFilter, residencyFilter, searchTerm]);

  const {
    data: studentData,
    error: studentError,
    isLoading: studentsLoading,
  } = useSWR(studentKey, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (studentError) {
      setError(`Failed to load students: ${studentError.message}`);
    }
  }, [studentError, setError]);

  const classes = classData?.classes ?? [];
  const students = studentData?.students ?? [];
  const summary = studentData?.summary ?? { total: 0, hostellers: 0, dayScholars: 0, inactive: 0 };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleOpenCreate = () => {
    resetMessages();
    setFormMode("create");
    setActiveStudent(null);
    setFormData({
      ...defaultFormState,
      academicYear: academicYear !== "all" ? academicYear : "",
      classId: classFilter !== "all" ? classFilter : "",
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (student) => {
    resetMessages();
    setFormMode("edit");
    setActiveStudent(student);
    const mapped = mapStudentToForm(student);
    if (!mapped.academicYear && academicYear && academicYear !== "all") {
      mapped.academicYear = academicYear;
    }
    setFormData(mapped);
    setIsFormOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, type, value, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const buildPayload = () => {
    const payload = {
      name: formData.name.trim(),
      admissionNumber: formData.admissionNumber.trim() || null,
      admissionDate: formData.admissionDate || null,
      aadharNumber: formData.aadharNumber.trim() || null,
      dateOfBirth: formData.dateOfBirth || null,
      gender: formData.gender || null,
      classId: formData.classId ? Number(formData.classId) : null,
      sectionType: formData.sectionType.trim() || null,
      academicYear: formData.academicYear || null,
      isHosteller: formData.isHosteller,
      transportChosen: formData.transportChosen,
      guardianName: formData.guardianName.trim() || null,
      guardianPhone: formData.guardianPhone.trim() || null,
      guardianWhatsappNumber: formData.guardianWhatsappNumber.trim() || null,
      motherName: formData.motherName.trim() || null,
      address: formData.address.trim() || null,
      bloodGroup: formData.bloodGroup.trim() || null,
      status: formData.status || "active",
    };
    if (!payload.classId) {
      throw new Error("Please select a class");
    }
    if (!payload.academicYear) {
      throw new Error("Please select an academic year");
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    try {
      const payload = buildPayload();
      setSaving(true);
      const endpoint =
        formMode === "edit" && activeStudent
          ? `/api/member/student/${activeStudent.id}`
          : "/api/member/student";
      const method = formMode === "edit" ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || `Request failed with status ${response.status}`);
      }
      setIsFormOpen(false);
      setSuccess(formMode === "edit" ? "Student updated successfully" : "Student added successfully");
      mutate(studentKey);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.message || "Failed to save student");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (student) => {
    resetMessages();
    setConfirmingStudent(student);
  };

  const handleDelete = async (hardDelete = false) => {
    if (!confirmingStudent) return;
    setDeleting(true);
    resetMessages();
    try {
      const endpoint = `/api/member/student/${confirmingStudent.id}${hardDelete ? "?mode=hard" : ""}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || `Failed with status ${response.status}`);
      }
      setSuccess(hardDelete ? "Student deleted" : "Student marked inactive");
      mutate(studentKey);
      setTimeout(() => setSuccess(""), 2500);
      setConfirmingStudent(null);
    } catch (error) {
      setError(error.message || "Failed to update student");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setClassFilter("all");
    setStatusFilter("active");
    setResidencyFilter("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Manage Students</h2>
          <p className="text-sm text-gray-500">
            Shared student registry for MeedianAI apps. Finance-only fields stay managed in Finance.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
        >
          Add Student
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
          <p className="text-2xl font-semibold text-gray-800">{summary.total}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs uppercase tracking-wide text-gray-500">Hostellers</p>
          <p className="text-2xl font-semibold text-gray-800">{summary.hostellers}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs uppercase tracking-wide text-gray-500">Day Scholars</p>
          <p className="text-2xl font-semibold text-gray-800">{summary.dayScholars}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <p className="text-xs uppercase tracking-wide text-gray-500">Inactive / Left</p>
          <p className="text-2xl font-semibold text-gray-800">{summary.inactive}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-md">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">Academic Year</label>
            <select
              value={academicYear || ""}
              onChange={(event) => setAcademicYear(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              {yearsData?.academicYears?.map((year) => (
                <option key={year.code} value={year.code}>
                  {year.name || year.code}
                  {year.isCurrent ? " (Current)" : ""}
                </option>
              ))}
              {(!yearsData || yearsData.academicYears?.length === 0) && <option value="">No academic years</option>}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">Class</label>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                  {cls.section ? ` • ${cls.section}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="left">Left</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">Residential</label>
            <select
              value={residencyFilter}
              onChange={(event) => setResidencyFilter(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All Students</option>
              <option value="hosteller">Hosteller</option>
              <option value="dayscholar">Day Scholar</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">Search</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, admission no, guardian..."
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-teal-600 transition hover:text-teal-700"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Student
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Class
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Guardian
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Residency
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Academic Year
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {studentsLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                    Loading students...
                  </td>
                </tr>
              )}
              {!studentsLoading && students.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                    No students match the current filters.
                  </td>
                </tr>
              )}
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                    <div className="font-semibold text-gray-800">{student.name}</div>
                    <div className="text-xs text-gray-500">
                      Adm No: {student.admissionNumber || "—"}
                      {student.sectionType ? ` • Section ${student.sectionType}` : ""}
                    </div>
                    <div className="text-xs text-gray-400">
                      DOB: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    <div>{student.className || "Not assigned"}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    <div>{student.guardianName || "—"}</div>
                    <div className="text-xs text-gray-500">{student.motherName ? `Mother: ${student.motherName}` : ""}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    <div>{student.guardianPhone || "—"}</div>
                    <div className="text-xs text-gray-500">
                      WhatsApp: {student.guardianWhatsappNumber || "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        student.isHosteller ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {student.isHosteller ? "Hosteller" : "Day Scholar"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    {student.academicYear || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        student.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : student.status === "inactive"
                          ? "bg-gray-200 text-gray-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {student.status ?? "unknown"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(student)}
                        className="rounded-md border border-teal-600 px-3 py-1 text-xs font-semibold text-teal-600 transition hover:bg-teal-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(student)}
                        className="rounded-md border border-red-500 px-3 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {formMode === "edit" ? "Edit Student" : "Add Student"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Update shared student details. Finance-specific actions remain in MeedianAI-Finance.
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Full Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Admission Number</label>
                  <input
                    name="admissionNumber"
                    value={formData.admissionNumber}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Class *</label>
                  <select
                    name="classId"
                    value={formData.classId}
                    onChange={handleFormChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">Select class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.section ? ` • ${cls.section}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Academic Year</label>
                  <select
                    name="academicYear"
                    value={formData.academicYear}
                    onChange={handleFormChange}
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    {yearsData?.academicYears?.map((year) => (
                      <option key={year.code} value={year.code}>
                        {year.name || year.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Section / Track</label>
                  <input
                    name="sectionType"
                    value={formData.sectionType}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Admission Date</label>
                  <input
                    type="date"
                    name="admissionDate"
                    value={formData.admissionDate}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Aadhar Number</label>
                  <input
                    name="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={handleFormChange}
                    maxLength={20}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <input
                    id="isHosteller"
                    type="checkbox"
                    name="isHosteller"
                    checked={formData.isHosteller}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="isHosteller" className="text-sm font-medium text-gray-700">
                    Hosteller
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <input
                    id="transportChosen"
                    type="checkbox"
                    name="transportChosen"
                    checked={formData.transportChosen}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                  />
                  <label htmlFor="transportChosen" className="text-sm font-medium text-gray-700">
                    Transport opted
                  </label>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Guardian Name</label>
                  <input
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Guardian Phone</label>
                  <input
                    name="guardianPhone"
                    value={formData.guardianPhone}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Guardian WhatsApp</label>
                  <input
                    name="guardianWhatsappNumber"
                    value={formData.guardianWhatsappNumber}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Mother&apos;s Name</label>
                  <input
                    name="motherName"
                    value={formData.motherName}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Blood Group</label>
                  <input
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="left">Left</option>
                  </select>
                </div>
                <div className="md:col-span-2 mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : formMode === "edit" ? "Save Changes" : "Create Student"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmingStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-gray-800">Remove student record?</h3>
              <p className="mt-2 text-sm text-gray-600">
                {confirmingStudent.name} will be marked inactive. Finance dues and historic records remain untouched.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setConfirmingStudent(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(false)}
                  disabled={deleting}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Updating..." : "Mark Inactive"}
                </button>
                <button
                  onClick={() => handleDelete(true)}
                  disabled={deleting}
                  className="rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
