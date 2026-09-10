const FACULTIES = [
  "Applied Science",
  "Business Studies",
  "Technology",
  "Other",
];
const GATES = ["Main Gate", "Tech Gate", "Ammachi Gate"];
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(body, key, required = false, max = 160) {
  const value = body?.[key];
  if (value == null && !required) return "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(`Invalid ${key}`);
  return value.trim();
}
function choice(body, key, values) {
  const value = text(body, key, true);
  if (!values.includes(value)) fail(`Invalid ${key}`);
  return value;
}
function password(value) {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    Buffer.byteLength(value, "utf8") > 72 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value)
  )
    fail(
      "Use 12+ characters with uppercase, lowercase and a number (maximum 72 bytes).",
    );
  return value;
}
function secret(body, key) {
  const value = body?.[key];
  if (typeof value !== "string" || !value || value.length > 128)
    fail(`Invalid ${key}`);
  return value;
}
function email(body) {
  const value = text(body, "email", true, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    fail("Enter a valid email address");
  return value;
}
function plate(body) {
  const value = text(body, "vehicleNumber", true, 24)
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,24}$/.test(value)) fail("Invalid vehicle number");
  return value;
}
function traveler(body) {
  return {
    name: text(body, "name", true),
    email: email(body),
    nic: text(body, "nic", true, 30),
    phone: text(body, "phone", true, 30),
    vehicleNumber: plate(body),
    faculty: choice(body, "faculty", FACULTIES),
  };
}
module.exports = {
  FACULTIES,
  GATES,
  fail,
  text,
  choice,
  password,
  secret,
  email,
  plate,
  traveler,
};
