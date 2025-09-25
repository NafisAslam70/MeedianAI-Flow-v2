const SLA_RULES = {
  low: { firstResponseHours: 48, resolveHours: 120 },
  normal: { firstResponseHours: 24, resolveHours: 72 },
  high: { firstResponseHours: 4, resolveHours: 24 },
  urgent: { firstResponseHours: 1, resolveHours: 8 },
};

export const TICKET_PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

export const TICKET_CATEGORY_TREE = [
  {
    key: "facilities",
    label: "Facilities & Infrastructure",
    queue: "facilities",
    subcategories: [
      { key: "electricity", label: "Electricity" },
      { key: "plumbing", label: "Plumbing" },
      { key: "furniture", label: "Furniture" },
      { key: "cleaning", label: "Cleaning & Housekeeping" },
      { key: "safety", label: "Safety & Compliance" },
    ],
  },
  {
    key: "it",
    label: "IT & Systems",
    queue: "it",
    subcategories: [
      { key: "hardware", label: "Hardware" },
      { key: "software", label: "Software" },
      { key: "network", label: "Network" },
      { key: "access", label: "Access & Credentials" },
    ],
  },
  {
    key: "finance",
    label: "Finance & Accounts",
    queue: "finance",
    subcategories: [
      { key: "payments", label: "Payments" },
      { key: "reimbursements", label: "Reimbursements" },
      { key: "fee", label: "Student Fees" },
      { key: "audit", label: "Audit & Compliance" },
    ],
  },
  {
    key: "academics",
    label: "Academics",
    queue: "academics",
    subcategories: [
      { key: "curriculum", label: "Curriculum" },
      { key: "assessment", label: "Assessment" },
      { key: "resources", label: "Teaching Resources" },
      { key: "event", label: "Academic Events" },
    ],
  },
  {
    key: "hostel",
    label: "Hostel & Residential",
    queue: "hostel",
    subcategories: [
      { key: "maintenance", label: "Maintenance" },
      { key: "mess", label: "Mess & Kitchen" },
      { key: "discipline", label: "Discipline" },
      { key: "medical", label: "Medical" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    queue: "operations",
    subcategories: [
      { key: "staffing", label: "Staffing" },
      { key: "logistics", label: "Logistics" },
      { key: "procurement", label: "Procurement" },
      { key: "communication", label: "Communication" },
    ],
  },
  {
    key: "other",
    label: "Other",
    queue: "other",
    subcategories: [
      { key: "general", label: "General" },
      { key: "suggestion", label: "Suggestion" },
      { key: "incident", label: "Incident" },
    ],
  },
];

export function findCategoryByKey(key) {
  if (!key) return null;
  return TICKET_CATEGORY_TREE.find((category) => category.key === key) || null;
}

export function findSubcategory(category, key) {
  if (!category || !Array.isArray(category.subcategories) || !key) return null;
  return category.subcategories.find((item) => item.key === key) || null;
}

export function deriveTicketQueue(categoryKey) {
  const category = findCategoryByKey(categoryKey);
  return category?.queue || "operations";
}

export function computeTicketSla(priority, baseDate = new Date()) {
  const norm = (priority || "normal").toLowerCase();
  const rule = SLA_RULES[norm] || SLA_RULES.normal;
  const created = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const firstResponseAt = new Date(created.getTime() + rule.firstResponseHours * 60 * 60 * 1000);
  const resolveBy = new Date(created.getTime() + rule.resolveHours * 60 * 60 * 1000);
  return { firstResponseAt, resolveBy };
}

export function formatTicketNumber(id, createdAt = new Date()) {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const year = created.getFullYear();
  const padded = String(id).padStart(4, "0");
  return `TCK-${year}-${padded}`;
}

export const TICKET_STATUS_FLOW = [
  "open",
  "triaged",
  "in_progress",
  "waiting_user",
  "escalated",
  "resolved",
  "closed",
];

export const DEFAULT_SLA_RULES = SLA_RULES;
