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
  red: '#ef4444',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLogin, onGoToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef();

  const valid = EMAIL_RE.test(email) && password.length >= 1;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    const result = await onLogin({ email, password });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    }
  };

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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.sub}>Log in to continue your training.</Text>
          </View>

          <View style={styles.fields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
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
                  onChangeText={(v) => { setPassword(v); setError(''); }}
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
                  Log in
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRow} onPress={onGoToRegister} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              Don't have an account?{'  '}
              <Text style={styles.switchLink}>Sign up</Text>
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
});
