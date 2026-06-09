import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, StatusBar, Image, ActivityIndicator, Alert,
} from 'react-native';
import {
  Camera, Image as ImageIcon, Phone, Building2, MapPin,
  User, Briefcase, Smartphone, PhoneCall, Printer,
  Mail, Globe, UserPlus, ScanLine, Sparkles, LogOut, Zap,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { supabase } from '../supabase';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', slate: '#0F172A', slate2: '#1E293B',
  cyan: '#06B6D4', text: '#334155', muted: '#64748B',
  border: '#E2E8F0', secondary: '#F1F5F9', white: '#FFFFFF',
};

const FIELD_DEFS = [
  { key: 'company', Icon: Building2, label: 'Company' },
  { key: 'branch',  Icon: MapPin,    label: 'Branch' },
  { key: 'name',    Icon: User,      label: 'Name' },
  { key: 'title',   Icon: Briefcase, label: 'Title' },
  { key: 'mobile',  Icon: Smartphone,label: 'Mobile',   keyboardType: 'phone-pad' },
  { key: 'tel',     Icon: PhoneCall, label: 'Work Tel', keyboardType: 'phone-pad' },
  { key: 'fax',     Icon: Printer,   label: 'Fax',      keyboardType: 'phone-pad' },
  { key: 'email',   Icon: Mail,      label: 'Email',    keyboardType: 'email-address' },
  { key: 'address', Icon: MapPin,    label: 'Address' },
  { key: 'url',     Icon: Globe,     label: 'Website',  keyboardType: 'url' },
];

export default function ScanScreen({ user }) {
  const [image, setImage]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [saving, setSaving]   = useState(false);
  const [credits, setCredits] = useState(0);

  useEffect(() => { fetchCredits(); }, []);

  const fetchCredits = async () => {
    const { data } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();
    if (data) setCredits(data.credits);
  };

  const pickImage = async (useCamera) => {
    let pickerResult;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('권한 필요', '카메라 권한이 필요합니다.'); return; }
      pickerResult = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('권한 필요', '갤러리 권한이 필요합니다.'); return; }
      pickerResult = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    }
    if (!pickerResult.canceled) { setImage(pickerResult.assets[0]); setResult(null); }
  };

  const analyze = async () => {
    if (!image) return;
    if (credits <= 0) {
      Alert.alert('크레딧 부족', '크레딧이 없습니다. 충전해주세요.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 } },
              { type: 'text', text: '이 명함 이미지에서 정보를 정확하게 추출하세요.\n한글 이름은 초성/중성/종성을 정확히 구분해서 읽으세요.\n반드시 순수 JSON만 응답 (마크다운 없이):\n{"company":"상호","branch":"지점명(없으면 빈문자열)","name":"성함(정확히)","title":"직책(없으면 빈문자열)","mobile":"휴대폰(없으면 빈문자열)","tel":"회사전화(없으면 빈문자열)","fax":"팩스(없으면 빈문자열)","email":"이메일(없으면 빈문자열)","address":"직장주소(없으면 빈문자열)","url":"홈페이지URL(없으면 빈문자열)"}\n없는 필드는 빈문자열. JSON 외 텍스트 절대 금지.' }
            ]
          }]
        })
      });
      if (!response.ok) throw new Error(`API 오류: ${response.status}`);
      const data = await response.json();
      const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setResult(parsed);

      // 크레딧 차감
      await supabase
        .from('user_credits')
        .update({ credits: credits - 1, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      setCredits(prev => prev - 1);

      // 스캔 기록 저장
      await supabase.from('scan_history').insert({
        user_id: user.id, ...parsed
      });

    } catch (e) {
      Alert.alert('오류', '명함 분석에 실패했습니다.\n' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildDisplayName = (r) =>
    [r.company, r.branch, r.name, r.title].map(s => (s||'').trim()).filter(Boolean).join(' ');

  const saveContact = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('권한 필요', '연락처 권한이 필요합니다.'); return; }
      const displayName = buildDisplayName(result);
      const contact = {
        [Contacts.Fields.FirstName]: displayName,
        [Contacts.Fields.PhoneNumbers]: [],
        [Contacts.Fields.Emails]: [],
        [Contacts.Fields.UrlAddresses]: [],
      };
      if (result.mobile)  contact[Contacts.Fields.PhoneNumbers].push({ label: 'mobile', number: result.mobile });
      if (result.tel)     contact[Contacts.Fields.PhoneNumbers].push({ label: 'work',   number: result.tel });
      if (result.fax)     contact[Contacts.Fields.PhoneNumbers].push({ label: 'other',  number: result.fax });
      if (result.email)   contact[Contacts.Fields.Emails].push({ label: 'work', email: result.email });
      if (result.url)     contact[Contacts.Fields.UrlAddresses].push({ label: 'work', url: result.url });
      if (result.company) contact[Contacts.Fields.Company]  = result.company;
      if (result.title)   contact[Contacts.Fields.JobTitle] = result.title;
      await Contacts.addContactAsync(contact);
      Alert.alert('✅ 저장 완료', `"${displayName}"\n연락처에 저장됐습니다.`);
    } catch (e) {
      Alert.alert('오류', '연락처 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setResult(prev => ({ ...prev, [key]: value }));

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.slate} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.logoBox}>
                <ScanLine size={20} color={C.cyan} />
                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
              </View>
              <View>
                <Text style={styles.headerTitle}>BizCard Scanner</Text>
                <Text style={styles.headerSubtitle}>AI-powered contact capture</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {/* 크레딧 표시 */}
              <View style={styles.creditBadge}>
                <Zap size={12} color={C.cyan} />
                <Text style={styles.creditText}>{credits}</Text>
              </View>
              {/* 로그아웃 */}
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <LogOut size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.main}>

          {/* Card Preview */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>Card Preview</Text>
              <View style={styles.readyPill}>
                <View style={styles.readyDot} />
                <Text style={styles.readyText}>READY</Text>
              </View>
            </View>

            <View style={styles.previewBox}>
              {image ? (
                <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <>
                  <View style={styles.previewIcon}>
                    <Camera size={24} color={C.cyan} />
                  </View>
                  <Text style={styles.previewHint}>Capture or upload a business card</Text>
                </>
              )}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>

            <View style={styles.row2}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => pickImage(true)}>
                <Camera size={16} color={C.cyan} />
                <Text style={styles.outlineBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => pickImage(false)}>
                <ImageIcon size={16} color={C.cyan} />
                <Text style={styles.outlineBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.ctaBtn, (!image || loading || credits <= 0) && styles.ctaBtnDisabled]}
              onPress={analyze}
              disabled={!image || loading || credits <= 0}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={C.slate} size="small" />
              ) : (
                <Sparkles size={16} color={C.slate} />
              )}
              <Text style={styles.ctaText}>
                {loading ? 'Analyzing...' : credits <= 0 ? '크레딧 부족' : 'Scan Business Card'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Caller ID Preview */}
          {result && (
            <View style={styles.darkCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.darkLabel}>CALLER ID PREVIEW</Text>
                <View style={styles.aiPill}>
                  <Sparkles size={11} color={C.cyan} />
                  <Text style={styles.aiPillText}>AI</Text>
                </View>
              </View>
              <View style={styles.callerRow}>
                <View style={styles.callerIcon}>
                  <Phone size={20} color={C.cyan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.callerCompany}>
                    {[result.company, result.branch].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.callerName}>
                    {result.name}
                    {result.title ? <Text style={{ color: C.cyan }}> · {result.title}</Text> : null}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Extracted Details */}
          {result && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Extracted Details</Text>
                  <Text style={styles.sectionSubtitle}>Tap any field to edit</Text>
                </View>
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>98% confidence</Text>
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                {FIELD_DEFS.map(({ key, Icon, label, keyboardType }) => (
                  <View key={key} style={styles.fieldRow}>
                    <View style={styles.fieldIcon}>
                      <Icon size={16} color={C.cyan} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                      <TextInput
                        value={result[key] || ''}
                        onChangeText={(v) => updateField(key, v)}
                        keyboardType={keyboardType || 'default'}
                        style={styles.input}
                        placeholder={label}
                        placeholderTextColor={C.muted}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {result && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveContact}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={C.white} size="small" />
                : <UserPlus size={16} color={C.white} />
              }
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save to Contacts'}
              </Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.slate, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', alignItems: 'center', justifyContent: 'center' },
  aiBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: C.cyan, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  aiBadgeText: { fontSize: 8, fontWeight: '800', color: C.slate },
  headerTitle: { color: C.white, fontSize: 15, fontWeight: '600' },
  headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  creditBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  creditText: { color: C.cyan, fontSize: 13, fontWeight: '700' },
  logoutBtn: { padding: 6 },
  historyBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  historyText: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  main: { paddingHorizontal: 16, marginTop: -24, gap: 16 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, shadowColor: C.slate, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '500', color: C.muted },
  readyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6,182,212,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.cyan },
  readyText: { fontSize: 10, fontWeight: '700', color: C.slate, letterSpacing: 1 },
  previewBox: { aspectRatio: 1.7, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  previewIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  previewHint: { fontSize: 12, color: C.muted },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: C.cyan },
  cornerTL: { top: 12, left: 12, borderLeftWidth: 2, borderTopWidth: 2, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderRightWidth: 2, borderTopWidth: 2, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: 6 },
  row2: { flexDirection: 'row', gap: 12, marginTop: 16 },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(6,182,212,0.5)', backgroundColor: 'rgba(6,182,212,0.05)', paddingVertical: 12, borderRadius: 12 },
  outlineBtnText: { color: C.slate, fontSize: 14, fontWeight: '500' },
  ctaBtn: { marginTop: 12, backgroundColor: C.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, shadowColor: C.cyan, shadowOpacity: 0.45, shadowRadius: 16, elevation: 4 },
  ctaBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  ctaText: { color: C.slate, fontSize: 14, fontWeight: '700' },
  darkCard: { backgroundColor: C.slate, borderRadius: 18, padding: 20 },
  darkLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 2 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  aiPillText: { color: C.cyan, fontSize: 10, fontWeight: '500' },
  callerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  callerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(6,182,212,0.2)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', alignItems: 'center', justifyContent: 'center' },
  callerCompany: { color: C.white, fontSize: 16, fontWeight: '600' },
  callerName: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  sectionTitle: { color: C.slate, fontSize: 16, fontWeight: '600' },
  sectionSubtitle: { color: C.muted, fontSize: 11 },
  confidencePill: { backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  confidenceText: { color: C.slate, fontSize: 10, fontWeight: '700' },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  fieldIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  input: { marginTop: 4, height: 40, borderWidth: 1, borderColor: C.border, backgroundColor: C.secondary, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: C.slate },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.slate, borderWidth: 2, borderColor: C.cyan, paddingVertical: 16, borderRadius: 18 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: C.white, fontSize: 14, fontWeight: '700' },
});
