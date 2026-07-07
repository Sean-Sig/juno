import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, useSport, type Sport } from "@juno/api";
import { useTheme, spacing, typography, radius, type Palette, type ThemePreference } from "@juno/ui";
import { TERMS_URL, PRIVACY_URL, SUPPORT_EMAIL } from "../../constants/legal";

const SPORT_META: Record<Sport, { emoji: string; label: string }> = {
  golf: { emoji: "⛳", label: "Golf" },
  tennis: { emoji: "🎾", label: "Tennis" },
  basketball: { emoji: "🏀", label: "Basketball" },
  hockey: { emoji: "🏒", label: "Hockey" },
  football: { emoji: "🏈", label: "Football" },
  soccer: { emoji: "⚽", label: "Soccer" },
};

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, logout, deleteAccount, updateDisplayName } = useAuth();
  const { followedSports, defaultSport, resetPrefs } = useSport();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const displayName = session?.display_name || `Fan #${session?.fan_id.slice(0, 8)}`;

  function startEditingName() {
    setNameDraft(session?.display_name ?? "");
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === session?.display_name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setEditingName(false);
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  function contactUs() {
    const subject = encodeURIComponent("Juno Support");
    const body = encodeURIComponent(
      `\n\n---\nFan ID: ${session?.fan_id ?? "unknown"}`
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This permanently deletes your account and all your data. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await resetPrefs();
            } catch {
              Alert.alert("Something went wrong", "Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  function cycleAppearance() {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(preference) + 1) % order.length];
    setPreference(next);
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {!session ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Sign in to manage your account.</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ""}
          renderItem={null}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              {/* Account info */}
              <View style={styles.account}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitials}>
                    {displayName[0]?.toUpperCase()}
                  </Text>
                </View>
                {editingName ? (
                  <View style={styles.nameEditRow}>
                    <TextInput
                      style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
                      value={nameDraft}
                      onChangeText={setNameDraft}
                      autoFocus
                      maxLength={40}
                      returnKeyType="done"
                      onSubmitEditing={saveName}
                      editable={!savingName}
                    />
                    {savingName ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <TouchableOpacity onPress={saveName} hitSlop={8}>
                          <Ionicons name="checkmark" size={22} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingName(false)} hitSlop={8}>
                          <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.nameRow} onPress={startEditingName} hitSlop={8}>
                    <Text style={styles.accountId}>{displayName}</Text>
                    <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Sports */}
              <Text style={styles.sectionTitle}>Followed Sports</Text>
              {followedSports.map((sport) => (
                <View key={sport} style={styles.row}>
                  <Text style={styles.rowEmoji}>{SPORT_META[sport].emoji}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{SPORT_META[sport].label}</Text>
                    {defaultSport === sport && (
                      <Text style={styles.rowSub}>Default</Text>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => router.push("/(app)/sport-settings?from=profile")}
              >
                <Text style={styles.manageBtnText}>Manage sports</Text>
              </TouchableOpacity>

              {/* Appearance */}
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Appearance</Text>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>Theme</Text>
                  <Text style={styles.rowSub}>
                    {preference === "system"
                      ? "Match system"
                      : preference === "dark"
                      ? "Dark"
                      : "Light"}
                  </Text>
                </View>
                <Switch
                  value={
                    preference === "dark" ||
                    (preference === "system" && colors.background === "#121212")
                  }
                  onValueChange={cycleAppearance}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>

              {/* Support */}
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Support</Text>
              <TouchableOpacity style={styles.row} onPress={contactUs}>
                <Text style={styles.rowLabel}>Contact Us</Text>
              </TouchableOpacity>

              {/* Legal */}
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Legal</Text>
              <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)}>
                <Text style={styles.rowLabel}>Terms & Conditions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)}>
                <Text style={styles.rowLabel}>Privacy Policy</Text>
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>

              {/* Delete account */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.error ?? "#ef4444"} />
                ) : (
                  <Text style={styles.deleteText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    list: { padding: spacing.md },
    account: { alignItems: "center", marginBottom: spacing.lg },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    avatarInitials: { ...typography.h2, color: colors.textOnPrimary, fontWeight: "700" },
    accountId: { ...typography.body, color: colors.textSecondary },
    nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    nameEditRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
    nameInput: {
      ...typography.body,
      borderBottomWidth: 1,
      minWidth: 140,
      textAlign: "center",
      paddingVertical: 2,
    },
    sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    rowEmoji: { fontSize: 20 },
    rowText: { flex: 1 },
    rowLabel: { ...typography.body, color: colors.text, fontWeight: "600" },
    rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    manageBtn: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      alignSelf: "flex-start",
    },
    manageBtnText: { ...typography.label, color: colors.primary },
    empty: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
    signInButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    signInButtonText: { ...typography.label, color: colors.textOnPrimary, fontWeight: "700" },
    logoutButton: {
      marginTop: spacing.xl,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error ?? "#ef4444",
      paddingVertical: spacing.sm,
      alignItems: "center",
    },
    logoutText: { ...typography.label, color: colors.error ?? "#ef4444", fontWeight: "700" },
    deleteButton: {
      marginTop: spacing.sm,
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    deleteText: { ...typography.caption, color: colors.error ?? "#ef4444" },
  });
}
