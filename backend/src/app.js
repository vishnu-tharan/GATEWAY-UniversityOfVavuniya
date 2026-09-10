const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { randomBytes, randomUUID } = require("node:crypto");
const nodemailer = require("nodemailer");
const {
  User,
  VehicleRecord,
  FrequentTraveler,
  Session,
  Audit,
  mongoose,
} = require("./models");
const { verifyToken, roles, hash } = require("../middleware/authMiddleware");
const v = require("./validation");
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  gate: u.gate,
  faculty: u.faculty,
  phone: u.phone || "",
  bio: u.bio || "",
  active: u.active !== false,
});
const scope = (req) =>
  req.user.role === "admin"
    ? { faculty: req.user.faculty || "__unassigned__" }
    : {};
const audit = (req, action, target, faculty) =>
  Audit.create({
    actor: req.user.name,
    actorId: String(req.user._id),
    faculty: faculty || req.user.faculty,
    action,
    target,
  });
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
});
function notify(to, subject, message) {
  if (!process.env.MAIL_HOST || !to || !to.includes("@")) return;
  const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_PORT === "465",
    requireTLS: process.env.NODE_ENV === "production",
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
  transport
    .sendMail({ from: process.env.MAIL_USER, to, subject, text: message })
    .catch(() =>
      console.error(
        "Email delivery failed; operation remains available in the app.",
      ),
    );
}
function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(helmet());
  const origins = (
    process.env.WEB_ORIGINS || "http://localhost:8081,http://localhost:5173"
  )
    .split(",")
    .map((s) => s.trim());
  app.use((req, res, next) => {
    if (req.headers.origin && !origins.includes(req.headers.origin))
      return res.status(403).json({ message: "Origin not allowed" });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-gateway-client"] !== "gateway"
    )
      return res
        .status(403)
        .json({ message: "Missing request protection header" });
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    cors({
      origin: origins,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Gateway-Client"],
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please wait a minute." },
    }),
  );
  app.get("/health", (req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({
        status: mongoose.connection.readyState === 1 ? "ready" : "unavailable",
      }),
  );
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    skipSuccessfulRequests: true,
    message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  app.post(
    "/user/login",
    loginLimiter,
    wrap(async (req, res) => {
      const email = v.text(req.body, "email", true, 254).toLowerCase(),
        password = v.secret(req.body, "password");
      const user = await User.findOne({ email }).select("+password");
      const valid = await bcrypt.compare(
        password,
        user?.password ||
          "$2b$12$C6UzMDM.H6dfI/f/IKcEe.2lH3RBvPxYyAWOLhaVMo.pKUW5.Qp5m",
      );
      if (
        !user ||
        !valid ||
        password.length < 12 ||
        user.active === false ||
        user.lockedUntil > new Date()
      ) {
        if (user && !(user.lockedUntil > new Date())) {
          const updated = await User.findByIdAndUpdate(
            user._id,
            { $inc: { failedLogins: 1 } },
            { returnDocument: "after" },
          );
          if (updated.failedLogins >= 5)
            await User.updateOne(
              { _id: user._id },
              {
                lockedUntil: new Date(Date.now() + 15 * 60_000),
                failedLogins: 0,
              },
            );
        }
        return res
          .status(401)
          .json({
            message: "Invalid credentials or temporarily locked account.",
          });
      }
      await User.updateOne(
        { _id: user._id },
        { failedLogins: 0, lockedUntil: null },
      );
      const token = randomBytes(32).toString("hex");
      await Session.create({
        tokenHash: hash(token),
        userId: user._id,
        version: user.sessionVersion || 0,
        expiresAt: new Date(Date.now() + 8 * 60 * 60_000),
        device: String(req.headers["user-agent"] || "Mobile").slice(0, 160),
      });
      req.user = user;
      await audit(req, "Signed in", String(user._id));
      res.cookie("gateway_session", token, cookieOptions());
      res.json({
        user: publicUser(user),
        ...(!req.headers.origin ? { token } : {}),
      });
    }),
  );
  app.get("/user/me", verifyToken, (req, res) =>
    res.json(publicUser(req.user)),
  );
  app.put(
    "/user/me",
    verifyToken,
    wrap(async (req, res) => {
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          name: v.text(req.body, "name", true),
          phone: v.text(req.body, "phone", false, 30),
          bio: v.text(req.body, "bio", false, 500),
        },
        { returnDocument: "after" },
      );
      await audit(req, "Updated profile", String(user._id));
      res.json(publicUser(user));
    }),
  );
  app.post(
    "/user/password",
    verifyToken,
    loginLimiter,
    wrap(async (req, res) => {
      const user = await User.findById(req.user._id).select("+password"),
        current = v.secret(req.body, "currentPassword"),
        password = v.password(req.body.newPassword);
      if (!(await bcrypt.compare(current, user.password)))
        v.fail("Current password is incorrect");
      if (current === password) v.fail("Choose a different password");
      await User.updateOne(
        { _id: user._id },
        {
          $set: { password: await bcrypt.hash(password, 12) },
          $inc: { sessionVersion: 1 },
        },
      );
      await Session.deleteMany({ userId: user._id });
      await audit(req, "Changed password", String(user._id));
      res.clearCookie("gateway_session", {
        ...cookieOptions(),
        maxAge: undefined,
      });
      res.json({ message: "Password changed. Sign in again." });
    }),
  );
  app.post(
    "/user/logout",
    verifyToken,
    wrap(async (req, res) => {
      await Session.deleteOne({ _id: req.session._id });
      res.clearCookie("gateway_session", {
        ...cookieOptions(),
        maxAge: undefined,
      });
      res.json({ message: "Signed out" });
    }),
  );
  app.get(
    "/user/sessions",
    verifyToken,
    wrap(async (req, res) => {
      const sessions = await Session.find({
        userId: req.user._id,
        expiresAt: { $gt: new Date() },
        version: req.user.sessionVersion || 0,
      }).select("device createdAt expiresAt");
      res.json(
        sessions.map((s) => ({
          ...s.toObject(),
          current: String(s._id) === String(req.session._id),
        })),
      );
    }),
  );
  app.post(
    "/user/revoke-sessions",
    verifyToken,
    wrap(async (req, res) => {
      await Session.deleteMany({
        userId: req.user._id,
        _id: { $ne: req.session._id },
      });
      await audit(req, "Revoked other sessions", String(req.user._id));
      res.json({ message: "Other sessions signed out" });
    }),
  );
  app.get(
    "/user",
    roles("admin", "superadmin"),
    wrap(async (req, res) =>
      res.json(
        (
          await User.find(
            req.user.role === "superadmin"
              ? { active: { $ne: false } }
              : { role: "security", active: { $ne: false } },
          )
        ).map(publicUser),
      ),
    ),
  );
  app.post(
    "/user",
    roles("superadmin"),
    wrap(async (req, res) => {
      const role = v.choice(req.body, "role", ["security", "admin"]);
      const user = await User.create({
        name: v.text(req.body, "name", true),
        email: v.email(req.body),
        password: await bcrypt.hash(v.password(req.body.password), 12),
        role,
        gate: role === "security" ? v.choice(req.body, "gate", v.GATES) : "",
        faculty:
          role === "admin" ? v.choice(req.body, "faculty", v.FACULTIES) : "",
      });
      await audit(req, "Created account", String(user._id));
      res.status(201).json(publicUser(user));
    }),
  );
  app.put(
    "/user/:id",
    roles("superadmin"),
    wrap(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) v.fail("Invalid account");
      const existing = await User.findById(req.params.id);
      if (!existing || existing.role === "superadmin")
        v.fail("Account cannot be edited here", 403);
      const user = await User.findByIdAndUpdate(
        existing._id,
        {
          name: v.text(req.body, "name", true),
          gate:
            existing.role === "security"
              ? v.choice(req.body, "gate", v.GATES)
              : "",
          faculty:
            existing.role === "admin"
              ? v.choice(req.body, "faculty", v.FACULTIES)
              : "",
        },
        { returnDocument: "after" },
      );
      await audit(req, "Updated account", String(user._id));
      res.json(publicUser(user));
    }),
  );
  app.delete(
    "/user/:id",
    roles("superadmin"),
    wrap(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) v.fail("Invalid account");
      const user = await User.findOneAndUpdate(
        { _id: req.params.id, role: { $ne: "superadmin" } },
        { active: false, $inc: { sessionVersion: 1 } },
      );
      if (!user) v.fail("Account not found", 404);
      await Session.deleteMany({ userId: user._id });
      await audit(req, "Disabled account", String(user._id));
      res.json({ message: "Account disabled" });
    }),
  );
  app.get(
    "/vehicleRecord",
    verifyToken,
    wrap(async (req, res) => {
      const page = Math.max(
          1,
          Math.min(Math.floor(Number(req.query.page)) || 1, 100000),
        ),
        query = scope(req);
      if (req.query.status === "inside") query.outTime = null;
      if (req.query.status === "pending") {
        query.approvalStatus = "Pending Approval";
        query.outTime = null;
      }
      if (typeof req.query.search === "string" && req.query.search.trim()) {
        const search = req.query.search
          .trim()
          .slice(0, 80)
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = [
          "vehicleNumber",
          "driverName",
          "passId",
          "gatePassNumber",
        ].map((k) => ({ [k]: { $regex: search, $options: "i" } }));
      }
      if (req.query.from || req.query.to) {
        const from = new Date(req.query.from),
          to = new Date(req.query.to);
        if (isNaN(from) || isNaN(to) || from > to) v.fail("Invalid date range");
        query.inTime = { $gte: from.toISOString(), $lte: to.toISOString() };
      }
      const [items, total] = await Promise.all([
        VehicleRecord.find(query)
          .sort({ _id: -1 })
          .skip((page - 1) * 30)
          .limit(30),
        VehicleRecord.countDocuments(query),
      ]);
      res.json({ items, total, page, pages: Math.ceil(total / 30) });
    }),
  );
  app.get(
    "/dashboard",
    verifyToken,
    wrap(async (req, res) => {
      const filter = scope(req),
        start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const [inside, pending, today, recent, gates] = await Promise.all([
        VehicleRecord.countDocuments({ ...filter, outTime: null }),
        VehicleRecord.countDocuments({
          ...filter,
          outTime: null,
          approvalStatus: "Pending Approval",
        }),
        VehicleRecord.countDocuments({
          ...filter,
          inTime: { $gte: start.toISOString() },
        }),
        VehicleRecord.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(6),
        Promise.all(
          v.GATES.map(async (gate) => ({
            gate,
            inside: await VehicleRecord.countDocuments({
              ...filter,
              entryGate: gate,
              outTime: null,
            }),
          })),
        ),
      ]);
      res.json({ inside, pending, today, recent, gates });
    }),
  );
  app.post(
    "/vehicleRecord",
    roles("security"),
    wrap(async (req, res) => {
      if (!v.GATES.includes(req.user.gate))
        v.fail("Ask an administrator to assign your gate", 403);
      const equipment = v.text(req.body, "carriedEquipment", false, 1000);
      const record = await VehicleRecord.create({
        passId: randomUUID(),
        inTime: new Date().toISOString(),
        outTime: null,
        vehicleNumber: v.plate(req.body),
        driverName: v.text(req.body, "driverName", true),
        driverNIC: v.text(req.body, "driverNIC", true, 30),
        driverPhone: v.text(req.body, "driverPhone", true, 30),
        faculty: v.choice(req.body, "faculty", v.FACULTIES),
        carriedEquipment: equipment,
        entryNotes: v.text(req.body, "entryNotes", false, 1000),
        approvalStatus: equipment ? "Pending Approval" : "Approved",
        entryGate: req.user.gate,
        createdBy: String(req.user._id),
      });
      await audit(req, "Recorded entry", record.passId, record.faculty);
      if (equipment) {
        const admin = await User.findOne({
          role: "admin",
          faculty: record.faculty,
          active: { $ne: false },
        });
        notify(
          admin?.email,
          "Gate pass awaiting approval",
          `Sign in to review vehicle ${record.vehicleNumber}.`,
        );
      }
      res.status(201).json(record);
    }),
  );
  app.put(
    "/vehicleRecord/status/:passId",
    roles("admin", "superadmin"),
    wrap(async (req, res) => {
      const status = v.choice(req.body, "status", ["Approved", "Rejected"]);
      const record = await VehicleRecord.findOneAndUpdate(
        {
          ...scope(req),
          passId: req.params.passId,
          approvalStatus: "Pending Approval",
          outTime: null,
        },
        {
          approvalStatus: status,
          authorizedBy: req.user.name,
          gatePassNumber: status === "Approved" ? `GP-${randomUUID()}` : "",
        },
        { returnDocument: "after" },
      );
      if (!record) v.fail("Request unavailable or already reviewed", 409);
      await audit(
        req,
        `Pass ${status.toLowerCase()}`,
        record.passId,
        record.faculty,
      );
      notify(
        process.env.SECURITY_EMAIL,
        `Gate pass ${status}`,
        `Vehicle ${record.vehicleNumber}: ${status}.`,
      );
      res.json(record);
    }),
  );
  app.put(
    "/vehicleRecord/resubmit/:passId",
    roles("security"),
    wrap(async (req, res) => {
      const notes = v.text(req.body, "entryNotes", true, 1000);
      const record = await VehicleRecord.findOneAndUpdate(
        {
          passId: req.params.passId,
          approvalStatus: "Rejected",
          outTime: null,
        },
        {
          approvalStatus: "Pending Approval",
          entryNotes: notes,
          authorizedBy: "",
          gatePassNumber: "",
        },
        { returnDocument: "after" },
      );
      if (!record) v.fail("Rejected active request not found", 409);
      await audit(
        req,
        "Resubmitted equipment request",
        record.passId,
        record.faculty,
      );
      res.json(record);
    }),
  );
  app.put(
    "/vehicleRecord/:vehicleNumber",
    roles("security"),
    wrap(async (req, res) => {
      if (!v.GATES.includes(req.user.gate)) v.fail("No gate assigned", 403);
      const exitEquipment = v.text(req.body, "exitEquipment", false, 1000),
        exitNotes = v.text(req.body, "exitNotes", false, 1000),
        number = v.plate({ vehicleNumber: req.params.vehicleNumber });
      const existing = await VehicleRecord.findOne({
        vehicleNumber: number,
        outTime: null,
      });
      if (!existing) v.fail("No active visit found", 404);
      if (existing.approvalStatus !== "Approved")
        v.fail("Equipment approval is required before exit", 409);
      if (existing.carriedEquipment && !exitEquipment)
        v.fail("Record the equipment verification before exit");
      const record = await VehicleRecord.findOneAndUpdate(
        { _id: existing._id, outTime: null, approvalStatus: "Approved" },
        {
          outTime: new Date().toISOString(),
          exitEquipment,
          exitNotes,
          exitGate: req.user.gate,
        },
        { returnDocument: "after" },
      );
      if (!record) v.fail("Visit already closed", 409);
      await audit(req, "Recorded exit", record.passId, record.faculty);
      res.json(record);
    }),
  );
  app.get(
    "/traveler",
    roles("admin", "superadmin"),
    wrap(async (req, res) =>
      res.json(
        await FrequentTraveler.find(scope(req)).sort({ name: 1 }).limit(1000),
      ),
    ),
  );
  app.get(
    "/traveler/:passId",
    verifyToken,
    wrap(async (req, res) => {
      const item = await FrequentTraveler.findOne({
        ...scope(req),
        passId: req.params.passId,
      });
      if (!item) v.fail("Staff pass not found", 404);
      res.json(item);
    }),
  );
  app.post(
    "/traveler",
    roles("admin", "superadmin"),
    wrap(async (req, res) => {
      const fields = v.traveler(req.body);
      if (req.user.role === "admin" && fields.faculty !== req.user.faculty)
        v.fail("Faculty access denied", 403);
      const item = await FrequentTraveler.create({
        ...fields,
        passId: `ST-${randomUUID()}`,
      });
      await audit(req, "Registered staff", item.passId, item.faculty);
      notify(item.email, "Your staff pass", `Your pass ID is ${item.passId}.`);
      res.status(201).json(item);
    }),
  );
  app.put(
    "/traveler/:passId",
    roles("admin", "superadmin"),
    wrap(async (req, res) => {
      const fields = v.traveler(req.body);
      if (req.user.role === "admin" && fields.faculty !== req.user.faculty)
        v.fail("Faculty access denied", 403);
      const item = await FrequentTraveler.findOneAndUpdate(
        { ...scope(req), passId: req.params.passId },
        fields,
        { returnDocument: "after" },
      );
      if (!item) v.fail("Staff pass not found", 404);
      await audit(req, "Updated staff", item.passId, item.faculty);
      notify(
        item.email,
        "Staff pass updated",
        "Your staff registration was updated. Contact security if unexpected.",
      );
      res.json(item);
    }),
  );
  app.delete(
    "/traveler/:passId",
    roles("admin", "superadmin"),
    wrap(async (req, res) => {
      const item = await FrequentTraveler.findOneAndDelete({
        ...scope(req),
        passId: req.params.passId,
      });
      if (!item) v.fail("Staff pass not found", 404);
      await audit(req, "Revoked staff pass", item.passId, item.faculty);
      notify(
        item.email,
        "Staff pass revoked",
        "Your staff pass has been revoked. Contact administration for assistance.",
      );
      res.json({ message: "Staff pass revoked" });
    }),
  );
  app.get(
    "/audit",
    roles("admin", "superadmin"),
    wrap(async (req, res) =>
      res.json(await Audit.find(scope(req)).sort({ _id: -1 }).limit(100)),
    ),
  );
  app.use((req, res) =>
    res.status(404).json({ message: "Endpoint not found" }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.code === 11000
        ? 409
        : error.status || (error.name === "ValidationError" ? 400 : 500);
    res
      .status(status)
      .json({
        message:
          error.code === 11000
            ? "An account or active vehicle visit already exists."
            : status >= 500
              ? "Service unavailable. Please try again."
              : error.message,
      });
  });
  return app;
}
module.exports = { createApp };
