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
import { auth } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette } from "@juno/ui";

const ACCOUNT_ID = process.env.EXPO_PUBLIC_ACCOUNT_ID ?? "00000000-0000-0000-0000-000000000003";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      await auth.forgotPassword(email.trim(), ACCOUNT_ID);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            If an account exists for {email.trim()}, you'll receive a password reset link shortly.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/(auth)/reset-password")}>
            <Text style={styles.buttonText}>Enter reset code</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Back to sign in</Text>
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
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.body}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

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
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
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
