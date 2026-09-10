const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const localMongo = "C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe";
if (!process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(localMongo)) {
  process.env.MONGOMS_SYSTEM_BINARY = localMongo;
  process.env.MONGOMS_SYSTEM_BINARY_VERSION_CHECK = "false";
}
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(
  __dirname,
  "../../.test-mongodb",
);
process.env.MONGOMS_VERSION = "8.2.1";
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const {
  mongoose,
  User,
  VehicleRecord,
  FrequentTraveler,
  Session,
  Audit,
} = require("../src/models");
const { createApp } = require("../src/app");
const { hash } = require("../middleware/authMiddleware");
const { randomBytes } = require("node:crypto");
let mongo, app, passwordHash, users, tokens;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    VehicleRecord.init(),
    Session.init(),
    FrequentTraveler.init(),
  ]);
  passwordHash = await bcrypt.hash("StrongPassword123!", 12);
});
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    VehicleRecord.deleteMany({}),
    FrequentTraveler.deleteMany({}),
    Audit.deleteMany({}),
  ]);
  app = createApp();
  users = {};
  tokens = {};
  for (const [key, role, faculty, gate] of [
    ["officer", "security", "", "Main Gate"],
    ["dean", "admin", "Applied Science", ""],
    ["other", "admin", "Technology", ""],
    ["root", "superadmin", "", ""],
  ]) {
    users[key] = await User.create({
      email: `${key}@example.edu`,
      name: key,
      password: passwordHash,
      role,
      faculty,
      gate,
    });
    tokens[key] = randomBytes(32).toString("hex");
    await Session.create({
      tokenHash: hash(tokens[key]),
      userId: users[key]._id,
      version: 0,
      expiresAt: new Date(Date.now() + 3600000),
    });
  }
});
function call(method, url, who = "officer", body) {
  const req = request(app)[method](url).set("X-Gateway-Client", "gateway");
  if (who) req.set("Authorization", `Bearer ${tokens[who]}`);
  return body === undefined ? req : req.send(body);
}
const entry = (extra) => ({
  vehicleNumber: "CAB-1234",
  driverName: "Visitor",
  driverNIC: "123456789V",
  driverPhone: "0771234567",
  faculty: "Applied Science",
  ...extra,
});
async function enter(extra) {
  const result = await call("post", "/vehicleRecord", "officer", entry(extra));
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return result.body;
}
test("anonymous access, forged tokens, CSRF and untrusted origins are rejected", async () => {
  assert.equal((await request(app).get("/vehicleRecord")).status, 401);
  assert.equal(
    (
      await request(app)
        .get("/user/me")
        .set("Authorization", `Bearer ${"a".repeat(64)}`)
    ).status,
    401,
  );
  assert.equal((await request(app).post("/user/login").send({})).status, 403);
  assert.equal(
    (
      await call("post", "/user/login", null, {}).set(
        "Origin",
        "https://evil.example",
      )
    ).status,
    403,
  );
});
test("browser login uses HttpOnly SameSite cookie and hides bearer token", async () => {
  const res = await call("post", "/user/login", null, {
    email: "root@example.edu",
    password: "StrongPassword123!",
  }).set("Origin", "http://localhost:8081");
  assert.equal(res.status, 200);
  assert.equal(res.body.token, undefined);
  assert.equal(res.body.user.password, undefined);
  const cookie = res.headers["set-cookie"][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(
    (await request(app).get("/user/me").set("Cookie", cookie.split(";")[0]))
      .status,
    200,
  );
});
test("native login token is hashed in the database and logout revokes it", async () => {
  const res = await call("post", "/user/login", null, {
    email: "root@example.edu",
    password: "StrongPassword123!",
  });
  assert.equal(res.status, 200);
  assert.ok(await Session.exists({ tokenHash: hash(res.body.token) }));
  await request(app)
    .post("/user/logout")
    .set("X-Gateway-Client", "gateway")
    .set("Authorization", `Bearer ${res.body.token}`)
    .expect(200);
  await request(app)
    .get("/user/me")
    .set("Authorization", `Bearer ${res.body.token}`)
    .expect(401);
});
test("NoSQL login payload and oversized input are rejected", async () => {
  assert.equal(
    (
      await call("post", "/user/login", null, {
        email: { $ne: null },
        password: "x",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "post",
        "/vehicleRecord",
        "officer",
        entry({ driverName: "a".repeat(161) }),
      )
    ).status,
    400,
  );
});
test("original weak credentials cannot sign in and password whitespace is preserved", async () => {
  await User.updateOne(
    { _id: users.officer._id },
    { password: await bcrypt.hash("123", 12) },
  );
  assert.equal(
    (
      await call("post", "/user/login", null, {
        email: "officer@example.edu",
        password: "123",
      })
    ).status,
    401,
  );
  const spaced = " StrongPassword123! ";
  await User.updateOne(
    { _id: users.officer._id },
    { password: await bcrypt.hash(spaced, 12) },
  );
  assert.equal(
    (
      await call("post", "/user/login", null, {
        email: "officer@example.edu",
        password: spaced,
      })
    ).status,
    200,
  );
});
test("five incorrect passwords temporarily lock the account", async () => {
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call("post", "/user/login", null, {
          email: "root@example.edu",
          password: "wrong",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await call("post", "/user/login", null, {
        email: "root@example.edu",
        password: "StrongPassword123!",
      })
    ).status,
    401,
  );
});
test("server owns approval state, gate, pass ID and timestamps", async () => {
  const record = await enter({
    carriedEquipment: "2 laptops",
    approvalStatus: "Approved",
    authorizedBy: "Forged dean",
    entryGate: "Tech Gate",
    inTime: "1990-01-01",
    outTime: "now",
    passId: "fake",
  });
  assert.equal(record.approvalStatus, "Pending Approval");
  assert.equal(record.entryGate, "Main Gate");
  assert.equal(record.outTime, null);
  assert.notEqual(record.passId, "fake");
  assert.equal(record.authorizedBy, undefined);
  assert.match(record.inTime, /^\d{4}-\d\d-\d\dT/);
});
test("concurrent entries allow only one active visit; normalized plates cannot bypass uniqueness", async () => {
  const results = await Promise.all([
    call("post", "/vehicleRecord", "officer", entry()),
    call(
      "post",
      "/vehicleRecord",
      "officer",
      entry({ vehicleNumber: "cab- 1234" }),
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await VehicleRecord.countDocuments(), 1);
});
test("faculty isolation applies to reads, dashboard and approval writes", async () => {
  const item = await enter({ carriedEquipment: "Laptop" });
  assert.equal((await call("get", "/vehicleRecord", "other")).body.total, 0);
  assert.equal((await call("get", "/dashboard", "other")).body.inside, 0);
  assert.equal(
    (
      await call("put", `/vehicleRecord/status/${item.passId}`, "other", {
        status: "Approved",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("put", `/vehicleRecord/status/${item.passId}`, "officer", {
        status: "Approved",
      })
    ).status,
    403,
  );
});
test("pending and rejected equipment exits are blocked; rejected requests can be resubmitted", async () => {
  const item = await enter({ carriedEquipment: "Laptop" });
  assert.equal(
    (await call("put", "/vehicleRecord/CAB-1234", "officer", {})).status,
    409,
  );
  await call("put", `/vehicleRecord/status/${item.passId}`, "dean", {
    status: "Rejected",
  });
  assert.equal(
    (await call("put", "/vehicleRecord/CAB-1234", "officer", {})).status,
    409,
  );
  assert.equal(
    (
      await call("put", `/vehicleRecord/resubmit/${item.passId}`, "officer", {
        entryNotes: "Corrected ownership documentation provided",
      })
    ).status,
    200,
  );
  assert.equal(
    (await VehicleRecord.findOne()).approvalStatus,
    "Pending Approval",
  );
});
test("approval is atomic, attributed to the authenticated administrator and requires exit verification", async () => {
  const item = await enter({ carriedEquipment: "Laptop" });
  const results = await Promise.all([
    call("put", `/vehicleRecord/status/${item.passId}`, "dean", {
      status: "Approved",
      authorizedBy: "fake",
    }),
    call("put", `/vehicleRecord/status/${item.passId}`, "dean", {
      status: "Rejected",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const record = await VehicleRecord.findOne();
  assert.equal(record.authorizedBy, "dean");
  if (record.approvalStatus === "Rejected") {
    await call("put", `/vehicleRecord/resubmit/${item.passId}`, "officer", {
      entryNotes: "Ownership verified",
    });
    await call("put", `/vehicleRecord/status/${item.passId}`, "dean", {
      status: "Approved",
    });
  }
  assert.equal(
    (await call("put", "/vehicleRecord/CAB-1234", "officer", {})).status,
    400,
  );
  assert.equal(
    (
      await call("put", "/vehicleRecord/CAB-1234", "officer", {
        exitEquipment: "Laptop serial checked",
        exitGate: "fake",
        outTime: "1990",
      })
    ).status,
    200,
  );
  assert.equal((await VehicleRecord.findOne()).exitGate, "Main Gate");
});
test("concurrent departures close a visit only once; returning vehicles may enter again", async () => {
  await enter();
  const results = await Promise.all([
    call("put", "/vehicleRecord/CAB-1234", "officer", {}),
    call("put", "/vehicleRecord/CAB-1234", "officer", {}),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  await enter();
  assert.equal(await VehicleRecord.countDocuments(), 2);
});
test("only campus administrators create accounts and weak passwords are rejected", async () => {
  const body = {
    email: "new@example.edu",
    name: "New Officer",
    role: "security",
    gate: "Tech Gate",
    password: "StrongPassword123!",
  };
  assert.equal((await call("post", "/user", "dean", body)).status, 403);
  assert.equal(
    (await call("post", "/user", "root", { ...body, password: "123" })).status,
    400,
  );
  assert.equal((await call("post", "/user", "root", body)).status, 201);
  assert.equal(
    (await call("get", "/user", "root")).body.some((u) => u.password),
    false,
  );
});
test("profile edits cannot escalate role or alter faculty, email, or gate", async () => {
  const res = await call("put", "/user/me", "officer", {
    name: "Updated",
    phone: "123",
    bio: "Gate team",
    role: "superadmin",
    faculty: "Technology",
    email: "hacker@example.edu",
    gate: "Tech Gate",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Updated");
  assert.equal(res.body.role, "security");
  assert.equal(res.body.gate, "Main Gate");
  assert.equal(res.body.email, "officer@example.edu");
});
test("password changes require current password and revoke every session", async () => {
  assert.equal(
    (
      await call("post", "/user/password", "officer", {
        currentPassword: "wrong",
        newPassword: "NewStrongPassword123!",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("post", "/user/password", "officer", {
        currentPassword: "StrongPassword123!",
        newPassword: "NewStrongPassword123!",
      })
    ).status,
    200,
  );
  assert.equal((await call("get", "/user/me")).status, 401);
  assert.equal(
    (
      await call("post", "/user/login", null, {
        email: "officer@example.edu",
        password: "NewStrongPassword123!",
      })
    ).status,
    200,
  );
});
test("disabled accounts and expired sessions lose access immediately", async () => {
  assert.equal(
    (await call("delete", `/user/${users.officer._id}`, "root")).status,
    200,
  );
  assert.equal((await call("get", "/vehicleRecord")).status, 401);
  await Session.updateOne(
    { userId: users.dean._id },
    { expiresAt: new Date(0) },
  );
  assert.equal((await call("get", "/user/me", "dean")).status, 401);
});
test("sign out other devices preserves only the current session", async () => {
  const login = await call("post", "/user/login", null, {
    email: "officer@example.edu",
    password: "StrongPassword123!",
  });
  await call("post", "/user/revoke-sessions", "officer", {});
  assert.equal((await call("get", "/user/me")).status, 200);
  await request(app)
    .get("/user/me")
    .set("Authorization", `Bearer ${login.body.token}`)
    .expect(401);
});
test("staff registration is faculty scoped and forbids pass ID replacement", async () => {
  const person = {
    name: "Staff Person",
    email: "staff@example.edu",
    nic: "123",
    phone: "0771234567",
    vehicleNumber: "ABC-9999",
    faculty: "Applied Science",
    passId: "ST-forged",
  };
  assert.equal(
    (await call("post", "/traveler", "officer", person)).status,
    403,
  );
  assert.equal((await call("post", "/traveler", "other", person)).status, 403);
  const res = await call("post", "/traveler", "dean", person);
  assert.equal(res.status, 201);
  assert.notEqual(res.body.passId, person.passId);
  assert.equal(
    (await call("get", `/traveler/${res.body.passId}`, "other")).status,
    404,
  );
  const updated = await call("put", `/traveler/${res.body.passId}`, "dean", {
    ...person,
    name: "Updated Staff",
  });
  assert.equal(updated.body.passId, res.body.passId);
  assert.equal((await call("get", `/traveler/${res.body.passId}`)).status, 200);
  await call("delete", `/traveler/${res.body.passId}`, "dean");
  assert.equal((await call("get", `/traveler/${res.body.passId}`)).status, 404);
});
test("search escapes regex, reports validate dates, audit is scoped and read-only", async () => {
  await enter();
  assert.equal((await call("get", "/vehicleRecord?search=.*")).body.total, 0);
  assert.equal(
    (await call("get", "/vehicleRecord?from=invalid&to=invalid")).status,
    400,
  );
  assert.equal((await call("get", "/audit", "other")).body.length, 0);
  assert.equal(
    (await call("get", "/audit", "dean")).body[0].action,
    "Recorded entry",
  );
  assert.equal((await call("get", "/audit", "officer")).status, 403);
});
