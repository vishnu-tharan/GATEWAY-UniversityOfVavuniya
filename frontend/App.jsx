import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import {
  api,
  restoreToken,
  saveToken,
  setUnauthorizedHandler,
} from "./src/api";
import { Button, Field, Message, colors, s } from "./src/ui";
import {
  Dashboard,
  Records,
  Entry,
  Staff,
  Accounts,
  Profile,
  AuditLog,
} from "./src/screens";

function Login({ onLogin }) {
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true);
    setError("");
    try {
      const data = await api("/user/login", "POST", { email, password });
      await saveToken(data.token);
      onLogin(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          flexDirection: width > 900 ? "row" : "column",
          backgroundColor: "#f5f8f5",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#142f34",
            padding: width > 900 ? 64 : 30,
            justifyContent: "space-between",
            minHeight: width > 900 ? 680 : 270,
          }}
        >
          <View style={s.row}>
            <Image
              source={require("./public/vau-logo.png")}
              style={{ width: 52, height: 62 }}
              resizeMode="contain"
            />
            <View>
              <Text
                style={{
                  color: "white",
                  fontSize: 22,
                  fontWeight: "700",
                  letterSpacing: 2,
                }}
              >
                GATEWAY
              </Text>
              <Text style={{ color: "#a9c2bd", fontSize: 12, marginTop: 4 }}>
                UNIVERSITY OF VAVUNIYA
              </Text>
            </View>
          </View>
          <View style={{ gap: 22, marginVertical: 38 }}>
            <Text
              style={{
                color: "#b7d6a4",
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 2,
              }}
            >
              CONNECTED CAMPUS. CONFIDENT ACCESS.
            </Text>
            <Text
              style={{
                color: "white",
                fontSize: width > 900 ? 56 : 34,
                fontWeight: "700",
                letterSpacing: -2,
                maxWidth: 540,
              }}
            >
              A warm welcome.{"\n"}A safer campus.
            </Text>
            <Text
              style={{
                color: "#b4cac5",
                fontSize: 16,
                lineHeight: 26,
                maxWidth: 420,
              }}
            >
              One place to manage every arrival, approve equipment passes, and
              keep your campus moving.
            </Text>
          </View>
          {width > 900 && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: "#3b5356",
                paddingTop: 26,
                gap: 18,
              }}
            >
              {[
                ["shield", "Access with accountability"],
                ["git-branch", "Three gates. One connected view."],
                ["smartphone", "At your desk and on the move."],
              ].map(([icon, label]) => (
                <View key={label} style={s.row}>
                  <Feather name={icon} size={18} color="#b7d6a4" />
                  <Text style={{ color: "#d3e1dc", fontSize: 14 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
          }}
        >
          <View style={{ width: "100%", maxWidth: 390, gap: 22 }}>
            <View
              style={{
                backgroundColor: colors.mint,
                padding: 15,
                borderRadius: 16,
                alignSelf: "flex-start",
              }}
            >
              <Feather name="lock" size={25} color={colors.green} />
            </View>
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 32,
                  fontWeight: "700",
                  letterSpacing: -1,
                }}
              >
                Welcome back
              </Text>
              <Text style={s.muted}>
                Sign in with your university Gateway account.
              </Text>
            </View>
            <Field
              label="Email or existing username"
              value={email}
              onChange={setEmail}
              keyboardType="email-address"
              placeholder="you@vau.ac.lk"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              password
              placeholder="Enter your password"
            />
            <Message text={error} error />
            <Button
              title="Sign in to Gateway"
              icon="arrow-right"
              busy={busy}
              disabled={!email.trim() || !password}
              onPress={login}
            />
            <Text style={[s.muted, { textAlign: "center", fontSize: 12 }]}>
              Need access or help with your password?{"\n"}Contact your campus
              administrator.
            </Text>
            <View style={s.divider} />
            <Text style={[s.muted, { fontSize: 11, textAlign: "center" }]}>
              Authorized university personnel only · Sessions expire after 8
              hours
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Gateway() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("Overview"),
    [error, setError] = useState("");
  const { width, height } = useWindowDimensions();
  const wide = width >= 1050;
  useEffect(() => {
    let mounted = true;
    setUnauthorizedHandler(() => {
      setUser(null);
      setTab("Overview");
    });
    restoreToken()
      .then(() => api("/user/me"))
      .then((value) => {
        if (mounted) setUser(value);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      setUnauthorizedHandler(() => {});
    };
  }, []);
  async function logout() {
    try {
      await api("/user/logout", "POST", {});
      await saveToken(null);
      setUser(null);
      setTab("Overview");
    } catch (e) {
      setError(e.message);
    }
  }
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        <ActivityIndicator color={colors.green} />
        <Text style={s.muted}>Opening Gateway…</Text>
      </View>
    );
  if (!user)
    return (
      <Login
        onLogin={(value) => {
          setUser(value);
          setError("");
        }}
      />
    );
  const admin = user.role !== "security";
  const tabs = [
    ["Overview", "grid"],
    ...(!admin
      ? [
          ["Vehicle entry", "log-in"],
          ["Vehicle exit", "log-out"],
        ]
      : [["Approvals", "check-square"]]),
    ["Vehicle records", "list"],
    ...(admin
      ? [
          ["Staff passes", "credit-card"],
          ["Reports", "bar-chart-2"],
          ["Audit history", "shield"],
        ]
      : []),
    ...(user.role === "superadmin" ? [["Accounts", "users"]] : []),
    ["My profile", "user"],
  ];
  const navigate = (value) => {
    setTab(value);
    setError("");
  };
  const nav = tabs.map(([label, icon]) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: tab === label }}
      onPress={() => navigate(label)}
      style={{
        padding: 13,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: tab === label ? "#dcebe2" : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Feather
        name={icon}
        size={18}
        color={tab === label ? "#1e584e" : "#b8cbc8"}
      />
      <Text
        style={{
          color: tab === label ? "#1e584e" : "#b8cbc8",
          fontSize: 13,
          fontWeight: tab === label ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  ));
  return (
    <View
      style={{
        flex: 1,
        flexDirection: wide ? "row" : "column",
        backgroundColor: colors.bg,
      }}
    >
      {wide ? (
        <View
          style={{
            width: 242,
            padding: 20,
            backgroundColor: "#142f34",
            gap: 16,
          }}
        >
          <View style={[s.row, { paddingVertical: 13 }]}>
            <Image
              source={require("./public/vau-logo.png")}
              style={{ width: 35, height: 45 }}
              resizeMode="contain"
            />
            <View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 19,
                  fontWeight: "700",
                  letterSpacing: 2,
                }}
              >
                GATEWAY
              </Text>
              <Text style={{ color: "#8faea6", fontSize: 9, marginTop: 4 }}>
                UNIVERSITY OF VAVUNIYA
              </Text>
            </View>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            <Text
              style={{
                color: "#7d9b94",
                fontSize: 10,
                letterSpacing: 2,
                marginLeft: 16,
                marginBottom: 14,
              }}
            >
              WORKSPACE
            </Text>
            {nav}
          </ScrollView>
          {height > 850 && (
            <View
              style={{
                backgroundColor: "#203e42",
                borderRadius: 13,
                padding: 15,
                gap: 7,
              }}
            >
              <Feather name="shield" size={20} color="#b7d6a4" />
              <Text style={{ color: "#dce9e4", fontSize: 12 }}>
                Every action, accountable.
              </Text>
              <Text style={{ color: "#91aaa5", fontSize: 11, lineHeight: 18 }}>
                Your access is scoped to your university role.
              </Text>
            </View>
          )}
          <Button title="Sign out" icon="log-out" onPress={logout} />
        </View>
      ) : (
        <View style={{ backgroundColor: "#142f34", paddingTop: 12 }}>
          <View
            style={[
              s.row,
              { paddingHorizontal: 18, justifyContent: "space-between" },
            ]}
          >
            <Text
              style={{ color: "white", fontWeight: "700", letterSpacing: 2 }}
            >
              GATEWAY
            </Text>
            <Button title="Sign out" onPress={logout} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 5, padding: 10 }}
          >
            {nav}
          </ScrollView>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: wide ? 36 : 20,
            paddingVertical: 17,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              Campus operations / {tab}
            </Text>
            <Text
              style={{
                color: colors.ink,
                fontSize: 13,
                marginTop: 5,
                fontWeight: "600",
              }}
            >
              {user.faculty || user.gate || "Campus administration"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open my profile"
            onPress={() => navigate("My profile")}
            style={s.row}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#ececda",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.green, fontWeight: "700" }}>
                {user.name?.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            {wide && (
              <View>
                <Text
                  style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}
                >
                  {user.name}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}
                >
                  {user.role === "superadmin"
                    ? "Campus administrator"
                    : user.role === "admin"
                      ? "Faculty administrator"
                      : "Security officer"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: wide ? 36 : 18,
            gap: 22,
            maxWidth: 1500,
            width: "100%",
            alignSelf: "center",
            paddingBottom: 50,
          }}
        >
          <Message text={error} error />
          {tab === "Overview" && <Dashboard user={user} navigate={navigate} />}
          {["Vehicle records", "Vehicle exit", "Approvals", "Reports"].includes(
            tab,
          ) && <Records key={tab} mode={tab} user={user} />}
          {tab === "Vehicle entry" && <Entry user={user} />}
          {tab === "Staff passes" && <Staff user={user} />}
          {tab === "Accounts" && <Accounts />}
          {tab === "My profile" && (
            <Profile
              user={user}
              onUpdate={setUser}
              onPasswordChange={async () => {
                await saveToken(null);
                setUser(null);
                setTab("Overview");
              }}
            />
          )}
          {tab === "Audit history" && <AuditLog />}
        </ScrollView>
      </View>
    </View>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#142f34" }}>
        <StatusBar style="auto" />
        <Gateway />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
