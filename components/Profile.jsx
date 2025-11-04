"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, X, User, Calendar, MessageSquare, BookOpen, FileText, BarChart, Send, UserCircle, Phone, Mic, MicOff } from "lucide-react";
import Link from "next/link";
import AllMessageHistory from "./AllMessageHistory";

export default function Profile({ setChatboxOpen = () => {}, setChatRecipient = () => {} }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    whatsapp_number: "",
    whatsapp_enabled: true,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [leaveRequest, setLeaveRequest] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    transferTo: "",
    proof: null,
  });
  const [messageData, setMessageData] = useState({
    recipientType: "existing",
    recipientId: "",
    recipientIds: [],
    customName: "",
    customWhatsappNumber: "",
    subject: "",
    message: "",
    note: "",
    contact: "admin@mymeedai.org",
  });
  const [includeFooter, setIncludeFooter] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("welcome");
  const messageTemplates = [
    {
      key: "welcome",
      label: "Welcome",
      subject: "Welcome to MeedianAI",
      body: "Hi {name}, welcome to MeedianAI. If you need anything, contact {contact}. — {sender}",
    },
    {
      key: "reminder",
      label: "Gentle Reminder",
      subject: "Gentle Reminder",
      body: "Hi {name}, this is a friendly reminder about your pending item. Please review at your convenience. — {sender}",
    },
    {
      key: "update",
      label: "Important Update",
      subject: "Important Update",
      body: "Hi {name}, here's an important update for you. Please check the portal for details. — {sender}",
    },
    {
      key: "appreciation",
      label: "Appreciation",
      subject: "Thank You",
      body: "Hi {name}, thank you for your great work and dedication. — {sender}",
    },
  ];
  const getRecipientName = () => {
    try {
      if (messageData.recipientType === "existing") {
        const ids = Array.isArray(messageData.recipientIds) ? messageData.recipientIds : [];
        if (ids.length > 1) return "there";
        const id = ids[0] || messageData.recipientId;
        const u = users.find((x) => x.id === parseInt(id));
        return u?.name || "there";
      }
      return messageData.customName?.trim() || "there";
    } catch {
      return "there";
    }
  };
  const applyTemplate = (key) => {
    const t = messageTemplates.find((x) => x.key === key);
    const sender = session?.user?.name || "Admin";
    const name = getRecipientName();
    const contact = messageData.contact || "";
    if (!t) return;
    setMessageData((prev) => ({
      ...prev,
      subject: t.subject,
      message: t.body.replaceAll("{name}", name).replaceAll("{sender}", sender).replaceAll("{contact}", contact),
    }));
  };
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showConfirmMessageModal, setShowConfirmMessageModal] = useState(false);
  const [showSentMessageHistoryModal, setShowSentMessageHistoryModal] = useState(false);
  const [compiledMessage, setCompiledMessage] = useState("");
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [isLeaveProofRequired, setIsLeaveProofRequired] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [immediateSupervisor, setImmediateSupervisor] = useState(null);
  // AI assist state for Direct Message modal
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("friendly"); // friendly | professional | reminder | urgent | appreciation
  const [aiBusy, setAiBusy] = useState(false);
  const aiPromptRef = useRef(null);
  // Voice-to-text for AI Assist
  const recogRef = useRef(null);
  const proofInputRef = useRef(null);
  const [sttSupported, setSttSupported] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  // Recipient filtering (modern UX)
  const [recipientQuery, setRecipientQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | admin | team_manager | member
  // Recipient selection UX
  const [selectionMode, setSelectionMode] = useState("single"); // single | multiple
  const [showMultiPicker, setShowMultiPicker] = useState(false);
  const selectedNames = useMemo(() => {
    try {
      const ids = new Set((messageData.recipientIds || []).map(Number));
      return (users || [])
        .filter((u) => ids.has(Number(u.id)))
        .map((u) => String(u.name || u.id));
    } catch {
      return [];
    }
  }, [users, messageData.recipientIds]);
  // Current MRN widget removed from Profile
  // removed selectedWidget (widgets moved to right sidebar quick actions)

  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || "",
        whatsapp_number: session.user.whatsapp_number || "",
        whatsapp_enabled: session.user.whatsapp_enabled !== false,
      });
      setImagePreview(session.user.image || "/default-avatar.png");
    }
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/member/profile", { credentials: "include" });
        const data = await response.json();
        if (response.ok) {
          setFormData({
            name: data.user.name || "",
            whatsapp_number: data.user.whatsapp_number || "",
            whatsapp_enabled: data.user.whatsapp_enabled !== false,
          });
          setImagePreview(data.user.image || "/default-avatar.png");
          setImmediateSupervisor({
            id: data.user.immediate_supervisor,
            name: data.user.immediate_supervisor_name || "None",
            role: data.user.immediate_supervisor_role || "",
          });
          await fetch("/api/auth/session", { credentials: "include" });
        } else {
          console.error("Failed to fetch profile:", { status: response.status, error: data.error });
          setError(data.error || "Failed to fetch profile data");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch profile error:", err);
        setError("Failed to fetch profile data");
        setTimeout(() => setError(""), 3000);
      }
    };
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch("/api/member/users", { credentials: "include" });
        const data = await response.json();
        if (response.ok) {
          const currentUser = data.users.find((u) => u.id === parseInt(session?.user?.id));
          console.log("Fetched users from /api/member/users:", {
            users: data.users,
            currentUserId: session?.user?.id,
            parsedUserId: parseInt(session?.user?.id),
            currentUser,
            currentUserMriRoles: currentUser?.mriRoles || [],
          });
          setUsers(data.users || []);
        } else {
          console.error("Failed to fetch users:", { status: response.status, error: data.error });
          setError("Failed to fetch users. Please try again.");
          setTimeout(() => setError(""), 3000);
        }
      } catch (err) {
        console.error("Fetch users error:", err);
        setError("Failed to fetch users. Please try again.");
        setTimeout(() => setError(""), 3000);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    const fetchLeaveHistory = async () => {
      try {
        const response = await fetch("/api/member/leave-request", { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Failed to fetch leave history: ${response.statusText || "Unknown error"}`);
        }
        const data = await response.json();
        const normalized = Array.isArray(data.requests)
          ? data.requests.map((req) => ({
              ...req,
              startDate: req.startDate ? new Date(req.startDate) : null,
              endDate: req.endDate ? new Date(req.endDate) : null,
              approvedStartDate: req.approvedStartDate ? new Date(req.approvedStartDate) : null,
              approvedEndDate: req.approvedEndDate ? new Date(req.approvedEndDate) : null,
              createdAt: req.createdAt ? new Date(req.createdAt) : null,
              approvedAt: req.approvedAt ? new Date(req.approvedAt) : null,
            }))
          : [];
        setLeaveHistory(normalized);
        setIsLeaveProofRequired(Boolean(data?.config?.proofRequired));
      } catch (err) {
        console.error("Fetch leave history error:", err);
        setError(`Failed to fetch leave history: ${err.message}`);
        setTimeout(() => setError(""), 3000);
      }
    };
    const fetchSentMessages = async () => {
      try {
        const response = await fetch("/api/member/sent-messages?mode=custom", { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Failed to fetch sent messages: ${response.statusText || "Unknown error"}`);
        }
        const data = await response.json();
        setSentMessages(data.messages || []);
      } catch (err) {
        console.error("Fetch sent messages error:", err);
        setError(`Failed to fetch sent messages: ${err.message}`);
        setTimeout(() => setError(""), 3000);
      }
    };
    if (status === "authenticated") {
      fetchProfile();
      fetchUsers();
      fetchLeaveHistory();
      if (showSentMessageHistoryModal) {
        fetchSentMessages();
      }
      // removed MRN polling in Profile view
    }
  }, [session, status, showSentMessageHistoryModal]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLeaveChange = (e) => {
    const { name, value, files } = e.target;
    setLeaveRequest((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleMessageChange = (e) => {
    const { name, value } = e.target;
    setMessageData((prev) => ({
      ...prev,
      [name]: name === "recipientId" ? parseInt(value) || "" : value,
    }));
    // Re-apply template on recipient or contact changes for convenience
    if (name === "recipientId" || name === "customName" || name === "contact") {
      if (selectedTemplate) applyTemplate(selectedTemplate);
    }
  };

  // Multi-select change handler for recipients (existing users)
  const handleRecipientsChange = (e) => {
    const ids = Array.from(e.target.selectedOptions || [])
      .map((o) => parseInt(o.value))
      .filter((v) => !Number.isNaN(v));
    setMessageData((prev) => ({
      ...prev,
      recipientIds: ids,
      recipientId: ids.length === 1 ? ids[0] : "",
    }));
    if (selectedTemplate) applyTemplate(selectedTemplate);
  };

  // Filter helpers for recipients
  const getFilteredUsers = () => {
    const meId = parseInt(session?.user?.id);
    const q = recipientQuery.trim().toLowerCase();
    return (users || [])
      .filter((u) => u.id !== meId)
      .filter((u) => roleFilter === "all" ? true : (String(u.role) === roleFilter))
      .filter((u) =>
        !q
          ? true
          : String(u.name || "").toLowerCase().includes(q) ||
            String(u.role || "").toLowerCase().includes(q) ||
            String(u.whatsapp_number || "").toLowerCase().includes(q)
      );
  };

  const handleSelectAllFiltered = () => {
    const list = getFilteredUsers().map((u) => u.id);
    setMessageData((prev) => ({ ...prev, recipientIds: list, recipientId: list.length === 1 ? list[0] : "" }));
    if (selectedTemplate) applyTemplate(selectedTemplate);
  };

  const handleClearSelection = () => {
    setMessageData((prev) => ({ ...prev, recipientIds: [], recipientId: "" }));
    if (selectedTemplate) applyTemplate(selectedTemplate);
  };

  const toggleRecipient = (id) => {
    setMessageData((prev) => {
      const set = new Set(prev.recipientIds || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      const list = Array.from(set);
      return { ...prev, recipientIds: list, recipientId: list.length === 1 ? list[0] : "" };
    });
  };

  // Init browser SpeechRecognition for AI Assist (voice-to-text)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSttSupported(true);
    const recog = new SR();
    recog.lang = "en-IN";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e) => {
      const t = e?.results?.[0]?.[0]?.transcript || "";
      if (t) {
        setAiPrompt((prev) => (prev ? prev + " " : "") + t);
        setTimeout(() => {
          try {
            const el = aiPromptRef.current;
            if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'; }
          } catch {}
        }, 0);
      }
    };
    recog.onend = () => setRecognizing(false);
    recog.onerror = () => setRecognizing(false);
    recogRef.current = recog;
    return () => {
      try { if (recognizing) recogRef.current?.stop(); } catch {}
    };
  }, [recognizing]);

  const resizeAiPrompt = () => {
    try {
      const el = aiPromptRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 220) + 'px';
    } catch {}
  };
  useEffect(() => { resizeAiPrompt(); }, [aiPrompt]);

  const handleSelectTeachersFiltered = () => {
    const list = getFilteredUsers().filter((u) => u.isTeacher).map((u) => u.id);
    setMessageData((prev) => ({ ...prev, recipientIds: list, recipientId: list.length === 1 ? list[0] : "" }));
    if (selectedTemplate) applyTemplate(selectedTemplate);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        setTimeout(() => setError(""), 3000);
        return;
      }
      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("whatsapp_number", formData.whatsapp_number);
      formDataToSend.append("whatsapp_enabled", formData.whatsapp_enabled);
      if (profileImage) {
        formDataToSend.append("image", profileImage);
      }
      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        body: formDataToSend,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }
      setFormData({
        name: data.user.name || "",
        whatsapp_number: data.user.whatsapp_number || "",
        whatsapp_enabled: data.user.whatsapp_enabled !== false,
      });
      setImagePreview(data.user.image || "/default-avatar.png");
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 2500);
      await fetch("/api/auth/session", { credentials: "include" });
      window.postMessage({ type: "PROFILE_UPDATED" }, window.location.origin);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New password and confirmation do not match");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/member/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      setSuccess("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageDelete = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/member/profile", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete profile picture");
      }
      setProfileImage(null);
      setImagePreview(data.user.image || "/default-avatar.png");
      setSuccess("Profile picture removed!");
      setTimeout(() => setSuccess(""), 2500);
      await fetch("/api/auth/session", { credentials: "include" });
      window.postMessage({ type: "PROFILE_UPDATED" }, window.location.origin);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");
    if (!leaveRequest.startDate || !leaveRequest.endDate || !leaveRequest.reason) {
      setError("Please fill in all required fields");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }
    if (isLeaveProofRequired && !leaveRequest.proof) {
      setError("Supporting document is required for leave requests.");
      setTimeout(() => setError(""), 3000);
      setIsLoading(false);
      return;
    }
    try {
      const leaveData = new FormData();
      leaveData.append("startDate", leaveRequest.startDate);
      leaveData.append("endDate", leaveRequest.endDate);
      leaveData.append("reason", leaveRequest.reason);
      if (leaveRequest.proof) {
        leaveData.append("proof", leaveRequest.proof);
      }
      if (session?.user?.role === "team_manager" && leaveRequest.transferTo) {
        leaveData.append("transferTo", leaveRequest.transferTo);
      }
      const response = await fetch("/api/member/leave-request", {
        method: "POST",
        body: leaveData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `Failed to submit leave request (HTTP ${response.status})`);
      }
      setSuccess("Leave request submitted successfully!");
      setLeaveRequest({
        startDate: "",
        endDate: "",
        reason: "",
        transferTo: "",
        proof: null,
      });
      if (proofInputRef.current) {
        proofInputRef.current.value = "";
      }
      setShowLeaveModal(false);
      const historyResponse = await fetch("/api/member/leave-request", { credentials: "include" });
      if (!historyResponse.ok) {
        const text = await historyResponse.text();
        throw new Error(`Failed to refresh leave history: ${historyResponse.statusText || "Unknown error"}`);
      }
      const historyData = await historyResponse.json();
      const normalized = Array.isArray(historyData.requests)
        ? historyData.requests.map((req) => ({
            ...req,
            startDate: req.startDate ? new Date(req.startDate) : null,
            endDate: req.endDate ? new Date(req.endDate) : null,
            approvedStartDate: req.approvedStartDate ? new Date(req.approvedStartDate) : null,
            approvedEndDate: req.approvedEndDate ? new Date(req.approvedEndDate) : null,
            createdAt: req.createdAt ? new Date(req.createdAt) : null,
            approvedAt: req.approvedAt ? new Date(req.approvedAt) : null,
          }))
        : [];
      setLeaveHistory(normalized);
      setIsLeaveProofRequired(Boolean(historyData?.config?.proofRequired));
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    const { recipientType, recipientId, recipientIds, customName, customWhatsappNumber, subject, message, note, contact } = messageData;

    // Input validation
    if (recipientType === "existing") {
      const ids = Array.isArray(recipientIds) && recipientIds.length ? recipientIds : (!isNaN(parseInt(recipientId)) ? [parseInt(recipientId)] : []);
      if (!ids.length || !subject.trim() || !message.trim() || !contact.trim()) {
        setError("Please select at least one recipient and fill all fields");
        setTimeout(() => setError(""), 3000);
        return;
      }
    }
    if (recipientType === "custom" && (!customName.trim() || !customWhatsappNumber.trim() || !subject.trim() || !message.trim() || !contact.trim())) {
      setError("Please fill in all required fields for custom recipient");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (recipientType === "custom" && !/^\+?[1-9]\d{1,14}$/.test(customWhatsappNumber.trim())) {
      setError("Invalid WhatsApp number format");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Get recipient name for compiled message
    let recipientName = "";
    if (recipientType === "existing") {
      const ids = Array.isArray(recipientIds) && recipientIds.length ? recipientIds : (recipientId ? [parseInt(recipientId)] : []);
      if (ids.length > 1) {
        recipientName = "there";
      } else {
        const recipient = users.find((u) => u.id === parseInt(ids[0]));
        recipientName = recipient?.name || "User";
      }
    } else {
      recipientName = customName.trim();
    }

    // Compile message in the same format as backend
    const now = new Date();
    const footer = `Sent on ${now.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}. Please kindly check the MeedianAI portal for more information [https://meedian-ai-flow.vercel.app/]`;
    const compiled = `Hi ${recipientName}, ${session?.user?.name || "System"} (from Meed Leadership Group) has sent you a new message. Subject: ${subject}. Message: ${message}${note.trim() ? `. Note: ${note.trim()}` : ""}. If you need assistance, please contact ${contact}. ${includeFooter ? footer : ""}`.trim();

    // Set compiled message and show confirmation modal
    setCompiledMessage(compiled);
    setShowConfirmMessageModal(true);
  };

  const handleConfirmMessageSend = async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const { recipientType, recipientId, recipientIds, customName, customWhatsappNumber, subject, message, note, contact } = messageData;
      if (recipientType === "existing") {
        const ids = Array.isArray(recipientIds) && recipientIds.length ? recipientIds : (recipientId ? [parseInt(recipientId)] : []);
        const failures = [];
        for (const id of ids) {
          try {
            const res = await fetch("/api/managersCommon/direct-message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipientId: id,
                subject,
                message,
                note: note ?? "",
                contact,
                includeFooter,
              }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
          } catch (e) {
            failures.push({ id, error: e.message || String(e) });
          }
        }
        if (failures.length) {
          setError(`${failures.length} of ${ids.length} failed. First error: ${failures[0].error}`);
        } else {
          setSuccess(`Message sent to ${ids.length} recipient${ids.length > 1 ? 's' : ''}!`);
        }
      } else {
        const response = await fetch("/api/managersCommon/direct-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customName,
            customWhatsappNumber,
            subject,
            message,
            note: note ?? "",
            contact,
            includeFooter,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to send message");
        }
        setSuccess("Message sent successfully!");
      }
      setMessageData({
        recipientType: "existing",
        recipientId: "",
        recipientIds: [],
        customName: "",
        customWhatsappNumber: "",
        subject: "",
        message: "",
        note: "",
        contact: "admin@mymeedai.org",
      });
      setShowMessageModal(false);
      setShowConfirmMessageModal(false);
      setIncludeFooter(true);
      // Refetch sent messages to update the history
      const historyResponse = await fetch("/api/member/sent-messages?mode=custom", { credentials: "include" });
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setSentMessages(historyData.messages || []);
      }
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate subject/message draft with AI and prefill form
  const generateAIDraft = async () => {
    if (aiBusy) return;
    try {
      setAiBusy(true);
      setError("");

      // Figure recipient meta for better prompts
      let recipientName = "there";
      let recipientRole = "";
      let toNumber = "";
      if (messageData.recipientType === "existing") {
        const ids = Array.isArray(messageData.recipientIds) && messageData.recipientIds.length
          ? messageData.recipientIds
          : (messageData.recipientId ? [parseInt(messageData.recipientId)] : []);
        if (ids.length > 1) {
          recipientName = "multiple recipients";
          recipientRole = "mixed";
          toNumber = "";
        } else {
          const u = users.find((x) => x.id === parseInt(ids[0]));
          recipientName = u?.name || recipientName;
          recipientRole = u?.role || recipientRole;
          toNumber = u?.whatsapp_number || "";
        }
      } else {
        recipientName = messageData.customName?.trim() || recipientName;
        toNumber = messageData.customWhatsappNumber?.trim() || "";
      }

      const senderName = session?.user?.name || "Admin";
      const contact = (messageData.contact || "").trim();
      const note = (messageData.note || "").trim();

      // Build a strong instruction so the API returns JSON we can parse
      const instruction = [
        `You are drafting a concise WhatsApp message in a ${aiTone} tone.`,
        `Audience: ${recipientName}${recipientRole ? ` (${recipientRole})` : ""}.`,
        toNumber ? `Recipient WhatsApp: ${toNumber}.` : "",
        `Sender: ${senderName}.`,
        contact ? `Support contact: ${contact}.` : "",
        note ? `Include this note if helpful: "${note}".` : "",
        aiPrompt ? `Intent/context: ${aiPrompt}` : "",
        "Return ONLY compact JSON with keys subject and message, no explanations.",
        "Message should be 1–3 short sentences (max ~80 words), neutral punctuation, no emojis.",
        "Do not include salutations like 'Hi {name},' — we add that later.",
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You write crisp internal messages for school ops." },
            { role: "user", content: instruction },
          ],
          model: "gpt-4o-mini",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "AI request failed");

      let reply = String(data.reply || "").trim();
      // Try to extract JSON from code fences if present
      const fence = reply.match(/```json\s*([\s\S]*?)\s*```/i) || reply.match(/```\s*([\s\S]*?)\s*```/i);
      if (fence) reply = fence[1].trim();
      let parsed;
      try { parsed = JSON.parse(reply); } catch (_) {
        // Fallback: naive extract lines like Subject: ...\nMessage: ...
        const subj = (reply.match(/subject\s*[:\-]\s*(.+)/i) || [null, ""])[1].trim();
        const msg = (reply.match(/message\s*[:\-]\s*([\s\S]*)/i) || [null, ""])[1].trim();
        parsed = { subject: subj || messageData.subject, message: msg || messageData.message };
      }

      const nextSubject = (parsed?.subject || "").replace(/^"|"$/g, "").slice(0, 140);
      const nextMessage = (parsed?.message || "").replace(/^"|"$/g, "").slice(0, 800);
      if (!nextSubject && !nextMessage) throw new Error("AI did not return a usable draft");

      setMessageData((prev) => ({
        ...prev,
        subject: nextSubject || prev.subject,
        message: nextMessage || prev.message,
      }));
      setSuccess("AI draft applied. Review and adjust if needed.");
      setTimeout(() => setSuccess(""), 2000);
    } catch (e) {
      setError(e.message || "Failed to generate draft");
      setTimeout(() => setError(""), 3000);
    } finally {
      setAiBusy(false);
    }
  };

  const handleClose = () => {
    router.push(`/dashboard/${session?.user?.role === "team_manager" ? "team_manager" : session?.user?.role}`);
  };

  // stopCurrentMRN removed (MRN not shown here)

  const handleTalkToSuperintendent = () => {
    const superintendent = users.find((user) => user.id === 43);
    if (superintendent?.id) {
      setChatboxOpen(true);
      setChatRecipient(String(superintendent.id));
    } else {
      console.error("Superintendent (id: 43) not found. Users:", users);
      setError("Superintendent not found. Please contact an admin or try again later.");
      setTimeout(() => setError(""), 5000);
    }
  };

  const toRoleLabel = (role) => role.replaceAll("_", " ").toUpperCase();
  const scrollTo = (ref) => ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Sidebar section refs
  const sectionProfileRef = useRef(null);
  const sectionWidgetsRef = useRef(null);
  const sectionLeaveHistoryRef = useRef(null);
  const sectionUserInfoRef = useRef(null);
  const sectionChangePasswordRef = useRef(null);

  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-50"
      >
        <motion.div className="text-lg font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-5 h-5 border-3 border-t-teal-600 border-teal-200 rounded-full"
          />
          Loading...
        </motion.div>
      </motion.div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  // Open specific widget/modal via query param from navbar sheet
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const clearOpenQueryParam = () => {
    try {
      const params = new URLSearchParams(searchParams?.toString?.() || "");
      params.delete("open");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    } catch {}
  };
  useEffect(() => {
    const open = searchParams?.get("open");
    if (!open) return;
    if (open === "leave") {
      setShowLeaveModal(true);
    } else if (open === "direct") {
      setShowMessageModal(true);
      // Prefill with Welcome template if fields are empty
      setTimeout(() => {
        if (!messageData.subject && !messageData.message) {
          applyTemplate("welcome");
        }
      }, 0);
    } else if (open === "sent") {
      setShowSentMessageHistoryModal(true);
    } else if (open === "talk") {
      // Wait for users to load before attempting to open the chat
      if (isLoadingUsers) return; // will rerun when loading completes
      if (users && users.length > 0) {
        handleTalkToSuperintendent();
      } else {
        // Fallback: refetch users once if empty
        (async () => {
          try {
            const resp = await fetch("/api/member/users", { credentials: "include" });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && Array.isArray(data.users) && data.users.length) {
              setUsers(data.users);
              setTimeout(() => handleTalkToSuperintendent(), 0);
            } else {
              setError("Superintendent not found. Please contact an admin or try again later.");
              setTimeout(() => setError(""), 5000);
            }
          } catch {
            setError("Failed to load users for chat.");
            setTimeout(() => setError(""), 5000);
          }
        })();
      }
    }
  }, [searchParams, isLoadingUsers, users]);

  useEffect(() => {
    if (showMessageModal && !messageData.subject && !messageData.message) {
      applyTemplate(selectedTemplate || "welcome");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMessageModal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed top-14 left-0 right-0 bottom-14 z-40 flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50/80 dark:from-gray-800/80 dark:to-gray-900/80 p-3 md:p-6"
    >
      <div
        className="relative w-full max-w-[98vw] max-h-[88vh] md:max-h-[86vh] bg-white/85 dark:bg-slate-900/75 border border-teal-200/70 shadow-xl rounded-2xl px-2 md:px-6 py-5 flex flex-col overflow-y-auto backdrop-blur-xl transition-all custom-scrollbar"
        style={{
          boxShadow: "0 8px 32px 0 rgba(16, 42, 67, 0.1), 0 2px 8px 0 rgba(16,42,67,0.08)",
        }}
      >
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          className="absolute top-4 right-4 z-50 p-1.5 bg-gray-100/80 hover:bg-gray-300/80 dark:hover:bg-gray-600/80 rounded-full shadow-md border border-gray-200 dark:border-gray-600 transition-all"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </motion.button>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main content */}
          <div className="flex-[2] min-w-[280px] flex flex-col">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
              Profile Settings
            </h1>
            <AnimatePresence>
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-green-800 font-medium bg-green-100/90 dark:bg-green-900/90 p-2 rounded-lg shadow-md border border-green-300/50 dark:border-green-700/50 mb-3"
                >
                  {success}
                </motion.p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-red-800 font-medium bg-red-100/90 dark:bg-red-900/90 p-2 rounded-lg shadow-md border border-red-300/50 dark:border-red-700/50 mb-3"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <div ref={sectionProfileRef} />
            <form onSubmit={handleProfileUpdate} className="flex flex-col gap-5 mb-4">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover shadow-xl ring-2 ring-teal-300/60 border border-teal-600/50"
                    />
                    <label
                      htmlFor="profile-image"
                      className="absolute bottom-0 right-0 bg-teal-600 text-white p-2 rounded-full cursor-pointer hover:bg-teal-700 transition shadow-md border border-white/40"
                    >
                      <Camera size={18} />
                      <input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={isLoading}
                      />
                    </label>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleImageDelete}
                    className="text-red-600 hover:text-red-700 text-xs font-medium transition"
                    disabled={isLoading || !imagePreview || imagePreview === "/default-avatar.png"}
                  >
                    Remove Profile Picture
                  </motion.button>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">WhatsApp Number</label>
                    <input
                      type="tel"
                      name="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="whatsapp_enabled"
                      checked={formData.whatsapp_enabled}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      Enable WhatsApp Notifications
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 shadow-md transition"
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Profile"}
                </motion.button>
              </div>
            </form>
            <div ref={sectionWidgetsRef} className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50" />
            <div ref={sectionLeaveHistoryRef} className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Leave History
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHistoryModal(true)}
                className="w-full sm:w-auto px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 shadow-md transition"
                disabled={isLoading}
              >
                View Leave History
              </motion.button>
            </div>
          </div>
          <div className="flex-[1] min-w-[260px] max-w-[400px] flex flex-col">
            <div className="sticky top-4 space-y-4">
{/* User Info + Settings */}
              <div className="bg-gradient-to-br from-blue-50/60 to-blue-100/80 dark:from-slate-800/80 dark:to-slate-900/70 rounded-xl shadow-md border border-teal-100/70 dark:border-slate-700 p-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600" />
                  User Information
                </h2>
                <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div ref={sectionUserInfoRef} />
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Email</label>
                  <p className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700">
                    {session?.user?.email || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Role</label>
                  <p className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700">
                    {session?.user?.role?.replace("_", " ") || "N/A"}
                  </p>
                </div>
                {session?.user?.role === "team_manager" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Team Manager Type</label>
                    <p className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700">
                      {session?.user?.team_manager_type?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">MRI Roles</label>
                  <p className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700">
                    {isLoadingUsers ? "Loading..." : 
                      users
                        .find((u) => u.id === parseInt(session?.user?.id))
                        ?.mriRoles?.length > 0
                        ? users
                            .find((u) => u.id === parseInt(session?.user?.id))
                            ?.mriRoles.map(toRoleLabel)
                            .join(", ") 
                        : "None"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Reports To</label>
                  <p className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700">
                    {immediateSupervisor?.name || "None"} {immediateSupervisor?.role ? `(${immediateSupervisor.role})` : ""}
                  </p>
                </div>
              </div>
              <form ref={sectionChangePasswordRef} onSubmit={handlePasswordUpdate} className="grid gap-3 mt-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Change Password
                </h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 shadow-md transition"
                    disabled={isLoading}
                  >
                    {isLoading ? "Changing..." : "Change Password"}
                  </motion.button>
                </div>
              </form>
            </div>
            {/* Close sticky sidebar container */}
          </div>
        </div>
        {/* Ensure flex row wrapper fully closed */}
        
        <AnimatePresence>
          {showLeaveModal && (
            <motion.div
              key="leave-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-xl p-6 w-full max-w-4xl border border-teal-200/70 dark:border-slate-700"
              >
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  Submit Leave Request
                </h2>
                <form onSubmit={handleLeaveSubmit} className="grid gap-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={leaveRequest.startDate}
                        onChange={handleLeaveChange}
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        name="endDate"
                        value={leaveRequest.endDate}
                        onChange={handleLeaveChange}
                        className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-1">
                        Reason
                      </label>
                      <textarea
                        name="reason"
                        value={leaveRequest.reason}
                        onChange={handleLeaveChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            setLeaveRequest((prev) => ({
                              ...prev,
                              reason: prev.reason + "\n",
                            }));
                          }
                        }}
                        className="w-full px-3 py-3 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 min-h-[120px]"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-1">
                          Supporting Document {isLeaveProofRequired ? "(Required)" : "(Optional)"}
                        </label>
                        <input
                          type="file"
                          name="proof"
                          accept=".pdf,.doc,.docx,.jpg,.png"
                          onChange={handleLeaveChange}
                          ref={proofInputRef}
                          required={isLeaveProofRequired}
                          className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                          disabled={isLoading}
                        />
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {isLeaveProofRequired
                            ? "Supporting evidence is required for new leave submissions."
                            : "Attach medical certificates or other proof if available."}
                        </p>
                      </div>
                      {session?.user?.role === "team_manager" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-1">
                            Transfer Role To
                          </label>
                          <select
                            name="transferTo"
                            value={leaveRequest.transferTo}
                            onChange={handleLeaveChange}
                            className="w-full px-3 py-2 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                            disabled={isLoading}
                          >
                            <option value="">Select User</option>
                            {users
                              .filter(
                                (u) =>
                                  u.id !== parseInt(session?.user?.id) && (u.role === "admin" || u.role === "team_manager")
                              )
                              .map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.role})
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            Hand off responsibilities while you are away.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => setShowLeaveModal(false)}
                      className="px-4 py-2 bg-gray-400 text-white rounded-lg text-xs font-semibold hover:bg-gray-500 shadow-md transition"
                      disabled={isLoading}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      className="px-5 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 shadow-md transition disabled:opacity-60"
                      disabled={isLoading}
                    >
                      {isLoading ? "Submitting..." : "Submit for Approval"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
          {showMessageModal && ["admin", "team_manager"].includes(session?.user?.role) && (
            <motion.div
              key="message-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/85 dark:bg-slate-900/75 rounded-2xl shadow-xl w-full max-w-6xl border border-teal-200/70 dark:border-slate-700 backdrop-blur-xl flex flex-col max-h-[66vh]"
              >
                <h2 className="text-base font-bold text-gray-800 dark:text-white px-5 pt-5 pb-4 flex items-center gap-2 border-b border-teal-200/40 dark:border-slate-700/60 sticky top-0 bg-white/85 dark:bg-slate-900/75 z-10">
                  <Send className="w-4 h-4 text-teal-600" />
                  Send Direct WhatsApp Message
                </h2>
                <div className="px-5 pt-3 pb-5 overflow-y-auto flex-1">
                <form onSubmit={handleMessageSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          name="recipientType"
                          value="existing"
                          checked={messageData.recipientType === "existing"}
                          onChange={handleMessageChange}
                          className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-gray-300"
                          disabled={isLoading}
                        />
                        Existing User
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="radio"
                          name="recipientType"
                          value="custom"
                          checked={messageData.recipientType === "custom"}
                          onChange={handleMessageChange}
                          className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-gray-300"
                          disabled={isLoading}
                        />
                        Custom Recipient
                      </label>
                    </div>
                    {messageData.recipientType === "existing" ? (
                      <div>
                        <label className="block text-xs font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5 mb-1">
                          <UserCircle className="w-3.5 h-3.5 text-teal-600" />
                          Recipient Selection
                        </label>
                        <div className="flex items-center gap-3 mb-2">
                          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                            <input type="radio" name="selectionMode" value="single" checked={selectionMode === 'single'} onChange={() => { setSelectionMode('single'); setShowMultiPicker(false); }} className="h-3 w-3 text-teal-600" />
                            Single
                          </label>
                          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                            <input type="radio" name="selectionMode" value="multiple" checked={selectionMode === 'multiple'} onChange={() => setSelectionMode('multiple')} className="h-3 w-3 text-teal-600" />
                            Multiple
                          </label>
                        </div>

                        {selectionMode === 'single' ? (
                          <div>
                            <select
                              name="recipientId"
                              value={messageData.recipientId}
                              onChange={handleMessageChange}
                              className="w-full px-3 py-2 border rounded-lg bg-white/90 dark:bg-slate-950/40 focus:ring-2 focus:ring-teal-500 text-sm text-gray-800 dark:text-gray-100 border-gray-200 dark:border-slate-700"
                              disabled={isLoading}
                            >
                              <option value="">Select user…</option>
                              {users
                                .filter((u) => u.id !== parseInt(session?.user?.id))
                                .map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name} ({user.role})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                                {(() => {
                                  const count = (messageData.recipientIds || []).length || 0;
                                  if (!count) return <>Selected: 0</>;
                                  const names = selectedNames;
                                  const preview = names.slice(0, 3).join(', ');
                                  const extra = names.length > 3 ? ` +${names.length - 3} more` : '';
                                  return <>Selected: {count} ({preview}{extra})</>;
                                })()}
                              </div>
                              <button type="button" onClick={() => setShowMultiPicker((v) => !v)} className="px-2.5 py-1.5 text-xs rounded-lg border bg-white/80 dark:bg-slate-800/70 border-gray-200 dark:border-slate-700 hover:bg-white/95">
                                {showMultiPicker ? 'Hide list' : 'Choose recipients'}
                              </button>
                            </div>
                            {showMultiPicker && (
                              <div className="rounded-xl border bg-white/85 dark:bg-slate-950/40 border-gray-200 dark:border-slate-700 p-2 space-y-2 shadow-inner">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={recipientQuery}
                                    onChange={(e) => setRecipientQuery(e.target.value)}
                                    placeholder="Search name, role, WhatsApp"
                                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border bg-gray-50/90 dark:bg-slate-900/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500"
                                  />
                                  <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="px-2 py-1.5 text-xs rounded-lg border bg-gray-50/90 dark:bg-slate-900/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-teal-500"
                                  >
                                    <option value="all">All roles</option>
                                    <option value="member">Member</option>
                                    <option value="team_manager">Team Manager</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Filtered: {getFilteredUsers().length}</div>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={handleSelectAllFiltered} className="px-2 py-1 text-[11px] rounded-lg border bg-white/90 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-white">Select all</button>
                                    <button type="button" onClick={handleSelectTeachersFiltered} className="px-2 py-1 text-[11px] rounded-lg border bg-white/90 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-white">Select teachers</button>
                                    <button type="button" onClick={handleClearSelection} className="px-2 py-1 text-[11px] rounded-lg border bg-white/90 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700 hover:bg-white">Clear</button>
                                  </div>
                                </div>
                                <div className="max-h-56 overflow-auto rounded-lg border border-gray-100 dark:border-slate-800 divide-y divide-gray-100/60 dark:divide-slate-800/60">
                                  {getFilteredUsers().map((u) => {
                                    const checked = (messageData.recipientIds || []).includes(u.id);
                                    return (
                                      <label key={u.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50/80 dark:hover:bg-slate-900/60">
                                        <div className="flex items-center gap-2">
                                          <input type="checkbox" checked={checked} onChange={() => toggleRecipient(u.id)} className="h-3.5 w-3.5 text-teal-600" />
                                          <span className="text-gray-800 dark:text-gray-100">{u.name}</span>
                                        </div>
                                        <span className="text-[11px] text-gray-500">{u.role}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="flex justify-end">
                                  <button type="button" onClick={() => setShowMultiPicker(false)} className="px-3 py-1.5 text-xs rounded-lg bg-teal-600 text-white hover:bg-teal-700">Done</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                            <UserCircle className="w-3.5 h-3.5 text-teal-600" />
                            Recipient Name
                          </label>
                          <input
                            type="text"
                            name="customName"
                            value={messageData.customName}
                            onChange={handleMessageChange}
                            className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                            required
                            disabled={isLoading}
                            placeholder="Enter recipient name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                            WhatsApp Number
                          </label>
                          <input
                            type="tel"
                            name="customWhatsappNumber"
                            value={messageData.customWhatsappNumber}
                            onChange={handleMessageChange}
                            className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                            required
                            disabled={isLoading}
                            placeholder="+1234567890"
                          />
                        </div>
                      </>
                    )}
                    {/* AI Assist panel — moved below recipients */}
                    <div className="rounded-lg border border-teal-200/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-3">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">AI Assist</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                        <div className="sm:col-span-2 flex items-start gap-2">
                          <textarea
                            ref={aiPromptRef}
                            rows={2}
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onInput={resizeAiPrompt}
                            className="flex-1 px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 resize-none leading-5"
                            placeholder="Describe intent (e.g., gentle reminder about attendance form)"
                            disabled={aiBusy}
                            style={{ overflow: 'hidden' }}
                          />
                          {sttSupported && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  if (!recognizing) { recogRef.current?.start(); setRecognizing(true); }
                                  else { recogRef.current?.stop(); }
                                } catch {}
                              }}
                              title={recognizing ? "Stop recording" : "Speak"}
                              className={`px-2 py-2 rounded-xl ${recognizing ? "bg-rose-600 hover:bg-rose-700" : "bg-white/10 hover:bg-white/20 border border-gray-200 dark:border-slate-700"}`}
                              disabled={aiBusy}
                            >
                              {recognizing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                        <div>
                          <select
                            className="w-full px-2 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-xs text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                            value={aiTone}
                            onChange={(e) => setAiTone(e.target.value)}
                            disabled={aiBusy}
                          >
                            <option value="friendly">Friendly</option>
                            <option value="professional">Professional</option>
                            <option value="reminder">Reminder</option>
                            <option value="urgent">Urgent</option>
                            <option value="appreciation">Appreciation</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={generateAIDraft}
                          disabled={aiBusy}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md border ${aiBusy ? "bg-gray-300 text-gray-600 border-gray-300" : "bg-teal-600 text-white border-teal-600 hover:bg-teal-700"}`}
                        >
                          {aiBusy ? "Generating…" : "Generate with AI"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Template</label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => { setSelectedTemplate(e.target.value); applyTemplate(e.target.value); }}
                        className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        disabled={isLoading}
                      >
                        {messageTemplates.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                        <option value="">Custom (no template)</option>
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={includeFooter}
                          onChange={(e) => setIncludeFooter(e.target.checked)}
                          className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-gray-300"
                          disabled={isLoading}
                        />
                        Include default footer (timestamp + portal link)
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Subject
                      </label>
                      <input
                        type="text"
                        name="subject"
                        value={messageData.subject}
                        onChange={handleMessageChange}
                        className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        required
                        disabled={isLoading}
                        placeholder="Enter message subject"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                        Message
                      </label>
                      <textarea
                        name="message"
                        value={messageData.message}
                        onChange={handleMessageChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            setMessageData((prev) => ({
                              ...prev,
                              message: prev.message + "\n",
                            }));
                          }
                        }}
                        className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        rows={3}
                        required
                        disabled={isLoading}
                        placeholder="Enter your message"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Additional Note (Optional)
                      </label>
                      <textarea
                        name="note"
                        value={messageData.note}
                        onChange={handleMessageChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            setMessageData((prev) => ({
                              ...prev,
                              note: prev.note + "\n",
                            }));
                          }
                        }}
                        className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        rows={3}
                        disabled={isLoading}
                        placeholder="Enter additional note"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-teal-600" />
                        Contact Info
                      </label>
                      <input
                        type="text"
                        name="contact"
                        value={messageData.contact}
                        onChange={handleMessageChange}
                        className="w-full px-3 py-1.5 border rounded-lg bg-gray-50/90 dark:bg-slate-800/90 focus:ring-2 focus:ring-teal-500 text-sm text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700"
                        required
                        disabled={isLoading}
                        placeholder="Enter contact info (e.g., email or phone)"
                      />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 flex justify-end gap-2 mt-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => setShowMessageModal(false)}
                      className="px-4 py-2 bg-gray-400 text-white rounded-lg text-xs font-medium hover:bg-gray-500 shadow-md transition"
                      disabled={isLoading}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 shadow-md transition"
                      disabled={isLoading}
                    >
                      {isLoading ? "Preparing..." : "Preview Message"}
                    </motion.button>
                  </div>
                </form>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showConfirmMessageModal && (
            <motion.div
              key="confirm-message-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-md p-5 w-full max-w-lg border border-teal-200/70 dark:border-slate-700"
              >
                <h2 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-teal-600" />
                  Confirm Message
                </h2>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                  Please review the message below as it will be sent to the recipient:
                </p>
                <div className="p-3 bg-gray-50/90 dark:bg-slate-800/90 rounded-lg border border-gray-200 dark:border-slate-700 mb-4">
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{compiledMessage}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setShowConfirmMessageModal(false)}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg text-xs font-medium hover:bg-gray-500 shadow-md transition"
                    disabled={isLoading}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleConfirmMessageSend}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 shadow-md transition"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Message"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showHistoryModal && (
            <motion.div
              key="history-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-md p-5 w-full max-w-3xl max-h-[70vh] overflow-y-auto border border-teal-200/70 dark:border-slate-700"
              >
                <h2 className="text-base font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Leave History
                </h2>
                {leaveHistory.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">No leave requests found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-700 dark:text-gray-200">
                      <thead className="text-xs text-gray-700 dark:text-gray-200 uppercase bg-gray-50/90 dark:bg-slate-800/90">
                        <tr>
                          <th className="px-3 py-2">Requested</th>
                          <th className="px-3 py-2">Approved</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Supervisor</th>
                          <th className="px-3 py-2">Decision Note</th>
                          <th className="px-3 py-2">Rejection Reason</th>
                          <th className="px-3 py-2">Proof</th>
                          <th className="px-3 py-2">Escalation</th>
                          <th className="px-3 py-2">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveHistory.map((request) => {
                          const requestedRange =
                            request.startDate && request.endDate
                              ? `${request.startDate.toLocaleDateString()} → ${request.endDate.toLocaleDateString()}`
                              : "—";
                          const approvedRange =
                            request.approvedStartDate && request.approvedEndDate
                              ? `${request.approvedStartDate.toLocaleDateString()} → ${request.approvedEndDate.toLocaleDateString()}`
                              : "—";
                          const createdAt = request.createdAt
                            ? request.createdAt.toLocaleDateString()
                            : "—";
                          return (
                            <tr
                              key={request.id}
                              className="border-b border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50/90 dark:hover:bg-slate-800/90"
                            >
                              <td className="px-3 py-2">{requestedRange}</td>
                              <td className="px-3 py-2">{approvedRange}</td>
                              <td className="px-3 py-2">{request.reason || "—"}</td>
                              <td className="px-3 py-2 capitalize">{request.status}</td>
                              <td className="px-3 py-2">{request.supervisorName || "N/A"}</td>
                              <td className="px-3 py-2 whitespace-pre-wrap">{request.decisionNote || "—"}</td>
                              <td className="px-3 py-2 whitespace-pre-wrap">{request.rejectionReason || "—"}</td>
                              <td className="px-3 py-2">
                                {request.proof ? (
                                  <a
                                    href={request.proof}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-teal-600 hover:text-teal-700"
                                  >
                                    View
                                  </a>
                                ) : (
                                  "None"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {request.escalationMatterId ? `Matter #${request.escalationMatterId}` : "—"}
                              </td>
                              <td className="px-3 py-2">{createdAt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowHistoryModal(false)}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg text-xs font-medium hover:bg-gray-500 shadow-md transition"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showSentMessageHistoryModal && ["admin", "team_manager"].includes(session?.user?.role) && (
            <motion.div
              key="sent-message-history-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 dark:bg-black/70 flex items-center justify-center p-3 z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-md p-5 w-full max-w-4xl max-h-[70vh] overflow-y-auto border border-teal-200/70 dark:border-slate-700"
              >
                <AllMessageHistory
                  sentMessages={sentMessages}
                  onClose={() => {
                    setShowSentMessageHistoryModal(false);
                    clearOpenQueryParam();
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #b6e0fe66;
            border-radius: 6px;
          }
          .custom-scrollbar {
            scrollbar-color: #60a5fa44 transparent;
            scrollbar-width: thin;
          }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #2563eb77;
          }
          .glassmorphism {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          }
          html.dark .glassmorphism {
            background: rgba(30, 41, 59, 0.9);
          }
        `}</style>
        {/* Extra closures to balance wrappers */}
        </div>
        </div>
      </div>
    </motion.div>
  );
}
