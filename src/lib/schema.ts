import {
  boolean,
  doublePrecision,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  authorId: uuid("author_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const liveSessions = pgTable("live_sessions", {
  id: uuid("id").primaryKey(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  userId: uuid("user_id").references(() => users.id),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LiveSession = typeof liveSessions.$inferSelect;

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  })
);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messages.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushPreferences = pgTable("push_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyMessages: boolean("notify_messages").notNull().default(true),
  notifyPresence: boolean("notify_presence").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const presencePushLog = pgTable(
  "presence_push_log",
  {
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.recipientId, table.senderId] }),
  })
);