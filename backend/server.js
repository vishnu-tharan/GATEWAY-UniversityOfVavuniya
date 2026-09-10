require("dotenv").config();
const { createApp } = require("./src/app");
const { mongoose, User, VehicleRecord } = require("./src/models");
async function start() {
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gatewayDB",
  );
  await Promise.all([User.init(), VehicleRecord.init()]);
  const server = createApp().listen(process.env.PORT || 5000, "0.0.0.0", () =>
    console.log("Gateway API ready"),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () =>
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      }),
    );
}
start().catch(() => {
  console.error(
    "Startup failed. Check database connectivity and unique indexes; see README.",
  );
  process.exit(1);
});
