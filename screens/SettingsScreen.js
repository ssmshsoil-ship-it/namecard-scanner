import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, SafeAreaView, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { X, Zap, Shield, FileText, LogOut, Trash2, ChevronRight } from 'lucide-react-native';
import { supabase } from '../supabase';

const C = {
  navy: '#0D1B2A',
  teal: '#00BFA5',
  tealSoft: '#E6F9F6',
  bg: '#FAFAF8',
  text: '#0D1B2A',
  textMuted: '#6B7785',
  textLabel: '#94A3B8',
  border: '#ECECE8',
  separator: '#F1F1ED',
  danger: '#EF4444',
  dangerTint: '#FEF2F2',
  white: '#FFFFFF',
};

const PRIVACY_URL = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/privacy.html';
const TERMS_URL   = 'https://ssmshsoil-ship-it.github.io/namecard-scanner/terms.html';

export default function SettingsScreen({ user, credits, onClose, onOpenCredits }) {
  const [withdrawing, setWithdrawing] = useState(false);
  const email   = user?.email || '';
  const initial = (email[0] || 'U').toUpperCase();

  const handleLogout = async () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); onClose(); } },
    ]);
  };

  const handleWithdraw = () => {
    Alert.alert('회원 탈퇴', '탈퇴하면 모든 데이터가 즉시 삭제됩니다.\n정말 탈퇴하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: async () => {
        setWithdrawing(true);
        try {
          await supabase.from('user_credits').delete().eq('user_id', user.id);
          await supabase.auth.admin?.deleteUser(user.id);
          await supabase.auth.signOut();
          onClose();
        } catch (e) {
          await supabase.auth.signOut();
          onClose();
        } finally { setWithdrawing(false); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>설정</Text>
          <Text style={styles.headerSub}>Settings</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <X size={22} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* 계정 */}
        <TouchableOpacity activeOpacity={0.85} onPress={onOpenCredits} style={styles.card}>
          <Text style={styles.cardLabel}>계정</Text>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.creditRow}>
                <Zap size={12} color={C.teal} fill={C.teal} />
                <Text style={styles.creditText}>크레딧 {credits}장 보유</Text>
              </View>
            </View>
            <ChevronRight size={20} color={C.textLabel} strokeWidth={2} />
          </View>
        </TouchableOpacity>

        {/* 법적 정보 */}
        <View style={[styles.card, { paddingBottom: 0 }]}>
          <Text style={styles.cardLabel}>법적 정보</Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <View style={styles.rowIconWrap}><Shield size={18} color={C.teal} strokeWidth={2.2} /></View>
            <Text style={styles.rowText}>개인정보처리방침</Text>
            <ChevronRight size={18} color={C.textLabel} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.thinSep} />
          <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => Linking.openURL(TERMS_URL)}>
            <View style={styles.rowIconWrap}><FileText size={18} color={C.teal} strokeWidth={2.2} /></View>
            <Text style={styles.rowText}>이용약관</Text>
            <ChevronRight size={18} color={C.textLabel} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={[styles.card, { paddingBottom: 0 }]}>
          <Text style={styles.cardLabel}>앱 정보</Text>
          <InfoRow label="앱 이름" value="명함스캔" />
          <View style={styles.thinSep} />
          <InfoRow label="버전" value="1.0.0" />
          <View style={styles.thinSep} />
          <InfoRow label="문의" value="ssmkra@gmail.com" />
        </View>

        {/* 계정 관리 */}
        <View style={[styles.card, { paddingBottom: 0 }]}>
          <Text style={styles.cardLabel}>계정 관리</Text>
          <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={handleLogout}>
            <View style={styles.rowIconWrap}><LogOut size={18} color={C.textMuted} strokeWidth={2.2} /></View>
            <Text style={styles.rowText}>로그아웃</Text>
            <ChevronRight size={18} color={C.textLabel} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.thinSep} />
          <TouchableOpacity activeOpacity={0.7} style={[styles.row, styles.withdrawRow]} onPress={handleWithdraw} disabled={withdrawing}>
            <View style={[styles.rowIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              {withdrawing ? <ActivityIndicator size="small" color={C.danger} /> : <Trash2 size={18} color={C.danger} strokeWidth={2.2} />}
            </View>
            <Text style={[styles.rowText, { color: C.danger, fontWeight: '700' }]}>회원 탈퇴</Text>
            <ChevronRight size={18} color={C.danger} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  header: { backgroundColor: C.navy, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 28, flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(0,191,165,0.6)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  closeBtn: { padding: 6, marginTop: 4 },
  body: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#A89F88', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: C.textLabel, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' },
  accountRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', shadowColor: C.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  email: { fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  creditRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  creditText: { fontSize: 12, color: C.teal, fontWeight: '700', marginLeft: 5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIconWrap: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(0,191,165,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text, letterSpacing: -0.2 },
  thinSep: { height: 1, backgroundColor: C.separator, marginLeft: 44 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  infoLabel: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: C.text, fontWeight: '700', letterSpacing: -0.2 },
  withdrawRow: { backgroundColor: C.dangerTint, marginHorizontal: -18, paddingHorizontal: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
});
