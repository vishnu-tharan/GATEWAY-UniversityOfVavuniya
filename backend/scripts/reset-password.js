require("dotenv").config();
const bcrypt = require("bcryptjs");
const { mongoose, User, Session, Audit } = require("../src/models");
const { password, text } = require("../src/validation");
async function reset() {
  const identifier = text(
    { email: process.env.RESET_EMAIL },
    "email",
    true,
    254,
  ).toLowerCase();
  const secret = password(process.env.RESET_PASSWORD);
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gatewayDB",
  );
  const user = await User.findOneAndUpdate(
    { email: identifier },
    {
      $set: {
        password: await bcrypt.hash(secret, 12),
        active: true,
        failedLogins: 0,
        lockedUntil: null,
      },
      $inc: { sessionVersion: 1 },
    },
  );
  if (!user) throw new Error("Account not found");
  await Session.deleteMany({ userId: user._id });
  await Audit.create({
    actor: "Local administrator recovery",
    actorId: "maintenance",
    faculty: user.faculty,
    action: "Reset account password",
    target: String(user._id),
  });
  console.log(
    "Account recovered and existing sessions revoked. Clear RESET_PASSWORD from your environment.",
  );
}
reset()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
