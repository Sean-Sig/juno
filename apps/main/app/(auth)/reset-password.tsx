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
import { Ionicons } from "@expo/vector-icons";
import { auth } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setTokenError("");
    setPasswordError("");
    setGeneralError("");

    if (!token.trim()) {
      setTokenError("Reset code is required.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await auth.resetPassword(token.trim(), password);
      setDone(true);
    } catch (err: unknown) {
      const e = err as { error?: string; errors?: Record<string, string[]> };
      if (e.errors) {
        setTokenError(e.errors.token?.[0] ?? "");
        setPasswordError(e.errors.password?.[0] ?? "");
      } else if (e.error) {
        setGeneralError(e.error);
      } else {
        setGeneralError("Invalid or expired reset code. Please request a new one.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.body}>Your password has been reset. You can now sign in.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.buttonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.body}>
          Paste the reset code from your email and choose a new password.
        </Text>

        {generalError ? <Text style={styles.error}>{generalError}</Text> : null}

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            placeholder="Reset code"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            value={token}
            onChangeText={setToken}
          />
          {tokenError ? <Text style={styles.fieldError}>{tokenError}</Text> : null}
        </View>

        <View style={styles.field}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeButton}>
              <Ionicons name={showConfirm ? "eye-off" : "eye"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>Reset password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: { flex: 1, padding: spacing.lg, justifyContent: "center" },
    title: { ...typography.h1, color: colors.text, marginBottom: spacing.sm, textAlign: "center" },
    body: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
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
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputFlex: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      padding: spacing.md,
    },
    eyeButton: { paddingHorizontal: spacing.md },
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
