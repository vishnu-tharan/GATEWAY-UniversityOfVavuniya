// Isolated local preview: never reads .env or connects to the real database.
const path = require("node:path");
const fs = require("node:fs");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const localMongo = "C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe";
if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(localMongo))
  process.env.MONGOMS_SYSTEM_BINARY = localMongo;
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, "../.test-mongodb");
process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = "false";
const { MongoMemoryServer } = require("mongodb-memory-server");
const { mongoose, User, VehicleRecord } = require("./src/models");
const { createApp } = require("./src/app");
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo mode is local-development only");
  delete process.env.MAIL_HOST;
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const secret = `Preview-${randomBytes(10).toString("hex")}!`;
  const password = await bcrypt.hash(secret, 12);
  await User.create([
    {
      name: "Campus Administrator",
      email: "admin@preview.test",
      password,
      role: "superadmin",
    },
    {
      name: "Nimal Perera",
      email: "officer@preview.test",
      password,
      role: "security",
      gate: "Main Gate",
    },
    {
      name: "Faculty Administrator",
      email: "dean@preview.test",
      password,
      role: "admin",
      faculty: "Applied Science",
    },
  ]);
  await VehicleRecord.init();
  for (const [index, number] of [
    "CAB-2048",
    "WP-7310",
    "CAA-4592",
    "NP-8821",
  ].entries())
    await VehicleRecord.create({
      passId: randomUUID(),
      vehicleNumber: number,
      driverName: ["S. Fernando", "K. Sivakumar", "A. Jayasinghe", "M. Rizwan"][
        index
      ],
      driverNIC: "PREVIEW-ONLY",
      driverPhone: "0000000000",
      faculty: [
        "Applied Science",
        "Technology",
        "Business Studies",
        "Applied Science",
      ][index],
      entryGate: ["Main Gate", "Tech Gate", "Ammachi Gate", "Main Gate"][index],
      inTime: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
      outTime: index === 2 ? new Date().toISOString() : null,
      approvalStatus: index === 0 ? "Pending Approval" : "Approved",
      carriedEquipment: index === 0 ? "2 demonstration laptops" : "",
    });
  const server = createApp().listen(5000, "127.0.0.1", () =>
    console.log(
      `LOCAL PREVIEW ONLY. Temporary data.\nAccounts: admin@preview.test, officer@preview.test, dean@preview.test\nPassword: ${secret}\nAPI: http://localhost:5000`,
    ),
  );
  server.on("error", async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    await mongo.stop();
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () =>
      server.close(async () => {
        await mongoose.disconnect();
        await mongo.stop();
        process.exit(0);
      }),
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
