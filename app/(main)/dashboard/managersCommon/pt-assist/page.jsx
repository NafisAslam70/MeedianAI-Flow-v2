"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";

const todayIso = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const fetcher = (url) =>
  fetch(url, { headers: { "Content-Type": "application/json" } }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const splitMultiValue = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const joinMultiValue = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

const sectionDefaults = (section) => {
  const defaults = {};
  const fields = Array.isArray(section?.fields) ? section.fields : [];
  for (const field of fields) {
    const type = (field?.type || "text").toLowerCase();
    if (type === "chips") defaults[field.id] = [];
    else if (type === "boolean") defaults[field.id] = false;
    else defaults[field.id] = "";
  }
  return defaults;
};

export default function PtAssistPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [payloadState, setPayloadState] = useState({ cddRows: [], ccdRows: [], extras: {} });
  const [saveStatus, setSaveStatus] = useState({ message: "", error: "" });
  const [savingAction, setSavingAction] = useState(null);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/managersCommon/pt-assist?date=${selectedDate}`,
    fetcher,
    { dedupingInterval: 15000 }
  );

  const template = data?.template || null;
  const assignments = data?.assignments || [];

  const templateSections = useMemo(() => {
    if (!template?.formSchema?.sections) return [];
    const sections = Array.isArray(template.formSchema.sections) ? template.formSchema.sections : [];
    return sections.map((section) => ({
      ...section,
      fields: Array.isArray(section?.fields) ? section.fields : [],
    }));
  }, [template]);

  const cddSection = useMemo(
    () => templateSections.find((section) => section?.key === "cddRows" || section?.title === "Class Discipline Diary") || null,
    [templateSections]
  );

  const ccdSection = useMemo(
    () => templateSections.find((section) => section?.key === "ccdRows" || section?.title === "Class Curriculum Diary") || null,
    [templateSections]
  );

  useEffect(() => {
    if (!assignments.length) {
      if (selectedAssignmentId !== null) setSelectedAssignmentId(null);
      return;
    }
    const exists = assignments.some((assignment) => assignment.id === selectedAssignmentId);
    if (!exists) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  useEffect(() => {
    if (!selectedAssignment) {
      setPayloadState({ cddRows: [], ccdRows: [], extras: {} });
      return;
    }
    const payload = selectedAssignment.payload || {};
    const { cddRows = [], ccdRows = [], ...extras } = payload;
    setPayloadState({
      cddRows: Array.isArray(cddRows) ? cddRows : [],
      ccdRows: Array.isArray(ccdRows) ? ccdRows : [],
      extras,
    });
    setSaveStatus({ message: "", error: "" });
  }, [selectedAssignment]);

  const updateRow = (sectionKey, index, updater) => {
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      const current = { ...rows[index] };
      const updated = { ...current, ...updater(current) };
      rows[index] = updated;
      return { ...prev, [sectionKey]: rows };
    });
  };

  const addRow = (sectionKey, section) => {
    const defaults = sectionDefaults(section);
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      rows.push({ ...defaults });
      return { ...prev, [sectionKey]: rows };
    });
  };

  const removeRow = (sectionKey, index) => {
    setPayloadState((prev) => {
      const rows = Array.isArray(prev[sectionKey]) ? [...prev[sectionKey]] : [];
      rows.splice(index, 1);
      return { ...prev, [sectionKey]: rows };
    });
  };

  const normalizePayloadForSave = (state) => {
    const next = { ...state.extras };
    next.cddRows = (state.cddRows || []).map((row) => {
      const output = {};
      Object.entries(row || {}).forEach(([fieldId, value]) => {
        if (Array.isArray(value)) output[fieldId] = value;
        else if (typeof value === "boolean") output[fieldId] = value;
        else if (value === "" || value === null) output[fieldId] = "";
        else output[fieldId] = value;
      });
      return output;
    });
    next.ccdRows = (state.ccdRows || []).map((row) => {
      const output = {};
      Object.entries(row || {}).forEach(([fieldId, value]) => {
        if (Array.isArray(value)) output[fieldId] = value;
        else if (typeof value === "boolean") output[fieldId] = value;
        else if (value === "" || value === null) output[fieldId] = "";
        else output[fieldId] = value;
      });
      return output;
    });
    return next;
  };

  const handleSave = async (action = "draft") => {
    if (!selectedAssignment) return;
    setSavingAction(action);
    setSaveStatus({ message: "", error: "" });
    try {
      const payload = normalizePayloadForSave(payloadState);
      const res = await fetch("/api/managersCommon/pt-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          date: selectedDate,
          payload,
          action,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
      setSaveStatus({ message: action === "submit" ? "Submitted to class teacher." : "Saved draft.", error: "" });
      await mutate();
    } catch (err) {
      setSaveStatus({ message: "", error: err.message || "Failed to save report data." });
    } finally {
      setSavingAction(null);
    }
  };

  const renderSection = (sectionKey, sectionData, rows) => {
    if (!sectionData) return null;
    if (sectionKey === "cddRows") return renderCddSection(sectionData, rows);
    if (sectionKey === "ccdRows") return renderCcdSection(sectionData, rows);
    // fallback to generic renderer if future sections added
    return renderGenericSection(sectionKey, sectionData, rows);
  };

  const renderGenericSection = (sectionKey, sectionData, rows) => {
    const fields = Array.isArray(sectionData?.fields) ? sectionData.fields : [];
    const label = sectionData?.title || sectionData?.key || sectionKey;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="light"
              type="button"
              onClick={() => addRow(sectionKey, sectionData)}
            >
              Add Row
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    [sectionKey]: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">No entries yet. Add rows to start capturing data.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row, rowIndex) => (
              <div key={`${sectionKey}-${rowIndex}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Entry {rowIndex + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeRow(sectionKey, rowIndex)}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {fields.map((field) => {
                    const fieldId = field?.id;
                    const type = String(field?.type || "text").toLowerCase();
                    const value = (row && row[fieldId]) ?? (type === "chips" ? [] : type === "boolean" ? false : "");

                    if (type === "textarea") {
                      return (
                        <label key={fieldId} className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                          {field?.label || fieldId}
                          <textarea
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            rows={3}
                            value={String(value || "")}
                            onChange={(event) =>
                              updateRow(sectionKey, rowIndex, () => ({
                                [fieldId]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      );
                    }

                    if (type === "chips") {
                      return (
                        <label key={fieldId} className="flex flex-col gap-1 text-sm text-gray-700 md:col-span-2">
                          {field?.label || fieldId}
                          <textarea
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            rows={2}
                            placeholder="Separate entries with commas or new lines"
                            value={joinMultiValue(value)}
                            onChange={(event) =>
                              updateRow(sectionKey, rowIndex, () => ({
                                [fieldId]: splitMultiValue(event.target.value),
                              }))
                            }
                          />
                        </label>
                      );
                    }

                    if (type === "boolean") {
                      return (
                        <label key={fieldId} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) =>
                              updateRow(sectionKey, rowIndex, () => ({
                                [fieldId]: event.target.checked,
                              }))
                            }
                          />
                          {field?.label || fieldId}
                        </label>
                      );
                    }

                    const inputType = type === "date" ? "date" : "text";
                    return (
                      <label key={fieldId} className="flex flex-col gap-1 text-sm text-gray-700">
                        {field?.label || fieldId}
                        <input
                          type={inputType}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          value={String(value || "")}
                          onChange={(event) =>
                            updateRow(sectionKey, rowIndex, () => ({
                              [fieldId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCcdSection = (sectionData, rows) => {
    const headers = [
      { id: "period", label: "Period" },
      { id: "subject", label: "Subject" },
      { id: "topic", label: "Topic" },
      { id: "classwork", label: "C.W. (what happened)" },
      { id: "homework", label: "H.W. (assigned)" },
      { id: "teacherSignature", label: "T.S." },
      { id: "monitorInitials", label: "Monitor Initials" },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Class Curriculum Diary (CCD)</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" type="button" onClick={() => addRow("ccdRows", sectionData)}>
              Add Period
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    ccdRows: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-xs text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header) => (
                  <th key={header.id} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-4 text-center text-sm text-gray-500">
                    No periods recorded yet. Use "Add Period" to start capturing the day.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`ccd-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                    {headers.map((header) => {
                      const fieldId = header.id;
                      const type = fieldId === "teacherSignature" ? "boolean" : fieldId === "classwork" || fieldId === "homework" ? "textarea" : "text";
                      const value = row?.[fieldId];
                      if (type === "textarea") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 align-top">
                            <textarea
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              rows={3}
                              value={String(value || "")}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      }
                      if (type === "boolean") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) =>
                                updateRow("ccdRows", rowIndex, () => ({
                                  [fieldId]: event.target.checked,
                                }))
                              }
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={fieldId} className="border border-gray-200 px-2 py-2">
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            value={String(value || "")}
                            onChange={(event) =>
                              updateRow("ccdRows", rowIndex, () => ({
                                [fieldId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="border border-gray-200 px-2 py-2 text-center align-middle">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeRow("ccdRows", rowIndex)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCddSection = (sectionData, rows) => {
    const headers = [
      { id: "date", label: "Date", type: "date" },
      { id: "assemblyUniformDefaulters", label: "Assembly/Uniform Defaulters", type: "chips" },
      { id: "languageDefaulters", label: "Language Defaulters", type: "chips" },
      { id: "homeworkDefaulters", label: "Homework Defaulters", type: "chips" },
      { id: "disciplineDefaulters", label: "Discipline Defaulters", type: "chips" },
      { id: "bestStudentOfDay", label: "Best Student of the Day", type: "chips" },
      { id: "absentStudents", label: "Absent Students", type: "chips" },
      { id: "teacherSigned", label: "CT Sign", type: "boolean" },
      { id: "principalStamp", label: "Principal Stamp", type: "boolean" },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Class Discipline Diary (CDD)</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="light" type="button" onClick={() => addRow("cddRows", sectionData)}>
              Add Day
            </Button>
            {rows.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() =>
                  setPayloadState((prev) => ({
                    ...prev,
                    cddRows: [],
                  }))
                }
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 text-xs text-gray-700">
            <thead className="bg-gray-100">
              <tr>
                {headers.map((header) => (
                  <th key={header.id} className="border border-gray-200 px-3 py-2 text-left font-semibold">
                    {header.label}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-4 text-center text-sm text-gray-500">
                    No diary entries yet. Use "Add Day" to start recording CDD updates.
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => (
                  <tr key={`cdd-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                    {headers.map((header) => {
                      const fieldId = header.id;
                      const type = header.type;
                      const value = row?.[fieldId];
                      if (type === "chips") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2">
                            <textarea
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              rows={2}
                              placeholder="Separate entries with commas or new lines"
                              value={joinMultiValue(value)}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: splitMultiValue(event.target.value),
                                }))
                              }
                            />
                          </td>
                        );
                      }
                      if (type === "boolean") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: event.target.checked,
                                }))
                              }
                            />
                          </td>
                        );
                      }
                      if (type === "date") {
                        return (
                          <td key={fieldId} className="border border-gray-200 px-2 py-2">
                            <input
                              type="date"
                              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              value={value || ""}
                              onChange={(event) =>
                                updateRow("cddRows", rowIndex, () => ({
                                  [fieldId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={fieldId} className="border border-gray-200 px-2 py-2">
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            value={String(value || "")}
                            onChange={(event) =>
                              updateRow("cddRows", rowIndex, () => ({
                                [fieldId]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="border border-gray-200 px-2 py-2 text-center align-middle">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeRow("cddRows", rowIndex)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CCD / CDD Assistant</h1>
          <p className="text-sm text-gray-600">
            Capture Class Discipline Diary (CDD) and Class Curriculum Diary (CCD) entries for the PT assignments created in Manage Meedian → MRI Reports.
            The class teacher will review and confirm these entries during day close.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/dashboard/admin/manageMeedian/mri-reports/pt")}>
          Manage PT Assignments
        </Button>
      </div>

      {template && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-gray-900">{template.name || "PT Daily Report Template"}</h2>
              <p className="text-sm text-gray-600">
                Key: <span className="font-mono text-gray-700">{template.key}</span> • Frequency: {template.defaultFrequency || "daily"}
              </p>
              {template.instructions && (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{template.instructions}</p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {templateSections.map((section) => (
                <div key={section?.key || section?.title} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {section?.title || section?.key || "Section"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Entry type: {section?.repeat ? "Multiple rows" : "Single entry"}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-gray-600">
                    {(section?.fields || []).map((field) => (
                      <li key={field?.id} className="flex items-start gap-2">
                        <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                        <span>
                          <span className="font-semibold text-gray-700">{field?.label || field?.id}</span>
                          <span className="text-gray-500"> — {String(field?.type || "text").toUpperCase()}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Working Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value || todayIso());
                setSaveStatus({ message: "", error: "" });
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Assigned Class / Teacher</label>
            <select
              value={selectedAssignmentId || ""}
              onChange={(event) => setSelectedAssignmentId(Number(event.target.value) || null)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {assignments.length === 0 && <option value="">No active assignments</option>}
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.className ? `Class ${assignment.className}${assignment.classSection ? ` ${assignment.classSection}` : ""}` : assignment.targetLabel || "Unlabelled"}{" "}
                  — {assignment.teacherName || "Teacher"}
                  {assignment.assistantUserId
                    ? ` • Assistant: ${assignment.assistantUserId === viewerId ? "You" : assignment.assistantName || `User #${assignment.assistantUserId}`}`
                    : " • Assistant: Unassigned"}
                </option>
              ))}
            </select>
          </div>
          {selectedAssignment && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <p>
                <span className="font-semibold text-gray-700">Assisting Class:</span>{" "}
                {selectedAssignment.className
                  ? `Class ${selectedAssignment.className}${
                      selectedAssignment.classSection ? ` ${selectedAssignment.classSection}` : ""
                    }`
                  : selectedAssignment.targetLabel || "Unlabelled"}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Class Teacher:</span>{" "}
                {selectedAssignment.teacherName || "—"}
                {selectedAssignment.teacherEmail ? ` (${selectedAssignment.teacherEmail})` : ""}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Assistant:</span>{" "}
                {selectedAssignment.assistantUserId
                  ? selectedAssignment.assistantUserId === viewerId
                    ? "You"
                    : selectedAssignment.assistantName || `User #${selectedAssignment.assistantUserId}`
                  : "—"}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Current Status:</span>{" "}
                <span className={selectedAssignment.status === "submitted" ? "text-emerald-600" : "text-slate-700"}>
                  {selectedAssignment.status}
                </span>
              </p>
              {selectedAssignment.confirmationNote && (
                <p className="mt-1 text-amber-700">
                  <span className="font-semibold text-amber-800">Teacher Note:</span>{" "}
                  {selectedAssignment.confirmationNote}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {error && (
        <Card>
          <CardBody>
            <p className="text-sm text-red-600">Failed to load assignments. {error.message}</p>
          </CardBody>
        </Card>
      )}

      {!isLoading && !selectedAssignment && assignments.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">
              No PT assignments found for the selected date. Ensure class teachers and PT assistants are assigned in Manage Meedian → MRI Reports → PT Daily Report.
            </p>
          </CardBody>
        </Card>
      )}

      {selectedAssignment && (
        <>
          <Card>
            <CardBody className="space-y-8">
              {renderSection("cddRows", cddSection, payloadState.cddRows || [])}
              {renderSection("ccdRows", ccdSection, payloadState.ccdRows || [])}
            </CardBody>
          </Card>

          {saveStatus.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveStatus.error}
            </div>
          )}
          {saveStatus.message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {saveStatus.message}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              onClick={() => handleSave("draft")}
              disabled={savingAction !== null}
            >
              {savingAction === "draft" ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave("submit")}
              disabled={savingAction !== null}
            >
              {savingAction === "submit" ? "Submitting…" : "Submit to Teacher"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => mutate()}
              disabled={savingAction !== null}
            >
              Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
