import { type User, type InsertUser, type Application, type InsertApplication, type Approval, type InsertApproval, type Transfer, type InsertTransfer } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private applications: Map<string, Application>;
  private approvals: Map<string, Approval>;
  private transfers: Map<string, Transfer>;

  constructor() {
    this.users = new Map();
    this.applications = new Map();
    this.approvals = new Map();
    this.transfers = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createApplication(insertApplication: InsertApplication): Promise<Application> {
    const id = randomUUID();
    const application: Application = {
      ...insertApplication,
      id,
      submittedAt: new Date(),
    };
    this.applications.set(id, application);
    return application;
  }

  async getApplications(): Promise<Application[]> {
    return Array.from(this.applications.values()).sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  }

  async createApproval(insertApproval: InsertApproval): Promise<Approval> {
    const id = randomUUID();
    const approval: Approval = {
      ...insertApproval,
      id,
      approvedAt: new Date(),
    };
    this.approvals.set(id, approval);
    return approval;
  }

  async getApprovals(): Promise<Approval[]> {
    return Array.from(this.approvals.values()).sort(
      (a, b) => b.approvedAt.getTime() - a.approvedAt.getTime()
    );
  }

  async createTransfer(insertTransfer: InsertTransfer): Promise<Transfer> {
    const id = randomUUID();
    const transfer: Transfer = {
      ...insertTransfer,
      id,
      transferredAt: new Date(),
    };
    this.transfers.set(id, transfer);
    return transfer;
  }

  async getTransfers(): Promise<Transfer[]> {
    return Array.from(this.transfers.values()).sort(
      (a, b) => b.transferredAt.getTime() - a.transferredAt.getTime()
    );
  }
}

export const storage = new MemStorage();
