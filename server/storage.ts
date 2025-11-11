import { 
  type User, type InsertUser, 
  type Application, type InsertApplication, 
  type Approval, type InsertApproval, 
  type Transfer, type InsertTransfer,
  users, applications, approvals, transfers
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
}

export const storage = new DBStorage();
