"use client";

import { useEffect, useMemo, useState } from "react";
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

const GuardianRelationshipManager = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [probableGuardians, setProbableGuardians] = useState([]);
  const [ongoingGuardians, setOngoingGuardians] = useState([]);
  const [selectedGuardian, setSelectedGuardian] = useState(null);
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

  const currentGuardians = guardianGroup === "ongoing" ? ongoingGuardians : probableGuardians;

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

  const openAddModal = () => {
    setAddError("");
    setIsAddOpen(true);
  };

  const closeAddModal = () => {
    if (addSaving) return;
    setIsAddOpen(false);
    setAddForm(buildAddForm());
    setAddError("");
  };

  const updateAddField = (field) => (event) => {
    const value = event.target.value;
    setAddForm((prev) => ({ ...prev, [field]: value }));
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

  const addChildRow = () => {
    setAddForm((prev) => ({
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

  const handleAddGuardian = async (event) => {
    event.preventDefault();
    if (addSaving) return;

    const name = addForm.name.trim();
    const whatsapp = addForm.whatsapp.trim();
    const location = addForm.location.trim();
    const notes = addForm.notes.trim();

    if (!name || !whatsapp || !location) {
      setAddError("Name, WhatsApp, and location are required.");
      return;
    }

    const children = addForm.children
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

    const payload = {
      name,
      whatsapp,
      location,
      notes: notes || null,
      interests: {
        islamic_education_priority: addForm.islamic_education_priority,
        academic_excellence_priority: addForm.academic_excellence_priority,
        boarding_interest: addForm.boarding_interest,
      },
      children,
    };

    setAddSaving(true);
    setAddError("");

    try {
      const res = await fetch("/api/enrollment/guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add guardian");
      }

      const newGuardian = normalizeGuardian({
        ...data.guardian,
        children,
        interactions: [],
      });
      setProbableGuardians((prev) => [newGuardian, ...prev]);
      closeAddModal();
    } catch (error) {
      setAddError(error.message || "Failed to add guardian");
    } finally {
      setAddSaving(false);
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
              ? "Ongoing Kings are enrolled guardians."
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Children</p>
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

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      Islamic Ed: {getPriorityIcon(guardian.interests.islamic_education_priority)}
                    </div>
                    <div className="flex items-center gap-1">
                      Academic: {getPriorityIcon(guardian.interests.academic_excellence_priority)}
                    </div>
                    <div>
                      Boarding: {guardian.interests.boarding_interest === "yes"
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

                  <div className="flex gap-2">
                    <Button
                      variant="light"
                      className="flex-1 gap-2"
                      onClick={() => setSelectedGuardian(guardian)}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button variant="light" className="px-3">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="light" className="px-3">
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

  const GuardianDetailView = ({ guardian, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">{guardian.name}</h2>
              {guardianGroup === "ongoing" ? (
                <Badge color={getOngoingStatusMeta(guardian).color}>
                  {getOngoingStatusMeta(guardian).label}
                </Badge>
              ) : (
                <Badge color={getStatusMeta(guardian.status).color}>
                  {getStatusMeta(guardian.status).label}
                </Badge>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full"
            >
              X
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
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

          <div className="flex flex-col gap-3 md:flex-row">
            <Button className="flex-1 gap-2">
              <MessageCircle className="w-4 h-4" />
              Send WhatsApp
            </Button>
            <Button variant="secondary" className="flex-1 gap-2">
              <Phone className="w-4 h-4" />
              Make Call
            </Button>
            <Button variant="light" className="flex-1 gap-2">
              <Edit3 className="w-4 h-4" />
              Edit Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">King's Place</h1>
          <p className="text-sm text-slate-600">Guardian relationship manager for admissions.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge color="gray">Total {totalGuardians}</Badge>
          <Badge color="teal">Ongoing {ongoingCount}</Badge>
          <Badge color="blue">Probable {probableCount}</Badge>
        </div>
      </header>

      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-4">
          {["dashboard", "guardians", "communications", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "dashboard" && <DashboardView />}
      {activeTab === "guardians" && <GuardiansListView />}
      {activeTab === "communications" && (
        <Card>
          <CardBody className="py-10 text-center">
            <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Communications Hub</h3>
            <p className="text-sm text-slate-500">WhatsApp automation coming soon.</p>
          </CardBody>
        </Card>
      )}
      {activeTab === "analytics" && (
        <Card>
          <CardBody className="py-10 text-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Analytics Dashboard</h3>
            <p className="text-sm text-slate-500">Engagement analytics coming soon.</p>
          </CardBody>
        </Card>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleAddGuardian}
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Probable King</h2>
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
                  {addSaving ? "Saving..." : "Save Probable King"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedGuardian && (
        <GuardianDetailView
          guardian={selectedGuardian}
          onClose={() => setSelectedGuardian(null)}
        />
      )}
    </div>
  );
};

export default GuardianRelationshipManager;
