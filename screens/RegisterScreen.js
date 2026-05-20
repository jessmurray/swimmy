import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator,
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
  accent: '#00A8E8',
  accentBg: 'rgba(0,168,232,0.10)',
  white: '#FFFFFF',
  disabled: 'rgba(4,44,83,0.25)',
  green: '#22c55e',
  red: '#ef4444',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CheckItem({ met, label }) {
  return (
    <View style={styles.checkItem}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={met ? C.green : C.navyAlpha30}
      />
      <Text style={[styles.checkLabel, met && styles.checkLabelMet]}>{label}</Text>
    </View>
  );
}

export default function RegisterScreen({ onRegister, onGoToLogin }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const lastNameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();

  const req8 = password.length >= 8;
  const reqCap = /[A-Z]/.test(password);
  const reqNum = /[0-9]/.test(password);

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    EMAIL_RE.test(email) &&
    req8 && reqCap && reqNum;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    const result = await onRegister({ firstName, lastName, email, password });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.confirmEmail) {
      setConfirmed(true);
    }
  };

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.confirmContainer}>
          <Ionicons name="mail-outline" size={56} color={C.accent} />
          <Text style={styles.confirmTitle}>Check your email</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.confirmEmail}>{email}</Text>
            {'\n\n'}Tap the link in the email to activate your account, then log in.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onGoToLogin} activeOpacity={0.85}>
            <Text style={styles.btnText}>Go to log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>Swimmy</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.sub}>Start your personalised swim training journey.</Text>
          </View>

          <View style={styles.fields}>
            <View style={styles.nameRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First"
                  placeholderTextColor={C.navyAlpha30}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  ref={lastNameRef}
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last"
                  placeholderTextColor={C.navyAlpha30}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={C.navyAlpha30}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={C.navyAlpha30}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={C.navyAlpha60}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.checklist}>
                <CheckItem met={req8} label="At least 8 characters" />
                <CheckItem met={reqCap} label="At least one capital letter" />
                <CheckItem met={reqNum} label="At least one number" />
              </View>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            activeOpacity={valid && !loading ? 0.85 : 1}
            style={[styles.btn, (!valid || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={[styles.btnText, (!valid || loading) && styles.btnTextDisabled]}>
                  Create account
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRow} onPress={onGoToLogin} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              Already have an account?{'  '}
              <Text style={styles.switchLink}>Log in</Text>
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  logoRow: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: -1,
  },

  header: { marginBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    color: C.navyAlpha60,
    lineHeight: 22,
  },

  fields: { gap: 16, marginBottom: 24 },

  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },

  fieldGroup: { gap: 6 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: C.navyAlpha60,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  input: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    color: C.navy,
  },

  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checklist: {
    marginTop: 10,
    gap: 6,
    paddingHorizontal: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 13,
    color: C.navyAlpha30,
    fontWeight: '500',
  },
  checkLabelMet: {
    color: C.green,
  },

  errorText: {
    fontSize: 14,
    color: C.red,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },

  btn: {
    backgroundColor: C.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 54,
  },
  btnDisabled: {
    backgroundColor: C.navyAlpha15,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },
  btnTextDisabled: {
    color: C.disabled,
  },

  switchRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 14,
    color: C.navyAlpha60,
  },
  switchLink: {
    color: C.accent,
    fontWeight: '700',
  },

  confirmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  confirmTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  confirmBody: {
    fontSize: 15,
    color: C.navyAlpha60,
    lineHeight: 24,
    textAlign: 'center',
  },
  confirmEmail: {
    color: C.navy,
    fontWeight: '700',
  },
});
