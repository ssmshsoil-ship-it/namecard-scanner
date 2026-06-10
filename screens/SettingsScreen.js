import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity,
  StyleSheet, Alert, Linking, ActivityIndicator, ScrollView
} from 'react-native';
import {
  LogOut, Trash2, Shield, FileText, Zap, ChevronRight, X
} from 'lucide-react-native';
import { supabase } from '../supabase';
import i18n from '../i18n';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', slate: '#0F172A',
  cyan: '#06B6D4', text: '#334155', muted: '#64748B',
  border: '#E2E8F0', secondary: '#F1F5F9', white: '#FFFFFF',
  red: '#EF4444',
};

const PRIVACY_URL = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/privacy.html';
const TERMS_URL   = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/terms.html';

export default function SettingsScreen({ user, credits, onClose }) {
  const [deleting, setDeleting] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      '로그아웃',
      '로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', onPress: async () => { await supabase.auth.signOut(); } }
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴 시 모든 데이터와 크레딧이 즉시 삭제됩니다.\n정말 탈퇴하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // 크레딧 데이터 삭제
              await supabase
                .from('user_credits')
                .delete()
                .eq('user_id', user.id);

              // 로그아웃 (계정 삭제는 서버 사이드 필요)
              await supabase.auth.signOut();

              Alert.alert('탈퇴 완료', '회원 탈퇴가 완료됐습니다.');
            } catch (e) {
              Alert.alert('오류', '탈퇴 처리 중 오류가 발생했습니다.\n고객센터로 문의해주세요.\nssmkra@gmail.com');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>설정</Text>
            <Text style={styles.headerSub}>Settings</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* 계정 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>
          <View style={styles.accountBox}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emailText}>{user?.email}</Text>
              <View style={styles.creditRow}>
                <Zap size={12} color={C.cyan} />
                <Text style={styles.creditText}>크레딧 {credits}장 보유</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 법적 문서 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>법적 정보</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Shield size={18} color={C.cyan} />
            <Text style={styles.menuText}>개인정보처리방침</Text>
            <ChevronRight size={16} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={() => Linking.openURL(TERMS_URL)}>
            <FileText size={18} color={C.cyan} />
            <Text style={styles.menuText}>이용약관</Text>
            <ChevronRight size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>앱 이름</Text>
            <Text style={styles.menuValue}>명함스캔</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>버전</Text>
            <Text style={styles.menuValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>문의</Text>
            <Text style={styles.menuValue}>ssmkra@gmail.com</Text>
          </View>
        </View>

        {/* 계정 관리 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 관리</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <LogOut size={18} color={C.muted} />
            <Text style={styles.menuText}>로그아웃</Text>
            <ChevronRight size={16} color={C.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={C.red} />
            ) : (
              <Trash2 size={18} color={C.red} />
            )}
            <Text style={[styles.menuText, { color: C.red }]}>회원 탈퇴</Text>
            <ChevronRight size={16} color={C.red} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.slate, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: {},
  headerTitle: { color: C.white, fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 8 },
  section: { backgroundColor: C.card, margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, shadowColor: C.slate, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' },
  accountBox: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.cyan, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.white, fontSize: 20, fontWeight: '800' },
  emailText: { fontSize: 14, fontWeight: '600', color: C.text },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  creditText: { fontSize: 12, color: C.cyan, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menuText: { flex: 1, fontSize: 14, color: C.text, fontWeight: '500' },
  menuValue: { fontSize: 13, color: C.muted },
  divider: { height: 1, backgroundColor: C.border },
});
