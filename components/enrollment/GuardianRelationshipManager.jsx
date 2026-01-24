"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  MessageCircle,
  Users,
  TrendingUp,
  Clock,
  MapPin,
  BookOpen,
  Heart,
  Star,
  Search,
  Plus,
  Eye,
  Edit3,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const DEFAULT_INTERESTS = {
  islamic_education_priority: "medium",
  academic_excellence_priority: "medium",
  boarding_interest: "maybe",
};
const DEFAULT_WHATSAPP_TEMPLATE_SID = "HX3149b82c2591e2b1a64bf762e394fb41";
const DEFAULT_WHATSAPP_SUBJECT = "उपस्थिति सूचना";

const STATUS_META = {
  new_lead: { label: "New Lead", color: "blue" },
  high_interest: { label: "High Interest", color: "teal" },
  nurturing: { label: "Nurturing", color: "amber" },
  follow_up_needed: { label: "Follow Up", color: "red" },
  enrolled: { label: "Enrolled", color: "teal" },
  inactive: { label: "Inactive", color: "gray" },
};

const buildEmptyChild = () => ({ name: "", age: "", currentSchool: "" });

const buildAddForm = () => ({
  name: "",
  whatsapp: "",
  location: "",
  notes: "",
  islamic_education_priority: "medium",
  academic_excellence_priority: "medium",
  boarding_interest: "maybe",
  children: [buildEmptyChild()],
});

const normalizeGuardian = (guardian) => {
  const rawInterests = guardian?.interests;
  let parsedInterests = rawInterests;
  if (rawInterests && typeof rawInterests === "string") {
    try {
      parsedInterests = JSON.parse(rawInterests);
    } catch {
      parsedInterests = null;
    }
  }

  return {
    ...guardian,
    interests: {
      ...DEFAULT_INTERESTS,
      ...(parsedInterests || {}),
    },
    children: Array.isArray(guardian?.children) ? guardian.children : [],
    interactions: Array.isArray(guardian?.interactions) ? guardian.interactions : [],
  };
};

const isActiveStatus = (status) => {
  const value = (status || "").toString().toLowerCase();
  return value === "active";
};

const getOngoingStatus = (guardian) => {
  const children = Array.isArray(guardian?.children) ? guardian.children : [];
  if (!children.length) return "inactive";
  const hasActive = children.some((child) => isActiveStatus(child.status));
  return hasActive ? "active" : "inactive";
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractNames = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildCddSignals = (instances, studentName) => {
  const studentKey = normalizeName(studentName);
  if (!studentKey || !Array.isArray(instances)) return [];

  const fields = [
    { key: "absentStudents", label: "Absent" },
    { key: "disciplineDefaulters", label: "Discipline" },
    { key: "homeworkDefaulters", label: "Homework" },
    { key: "languageDefaulters", label: "Language" },
    { key: "assemblyUniformDefaulters", label: "Uniform" },
  ];

  const matchesName = (candidate) => {
    const normalized = normalizeName(candidate);
    if (!normalized) return false;
    return normalized === studentKey || normalized.includes(studentKey) || studentKey.includes(normalized);
  };

  const byDate = new Map();
  instances.forEach((instance) => {
    const baseDate = instance?.targetDate || "";
    const rows = Array.isArray(instance?.cddRows) ? instance.cddRows : [];
    rows.forEach((row) => {
      const dateKey = row?.date || baseDate;
      if (!dateKey) return;
      const categories = new Set();
      fields.forEach((field) => {
        const names = extractNames(row?.[field.key]);
        if (names.some(matchesName)) {
          categories.add(field.label);
        }
      });
      if (!categories.size) return;
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, new Set());
      }
      const existing = byDate.get(dateKey);
      categories.forEach((label) => existing.add(label));
    });
  });

  return Array.from(byDate.entries())
    .map(([date, categories]) => ({
      date,
      categories: Array.from(categories.values()),
    }))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
};

const GuardianRelationshipManager = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [probableGuardians, setProbableGuardians] = useState([]);
  const [ongoingGuardians, setOngoingGuardians] = useState([]);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
  const [selectedGuardianGroup, setSelectedGuardianGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [guardianGroup, setGuardianGroup] = useState("probable");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loadingProbable, setLoadingProbable] = useState(true);
  const [loadingOngoing, setLoadingOngoing] = useState(true);
  const [loadErrorProbable, setLoadErrorProbable] = useState("");
  const [loadErrorOngoing, setLoadErrorOngoing] = useState("");
  const [classOptions, setClassOptions] = useState([]);
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState("");
  const [ongoingClassId, setOngoingClassId] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(() => buildAddForm());
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [editGuardianId, setEditGuardianId] = useState(null);
  const [guardianModalMode, setGuardianModalMode] = useState("add");
  const [interactionModal, setInteractionModal] = useState({
    open: false,
    mode: "whatsapp",
    guardian: null,
  });
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("default");
  const [interactionForm, setInteractionForm] = useState({
    message: "",
    subject: DEFAULT_WHATSAPP_SUBJECT,
    notes: "",
    duration: "",
    outcome: "positive",
    followUpRequired: false,
    followUpDate: "",
    followUpNotes: "",
  });
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [commSearch, setCommSearch] = useState("");
  const [mgcpSection, setMgcpSection] = useState("head");
  const [isMgcpDrawerOpen, setIsMgcpDrawerOpen] = useState(false);
  const [leadModal, setLeadModal] = useState({ open: false, scope: "random", beltId: null });
  const [leadForm, setLeadForm] = useState(() => buildAddForm());
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [mgcpLoading, setMgcpLoading] = useState(false);
  const [mgcpError, setMgcpError] = useState("");
  const [mgcpBelts, setMgcpBelts] = useState([]);
  const [mgcpRandomLeads, setMgcpRandomLeads] = useState([]);
  const [mgcpHeads, setMgcpHeads] = useState([]);
  const [mgcpUsers, setMgcpUsers] = useState([]);
  const [selectedBeltId, setSelectedBeltId] = useState("");
  const [mgcpActionState, setMgcpActionState] = useState({
    error: "",
    saving: false,
  });
  const [beltForm, setBeltForm] = useState({ name: "", notes: "" });
  const [villageForm, setVillageForm] = useState({ name: "", notes: "" });
  const [leadManagerForm, setLeadManagerForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    notes: "",
  });
  const [existingKingForm, setExistingKingForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    notes: "",
    trusted: false,
  });
  const [headForm, setHeadForm] = useState({ userId: "" });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadProbable = async () => {
      setLoadingProbable(true);
      setLoadErrorProbable("");
      try {
        const res = await fetch("/api/enrollment/guardians?limit=500", {
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load guardians");
        }
        const data = await res.json();
        if (!isMounted) return;
        const rows = Array.isArray(data?.guardians) ? data.guardians : [];
        setProbableGuardians(rows.map(normalizeGuardian));
      } catch (error) {
        if (!isMounted || error.name === "AbortError") return;
        setLoadErrorProbable(error.message || "Failed to load guardians");
        setProbableGuardians([]);
      } finally {
        if (isMounted) setLoadingProbable(false);
      }
    };

    loadProbable();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (guardianGroup === "ongoing") {
      setIncludeInactive(false);
      setFilterStatus("active");
    } else {
      setFilterStatus("all");
    }
  }, [guardianGroup]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadClasses = async () => {
      setClassLoading(true);
      setClassError("");
      try {
        const res = await fetch("/api/member/student?type=classes", {
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load classes");
        }
        const data = await res.json();
        if (!active) return;
        setClassOptions(Array.isArray(data?.classes) ? data.classes : []);
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        setClassError(error.message || "Failed to load classes");
      } finally {
        if (active) setClassLoading(false);
      }
    };

    loadClasses();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadOngoing = async () => {
      setLoadingOngoing(true);
      setLoadErrorOngoing("");
      try {
        const params = new URLSearchParams();
        params.set("status", includeInactive ? "all" : "active");
        if (ongoingClassId && ongoingClassId !== "all") {
          params.set("classId", ongoingClassId);
        }
        const url = params.toString()
          ? `/api/enrollment/ongoing-guardians?${params.toString()}`
          : "/api/enrollment/ongoing-guardians";

        const res = await fetch(url, {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load ongoing guardians");
        }
        const data = await res.json();
        if (!active) return;
        const rows = Array.isArray(data?.guardians) ? data.guardians : [];
        setOngoingGuardians(rows.map(normalizeGuardian));
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        setLoadErrorOngoing(error.message || "Failed to load ongoing guardians");
        setOngoingGuardians([]);
      } finally {
        if (active) setLoadingOngoing(false);
      }
    };

    loadOngoing();

    return () => {
      active = false;
      controller.abort();
    };
  }, [ongoingClassId, includeInactive]);

  const loadMgcpData = async (signal) => {
    setMgcpLoading(true);
    setMgcpError("");
    try {
      const res = await fetch("/api/enrollment/mgcp/belts?include=details", {
        headers: { "Content-Type": "application/json" },
        signal,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load MGCP data");
      }
      const belts = Array.isArray(payload?.belts) ? payload.belts : [];
      setMgcpBelts(belts);
      setMgcpRandomLeads(Array.isArray(payload?.randomLeads) ? payload.randomLeads : []);
    } catch (error) {
      if (error.name === "AbortError") return;
      setMgcpError(error.message || "Failed to load MGCP data");
      setMgcpBelts([]);
      setMgcpRandomLeads([]);
    } finally {
      setMgcpLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "mgcp") return;
    const controller = new AbortController();
    loadMgcpData(controller.signal);
    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "mgcp" && isMgcpDrawerOpen) {
      setIsMgcpDrawerOpen(false);
    }
  }, [activeTab, isMgcpDrawerOpen]);

  const loadMgcpHeads = async (signal) => {
    try {
      const res = await fetch("/api/enrollment/mgcp/heads", {
        headers: { "Content-Type": "application/json" },
        signal,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load MGCP heads");
      setMgcpHeads(Array.isArray(payload?.heads) ? payload.heads : []);
    } catch (error) {
      if (error.name === "AbortError") return;
      setMgcpHeads([]);
    }
  };

  const loadMgcpUsers = async (signal) => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "Content-Type": "application/json" },
        signal,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load users");
      setMgcpUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (error) {
      if (error.name === "AbortError") return;
      setMgcpUsers([]);
    }
  };

  useEffect(() => {
    if (!mgcpBelts.length) {
      if (selectedBeltId) setSelectedBeltId("");
      return;
    }
    if (!selectedBeltId || !mgcpBelts.some((belt) => String(belt.id) === String(selectedBeltId))) {
      setSelectedBeltId(String(mgcpBelts[0].id));
    }
  }, [mgcpBelts, selectedBeltId]);

  useEffect(() => {
    if (activeTab !== "mgcp") return;
    const controller = new AbortController();
    loadMgcpHeads(controller.signal);
    loadMgcpUsers(controller.signal);
    return () => controller.abort();
  }, [activeTab]);

  const currentGuardians = guardianGroup === "ongoing" ? ongoingGuardians : probableGuardians;
  const selectedBelt = mgcpBelts.find((belt) => String(belt.id) === String(selectedBeltId)) || null;
  const leadBelt =
    leadModal.open && leadModal.scope === "belt"
      ? mgcpBelts.find((belt) => String(belt.id) === String(leadModal.beltId)) || null
      : null;

  const filteredGuardians = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return currentGuardians.filter((guardian) => {
      if (guardianGroup === "probable" && guardian.status === "enrolled") return false;

      const matchesSearch =
        !needle ||
        guardian.name?.toLowerCase().includes(needle) ||
        guardian.location?.toLowerCase().includes(needle);
      const matchesFilter =
        filterStatus === "all" ||
        (guardianGroup === "ongoing"
          ? getOngoingStatus(guardian) === filterStatus
          : guardian.status === filterStatus);
      if (!matchesSearch || !matchesFilter) return false;
      if (guardianGroup === "ongoing" && ongoingClassId !== "all") {
        return guardian.children?.some((child) => String(child.classId) === String(ongoingClassId));
      }
      return true;
    });
  }, [currentGuardians, searchTerm, filterStatus, guardianGroup, ongoingClassId]);

  const ongoingCount = ongoingGuardians.length;
  const probableCount = probableGuardians.length;
  const totalGuardians = ongoingCount + probableCount;
  const isLoading = guardianGroup === "ongoing" ? loadingOngoing : loadingProbable;
  const currentError = guardianGroup === "ongoing" ? loadErrorOngoing : loadErrorProbable;

  const avgEngagement = probableGuardians.length
    ? Math.round(
        probableGuardians.reduce((acc, g) => acc + (g.engagementScore || 0), 0) /
          probableGuardians.length
      )
    : 0;
  const isEditingGuardian =
    guardianModalMode === "edit" &&
    editGuardianId !== null &&
    editGuardianId !== "" &&
    Number.isFinite(Number(editGuardianId));

  const openAddModal = () => {
    setAddError("");
    setEditGuardianId(null);
    setGuardianModalMode("add");
    setAddForm(buildAddForm());
    setIsAddOpen(true);
  };

  const openEditModal = (guardian) => {
    if (!guardian) return;
    const children = Array.isArray(guardian.children) && guardian.children.length
      ? guardian.children.map((child) => ({
          name: child.name || "",
          age: Number.isFinite(Number(child.age)) ? String(child.age) : "",
          currentSchool: child.currentSchool || "",
        }))
      : [buildEmptyChild()];

    setAddError("");
    setEditGuardianId(guardian.id);
    setGuardianModalMode("edit");
    setAddForm({
      name: guardian.name || "",
      whatsapp: guardian.whatsapp || "",
      location: guardian.location || "",
      notes: guardian.notes || "",
      islamic_education_priority: guardian.interests?.islamic_education_priority || "medium",
      academic_excellence_priority: guardian.interests?.academic_excellence_priority || "medium",
      boarding_interest: guardian.interests?.boarding_interest || "maybe",
      children,
    });
    setIsAddOpen(true);
  };

  const openLeadModal = (scope, beltId = null) => {
    setLeadError("");
    setLeadForm(buildAddForm());
    setLeadModal({ open: true, scope, beltId });
  };

  const closeAddModal = () => {
    if (addSaving) return;
    setIsAddOpen(false);
    setAddForm(buildAddForm());
    setAddError("");
    setEditGuardianId(null);
    setGuardianModalMode("add");
  };

  const closeLeadModal = () => {
    if (leadSaving) return;
    setLeadModal({ open: false, scope: "random", beltId: null });
    setLeadForm(buildAddForm());
    setLeadError("");
  };

  const openInteractionModal = (guardian, mode) => {
    if (!guardian) return;
    setInteractionError("");
    setTemplatesError("");
    setInteractionForm({
      message: "",
      subject: DEFAULT_WHATSAPP_SUBJECT,
      notes: "",
      duration: "",
      outcome: "positive",
      followUpRequired: false,
      followUpDate: "",
      followUpNotes: "",
    });
    setSelectedTemplateId("default");
    setInteractionModal({ open: true, mode, guardian });
  };

  const closeInteractionModal = () => {
    if (interactionSaving) return;
    setInteractionModal({ open: false, mode: "whatsapp", guardian: null });
    setSelectedTemplateId("default");
    setWhatsappTemplates([]);
    setTemplatesError("");
    setInteractionForm({
      message: "",
      subject: DEFAULT_WHATSAPP_SUBJECT,
      notes: "",
      duration: "",
      outcome: "positive",
      followUpRequired: false,
      followUpDate: "",
      followUpNotes: "",
    });
    setInteractionError("");
  };

  useEffect(() => {
    if (!interactionModal.open || interactionModal.mode !== "whatsapp") return;
    let active = true;
    const controller = new AbortController();

    const loadTemplates = async () => {
      setTemplatesLoading(true);
      setTemplatesError("");
      try {
        const res = await fetch("/api/enrollment/communications?action=templates", {
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to load templates");
        }
        if (!active) return;
        const rows = Array.isArray(payload?.templates) ? payload.templates : [];
        setWhatsappTemplates(rows);
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        setTemplatesError(error.message || "Failed to load templates");
        setWhatsappTemplates([]);
      } finally {
        if (active) setTemplatesLoading(false);
      }
    };

    loadTemplates();
    return () => {
      active = false;
      controller.abort();
    };
  }, [interactionModal.open, interactionModal.mode]);

  const updateAddField = (field) => (event) => {
    const value = event.target.value;
    setAddForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLeadField = (field) => (event) => {
    const value = event.target.value;
    setLeadForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateInteractionField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setInteractionForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateChildField = (index, field) => (event) => {
    const value = event.target.value;
    setAddForm((prev) => ({
      ...prev,
      children: prev.children.map((child, idx) =>
        idx === index ? { ...child, [field]: value } : child
      ),
    }));
  };

  const updateLeadChildField = (index, field) => (event) => {
    const value = event.target.value;
    setLeadForm((prev) => ({
      ...prev,
      children: prev.children.map((child, idx) =>
        idx === index ? { ...child, [field]: value } : child
      ),
    }));
  };

  const addChildRow = () => {
    setAddForm((prev) => ({
      ...prev,
      children: [...prev.children, buildEmptyChild()],
    }));
  };

  const addLeadChildRow = () => {
    setLeadForm((prev) => ({
      ...prev,
      children: [...prev.children, buildEmptyChild()],
    }));
  };

  const removeChildRow = (index) => {
    setAddForm((prev) => ({
      ...prev,
      children: prev.children.filter((_, idx) => idx !== index),
    }));
  };

  const removeLeadChildRow = (index) => {
    setLeadForm((prev) => ({
      ...prev,
      children: prev.children.filter((_, idx) => idx !== index),
    }));
  };

  const buildGuardianPayload = (form) => {
    const name = form.name.trim();
    const whatsapp = form.whatsapp.trim();
    const location = form.location.trim();
    const notes = form.notes.trim();

    if (!name || !whatsapp || !location) {
      return { error: "Name, WhatsApp, and location are required." };
    }

    const children = form.children
      .map((child) => {
        const childName = child.name.trim();
        if (!childName) return null;
        const ageValue = Number(child.age);
        return {
          name: childName,
          age: Number.isFinite(ageValue) ? ageValue : null,
          currentSchool: child.currentSchool.trim() || null,
        };
      })
      .filter(Boolean);

    return {
      payload: {
        name,
        whatsapp,
        location,
        notes: notes || null,
        interests: {
          islamic_education_priority: form.islamic_education_priority,
          academic_excellence_priority: form.academic_excellence_priority,
          boarding_interest: form.boarding_interest,
        },
        children,
      },
      children,
    };
  };

  const handleAddGuardian = async (event) => {
    event.preventDefault();
    if (addSaving) return;

    const built = buildGuardianPayload(addForm);
    if (built.error) {
      setAddError(built.error);
      return;
    }
    const { payload, children } = built;

    setAddSaving(true);
    setAddError("");

    try {
      const isEditing = isEditingGuardian;
      const res = await fetch(
        isEditing
          ? `/api/enrollment/guardians?id=${editGuardianId}`
          : "/api/enrollment/guardians",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || (isEditing ? "Failed to update guardian" : "Failed to add guardian"));
      }

      if (isEditing) {
        setProbableGuardians((prev) =>
          prev.map((guardian) => {
            if (guardian.id !== editGuardianId) return guardian;
            return normalizeGuardian({
              ...guardian,
              ...data.guardian,
              children,
              interactions: guardian.interactions || [],
            });
          })
        );
      } else {
        const newGuardian = normalizeGuardian({
          ...data.guardian,
          children,
          interactions: [],
        });
        setProbableGuardians((prev) => [newGuardian, ...prev]);
      }
      closeAddModal();
    } catch (error) {
      setAddError(
        error.message || (isEditingGuardian ? "Failed to update guardian" : "Failed to add guardian")
      );
    } finally {
      setAddSaving(false);
    }
  };

  const handleLeadSubmit = async (event) => {
    event.preventDefault();
    if (leadSaving) return;

    const built = buildGuardianPayload(leadForm);
    if (built.error) {
      setLeadError(built.error);
      return;
    }

    setLeadSaving(true);
    setLeadError("");

    let guardianId = null;

    try {
      const res = await fetch("/api/enrollment/guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error || "Failed to add guardian";
        const isDuplicate = /exist|duplicate|unique/i.test(message);
        if (!isDuplicate) {
          throw new Error(message);
        }
      } else if (data?.guardian?.id) {
        guardianId = data.guardian.id;
        const newGuardian = normalizeGuardian({
          ...data.guardian,
          children: built.children,
          interactions: [],
        });
        setProbableGuardians((prev) => {
          if (prev.some((item) => item.id === newGuardian.id)) return prev;
          return [newGuardian, ...prev];
        });
      }

      const beltId =
        leadModal.scope === "belt" && Number.isFinite(Number(leadModal.beltId))
          ? Number(leadModal.beltId)
          : null;

      const leadPayload = {
        beltId,
        guardianId: guardianId || null,
        name: built.payload.name,
        phone: built.payload.whatsapp,
        whatsapp: built.payload.whatsapp,
        location: built.payload.location,
        notes: built.payload.notes,
        source: leadModal.scope === "belt" ? "belt" : "random",
        category: "MGCP Lead",
      };

      const leadRes = await fetch("/api/enrollment/mgcp/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });
      const leadData = await leadRes.json().catch(() => ({}));
      if (!leadRes.ok) {
        throw new Error(leadData?.error || "Failed to add MGCP lead");
      }

      const controller = new AbortController();
      await loadMgcpData(controller.signal);
      closeLeadModal();
    } catch (error) {
      setLeadError(error.message || "Failed to add lead");
    } finally {
      setLeadSaving(false);
    }
  };

  const appendGuardianInteraction = (guardianId, interaction) => {
    if (!guardianId || !interaction) return;

    setProbableGuardians((prev) =>
      prev.map((guardian) => {
        if (guardian.id !== guardianId) return guardian;
        const interactions = Array.isArray(guardian.interactions) ? guardian.interactions : [];
        return {
          ...guardian,
          interactions: [interaction, ...interactions],
          lastContact: interaction.createdAt || guardian.lastContact,
        };
      })
    );

    setSelectedGuardian((prev) => {
      if (!prev || prev.id !== guardianId) return prev;
      const interactions = Array.isArray(prev.interactions) ? prev.interactions : [];
      return {
        ...prev,
        interactions: [interaction, ...interactions],
        lastContact: interaction.createdAt || prev.lastContact,
      };
    });
  };

  const handleInteractionSubmit = async (event) => {
    event.preventDefault();
    if (interactionSaving || !interactionModal.guardian) return;

    const guardianId = interactionModal.guardian.id;
    const mode = interactionModal.mode;
    setInteractionSaving(true);
    setInteractionError("");

    try {
      if (mode === "whatsapp") {
        const message = interactionForm.message.trim();
        const useDefaultTemplate = selectedTemplateId === "default";
        const templateId =
          selectedTemplateId && !useDefaultTemplate ? Number(selectedTemplateId) : null;
        const childName =
          (interactionModal.guardian?.children || [])
            .map((child) => child.name)
            .filter(Boolean)
            .join(", ") || "आपके बच्चे";
        const templateVariables = useDefaultTemplate
          ? {
              "1": interactionModal.guardian?.name || "",
              "2": childName,
              "3": interactionForm.subject?.trim() || DEFAULT_WHATSAPP_SUBJECT,
              "4": message,
            }
          : null;

        if (!message && !templateId && !useDefaultTemplate) {
          setInteractionError("Message or template is required.");
          setInteractionSaving(false);
          return;
        }
        if (useDefaultTemplate && !message) {
          setInteractionError("Message is required for the default template.");
          setInteractionSaving(false);
          return;
        }
        const res = await fetch("/api/enrollment/communications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send-message",
            guardianId,
            message,
            templateId,
            templateSid: useDefaultTemplate ? DEFAULT_WHATSAPP_TEMPLATE_SID : null,
            templateVariables,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to send WhatsApp message");
        }
        if (data?.interaction) {
          appendGuardianInteraction(guardianId, data.interaction);
        }
      } else {
        const payload = {
          action: "log-interaction",
          guardianId,
          type: "call",
          method: "outgoing",
          content: interactionForm.notes.trim() || "Call logged",
          duration: interactionForm.duration.trim() || null,
          outcome: interactionForm.outcome,
          followUpRequired: interactionForm.followUpRequired,
          followUpDate: interactionForm.followUpDate || null,
          followUpNotes: interactionForm.followUpNotes.trim() || null,
        };
        const res = await fetch("/api/enrollment/communications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to log call");
        }
        if (data?.interaction) {
          appendGuardianInteraction(guardianId, data.interaction);
        }
      }

      closeInteractionModal();
    } catch (error) {
      setInteractionError(error.message || "Failed to save interaction");
    } finally {
      setInteractionSaving(false);
    }
  };

  const runMgcpAction = async (request) => {
    setMgcpActionState({ saving: true, error: "" });
    try {
      const res = await fetch(request.url, {
        method: request.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: request.body ? JSON.stringify(request.body) : null,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "MGCP action failed");
      await loadMgcpData();
      if (request.afterSuccess) request.afterSuccess(payload);
      setMgcpActionState({ saving: false, error: "" });
      return payload;
    } catch (error) {
      setMgcpActionState({ saving: false, error: error.message || "MGCP action failed" });
      return null;
    }
  };

  const toggleIncludeInactive = () => {
    setIncludeInactive((prev) => {
      const next = !prev;
      setFilterStatus(next ? "all" : "active");
      return next;
    });
  };

  const getStatusMeta = (status) => {
    if (!status) return { label: "Unknown", color: "gray" };
    return STATUS_META[status] || { label: status.replace(/_/g, " "), color: "gray" };
  };

  const getOngoingStatusMeta = (guardian) => {
    const status = getOngoingStatus(guardian);
    if (status === "active") return { label: "Active", color: "teal" };
    return { label: "Inactive", color: "gray" };
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "high":
        return <Star className="w-4 h-4 fill-current text-amber-500" />;
      case "medium":
        return <Star className="w-4 h-4 text-amber-300" />;
      default:
        return <Star className="w-4 h-4 text-slate-300" />;
    }
  };

  const dashboardGuardians = probableGuardians;

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Guardians</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{dashboardGuardians.length}</p>
            </div>
            <div className="rounded-xl bg-teal-50 p-3 text-teal-600">
              <Users className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">High Interest</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {dashboardGuardians.filter((g) => g.status === "high_interest").length}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Boarding Interest</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {dashboardGuardians.filter((g) => g.interests.boarding_interest === "yes").length}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <BookOpen className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Avg. Engagement</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{avgEngagement}%</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <Heart className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold text-slate-900">Recent Activities</h3>
        </CardHeader>
        <CardBody>
          {dashboardGuardians.length === 0 ? (
            <p className="text-sm text-slate-500">No guardian activity yet.</p>
          ) : (
            <div className="space-y-4">
              {dashboardGuardians.slice(0, 5).flatMap((guardian) =>
                guardian.interactions.slice(0, 1).map((interaction, index) => (
                  <div key={`${guardian.id}-${index}`} className="flex items-start space-x-4">
                    <div className="rounded-full bg-teal-50 p-2 text-teal-600">
                      {interaction.type === "call" && <Phone className="w-4 h-4" />}
                      {interaction.type === "whatsapp" && <MessageCircle className="w-4 h-4" />}
                      {interaction.type === "community_event" && <Users className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{guardian.name}</p>
                      <p className="text-sm text-slate-600">
                        {interaction.content || interaction.notes || "Interaction logged"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(interaction.date || interaction.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );

  const GuardiansListView = () => (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search guardians by name or location..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {guardianGroup === "ongoing" && (
              <>
                <div className="min-w-[180px]">
                  <Select
                    value={ongoingClassId}
                    onChange={(event) => setOngoingClassId(event.target.value)}
                    disabled={classLoading}
                  >
                    <option value="all">All Classes</option>
                    {classOptions.map((klass) => (
                      <option key={klass.id} value={klass.id}>
                        {klass.name}{klass.section ? `-${klass.section}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant={includeInactive ? "secondary" : "light"}
                  className="whitespace-nowrap"
                  onClick={toggleIncludeInactive}
                >
                  {includeInactive ? "Only Active" : "Include Inactive Also"}
                </Button>
              </>
            )}
            {guardianGroup === "probable" && (
              <Select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="min-w-[180px]"
              >
                <option value="all">All Status</option>
                <option value="new_lead">New Lead</option>
                <option value="high_interest">High Interest</option>
                <option value="nurturing">Nurturing</option>
                <option value="follow_up_needed">Follow Up Needed</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            {guardianGroup === "ongoing" && includeInactive && (
              <Select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="min-w-[180px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
            {guardianGroup === "probable" && (
              <Button variant="primary" className="gap-2" onClick={openAddModal}>
                <Plus className="w-4 h-4" />
                Add Probable King
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {guardianGroup === "ongoing" && classError && (
        <p className="text-xs text-rose-600">{classError}</p>
      )}

      <Card>
        <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setGuardianGroup("ongoing")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                guardianGroup === "ongoing"
                  ? "bg-teal-600 text-white"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Ongoing Kings
              <span className="ml-2 text-xs rounded-full bg-white/20 px-2 py-0.5">
                {ongoingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGuardianGroup("probable")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                guardianGroup === "probable"
                  ? "bg-teal-600 text-white"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              Probable Kings
              <span className="ml-2 text-xs rounded-full bg-white/20 px-2 py-0.5">
                {probableCount}
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {guardianGroup === "ongoing"
              ? "Ongoing Kings are enrolled guardians with visit tracking."
              : "Probable Kings are leads with potential to enroll."}
          </p>
        </CardBody>
      </Card>

      {isLoading ? (
        <Card>
          <CardBody className="text-center text-slate-500">Loading guardians...</CardBody>
        </Card>
      ) : currentError ? (
        <Card>
          <CardBody className="text-center text-rose-600">{currentError}</CardBody>
        </Card>
      ) : filteredGuardians.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500">
            No guardians found. Try adjusting your search.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredGuardians.map((guardian) => {
            const statusMeta =
              guardianGroup === "ongoing"
                ? getOngoingStatusMeta(guardian)
                : getStatusMeta(guardian.status);
            const isOngoing = guardianGroup === "ongoing";
            const activeWards = (guardian.children || []).filter((child) =>
              isActiveStatus(child.status)
            ).length;
            const hostellerCount = (guardian.children || []).filter((child) => child.isHosteller)
              .length;
            return (
              <Card key={guardian.id} className="hover:shadow-md transition-shadow">
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{guardian.name}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4" />
                        {guardian.location}
                      </p>
                    </div>
                    <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {isOngoing ? "Wards" : "Children"}
                    </p>
                    <div className="space-y-1">
                      {guardian.children.length ? (
                        guardian.children.map((child, index) => (
                          <div key={index} className="text-sm text-slate-600">
                            {child.name} ({child.age || "?"}y) - {child.currentSchool || "Unknown"}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-400">No children listed</div>
                      )}
                    </div>
                  </div>

                  {isOngoing ? (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge color={activeWards ? "teal" : "gray"}>
                        Active wards {activeWards}/{guardian.children.length}
                      </Badge>
                      <Badge color={hostellerCount ? "blue" : "gray"}>
                        Hostellers {hostellerCount}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        Visits tracked in Guardian Register.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          Islamic Ed: {getPriorityIcon(guardian.interests.islamic_education_priority)}
                        </div>
                        <div className="flex items-center gap-1">
                          Academic: {getPriorityIcon(guardian.interests.academic_excellence_priority)}
                        </div>
                        <div>
                          Boarding:{" "}
                          {guardian.interests.boarding_interest === "yes"
                            ? "Yes"
                            : guardian.interests.boarding_interest === "no"
                            ? "No"
                            : "Maybe"}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-500">Engagement</span>
                          <span className="text-sm font-medium text-slate-700">
                            {guardian.engagementScore || 0}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all"
                            style={{ width: `${guardian.engagementScore || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="light"
                      className="flex-1 gap-2"
                      onClick={() => {
                        setSelectedGuardian(guardian);
                        setSelectedGuardianGroup(guardianGroup);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                <Button
                  variant="light"
                  className="px-3"
                  onClick={() => openInteractionModal(guardian, "whatsapp")}
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="light"
                  className="px-3"
                  onClick={() => openInteractionModal(guardian, "call")}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const CommunicationsView = () => {
    const query = commSearch.trim().toLowerCase();
    const list = probableGuardians.filter((guardian) => {
      if (!query) return true;
      return (
        guardian.name?.toLowerCase().includes(query) ||
        guardian.whatsapp?.toLowerCase().includes(query) ||
        guardian.location?.toLowerCase().includes(query)
      );
    });
    const recentInteractions = useMemo(() => {
      const entries = probableGuardians.flatMap((guardian) =>
        (guardian.interactions || []).map((interaction) => ({
          ...interaction,
          guardianName: guardian.name,
          guardianId: guardian.id,
          guardianPhone: guardian.whatsapp,
        }))
      );

      return entries
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.date || 0).getTime();
          const bTime = new Date(b.createdAt || b.date || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 10);
    }, [probableGuardians]);

    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Communications Hub</h3>
              <p className="text-sm text-slate-500">
                Quick WhatsApp and call actions for probable kings.
              </p>
            </div>
            <Input
              label="Search"
              value={commSearch}
              onChange={(event) => setCommSearch(event.target.value)}
              placeholder="Search name, phone, or location"
              className="md:max-w-xs"
            />
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
          <div className="space-y-3">
            {list.length ? (
              list.map((guardian) => (
                <Card key={guardian.id}>
                  <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{guardian.name}</p>
                      <p className="text-xs text-slate-500">
                        {guardian.location || "Location unknown"} · {guardian.whatsapp || "No phone"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="light" onClick={() => openInteractionModal(guardian, "whatsapp")}>
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </Button>
                      <Button variant="secondary" onClick={() => openInteractionModal(guardian, "call")}>
                        <Phone className="w-4 h-4" />
                        Call
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))
            ) : (
              <Card>
                <CardBody className="py-10 text-center text-sm text-slate-500">
                  No probable kings match this search.
                </CardBody>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-700">Recent Communications</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {recentInteractions.length ? (
                recentInteractions.map((interaction, index) => (
                  <div key={`${interaction.guardianId}-${index}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-teal-50 p-2 text-teal-600">
                        {interaction.type === "call" && <Phone className="w-4 h-4" />}
                        {interaction.type === "whatsapp" && <MessageCircle className="w-4 h-4" />}
                        {interaction.type === "community_event" && <Users className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {interaction.guardianName || "Guardian"}
                          </p>
                          <span className="text-xs text-slate-400">
                            {formatDate(interaction.date || interaction.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {interaction.type?.replace(/_/g, " ")} · {interaction.guardianPhone || "No phone"}
                        </p>
                        <p className="text-sm text-slate-600 mt-2">
                          {interaction.content || interaction.notes || "Interaction logged"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No communication history yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  };

  const OngoingGuardianDetailView = ({ guardian, onClose }) => {
    const router = useRouter();
    const [visitsState, setVisitsState] = useState({
      loading: true,
      error: "",
      entries: [],
    });
    const [profileState, setProfileState] = useState({
      loading: true,
      error: "",
      profiles: {},
    });
    const [callLogsState, setCallLogsState] = useState({
      loading: true,
      error: "",
      calls: [],
    });
    const [activeSection, setActiveSection] = useState("overview");
    const [cddState, setCddState] = useState({
      loading: false,
      loaded: false,
      error: "",
      byClassId: {},
      rangeDays: 30,
    });

    useEffect(() => {
      let active = true;
      const controller = new AbortController();

      const loadVisits = async () => {
        setVisitsState((prev) => ({ ...prev, loading: true, error: "" }));
        try {
          const params = new URLSearchParams();
          params.set("section", "guardian");
          if (guardian?.name) params.set("guardianName", guardian.name);
          const studentNames = (guardian?.children || [])
            .map((child) => child.name)
            .filter(Boolean);
          if (studentNames.length) {
            params.set("studentNames", studentNames.join(","));
          }
          params.set("limit", "50");
          params.set("days", "180");

          const res = await fetch(`/api/managersCommon/guardian-register?${params.toString()}`, {
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload?.error || "Failed to load visit history");
          }
          if (!active) return;
          setVisitsState({
            loading: false,
            error: "",
            entries: Array.isArray(payload?.entries) ? payload.entries : [],
          });
        } catch (error) {
          if (!active || error.name === "AbortError") return;
          setVisitsState({ loading: false, error: error.message || "Failed to load visits", entries: [] });
        }
      };

      const loadProfiles = async () => {
        const studentIds = (guardian?.children || [])
          .map((child) => Number(child.studentId))
          .filter((id) => Number.isFinite(id));
        if (!studentIds.length) {
          if (active) setProfileState({ loading: false, error: "", profiles: {} });
          return;
        }

        setProfileState((prev) => ({ ...prev, loading: true, error: "" }));
        try {
          const results = await Promise.allSettled(
            studentIds.map(async (id) => {
              const res = await fetch(`/api/member/student/${id}`, {
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
              });
              const payload = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(payload?.error || `Failed to load student ${id}`);
              }
              return payload?.student;
            })
          );

          if (!active) return;
          const profiles = {};
          results.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
              profiles[result.value.id] = result.value;
            }
          });
          setProfileState({ loading: false, error: "", profiles });
        } catch (error) {
          if (!active || error.name === "AbortError") return;
          setProfileState({
            loading: false,
            error: error.message || "Failed to load student profiles",
            profiles: {},
          });
        }
      };

      const loadCallLogs = async () => {
        const studentIds = Array.from(
          new Set(
            (guardian?.children || [])
              .map((child) => Number(child.studentId))
              .filter((id) => Number.isFinite(id))
          )
        );

        if (!studentIds.length) {
          if (active) setCallLogsState({ loading: false, error: "", calls: [] });
          return;
        }

        setCallLogsState((prev) => ({ ...prev, loading: true, error: "" }));

        try {
          const results = await Promise.allSettled(
            studentIds.map(async (id) => {
              const res = await fetch(`/api/managersCommon/guardian-calls?studentId=${id}`, {
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
              });
              const payload = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(payload?.error || `Failed to load call logs for student ${id}`);
              }
              return payload?.calls || [];
            })
          );

          if (!active) return;
          const callMap = new Map();
          results.forEach((result) => {
            if (result.status === "fulfilled") {
              result.value.forEach((call) => {
                if (call?.id) callMap.set(call.id, call);
              });
            }
          });
          const calls = Array.from(callMap.values()).sort((a, b) => {
            const aDate = a.callDate || a.createdAt || "";
            const bDate = b.callDate || b.createdAt || "";
            return aDate > bDate ? -1 : 1;
          });

          setCallLogsState({ loading: false, error: "", calls });
        } catch (error) {
          if (!active || error.name === "AbortError") return;
          setCallLogsState({
            loading: false,
            error: error.message || "Failed to load call logs",
            calls: [],
          });
        }
      };

      loadVisits();
      loadProfiles();
      loadCallLogs();

      return () => {
        active = false;
        controller.abort();
      };
    }, [guardian]);

    const handleLoadCdd = async () => {
      const classIds = Array.from(
        new Set(
          (guardian?.children || [])
            .map((child) => Number(child.classId))
            .filter((id) => Number.isFinite(id))
        )
      );
      if (!classIds.length) {
        setCddState((prev) => ({ ...prev, loaded: true, error: "No class data for wards." }));
        return;
      }

      const endDate = new Date();
      const startDate = new Date(Date.now() - cddState.rangeDays * 24 * 60 * 60 * 1000);
      const formatKey = (date) => date.toISOString().slice(0, 10);
      const startKey = formatKey(startDate);
      const endKey = formatKey(endDate);

      setCddState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const results = await Promise.allSettled(
          classIds.map(async (classId) => {
            const res = await fetch(
              `/api/admin/admin-club/pt-history?classId=${classId}&startDate=${startKey}&endDate=${endKey}`,
              { headers: { "Content-Type": "application/json" } }
            );
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(payload?.error || `Failed to load PT history for class ${classId}`);
            }
            return { classId, payload };
          })
        );

        const byClassId = {};
        const errors = [];
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            byClassId[result.value.classId] = result.value.payload;
          } else if (result.status === "rejected") {
            errors.push(result.reason?.message || "Failed to load PT history");
          }
        });

        setCddState((prev) => ({
          ...prev,
          loading: false,
          loaded: true,
          error: errors[0] || "",
          byClassId,
        }));
      } catch (error) {
        setCddState((prev) => ({
          ...prev,
          loading: false,
          loaded: true,
          error: error.message || "Failed to load PT history",
          byClassId: {},
        }));
      }
    };

    const visitEntries = visitsState.entries || [];
    const sectionItems = [
      { id: "overview", label: "Overview" },
      { id: "wards", label: "Ward Files" },
      { id: "calls", label: "Call Logs" },
      { id: "visits", label: "Visit History" },
    ];

    return (
      <div className="fixed inset-0 z-50 bg-black/40">
        <div className="absolute inset-y-0 right-0 w-full max-w-6xl bg-white shadow-xl">
          <div className="h-full flex flex-col">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{guardian.name}</h2>
                  <Badge color={getOngoingStatusMeta(guardian).color}>
                    {getOngoingStatusMeta(guardian).label}
                  </Badge>
                  <Badge color="blue">{guardian.children.length} wards</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="light"
                    onClick={() => router.push("/dashboard/managersCommon/guardian-register")}
                  >
                    Guardian Register
                  </Button>
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
                  >
                    X
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="h-full grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-slate-50/60 lg:border-b-0 lg:border-r">
                  <div className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col">
                    {sectionItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                          activeSection === item.id
                            ? "bg-teal-600 text-white shadow-sm"
                            : "bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </aside>

                <main className="h-full overflow-y-auto p-6 space-y-6">
                  {activeSection === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                          <CardHeader>
                            <h3 className="text-sm font-semibold text-slate-700">Guardian Snapshot</h3>
                          </CardHeader>
                          <CardBody className="space-y-3 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-slate-500" />
                              <span>{guardian.whatsapp || "No phone on file"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-500" />
                              <span>{guardian.location || "Location not captured"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-500" />
                              <span>
                                Active wards:{" "}
                                {(guardian.children || []).filter((child) => isActiveStatus(child.status)).length}
                              </span>
                            </div>
                          </CardBody>
                        </Card>

                        <Card>
                          <CardHeader>
                            <h3 className="text-sm font-semibold text-slate-700">Recent Visits</h3>
                          </CardHeader>
                          <CardBody className="space-y-2 text-sm text-slate-600">
                            {visitsState.loading ? (
                              <p className="text-sm text-slate-500">Loading visit history...</p>
                            ) : visitsState.error ? (
                              <p className="text-sm text-rose-600">{visitsState.error}</p>
                            ) : visitEntries.length ? (
                              <div className="space-y-2">
                                {visitEntries.slice(0, 3).map((entry) => (
                                  <div key={entry.id} className="rounded-lg border border-slate-200 p-3">
                                    <p className="text-xs text-slate-500">{formatDate(entry.visitDate)}</p>
                                    <p className="text-sm font-medium text-slate-700">
                                      {entry.purpose || "Visit"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {entry.studentName || "Ward"} · {formatTime(entry.inAt)} - {formatTime(entry.outAt)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No visits recorded yet.</p>
                            )}
                          </CardBody>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-700">Quick Actions</h3>
                              <p className="text-xs text-slate-500">Jump into related manager tools.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="light"
                                onClick={() => router.push("/dashboard/managersCommon/guardian-calls")}
                              >
                                Guardian Call Drive
                              </Button>
                              <Button
                                type="button"
                                variant="light"
                                onClick={() => router.push("/dashboard/managersCommon/guardian-register")}
                              >
                                Guardian Register
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                  )}

                  {activeSection === "wards" && (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700">Ward Files</h3>
                            <p className="text-xs text-slate-500">Student register details with CDD flags.</p>
                          </div>
                          <Button
                            type="button"
                            variant="light"
                            onClick={handleLoadCdd}
                            disabled={cddState.loading}
                          >
                            {cddState.loading ? "Loading CDD..." : "Load CDD Signals"}
                          </Button>
                        </div>
                        {cddState.error && <p className="text-xs text-rose-600 mt-2">{cddState.error}</p>}
                        {profileState.loading && (
                          <p className="text-xs text-slate-500 mt-1">Loading student profiles…</p>
                        )}
                        {profileState.error && <p className="text-xs text-rose-600 mt-1">{profileState.error}</p>}
                      </CardHeader>
                      <CardBody className="space-y-4">
                        {(guardian.children || []).length ? (
                          (guardian.children || []).map((child, index) => {
                            const profile = profileState.profiles[child.studentId] || null;
                            const classCdd = cddState.byClassId[child.classId];
                            const signals = classCdd
                              ? buildCddSignals(classCdd.instances, child.name).slice(0, 4)
                              : [];

                            return (
                              <div key={`${child.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <h4 className="text-base font-semibold text-slate-900">{child.name}</h4>
                                    <p className="text-xs text-slate-500">
                                      {child.className ? `Class ${child.className}` : "Class not set"}{" "}
                                      {child.isHosteller ? "· Hosteller" : ""}
                                    </p>
                                  </div>
                                  <Badge color={isActiveStatus(child.status) ? "teal" : "gray"}>
                                    {isActiveStatus(child.status) ? "Active" : "Inactive"}
                                  </Badge>
                                </div>

                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                                  <div className="space-y-1">
                                    <p>
                                      Admission:{" "}
                                      <span className="text-slate-800">
                                        {profile?.admissionNumber || "—"}
                                      </span>
                                    </p>
                                    <p>
                                      Guardian phone:{" "}
                                      <span className="text-slate-800">
                                        {profile?.guardianPhone || guardian.whatsapp || "—"}
                                      </span>
                                    </p>
                                    <p>
                                      Fee status:{" "}
                                      <span className="text-slate-800">{profile?.feeStatus || "—"}</span>
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p>
                                      Academic year:{" "}
                                      <span className="text-slate-800">{profile?.academicYear || "—"}</span>
                                    </p>
                                    <p>
                                      Transport:{" "}
                                      <span className="text-slate-800">
                                        {profile?.transportChosen ? "Yes" : "No"}
                                      </span>
                                    </p>
                                    <p>
                                      Blood group:{" "}
                                      <span className="text-slate-800">{profile?.bloodGroup || "—"}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    CDD signals (last {cddState.rangeDays} days)
                                  </p>
                                  {!cddState.loaded ? (
                                    <p className="text-sm text-slate-500 mt-2">
                                      Load CDD signals to view flags.
                                    </p>
                                  ) : signals.length ? (
                                    <div className="mt-2 space-y-2">
                                      {signals.map((signal) => (
                                        <div key={signal.date} className="text-sm text-slate-600">
                                          <span className="font-medium text-slate-700">
                                            {formatDate(signal.date)}:
                                          </span>{" "}
                                          {signal.categories.join(", ")}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500 mt-2">No CDD flags recorded.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500">No wards linked to this guardian yet.</p>
                        )}
                      </CardBody>
                    </Card>
                  )}

                  {activeSection === "calls" && (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700">Guardian Call Log</h3>
                            <p className="text-xs text-slate-500">
                              Calls recorded under Guardian Call Drive.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="light"
                            onClick={() => router.push("/dashboard/managersCommon/guardian-calls")}
                          >
                            Open Call Drive
                          </Button>
                        </div>
                      </CardHeader>
                      <CardBody>
                        {callLogsState.loading ? (
                          <p className="text-sm text-slate-500">Loading call logs...</p>
                        ) : callLogsState.error ? (
                          <p className="text-sm text-rose-600">{callLogsState.error}</p>
                        ) : callLogsState.calls.length ? (
                          <div className="space-y-3">
                            {callLogsState.calls.slice(0, 8).map((call) => (
                              <div key={call.id} className="rounded-xl border border-slate-200 p-4">
                                <div className="grid gap-3 md:grid-cols-[minmax(180px,220px)_minmax(220px,1fr)_minmax(160px,200px)]">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-800">
                                      {call.student?.name || "Student"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {call.class?.name ? `Class ${call.class.name}` : "Class"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {formatDate(call.callDate)} · {call.guardian?.name || "Guardian"}
                                    </p>
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {call.report || "No report recorded."}
                                  </div>
                                  <div className="flex flex-col gap-2 text-xs text-slate-500">
                                    <Badge color={call.followUpNeeded ? "amber" : "teal"}>
                                      {call.followUpNeeded ? "Follow-up" : "Closed"}
                                    </Badge>
                                    <span>Called by {call.calledBy?.name || "—"}</span>
                                    {call.followUpDate && (
                                      <span>Follow-up {formatDate(call.followUpDate)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No call logs found for this guardian.</p>
                        )}
                      </CardBody>
                    </Card>
                  )}

                  {activeSection === "visits" && (
                    <Card>
                      <CardHeader>
                        <h3 className="text-sm font-semibold text-slate-700">Visit History</h3>
                      </CardHeader>
                      <CardBody>
                        {visitsState.loading ? (
                          <p className="text-sm text-slate-500">Loading visit history...</p>
                        ) : visitsState.error ? (
                          <p className="text-sm text-rose-600">{visitsState.error}</p>
                        ) : visitEntries.length ? (
                          <div className="space-y-3">
                            {visitEntries.map((entry) => (
                              <div key={entry.id} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                      {entry.purpose || "Visit"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {formatDate(entry.visitDate)} · {entry.studentName || "Ward"}
                                    </p>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    In {formatTime(entry.inAt)} · Out {formatTime(entry.outAt)}
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                                  <Badge color={entry.feesSubmitted ? "teal" : "gray"}>
                                    Fees {entry.feesSubmitted ? "Submitted" : "Not submitted"}
                                  </Badge>
                                  <Badge color="blue">
                                    Islamic {entry.satisfactionIslamic ?? "—"}/5
                                  </Badge>
                                  <Badge color="amber">
                                    Academic {entry.satisfactionAcademic ?? "—"}/5
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No visits logged for this guardian.</p>
                        )}
                      </CardBody>
                    </Card>
                  )}
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ProbableGuardianDetailView = ({ guardian, onClose, onWhatsApp, onCall, onEdit }) => {
    const [activeSection, setActiveSection] = useState("overview");

    return (
      <div className="fixed inset-0 z-50 bg-black/40">
      <div className="absolute inset-y-0 right-0 w-full max-w-5xl bg-white shadow-xl">
        <div className="h-full flex flex-col">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{guardian.name}</h2>
                <Badge color={getStatusMeta(guardian.status).color}>
                  {getStatusMeta(guardian.status).label}
                </Badge>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                X
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50/60 lg:border-b-0 lg:border-r">
                <div className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col">
                  {[
                    { id: "overview", label: "Overview" },
                    { id: "children", label: "Children" },
                    { id: "priorities", label: "Priorities" },
                    { id: "notes", label: "Notes" },
                    { id: "interactions", label: "Interactions" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
                        activeSection === item.id
                          ? "bg-teal-600 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </aside>

              <main className="h-full overflow-y-auto p-6 space-y-6">
                {activeSection === "overview" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <h3 className="text-sm font-semibold text-slate-700">Contact Information</h3>
                        </CardHeader>
                        <CardBody className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <span>{guardian.whatsapp}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            <span>{guardian.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span>Last contact: {formatDate(guardian.lastContact)}</span>
                          </div>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardHeader>
                          <h3 className="text-sm font-semibold text-slate-700">Engagement Score</h3>
                        </CardHeader>
                        <CardBody>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="w-full bg-slate-100 rounded-full h-3">
                                <div
                                  className="bg-teal-500 h-3 rounded-full"
                                  style={{ width: `${guardian.engagementScore || 0}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-xl font-semibold text-slate-900">
                              {guardian.engagementScore || 0}%
                            </span>
                          </div>
                        </CardBody>
                      </Card>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className="gap-2"
                        onClick={() => {
                          onClose?.();
                          onWhatsApp?.(guardian);
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Send WhatsApp
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-2"
                        onClick={() => {
                          onClose?.();
                          onCall?.(guardian);
                        }}
                      >
                        <Phone className="w-4 h-4" />
                        Make Call
                      </Button>
                      <Button
                        variant="light"
                        className="gap-2"
                        onClick={() => {
                          onClose?.();
                          onEdit?.(guardian);
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Details
                      </Button>
                    </div>
                  </div>
                )}

                {activeSection === "children" && (
                  <Card>
                    <CardHeader>
                      <h3 className="text-sm font-semibold text-slate-700">Children</h3>
                    </CardHeader>
                    <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guardian.children.length ? (
                        guardian.children.map((child, index) => (
                          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="font-medium text-slate-800">{child.name}</h4>
                            <p className="text-sm text-slate-600">Age: {child.age || "?"} years</p>
                            <p className="text-sm text-slate-600">
                              Current School: {child.currentSchool || "Unknown"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No children listed for this guardian.</p>
                      )}
                    </CardBody>
                  </Card>
                )}

                {activeSection === "priorities" && (
                  <Card>
                    <CardHeader>
                      <h3 className="text-sm font-semibold text-slate-700">Interests and Priorities</h3>
                    </CardHeader>
                    <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Islamic Education</p>
                        <div className="flex justify-center">
                          {getPriorityIcon(guardian.interests.islamic_education_priority)}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {guardian.interests.islamic_education_priority}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Academic Excellence</p>
                        <div className="flex justify-center">
                          {getPriorityIcon(guardian.interests.academic_excellence_priority)}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {guardian.interests.academic_excellence_priority}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Boarding Interest</p>
                        <div className="text-lg font-semibold text-slate-800">
                          {guardian.interests.boarding_interest === "yes"
                            ? "Yes"
                            : guardian.interests.boarding_interest === "no"
                            ? "No"
                            : "Maybe"}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {guardian.interests.boarding_interest}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {activeSection === "notes" && (
                  <Card>
                    <CardHeader>
                      <h3 className="text-sm font-semibold text-slate-700">Notes</h3>
                    </CardHeader>
                    <CardBody>
                      <p className="text-sm text-slate-600">
                        {guardian.notes || "No notes yet."}
                      </p>
                    </CardBody>
                  </Card>
                )}

                {activeSection === "interactions" && (
                  <Card>
                    <CardHeader>
                      <h3 className="text-sm font-semibold text-slate-700">Interaction History</h3>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      {guardian.interactions.length ? (
                        guardian.interactions.map((interaction, index) => (
                          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-full bg-teal-50 p-2 text-teal-600">
                                {interaction.type === "call" && <Phone className="w-4 h-4" />}
                                {interaction.type === "whatsapp" && <MessageCircle className="w-4 h-4" />}
                                {interaction.type === "community_event" && <Users className="w-4 h-4" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-slate-700 capitalize">
                                    {interaction.type?.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {formatDate(interaction.date || interaction.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600">
                                  {interaction.content || interaction.notes || "Interaction logged"}
                                </p>
                                {interaction.duration && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    Duration: {interaction.duration}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No interactions recorded yet.</p>
                      )}
                    </CardBody>
                  </Card>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-teal-700">King's Place</h1>
            <p className="text-sm text-slate-500">Guardian relationship manager for admissions.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge color="gray">Total {totalGuardians}</Badge>
            <Badge color="teal">Ongoing {ongoingCount}</Badge>
            <Badge color="blue">Probable {probableCount}</Badge>
          </div>
        </div>
      </header>

      <div
        className="rounded-2xl border border-emerald-200 px-2 py-1 shadow-sm"
        style={{ backgroundColor: "#eef8f3" }}
      >
        <div
          role="tablist"
          className="flex flex-wrap gap-2"
          style={{ backgroundColor: "#eef8f3" }}
        >
          {["dashboard", "guardians", "communications", "analytics", "mgcp"].map((tab) => {
            const label = tab === "mgcp" ? "MGCP" : tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                    : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "dashboard" && <DashboardView />}
      {activeTab === "guardians" && <GuardiansListView />}
      {activeTab === "communications" && <CommunicationsView />}
      {activeTab === "analytics" && (
        <Card>
          <CardBody className="py-10 text-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Analytics Dashboard</h3>
            <p className="text-sm text-slate-500">Engagement analytics coming soon.</p>
          </CardBody>
        </Card>
      )}
      {activeTab === "mgcp" && (
        <div className="space-y-6">
          <header className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-slate-900">MGCP Control Room</h3>
              <p className="text-sm text-slate-500">
                Manage belts, villages, trusted kings, and lead managers.
              </p>
            </div>
          </header>

          {mgcpError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {mgcpError}
            </div>
          )}
          {mgcpActionState.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {mgcpActionState.error}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-slate-700">Assign MGCP Head</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Select
                    label="Select user"
                    value={headForm.userId}
                    onChange={(event) => setHeadForm({ userId: event.target.value })}
                    className="flex-1 min-w-[220px]"
                  >
                    <option value="">Choose user</option>
                    {mgcpUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} · {user.role}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    disabled={!headForm.userId || mgcpActionState.saving}
                    onClick={() =>
                      runMgcpAction({
                        url: "/api/enrollment/mgcp/heads",
                        method: "POST",
                        body: { userId: Number(headForm.userId) },
                        afterSuccess: () => {
                          setHeadForm({ userId: "" });
                          loadMgcpHeads();
                        },
                      })
                    }
                  >
                    Add Head
                  </Button>
                </div>

                <div className="space-y-2">
                  {mgcpHeads.length ? (
                    mgcpHeads.map((head) => (
                      <div
                        key={head.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{head.name}</p>
                          <p className="text-xs text-slate-500">{head.role}</p>
                        </div>
                        <Button
                          variant="light"
                          size="sm"
                          onClick={() =>
                            runMgcpAction({
                              url: "/api/enrollment/mgcp/heads",
                              method: "DELETE",
                              body: { id: head.id },
                              afterSuccess: () => loadMgcpHeads(),
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No MGCP heads assigned yet.</p>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-slate-700">Belts Overview</h3>
              </CardHeader>
              <CardBody>
                {mgcpLoading ? (
                  <p className="text-sm text-slate-500">Loading belts...</p>
                ) : mgcpBelts.length ? (
                  <div className="space-y-3">
                    {mgcpBelts.map((belt) => (
                      <div key={belt.id} className="rounded-xl border border-slate-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{belt.name}</p>
                            <p className="text-xs text-slate-500">{belt.notes || "No notes"}</p>
                          </div>
                          <Badge color={belt.active ? "teal" : "gray"}>
                            {belt.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                          <Badge color="blue">Villages {belt.villages?.length || 0}</Badge>
                          <Badge color="amber">Leads {belt.leads?.length || 0}</Badge>
                          <Badge color="gray">Kings {belt.guardians?.length || 0}</Badge>
                          <Badge color="teal">Managers {belt.leadManagers?.length || 0}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No belts created yet.</p>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Manage MGCP</h4>
                <p className="text-xs text-slate-500">
                  Open the control drawer to manage belts, kings, and leads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMgcpSection("head");
                  setIsMgcpDrawerOpen(true);
                }}
                className="group inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
              >
                <span>Manage MGCP</span>
                <span className="text-xs text-teal-600 transition-transform group-hover:translate-x-1">
                  Open →
                </span>
              </button>
            </div>
          </div>

          {isMgcpDrawerOpen && (
            <div className="fixed inset-0 z-40 bg-black/40">
              <div className="absolute inset-y-0 right-0 w-full max-w-6xl bg-white shadow-xl">
                <div className="h-full flex flex-col">
                  <div className="border-b border-slate-200 px-6 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Manage MGCP</h3>
                        <p className="text-sm text-slate-500">Set belts, kings, and leads.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMgcpDrawerOpen(false)}
                        className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
                      >
                        X
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="h-full grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <aside className="border-b border-slate-200 bg-slate-50/60 lg:border-b-0 lg:border-r">
                        <div className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col">
                          {[
                            { id: "head", label: "MGCP Head" },
                            { id: "kings", label: "Kings & Leads" },
                            { id: "random", label: "Random Leads" },
                          ].map((section) => (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => setMgcpSection(section.id)}
                              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                                mgcpSection === section.id
                                  ? "bg-teal-600 text-white shadow-sm"
                                  : "bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {section.label}
                            </button>
                          ))}
                        </div>
                      </aside>

                      <main className="h-full overflow-y-auto p-6 space-y-6">
                        {mgcpSection === "head" && (
                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <h3 className="text-sm font-semibold text-slate-700">Create Belt</h3>
                                    <p className="text-xs text-slate-500">Define regions and teams.</p>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardBody className="flex flex-col gap-3 md:flex-row md:items-end">
                                <Input
                                  label="Belt name"
                                  value={beltForm.name}
                                  onChange={(event) =>
                                    setBeltForm((prev) => ({ ...prev, name: event.target.value }))
                                  }
                                  placeholder="e.g. North Pakur Belt"
                                  className="flex-1"
                                />
                                <Input
                                  label="Notes"
                                  value={beltForm.notes}
                                  onChange={(event) =>
                                    setBeltForm((prev) => ({ ...prev, notes: event.target.value }))
                                  }
                                  placeholder="Optional notes"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  disabled={!beltForm.name || mgcpActionState.saving}
                                  onClick={() =>
                                    runMgcpAction({
                                      url: "/api/enrollment/mgcp/belts",
                                      method: "POST",
                                      body: { name: beltForm.name, notes: beltForm.notes },
                                      afterSuccess: () => setBeltForm({ name: "", notes: "" }),
                                    })
                                  }
                                >
                                  Create Belt
                                </Button>
                              </CardBody>
                            </Card>

                            <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
                              <Card>
                                <CardHeader>
                                  <h3 className="text-sm font-semibold text-slate-700">Belts</h3>
                                </CardHeader>
                                <CardBody className="space-y-2">
                                  {mgcpBelts.length ? (
                                    mgcpBelts.map((belt) => (
                                      <button
                                        key={belt.id}
                                        type="button"
                                        onClick={() => setSelectedBeltId(String(belt.id))}
                                        className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition ${
                                          String(belt.id) === String(selectedBeltId)
                                            ? "border-teal-200 bg-teal-50 text-teal-700"
                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        <p className="font-semibold">{belt.name}</p>
                                        <p className="text-xs text-slate-500">
                                          Villages {belt.villages?.length || 0} · Managers {belt.leadManagers?.length || 0}
                                        </p>
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-sm text-slate-500">No belts created yet.</p>
                                  )}
                                </CardBody>
                              </Card>

                              <div className="space-y-5">
                                <Card>
                                  <CardHeader>
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-sm font-semibold text-slate-700">
                                        {selectedBelt ? selectedBelt.name : "Select a belt"}
                                      </h3>
                                      {selectedBelt && (
                                        <Button
                                          variant="light"
                                          size="sm"
                                          onClick={() =>
                                            runMgcpAction({
                                              url: "/api/enrollment/mgcp/belts",
                                              method: "DELETE",
                                              body: { id: selectedBelt.id },
                                            })
                                          }
                                        >
                                          <Trash2 className="w-4 h-4 text-rose-600" />
                                        </Button>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <CardBody className="space-y-4">
                                    {selectedBelt ? (
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <Card>
                                          <CardHeader>
                                            <h4 className="text-xs font-semibold text-slate-600 uppercase">
                                              Villages
                                            </h4>
                                          </CardHeader>
                                          <CardBody className="space-y-3">
                                            <div className="flex flex-col gap-2">
                                              <Input
                                                label="Village name"
                                                value={villageForm.name}
                                                onChange={(event) =>
                                                  setVillageForm((prev) => ({ ...prev, name: event.target.value }))
                                                }
                                                placeholder="Village"
                                              />
                                              <Input
                                                label="Notes"
                                                value={villageForm.notes}
                                                onChange={(event) =>
                                                  setVillageForm((prev) => ({ ...prev, notes: event.target.value }))
                                                }
                                                placeholder="Optional"
                                              />
                                              <Button
                                                type="button"
                                                disabled={!villageForm.name || mgcpActionState.saving}
                                                onClick={() =>
                                                  runMgcpAction({
                                                    url: "/api/enrollment/mgcp/villages",
                                                    method: "POST",
                                                    body: {
                                                      beltId: selectedBelt.id,
                                                      name: villageForm.name,
                                                      notes: villageForm.notes,
                                                    },
                                                    afterSuccess: () => setVillageForm({ name: "", notes: "" }),
                                                  })
                                                }
                                              >
                                                Add Village
                                              </Button>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                              {(selectedBelt.villages || []).map((village) => (
                                                <div
                                                  key={village.id}
                                                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1"
                                                >
                                                  <span>{village.name}</span>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      runMgcpAction({
                                                        url: "/api/enrollment/mgcp/villages",
                                                        method: "DELETE",
                                                        body: { id: village.id },
                                                      })
                                                    }
                                                  >
                                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                                  </Button>
                                                </div>
                                              ))}
                                            </div>
                                          </CardBody>
                                        </Card>

                                        <Card>
                                          <CardHeader>
                                            <h4 className="text-xs font-semibold text-slate-600 uppercase">
                                              Lead Managers
                                            </h4>
                                          </CardHeader>
                                          <CardBody className="space-y-3">
                                            <div className="flex flex-col gap-2">
                                              <Input
                                                label="Name"
                                                value={leadManagerForm.name}
                                                onChange={(event) =>
                                                  setLeadManagerForm((prev) => ({ ...prev, name: event.target.value }))
                                                }
                                                placeholder="Lead manager name"
                                              />
                                              <Input
                                                label="Phone"
                                                value={leadManagerForm.phone}
                                                onChange={(event) =>
                                                  setLeadManagerForm((prev) => ({ ...prev, phone: event.target.value }))
                                                }
                                                placeholder="+91..."
                                              />
                                              <Input
                                                label="WhatsApp"
                                                value={leadManagerForm.whatsapp}
                                                onChange={(event) =>
                                                  setLeadManagerForm((prev) => ({ ...prev, whatsapp: event.target.value }))
                                                }
                                                placeholder="Optional"
                                              />
                                              <Input
                                                label="Notes"
                                                value={leadManagerForm.notes}
                                                onChange={(event) =>
                                                  setLeadManagerForm((prev) => ({ ...prev, notes: event.target.value }))
                                                }
                                                placeholder="Notes"
                                              />
                                              <Button
                                                type="button"
                                                disabled={!leadManagerForm.name || mgcpActionState.saving}
                                                onClick={() =>
                                                  runMgcpAction({
                                                    url: "/api/enrollment/mgcp/lead-managers",
                                                    method: "POST",
                                                    body: { beltId: selectedBelt.id, ...leadManagerForm },
                                                    afterSuccess: () =>
                                                      setLeadManagerForm({
                                                        name: "",
                                                        phone: "",
                                                        whatsapp: "",
                                                        notes: "",
                                                      }),
                                                  })
                                                }
                                              >
                                                Add Manager
                                              </Button>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                              {(selectedBelt.leadManagers || []).map((manager) => (
                                                <div
                                                  key={manager.id}
                                                  className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1"
                                                >
                                                  <div>
                                                    <p className="font-medium text-slate-700">{manager.name}</p>
                                                    <p className="text-xs text-slate-500">{manager.phone || "No phone"}</p>
                                                  </div>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      runMgcpAction({
                                                        url: "/api/enrollment/mgcp/lead-managers",
                                                        method: "DELETE",
                                                        body: { id: manager.id },
                                                      })
                                                    }
                                                  >
                                                    <Trash2 className="w-4 h-4 text-rose-600" />
                                                  </Button>
                                                </div>
                                              ))}
                                            </div>
                                          </CardBody>
                                        </Card>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-slate-500">Select a belt to manage details.</p>
                                    )}
                                  </CardBody>
                                </Card>
                              </div>
                            </div>
                          </div>
                        )}

                        {mgcpSection === "kings" && (
                          <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
                            <Card>
                              <CardHeader>
                                <h3 className="text-sm font-semibold text-slate-700">Belts</h3>
                              </CardHeader>
                              <CardBody className="space-y-2">
                                {mgcpBelts.length ? (
                                  mgcpBelts.map((belt) => (
                                    <button
                                      key={belt.id}
                                      type="button"
                                      onClick={() => setSelectedBeltId(String(belt.id))}
                                      className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition ${
                                        String(belt.id) === String(selectedBeltId)
                                          ? "border-teal-200 bg-teal-50 text-teal-700"
                                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      <p className="font-semibold">{belt.name}</p>
                                      <p className="text-xs text-slate-500">
                                        Villages {belt.villages?.length || 0} · Kings {belt.guardians?.length || 0}
                                      </p>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-sm text-slate-500">No belts created yet.</p>
                                )}
                              </CardBody>
                            </Card>

                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-semibold text-slate-700">
                                    {selectedBelt ? selectedBelt.name : "Select a belt"}
                                  </h3>
                                </div>
                              </CardHeader>
                              <CardBody className="space-y-4">
                                {selectedBelt ? (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <Card>
                                      <CardHeader>
                                        <h4 className="text-xs font-semibold text-slate-600 uppercase">
                                          Existing Kings (Trusted)
                                        </h4>
                                      </CardHeader>
                                      <CardBody className="space-y-3">
                                        <div className="flex flex-col gap-2">
                                          <Input
                                            label="Guardian name"
                                            value={existingKingForm.name}
                                            onChange={(event) =>
                                              setExistingKingForm((prev) => ({ ...prev, name: event.target.value }))
                                            }
                                            placeholder="Guardian name"
                                          />
                                          <Input
                                            label="Phone"
                                            value={existingKingForm.phone}
                                            onChange={(event) =>
                                              setExistingKingForm((prev) => ({ ...prev, phone: event.target.value }))
                                            }
                                            placeholder="+91..."
                                          />
                                          <Input
                                            label="WhatsApp"
                                            value={existingKingForm.whatsapp}
                                            onChange={(event) =>
                                              setExistingKingForm((prev) => ({ ...prev, whatsapp: event.target.value }))
                                            }
                                            placeholder="Optional"
                                          />
                                          <Input
                                            label="Notes"
                                            value={existingKingForm.notes}
                                            onChange={(event) =>
                                              setExistingKingForm((prev) => ({ ...prev, notes: event.target.value }))
                                            }
                                            placeholder="Notes"
                                          />
                                          <label className="flex items-center gap-2 text-xs text-slate-600">
                                            <input
                                              type="checkbox"
                                              checked={existingKingForm.trusted}
                                              onChange={(event) =>
                                                setExistingKingForm((prev) => ({
                                                  ...prev,
                                                  trusted: event.target.checked,
                                                }))
                                              }
                                            />
                                            Mark as trusted
                                          </label>
                                          <Button
                                            type="button"
                                            disabled={!existingKingForm.name || mgcpActionState.saving}
                                            onClick={() =>
                                              runMgcpAction({
                                                url: "/api/enrollment/mgcp/guardians",
                                                method: "POST",
                                                body: {
                                                  beltId: selectedBelt.id,
                                                  guardianName: existingKingForm.name,
                                                  guardianPhone: existingKingForm.phone,
                                                  guardianWhatsapp: existingKingForm.whatsapp,
                                                  notes: existingKingForm.notes,
                                                  isTrusted: existingKingForm.trusted,
                                                },
                                                afterSuccess: () =>
                                                  setExistingKingForm({
                                                    name: "",
                                                    phone: "",
                                                    whatsapp: "",
                                                    notes: "",
                                                    trusted: false,
                                                  }),
                                              })
                                            }
                                          >
                                            Add King
                                          </Button>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          {(selectedBelt.guardians || []).map((guard) => (
                                            <div
                                              key={guard.id}
                                              className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1"
                                            >
                                              <div>
                                                <p className="font-medium text-slate-700">{guard.guardianName}</p>
                                                <p className="text-xs text-slate-500">
                                                  {guard.guardianPhone || "No phone"}
                                                </p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button
                                                  type="button"
                                                  className={`text-xs font-semibold ${
                                                    guard.isTrusted ? "text-teal-700" : "text-slate-400"
                                                  }`}
                                                  onClick={() =>
                                                    runMgcpAction({
                                                      url: "/api/enrollment/mgcp/guardians",
                                                      method: "PATCH",
                                                      body: { id: guard.id, isTrusted: !guard.isTrusted },
                                                    })
                                                  }
                                                >
                                                  {guard.isTrusted ? "Trusted" : "Trust?"}
                                                </button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                                    runMgcpAction({
                                                      url: "/api/enrollment/mgcp/guardians",
                                                      method: "DELETE",
                                                      body: { id: guard.id },
                                                    })
                                                  }
                                                >
                                                  <Trash2 className="w-4 h-4 text-rose-600" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </CardBody>
                                    </Card>

                                    <Card>
                                      <CardHeader>
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-xs font-semibold text-slate-600 uppercase">Belt Leads</h4>
                                          <Button
                                            variant="light"
                                            size="sm"
                                            disabled={!selectedBelt}
                                            onClick={() => selectedBelt && openLeadModal("belt", selectedBelt.id)}
                                          >
                                            Add Lead
                                          </Button>
                                        </div>
                                      </CardHeader>
                                      <CardBody className="space-y-2 text-sm">
                                        {(selectedBelt.leads || []).length ? (
                                          (selectedBelt.leads || []).map((lead) => (
                                            <div
                                              key={lead.id}
                                              className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1"
                                            >
                                              <div>
                                                <p className="font-medium text-slate-700">{lead.name}</p>
                                                <p className="text-xs text-slate-500">{lead.phone || "No phone"}</p>
                                              </div>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                  runMgcpAction({
                                                    url: "/api/enrollment/mgcp/leads",
                                                    method: "DELETE",
                                                    body: { id: lead.id },
                                                  })
                                                }
                                              >
                                                <Trash2 className="w-4 h-4 text-rose-600" />
                                              </Button>
                                            </div>
                                          ))
                                        ) : (
                                          <p className="text-sm text-slate-500">No belt leads yet.</p>
                                        )}
                                      </CardBody>
                                    </Card>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500">Select a belt to manage details.</p>
                                )}
                              </CardBody>
                            </Card>
                          </div>
                        )}

      {mgcpSection === "random" && (
        <Card>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="text-sm font-semibold text-slate-700">Random Leads</h3>
                                  <p className="text-xs text-slate-500">Leads collected from anywhere.</p>
                                </div>
                                <Button variant="light" size="sm" onClick={() => openLeadModal("random")}>
                                  Add Lead
                                </Button>
                              </div>
                            </CardHeader>
                            <CardBody className="space-y-2 text-sm">
                              {mgcpRandomLeads.length ? (
                                mgcpRandomLeads.map((lead) => (
                                  <div
                                    key={lead.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1"
                                  >
                                    <div>
                                      <p className="font-medium text-slate-700">{lead.name}</p>
                                      <p className="text-xs text-slate-500">{lead.phone || "No phone"}</p>
                                      <p className="text-[11px] font-semibold text-teal-600">
                                        {lead.category || "MGCP Lead"}
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        runMgcpAction({
                                          url: "/api/enrollment/mgcp/leads",
                                          method: "DELETE",
                                          body: { id: lead.id },
                                        })
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-600" />
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-500">No random leads yet.</p>
                              )}
                            </CardBody>
                          </Card>
                        )}
                      </main>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {interactionModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleInteractionSubmit}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {interactionModal.mode === "whatsapp" ? "Send WhatsApp" : "Log Call"}
                </h2>
                <p className="text-xs text-slate-500">
                  {interactionModal.guardian?.name || "Guardian"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInteractionModal}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-6">
              {interactionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {interactionError}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{interactionModal.guardian?.whatsapp || "No phone on file"}</span>
                  {interactionModal.guardian?.whatsapp && interactionModal.mode === "call" && (
                    <a
                      href={`tel:${interactionModal.guardian.whatsapp}`}
                      className="ml-auto text-xs font-semibold text-teal-700 hover:text-teal-800"
                    >
                      Call now
                    </a>
                  )}
                </div>
              </div>

              {interactionModal.mode === "whatsapp" ? (
                <div className="space-y-4">
                  <Select
                    label="WhatsApp Template (recommended)"
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                  >
                    <option value="default">Default: meed_grm_1 (Hindi)</option>
                    <option value="">Freeform (24h window)</option>
                    {whatsappTemplates.map((template) => (
                      <option
                        key={template.id}
                        value={template.id}
                        disabled={!template.whatsappTemplateId}
                      >
                        {template.name} · {template.category}
                        {template.whatsappTemplateId ? "" : " (Not approved)"}
                      </option>
                    ))}
                  </Select>
                  {templatesLoading && (
                    <p className="text-xs text-slate-500">Loading templates...</p>
                  )}
                  {templatesError && (
                    <p className="text-xs text-rose-600">{templatesError}</p>
                  )}
                  {selectedTemplateId === "default" && (
                    <Input
                      label="Subject"
                      value={interactionForm.subject}
                      onChange={updateInteractionField("subject")}
                      placeholder="उपस्थिति सूचना"
                    />
                  )}
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-1">
                      Message (required for default template)
                    </span>
                    <textarea
                      value={interactionForm.message}
                      onChange={updateInteractionField("message")}
                      className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Type your WhatsApp message..."
                      rows={4}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Call Notes</span>
                    <textarea
                      value={interactionForm.notes}
                      onChange={updateInteractionField("notes")}
                      className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Summarize the call..."
                      rows={3}
                    />
                  </label>
                  <Input
                    label="Duration"
                    value={interactionForm.duration}
                    onChange={updateInteractionField("duration")}
                    placeholder="e.g. 12 min"
                  />
                  <Select label="Outcome" value={interactionForm.outcome} onChange={updateInteractionField("outcome")}>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </Select>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={interactionForm.followUpRequired}
                    onChange={updateInteractionField("followUpRequired")}
                  />
                  Follow-up required
                </label>
                {interactionForm.followUpRequired && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Follow-up date"
                      type="date"
                      value={interactionForm.followUpDate}
                      onChange={updateInteractionField("followUpDate")}
                    />
                    <Input
                      label="Follow-up notes"
                      value={interactionForm.followUpNotes}
                      onChange={updateInteractionField("followUpNotes")}
                      placeholder="Reminder notes"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="light" onClick={closeInteractionModal} disabled={interactionSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={interactionSaving}>
                  {interactionSaving
                    ? "Saving..."
                    : interactionModal.mode === "whatsapp"
                    ? "Send WhatsApp"
                    : "Save Call"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {leadModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleLeadSubmit}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add MGCP Lead</h2>
                {leadBelt ? (
                  <p className="text-xs text-slate-500">Belt: {leadBelt.name}</p>
                ) : (
                  <p className="text-xs text-slate-500">Random lead entry</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeLeadModal}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-6">
              {leadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {leadError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Guardian Name"
                  value={leadForm.name}
                  onChange={updateLeadField("name")}
                  placeholder="e.g. Abdul Rahman"
                />
                <Input
                  label="WhatsApp Number"
                  value={leadForm.whatsapp}
                  onChange={updateLeadField("whatsapp")}
                  placeholder="+91 XXXXX XXXXX"
                />
                <Input
                  label="Location"
                  value={leadForm.location}
                  onChange={updateLeadField("location")}
                  placeholder="Village / Area"
                />
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Notes</span>
                  <textarea
                    value={leadForm.notes}
                    onChange={updateLeadField("notes")}
                    className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Short context or concern"
                    rows={2}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Islamic Education"
                  value={leadForm.islamic_education_priority}
                  onChange={updateLeadField("islamic_education_priority")}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Select
                  label="Academic Priority"
                  value={leadForm.academic_excellence_priority}
                  onChange={updateLeadField("academic_excellence_priority")}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Select
                  label="Boarding Interest"
                  value={leadForm.boarding_interest}
                  onChange={updateLeadField("boarding_interest")}
                >
                  <option value="yes">Yes</option>
                  <option value="maybe">Maybe</option>
                  <option value="no">No</option>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Children</h3>
                  <Button type="button" variant="ghost" onClick={addLeadChildRow}>
                    Add Child
                  </Button>
                </div>
                <div className="space-y-3">
                  {leadForm.children.map((child, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4"
                    >
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={updateLeadChildField(index, "name")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Child name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                        <input
                          type="number"
                          value={child.age}
                          onChange={updateLeadChildField(index, "age")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Age"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Current School</label>
                        <input
                          type="text"
                          value={child.currentSchool}
                          onChange={updateLeadChildField(index, "currentSchool")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="School name"
                        />
                      </div>
                      {leadForm.children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLeadChildRow(index)}
                          className="text-xs text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="light" onClick={closeLeadModal} disabled={leadSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={leadSaving}>
                  {leadSaving ? "Saving..." : "Save MGCP Lead"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddGuardian}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditingGuardian ? "Edit Probable King" : "Add Probable King"}
              </h2>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
              >
                X
              </button>
            </div>

            <div className="p-6 space-y-6">
              {addError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {addError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Guardian Name"
                  value={addForm.name}
                  onChange={updateAddField("name")}
                  placeholder="e.g. Abdul Rahman"
                />
                <Input
                  label="WhatsApp Number"
                  value={addForm.whatsapp}
                  onChange={updateAddField("whatsapp")}
                  placeholder="+91 XXXXX XXXXX"
                />
                <Input
                  label="Location"
                  value={addForm.location}
                  onChange={updateAddField("location")}
                  placeholder="Village / Area"
                />
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Notes</span>
                  <textarea
                    value={addForm.notes}
                    onChange={updateAddField("notes")}
                    className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Short context or concern"
                    rows={2}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Islamic Education"
                  value={addForm.islamic_education_priority}
                  onChange={updateAddField("islamic_education_priority")}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Select
                  label="Academic Priority"
                  value={addForm.academic_excellence_priority}
                  onChange={updateAddField("academic_excellence_priority")}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
                <Select
                  label="Boarding Interest"
                  value={addForm.boarding_interest}
                  onChange={updateAddField("boarding_interest")}
                >
                  <option value="yes">Yes</option>
                  <option value="maybe">Maybe</option>
                  <option value="no">No</option>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Children</h3>
                  <Button type="button" variant="ghost" onClick={addChildRow}>
                    Add Child
                  </Button>
                </div>
                <div className="space-y-3">
                  {addForm.children.map((child, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4"
                    >
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={child.name}
                          onChange={updateChildField(index, "name")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Child name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Age</label>
                        <input
                          type="number"
                          value={child.age}
                          onChange={updateChildField(index, "age")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Age"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Current School</label>
                        <input
                          type="text"
                          value={child.currentSchool}
                          onChange={updateChildField(index, "currentSchool")}
                          className="w-full rounded-lg border border-slate-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="School name"
                        />
                      </div>
                      {addForm.children.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChildRow(index)}
                          className="text-xs text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="light" onClick={closeAddModal} disabled={addSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addSaving}>
                  {addSaving ? "Saving..." : isEditingGuardian ? "Save Changes" : "Save Probable King"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedGuardian &&
        (selectedGuardianGroup === "ongoing" ? (
          <OngoingGuardianDetailView
            guardian={selectedGuardian}
            onClose={() => {
              setSelectedGuardian(null);
              setSelectedGuardianGroup(null);
            }}
          />
        ) : (
          <ProbableGuardianDetailView
            guardian={selectedGuardian}
            onClose={() => {
              setSelectedGuardian(null);
              setSelectedGuardianGroup(null);
            }}
            onWhatsApp={(guardian) => openInteractionModal(guardian, "whatsapp")}
            onCall={(guardian) => openInteractionModal(guardian, "call")}
            onEdit={(guardian) => openEditModal(guardian)}
          />
        ))}
    </div>
  );
};

export default GuardianRelationshipManager;
