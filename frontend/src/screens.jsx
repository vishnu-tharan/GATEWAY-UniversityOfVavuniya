import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { saveReport } from "./report";
import { api } from "./api";
import {
  Badge,
  Button,
  Choices,
  Dialog,
  Empty,
  Field,
  Message,
  colors,
  date,
  s,
} from "./ui";

const faculties = [
  "Applied Science",
  "Business Studies",
  "Technology",
  "Other",
];
const gates = ["Main Gate", "Tech Gate", "Ammachi Gate"];
const blankEntry = {
  vehicleNumber: "",
  driverName: "",
  driverNIC: "",
  driverPhone: "",
  faculty: faculties[0],
  carriedEquipment: "",
  entryNotes: "",
};
function Heading({ title, subtitle, action }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", marginBottom: 2 }]}>
      <View style={{ flex: 1, minWidth: 200, gap: 7 }}>
        <Text style={[s.title, { fontSize: 28 }]}>{title}</Text>
        <Text style={s.muted}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}
function useLoad(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await api(path);
      if (id === requestId.current) setData(result);
    } catch (e) {
      if (id === requestId.current) setError(e.message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
    // This ref is a request generation counter, not a DOM node. Invalidate pending responses.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
function LoadState({ state }) {
  return (
    <>
      <Message text={state.error} error />
      {state.loading && <ActivityIndicator color={colors.green} />}
      {state.error && (
        <Button title="Try again" secondary onPress={state.reload} />
      )}
    </>
  );
}
function RecordCard({ item, onOpen }) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: 17,
        gap: 11,
      }}
    >
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={[s.row, { flex: 1, minWidth: 180 }]}>
          <View
            style={{
              padding: 12,
              borderRadius: 11,
              backgroundColor: colors.bg,
            }}
          >
            <Feather name="truck" size={19} color={colors.green} />
          </View>
          <View>
            <Text style={[s.text, { fontWeight: "700", letterSpacing: 0.5 }]}>
              {item.vehicleNumber}
            </Text>
            <Text style={s.muted}>
              {item.driverName} · {item.faculty}
            </Text>
          </View>
        </View>
        <Badge status={item.outTime ? "Exited" : item.approvalStatus} />
        {onOpen && (
          <Button
            title="View details"
            secondary
            small
            onPress={() => onOpen(item)}
          />
        )}
      </View>
      <Text style={[s.muted, { fontSize: 11 }]}>
        {item.entryGate} · Arrived {date(item.inTime)}
        {item.outTime ? ` · Exited ${date(item.outTime)}` : ""}
      </Text>
    </View>
  );
}

export function Dashboard({ user, navigate }) {
  const state = useLoad("/dashboard");
  useEffect(() => {
    const timer = setInterval(state.reload, 30000);
    return () => clearInterval(timer);
  }, [state.reload]);
  return (
    <>
      <Heading
        title={`Welcome, ${user.name.split(" ")[0]}.`}
        subtitle="Your campus at a glance. Let’s keep things moving."
        action={
          <Button
            title="Refresh"
            icon="refresh-cw"
            secondary
            onPress={state.reload}
            busy={state.loading}
          />
        }
      />
      <LoadState state={state} />
      <View
        style={{
          backgroundColor: "#e3eee5",
          borderRadius: 18,
          padding: 27,
          gap: 15,
          borderWidth: 1,
          borderColor: "#d3e2d5",
        }}
      >
        <View style={s.row}>
          <Feather name="sun" size={19} color={colors.green} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: colors.green,
              letterSpacing: 1.6,
            }}
          >
            CAMPUS OPERATIONS
          </Text>
        </View>
        <Text style={[s.title, { maxWidth: 550 }]}>
          Every arrival starts with you.
        </Text>
        <Text style={[s.muted, { maxWidth: 550 }]}>
          Check arrivals across all three gates, keep equipment movements
          accountable, and find the details you need in seconds.
        </Text>
        <View style={s.row}>
          <Button
            title={
              user.role === "security"
                ? "Record an arrival"
                : "Review approvals"
            }
            icon={user.role === "security" ? "plus" : "check-square"}
            onPress={() =>
              navigate(user.role === "security" ? "Vehicle entry" : "Approvals")
            }
          />
          <Button
            title="Explore vehicle records"
            secondary
            onPress={() => navigate("Vehicle records")}
          />
        </View>
      </View>
      <View style={[s.row, { alignItems: "stretch" }]}>
        {[
          [
            "Vehicles inside",
            state.data?.inside,
            "truck",
            "Current active visits",
          ],
          [
            "Awaiting approval",
            state.data?.pending,
            "clock",
            "Equipment requests",
          ],
          ["Arrivals today", state.data?.today, "log-in", "Since midnight UTC"],
        ].map(([label, value, icon, description]) => (
          <View key={label} style={[s.card, { flex: 1, minWidth: 200 }]}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Text style={s.muted}>{label}</Text>
              <Feather name={icon} size={18} color={colors.green} />
            </View>
            <Text
              style={{
                fontSize: 38,
                fontWeight: "700",
                color: colors.ink,
                letterSpacing: -1,
              }}
            >
              {value ?? "—"}
            </Text>
            <Text style={[s.muted, { fontSize: 11 }]}>{description}</Text>
          </View>
        ))}
      </View>
      <View style={[s.row, { alignItems: "stretch" }]}>
        <View style={[s.card, { flex: 2, minWidth: 270 }]}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.title}>Recent movements</Text>
            <Text style={[s.muted, { fontSize: 11 }]}>
              Refreshes every 30 seconds
            </Text>
          </View>
          {state.data?.recent?.length
            ? state.data.recent.map((item) => (
                <RecordCard item={item} key={item.passId} />
              ))
            : !state.loading && (
                <Empty
                  title="A fresh start"
                  detail="Vehicle movements will appear after the first entry."
                />
              )}
        </View>
        <View style={[s.card, { flex: 1, minWidth: 250 }]}>
          <Text style={s.title}>Around the gates</Text>
          <Text style={s.muted}>Active visits by entry gate</Text>
          {state.data?.gates.map((item, index) => (
            <View
              key={item.gate}
              style={{
                paddingVertical: 15,
                gap: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <View style={s.row}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    0{index + 1}
                  </Text>
                  <Text style={[s.text, { fontWeight: "600" }]}>
                    {item.gate}
                  </Text>
                </View>
                <Text style={[s.text, { fontWeight: "700" }]}>
                  {item.inside}
                </Text>
              </View>
              <View
                style={{
                  height: 5,
                  borderRadius: 4,
                  backgroundColor: "#eef2ef",
                }}
              >
                <View
                  style={{
                    height: 5,
                    borderRadius: 4,
                    backgroundColor: "#79a58b",
                    width: `${state.data.inside ? (item.inside / state.data.inside) * 100 : 0}%`,
                  }}
                />
              </View>
            </View>
          ))}
          <Text style={[s.muted, { fontSize: 11 }]}>
            Counts reflect your permitted faculty scope. They do not indicate
            whether a gate is staffed.
          </Text>
        </View>
      </View>
    </>
  );
}

export function Entry({ user }) {
  const [form, setForm] = useState({ ...blankEntry }),
    [pass, setPass] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scan, setScan] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  async function lookup(value = pass) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const person = await api(`/traveler/${encodeURIComponent(value.trim())}`);
      setForm({
        ...blankEntry,
        vehicleNumber: person.vehicleNumber,
        driverName: person.name,
        driverNIC: person.nic,
        driverPhone: person.phone,
        faculty: person.faculty,
      });
      setMessage(
        "Staff details loaded. Verify identity and equipment before recording entry.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api("/vehicleRecord", "POST", form);
      setForm({ ...blankEntry });
      setPass("");
      setMessage(
        `Arrival recorded for ${result.vehicleNumber}. ${result.approvalStatus === "Pending Approval" ? "Equipment approval is now required before exit." : "Vehicle is now inside."}`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Record an arrival"
        subtitle={`You’re recording entry at ${user.gate}.`}
      />
      <Message text={error} error />
      <Message text={message} />
      <View style={[s.card, { gap: 14 }]}>
        <Text style={s.title}>Staff rapid entry</Text>
        <Text style={s.muted}>
          Look up a registered pass or scan its QR code. Always verify the
          person presenting it.
        </Text>
        <Field
          label="Staff pass ID"
          value={pass}
          onChange={setPass}
          placeholder="ST-…"
        />
        <View style={s.row}>
          <Button
            title="Find staff pass"
            icon="search"
            secondary
            onPress={() => lookup()}
            disabled={!pass.trim()}
            busy={busy}
          />
          <Button
            title="Scan QR code"
            icon="camera"
            secondary
            onPress={async () => {
              try {
                const result = permission?.granted
                  ? permission
                  : await requestPermission();
                if (result.granted) {
                  scanLock.current = false;
                  setScan(true);
                } else
                  setError(
                    "Camera permission was denied. Enter the pass ID instead.",
                  );
              } catch {
                setError("Camera unavailable. Enter the pass ID instead.");
              }
            }}
          />
        </View>
      </View>
      <View style={[s.card, { maxWidth: 850 }]}>
        <Text style={s.title}>Vehicle & visitor details</Text>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 1, minWidth: 220, gap: 18 }}>
            <Field
              label="Vehicle number *"
              value={form.vehicleNumber}
              onChange={(value) => change("vehicleNumber", value)}
              placeholder="CAB-1234"
            />
            <Field
              label="Driver name *"
              value={form.driverName}
              onChange={(value) => change("driverName", value)}
            />
            <Field
              label="NIC / identity number *"
              value={form.driverNIC}
              onChange={(value) => change("driverNIC", value)}
            />
          </View>
          <View style={{ flex: 1, minWidth: 220, gap: 18 }}>
            <Field
              label="Phone number *"
              value={form.driverPhone}
              onChange={(value) => change("driverPhone", value)}
              keyboardType="phone-pad"
            />
            <Field
              label="Carried equipment"
              value={form.carriedEquipment}
              onChange={(value) => change("carriedEquipment", value)}
              placeholder="Describe items, quantities and serial numbers"
              multiline
            />
          </View>
        </View>
        <Choices
          label="Destination faculty *"
          options={faculties}
          value={form.faculty}
          onChange={(value) => change("faculty", value)}
        />
        <Field
          label="Entry notes"
          value={form.entryNotes}
          onChange={(value) => change("entryNotes", value)}
          multiline
        />
        <Text style={s.muted}>
          Equipment entries require faculty approval. Entry time and your gate
          are recorded automatically.
        </Text>
        <Button
          title="Confirm vehicle entry"
          icon="log-in"
          onPress={submit}
          busy={busy}
          disabled={[
            "vehicleNumber",
            "driverName",
            "driverNIC",
            "driverPhone",
          ].some((key) => !form[key].trim())}
        />
      </View>
      {scan && (
        <Dialog title="Scan staff pass" onClose={() => setScan(false)}>
          <CameraView
            style={{ height: 320 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (scanLock.current) return;
              scanLock.current = true;
              setScan(false);
              if (!/^ST-[a-zA-Z0-9-]{4,80}$/.test(data)) {
                setError("This is not a valid staff pass.");
                return;
              }
              setPass(data);
              lookup(data);
            }}
          />
          <Text style={s.muted}>
            Only registered staff pass IDs are accepted.
          </Text>
        </Dialog>
      )}
    </>
  );
}
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function exportReport(query, faculty) {
  let page = 1,
    items = [],
    result;
  do {
    result = await api(`/vehicleRecord?${query}&page=${page++}`);
    items.push(...result.items);
    if (items.length > 3000)
      throw new Error(
        "Choose a smaller date range (maximum 3,000 records per report).",
      );
  } while (page <= result.pages);
  if (!items.length) throw new Error("No records match this report period.");
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#183c37;padding:28px}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:10px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}th{background:#e3eee5}footer{font-size:10px;margin-top:20px}</style></head><body><h1>University of Vavuniya · Gateway</h1><p>${escapeHtml(faculty || "Campus")} · ${items.length} movements · Generated ${escapeHtml(new Date().toLocaleString())}</p><table><thead><tr><th>Vehicle / Pass</th><th>Driver</th><th>Faculty</th><th>Arrival</th><th>Departure</th><th>Status</th></tr></thead><tbody>${items.map((r) => `<tr>${[`${r.vehicleNumber} / ${r.gatePassNumber || r.passId}`, r.driverName, r.faculty, `${date(r.inTime)} / ${r.entryGate}`, r.outTime ? `${date(r.outTime)} / ${r.exitGate}` : "Inside", r.approvalStatus].map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table><footer>Confidential university operations report. Store and share only with authorized personnel.</footer></body></html>`;
  await saveReport({ html, items, faculty });
}
export function Records({ mode, user }) {
  const [search, setSearch] = useState(""),
    [committed, setCommitted] = useState(""),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("All"),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [exitEquipment, setExitEquipment] = useState(""),
    [exitNotes, setExitNotes] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10)),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [range, setRange] = useState("");
  const status =
    mode === "Approvals"
      ? "pending"
      : mode === "Vehicle exit" || filter === "Inside"
        ? "inside"
        : filter === "Pending"
          ? "pending"
          : "";
  const query = `status=${status}&search=${encodeURIComponent(committed)}${range}`;
  const state = useLoad(`/vehicleRecord?${query}&page=${page}`);
  async function mutate(path, body) {
    setBusy(true);
    setError("");
    try {
      await api(path, "PUT", body);
      setSelected(null);
      setMessage("Record updated successfully.");
      await state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function open(item) {
    setSelected(item);
    setExitEquipment("");
    setExitNotes("");
    setError("");
  }
  function applyRange() {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      Number.isNaN(Date.parse(from)) ||
      Number.isNaN(Date.parse(to)) ||
      new Date(from).toISOString().slice(0, 10) !== from ||
      new Date(to).toISOString().slice(0, 10) !== to ||
      from > to
    ) {
      setError("Enter a valid start and end date in YYYY-MM-DD format.");
      return;
    }
    setError("");
    setPage(1);
    setRange(
      `&from=${encodeURIComponent(new Date(`${from}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${to}T23:59:59.999`).toISOString())}`,
    );
  }
  return (
    <>
      <Heading
        title={mode}
        subtitle={
          mode === "Approvals"
            ? "Review equipment requests for your permitted faculty."
            : mode === "Reports"
              ? "Filter movements, then download or share a PDF report."
              : mode === "Vehicle exit"
                ? "Select a vehicle, verify equipment, and confirm departure."
                : "A complete history of arrivals, approvals and departures."
        }
        action={
          <Button
            title="Refresh"
            icon="refresh-cw"
            secondary
            onPress={state.reload}
            busy={state.loading}
          />
        }
      />
      <Message text={message} />
      <Message text={!selected ? error : ""} error />
      {mode === "Reports" && (
        <View style={s.card}>
          <View style={s.row}>
            <Field
              label="Start date (YYYY-MM-DD)"
              value={from}
              onChange={value => { setFrom(value); setRange(''); }}
            />
            <Field label="End date (YYYY-MM-DD)" value={to} onChange={value => { setTo(value); setRange(''); }} />
            <Button title="Apply dates" onPress={applyRange} />
            <Button
              title={Platform.OS === "web" ? "Download PDF" : "Share PDF"}
              icon="download"
              secondary
              busy={busy}
              disabled={!range}
              onPress={async () => {
                setBusy(true);
                setError("");
                try {
                  await exportReport(query, user.faculty);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
          <Text style={s.muted}>
            Apply dates before exporting. Reports include every matching page,
            up to 3,000 records. Times use your device’s timezone.
          </Text>
        </View>
      )}
      <View style={s.card}>
        <View style={s.row}>
          <Field
            label="Search movements"
            placeholder="Vehicle, driver or pass number"
            value={search}
            onChange={setSearch}
          />
          <Button
            title="Search"
            icon="search"
            secondary
            onPress={() => {
              setCommitted(search);
              setPage(1);
            }}
          />
        </View>
        {["Vehicle records", "Reports"].includes(mode) && (
          <Choices
            label="Show"
            options={["All", "Inside", "Pending"]}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          />
        )}
        <LoadState state={state} />
        <Text style={s.muted}>
          {state.data?.total ?? "—"} matching movements
        </Text>
        {!state.loading && !state.error && state.data?.items.length === 0 && (
          <Empty
            title={
              mode === "Approvals"
                ? "You’re all caught up"
                : "No matching movements"
            }
            detail="Try another search or refresh to check for new activity."
          />
        )}
        {state.data?.items.map((item) => (
          <RecordCard key={item.passId} item={item} onOpen={open} />
        ))}
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Button
            title="Previous"
            secondary
            disabled={page <= 1 || state.loading}
            onPress={() => setPage(page - 1)}
          />
          <Text style={s.muted}>
            Page {page} of {Math.max(1, state.data?.pages || 1)}
          </Text>
          <Button
            title="Next"
            secondary
            disabled={!state.data || page >= state.data.pages || state.loading}
            onPress={() => setPage(page + 1)}
          />
        </View>
      </View>
      {selected && (
        <Dialog
          title={selected.vehicleNumber}
          onClose={() => !busy && setSelected(null)}
        >
          <Badge
            status={selected.outTime ? "Exited" : selected.approvalStatus}
          />
          <Message text={error} error />
          {[
            ["Driver", selected.driverName],
            ["Phone", selected.driverPhone],
            ["Identity number", selected.driverNIC],
            ["Faculty", selected.faculty],
            ["Entry", `${date(selected.inTime)} · ${selected.entryGate}`],
            ["Equipment", selected.carriedEquipment || "None declared"],
            ["Entry notes", selected.entryNotes || "—"],
            ["Approved / reviewed by", selected.authorizedBy || "—"],
            ["Pass ID", selected.gatePassNumber || selected.passId],
            [
              "Departure",
              selected.outTime
                ? `${date(selected.outTime)} · ${selected.exitGate}`
                : "Still inside",
            ],
            ["Exit equipment verification", selected.exitEquipment || "—"],
            ["Exit notes", selected.exitNotes || "—"],
          ].map(([label, value]) => (
            <View key={label}>
              <Text style={s.label}>{label}</Text>
              <Text selectable style={s.text}>
                {value}
              </Text>
            </View>
          ))}
          {user.role !== "security" &&
            selected.approvalStatus === "Pending Approval" &&
            !selected.outTime && (
              <View style={s.row}>
                <Button
                  title="Approve equipment"
                  icon="check"
                  busy={busy}
                  onPress={() =>
                    mutate(`/vehicleRecord/status/${selected.passId}`, {
                      status: "Approved",
                    })
                  }
                />
                <Button
                  title="Reject request"
                  danger
                  busy={busy}
                  onPress={() =>
                    mutate(`/vehicleRecord/status/${selected.passId}`, {
                      status: "Rejected",
                    })
                  }
                />
              </View>
            )}
          {user.role === "security" && !selected.outTime && (
            <>
              <View style={s.divider} />
              <Text style={s.title}>Departure verification</Text>
              <Field
                label="Equipment verification"
                value={exitEquipment}
                onChange={setExitEquipment}
                placeholder="Record items checked against the approved pass"
                multiline
              />
              <Field
                label="Exit notes"
                value={exitNotes}
                onChange={setExitNotes}
                multiline
              />
              {selected.approvalStatus !== "Approved" && (
                <Message
                  text="Exit is blocked until this equipment request is approved. A rejected request can be corrected and resubmitted."
                  error
                />
              )}
              <Button
                title="Confirm vehicle exit"
                icon="log-out"
                busy={busy}
                disabled={
                  selected.approvalStatus !== "Approved" ||
                  (!!selected.carriedEquipment && !exitEquipment.trim())
                }
                onPress={() =>
                  mutate(
                    `/vehicleRecord/${encodeURIComponent(selected.vehicleNumber)}`,
                    { exitEquipment, exitNotes },
                  )
                }
              />
              {selected.approvalStatus === "Rejected" && (
                <Button
                  title="Resubmit for review"
                  secondary
                  busy={busy}
                  onPress={() =>
                    mutate(`/vehicleRecord/resubmit/${selected.passId}`, {
                      entryNotes: exitNotes,
                    })
                  }
                />
              )}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}

export function Staff({ user }) {
  const state = useLoad("/traveler");
  const blank = {
    name: "",
    email: "",
    nic: "",
    phone: "",
    vehicleNumber: "",
    faculty: user.faculty || faculties[0],
  };
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [revoke, setRevoke] = useState(null),
    [pass, setPass] = useState(null);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(
        form.passId ? `/traveler/${form.passId}` : "/traveler",
        form.passId ? "PUT" : "POST",
        form,
      );
      setForm(null);
      await state.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const people = (state.data || []).filter((person) =>
    `${person.name} ${person.vehicleNumber} ${person.passId}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Staff passes"
        subtitle="Register frequent travelers and keep their access details up to date."
        action={
          <Button
            title="Register staff"
            icon="plus"
            onPress={() => {
              setForm({ ...blank });
              setError("");
            }}
          />
        }
      />
      <LoadState state={state} />
      <Field
        label="Find a staff member"
        value={search}
        onChange={setSearch}
        placeholder="Name, vehicle or pass ID"
      />
      <View style={s.card}>
        {!people.length && !state.loading && (
          <Empty
            title="No staff passes found"
            detail="Register a staff member to enable rapid entry."
          />
        )}
        {people.map((person) => (
          <View
            key={person.passId}
            style={{
              paddingVertical: 15,
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <View>
                <Text style={[s.text, { fontWeight: "700" }]}>
                  {person.name}
                </Text>
                <Text style={s.muted}>
                  {person.vehicleNumber} · {person.faculty}
                </Text>
                <Text style={s.muted}>{person.email}</Text>
              </View>
              <View style={s.row}>
                <Button
                  title="Pass"
                  icon="credit-card"
                  small
                  secondary
                  onPress={() => setPass(person)}
                />
                <Button
                  title="Edit"
                  small
                  secondary
                  onPress={() => {
                    setForm({ ...person });
                    setError("");
                  }}
                />
                <Button
                  title="Revoke"
                  small
                  danger
                  onPress={() => {
                    setRevoke(person);
                    setError("");
                  }}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
      {form && (
        <Dialog
          title={form.passId ? "Edit staff details" : "Register staff"}
          onClose={() => !busy && setForm(null)}
        >
          <Message text={error} error />
          {[
            ["name", "Full name"],
            ["email", "Email address"],
            ["nic", "NIC / identity number"],
            ["phone", "Phone number"],
            ["vehicleNumber", "Vehicle number"],
          ].map(([key, label]) => (
            <Field
              key={key}
              label={`${label} *`}
              value={form[key]}
              keyboardType={
                key === "email"
                  ? "email-address"
                  : key === "phone"
                    ? "phone-pad"
                    : "default"
              }
              onChange={(value) => setForm({ ...form, [key]: value })}
            />
          ))}
          <Choices
            label="Faculty"
            options={user.role === "admin" ? [user.faculty] : faculties}
            value={form.faculty}
            onChange={(value) => setForm({ ...form, faculty: value })}
          />
          <Button
            title="Save staff details"
            busy={busy}
            onPress={save}
            disabled={["name", "email", "nic", "phone", "vehicleNumber"].some(
              (key) => !form[key]?.trim(),
            )}
          />
        </Dialog>
      )}
      {revoke && (
        <Dialog
          title="Revoke staff pass?"
          onClose={() => !busy && setRevoke(null)}
        >
          <Text style={s.text}>
            {revoke.name} will no longer be available for staff rapid entry.
            Existing vehicle history will be preserved.
          </Text>
          <Message text={error} error />
          <Button
            title="Confirm revocation"
            danger
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await api(`/traveler/${revoke.passId}`, "DELETE");
                setRevoke(null);
                await state.reload();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Dialog>
      )}
      {pass && (
        <Dialog title="Digital staff pass" onClose={() => setPass(null)}>
          <View style={{ alignItems: "center", padding: 18, gap: 20 }}>
            <Text style={[s.title, { textAlign: "center" }]}>{pass.name}</Text>
            <QRCode value={pass.passId} size={180} />
            <Text style={s.text}>
              {pass.vehicleNumber} · {pass.faculty}
            </Text>
            <Text selectable style={[s.muted, { textAlign: "center" }]}>
              {pass.passId}
            </Text>
            <Text style={[s.muted, { textAlign: "center" }]}>
              Present this code with your university ID. It identifies your
              registration; it does not authorize equipment removal.
            </Text>
          </View>
        </Dialog>
      )}
    </>
  );
}

export function Accounts() {
  const state = useLoad("/user");
  const [form, setForm] = useState(null),
    [disable, setDisable] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Heading
        title="Manage accounts"
        subtitle="Assign security officers and faculty administrators."
        action={
          <Button
            title="Create account"
            icon="user-plus"
            onPress={() => {
              setError("");
              setForm({
                name: "",
                email: "",
                password: "",
                role: "security",
                gate: gates[0],
                faculty: faculties[0],
              });
            }}
          />
        }
      />
      <LoadState state={state} />
      <View style={s.card}>
        {state.data?.map((person) => (
          <View
            key={person._id}
            style={{
              gap: 12,
              paddingVertical: 17,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <View>
                <Text style={[s.text, { fontWeight: "700" }]}>
                  {person.name}
                </Text>
                <Text style={s.muted}>{person.email}</Text>
                <Text style={s.muted}>
                  {person.role} ·{" "}
                  {person.gate || person.faculty || "All faculties"}
                </Text>
              </View>
              {person.role !== "superadmin" && (
                <View style={s.row}>
                  <Button
                    title="Edit"
                    secondary
                    small
                    onPress={() => {
                      setForm({ ...person });
                      setError("");
                    }}
                  />
                  <Button
                    title="Disable"
                    danger
                    small
                    onPress={() => {
                      setDisable(person);
                      setError("");
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
      {form && (
        <Dialog
          title={form._id ? "Edit account" : "Create account"}
          onClose={() => !busy && setForm(null)}
        >
          <Message text={error} error />
          <Field
            label="Full name *"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          {!form._id && (
            <>
              <Field
                label="Email address *"
                value={form.email}
                keyboardType="email-address"
                onChange={(value) => setForm({ ...form, email: value })}
              />
              <Field
                label="Initial password *"
                value={form.password}
                password
                onChange={(value) => setForm({ ...form, password: value })}
              />
              <Text style={s.muted}>
                At least 12 characters, with uppercase, lowercase and a number.
                Share through an approved private channel.
              </Text>
              <Choices
                label="Role"
                options={["security", "admin"]}
                value={form.role}
                onChange={(value) => setForm({ ...form, role: value })}
              />
            </>
          )}
          {form.role === "security" ? (
            <Choices
              label="Assigned gate"
              options={gates}
              value={form.gate}
              onChange={(value) => setForm({ ...form, gate: value })}
            />
          ) : (
            <Choices
              label="Assigned faculty"
              options={faculties}
              value={form.faculty}
              onChange={(value) => setForm({ ...form, faculty: value })}
            />
          )}
          <Button
            title="Save account"
            busy={busy}
            disabled={
              !form.name?.trim() ||
              (!form._id && (!form.email?.trim() || !form.password))
            }
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await api(
                  form._id ? `/user/${form._id}` : "/user",
                  form._id ? "PUT" : "POST",
                  form,
                );
                setForm(null);
                await state.reload();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Dialog>
      )}
      {disable && (
        <Dialog
          title="Disable account?"
          onClose={() => !busy && setDisable(null)}
        >
          <Text style={s.text}>
            {disable.name} will immediately lose access, including on devices
            already signed in. Existing records remain available.
          </Text>
          <Message text={error} error />
          <Button
            title="Confirm disable"
            danger
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await api(`/user/${disable._id}`, "DELETE");
                setDisable(null);
                await state.reload();
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Dialog>
      )}
    </>
  );
}

export function Profile({ user, onUpdate, onPasswordChange }) {
  const [form, setForm] = useState({
      name: user.name,
      phone: user.phone,
      bio: user.bio,
    }),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const sessions = useLoad("/user/sessions");
  async function run(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="My profile"
        subtitle="Make it yours. Keep your account protected."
      />
      <Message text={error} error />
      <Message text={message} />
      <View style={[s.row, { alignItems: "flex-start" }]}>
        <View style={[s.card, { flex: 1, minWidth: 260 }]}>
          <Text style={s.title}>Personal details</Text>
          <Text style={s.muted}>
            {user.email} · {user.role}
          </Text>
          <Field
            label="Display name *"
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            label="Phone number"
            value={form.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
            keyboardType="phone-pad"
          />
          <Field
            label="About me"
            value={form.bio}
            onChange={(value) => setForm({ ...form, bio: value })}
            multiline
          />
          <Text style={s.muted}>
            Your email, role, faculty and gate assignments are managed by campus
            administration.
          </Text>
          <Button
            title="Save profile"
            icon="check"
            busy={busy}
            disabled={!form.name.trim()}
            onPress={() =>
              run(async () => {
                const updated = await api("/user/me", "PUT", form);
                onUpdate(updated);
                setMessage("Your profile has been updated.");
              })
            }
          />
        </View>
        <View style={[s.card, { flex: 1, minWidth: 260 }]}>
          <Text style={s.title}>Change password</Text>
          <Text style={s.muted}>
            Use 12+ characters with uppercase, lowercase and a number. Changing
            your password signs out every session.
          </Text>
          <Field
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            password
          />
          <Field
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            password
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            password
          />
          <Button
            title="Update password & sign out"
            icon="lock"
            busy={busy}
            disabled={
              !currentPassword ||
              newPassword.length < 12 ||
              newPassword !== confirm
            }
            onPress={() =>
              run(async () => {
                await api("/user/password", "POST", {
                  currentPassword,
                  newPassword,
                });
                await onPasswordChange();
              })
            }
          />
        </View>
      </View>
      <View style={s.card}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={s.title}>Active sessions</Text>
          <Button
            title="Sign out other devices"
            secondary
            busy={busy}
            onPress={() =>
              run(async () => {
                await api("/user/revoke-sessions", "POST", {});
                setMessage("Other sessions have been signed out.");
                await sessions.reload();
              })
            }
          />
        </View>
        <LoadState state={sessions} />
        {sessions.data?.map((session) => (
          <View
            key={session._id}
            style={{
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingVertical: 14,
            }}
          >
            <View style={s.row}>
              <Feather name="monitor" size={18} color={colors.green} />
              <Text style={[s.text, { flex: 1 }]}>{session.device}</Text>
              {session.current && <Badge status="This device" />}
            </View>
            <Text style={s.muted}>
              Signed in {date(session.createdAt)} · Expires{" "}
              {date(session.expiresAt)}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}
export function AuditLog() {
  const state = useLoad("/audit");
  return (
    <>
      <Heading
        title="Audit history"
        subtitle="The latest 100 account and campus actions in your permitted scope."
        action={
          <Button
            title="Refresh"
            secondary
            icon="refresh-cw"
            onPress={state.reload}
            busy={state.loading}
          />
        }
      />
      <LoadState state={state} />
      <View style={s.card}>
        {!state.loading && !state.data?.length && (
          <Empty title="No audit events yet" />
        )}
        {state.data?.map((event) => (
          <View
            key={event._id}
            style={{
              paddingVertical: 15,
              gap: 7,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={s.row}>
              <Feather name="shield" size={16} color={colors.green} />
              <Text style={[s.text, { fontWeight: "700" }]}>
                {event.action}
              </Text>
            </View>
            <Text style={s.muted}>
              {event.actor} · {date(event.createdAt)}
            </Text>
            <Text selectable style={[s.muted, { fontSize: 11 }]}>
              Reference: {event.target}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}
