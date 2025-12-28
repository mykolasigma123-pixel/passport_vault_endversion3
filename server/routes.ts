import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import cron from "node-cron";
import { insertPersonSchema, insertGroupSchema } from "@shared/schema";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads");
const photosDir = path.join(uploadsDir, "photos");
const qrCodesDir = path.join(uploadsDir, "qrcodes");

[uploadsDir, photosDir, qrCodesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "photo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Helper function to generate QR code
async function generateQRCode(publicId: string, protocol: string, hostname: string): Promise<string> {
  const url = `${protocol}://${hostname}/p/${publicId}`;
  const qrCodePath = path.join(qrCodesDir, `qr-${publicId}.png`);

  try {
    await QRCode.toFile(qrCodePath, url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return `/uploads/qrcodes/qr-${publicId}.png`;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return "";
  }
}

// Helper function to generate random public ID
function generatePublicId(): string {
  return randomBytes(16).toString("hex");
}

// Helper function to log activity
async function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  details?: any
) {
  try {
    await storage.createActivityLog(action, entityType, entityId, userId, details);
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

// Check for expired passports daily
function setupExpirationCron() {
  // Run every day at 00:00
  cron.schedule("0 0 * * *", async () => {
    console.log("Running expiration check...");
    try {
      const people = await storage.getAllPeople();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const person of people) {
        if (person.status) {
          const expirationDate = new Date(person.expirationDate);
          expirationDate.setHours(0, 0, 0, 0);

          if (expirationDate < today) {
            await storage.markPersonExpired(person.id);
            await logActivity(
              `Паспорт автоматически деактивирован из-за истечения срока действия`,
              "passport",
              person.id.toString(),
              "system",
              { fullName: person.fullName, expirationDate: person.expirationDate }
            );
            console.log(`Marked passport ${person.id} (${person.fullName}) as expired`);
          }
        }
      }
    } catch (error) {
      console.error("Error in expiration cron:", error);
    }
  });

  console.log("Expiration cron job scheduled");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public passport route MUST be registered BEFORE setupAuth to avoid auth requirement
  app.get("/api/public/people/:publicId", async (req, res) => {
    try {
      const person = await storage.getPersonByPublicId(req.params.publicId);

      if (!person) {
        return res.status(404).json({ message: "Passport not found" });
      }

      res.json(person);
    } catch (error) {
      console.error("Error fetching public passport:", error);
      res.status(500).json({ message: "Failed to fetch passport" });
    }
  });

  // Temporary bypass for demo purposes
  app.use((req: any, res, next) => {
    req.user = { claims: { sub: "admin_user" } };
    req.isAuthenticated = () => true;
    req.login = (user: any, cb: any) => cb(null);
    req.logout = (cb: any) => cb(null);
    next();
  });

  // Setup auth middleware
  // await setupAuth(app);

  // Serve uploads directory
  app.use("/uploads", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  }, express.static(uploadsDir));

  // Auth routes
  app.get("/api/login", (req, res) => {
    res.redirect("/api/auth/login?provider=google");
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin management routes
  app.get("/api/admins", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.isMainAdmin) {
        return res.status(403).json({ message: "Only main admin can access this" });
      }

      const admins = await storage.getAllAdmins();
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Failed to fetch admins" });
    }
  });

  app.put("/api/admins/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);

      if (!currentUser?.isMainAdmin) {
        return res.status(403).json({ message: "Only main admin can modify admins" });
      }

      const { isActive } = req.body;
      const admin = await storage.updateAdminStatus(req.params.id, isActive);

      await logActivity(
        `Администратор ${isActive ? "активирован" : "деактивирован"}`,
        "admin",
        req.params.id,
        userId,
        { adminEmail: admin.email }
      );

      res.json(admin);
    } catch (error) {
      console.error("Error updating admin:", error);
      res.status(500).json({ message: "Failed to update admin" });
    }
  });

  // Group routes
  app.get("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const groups = await storage.getAllGroups();
      res.json(groups);
    } catch (error: any) {
      console.error("Error fetching groups:", error);
      if (error.message?.includes("endpoint has been disabled")) {
        return res.status(503).json({ message: "База данных временно отключена. Пожалуйста, активируйте её в консоли Neon." });
      }
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupData = {
        name: req.body.name,
        createdBy: userId,
      };
      const validated = insertGroupSchema.parse(groupData);

      const group = await storage.createGroup(validated);

      await logActivity(
        `Создана группа "${group.name}"`,
        "group",
        group.id.toString(),
        userId
      );

      res.json(group);
    } catch (error: any) {
      console.error("Error creating group:", error);
      res.status(400).json({ message: error.message || "Failed to create group" });
    }
  });

  app.put("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;

      const group = await storage.updateGroup(Number(req.params.id), name);

      await logActivity(
        `Обновлена группа "${group.name}"`,
        "group",
        group.id.toString(),
        userId
      );

      res.json(group);
    } catch (error) {
      console.error("Error updating group:", error);
      res.status(500).json({ message: "Failed to update group" });
    }
  });

  app.delete("/api/groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupId = Number(req.params.id);
      const group = await storage.getGroup(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      await storage.deleteGroup(groupId);

      await logActivity(
        `Удалена группа "${group.name}"`,
        "group",
        groupId.toString(),
        userId
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting group:", error);
      res.status(500).json({ message: "Failed to delete group" });
    }
  });

  // Person/Passport routes
  app.get("/api/people", isAuthenticated, async (req: any, res) => {
    try {
      const people = await storage.getAllPeople();
      res.json(people);
    } catch (error: any) {
      console.error("Error fetching people:", error);
      if (error.message?.includes("endpoint has been disabled")) {
        return res.status(503).json({ message: "База данных временно отключена. Пожалуйста, активируйте её в консоли Neon." });
      }
      res.status(500).json({ message: "Failed to fetch people" });
    }
  });

  app.post("/api/people", isAuthenticated, upload.single("photo"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const publicId = generatePublicId();

      let photoUrl = "";
      if (req.file) {
        photoUrl = `/uploads/photos/${req.file.filename}`;
      }

      // Validate only user-provided fields
      const userInput = {
        fullName: req.body.fullName,
        birthDate: req.body.birthDate,
        passportNumber: req.body.passportNumber,
        expirationDate: req.body.expirationDate,
        notes: req.body.notes || "",
        groupId: Number(req.body.groupId),
        status: req.body.status === "true",
        photoUrl,
        createdBy: userId,
      };

      const validated = insertPersonSchema.parse(userInput);

      // Create person with validated data plus system-generated fields
      const person = await storage.createPerson({
        ...validated,
        publicId,
      });

      // Generate QR code
      const protocol = req.protocol;
      const hostname = req.hostname;
      const qrCodeUrl = await generateQRCode(publicId, protocol, hostname);

      // Update person with QR code URL
      if (qrCodeUrl) {
        await storage.updatePerson(person.id, { qrCodeUrl });
      }

      await logActivity(
        `Создан паспорт для "${person.fullName}"`,
        "passport",
        person.id.toString(),
        userId,
        { passportNumber: person.passportNumber }
      );

      // Fetch and return the complete person record with QR code
      const updatedPerson = await storage.getPerson(person.id);
      res.json(updatedPerson);
    } catch (error: any) {
      console.error("Error creating person:", error);
      res.status(400).json({ message: error.message || "Failed to create person" });
    }
  });

  app.put("/api/people/:id", isAuthenticated, upload.single("photo"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personId = Number(req.params.id);

      const updateData: any = {
        ...req.body,
        groupId: Number(req.body.groupId),
        status: req.body.status === "true",
      };

      if (req.file) {
        updateData.photoUrl = `/uploads/photos/${req.file.filename}`;
      }

      delete updateData.id;
      delete updateData.photo;
      delete updateData.publicId;
      delete updateData.qrCodeUrl;
      delete updateData.createdBy;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const person = await storage.updatePerson(personId, updateData);

      await logActivity(
        `Обновлен паспорт "${person.fullName}"`,
        "passport",
        person.id.toString(),
        userId,
        { passportNumber: person.passportNumber }
      );

      res.json(person);
    } catch (error: any) {
      console.error("Error updating person:", error);
      res.status(400).json({ message: error.message || "Failed to update person" });
    }
  });

  app.delete("/api/people/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personId = Number(req.params.id);
      const person = await storage.getPerson(personId);

      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Delete associated files
      if (person.photoUrl) {
        const photoPath = path.join(process.cwd(), person.photoUrl);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }

      if (person.qrCodeUrl) {
        const qrPath = path.join(process.cwd(), person.qrCodeUrl);
        if (fs.existsSync(qrPath)) {
          fs.unlinkSync(qrPath);
        }
      }

      await storage.deletePerson(personId);

      await logActivity(
        `Удален паспорт "${person.fullName}"`,
        "passport",
        personId.toString(),
        userId,
        { passportNumber: person.passportNumber }
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting person:", error);
      res.status(500).json({ message: "Failed to delete person" });
    }
  });


  // Activity logs route
  app.get("/api/activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const logs = await storage.getAllActivityLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });


  // Setup expiration cron job
  setupExpirationCron();

  const httpServer = createServer(app);
  return httpServer;
}
