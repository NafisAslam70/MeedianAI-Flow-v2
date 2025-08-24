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
export const messageStatusEnum = pgEnum("message_status", ["sent", "read"]);
export const weekNameEnum = pgEnum("week_name", ["General", "Exam", "Event", "Holiday"]);
export const studentStatusEnum = pgEnum("student_status", ["hosteller", "dayscholar"]);
export const defaulterTypeEnum = pgEnum("defaulter_type", ["punctuality", "language", "discipline"]);
export const memberScopeEnum = pgEnum("member_scope", ["o_member", "i_member", "s_member"]);
export const announcementTargetEnum = pgEnum("announcement_target", ["team_members", "students", "all"]);
export const announcementProgramEnum = pgEnum("announcement_program", ["MSP", "MSP-E", "MHCP", "MNP", "MGHP", "MAP", "M4E", "Other"]);
export const noteCategoryEnum = pgEnum("note_category", ["MSP", "MHCP", "MHP", "MOP", "Other", "Building Home"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);

/* -------------------- A. USERS & MEMBERS -------------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  whatsapp_number: varchar("whatsapp_number", { length: 15 }), // Nullable
  whatsapp_enabled: boolean("whatsapp_enabled").default(true).notNull(),
  role: roleEnum("role").default("member").notNull(),
  team_manager_type: teamManagerTypeEnum("team_manager_type"),
  type: userTypeEnum("type").default("residential").notNull(),
  member_scope: memberScopeEnum("member_scope").default("i_member").notNull(),
  image: text("image"), // Added for profile picture URL
  deep_calendar_token: text("deep_calendar_token").unique(), // Added
  immediate_supervisor: integer("immediate_supervisor").references(() => users.id, { onDelete: "set null" }), // Nullable, references users.id
}, (table) => ({
  idx_whatsapp_number: index("idx_users_whatsapp_number").on(table.whatsapp_number),
  idx_email: index("idx_users_email").on(table.email),
}));

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  father_name: text("father_name"),
  class_name: varchar("class_name", { length: 100 }).notNull(),
  residential_status: studentStatusEnum("student_status").notNull(),
});

/* -------------------- B. DAILY SLOTS MODULE -------------------- */
export const dailySlots = pgTable("daily_slots", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  hasSubSlots: boolean("has_sub_slots").default(false).notNull(),
  assignedMemberId: integer("assigned_member_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailySlotLogs = pgTable("daily_slot_logs", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").references(() => dailySlots.id).notNull(),
  date: timestamp("date").notNull(),
  studentId: integer("student_id").references(() => students.id).notNull(),
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
  className: varchar("class_name", { length: 100 }),
  subject: varchar("subject", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  taskType: taskTypeEnum("task_type").default("assigned").notNull(),
  deadline: timestamp("deadline"),
  resources: text("resources"),
}, (table) => ({
  idx_created_by: index("idx_assigned_tasks_created_by").on(table.createdBy),
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
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: messageStatusEnum("status").default("sent").notNull(),
}, (table) => ({
  idx_sender_recipient: index("idx_messages_sender_recipient").on(table.senderId, table.recipientId),
}));

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
  assignedTasksUpdates: jsonb("assigned_tasks_updates"),
  routineTasksUpdates: jsonb("routine_tasks_updates"),
  routineLog: text("routine_log"),
  generalLog: text("general_log"),
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

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(),
  proof: text("proof"), // URL to uploaded file
  transferTo: integer("transfer_to").references(() => users.id), // Nullable, for team_manager
  status: leaveStatusEnum("leave_status").default("pending").notNull(),
  submittedTo: integer("submitted_to").references(() => users.id).notNull(), // immediate_supervisor
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
}, (table) => ({
  idx_user_date: index("idx_leave_requests_user_date").on(table.userId, table.startDate),
}));
