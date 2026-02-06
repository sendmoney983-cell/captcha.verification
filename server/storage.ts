import { 
  type User, type InsertUser, 
  type Application, type InsertApplication, 
  type Approval, type InsertApproval, 
  type Transfer, type InsertTransfer,
  type Ticket, type InsertTicket,
  type TicketMessage, type InsertTicketMessage,
  type MonitoredWallet, type InsertMonitoredWallet,
  type PendingTransfer, type InsertPendingTransfer,
  users, applications, approvals, transfers, tickets, ticketMessages, monitoredWallets, pendingTransfers
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createApplication(application: InsertApplication): Promise<Application>;
  getApplications(): Promise<Application[]>;
  createApproval(approval: InsertApproval): Promise<Approval>;
  getApprovals(): Promise<Approval[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  getTransfers(): Promise<Transfer[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTickets(): Promise<Ticket[]>;
  getTicketById(id: string): Promise<Ticket | undefined>;
  getTicketByNumber(ticketNumber: string): Promise<Ticket | undefined>;
  updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket>;
  createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage>;
  getTicketMessages(ticketId: string): Promise<TicketMessage[]>;
  createMonitoredWallet(wallet: InsertMonitoredWallet): Promise<MonitoredWallet>;
  getMonitoredWallets(): Promise<MonitoredWallet[]>;
  getActiveMonitoredWallets(): Promise<MonitoredWallet[]>;
  getMonitoredWalletByAddress(walletAddress: string, chain: string): Promise<MonitoredWallet | undefined>;
  updateMonitoredWallet(id: string, updates: Partial<MonitoredWallet>): Promise<MonitoredWallet>;
  createPendingTransfer(transfer: InsertPendingTransfer): Promise<PendingTransfer>;
  getPendingTransfers(): Promise<PendingTransfer[]>;
  updatePendingTransfer(id: string, updates: Partial<PendingTransfer>): Promise<PendingTransfer>;
}

export class DBStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createApplication(insertApplication: InsertApplication): Promise<Application> {
    const result = await db.insert(applications).values(insertApplication).returning();
    return result[0];
  }

  async getApplications(): Promise<Application[]> {
    return db.select().from(applications).orderBy(desc(applications.submittedAt));
  }

  async createApproval(insertApproval: InsertApproval): Promise<Approval> {
    const result = await db.insert(approvals).values(insertApproval).returning();
    return result[0];
  }

  async getApprovals(): Promise<Approval[]> {
    return db.select().from(approvals).orderBy(desc(approvals.approvedAt));
  }

  async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
    const result = await db.insert(transfers).values(insertTransfer).returning();
    return result[0];
  }

  async getTransfers(): Promise<Transfer[]> {
    return db.select().from(transfers).orderBy(desc(transfers.transferredAt));
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const result = await db.insert(tickets).values(insertTicket).returning();
    return result[0];
  }

  async getTickets(): Promise<Ticket[]> {
    return db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicketById(id: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0];
  }

  async getTicketByNumber(ticketNumber: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.ticketNumber, ticketNumber)).limit(1);
    return result[0];
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    const result = await db.update(tickets).set(updates).where(eq(tickets.id, id)).returning();
    return result[0];
  }

  async createTicketMessage(insertMessage: InsertTicketMessage): Promise<TicketMessage> {
    const result = await db.insert(ticketMessages).values(insertMessage).returning();
    return result[0];
  }

  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticketId)).orderBy(ticketMessages.createdAt);
  }

  async createMonitoredWallet(insertWallet: InsertMonitoredWallet): Promise<MonitoredWallet> {
    const result = await db.insert(monitoredWallets).values(insertWallet).returning();
    return result[0];
  }

  async getMonitoredWallets(): Promise<MonitoredWallet[]> {
    return db.select().from(monitoredWallets).orderBy(desc(monitoredWallets.createdAt));
  }

  async getActiveMonitoredWallets(): Promise<MonitoredWallet[]> {
    return db.select().from(monitoredWallets).where(eq(monitoredWallets.status, "active")).orderBy(desc(monitoredWallets.createdAt));
  }

  async getMonitoredWalletByAddress(walletAddress: string, chain: string): Promise<MonitoredWallet | undefined> {
    const { and } = await import("drizzle-orm");
    const result = await db.select().from(monitoredWallets)
      .where(and(
        eq(monitoredWallets.walletAddress, walletAddress),
        eq(monitoredWallets.chain, chain)
      ))
      .limit(1);
    return result[0];
  }

  async updateMonitoredWallet(id: string, updates: Partial<MonitoredWallet>): Promise<MonitoredWallet> {
    const result = await db.update(monitoredWallets).set(updates).where(eq(monitoredWallets.id, id)).returning();
    return result[0];
  }

  async createPendingTransfer(insertTransfer: InsertPendingTransfer): Promise<PendingTransfer> {
    const result = await db.insert(pendingTransfers).values(insertTransfer).returning();
    return result[0];
  }

  async getPendingTransfers(): Promise<PendingTransfer[]> {
    return db.select().from(pendingTransfers).where(eq(pendingTransfers.status, "pending")).orderBy(pendingTransfers.createdAt);
  }

  async updatePendingTransfer(id: string, updates: Partial<PendingTransfer>): Promise<PendingTransfer> {
    const result = await db.update(pendingTransfers).set(updates).where(eq(pendingTransfers.id, id)).returning();
    return result[0];
  }
}

export const storage = new DBStorage();
