import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha15: 'rgba(4,44,83,0.15)',
  navyAlpha08: 'rgba(4,44,83,0.08)',
  navyAlpha06: 'rgba(4,44,83,0.06)',
  accent: '#00A8E8',
  white: '#FFFFFF',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.08)',
};

export default function ProfileScreen({ profile, user, onSignOut, onBack }) {
  const name  = profile?.name  ?? '';
  const email = user?.email    ?? '';
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="person-outline" size={18} color={C.accent} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{name || '—'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="mail-outline" size={18} color={C.accent} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue}>{email || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={C.red} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17, fontWeight: '700', color: C.navy, letterSpacing: -0.2,
  },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: C.white },
  name:  { fontSize: 22, fontWeight: '800', color: C.navy, letterSpacing: -0.3, marginBottom: 4 },
  email: { fontSize: 14, color: C.navyAlpha60 },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.navyAlpha30,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4,
  },

  card: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.navyAlpha08,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,168,232,0.1)', alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 11, color: C.navyAlpha30, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  rowValue: { fontSize: 15, color: C.navy, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.navyAlpha08, marginLeft: 66 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.redBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: C.red },
});
