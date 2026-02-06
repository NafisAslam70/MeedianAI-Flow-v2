import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  integer,
  pgEnum,
  time,
  jsonb,
  index,
  uniqueIndex,
   date,
   decimal,
} from "drizzle-orm/pg-core";

/* -------------------- ENUMS -------------------- */
export const roleEnum = pgEnum("role", ["admin", "team_manager", "member"]);
export const teamManagerTypeEnum = pgEnum("team_manager_type", [
  "head_incharge",
  "coordinator",
  "accountant",
  "chief_counsellor",
  "hostel_incharge",
  "principal",
]);
export const statusEnum = pgEnum("status", [
  "not_started",
  "in_progress",
  "pending_verification",
  "verified",
  "done",
  "not_done",
]);
export const taskTypeEnum = pgEnum("task_type", ["assigned", "routine"]);
export const userTypeEnum = pgEnum("user_type", ["residential", "non_residential", "semi_residential"]);
// export const messageStatusEnum = pgEnum("message_status", ["sent", "read"]);
export const weekNameEnum = pgEnum("week_name", ["General", "Exam", "Event", "Holiday"]);
export const studentStatusEnum = pgEnum("student_status", ["hosteller", "dayscholar"]);
export const defaulterTypeEnum = pgEnum("defaulter_type", ["punctuality", "language", "discipline"]);
export const memberScopeEnum = pgEnum("member_scope", ["o_member", "i_member", "s_member"]);
export const announcementTargetEnum = pgEnum("announcement_target", ["team_members", "students", "all"]);
export const announcementProgramEnum = pgEnum("announcement_program", ["MSP", "MSP-E", "MHCP", "MNP", "MGHP", "MAP", "M4E", "Other"]);
export const noteCategoryEnum = pgEnum("note_category", ["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);
export const mriReportStatusEnum = pgEnum("mri_report_status", ["pending", "draft", "submitted", "verified", "waived"]);
export const mriReportTargetEnum = pgEnum("mri_report_target", ["user", "role", "program", "class", "team"]);

export const meRightNowTypeEnum = pgEnum("me_right_now_type", [
  "assigned",
  "routine",
  // MRI families
  "amri",   // academic MRI categories (MSP, MHCP1, MHCP2, Day Close [no entry])
  "nmri",   // non-academic MRI slots (by dailySlots)
  "rmri",   // role-based MRI (from userMriRoles)
  "mri",    // legacy (kept for compatibility)
  // external/schedule and custom
  "omri",   // outside scheduling: MOP1, MOP2, MOP1L, MOP3
  "custom",
]);

// NMRI TOD roles (weekly coverage)
export const nmriTodRoleEnum = pgEnum("nmri_tod_role", [
  "nmri_moderator",
  "nmri_guide_english",
  "nmri_guide_discipline",
]);

// Update messageStatusEnum to include "failed"
export const messageStatusEnum = pgEnum("message_status", ["sent", "read", "failed"]);
export const messageTypeEnum = pgEnum("message_type", ["direct", "task_update"]);

// NEW: recipient type enum for the consolidated table
export const directRecipientTypeEnum = pgEnum("direct_recipient_type", ["existing", "custom"]);

// Resource management enums
export const resourceStatusEnum = pgEnum("resource_status", [
  "available",
  "in_use",
  "maintenance",
  "retired",
]);
export const resourceLogKindEnum = pgEnum("resource_log_kind", [
  "check_out",
  "check_in",
  "maintenance",
  "issue",
  "transfer",
  "retire",
  "assign",
  "move",
]);

// Ticketing enums
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "triaged",
  "in_progress",
  "waiting_user",
  "escalated",
  "resolved",
  "closed",
]);

export const ticketQueueEnum = pgEnum("ticket_queue", [
  "facilities",
  "it",
  "finance",
  "academics",
  "hostel",
  "operations",
  "other",
]);

export const ticketActivityTypeEnum = pgEnum("ticket_activity_type", [
  "comment",
  "status_change",
  "assignment",
  "priority_change",
  "system",
  "attachment",
]);



export const MRI_ROLE_OPTIONS = [
  "nmri_moderator",
  "msp_ele_moderator",
  "msp_pre_moderator", 
  "mop2_moderator",
  "pt_moderator", 
  "subject_moderator",
  "mhcp1_moderator",
  "mhcp2_moderator",
  "events_moderator",
  "assessment_moderator",
  "sports_moderator",
  "util_moderator",
  // Parent Teacher (class teacher) moderator
];
export const mriRoleEnum = pgEnum("mri_role", MRI_ROLE_OPTIONS);
export const attendanceSourceEnum = pgEnum("attendance_source", ["qr", "biometric"]);

// Financial Management Enums
export const feeTypeEnum = pgEnum("fee_type", [
  "tuition",
  "admission", 
  "examination",
  "sports",
  "library",
  "computer",
  "transport", 
  "hostel",
  "miscellaneous"
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending", 
  "paid", 
  "failed", 
  "partial"
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "upi", "bank"]);

export const ahrTransitionEnum = pgEnum("ahr_transition_quality", [
  "SMOOTH",
  "MINOR_ISSUES",
  "MAJOR_ISSUES",
]);

export const ahrCheckModeEnum = pgEnum("ahr_check_mode", ["MSP", "MORNING_COACHING"]);

export const ahrEscalationStatusEnum = pgEnum("ahr_escalation_status", [
  "RESOLVED",
  "FOLLOW_UP",
  "ESCALATED_UP",
]);

export const ahrDiaryTypeEnum = pgEnum("ahr_diary_type", ["CCD", "CDD"]);

/* -------------------- ESCALATIONS (MANAGERIAL) -------------------- */
export const escalationStatusEnum = pgEnum("escalation_status", ["OPEN", "ESCALATED", "ON_HOLD", "CLOSED"]);
export const escalationActionEnum = pgEnum("escalation_action", ["CREATED", "ESCALATE", "PROGRESS", "CLOSE"]);

/* -------------------- RECRUITMENT PRO -------------------- */
export const recruitmentCandidateStatusEnum = pgEnum("recruitment_candidate_status", [
  "Active",
  "Inactive",
  "Withdrawn",
]);
export const recruitmentFinalStatusEnum = pgEnum("recruitment_final_status", [
  "SELECTED",
  "REJECTED",
  "OFFER",
  "ACCEPTED",
  "JOINED",
  "ON_HOLD",
]);
export const recruitmentCommMethodEnum = pgEnum("recruitment_comm_method", [
  "Call",
  "WhatsApp",
  "Email",
  "SMS",
  "In-Person",
  "Video Call",
]);
export const recruitmentCommOutcomeEnum = pgEnum("recruitment_comm_outcome", [
  "Interested",
  "Not Interested",
  "Will Call Back",
  "Pending",
  "Callback Required",
]);

/* -------------------- A. USERS & MEMBERS -------------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  whatsapp_number: varchar("whatsapp_number", { length: 15 }),
  whatsapp_enabled: boolean("whatsapp_enabled").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  role: roleEnum("role").default("member").notNull(),
  team_manager_type: teamManagerTypeEnum("team_manager_type"),
  type: userTypeEnum("type").default("residential").notNull(),
  member_scope: memberScopeEnum("member_scope").default("i_member").notNull(),
  image: text("image"),
  deep_calendar_token: text("deep_calendar_token").unique(),
  immediate_supervisor: integer("immediate_supervisor").references(() => users.id, { onDelete: "set null" }),
  isTeacher: boolean("is_teacher"),
}, (table) => ({
  idx_whatsapp_number: index("idx_users_whatsapp_number").on(table.whatsapp_number),
  idx_email: index("idx_users_email").on(table.email),
}));

/* -------------------- G. MASTER ACADEMICS (CLASSES & STUDENTS) -------------------- */
export const Classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  section: varchar("section", { length: 8 }),
  track: varchar("track", { length: 32 }), // 'pre_primary' | 'elementary'
  active: boolean("active").default(true).notNull(),
}, (t) => ({
  idx_classes_name: index("idx_classes_name").on(t.name),
  uniq_name_section_track: uniqueIndex("uniq_classes_name_section_track").on(t.name, t.section, t.track),
}));

export const AcademicYears = pgTable("academic_years", {
  code: varchar("code", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniq_academic_years_name: uniqueIndex("uniq_academic_years_name").on(table.name),
  idx_academic_years_current: index("idx_academic_years_current").on(table.isCurrent),
}));

export const academicYears = AcademicYears;

export const Students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  admissionNumber: varchar("admission_number", { length: 50 }).unique(),
  admissionDate: timestamp("admission_date"),
  aadharNumber: varchar("aadhar_number", { length: 20 }),
  dateOfBirth: timestamp("date_of_birth"),
  gender: varchar("gender", { length: 10 }),
  classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "restrict" }),
  sectionType: varchar("section_type", { length: 20 }),
  isHosteller: boolean("is_hosteller").default(false),
  transportChosen: boolean("transport_chosen").default(false),
  guardianPhone: varchar("guardian_phone", { length: 20 }),
  guardianName: varchar("guardian_name", { length: 255 }),
  guardianWhatsappNumber: varchar("guardian_whatsapp_number", { length: 20 }),
  motherName: varchar("mother_name", { length: 255 }),
  address: varchar("address", { length: 255 }),
  bloodGroup: varchar("blood_group", { length: 10 }),
  feeStatus: varchar("fee_status", { length: 20 }).default("Pending"),
  status: varchar("status", { length: 20 }).default("active"),
  accountOpened: boolean("account_opened").default(false),
  academicYear: varchar("academic_year", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  notes: jsonb("notes").default(JSON.stringify([])),
}, (t) => ({
  idxClass: index("students_class_idx").on(t.classId),
  idxAdmNo: index("students_admno_idx").on(t.admissionNumber),
  idxAcademicYear: index("idx_students_academic_year").on(t.academicYear),
}));

export const students = Students;

/* -------------------- B. DAILY SLOTS MODULE -------------------- */
export const dailySlots = pgTable("daily_slots", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  hasSubSlots: boolean("has_sub_slots").default(false).notNull(),
  assignedMemberId: integer("assigned_member_id").references(() => users.id),
  description: text("description"),
  isHighGathering: boolean("is_high_gathering").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailySlotLogs = pgTable("daily_slot_logs", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").references(() => dailySlots.id).notNull(),
  date: timestamp("date").notNull(),
  studentId: integer("student_id").references(() => Students.id).notNull(),
  status: text("status").notNull(),
  defaulter_type: defaulterTypeEnum("defaulter_type"),
  comment: text("comment"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  idx_slot_date: index("idx_daily_slot_logs_slot_date").on(table.slotId, table.date),
}));

export const dailySlotAssignments = pgTable("daily_slot_assignments", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").references(() => dailySlots.id).notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  dayOfWeek: varchar("day_of_week", { length: 10 }),
  role: varchar("role", { length: 16 }),
  className: varchar("class_name", { length: 100 }),
  subject: varchar("subject", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Weekly NMRI TOD templates per weekday
export const slotWeeklyRoles = pgTable("nmri_slot_weekly_roles", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").references(() => dailySlots.id).notNull(),
  weekday: integer("weekday").notNull(), // 0=Sun .. 6=Sat
  role: nmriTodRoleEnum("role").notNull(),
  requiredCount: integer("required_count").default(1).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxSlotWeek: index("idx_slot_weekly_roles_slot_week").on(t.slotId, t.weekday),
}));

// Member assignments to a weekly role
export const slotRoleAssignments = pgTable("nmri_slot_role_assignments", {
  id: serial("id").primaryKey(),
  slotWeeklyRoleId: integer("slot_weekly_role_id").references(() => slotWeeklyRoles.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxAssignRole: index("idx_slot_role_assignments_role").on(t.slotWeeklyRoleId),
}));

// Admin can grant per-section access to specific managers
export const managerSectionGrants = pgTable("manager_section_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  section: varchar("section", { length: 64 }).notNull(),
  programId: integer("program_id").references(() => mriPrograms.id),
  canWrite: boolean("can_write").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqGrant: uniqueIndex("uniq_manager_section_grant").on(t.userId, t.section, t.programId),
}));

// Admin can grant per-section access to specific members (Member Club)
export const memberSectionGrants = pgTable("member_section_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  section: varchar("section", { length: 64 }).notNull(),
  canWrite: boolean("can_write").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqGrant: uniqueIndex("uniq_member_section_grant").on(t.userId, t.section),
}));

/* -------------------- RECRUITMENT PRO -------------------- */
export const recruitmentMetaPrograms = pgTable("recruitment_meta_programs", {
  id: serial("id").primaryKey(),
  programCode: varchar("program_code", { length: 20 }).notNull(),
  programName: varchar("program_name", { length: 160 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_program_code: uniqueIndex("uniq_recruitment_program_code").on(t.programCode),
  idx_program_active: index("idx_recruitment_program_active").on(t.isActive),
}));

export const recruitmentMetaStages = pgTable("recruitment_meta_stages", {
  id: serial("id").primaryKey(),
  stageCode: varchar("stage_code", { length: 20 }).notNull(),
  stageName: varchar("stage_name", { length: 160 }).notNull(),
  description: text("description"),
  stageOrder: integer("stage_order").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_stage_code: uniqueIndex("uniq_recruitment_stage_code").on(t.stageCode),
  idx_stage_order: index("idx_recruitment_stage_order").on(t.stageOrder),
  idx_stage_active: index("idx_recruitment_stage_active").on(t.isActive),
}));

export const recruitmentMetaCountryCodes = pgTable("recruitment_meta_country_codes", {
  id: serial("id").primaryKey(),
  countryName: varchar("country_name", { length: 80 }).notNull(),
  countryCode: varchar("country_code", { length: 12 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_country_code: uniqueIndex("uniq_recruitment_country_code").on(t.countryCode),
  idx_country_active: index("idx_recruitment_country_active").on(t.isActive),
}));

export const recruitmentMetaLocations = pgTable("recruitment_meta_locations", {
  id: serial("id").primaryKey(),
  locationName: varchar("location_name", { length: 160 }).notNull(),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 120 }),
  country: varchar("country", { length: 120 }).default("India").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_location_name: uniqueIndex("uniq_recruitment_location_name").on(t.locationName),
  idx_location_active: index("idx_recruitment_location_active").on(t.isActive),
}));

export const recruitmentCandidates = pgTable("recruitment_candidates", {
  id: serial("id").primaryKey(),
  srNo: integer("sr_no"),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }),
  email: varchar("email", { length: 255 }).notNull(),
  countryCodeId: integer("country_code_id").references(() => recruitmentMetaCountryCodes.id).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  fullPhone: varchar("full_phone", { length: 32 }),
  programId: integer("program_id").references(() => recruitmentMetaPrograms.id).notNull(),
  mspCodeId: integer("msp_code_id").references(() => mspCodes.id),
  requirementId: integer("requirement_id").references(() => recruitmentProgramRequirements.id),
  locationId: integer("location_id").references(() => recruitmentMetaLocations.id).notNull(),
  appliedYear: integer("applied_year"),
  resumeUrl: text("resume_url"),
  candidateStatus: recruitmentCandidateStatusEnum("candidate_status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_sr_no: uniqueIndex("uniq_recruitment_candidate_sr_no").on(t.srNo),
  uniq_email: uniqueIndex("uniq_recruitment_candidate_email").on(t.email),
  uniq_msp_code: uniqueIndex("uniq_recruitment_candidate_msp_code").on(t.mspCodeId),
  idx_phone: index("idx_recruitment_candidate_phone").on(t.phoneNumber),
  idx_program: index("idx_recruitment_candidate_program").on(t.programId),
  idx_requirement: index("idx_recruitment_candidate_requirement").on(t.requirementId),
  idx_status: index("idx_recruitment_candidate_status").on(t.candidateStatus),
}));

export const recruitmentPipelineStages = pgTable("recruitment_pipeline_stages", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => recruitmentCandidates.id).notNull(),
  stageId: integer("stage_id").references(() => recruitmentMetaStages.id).notNull(),
  stageCompleted: boolean("stage_completed").default(false).notNull(),
  completedDate: date("completed_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_candidate_stage: uniqueIndex("uniq_recruitment_candidate_stage").on(t.candidateId, t.stageId),
  idx_candidate: index("idx_recruitment_pipeline_candidate").on(t.candidateId),
  idx_stage: index("idx_recruitment_pipeline_stage").on(t.stageId),
}));

export const recruitmentPipelineFinal = pgTable("recruitment_pipeline_final", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => recruitmentCandidates.id).notNull(),
  finalStatus: recruitmentFinalStatusEnum("final_status").notNull(),
  finalDate: date("final_date").notNull(),
  joiningDate: date("joining_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniq_candidate_final: uniqueIndex("uniq_recruitment_candidate_final").on(t.candidateId),
  idx_final_status: index("idx_recruitment_final_status").on(t.finalStatus),
}));

export const recruitmentCommunicationLog = pgTable("recruitment_communication_log", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => recruitmentCandidates.id).notNull(),
  stageId: integer("stage_id").references(() => recruitmentMetaStages.id),
  communicationDate: date("communication_date").notNull(),
  communicationMethod: recruitmentCommMethodEnum("communication_method").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  outcome: recruitmentCommOutcomeEnum("outcome").notNull(),
  followUpDate: date("follow_up_date"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idx_comm_candidate: index("idx_recruitment_comm_candidate").on(t.candidateId),
  idx_comm_stage: index("idx_recruitment_comm_stage").on(t.stageId),
  idx_comm_date: index("idx_recruitment_comm_date").on(t.communicationDate),
  idx_comm_follow: index("idx_recruitment_comm_follow").on(t.followUpDate),
}));

export const recruitmentProgramRequirements = pgTable("recruitment_program_requirements", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").references(() => recruitmentMetaPrograms.id).notNull(),
  locationId: integer("location_id").references(() => recruitmentMetaLocations.id).notNull(),
  requirementName: text("requirement_name"),
  requiredCount: integer("required_count").notNull(),
  filledCount: integer("filled_count").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idx_requirement_program: index("idx_recruitment_program").on(t.programId),
  idx_requirement_location: index("idx_recruitment_location").on(t.locationId),
}));


// Talent Bench (lead vault)
export const recruitmentBench = pgTable("recruitment_bench", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  location: text("location"),
  appliedFor: text("applied_for"),
  appliedDate: date("applied_date"),
  linkUrl: text("link_url"),
  notes: text("notes"),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idx_phone: index("idx_recruitment_bench_phone").on(t.phone),
  idx_applied_for: index("idx_recruitment_bench_applied_for").on(t.appliedFor),
}));

export const recruitmentBenchPushes = pgTable("recruitment_bench_pushes", {
  id: serial("id").primaryKey(),
  benchId: integer("bench_id").references(() => recruitmentBench.id, { onDelete: "cascade" }).notNull(),
  candidateId: integer("candidate_id").references(() => recruitmentCandidates.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => recruitmentMetaPrograms.id),
  mspCodeId: integer("msp_code_id").references(() => mspCodes.id),
  locationId: integer("location_id").references(() => recruitmentMetaLocations.id),
  requirementId: integer("requirement_id").references(() => recruitmentProgramRequirements.id),
  pushedBy: integer("pushed_by").references(() => users.id),
  pushedAt: timestamp("pushed_at").defaultNow().notNull(),
}, (t) => ({
  idx_bench_push: index("idx_recruitment_bench_push").on(t.benchId, t.programId),
}));

/* -------------------- C. ROUTINE TASKS -------------------- */
export const routineTasks = pgTable("routine_tasks", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routineTaskLogs = pgTable("routine_task_logs", {
  id: serial("id").primaryKey(),
  routineTaskId: integer("routine_task_id").references(() => routineTasks.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routineTaskDailyStatuses = pgTable("routine_task_daily_statuses", {
  id: serial("id").primaryKey(),
  routineTaskId: integer("routine_task_id").references(() => routineTasks.id).notNull(),
  date: timestamp("date").notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  isLocked: boolean("is_locked").default(false).notNull(),
}, (table) => ({
  idx_routine_task_date: index("idx_routine_task_daily_statuses_task_date").on(table.routineTaskId, table.date),
}));

/* -------------------- D. ASSIGNED TASKS -------------------- */
export const assignedTasks = pgTable("assigned_tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  observerId: integer("observer_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  taskType: taskTypeEnum("task_type").default("assigned").notNull(),
  deadline: timestamp("deadline"),
  resources: text("resources"),
}, (table) => ({
  idx_created_by: index("idx_assigned_tasks_created_by").on(table.createdBy),
  idx_observer_id: index("idx_assigned_tasks_observer_id").on(table.observerId),
}));

export const assignedTaskObservers = pgTable("assigned_task_observers", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => assignedTasks.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uq_task_observer: uniqueIndex("uq_assigned_task_observer").on(table.taskId, table.userId),
}));

export const assignedTaskStatus = pgTable("assigned_task_status", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => assignedTasks.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  assignedDate: timestamp("assigned_date").defaultNow().notNull(),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  pinned: boolean("pinned").default(false).notNull(),
  savedForLater: boolean("saved_for_later").default(false).notNull(),
}, (table) => ({
  idx_task_member: index("idx_assigned_task_status_task_member").on(table.taskId, table.memberId),
}));

export const sprints = pgTable("sprints", {
  id: serial("id").primaryKey(),
  taskStatusId: integer("task_status_id").references(() => assignedTaskStatus.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: statusEnum("status").default("not_started").notNull(),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignedTaskLogs = pgTable("assigned_task_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => assignedTasks.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sprintId: integer("sprint_id").references(() => sprints.id, { onDelete: "cascade" }),
}, (table) => ({
  idx_task_id: index("idx_assigned_task_logs_task_id").on(table.taskId),
}));

/* -------------------- E. MESSAGING & LOGS -------------------- */
// Updated messages table
// Updated messages table

// export const messages = pgTable("messages", {
//   id: serial("id").primaryKey(),
//   senderId: integer("sender_id").references(() => users.id).notNull(),
//   recipientId: integer("recipient_id").references(() => users.id).notNull(),
//   content: text("content").notNull(),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
//   status: messageStatusEnum("status").default("sent").notNull(),
// }, (table) => ({
//   idx_sender_recipient: index("idx_messages_sender_recipient").on(table.senderId, table.recipientId),
// }));


export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    recipientId: integer("recipient_id").references(() => users.id).notNull(),
    subject: varchar("subject", { length: 255 }),
    message: text("message"), // Nullable to allow migration
    note: text("note"),
    contact: varchar("contact", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    status: messageStatusEnum("status").default("sent").notNull(),
    messageType: messageTypeEnum("message_type").default("direct").notNull(),
    content: text("content"), // Keep for backward compatibility
  },
  (table) => ({
    idx_sender_recipient: index("idx_messages_sender_recipient").on(table.senderId, table.recipientId),
  })
);

// Non-Meedian messages table (unchanged, already correct)
export const nonMeeDianMessages = pgTable(
  "non_meedian_messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id).notNull(),
    customName: varchar("custom_name", { length: 255 }).notNull(),
    customWhatsappNumber: varchar("custom_whatsapp_number", { length: 15 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    note: text("note"),
    contact: varchar("contact", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    status: messageStatusEnum("status").default("sent").notNull(),
  },
  (table) => ({
    idx_sender: index("idx_non_meedian_messages_sender").on(table.senderId),
  })
);

// NEW: single consolidated table for both existing + custom recipients
export const directWhatsappMessages = pgTable(
  "direct_whatsapp_messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").references(() => users.id).notNull(),

    // "existing" or "custom"
    recipientType: directRecipientTypeEnum("recipient_type").notNull(),

    // If recipientType === "existing"
    recipientUserId: integer("recipient_user_id").references(() => users.id),

    // If recipientType === "custom" (also useful to copy for existing for easier reads)
    recipientName: varchar("recipient_name", { length: 255 }),
    recipientWhatsappNumber: varchar("recipient_whatsapp_number", { length: 15 }),

    // Message content
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    note: text("note"),
    contact: varchar("contact", { length: 255 }).notNull(),

    // Delivery info
    status: messageStatusEnum("status").default("sent").notNull(), // sent | read | failed
    twilioSid: varchar("twilio_sid", { length: 64 }),
    error: text("error"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idx_sender_created: index("idx_dwm_sender_created").on(t.senderId, t.createdAt),
    idx_recipient_user: index("idx_dwm_recipient_user").on(t.recipientUserId),
    idx_recipient_type: index("idx_dwm_recipient_type").on(t.recipientType),
  })
);

export const generalLogs = pgTable("general_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberHistory = pgTable("member_history", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => users.id).notNull(),
  taskType: taskTypeEnum("task_type").notNull(),
  taskId: integer("task_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: statusEnum("status").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------- F. MISC / SYSTEM -------------------- */
export const openCloseTimes = pgTable("open_close_times", {
  id: serial("id").primaryKey(),
  userType: userTypeEnum("user_type").notNull(),
  dayOpenTime: time("day_open_time").notNull(),
  dayCloseTime: time("day_close_time").notNull(),
  closingWindowStart: time("closing_window_start").notNull(),
  closingWindowEnd: time("closing_window_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userOpenCloseTimes = pgTable("user_open_close_times", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  dayOpenedAt: time("day_opened_at").notNull(),
  dayClosedAt: time("day_closed_at"),
  useCustomTimes: boolean("use_custom_times").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Actual per-day open/close history (from scan/close actions)
export const dayOpenCloseHistory = pgTable("day_open_close_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(), // store local day start
  openedAt: time("opened_at"),
  closedAt: time("closed_at"),
  source: varchar("source", { length: 32 }).default("system").notNull(), // scan|manual|system
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberIprScores = pgTable(
  "member_ipr_scores",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    evaluatedFor: date("evaluated_for").notNull(),
    punctuality: integer("punctuality").notNull().default(0),
    academics: integer("academics").notNull().default(0),
    obedienceDiscipline: integer("obedience_discipline").notNull().default(0),
    languagePersonality: integer("language_personality").notNull().default(0),
    willSkill: integer("will_skill").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    evaluatorId: integer("evaluator_id").references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    metricNotes: jsonb("metric_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqUserDate: uniqueIndex("member_ipr_scores_user_date_idx").on(t.userId, t.evaluatedFor),
    idxEvaluator: index("member_ipr_scores_evaluator_idx").on(t.evaluatorId),
  })
);

export const memberAds = pgTable(
  "member_ads",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    category: text("category").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    evidence: text("evidence"),
    evidenceUrl: text("evidence_url"),
    notes: text("notes"),
    points: integer("points").notNull().default(5),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    escalationMatterId: integer("escalation_matter_id").references(() => escalationsMatters.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxMember: index("member_ads_member_idx").on(t.memberId),
    idxCreatedBy: index("member_ads_created_by_idx").on(t.createdBy),
    idxOccurredAt: index("member_ads_occurred_at_idx").on(t.occurredAt),
    idxEscalation: index("member_ads_escalation_idx").on(t.escalationMatterId),
  })
);

export const schoolCalendar = pgTable("school_calendar", {
  id: serial("id").primaryKey(),
  major_term: varchar("major_term", { length: 50 }).notNull(),
  minor_term: varchar("minor_term", { length: 50 }).notNull(),
  start_date: timestamp("start_date").notNull(),
  end_date: timestamp("end_date").notNull(),
  name: weekNameEnum("name").default("General").notNull(),
  week_number: integer("week_number"),
  is_major_term_boundary: boolean("is_major_term_boundary").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  target: announcementTargetEnum("target").notNull(),
  program: announcementProgramEnum("program").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  attachments: text("attachments").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dayCloseRequests = pgTable("day_close_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  mriCleared: boolean("mri_cleared").default(true).notNull(),
  mriReport: jsonb("mri_report"),
  assignedTasksUpdates: jsonb("assigned_tasks_updates"),
  routineTasksUpdates: jsonb("routine_tasks_updates"),
  routineLog: text("routine_log"),
  generalLog: text("general_log"),
  ISRoutineLog: text("is_routine_log"),
  ISGeneralLog: text("is_general_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
}, (table) => ({
  idx_user_date: index("idx_day_close_requests_user_date").on(table.userId, table.date),
}));

export const notCompletedTasks = pgTable("not_completed_tasks", {
  id: serial("id").primaryKey(),
  taskType: taskTypeEnum("task_type").notNull(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userNotes = pgTable("user_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  category: noteCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idx_user_id: index("idx_user_notes_user_id").on(table.userId),
}));

export const userNoteShares = pgTable("user_note_shares", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").references(() => userNotes.id, { onDelete: "cascade" }).notNull(),
  sharedWithUserId: integer("shared_with_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sharedByUserId: integer("shared_by_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uq_note_share: uniqueIndex("idx_user_note_shares_unique").on(table.noteId, table.sharedWithUserId),
  idx_shared_with: index("idx_user_note_shares_shared_with").on(table.sharedWithUserId),
}));

export const userNoteTaskLinks = pgTable("user_note_task_links", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").references(() => userNotes.id, { onDelete: "cascade" }).notNull(),
  taskId: integer("task_id").references(() => assignedTasks.id, { onDelete: "cascade" }).notNull(),
  sourceText: text("source_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uq_note_task: uniqueIndex("idx_user_note_task_links_unique").on(table.noteId, table.taskId),
  idx_task: index("idx_user_note_task_links_task").on(table.taskId),
}));

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(),
  proof: text("proof"),
  transferTo: integer("transfer_to").references(() => users.id),
  status: leaveStatusEnum("leave_status").default("pending").notNull(),
  submittedTo: integer("submitted_to").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvedStartDate: timestamp("approved_start_date"),
  approvedEndDate: timestamp("approved_end_date"),
  decisionNote: text("decision_note"),
  memberMessage: text("member_message"),
  rejectionReason: text("rejection_reason"),
  escalationMatterId: integer("escalation_matter_id").references(() => escalationsMatters.id, { onDelete: "set null" }),
  category: text("category").default("personal"),
  convertToCl: boolean("convert_to_cl").default(false).notNull(),
}, (table) => ({
  idx_user_date: index("idx_leave_requests_user_date").on(table.userId, table.startDate),
}));

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  conversation_sid: text("conversation_sid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const systemFlags = pgTable("system_flags", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: boolean("value").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const routineLogRequiredMembers = pgTable("routine_log_required_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// /* -------------------- G. FINANCE / ACCOUNTING -------------------- */
export const accountingSettings = pgTable("accounting_settings", {
  id: serial("id").primaryKey(),
  singleton: boolean("singleton").default(true).notNull(),
  booksStartDate: timestamp("books_start_date"),
  openingCash: integer("opening_cash").notNull().default(0),
  openingUPI: integer("opening_upi").notNull().default(0),
  openingBank: integer("opening_bank").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  uniqSingleton: uniqueIndex("accounting_settings_singleton_idx").on(t.singleton),
}));

// export const expenses = pgTable("expenses", {
//   id: serial("id").primaryKey(),
//   category: varchar("category", { length: 120 }).notNull(),
//   amount: integer("amount").notNull().default(0),
//   paidBy: paymentMethodEnum("paid_by").notNull().default("cash"),
//   note: text("note"),
//   paidAt: timestamp("paid_at").defaultNow(),
//   createdBy: integer("created_by"),
// }, (t) => ({
//   idxPaidAt: index("expenses_paidat_idx").on(t.paidAt),
//   idxPaidBy: index("expenses_paidby_idx").on(t.paidBy),
// }));

// export const feeReceipts = pgTable("fee_receipts", {
//   id: serial("id").primaryKey(),
//   studentId: integer("student_id").references(() => Students.id, { onDelete: "set null" }),
//   studentName: varchar("student_name", { length: 255 }),
//   className: varchar("class_name", { length: 100 }),
//   monthFor: varchar("month_for", { length: 10 }),
//   amount: integer("amount").notNull().default(0),
//   method: paymentMethodEnum("method").notNull().default("cash"),
//   reference: varchar("reference", { length: 100 }),
//   collectedAt: timestamp("collected_at").defaultNow(),
//   createdBy: integer("created_by"),
// }, (t) => ({
//   idxCollect: index("fee_receipts_collectedat_idx").on(t.collectedAt),
//   idxMethod: index("fee_receipts_method_idx").on(t.method),
// }));

// export const transportFees = pgTable("transport_fees", {
//   id: serial("id").primaryKey(),
//   studentId: integer("student_id").references(() => Students.id, { onDelete: "set null" }),
//   studentName: varchar("student_name", { length: 255 }),
//   className: varchar("class_name", { length: 100 }),
//   monthFor: varchar("month_for", { length: 10 }),
//   amount: integer("amount").notNull().default(0),
//   method: paymentMethodEnum("method").notNull().default("cash"),
//   reference: varchar("reference", { length: 100 }),
//   collectedAt: timestamp("collected_at").defaultNow(),
//   createdBy: integer("created_by"),
// }, (t) => ({
//   idxCollect: index("transport_fees_collectedat_idx").on(t.collectedAt),
// }));

// export const admissionFees = pgTable("admission_fees", {
//   id: serial("id").primaryKey(),
//   studentId: integer("student_id").references(() => Students.id, { onDelete: "set null" }),
//   studentName: varchar("student_name", { length: 255 }),
//   className: varchar("class_name", { length: 100 }),
//   amount: integer("amount").notNull().default(0),
//   method: paymentMethodEnum("method").notNull().default("cash"),
//   reference: varchar("reference", { length: 100 }),
//   collectedAt: timestamp("collected_at").defaultNow(),
//   createdBy: integer("created_by"),
// }, (t) => ({
//   idxCollect: index("admission_fees_collectedat_idx").on(t.collectedAt),
// }));

// export const accountantDaySummaries = pgTable("accountant_day_summaries", {
//   id: serial("id").primaryKey(),
//   userId: integer("user_id").notNull(),
//   date: timestamp("date").notNull(),
//   cash: integer("cash").notNull().default(0),
//   upi: integer("upi").notNull().default(0),
//   bank: integer("bank").notNull().default(0),
//   transport: integer("transport").notNull().default(0),
//   admissions: integer("admissions").notNull().default(0),
//   expenses: integer("expenses").notNull().default(0),
//   openingCash: integer("opening_cash").notNull().default(0),
//   closingCash: integer("closing_cash").notNull().default(0),
//   notes: text("notes"),
//   adjustments: jsonb("adjustments").default(JSON.stringify({ receiptsAdj: 0, expensesAdj: 0, note: "" })),
//   expenseBreakdown: jsonb("expense_breakdown").default(JSON.stringify({})),
//   isLocked: boolean("is_locked").default(false),
//   createdAt: timestamp("created_at").defaultNow(),
//   updatedAt: timestamp("updated_at").defaultNow(),
// }, (t) => ({
//   uniqUserDate: uniqueIndex("accountant_summary_user_date_unique").on(t.userId, t.date),
//   idxDate: index("accountant_summary_date_idx").on(t.date),
// }));

// /* -------------------- H. STUDENT ACCOUNTS & FEES -------------------- */
// export const StudentAccounts = pgTable("student_accounts", {
//   id: serial("id").primaryKey(),
//   studentId: integer("student_id").notNull().references(() => Students.id, { onDelete: "cascade" }).unique(),
//   ledgerNo: varchar("ledger_no", { length: 50 }).notNull().unique(),
//   accountType: varchar("account_type", { length: 20 }).notNull().default("general"),
//   createdAt: timestamp("created_at").defaultNow(),
// });

// export const Fees = pgTable("fees", {
//   id: serial("id").primaryKey(),
//   classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "cascade" }),
//   isHosteller: boolean("is_hosteller").default(false),
//   admissionFee: integer("admission_fee").notNull().default(0),
//   monthlyDayScholarFee: integer("monthly_day_scholar_fee").notNull().default(0),
//   monthlyHostellerFee: integer("monthly_hosteller_fee").notNull().default(0),
//   hostelSupplyFee: jsonb("hostel_supply_fee")
//     .default(JSON.stringify({ total: 0, breakdown: { copy: 0, book: 0, uniform: 0, hostelDress: 0 } })),
//   dayScholarSupplyFee: jsonb("day_scholar_supply_fee")
//     .default(JSON.stringify({ total: 0, breakdown: { copy: 0, book: 0, uniform: 0 } })),
//   transportFee: integer("transport_fee").default(0),
//   otherFees: integer("other_fees").default(0),
//   createdAt: timestamp("created_at").defaultNow(),
// }, (t) => ({
//   uniqClassMode: uniqueIndex("fees_class_mode_unique").on(t.classId, t.isHosteller),
// }));

// export const StudentFees = pgTable("student_fees", {
//   id: serial("id").primaryKey(),
//   studentId: integer("student_id").notNull().references(() => Students.id, { onDelete: "cascade" }),
//   accountId: integer("account_id").notNull().references(() => StudentAccounts.id, { onDelete: "cascade" }),
//   oneTimeFeeDue: integer("one_time_fee_due").default(0),
//   oneTimeFeePaid: integer("one_time_fee_paid").default(0),
//   otherFeesDue: integer("other_fees_due").default(0),
//   otherFeesPaid: integer("other_fees_paid").default(0),
//   monthlyFees: jsonb("monthly_fees").default(JSON.stringify([])),
//   totalPaid: integer("total_paid").default(0),
//   dueAmount: integer("due_amount").default(0),
//   createdAt: timestamp("created_at").defaultNow(),
// }, (t) => ({
//   uniqStudAcc: uniqueIndex("student_fees_student_account_unique").on(t.studentId, t.accountId),
// }));

/* -------------------- MRI ROLES (USER ↔ ROLE MAPPING) -------------------- */
export const userMriRoles = pgTable("user_mri_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqUserRole: uniqueIndex("user_mri_roles_user_role_unique").on(t.userId, t.role),
  idxUser: index("idx_user_mri_roles_user").on(t.userId),
}));

/* -------------------- MRI DEFALTER LOGS (R-MRIs — nmri_modulator v1) -------------------- */
export const mriDefaulterLogs = pgTable(
  "mri_defaulter_logs",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(), // pure date so equality with "YYYY-MM-DD" works
    defaulter_type: defaulterTypeEnum("defaulter_type").notNull(),
    studentId: integer("student_id").notNull().references(() => Students.id, { onDelete: "cascade" }),
    reportedBy: integer("reported_by").notNull().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqDateTypeStudent: uniqueIndex("mri_defaulter_logs_date_type_student_idx").on(
      t.date,
      t.defaulter_type,
      t.studentId
    ),
    idxDate: index("mri_defaulter_logs_date_idx").on(t.date),
  })
);



export const meRightNowSessions = pgTable("me_right_now_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: meRightNowTypeEnum("type").notNull(),                       // assigned | routine | mri
  itemId: text("item_id").notNull(),                                // store as string (works for ints/enums)
  itemTitle: varchar("item_title", { length: 255 }).notNull(),
  note: text("note"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  active: boolean("active").default(true).notNull(),
}, (t) => ({
  idxActive: index("mrr_active_idx").on(t.active),
  idxUserActive: index("mrr_user_active_idx").on(t.userId, t.active),
}));

/* -------------------- META: MRI Families, Programs, Roles -------------------- */
export const mriFamilies = pgTable("mri_families", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // amri | nmri | rmri | omri | custom
  name: varchar("name", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mriPrograms = pgTable("mri_programs", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => mriFamilies.id, { onDelete: "cascade" }),
  programKey: varchar("program_key", { length: 32 }).notNull().unique(), // MSP, MHCP, etc.
  name: varchar("name", { length: 160 }).notNull(),
  scope: varchar("scope", { length: 32 }).notNull().default("both"), // pre_primary | elementary | both
  attendanceCapTime: time("attendance_cap_time"), // optional daily cut-off for on-time attendance
  attendanceMemberIds: integer("attendance_member_ids").array(), // optional explicit roster for attendance expectations
  aims: text("aims"),
  sop: jsonb("sop"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mriReportTemplates = pgTable("mri_report_templates", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").references(() => mriFamilies.id, { onDelete: "set null" }),
  key: varchar("key", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  allowPreSubmit: boolean("allow_pre_submit").notNull().default(true),
  defaultFrequency: varchar("default_frequency", { length: 32 }).notNull().default("daily"),
  defaultDueTime: time("default_due_time"),
  instructions: text("instructions"),
  formSchema: jsonb("form_schema").notNull().default(JSON.stringify({ sections: [] })),
  meta: jsonb("meta").notNull().default(JSON.stringify({})),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqKey: uniqueIndex("mri_report_templates_key_unique").on(t.key),
  idxFamily: index("mri_report_templates_family_idx").on(t.familyId),
}));

export const mriReportAssignments = pgTable("mri_report_assignments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => mriReportTemplates.id, { onDelete: "cascade" }),
  targetType: mriReportTargetEnum("target_type").notNull().default("user"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  roleDefId: integer("role_def_id").references(() => mriRoleDefs.id, { onDelete: "cascade" }),
  programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "cascade" }),
  classId: integer("class_id").references(() => Classes.id, { onDelete: "set null" }),
  role: varchar("role", { length: 50 }), // e.g., 'hostel_authority', 'hostel_incharge', etc.
  targetLabel: varchar("target_label", { length: 160 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  scopeMeta: jsonb("scope_meta").notNull().default(JSON.stringify({})),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxTemplate: index("mri_report_assignments_template_idx").on(t.templateId),
  idxUser: index("mri_report_assignments_user_idx").on(t.userId),
  idxClass: index("mri_report_assignments_class_idx").on(t.classId),
  uniqTemplateUserClass: uniqueIndex("mri_report_assignments_template_user_class_unique").on(t.templateId, t.userId, t.classId),
}));

export const mriReportInstances = pgTable("mri_report_instances", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => mriReportTemplates.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id").notNull().references(() => mriReportAssignments.id, { onDelete: "cascade" }),
  targetDate: date("target_date").notNull(),
  dueAt: timestamp("due_at"),
  status: mriReportStatusEnum("status").notNull().default("pending"),
  payload: jsonb("payload"),
  submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at"),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  waivedBy: integer("waived_by").references(() => users.id, { onDelete: "set null" }),
  waivedAt: timestamp("waived_at"),
  notes: text("notes"),
  confirmationNote: text("confirmation_note"),
  meta: jsonb("meta").notNull().default(JSON.stringify({})),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxTemplateDate: index("mri_report_instances_template_date_idx").on(t.templateId, t.targetDate),
  idxAssignment: index("mri_report_instances_assignment_idx").on(t.assignmentId),
  idxStatus: index("mri_report_instances_status_idx").on(t.status),
  uniqAssignmentDate: uniqueIndex("mri_report_instances_assignment_date_unique").on(t.assignmentId, t.targetDate),
}));

export const mriReportAudits = pgTable("mri_report_audits", {
  id: serial("id").primaryKey(),
  instanceId: integer("instance_id").notNull().references(() => mriReportInstances.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 32 }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxInstance: index("mri_report_audits_instance_idx").on(t.instanceId),
}));

export const campusGateStaffLogs = pgTable("campus_gate_staff_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  direction: varchar("direction", { length: 8 }).notNull(),
  purpose: text("purpose"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (t) => ({
  idxUser: index("campus_gate_staff_logs_user_idx").on(t.userId),
  idxRecorded: index("campus_gate_staff_logs_recorded_idx").on(t.recordedAt),
}));

export const guardianGateLogs = pgTable("guardian_gate_logs", {
  id: serial("id").primaryKey(),
  visitDate: date("visit_date").notNull(),
  guardianName: text("guardian_name").notNull(),
  isProxy: boolean("is_proxy").default(false),
  proxyName: text("proxy_name"),
  proxyRelation: text("proxy_relation"),
  studentName: text("student_name").notNull(),
  className: varchar("class_name", { length: 80 }),
  purpose: text("purpose"),
  purposeNote: text("purpose_note"),
  tokenNumber: integer("token_number"),
  queueStatus: varchar("queue_status", { length: 16 }),
  calledAt: timestamp("called_at"),
  servedAt: timestamp("served_at"),
  feesSubmitted: boolean("fees_submitted").default(false),
  satisfactionIslamic: integer("satisfaction_islamic"),
  satisfactionAcademic: integer("satisfaction_academic"),
  inAt: timestamp("in_at"),
  outAt: timestamp("out_at"),
  signature: varchar("signature", { length: 160 }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxDate: index("guardian_gate_logs_date_idx").on(t.visitDate),
  idxToken: index("guardian_gate_logs_token_idx").on(t.visitDate, t.tokenNumber),
  idxQueue: index("guardian_gate_logs_queue_idx").on(t.visitDate, t.queueStatus),
}));

export const visitorGateLogs = pgTable("visitor_gate_logs", {
  id: serial("id").primaryKey(),
  visitDate: date("visit_date").notNull(),
  visitorName: text("visitor_name").notNull(),
  visitorPhone: varchar("visitor_phone", { length: 32 }),
  visitingReason: text("visiting_reason").notNull(),
  inAt: timestamp("in_at"),
  outAt: timestamp("out_at"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxDate: index("visitor_gate_logs_date_idx").on(t.visitDate),
}));

export const guardianCallReports = pgTable("guardian_call_reports", {
  id: serial("id").primaryKey(),
  callDate: date("call_date").notNull(),
  classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "restrict" }),
  studentId: integer("student_id").notNull().references(() => Students.id, { onDelete: "restrict" }),
  programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: varchar("guardian_phone", { length: 32 }),
  report: text("report").notNull(),
  followUpNeeded: boolean("follow_up_needed").default(false).notNull(),
  followUpDate: date("follow_up_date"),
  campaignAssignmentId: integer("campaign_assignment_id").references(() => mriReportAssignments.id, { onDelete: "set null" }),
  calledById: integer("called_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxCallDate: index("guardian_call_reports_call_date_idx").on(t.callDate),
  idxClass: index("guardian_call_reports_class_idx").on(t.classId),
  idxStudent: index("guardian_call_reports_student_idx").on(t.studentId),
  idxFollowUp: index("guardian_call_reports_follow_up_idx").on(t.followUpNeeded, t.followUpDate),
  idxCampaign: index("guardian_call_reports_campaign_idx").on(t.campaignAssignmentId),
}));

/* -------------------- MGCP (Guardian Care Program) -------------------- */
export const mgcpHeads = pgTable("mgcp_heads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  active: boolean("active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqUser: uniqueIndex("mgcp_heads_user_unique").on(t.userId),
}));

export const mgcpBelts = pgTable("mgcp_belts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxName: index("mgcp_belts_name_idx").on(t.name),
}));

export const mgcpVillages = pgTable("mgcp_villages", {
  id: serial("id").primaryKey(),
  beltId: integer("belt_id").notNull().references(() => mgcpBelts.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxBelt: index("mgcp_villages_belt_idx").on(t.beltId),
  uniqBeltName: uniqueIndex("mgcp_villages_belt_name_unique").on(t.beltId, t.name),
}));

export const mgcpLeadManagers = pgTable("mgcp_lead_managers", {
  id: serial("id").primaryKey(),
  beltId: integer("belt_id").notNull().references(() => mgcpBelts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 32 }),
  whatsapp: varchar("whatsapp", { length: 32 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxBelt: index("mgcp_lead_managers_belt_idx").on(t.beltId),
}));

export const mgcpBeltGuardians = pgTable("mgcp_belt_guardians", {
  id: serial("id").primaryKey(),
  beltId: integer("belt_id").notNull().references(() => mgcpBelts.id, { onDelete: "cascade" }),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: varchar("guardian_phone", { length: 32 }),
  guardianWhatsapp: varchar("guardian_whatsapp", { length: 32 }),
  studentId: integer("student_id").references(() => Students.id, { onDelete: "set null" }),
  isTrusted: boolean("is_trusted").default(false).notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxBelt: index("mgcp_belt_guardians_belt_idx").on(t.beltId),
  idxStudent: index("mgcp_belt_guardians_student_idx").on(t.studentId),
}));

export const mgcpLeads = pgTable("mgcp_leads", {
  id: serial("id").primaryKey(),
  beltId: integer("belt_id").references(() => mgcpBelts.id, { onDelete: "set null" }),
  guardianId: integer("guardian_id").references(() => enrollmentGuardians.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 32 }),
  whatsapp: varchar("whatsapp", { length: 32 }),
  location: text("location"),
  source: text("source"),
  notes: text("notes"),
  category: varchar("category", { length: 64 }).default("MGCP Lead").notNull(),
  status: varchar("status", { length: 24 }).default("new").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxBelt: index("mgcp_leads_belt_idx").on(t.beltId),
  idxGuardian: index("mgcp_leads_guardian_idx").on(t.guardianId),
  idxStatus: index("mgcp_leads_status_idx").on(t.status),
}));

/* -------------------- Support Tickets -------------------- */
export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
    createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedToId: integer("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    queue: ticketQueueEnum("queue").notNull().default("operations"),
    category: varchar("category", { length: 120 }).notNull(),
    subcategory: varchar("subcategory", { length: 120 }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    status: ticketStatusEnum("status").notNull().default("open"),
    escalated: boolean("escalated").notNull().default(false),
    slaFirstResponseAt: timestamp("sla_first_response_at"),
    slaResolveBy: timestamp("sla_resolve_by"),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    closedAt: timestamp("closed_at"),
    reopenedAt: timestamp("reopened_at"),
    lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
    attachments: jsonb("attachments").notNull().default(JSON.stringify([])),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    idxTicketsCreator: index("tickets_creator_idx").on(t.createdById),
    idxTicketsAssignee: index("tickets_assignee_idx").on(t.assignedToId),
    idxTicketsStatus: index("tickets_status_idx").on(t.status),
    idxTicketsQueue: index("tickets_queue_idx").on(t.queue),
    idxTicketsPriority: index("tickets_priority_idx").on(t.priority),
  })
);

export const ticketActivities = pgTable(
  "ticket_activities",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    type: ticketActivityTypeEnum("type").notNull().default("comment"),
    message: text("message"),
    fromStatus: ticketStatusEnum("from_status"),
    toStatus: ticketStatusEnum("to_status"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    idxTicketActivitiesTicket: index("ticket_activities_ticket_idx").on(t.ticketId),
    idxTicketActivitiesAuthor: index("ticket_activities_author_idx").on(t.authorId),
    idxTicketActivitiesType: index("ticket_activities_type_idx").on(t.type),
  })
);

/* -------------------- MANAGERIAL: ESCALATIONS -------------------- */
export const escalationsMatters = pgTable("escalations_matters", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  createdById: integer("created_by_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentAssigneeId: integer("current_assignee_id").references(() => users.id, { onDelete: "set null" }),
  suggestedLevel2Id: integer("suggested_level2_id").references(() => users.id, { onDelete: "set null" }),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  status: escalationStatusEnum("status").notNull().default("OPEN"),
  level: integer("level").notNull().default(1), // 1|2
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idxAssignee: index("esc_matters_assignee_idx").on(t.currentAssigneeId),
  idxCreator: index("esc_matters_creator_idx").on(t.createdById),
  idxStatus: index("esc_matters_status_idx").on(t.status),
  idxTicket: index("esc_matters_ticket_idx").on(t.ticketId),
}));

export const escalationsMatterMembers = pgTable("escalations_matter_members", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => escalationsMatters.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqMatterUser: uniqueIndex("esc_matter_members_unique").on(t.matterId, t.userId),
  idxUser: index("esc_matter_members_user_idx").on(t.userId),
}));

export const escalationsSteps = pgTable("escalations_steps", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => escalationsMatters.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  action: escalationActionEnum("action").notNull(),
  fromUserId: integer("from_user_id").references(() => users.id, { onDelete: "set null" }),
  toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxMatter: index("esc_steps_matter_idx").on(t.matterId),
}));

// Escalation matter students (optional participants from students table)
export const escalationsMatterStudents = pgTable("escalations_matter_students", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id").notNull().references(() => escalationsMatters.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqMatterStudent: uniqueIndex("esc_matter_students_unique").on(t.matterId, t.studentId),
  idxStudent: index("esc_matter_students_student_idx").on(t.studentId),
}));

export const dayCloseOverrides = pgTable("day_close_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  matterId: integer("matter_id").references(() => escalationsMatters.id, { onDelete: "set null" }),
  reason: text("reason"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
}, (t) => ({
  idxOverrideUser: index("day_close_overrides_user_idx").on(t.userId),
}));

export const mriRoleDefs = pgTable("mri_role_defs", {
  id: serial("id").primaryKey(),
  roleKey: varchar("role_key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  // category of role: amri | rmri | nmri
  category: varchar("category", { length: 16 }).notNull().default("rmri"),
  subCategory: varchar("sub_category", { length: 64 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------- MRI DEFALTER LOGS (R-MRIs — nmri_modulator v1) -------------------- */
export const mriRoleTasks = pgTable(
  "mri_role_tasks",
  {
    id: serial("id").primaryKey(),
    roleDefId: integer("role_def_id").notNull().references(() => mriRoleDefs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    submissables: text("submissables"), // New field
    action: varchar("action", { length: 255 }), // New field
    executionMode: varchar("execution_mode", { length: 32 }).notNull().default("standard"),
    attendanceTarget: varchar("attendance_target", { length: 32 }).default("members"),
    attendanceProgramKey: varchar("attendance_program_key", { length: 32 }),
    attendanceProgramId: integer("attendance_program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
    attendanceTrack: varchar("attendance_track", { length: 32 }),
    // Time sensitivity (optional execution constraints)
    timeSensitive: boolean("time_sensitive").default(false).notNull(),
    execAt: timestamp("exec_at"), // exact timestamp
    windowStart: timestamp("window_start"), // window start
    windowEnd: timestamp("window_end"), // window end
    recurrence: varchar("recurrence", { length: 16 }), // daily | weekly | monthly | null
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxRole: index("mri_role_tasks_role_idx").on(t.roleDefId),
    uqRoleTitle: uniqueIndex("mri_role_tasks_role_title_uniq").on(t.roleDefId, t.title),
  })
);

/* -------------------- Resource Management -------------------- */
export const resourceCategories = pgTable("resource_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  parentId: integer("parent_id").references(() => resourceCategories.id, { onDelete: "set null" }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxName: index("resource_categories_name_idx").on(t.name),
  idxParent: index("resource_categories_parent_idx").on(t.parentId),
}));

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  assetTag: varchar("asset_tag", { length: 64 }).unique(),
  categoryId: integer("category_id").references(() => resourceCategories.id, { onDelete: "set null" }),
  type: varchar("type", { length: 120 }),
  serialNo: varchar("serial_no", { length: 160 }),
  vendor: varchar("vendor", { length: 160 }),
  purchaseDate: timestamp("purchase_date"),
  warrantyEnd: timestamp("warranty_end"),
  cost: integer("cost"),
  building: varchar("building", { length: 120 }),
  room: varchar("room", { length: 120 }),
  status: resourceStatusEnum("status").default("available").notNull(),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  tags: jsonb("tags").default(JSON.stringify([])),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxStatus: index("resources_status_idx").on(t.status),
  idxCategory: index("resources_category_idx").on(t.categoryId),
  idxLocation: index("resources_location_idx").on(t.building, t.room),
  idxAssigned: index("resources_assigned_idx").on(t.assignedTo),
}));

export const resourceLogs = pgTable("resource_logs", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").references(() => resources.id, { onDelete: "cascade" }).notNull(),
  kind: resourceLogKindEnum("kind").notNull(),
  byUserId: integer("by_user_id").references(() => users.id, { onDelete: "set null" }),
  toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxResKind: index("resource_logs_res_kind_idx").on(t.resourceId, t.kind),
}));

export const resourceAttachments = pgTable("resource_attachments", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").references(() => resources.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }),
  url: text("url").notNull(),
  mimeType: varchar("mime_type", { length: 120 }),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxRes: index("resource_attachments_res_idx").on(t.resourceId),
}));

/* -------------------- Notifications -------------------- */
export const notificationTypeEnum = pgEnum("notification_type", [
  "chat_message",
  "task_update",
  "task_ready_for_verification",
  "task_verified",
  "repo_submitted",
  "community_post",
  "community_comment",
  "community_like",
]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body"),
  entityKind: varchar("entity_kind", { length: 64 }),
  entityId: integer("entity_id"),
  meta: jsonb("meta").default(JSON.stringify({})),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxUserCreated: index("notifications_user_created_idx").on(t.userId, t.createdAt),
  idxUserRead: index("notifications_user_read_idx").on(t.userId, t.read),
}));

/* -------------------- Program Schedules (Periods + Matrix) -------------------- */
// Period grid per program + track (e.g., MSP + elementary -> P1..P8 times)
export const programPeriods = pgTable(
  "program_periods",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    track: varchar("track", { length: 32 }).notNull().default("both"), // pre_primary | elementary | both
    periodKey: varchar("period_key", { length: 16 }).notNull(), // P1..P8, PCC1, PCC2
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("program_periods_unique").on(t.programId, t.track, t.periodKey),
    idxProgram: index("program_periods_program_idx").on(t.programId),
  })
);

// Matrix: class × period -> { msp_code, subject }
export const programScheduleCells = pgTable(
  "program_schedule_cells",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    track: varchar("track", { length: 32 }).notNull().default("both"),
    classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "restrict" }),
    periodKey: varchar("period_key", { length: 16 }).notNull(),
    mspCodeId: integer("msp_code_id").references(() => mspCodes.id, { onDelete: "set null" }), // null => leisure/empty
    subject: varchar("subject", { length: 160 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqCell: uniqueIndex("program_schedule_cell_unique").on(t.programId, t.track, t.classId, t.periodKey),
    idxProgram: index("program_schedule_program_idx").on(t.programId),
    idxClass: index("program_schedule_class_idx").on(t.classId),
  })
);

// Weekly day-wise overlay: class × day × period -> { msp_code, subject }
export const programScheduleDays = pgTable(
  "program_schedule_days",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    track: varchar("track", { length: 32 }).notNull().default("both"), // pre_primary | elementary | both
    classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "restrict" }),
    dayName: varchar("day_name", { length: 16 }).notNull(), // Mon..Sat
    periodKey: varchar("period_key", { length: 16 }).notNull(), // P1..P8
    mspCodeId: integer("msp_code_id").references(() => mspCodes.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 160 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqDayCell: uniqueIndex("program_schedule_day_unique").on(
      t.programId,
      t.track,
      t.classId,
      t.dayName,
      t.periodKey
    ),
    idxProgramDay: index("program_schedule_day_program_idx").on(t.programId, t.dayName),
    idxClassDay: index("program_schedule_day_class_idx").on(t.classId, t.dayName),
  })
);

/* -------------------- Meed Schedules -------------------- */
export const meedSchedules = pgTable(
  "meed_schedules",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgram: index("meed_schedules_program_idx").on(t.programId),
  })
);

export const meedScheduleDivisions = pgTable(
  "meed_schedule_divisions",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id").notNull().references(() => meedSchedules.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 160 }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    isFree: boolean("is_free").notNull().default(false),
    position: integer("position").default(0),
    checklist: jsonb("checklist").default(JSON.stringify([])),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxSchedule: index("meed_schedule_divisions_schedule_idx").on(t.scheduleId),
  })
);

/* -------------------- Program Aims/Goals -------------------- */
export const programGoals = pgTable(
  "program_goals",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgram: index("program_goals_program_idx").on(t.programId),
  })
);

/* -------------------- Program Trackers -------------------- */
export const programTrackers = pgTable(
  "program_trackers",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    trackerKey: varchar("tracker_key", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    fields: jsonb("fields"), // JSON schema for the tracker form
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqKey: uniqueIndex("program_trackers_key_unique").on(t.programId, t.trackerKey),
    idxProgram: index("program_trackers_program_idx").on(t.programId),
  })
);

export const programTrackerEntries = pgTable(
  "program_tracker_entries",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    trackerId: integer("tracker_id").notNull().references(() => programTrackers.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id), // who submitted
    date: timestamp("date").defaultNow().notNull(),
    data: jsonb("data"), // submitted payload per fields schema
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgram: index("program_tracker_entries_program_idx").on(t.programId),
    idxTracker: index("program_tracker_entries_tracker_idx").on(t.trackerId),
    idxUser: index("program_tracker_entries_user_idx").on(t.userId),
  })
);

/* -------------------- Program Evaluators -------------------- */
export const programEvaluatorRoles = pgTable(
  "program_evaluator_roles",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    roleKey: varchar("role_key", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqGrant: uniqueIndex("program_evaluator_roles_unique").on(t.programId, t.roleKey),
    idxProgram: index("program_evaluator_roles_program_idx").on(t.programId),
  })
);

export const programEvaluationRubrics = pgTable(
  "program_evaluation_rubrics",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    metrics: jsonb("metrics"), // [{ key, label, weight, scale }]
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgram: index("program_eval_rubrics_program_idx").on(t.programId),
  })
);

export const programEvaluations = pgTable(
  "program_evaluations",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id").notNull().references(() => mriPrograms.id, { onDelete: "cascade" }),
    rubricId: integer("rubric_id").references(() => programEvaluationRubrics.id, { onDelete: "set null" }),
    evaluatorId: integer("evaluator_id").references(() => users.id, { onDelete: "set null" }),
    subjectType: varchar("subject_type", { length: 16 }).notNull().default("user"), // user | class | msprole
    subjectId: text("subject_id").notNull(), // flexible FK by type
    date: timestamp("date").defaultNow().notNull(),
    scores: jsonb("scores"), // { metricKey: score }
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgram: index("program_evals_program_idx").on(t.programId),
    idxEvaluator: index("program_evals_evaluator_idx").on(t.evaluatorId),
  })
);

/* -------------------- CLASS ↔ PARENT TEACHER -------------------- */
export const classParentTeachers = pgTable("class_parent_teachers", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => Classes.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxClass: index("cpt_class_idx").on(t.classId),
  idxUser: index("cpt_user_idx").on(t.userId),
  uniqSpan: uniqueIndex("cpt_unique_span").on(t.classId, t.userId, t.startDate),
}));

/* -------------------- MSP ROLES (Program staffing seats) -------------------- */
export const mspCodes = pgTable("msp_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // e.g., EMS1, ESLC2, PGL3
  program: varchar("program", { length: 32 }).notNull().default("MSP"), // MSP (future: MHCP, etc.)
  familyKey: varchar("family_key", { length: 32 }).notNull(), // EMS | ESLC | EUA | EHO | PGL | PRL
  track: varchar("track", { length: 32 }).notNull(), // pre_primary | elementary | both
  title: varchar("title", { length: 160 }).notNull(),
  parentSlice: varchar("parent_slice", { length: 32 }), // optional visible slice label
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxFamily: index("msp_codes_family_idx").on(t.familyKey),
  idxTrack: index("msp_codes_track_idx").on(t.track),
}));

export const mspCodeFamilies = pgTable("msp_code_families", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idx_family_active: index("msp_code_families_active_idx").on(t.active),
}));

export const mspCodeAssignments = pgTable("msp_code_assignments", {
  id: serial("id").primaryKey(),
  mspCodeId: integer("msp_code_id").notNull().references(() => mspCodes.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isPrimary: boolean("is_primary").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxRole: index("msp_code_assignments_role_idx").on(t.mspCodeId),
  idxUser: index("msp_code_assignments_user_idx").on(t.userId),
}));

/* -------------------- MEED REPO (User-submitted posts for verification/archive) -------------------- */
export const meedRepoStatusEnum = pgEnum("meed_repo_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "archived",
]);

export const meedRepoClusterVisibilityEnum = pgEnum("meed_repo_cluster_visibility", [
  "admins_only",
  "managers_only",
  "admins_and_managers",
  "everyone",
]);

export const meedRepoPosts = pgTable("meed_repo_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => assignedTasks.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  tags: jsonb("tags").default(JSON.stringify([])),
  status: meedRepoStatusEnum("status").notNull().default("submitted"),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxUser: index("meed_repo_posts_user_idx").on(t.userId),
  idxStatus: index("meed_repo_posts_status_idx").on(t.status),
}));

export const meedRepoAttachments = pgTable("meed_repo_attachments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => meedRepoPosts.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  url: text("url").notNull(),
  mimeType: varchar("mime_type", { length: 160 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxPost: index("meed_repo_attachments_post_idx").on(t.postId),
}));

export const meedRepoClusters = pgTable("meed_repo_clusters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  visibility: meedRepoClusterVisibilityEnum("visibility").notNull().default("admins_and_managers"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxVisibility: index("meed_repo_clusters_visibility_idx").on(t.visibility),
}));

export const meedRepoClusterItems = pgTable("meed_repo_cluster_items", {
  id: serial("id").primaryKey(),
  clusterId: integer("cluster_id").notNull().references(() => meedRepoClusters.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => meedRepoPosts.id, { onDelete: "cascade" }),
  position: integer("position").default(0).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (t) => ({
  idxCluster: index("meed_repo_cluster_items_cluster_idx").on(t.clusterId),
  uniquePost: uniqueIndex("meed_repo_cluster_items_post_unique").on(t.postId),
}));

/* -------------------- MEED COMMUNITY (School-wide social feed) -------------------- */
export const meedCommunityPosts = pgTable("meed_community_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  idxUser: index("meed_community_posts_user_idx").on(t.userId),
  idxCreated: index("meed_community_posts_created_idx").on(t.createdAt),
}));

export const meedCommunityAttachments = pgTable("meed_community_attachments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => meedCommunityPosts.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  url: text("url").notNull(),
  mimeType: varchar("mime_type", { length: 160 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxPost: index("meed_community_attachments_post_idx").on(t.postId),
}));

export const meedCommunityReactions = pgTable("meed_community_reactions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => meedCommunityPosts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 16 }).notNull().default("like"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqReact: uniqueIndex("meed_community_react_unique").on(t.postId, t.userId, t.type),
  idxPost: index("meed_community_react_post_idx").on(t.postId),
}));

export const meedCommunityComments = pgTable("meed_community_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => meedCommunityPosts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxPost: index("meed_community_comments_post_idx").on(t.postId),
}));

export const mriProgramRoles = pgTable("mri_program_roles", {
  id: serial("id").primaryKey(),
  roleName: varchar("role_name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* -------------------- SAVED SCHEDULE SEEDS -------------------- */
/* -------------------- Attendance (QR/Biometric) -------------------- */
export const scannerSessions = pgTable("scanner_sessions", {
  id: serial("id").primaryKey(),
  programKey: varchar("program_key", { length: 32 }).notNull(),
  track: varchar("track", { length: 32 }),
  programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
  target: varchar("target", { length: 32 }).default("members"),
  roleKey: varchar("role_key", { length: 64 }),
  startedBy: integer("started_by").references(() => users.id, { onDelete: "set null" }),
  nonce: varchar("nonce", { length: 64 }).notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendanceEvents = pgTable("attendance_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => scannerSessions.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  source: attendanceSourceEnum("source").default("qr").notNull(),
  clientIp: varchar("client_ip", { length: 64 }),
  wifiSsid: varchar("wifi_ssid", { length: 64 }),
  deviceFp: varchar("device_fp", { length: 128 }),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqSessionUser: uniqueIndex("attendance_events_session_user_unique").on(t.sessionId, t.userId),
  idxUserAt: index("attendance_events_user_at_idx").on(t.userId, t.at),
}));

// Finalized attendance (per session/day)
export const finalDailyAttendance = pgTable("final_daily_attendance", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => scannerSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }),
  at: timestamp("at", { withTimezone: true }),
  isLate: boolean("is_late").notNull().default(false),
  date: date("date").notNull(),
  programKey: varchar("program_key", { length: 16 }),
  track: varchar("track", { length: 32 }),
  programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
  target: varchar("target", { length: 32 }).default("members"),
  roleKey: varchar("role_key", { length: 64 }),
}, (t) => ({
  uniqSessionUser: uniqueIndex("final_attendance_session_user_unique").on(t.sessionId, t.userId),
}));

export const finalDailyAbsentees = pgTable("final_daily_absentees", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => scannerSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }),
  date: date("date").notNull(),
  programKey: varchar("program_key", { length: 16 }),
  track: varchar("track", { length: 32 }),
  programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "set null" }),
  target: varchar("target", { length: 32 }).default("members"),
  roleKey: varchar("role_key", { length: 64 }),
}, (t) => ({
  uniqAbsSessionUser: uniqueIndex("final_absentees_session_user_unique").on(t.sessionId, t.userId),
}));

export const savedSeeds = pgTable(
  "saved_seeds",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(), // Name/label for the seed
    description: text("description"),
    programId: integer("program_id").references(() => mriPrograms.id, { onDelete: "cascade" }),
    track: varchar("track", { length: 32 }), // pre_primary | elementary | both
    classId: integer("class_id").references(() => Classes.id, { onDelete: "set null" }),
    dayName: varchar("day_name", { length: 16 }), // Mon..Sat, or null for all days
    data: jsonb("data").notNull(), // The actual seed data (schedule matrix, etc.)
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxProgramDay: index("saved_seeds_program_day_idx").on(t.programId, t.dayName),
    idxClassDay: index("saved_seeds_class_day_idx").on(t.classId, t.dayName),
  })
);

/* -------------------- Academic Health Reports -------------------- */
export const academicHealthReports = pgTable(
  "academic_health_reports",
  {
    id: serial("id").primaryKey(),
    reportDate: timestamp("report_date", { withTimezone: false }).notNull(),
    siteId: integer("site_id").notNull(),
    assignedToUserId: integer("assigned_to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 24 }).notNull().default("DRAFT"),
    mop2CheckinId: integer("mop2_checkin_id"),
    mop2CheckinTime: timestamp("mop2_checkin_time", { withTimezone: false }),
    attendanceConfirmed: boolean("attendance_confirmed").notNull().default(false),
    maghribSalahLedById: integer("maghrib_salah_led_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    slot12TransitionQuality: ahrTransitionEnum("slot12_transition_quality").notNull(),
    slot12NmriModerated: boolean("slot12_nmri_moderated").notNull().default(true),
    slot12Ads: text("slot12_ads"),
    mhcp2PresentCount: integer("mhcp2_present_count").notNull().default(0),
    mhcp2AllTeachersPresent: boolean("mhcp2_all_teachers_present").notNull().default(true),
    mhcp2AbsentTeacherIds: jsonb("mhcp2_absent_teacher_ids").default(JSON.stringify([])),
    mhcp2Substitutions: jsonb("mhcp2_substitutions").default(JSON.stringify([])),
    mhcp2FocusToday: varchar("mhcp2_focus_today", { length: 200 }).notNull(),
    mhcp2Discrepancies: text("mhcp2_discrepancies"),
    section1Comment: text("section1_comment"),
    checkMode: ahrCheckModeEnum("check_mode").notNull(),
    escalationsHandledIds: jsonb("escalations_handled_ids").default(JSON.stringify([])),
    selfDayClose: boolean("self_day_close").notNull().default(false),
    finalRemarks: text("final_remarks"),
    signatureName: varchar("signature_name", { length: 120 }),
    signatureBlobPath: varchar("signature_blob_path", { length: 255 }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    idxReportAssignment: index("ahr_report_assignment_idx").on(t.reportDate, t.assignedToUserId),
    idxSiteDate: index("ahr_site_date_idx").on(t.siteId, t.reportDate),
  })
);

export const ahrCopyChecks = pgTable(
  "ahr_copy_checks",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => Students.id, { onDelete: "cascade" }),
    copyTypes: jsonb("copy_types").notNull().default(JSON.stringify([])),
    adFlag: boolean("ad_flag").notNull().default(false),
    note: text("note"),
  },
  (t) => ({
    idxAhrStudent: index("ahr_copy_checks_ahr_student_idx").on(t.ahrId, t.studentId),
  })
);

export const ahrClassDiaryChecks = pgTable(
  "ahr_class_diary_checks",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    classId: integer("class_id")
      .notNull()
      .references(() => Classes.id, { onDelete: "cascade" }),
    diaryType: ahrDiaryTypeEnum("diary_type").notNull(),
    adFlag: boolean("ad_flag").notNull().default(false),
    note: text("note"),
  },
  (t) => ({
    idxAhrClass: index("ahr_class_diary_checks_ahr_class_idx").on(t.ahrId, t.classId),
  })
);

export const ahrMorningCoaching = pgTable(
  "ahr_morning_coaching",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    absentees: jsonb("absentees").default(JSON.stringify([])),
    state: text("state"),
  },
  (t) => ({
    idxAhr: index("ahr_morning_coaching_ahr_idx").on(t.ahrId),
  })
);

export const ahrEscalationDetails = pgTable(
  "ahr_escalation_details",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    escalationId: integer("escalation_id").notNull(),
    actionTaken: text("action_taken"),
    outcome: text("outcome"),
    status: ahrEscalationStatusEnum("status").notNull(),
  },
  (t) => ({
    idxAhrEscalation: index("ahr_escalation_details_ahr_escalation_idx").on(t.ahrId, t.escalationId),
  })
);

export const ahrDefaulters = pgTable(
  "ahr_defaulters",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => Students.id, { onDelete: "cascade" }),
    defaulterType: defaulterTypeEnum("defaulter_type").notNull(),
    reason: text("reason"),
  },
  (t) => ({
    idxAhrStudent: index("ahr_defaulters_ahr_student_idx").on(t.ahrId, t.studentId),
    idxAhrType: index("ahr_defaulters_ahr_type_idx").on(t.ahrId, t.defaulterType),
  })
);

export const ahrActionsByCategory = pgTable(
  "ahr_actions_by_category",
  {
    id: serial("id").primaryKey(),
    ahrId: integer("ahr_id")
      .notNull()
      .references(() => academicHealthReports.id, { onDelete: "cascade" }),
    category: defaulterTypeEnum("category").notNull(),
    actions: jsonb("actions").notNull().default(JSON.stringify([])),
  },
  (t) => ({
    idxAhrCategory: index("ahr_actions_category_idx").on(t.ahrId, t.category),
  })
);

/* -------------------- HOSTEL DAILY DUE REPORTS -------------------- */
export const hostelDailyDueReports = pgTable(
  "hostel_daily_due_reports",
  {
    id: serial("id").primaryKey(),
    reportDate: date("report_date").notNull(),
    hostelInchargeId: integer("hostel_incharge_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entries: jsonb("entries").notNull().default(JSON.stringify([])),
    submittedBy: integer("submitted_by").notNull().references(() => users.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    approvedBy: integer("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    idxReportDate: index("hostel_daily_due_reports_date_idx").on(t.reportDate),
    idxHostelIncharge: index("hostel_daily_due_reports_incharge_idx").on(t.hostelInchargeId),
    idxStatus: index("hostel_daily_due_reports_status_idx").on(t.status),
    uniqInchargeDate: uniqueIndex("hostel_daily_due_reports_incharge_date_unique").on(t.hostelInchargeId, t.reportDate),
  })
);

/* -------------------- ENROLLMENT (GUARDIAN RELATIONSHIPS) -------------------- */
export const enrollmentGuardians = pgTable(
  "guardians",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
    email: text("email"),
    location: text("location").notNull(),
    address: text("address"),
    interests: jsonb("interests")
      .notNull()
      .default(
        JSON.stringify({
          islamic_education_priority: "medium",
          academic_excellence_priority: "medium",
          boarding_interest: "maybe",
        })
      ),
    engagementScore: integer("engagement_score").default(0),
    status: text("status").default("new_lead"),
    lastContact: timestamp("last_contact").defaultNow(),
    preferredContactTime: text("preferred_contact_time"),
    preferredLanguage: text("preferred_language").default("hindi"),
    notes: text("notes"),
    source: text("source"),
    assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    idxStatus: index("guardians_status_idx").on(t.status),
    idxLocation: index("guardians_location_idx").on(t.location),
    idxLastContact: index("guardians_last_contact_idx").on(t.lastContact),
    idxAssignedTo: index("guardians_assigned_to_idx").on(t.assignedTo),
    uniqWhatsapp: uniqueIndex("guardians_whatsapp_unique").on(t.whatsapp),
  })
);

export const enrollmentGuardianChildren = pgTable(
  "guardian_children",
  {
    id: serial("id").primaryKey(),
    guardianId: integer("guardian_id")
      .notNull()
      .references(() => enrollmentGuardians.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    age: integer("age"),
    gender: text("gender"),
    currentSchool: text("current_school"),
    grade: text("grade"),
    academicPerformance: text("academic_performance"),
    specialInterests: text("special_interests"),
    interestedGrade: text("interested_grade"),
    boardingPreference: boolean("boarding_preference").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxGuardian: index("guardian_children_guardian_idx").on(t.guardianId),
  })
);

export const enrollmentGuardianInteractions = pgTable(
  "guardian_interactions",
  {
    id: serial("id").primaryKey(),
    guardianId: integer("guardian_id")
      .notNull()
      .references(() => enrollmentGuardians.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    method: text("method"),
    duration: text("duration"),
    subject: text("subject"),
    content: text("content"),
    outcome: text("outcome"),
    followUpRequired: boolean("follow_up_required").default(false),
    followUpDate: timestamp("follow_up_date"),
    followUpNotes: text("follow_up_notes"),
    conductedBy: integer("conducted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    whatsappMessageId: text("whatsapp_message_id"),
    whatsappStatus: text("whatsapp_status"),
    meetingLocation: text("meeting_location"),
    attendees: jsonb("attendees").default(JSON.stringify([])),
  },
  (t) => ({
    idxGuardian: index("guardian_interactions_guardian_idx").on(t.guardianId),
    idxCreatedAt: index("guardian_interactions_created_at_idx").on(t.createdAt),
    idxFollowUp: index("guardian_interactions_follow_up_idx").on(t.followUpRequired, t.followUpDate),
  })
);

export const enrollmentCommunicationTemplates = pgTable(
  "communication_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    contentEnglish: text("content_english"),
    contentHindi: text("content_hindi"),
    contentUrdu: text("content_urdu"),
    whatsappTemplateId: text("whatsapp_template_id"),
    hasMediaAttachment: boolean("has_media_attachment").default(false),
    mediaUrl: text("media_url"),
    usageCount: integer("usage_count").default(0),
    lastUsed: timestamp("last_used"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    idxCategory: index("communication_templates_category_idx").on(t.category),
    idxActive: index("communication_templates_active_idx").on(t.isActive),
  })
);

export const enrollmentCampaigns = pgTable(
  "enrollment_campaigns",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    targetAudience: jsonb("target_audience").default(JSON.stringify({})),
    targetEnrollments: integer("target_enrollments"),
    targetInteractions: integer("target_interactions"),
    status: text("status").default("draft"),
    totalReach: integer("total_reach").default(0),
    totalInteractions: integer("total_interactions").default(0),
    totalEnrollments: integer("total_enrollments").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    idxStatus: index("enrollment_campaigns_status_idx").on(t.status),
    idxStartDate: index("enrollment_campaigns_start_date_idx").on(t.startDate),
  })
);

export const enrollmentCampaignGuardians = pgTable(
  "campaign_guardians",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => enrollmentCampaigns.id, { onDelete: "cascade" }),
    guardianId: integer("guardian_id")
      .notNull()
      .references(() => enrollmentGuardians.id, { onDelete: "cascade" }),
    contacted: boolean("contacted").default(false),
    contactedAt: timestamp("contacted_at"),
    responded: boolean("responded").default(false),
    respondedAt: timestamp("responded_at"),
    outcome: text("outcome"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqCampaignGuardian: uniqueIndex("campaign_guardians_unique").on(t.campaignId, t.guardianId),
    idxOutcome: index("campaign_guardians_outcome_idx").on(t.outcome),
  })
);

export const enrollmentAnalytics = pgTable(
  "enrollment_analytics",
  {
    id: serial("id").primaryKey(),
    date: timestamp("date").notNull(),
    period: text("period").notNull(),
    newGuardians: integer("new_guardians").default(0),
    totalInteractions: integer("total_interactions").default(0),
    positiveInteractions: integer("positive_interactions").default(0),
    followUpsCompleted: integer("follow_ups_completed").default(0),
    leadsGenerated: integer("leads_generated").default(0),
    applicationsReceived: integer("applications_received").default(0),
    enrollmentsConfirmed: integer("enrollments_confirmed").default(0),
    avgEngagementScore: integer("avg_engagement_score").default(0),
    highEngagementCount: integer("high_engagement_count").default(0),
    sourceBreakdown: jsonb("source_breakdown").default(JSON.stringify({})),
    eventType: text("event_type"),
    eventData: jsonb("event_data"),
    guardianId: integer("guardian_id").references(() => enrollmentGuardians.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxDatePeriod: index("enrollment_analytics_date_period_idx").on(t.date, t.period),
  })
);

export const enrollmentCommunityEvents = pgTable(
  "community_events",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    eventType: text("event_type").notNull(),
    eventDate: timestamp("event_date").notNull(),
    location: text("location").notNull(),
    maxCapacity: integer("max_capacity"),
    registrationRequired: boolean("registration_required").default(false),
    registrationDeadline: timestamp("registration_deadline"),
    status: text("status").default("planned"),
    totalInvited: integer("total_invited").default(0),
    totalRegistered: integer("total_registered").default(0),
    totalAttended: integer("total_attended").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => ({
    idxEventDate: index("community_events_date_idx").on(t.eventDate),
    idxStatus: index("community_events_status_idx").on(t.status),
  })
);

export const enrollmentEventAttendance = pgTable(
  "event_attendance",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => enrollmentCommunityEvents.id, { onDelete: "cascade" }),
    guardianId: integer("guardian_id")
      .notNull()
      .references(() => enrollmentGuardians.id, { onDelete: "cascade" }),
    registeredAt: timestamp("registered_at"),
    attended: boolean("attended").default(false),
    attendedAt: timestamp("attended_at"),
    satisfaction: integer("satisfaction"),
    feedback: text("feedback"),
    followUpRequired: boolean("follow_up_required").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    idxEventGuardian: uniqueIndex("event_attendance_unique").on(t.eventId, t.guardianId),
  })
);

export const enrollmentStaff = pgTable(
  "enrollment_staff",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    permissions: jsonb("permissions").default(JSON.stringify({})),
    guardianLimit: integer("guardian_limit"),
    monthlyTarget: integer("monthly_target"),
    currentGuardianCount: integer("current_guardian_count").default(0),
    monthlyEnrollments: integer("monthly_enrollments").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqUser: uniqueIndex("enrollment_staff_user_unique").on(t.userId),
  })
);
