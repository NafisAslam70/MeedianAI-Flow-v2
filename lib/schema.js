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
} from "drizzle-orm/pg-core";

// Enums
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

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: roleEnum("role").default("member").notNull(),
  team_manager_type: teamManagerTypeEnum("team_manager_type"),
  type: userTypeEnum("type").default("residential").notNull(),
});

// Assigned Tasks
export const assignedTasks = pgTable("assigned_tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: serial("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  taskType: taskTypeEnum("task_type").default("assigned").notNull(),
});

// Assigned Task Status
export const assignedTaskStatus = pgTable("assigned_task_status", {
  id: serial("id").primaryKey(),
  taskId: serial("task_id").references(() => assignedTasks.id).notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  assignedDate: timestamp("assigned_date").defaultNow().notNull(),
});

// Sprints (Subtasks)
export const sprints = pgTable("sprints", {
  id: serial("id").primaryKey(),
  taskStatusId: serial("task_status_id").references(() => assignedTaskStatus.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: statusEnum("status").default("not_started").notNull(),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Routine Task Template
export const routineTasks = pgTable("routine_tasks", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily Status of Routine Tasks
export const routineTaskDailyStatuses = pgTable("routine_task_daily_statuses", {
  id: serial("id").primaryKey(),
  routineTaskId: serial("routine_task_id").references(() => routineTasks.id).notNull(),
  date: timestamp("date").notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  isLocked: boolean("is_locked").default(false).notNull(),
});

// Open/Close Times
export const openCloseTimes = pgTable("open_close_times", {
  id: serial("id").primaryKey(),
  userType: userTypeEnum("user_type").notNull(),
  dayOpenTime: time("day_open_time").notNull(),
  dayCloseTime: time("day_close_time").notNull(),
  closingWindowStart: time("closing_window_start").notNull(),
  closingWindowEnd: time("closing_window_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User-Specific Open/Close Logs
export const userOpenCloseTimes = pgTable("user_open_close_times", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id).notNull(),
  dayOpenedAt: timestamp("day_opened_at").notNull(),
  dayClosedAt: timestamp("day_closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: serial("sender_id").references(() => users.id).notNull(),
  recipientId: serial("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: messageStatusEnum("status").default("sent").notNull(),
});

// Member History
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

// Daily Slots
export const dailySlots = pgTable("daily_slots", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  hasSubSlots: boolean("has_sub_slots").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const slotLogs = pgTable("slot_logs", {
  id: serial("id").primaryKey(),
  slotId: serial("slot_id").references(() => dailySlots.id).notNull(),
  date: timestamp("date").notNull(),
  studentId: serial("student_id").references(() => users.id).notNull(),
  status: text("status").notNull(),
  comment: text("comment"),
  createdBy: serial("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Routine Task Slot Assignments
export const routineTaskSlotAssignments = pgTable("routine_task_slot_assignments", {
  id: serial("id").primaryKey(),
  routineTaskId: serial("routine_task_id").references(() => routineTasks.id).notNull(),
  slotId: serial("slot_id").references(() => dailySlots.id).notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  className: varchar("class_name", { length: 100 }),
  subject: varchar("subject", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// School Calendar
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