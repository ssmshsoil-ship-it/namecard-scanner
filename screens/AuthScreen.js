import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Linking, ScrollView,
} from 'react-native';
import { ScanLine, Mail, Lock, Check } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase';
import i18n from '../i18n';

WebBrowser.maybeCompleteAuthSession();

const C = {
  navy: '#0D1B2A', navySoft: '#1A2B3C',
  teal: '#00BFA5', tealTint: '#F0FBF9',
  bg: '#FAFAF8', card: '#FFFFFF',
  text: '#0D1B2A', textMuted: '#6B7785',
  textLabel: '#94A3B8', border: '#ECECE8',
  secondary: '#F1F5F9', white: '#FFFFFF',
};

const PRIVACY_URL = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/privacy.html';
const TERMS_URL   = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/terms.html';

export default function AuthScreen() {
  const [mode, setMode]                   = useState('login');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreeTerms, setAgreeTerms]       = useState(false);
  const [agreePrivacy, setAgreePrivacy]   = useState(false);

  const handleAuth = async () => {
    if (!email || !password) { Alert.alert('오류', '이메일과 비밀번호를 입력해주세요.'); return; }
    if (mode === 'signup' && (!agreeTerms || !agreePrivacy)) { Alert.alert('약관 동의 필요', '이용약관과 개인정보처리방침에 동의해주세요.'); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { Alert.alert('오류', e.message); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    if (mode === 'signup' && (!agreeTerms || !agreePrivacy)) { Alert.alert('약관 동의 필요', '이용약관과 개인정보처리방침에 동의해주세요.'); return; }
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'com.ssmshsoil.bizcardscanner://auth/callback', skipBrowserRedirect: true },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'com.ssmshsoil.bizcardscanner://auth/callback');
      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1];
        if (fragment) {
          const p = new URLSearchParams(fragment);
          const at = p.get('access_token'), rt = p.get('refresh_token');
          if (at) await supabase.auth.setSession({ access_token: at, refresh_token: rt || '' });
        }
      }
    } catch (e) { Alert.alert('오류', e.message); }
    finally { setGoogleLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* 로고 */}
          <View style={styles.logoArea}>
            <View style={styles.logoWrap}>
              <View style={styles.logoSquare}>
                <ScanLine size={28} color={C.teal} strokeWidth={2.4} />
              </View>
              <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
            </View>
            <Text style={styles.appName}>CardScan AI</Text>
            <Text style={styles.appSub}>명함 즉시저장 · 발신자 확인</Text>
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>🎁 가입 시 1장 무료 제공</Text>
            </View>
          </View>

          {/* 카드 */}
          <View style={styles.card}>

            {/* 구글 로그인 */}
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} disabled={googleLoading} activeOpacity={0.85}>
              {googleLoading ? <ActivityIndicator color={C.text} size="small" /> : <Text style={styles.googleG}>G</Text>}
              <Text style={styles.googleText}>Google로 계속하기</Text>
            </TouchableOpacity>

            {/* 구분선 */}
            <View style={styles.divRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>또는</Text>
              <View style={styles.divLine} />
            </View>

            {/* 탭 */}
            <View style={styles.tabRow}>
              <TouchableOpacity style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>로그인</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => setMode('signup')}>
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>회원가입</Text>
              </TouchableOpacity>
            </View>

            {/* 이메일 */}
            <View style={styles.inputBlock}>
              <View style={styles.inputIconRow}>
                <Mail size={15} color={C.textLabel} strokeWidth={2} />
                <Text style={styles.inputLabel}>EMAIL</Text>
              </View>
              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="이메일 주소" placeholderTextColor={C.textLabel}
                keyboardType="email-address" autoCapitalize="none" />
            </View>

            {/* 비밀번호 */}
            <View style={styles.inputBlock}>
              <View style={styles.inputIconRow}>
                <Lock size={15} color={C.textLabel} strokeWidth={2} />
                <Text style={styles.inputLabel}>PASSWORD</Text>
              </View>
              <TextInput style={styles.input} value={password} onChangeText={setPassword}
                placeholder="비밀번호 (6자 이상)" placeholderTextColor={C.textLabel}
                secureTextEntry />
            </View>

            {/* 약관 동의 */}
            {mode === 'signup' && (
              <View style={styles.agreeSection}>
                <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                    {agreeTerms && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={styles.agreeText}>[필수] </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                    <Text style={styles.agreeLink}>이용약관</Text>
                  </TouchableOpacity>
                  <Text style={styles.agreeText}> 동의</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreePrivacy(!agreePrivacy)} activeOpacity={0.7}>
                  <View style={[styles.checkbox, agreePrivacy && styles.checkboxActive]}>
                    {agreePrivacy && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={styles.agreeText}>[필수] </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
                    <Text style={styles.agreeLink}>개인정보처리방침</Text>
                  </TouchableOpacity>
                  <Text style={styles.agreeText}> 동의</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 버튼 */}
            <TouchableOpacity
              style={[styles.btn, (loading || !email || !password) && styles.btnDisabled]}
              onPress={handleAuth} disabled={loading} activeOpacity={0.9}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>{mode === 'login' ? '로그인' : '회원가입'}</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.bottomInfo}>
            <Text style={styles.bottomText}>한국어 · 日本語 · English</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 40 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { position: 'relative', marginBottom: 16 },
  logoSquare: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(0,191,165,0.12)', borderWidth: 1.5, borderColor: 'rgba(0,191,165,0.3)', alignItems: 'center', justifyContent: 'center' },
  aiBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: C.teal, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 2, borderColor: C.navy },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  appName: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  appSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 },
  freeBadge: { backgroundColor: 'rgba(0,191,165,0.15)', borderWidth: 1, borderColor: 'rgba(0,191,165,0.35)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  freeBadgeText: { color: C.teal, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 14, marginBottom: 18 },
  googleG: { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleText: { fontSize: 15, fontWeight: '700', color: C.text },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { color: C.textMuted, fontSize: 12, fontWeight: '500' },
  tabRow: { flexDirection: 'row', backgroundColor: C.secondary, borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  tabTextActive: { color: C.text, fontWeight: '800' },
  inputBlock: { marginBottom: 14 },
  inputIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  inputLabel: { fontSize: 10, fontWeight: '700', color: C.textLabel, letterSpacing: 1 },
  input: { backgroundColor: C.secondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  agreeSection: { marginBottom: 16, gap: 10 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.secondary },
  checkboxActive: { backgroundColor: C.teal, borderColor: C.teal },
  agreeText: { fontSize: 13, color: C.text },
  agreeLink: { fontSize: 13, color: C.teal, fontWeight: '700', textDecorationLine: 'underline' },
  btn: { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: C.teal, shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 },
  btnDisabled: { backgroundColor: '#B2DFDB', shadowOpacity: 0 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  bottomInfo: { marginTop: 24, alignItems: 'center' },
  bottomText: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
});
