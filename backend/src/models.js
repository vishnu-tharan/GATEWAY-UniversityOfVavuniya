const mongoose = require("mongoose");
const { Schema } = mongoose;
const User = mongoose.model(
  "User",
  new Schema(
    {
      id: String,
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      password: { type: String, required: true, select: false },
      name: String,
      role: {
        type: String,
        enum: ["admin", "security", "superadmin"],
        required: true,
      },
      gate: String,
      faculty: String,
      phone: String,
      bio: String,
      active: { type: Boolean, default: true },
      sessionVersion: { type: Number, default: 0 },
      failedLogins: { type: Number, default: 0 },
      lockedUntil: Date,
    },
    { timestamps: true },
  ),
);
const vehicleSchema = new Schema(
  {
    passId: { type: String, unique: true },
    inTime: String,
    outTime: { type: String, default: null },
    vehicleNumber: String,
    driverName: String,
    driverNIC: String,
    driverPhone: String,
    faculty: String,
    carriedEquipment: String,
    entryNotes: String,
    approvalStatus: String,
    gatePassNumber: String,
    exitEquipment: String,
    exitNotes: String,
    entryGate: String,
    exitGate: String,
    authorizedBy: String,
    createdBy: String,
  },
  { timestamps: true },
);
vehicleSchema.index(
  { vehicleNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { outTime: null },
    name: "one_active_visit_per_vehicle",
  },
);
const VehicleRecord = mongoose.model("VehicleRecord", vehicleSchema);
const FrequentTraveler = mongoose.model(
  "FrequentTraveler",
  new Schema(
    {
      passId: { type: String, unique: true },
      name: String,
      nic: String,
      email: String,
      phone: String,
      vehicleNumber: String,
      faculty: String,
    },
    { timestamps: true },
  ),
);
const Session = mongoose.model(
  "Session",
  new Schema(
    {
      tokenHash: { type: String, unique: true },
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      version: Number,
      expiresAt: { type: Date, expires: 0 },
      device: String,
    },
    { timestamps: true },
  ),
);
const Audit = mongoose.model(
  "Audit",
  new Schema(
    {
      actor: String,
      actorId: String,
      faculty: String,
      action: String,
      target: String,
    },
    { timestamps: true },
  ),
);
module.exports = {
  mongoose,
  User,
  VehicleRecord,
  FrequentTraveler,
  Session,
  Audit,
};
