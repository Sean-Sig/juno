import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const ACCOUNT_ID = process.env.EXPO_PUBLIC_ACCOUNT_ID ?? "00000000-0000-0000-0000-000000000003";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleRegister() {
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setGeneralError("");

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await register(email, password, ACCOUNT_ID);
      router.replace("/onboarding");
    } catch (err: unknown) {
      const e = err as { error?: string; errors?: Record<string, string[]> };
      if (e.errors) {
        setEmailError(e.errors.email?.[0] ?? "");
        setPasswordError(e.errors.password?.[0] ?? "");
      } else if (e.error) {
        setGeneralError(e.error);
      } else {
        setGeneralError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Create Account</Text>

        {generalError ? <Text style={styles.error}>{generalError}</Text> : null}

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
        </View>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
        </View>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg, textAlign: "center" },
  field: { marginBottom: spacing.md },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldError: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md, textAlign: "center" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.card, fontWeight: "700" },
  link: { ...typography.body, color: colors.primary, textAlign: "center" },
});
}
