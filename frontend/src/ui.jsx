import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
export const colors = {
  ink: "#152c32",
  muted: "#657a7f",
  green: "#17685b",
  mint: "#e5f0eb",
  bg: "#f4f7f6",
  border: "#dce5e2",
  amber: "#986515",
  red: "#ac3d45",
};
export const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  title: {
    fontSize: 23,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  text: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: "#fbfdfc",
    minHeight: 46,
  },
  button: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 17,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  divider: { height: 1, backgroundColor: colors.border },
});
export function Button({
  title,
  onPress,
  icon,
  secondary,
  danger,
  disabled,
  busy,
  small,
}) {
  const bg = secondary ? "#edf3f0" : danger ? colors.red : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: bg,
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
          ...(small ? { paddingVertical: 8, minHeight: 38 } : {}),
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={secondary ? colors.green : "white"}
        />
      ) : (
        icon && (
          <Feather
            name={icon}
            size={16}
            color={secondary ? colors.green : "white"}
          />
        )
      )}
      <Text
        style={{
          fontWeight: "700",
          fontSize: 13,
          color: secondary ? colors.green : "white",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  password,
  multiline,
  placeholder,
  keyboardType,
  editable = true,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 0, flexGrow: 1 }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          accessibilityLabel={label}
          value={value || ""}
          onChangeText={onChange}
          secureTextEntry={password && !visible}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor="#8b999c"
          keyboardType={keyboardType}
          autoCapitalize={
            password || keyboardType === "email-address" ? "none" : "sentences"
          }
          autoCorrect={!password}
          editable={editable}
          style={[
            s.input,
            {
              flex: 1,
              ...(multiline ? { minHeight: 90, textAlignVertical: "top" } : {}),
              ...(!editable ? { opacity: 0.6 } : {}),
            },
          ]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible(!visible)}
            style={{ padding: 12 }}
          >
            <Feather
              name={visible ? "eye-off" : "eye"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Choices({ label, options, value, onChange }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={[s.row, { gap: 8 }]}>
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: option === value }}
            onPress={() => onChange(option)}
            style={{
              paddingHorizontal: 13,
              paddingVertical: 11,
              borderWidth: 1,
              borderRadius: 9,
              borderColor: option === value ? colors.green : colors.border,
              backgroundColor: option === value ? colors.mint : "white",
            }}
          >
            <Text
              style={{
                color: option === value ? colors.green : colors.muted,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Badge({ status }) {
  const tone =
    status === "Rejected"
      ? colors.red
      : status === "Pending Approval"
        ? colors.amber
        : status === "Exited"
          ? colors.muted
          : colors.green;
  return (
    <View
      style={{
        backgroundColor: `${tone}12`,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: tone, fontSize: 11, fontWeight: "700" }}>
        {status}
      </Text>
    </View>
  );
}
export function Empty({
  title = "Nothing here yet",
  detail = "New activity will appear here.",
  icon = "inbox",
}) {
  return (
    <View style={{ alignItems: "center", padding: 34, gap: 9 }}>
      <Feather name={icon} size={28} color={colors.muted} />
      <Text style={[s.text, { fontWeight: "700" }]}>{title}</Text>
      <Text style={[s.muted, { textAlign: "center" }]}>{detail}</Text>
    </View>
  );
}
export function Dialog({ title, children, onClose }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#102a32aa",
          justifyContent: "center",
          alignItems: "center",
          padding: 18,
        }}
      >
        <View
          style={[
            s.card,
            { width: "100%", maxWidth: 620, maxHeight: "92%", padding: 22 },
          ]}
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.title, { flex: 1 }]}>{title}</Text>
            <Button title="Close" secondary onPress={onClose} />
          </View>
          <ScrollView
            contentContainerStyle={{ gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Message({ text, error }) {
  return text ? (
    <View
      accessibilityRole="alert"
      style={{
        padding: 14,
        borderRadius: 10,
        backgroundColor: error ? "#fceced" : colors.mint,
      }}
    >
      <Text
        style={{
          color: error ? colors.red : colors.green,
          fontSize: 13,
          lineHeight: 20,
        }}
      >
        {text}
      </Text>
    </View>
  ) : null;
}
export const date = (value) => (value ? new Date(value).toLocaleString() : "—");
