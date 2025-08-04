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

/* -------------------- A. USERS & MEMBERS -------------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  whatsapp_number: varchar("whatsapp_number", { length: 15 }), // CHANGED: Made nullable
  whatsapp_enabled: boolean("whatsapp_enabled").default(true).notNull(), // ADDED: Flag for WhatsApp notifications
  role: roleEnum("role").default("member").notNull(),
  team_manager_type: teamManagerTypeEnum("team_manager_type"),
  type: userTypeEnum("type").default("residential").notNull(),
  member_scope: memberScopeEnum("member_scope").default("i_member").notNull(),
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
  slotId: serial("slot_id").references(() => dailySlots.id).notNull(),
  date: timestamp("date").notNull(),
  studentId: serial("student_id").references(() => students.id).notNull(),
  status: text("status").notNull(),
  defaulter_type: defaulterTypeEnum("defaulter_type"),
  comment: text("comment"),
  createdBy: serial("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailySlotAssignments = pgTable("daily_slot_assignments", {
  id: serial("id").primaryKey(),
  slotId: serial("slot_id").references(() => dailySlots.id).notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  className: varchar("class_name", { length: 100 }),
  subject: varchar("subject", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------- C. ROUTINE TASKS -------------------- */
export const routineTasks = pgTable("routine_tasks", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const routineTaskDailyStatuses = pgTable("routine_task_daily_statuses", {
  id: serial("id").primaryKey(),
  routineTaskId: serial("routine_task_id").references(() => routineTasks.id).notNull(),
  date: timestamp("date").notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  isLocked: boolean("is_locked").default(false).notNull(),
});

export const routineTaskLogs = pgTable("routine_task_logs", {
  id: serial("id").primaryKey(),
  routineTaskId: serial("routine_task_id").references(() => routineTasks.id).notNull(),
  userId: serial("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

/* -------------------- E. MESSAGING & LOGS -------------------- */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: serial("sender_id").references(() => users.id).notNull(),
  recipientId: serial("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: messageStatusEnum("status").default("sent").notNull(),
});

export const generalLogs = pgTable("general_logs", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberHistory = pgTable("member_history", {
  id: serial("id").primaryKey(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  taskType: taskTypeEnum("task_type").notNull(),
  taskId: serial("task_id").notNull(),
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
  userId: serial("user_id").references(() => users.id).notNull(),
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
  subject: varchar("subject", { length: 255 }), // Renamed and required
  content: text("content").notNull(),
  attachments: text("attachments").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});