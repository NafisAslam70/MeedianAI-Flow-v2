import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", ["admin", "member"]);
export const statusEnum = pgEnum("status", ["not_started", "in_progress", "done"]);
export const sprintStatusEnum = pgEnum("sprint_status", [
  "not_started",
  "in_progress",
  "pending_verification",
  "verified",
]);
export const taskTypeEnum = pgEnum("task_type", ["assigned", "routine"]);
export const userTypeEnum = pgEnum("user_type", ["residential", "non_residential", "semi_residential"]);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: roleEnum("role").default("member").notNull(),
  type: userTypeEnum("type").default("residential").notNull(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: serial("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  taskType: taskTypeEnum("task_type").default("assigned").notNull(),
});

// Assigned Task Assignments
export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: serial("task_id").references(() => tasks.id).notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  assignedDate: timestamp("assigned_date").defaultNow().notNull(),
});

// Sprint (subtasks for assigned)
export const sprints = pgTable("sprints", {
  id: serial("id").primaryKey(),
  taskAssignmentId: serial("task_assignment_id")
    .references(() => taskAssignments.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: sprintStatusEnum("status").default("not_started").notNull(),
  verifiedBy: serial("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Routine Task Template
// Routine Task Template
export const routineTasks = pgTable("routine_tasks", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  memberId: serial("member_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// Daily Routine Task Status
export const routineTaskDailyStatuses = pgTable("routine_task_daily_statuses", {
  id: serial("id").primaryKey(),
  routineTaskId: serial("routine_task_id")
    .references(() => routineTasks.id)
    .notNull(),
  date: timestamp("date").notNull(),
  status: statusEnum("status").default("not_started").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  comment: text("comment"),
  isLocked: boolean("is_locked").default(false).notNull(),
});

// App State
export const appState = pgTable("app_state", {
  id: serial("id").primaryKey(),
  dayOpenedAt: timestamp("day_opened_at").notNull(),
  dayClosedAt: timestamp("day_closed_at"),
  closingWindowStart: timestamp("closing_window_start").notNull(),
  closingWindowEnd: timestamp("closing_window_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: serial("sender_id").references(() => users.id).notNull(),
  recipientId: serial("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});