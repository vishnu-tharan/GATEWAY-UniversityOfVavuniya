require("dotenv").config();
const bcrypt = require("bcryptjs");
const { mongoose, User } = require("./src/models");
const { password, email } = require("./src/validation");
async function seed() {
  const address = email({ email: process.env.ADMIN_EMAIL }),
    secret = password(process.env.ADMIN_PASSWORD);
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gatewayDB",
  );
  if (await User.exists({ email: address }))
    throw new Error("Account already exists; no data changed.");
  await User.create({
    email: address,
    password: await bcrypt.hash(secret, 12),
    name: process.env.ADMIN_NAME || "Gateway Administrator",
    role: "superadmin",
  });
  console.log("Administrator created. Existing accounts were preserved.");
}
seed()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
