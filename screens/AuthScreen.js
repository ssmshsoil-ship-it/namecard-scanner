import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { ScanLine } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';

WebBrowser.maybeCompleteAuthSession();

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', slate: '#0F172A',
  cyan: '#06B6D4', text: '#334155', muted: '#64748B',
  border: '#E2E8F0', secondary: '#F1F5F9', white: '#FFFFFF',
};

export default function AuthScreen() {
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('가입 완료', '이메일을 확인해주세요.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.ssmshsoil.bizcardscanner://auth/callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'com.ssmshsoil.bizcardscanner://auth/callback'
      );

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const params = parsed.queryParams || {};
        
        // fragment에서 토큰 추출
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const fragParams = new URLSearchParams(fragment);
          const accessToken = fragParams.get('access_token');
          const refreshToken = fragParams.get('refresh_token');
          
          if (accessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch (e) {
      Alert.alert('오류', '구글 로그인에 실패했습니다.\n' + e.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <ScanLine size={28} color={C.cyan} />
            <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
          </View>
          <Text style={styles.appName}>BizCard Scanner</Text>
          <Text style={styles.appSub}>AI-powered contact capture</Text>
        </View>

        <View style={styles.card}>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={C.slate} size="small" />
            ) : (
              <Text style={styles.googleIcon}>G</Text>
            )}
            <Text style={styles.googleText}>Google로 계속하기</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일 주소"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호 (6자 이상)"
              placeholderTextColor={C.muted}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={C.slate} />
              : <Text style={styles.btnText}>{mode === 'login' ? '로그인' : '회원가입'}</Text>
            }
          </TouchableOpacity>

        </View>

        <View style={styles.freeBox}>
          <Text style={styles.freeText}>🎁 가입 즉시 무료 크레딧 10장 제공</Text>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.slate },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1.5, borderColor: 'rgba(6,182,212,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  aiBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: C.cyan, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  aiBadgeText: { fontSize: 9, fontWeight: '900', color: C.slate },
  appName: { color: C.white, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  appSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  googleIcon: { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '700', color: C.slate },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.muted, fontSize: 12 },
  tabRow: { flexDirection: 'row', backgroundColor: C.secondary, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.slate, fontWeight: '700' },
  inputBlock: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: C.secondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.slate, borderWidth: 1, borderColor: C.border },
  btn: { backgroundColor: C.cyan, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4, shadowColor: C.cyan, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4 },
  btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  btnText: { color: C.slate, fontSize: 15, fontWeight: '800' },
  freeBox: { marginTop: 20, alignItems: 'center' },
  freeText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
