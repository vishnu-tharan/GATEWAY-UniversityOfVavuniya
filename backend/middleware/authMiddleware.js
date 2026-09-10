const { createHash } = require("node:crypto");
const { Session, User } = require("../src/models");
const hash = (token) => createHash("sha256").update(token).digest("hex");
const verifyToken = async (req, res, next) => {
  try {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("gateway_session="));
    const token =
      req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] ||
      cookie?.slice(16);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      return res.status(401).json({ message: "Please sign in" });
    const session = await Session.findOne({
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    });
    const user = session && (await User.findById(session.userId));
    if (
      !user ||
      user.active === false ||
      (user.sessionVersion || 0) !== session.version
    )
      return res
        .status(401)
        .json({ message: "Session expired. Please sign in again." });
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
};
const roles = (...allowed) => [
  verifyToken,
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ message: "You do not have permission for this action" }),
];
module.exports = { hash, verifyToken, roles };
