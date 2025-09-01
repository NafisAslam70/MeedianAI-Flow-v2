"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR, { mutate } from "swr";

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });

export default function Students({ setError, setSuccess }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [filters, setFilters] = useState({
    isHosteller: "",
    feeStatus: "",
    status: "active",
  });
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    admissionNumber: "",
    admissionDate: "",
    aadharNumber: "",
    dateOfBirth: "",
    gender: "",
    classId: "",
    sectionType: "",
    isHosteller: false,
    transportChosen: false,
    guardianPhone: "",
    guardianName: "",
    guardianWhatsappNumber: "",
    motherName: "",
    address: "",
    bloodGroup: "",
    feeStatus: "Pending",
    status: "active",
    accountOpened: false,
  });

  const { data: studentData, error: studentError } = useSWR(
    "/api/member/student",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );

  const { data: classData, error: classError } = useSWR(
    "/api/member/student?type=classes",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000, revalidateOnReconnect: false }
  );

  useEffect(() => {
    if (studentData) {
      setStudents(studentData.students || []);
    }
    if (studentError) {
      setError(`Failed to load students: ${studentError.message}. Check database or server logs.`);
    }
    if (classData) {
      setClasses(classData.classes || []);
    }
    if (classError) {
      setError(`Failed to load classes: ${classError.message}. Check database or server logs.`);
    }
    setLoading(!(studentData && classData) && !(studentError || classError));
  }, [studentData, studentError, classData, classError, setError]);

  // Calculate summary stats
  const totalStudents = students.length;
  const totalHostellers = students.filter((s) => s.isHosteller).length;
  const totalDayScholars = students.filter((s) => !s.isHosteller).length;

  // Filter students based on selected class and filters
  const filteredStudents = selectedClass
    ? students
        .filter((student) => student.classId === parseInt(selectedClass))
        .filter((student) =>
          filters.isHosteller ? student.isHosteller === (filters.isHosteller === "hosteller") : true
        )
        .filter((student) => (filters.feeStatus ? student.feeStatus === filters.feeStatus : true))
        .filter((student) => (filters.status ? student.status === filters.status : true))
    : [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const addStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/member/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || `Add failed: ${res.status}`);
      setSuccess("Student added successfully!");
      setTimeout(() => setSuccess(""), 3000);
      mutate("/api/member/student");
      setShowAddModal(false);
      setFormData({
        name: "",
        admissionNumber: "",
        admissionDate: "",
        aadharNumber: "",
        dateOfBirth: "",
        gender: "",
        classId: "",
        sectionType: "",
        isHosteller: false,
        transportChosen: false,
        guardianPhone: "",
        guardianName: "",
        guardianWhatsappNumber: "",
        motherName: "",
        address: "",
        bloodGroup: "",
        feeStatus: "Pending",
        status: "active",
        accountOpened: false,
      });
    } catch (err) {
      setError(`Error adding student: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Manage Students</h2>
        <motion.button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 font-semibold"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Add New Student
        </motion.button>
      </div>

      {loading ? (
        <p className="text-gray-600 text-center text-lg">Loading...</p>
      ) : !selectedClass ? (
        <div>
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-teal-700">{totalStudents}</p>
                <p className="text-sm text-gray-600">Total Students</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-teal-700">{totalHostellers}</p>
                <p className="text-sm text-gray-600">Total Hostellers</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-teal-700">{totalDayScholars}</p>
                <p className="text-sm text-gray-600">Total Day Scholars</p>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Select a Class</h3>
          {classes.length === 0 ? (
            <p className="text-gray-600 text-center text-lg">No classes found. Please check the database.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <motion.div
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-teal-50 transition-all duration-200"
                  whileHover={{ scale: 1.05, boxShadow: "0 6px 12px rgba(0, 128, 128, 0.2)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <h4 className="text-lg font-semibold text-teal-700">{cls.name}</h4>
                  <p className="text-sm text-gray-500">
                    {students.filter((s) => s.classId === cls.id).length} Students
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <motion.button
              onClick={() => setSelectedClass(null)}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ← Back to Classes
            </motion.button>
            <h3 className="text-xl font-semibold text-gray-800">
              Students in {classes.find((c) => c.id === parseInt(selectedClass))?.name || "Unknown Class"}
            </h3>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-lg font-semibold text-gray-700 mb-4">Filters</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Residential Status</label>
                <select
                  name="isHosteller"
                  value={filters.isHosteller}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                >
                  <option value="">All</option>
                  <option value="hosteller">Hosteller</option>
                  <option value="dayscholar">Day Scholar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fee Status</label>
                <select
                  name="feeStatus"
                  value={filters.feeStatus}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                >
                  <option value="">All</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="mt-1 w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          {filteredStudents.length === 0 ? (
            <p className="text-gray-600 text-center text-lg">No students found for this class.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Student List</h4>
              <div className="space-y-4">
                {filteredStudents.map((student) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow duration-200"
                  >
                    <p className="text-lg font-medium text-gray-800">{student.name}</p>
                    <p className="text-sm text-gray-600">Admission No: {student.admissionNumber || "N/A"}</p>
                    <p className="text-sm text-gray-600">Guardian: {student.guardianName || "N/A"}</p>
                    <p className="text-sm text-gray-600">Fee Status: {student.feeStatus || "N/A"}</p>
                    <p className="text-sm text-gray-600">Status: {student.status || "N/A"}</p>
                    <p className="text-sm text-gray-600">Gender: {student.gender || "N/A"}</p>
                    <p className="text-sm text-gray-600">
                      Date of Birth: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "N/A"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Admission Date: {student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : "N/A"}
                    </p>
                    <p className="text-sm text-gray-600">Aadhar: {student.aadharNumber || "N/A"}</p>
                    <p className="text-sm text-gray-600">Section: {student.sectionType || "N/A"}</p>
                    <p className="text-sm text-gray-600">Transport: {student.transportChosen ? "Yes" : "No"}</p>
                    <p className="text-sm text-gray-600">Guardian Phone: {student.guardianPhone || "N/A"}</p>
                    <p className="text-sm text-gray-600">Guardian WhatsApp: {student.guardianWhatsappNumber || "N/A"}</p>
                    <p className="text-sm text-gray-600">Mother: {student.motherName || "N/A"}</p>
                    <p className="text-sm text-gray-600">Address: {student.address || "N/A"}</p>
                    <p className="text-sm text-gray-600">Blood Group: {student.bloodGroup || "N/A"}</p>
                    <p className="text-sm text-gray-600">Account Opened: {student.accountOpened ? "Yes" : "No"}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Add New Student</h2>
              <form onSubmit={addStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Admission Number</label>
                  <input
                    type="text"
                    name="admissionNumber"
                    value={formData.admissionNumber}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Admission Date</label>
                  <input
                    type="date"
                    name="admissionDate"
                    value={formData.admissionDate}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Aadhar Number</label>
                  <input
                    type="text"
                    name="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Class</label>
                  <select
                    name="classId"
                    value={formData.classId}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                    required
                  >
                    <option value="">Select Class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Section Type</label>
                  <input
                    type="text"
                    name="sectionType"
                    value={formData.sectionType}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isHosteller"
                    checked={formData.isHosteller}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-teal-600"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Hosteller</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="transportChosen"
                    checked={formData.transportChosen}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-teal-600"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Transport Chosen</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Guardian Phone</label>
                  <input
                    type="text"
                    name="guardianPhone"
                    value={formData.guardianPhone}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Guardian Name</label>
                  <input
                    type="text"
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Guardian WhatsApp</label>
                  <input
                    type="text"
                    name="guardianWhatsappNumber"
                    value={formData.guardianWhatsappNumber}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mother Name</label>
                  <input
                    type="text"
                    name="motherName"
                    value={formData.motherName}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Blood Group</label>
                  <input
                    type="text"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fee Status</label>
                  <select
                    name="feeStatus"
                    value={formData.feeStatus}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="mt-1 p-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 text-base"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="accountOpened"
                    checked={formData.accountOpened}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-teal-600"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">Account Opened</label>
                </div>
                <div className="col-span-2 flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all duration-200 disabled:opacity-50"
                  >
                    {saving ? "Adding..." : "Add Student"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}