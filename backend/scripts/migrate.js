const bcrypt = require("bcryptjs");
const { mongoose } = require("../src/models");

function normalizeDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d\d-\d\dT/.test(value) && !isNaN(Date.parse(value)))
    return new Date(value).toISOString();
  const order = process.env.LEGACY_DATE_ORDER,
    offset = process.env.LEGACY_UTC_OFFSET;
  if (!["MDY", "DMY"].includes(order) || !/^[+-]\d\d:\d\d$/.test(offset || ""))
    throw new Error(
      "Legacy dates need LEGACY_DATE_ORDER=MDY or DMY and LEGACY_UTC_OFFSET, for example +05:30.",
    );
  const m = String(value).match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
  );
  if (!m)
    throw new Error(
      "Unsupported legacy timestamp; review the record manually.",
    );
  const day = Number(order === "DMY" ? m[1] : m[2]),
    month = Number(order === "DMY" ? m[2] : m[1]);
  let hour = Number(m[4]);
  if (m[7]) {
    if (hour < 1 || hour > 12) throw new Error("Invalid legacy hour");
    hour = (hour % 12) + (m[7].toUpperCase() === "PM" ? 12 : 0);
  }
  const year = Number(m[3]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    Number(m[5]) > 59 ||
    Number(m[6] || 0) > 59
  )
    throw new Error("Invalid legacy date");
  const result = new Date(
    `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${m[5]}:${m[6] || "00"}${offset}`,
  );
  if (isNaN(result)) throw new Error("Invalid legacy timestamp or offset");
  return result.toISOString();
}
async function migrate() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gatewayDB",
    { autoIndex: false },
  );
  const records = await mongoose.connection
    .collection("vehiclerecords")
    .find({})
    .toArray();
  const users = await mongoose.connection
    .collection("users")
    .find({})
    .toArray();
  const active = new Set(),
    passes = new Set(),
    emails = new Set(),
    changes = [],
    userChanges = [],
    issues = [];
  for (const record of records) {
    try {
      const vehicleNumber = String(record.vehicleNumber || "")
        .toUpperCase()
        .replace(/\s+/g, "");
      if (!vehicleNumber || !record.passId || passes.has(record.passId))
        throw new Error("Missing vehicle/pass ID or duplicate pass ID");
      passes.add(record.passId);
      if (!record.outTime) {
        if (active.has(vehicleNumber))
          throw new Error(
            "Duplicate active vehicle; resolve visit history before migration",
          );
        active.add(vehicleNumber);
      }
      const inTime = normalizeDate(record.inTime);
      if (!inTime) throw new Error("Missing arrival timestamp");
      changes.push({
        updateOne: {
          filter: { _id: record._id },
          update: {
            $set: {
              vehicleNumber,
              inTime,
              outTime: normalizeDate(record.outTime),
            },
          },
        },
      });
    } catch (e) {
      issues.push({ id: String(record._id), issue: e.message });
    }
  }
  let weakAccounts = 0;
  for (const user of users) {
    const email = String(user.email || "")
      .trim()
      .toLowerCase();
    if (!email || emails.has(email))
      issues.push({
        id: String(user._id),
        issue: "Missing or duplicate normalized account identifier",
      });
    emails.add(email);
    const weak =
      typeof user.password !== "string" ||
      !user.password.startsWith("$2") ||
      (await bcrypt.compare("123", user.password));
    if (weak) weakAccounts++;
    userChanges.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: { email, ...(weak ? { active: false } : {}) },
          $inc: { sessionVersion: 1 },
        },
      },
    });
  }
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        records: records.length,
        accounts: users.length,
        knownWeakAccountsToDisable: weakAccounts,
        issues,
      },
      null,
      2,
    ),
  );
  if (issues.length)
    throw new Error("No changes applied. Resolve every reported issue first.");
  if (apply) {
    if (changes.length)
      await mongoose.connection.collection("vehiclerecords").bulkWrite(changes);
    if (userChanges.length)
      await mongoose.connection.collection("users").bulkWrite(userChanges);
    await mongoose.connection.collection("sessions").deleteMany({});
    console.log(
      "Migration complete. Known weak accounts disabled; all sessions revoked. Start the API to build indexes.",
    );
  } else
    console.log(
      "No data changed. Back up the database and stop the API before running with --apply.",
    );
}
if (require.main === module) {
  require("dotenv").config();
  migrate()
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
module.exports = { normalizeDate };
