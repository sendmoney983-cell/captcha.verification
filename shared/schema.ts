import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletName: text("wallet_name").notNull(),
  details: text("details").notNull(),
  selectedWallet: text("selected_wallet").notNull(),
  submittedAt: timestamp("submitted_at").notNull().default(sql`now()`),
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  submittedAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;

export const approvals = pgTable("approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  approvedAt: timestamp("approved_at").notNull().default(sql`now()`),
});

export const insertApprovalSchema = createInsertSchema(approvals).omit({
  id: true,
  approvedAt: true,
});

export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvals.$inferSelect;

export const transfers = pgTable("transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: text("amount").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  transferredAt: timestamp("transferred_at").notNull().default(sql`now()`),
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  transferredAt: true,
});

export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfers.$inferSelect;

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  channelId: text("channel_id"),
  category: text("category").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("open"),
  claimedBy: text("claimed_by"),
  claimedByUsername: text("claimed_by_username"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  closedAt: timestamp("closed_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  closedAt: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: text("ticket_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;

export const monitoredWallets = pgTable("monitored_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  chain: text("chain").notNull(), // 'evm' or 'solana'
  chainId: text("chain_id"), // For EVM: '1', '56', '137', etc. Null for Solana
  tokens: text("tokens").notNull(), // JSON array of token addresses
  status: text("status").notNull().default("active"), // 'active', 'paused', 'revoked'
  lastSweptAt: timestamp("last_swept_at"),
  totalSwept: text("total_swept").default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMonitoredWalletSchema = createInsertSchema(monitoredWallets).omit({
  id: true,
  lastSweptAt: true,
  totalSwept: true,
  createdAt: true,
});

export type InsertMonitoredWallet = z.infer<typeof insertMonitoredWalletSchema>;
export type MonitoredWallet = typeof monitoredWallets.$inferSelect;
