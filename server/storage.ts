import {
  users,
  groups,
  people,
  activityLogs,
  type User,
  type UpsertUser,
  type Group,
  type InsertGroup,
  type Person,
  type InsertPerson,
  type ActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser & { isMainAdmin?: boolean; isActive?: boolean }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getAllAdmins(): Promise<User[]>;
  updateAdminStatus(id: string, isActive: boolean): Promise<User>;

  // Group operations
  getAllGroups(): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(group: InsertGroup): Promise<Group>;
  updateGroup(id: number, name: string): Promise<Group>;
  deleteGroup(id: number): Promise<void>;

  // Person/Passport operations
  getAllPeople(): Promise<Person[]>;
  getPerson(id: number): Promise<Person | undefined>;
  getPersonByPublicId(publicId: string): Promise<Person | undefined>;
  createPerson(person: InsertPerson & { publicId: string }): Promise<Person>;
  updatePerson(id: number, person: Partial<InsertPerson & { qrCodeUrl?: string }>): Promise<Person>;
  deletePerson(id: number): Promise<void>;
  markPersonExpired(id: number): Promise<Person>;

  // Activity log operations
  createActivityLog(
    action: string,
    entityType: string,
    entityId: string,
    performedBy: string,
    details?: any
  ): Promise<ActivityLog>;
  getAllActivityLogs(): Promise<Array<ActivityLog & { performedByUser?: User }>>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    if (id === "admin_user") {
      return {
        id: "admin_user",
        email: "admin@example.com",
        firstName: "Администратор",
        lastName: "Системы",
        profileImageUrl: null,
        isMainAdmin: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser & { isMainAdmin?: boolean; isActive?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        isMainAdmin: userData.isMainAdmin ?? false,
        isActive: userData.isActive ?? true,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllAdmins(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateAdminStatus(id: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Group operations
  async getAllGroups(): Promise<Group[]> {
    try {
      return await db.select().from(groups).orderBy(groups.name);
    } catch (error: any) {
      if (error.message?.includes("endpoint has been disabled")) {
        return [{ id: 1, name: "Демо-группа (База отключена)", createdBy: "admin_user", createdAt: new Date(), updatedAt: new Date() }];
      }
      throw error;
    }
  }

  async getGroup(id: number): Promise<Group | undefined> {
    try {
      const [group] = await db.select().from(groups).where(eq(groups.id, id));
      return group;
    } catch (error: any) {
      if (error.message?.includes("endpoint has been disabled")) return undefined;
      throw error;
    }
  }

  async createGroup(groupData: InsertGroup): Promise<Group> {
    const [group] = await db.insert(groups).values(groupData).returning();
    return group;
  }

  async updateGroup(id: number, name: string): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set({ name, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning();
    return group;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groups).where(eq(groups.id, id));
  }

  // Person/Passport operations
  async getAllPeople(): Promise<Person[]> {
    try {
      return await db.select().from(people).orderBy(desc(people.createdAt));
    } catch (error: any) {
      if (error.message?.includes("endpoint has been disabled")) {
        return [];
      }
      throw error;
    }
  }

  async getPerson(id: number): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person;
  }

  async getPersonByPublicId(publicId: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.publicId, publicId));
    return person;
  }

  async createPerson(personData: InsertPerson & { publicId: string }): Promise<Person> {
    const [person] = await db.insert(people).values(personData).returning();
    return person;
  }

  async updatePerson(id: number, personData: Partial<InsertPerson & { qrCodeUrl?: string }>): Promise<Person> {
    const [person] = await db
      .update(people)
      .set({ ...personData, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();
    return person;
  }

  async deletePerson(id: number): Promise<void> {
    await db.delete(people).where(eq(people.id, id));
  }

  async markPersonExpired(id: number): Promise<Person> {
    const [person] = await db
      .update(people)
      .set({ status: false, updatedAt: new Date() })
      .where(eq(people.id, id))
      .returning();
    return person;
  }

  // Activity log operations
  async createActivityLog(
    action: string,
    entityType: string,
    entityId: string,
    performedBy: string,
    details?: any
  ): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values({
        action,
        entityType,
        entityId,
        performedBy,
        details,
      })
      .returning();
    return log;
  }

  async getAllActivityLogs(): Promise<Array<ActivityLog & { performedByUser?: User }>> {
    const logs = await db
      .select({
        log: activityLogs,
        user: users,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.performedBy, users.id))
      .orderBy(desc(activityLogs.timestamp));

    return logs.map((row) => ({
      ...row.log,
      performedByUser: row.user || undefined,
    }));
  }
}

export const storage = new DatabaseStorage();
