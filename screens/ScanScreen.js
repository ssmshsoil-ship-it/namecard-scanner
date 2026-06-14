import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, StatusBar, SafeAreaView, TextInput, ActivityIndicator,
  Alert, Modal, FlatList,
} from 'react-native';
import {
  Camera, Image as ImageIcon, Sparkles, Zap, Settings, ScanLine,
  Phone, Building2, User, Mail, MapPin, UserPlus, RotateCcw,
  Briefcase, Smartphone, PhoneCall, Printer, Globe, CheckCircle,
  FileText, Plus, AlertCircle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Contacts from 'expo-contacts';
import { supabase } from '../supabase';
import CardCameraScreen from './CardCameraScreen';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

const C = {
  navy: '#0D1B2A', navySoft: '#1A2B3C',
  teal: '#00BFA5', tealSoft: '#E6F9F6', tealTint: '#F0FBF9',
  tealBorder: 'rgba(0,191,165,0.3)', amber: '#F59E0B',
  bg: '#FAFAF8', card: '#FFFFFF', text: '#0D1B2A',
  textMuted: '#6B7785', textLabel: '#94A3B8',
  border: '#ECECE8', separator: '#F1F1ED',
  green: '#10B981', white: '#FFFFFF',
  red: '#EF4444', redSoft: '#FEF2F2',
};

const FIELD_DEFS = [
  { key: 'company',  Icon: Building2,  label: '회사' },
  { key: 'branch',   Icon: MapPin,     label: '지점' },
  { key: 'name',     Icon: User,       label: '이름' },
  { key: 'title',    Icon: Briefcase,  label: '직책' },
  { key: 'mobile',   Icon: Smartphone, label: '휴대폰',   keyboardType: 'phone-pad' },
  { key: 'tel',      Icon: PhoneCall,  label: '회사전화', keyboardType: 'phone-pad' },
  { key: 'fax',      Icon: Printer,    label: '팩스',     keyboardType: 'phone-pad' },
  { key: 'email',    Icon: Mail,       label: '이메일',   keyboardType: 'email-address' },
  { key: 'address',  Icon: MapPin,     label: '주소' },
  { key: 'url',      Icon: Globe,      label: '웹사이트', keyboardType: 'url' },
];

// ── AI 프롬프트 (OCR 정확도 향상) ───────────────────────────
const SCAN_PROMPT = '이 이미지는 명함 사진입니다. 명함 카드 영역에 인쇄된 텍스트만 정확하게 추출하세요. 배경, 테이블, 손 등 명함 외 요소는 완전히 무시하세요. 회사명·이름·직책은 원문 그대로, 전화번호는 숫자와 하이픈만 포함하세요. 반드시 순수 JSON만 반환 (설명·마크다운 금지): {"company":"상호명","branch":"지점명(없으면 빈칸)","name":"성명","title":"직책(없으면 빈칸)","mobile":"휴대폰(없으면 빈칸)","tel":"회사전화(없으면 빈칸)","fax":"팩스(없으면 빈칸)","email":"이메일(없으면 빈칸)","address":"주소(없으면 빈칸)","url":"웹사이트(없으면 빈칸)"}';

export default function ScanScreen({ user, credits, setCredits, onOpenSettings, onOpenCredits }) {
  const [images, setImages]         = useState([]);       // 일괄 스캔용 이미지 배열
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [memo, setMemo]             = useState('');       // ① 메모 기능
  const [batchMode, setBatchMode]   = useState(false);    // ⑥ 일괄 스캔 모드
  const [batchProgress, setBatchProgress] = useState(''); // 일괄 진행 상태

  // 단일 모드 이미지 (첫 번째)
  const image = images[0] || null;

  useEffect(() => { fetchCredits(); }, []);

  const fetchCredits = async () => {
    const { data } = await supabase
      .from('user_credits').select('credits').eq('user_id', user.id).single();
    if (data) setCredits(data.credits);
  };

  const handleCameraCapture = (img) => {
    setShowCamera(false);
    if (batchMode) {
      if (images.length >= 3) { Alert.alert('알림', '일괄 스캔은 최대 3장까지 가능합니다.'); return; }
      setImages(prev => [...prev, img]);
    } else {
      setImages([img]);
      setResult(null);
      setMemo('');
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('오류', '갤러리 권한이 필요합니다.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.9, allowsEditing: false });
    if (!r.canceled) {
      if (batchMode) {
        if (images.length >= 3) { Alert.alert('알림', '일괄 스캔은 최대 3장까지 가능합니다.'); return; }
        setImages(prev => [...prev, r.assets[0]]);
      } else {
        setImages([r.assets[0]]);
        setResult(null);
        setMemo('');
      }
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  // ── 단일 분석 ────────────────────────────────────────────
  const analyzeSingle = async (img) => {
    let base64Data = img.base64;
    if (!base64Data) {
      const cv = await ImageManipulator.manipulateAsync(img.uri, [], { base64: true, format: ImageManipulator.SaveFormat.JPEG });
      base64Data = cv.base64;
    }
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5', max_tokens: 1024,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: base64Data } },
          { type: 'text', text: SCAN_PROMPT },
        ]}]
      })
    });
    if (!res.ok) throw new Error('API 오류: ' + res.status);
    const data = await res.json();
    return JSON.parse(data.content[0].text.trim().replace(/```json|```/g, '').trim());
  };

  // ── 단일 스캔 ────────────────────────────────────────────
  const analyze = async () => {
    if (!image || credits <= 0) return;
    setLoading(true);
    try {
      const parsed = await analyzeSingle(image);
      setResult(parsed);
      await supabase.from('user_credits').update({ credits: credits - 1, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      setCredits(p => p - 1);
    } catch (e) { Alert.alert('오류', '명함 분석에 실패했습니다.'); }
    finally { setLoading(false); }
  };

  // ── 일괄 스캔 (성공한 것만 크레딧 차감) ─────────────────
  const analyzeBatch = async () => {
    if (images.length === 0) return;
    if (credits < images.length) {
      Alert.alert('크레딧 부족', `${images.length}장 스캔에 ${images.length}크레딧이 필요합니다.\n현재 크레딧: ${credits}장`);
      return;
    }
    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    let savedNames = [];

    for (let i = 0; i < images.length; i++) {
      setBatchProgress(`${i + 1}/${images.length}장 분석 중...`);
      try {
        const parsed = await analyzeSingle(images[i]);
        // 성공 시에만 크레딧 차감
        await supabase.from('user_credits').update({ credits: credits - successCount - 1, updated_at: new Date().toISOString() }).eq('user_id', user.id);
        setCredits(p => p - 1);
        // 바로 저장
        const displayName = buildDisplayName(parsed);
        await saveContactDirect(parsed);
        savedNames.push(displayName);
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    setBatchProgress('');
    setLoading(false);

    if (failCount === 0) {
      Alert.alert('일괄 저장 완료! 🎉', `${successCount}장 모두 연락처에 저장되었습니다.\n${savedNames.join(', ')}`);
    } else {
      Alert.alert('일괄 저장 완료', `성공: ${successCount}장\n실패: ${failCount}장\n실패한 명함은 다시 시도해주세요.`);
    }
    setImages([]);
    setBatchMode(false);
  };

  const buildDisplayName = (r) =>
    [r.company, r.branch, r.name, r.title].map(s => (s||'').trim()).filter(Boolean).join(' ');

  // ── ② 중복 감지 ──────────────────────────────────────────
  const checkDuplicate = async (phoneNumber) => {
    if (!phoneNumber) return false;
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return false;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      const normalizedNew = phoneNumber.replace(/[^0-9]/g, '');
      return data.some(contact =>
        contact.phoneNumbers?.some(p =>
          p.number?.replace(/[^0-9]/g, '') === normalizedNew
        )
      );
    } catch (e) { return false; }
  };

  // ── 연락처 저장 (직접 호출용) ─────────────────────────────
  const saveContactDirect = async (r, memoText = '') => {
    const displayName = buildDisplayName(r);
    const contact = {
      [Contacts.Fields.FirstName]: displayName,
      [Contacts.Fields.PhoneNumbers]: [],
      [Contacts.Fields.Emails]: [],
      [Contacts.Fields.UrlAddresses]: [],
      [Contacts.Fields.Note]: memoText || '',
    };
    if (r.mobile)  contact[Contacts.Fields.PhoneNumbers].push({ label: 'mobile', number: r.mobile });
    if (r.tel)     contact[Contacts.Fields.PhoneNumbers].push({ label: 'work',   number: r.tel });
    if (r.fax)     contact[Contacts.Fields.PhoneNumbers].push({ label: 'other',  number: r.fax });
    if (r.email)   contact[Contacts.Fields.Emails].push({ label: 'work', email: r.email });
    if (r.url)     contact[Contacts.Fields.UrlAddresses].push({ label: 'work', url: r.url });
    if (r.company) contact[Contacts.Fields.Company]  = r.company;
    if (r.title)   contact[Contacts.Fields.JobTitle] = r.title;

    // ③ 명함사진 연락처 첨부 (Android)
    if (image?.uri) {
      try {
        contact[Contacts.Fields.Image] = { uri: image.uri };
      } catch (e) {}
    }

    await Contacts.addContactAsync(contact);
  };

  // ── 저장 버튼 ────────────────────────────────────────────
  const saveContact = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('오류', '연락처 권한이 필요합니다.'); return; }

      const displayName = buildDisplayName(result);

      // ② 중복 감지
      const isDuplicate = await checkDuplicate(result.mobile || result.tel);
      if (isDuplicate) {
        Alert.alert(
          '이미 저장된 연락처',
          `"${displayName}"의 번호가 이미 연락처에 있습니다.\n그래도 저장할까요?`,
          [
            { text: '취소', style: 'cancel' },
            { text: '저장', onPress: async () => {
              await saveContactDirect(result, memo);
              Alert.alert('저장 완료! ✅', '"' + displayName + '" 연락처에 저장되었습니다.');
            }},
          ]
        );
        return;
      }

      await saveContactDirect(result, memo);
      Alert.alert('저장 완료! ✅', '"' + displayName + '" 연락처에 저장되었습니다.');
    } catch (e) { Alert.alert('오류', '연락처 저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const updateField = (key, value) => setResult(prev => ({ ...prev, [key]: value }));

  const resetAll = () => { setImages([]); setResult(null); setMemo(''); };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <CardCameraScreen onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      </Modal>

      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoWrap}>
            <View style={styles.logoSquare}>
              <ScanLine size={22} color={C.teal} strokeWidth={2.4} />
            </View>
            <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>CardScan AI</Text>
            <Text style={styles.headerSub}>명함 즉시저장 · 발신자 확인</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity activeOpacity={0.85} style={styles.creditPill} onPress={onOpenCredits}>
            <Zap size={13} color={C.teal} fill={C.teal} />
            <Text style={styles.creditPillText}>{credits}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.gearBtn} onPress={onOpenSettings}>
            <Settings size={20} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 18, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* 모드 토글 */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, !batchMode && styles.modeBtnActive]}
            onPress={() => { setBatchMode(false); resetAll(); }}>
            <Text style={[styles.modeBtnText, !batchMode && styles.modeBtnTextActive]}>단일 스캔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, batchMode && styles.modeBtnActive]}
            onPress={() => { setBatchMode(true); resetAll(); }}>
            <Text style={[styles.modeBtnText, batchMode && styles.modeBtnTextActive]}>일괄 스캔 (최대 3장)</Text>
          </TouchableOpacity>
        </View>

        {/* 단일 모드 미리보기 */}
        {!batchMode && (
          <>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>명함 미리보기</Text>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, { backgroundColor: image ? C.teal : '#CBD5E1' }]} />
                <Text style={styles.statusText}>{image ? '준비됨' : '대기중'}</Text>
              </View>
            </View>

            <View style={styles.previewWrap}>
              {image ? (
                <>
                  <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity style={styles.retakeBtn} activeOpacity={0.85} onPress={resetAll}>
                    <RotateCcw size={13} color="#FFFFFF" />
                    <Text style={styles.retakeText}>다시찍기</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.cornerTL} /><View style={styles.cornerTR} />
                  <View style={styles.cornerBL} /><View style={styles.cornerBR} />
                  <View style={styles.emptyIconCircle}>
                    <Camera size={28} color={C.teal} strokeWidth={2} />
                  </View>
                  <Text style={styles.emptyText}>명함을 프레임에 맞춰 촬영하세요</Text>
                  <Text style={styles.emptySubText}>밝은 곳에서 · 평평하게</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* 일괄 모드 미리보기 */}
        {batchMode && (
          <>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>명함 목록 ({images.length}/3장)</Text>
              <Text style={styles.statusText}>{images.length}크레딧 소모 예정</Text>
            </View>
            <View style={styles.batchGrid}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.batchThumb}>
                  <Image source={{ uri: img.uri }} style={styles.batchThumbImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.batchRemove} onPress={() => removeImage(idx)}>
                    <Text style={styles.batchRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 3 && (
                <TouchableOpacity style={styles.batchAdd} onPress={() => setShowCamera(true)}>
                  <Plus size={28} color={C.teal} />
                  <Text style={styles.batchAddText}>추가</Text>
                </TouchableOpacity>
              )}
            </View>
            {batchProgress ? (
              <View style={styles.batchProgressBox}>
                <ActivityIndicator color={C.teal} size="small" />
                <Text style={styles.batchProgressText}>{batchProgress}</Text>
              </View>
            ) : null}
          </>
        )}

        {/* 버튼 */}
        <View style={styles.rowButtons}>
          <TouchableOpacity activeOpacity={0.85} style={[styles.actionBtn, styles.actionBtnSolid]} onPress={() => setShowCamera(true)}>
            <Camera size={18} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.actionBtnSolidText}>카메라</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={[styles.actionBtn, styles.actionBtnOutline]} onPress={pickFromGallery}>
            <ImageIcon size={18} color={C.teal} strokeWidth={2.2} />
            <Text style={styles.actionBtnOutlineText}>갤러리</Text>
          </TouchableOpacity>
        </View>

        {/* 분석 버튼 */}
        {!batchMode ? (
          <TouchableOpacity activeOpacity={0.9}
            style={[styles.scanCta, (!image || loading || credits <= 0) && { opacity: 0.5 }]}
            disabled={!image || loading || credits <= 0}
            onPress={analyze}>
            {loading
              ? <ActivityIndicator color={C.teal} size="small" />
              : <Sparkles size={20} color={C.teal} strokeWidth={2.2} />}
            <Text style={styles.scanCtaText}>
              {loading ? '분석 중...' : credits <= 0 ? '크레딧 부족' : '명함 분석 시작'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.9}
            style={[styles.scanCta, (images.length === 0 || loading) && { opacity: 0.5 }]}
            disabled={images.length === 0 || loading}
            onPress={analyzeBatch}>
            {loading
              ? <ActivityIndicator color={C.teal} size="small" />
              : <Sparkles size={20} color={C.teal} strokeWidth={2.2} />}
            <Text style={styles.scanCtaText}>
              {loading ? batchProgress || '분석 중...' : `${images.length}장 일괄 저장 시작`}
            </Text>
          </TouchableOpacity>
        )}

        {/* 결과 영역 (단일 모드) */}
        {!batchMode && result && (
          <>
            {/* 발신자 카드 */}
            <View style={styles.callerCard}>
              <View style={styles.callerLabelRow}>
                <View style={styles.tealDot} />
                <Text style={styles.callerLabel}>발신자 표시</Text>
              </View>
              <View style={styles.callerBody}>
                <View style={styles.callerPhoneCircle}>
                  <Phone size={22} color={C.teal} fill={C.teal} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.callerCompany}>
                    {[result.company, result.branch].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.callerName}>
                    {result.name}
                    {result.title ? <Text style={styles.callerTitle}> · {result.title}</Text> : null}
                  </Text>
                </View>
              </View>
              <View style={styles.callerHint}>
                <Text style={styles.callerHintText}>전화 수신 시 위와 같이 표시됩니다</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 26, marginBottom: 12 }]}>인식된 정보</Text>

            {/* 필드 */}
            <View style={styles.fieldsCard}>
              {FIELD_DEFS.map(({ key, Icon, label, keyboardType }, idx, arr) => (
                <View key={key}>
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldIconSquare}><Icon size={15} color={C.teal} strokeWidth={2.4} /></View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                      <TextInput
                        style={styles.fieldValue}
                        value={result[key] || ''}
                        onChangeText={v => updateField(key, v)}
                        keyboardType={keyboardType || 'default'}
                        placeholderTextColor={C.textLabel}
                        placeholder={label}
                      />
                    </View>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.fieldSeparator} />}
                </View>
              ))}
            </View>

            {/* ① 메모 입력 */}
            <View style={styles.memoCard}>
              <View style={styles.memoHeader}>
                <FileText size={15} color={C.teal} strokeWidth={2.4} />
                <Text style={styles.memoLabel}>MEMO</Text>
              </View>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="언제, 어디서 만났는지 메모 (선택)"
                placeholderTextColor={C.textLabel}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* 저장 버튼 */}
            <TouchableOpacity activeOpacity={0.9}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveContact} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <UserPlus size={20} color="#FFFFFF" strokeWidth={2.2} />}
              <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '연락처에 저장'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  header: { backgroundColor: C.navy, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logoWrap: { position: 'relative' },
  logoSquare: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,191,165,0.12)', borderWidth: 1, borderColor: 'rgba(0,191,165,0.25)', alignItems: 'center', justifyContent: 'center' },
  aiBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: C.teal, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, borderColor: C.navy },
  aiBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  creditPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,191,165,0.15)', borderWidth: 1, borderColor: 'rgba(0,191,165,0.4)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  creditPillText: { color: C.teal, fontSize: 13, fontWeight: '700', marginLeft: 4 },
  gearBtn: { marginLeft: 10, padding: 6 },
  body: { flex: 1, backgroundColor: C.bg },

  // 모드 토글
  modeRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: C.navy },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
  modeBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, color: C.textMuted, fontWeight: '600' },

  // 단일 미리보기
  previewWrap: { aspectRatio: 16/10, backgroundColor: C.navy, borderRadius: 18, overflow: 'hidden', position: 'relative', elevation: 4 },
  previewImage: { width: '100%', height: '100%' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: 14, borderWidth: 1, borderColor: C.tealBorder, borderStyle: 'dashed', borderRadius: 14 },
  cornerTL: { position: 'absolute', top: 10, left: 10, width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.teal, borderTopLeftRadius: 4 },
  cornerTR: { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.teal, borderTopRightRadius: 4 },
  cornerBL: { position: 'absolute', bottom: 10, left: 10, width: 18, height: 18, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: C.teal, borderBottomLeftRadius: 4 },
  cornerBR: { position: 'absolute', bottom: 10, right: 10, width: 18, height: 18, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.teal, borderBottomRightRadius: 4 },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,191,165,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  emptySubText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 },
  retakeBtn: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  retakeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginLeft: 5 },

  // 일괄 스캔
  batchGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  batchThumb: { width: 100, height: 70, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  batchThumbImg: { width: '100%', height: '100%' },
  batchRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  batchRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  batchAdd: { width: 100, height: 70, borderRadius: 10, borderWidth: 1.5, borderColor: C.tealBorder, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  batchAddText: { color: C.teal, fontSize: 12, fontWeight: '600' },
  batchProgressBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.tealTint, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.tealBorder },
  batchProgressText: { color: C.teal, fontSize: 13, fontWeight: '600' },

  // 버튼
  rowButtons: { flexDirection: 'row', marginTop: 16, gap: 10 },
  actionBtn: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionBtnSolid: { backgroundColor: C.teal, shadowColor: C.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3 },
  actionBtnSolidText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  actionBtnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.teal },
  actionBtnOutlineText: { color: C.teal, fontSize: 15, fontWeight: '700', marginLeft: 8 },
  scanCta: { marginTop: 12, height: 56, borderRadius: 16, backgroundColor: C.navy, borderWidth: 1.5, borderColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  scanCtaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10, letterSpacing: -0.2 },

  // 발신자 카드
  callerCard: { marginTop: 26, backgroundColor: C.navySoft, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(0,191,165,0.18)', elevation: 5 },
  callerLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tealDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal, marginRight: 6 },
  callerLabel: { color: C.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  callerBody: { flexDirection: 'row', alignItems: 'center' },
  callerPhoneCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,191,165,0.15)', borderWidth: 1, borderColor: 'rgba(0,191,165,0.35)', alignItems: 'center', justifyContent: 'center' },
  callerCompany: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  callerName: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  callerTitle: { color: C.teal, fontWeight: '600' },
  callerHint: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  callerHintText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // 필드
  fieldsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, elevation: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  fieldIconSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(0,191,165,0.1)', alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10, color: C.textLabel, fontWeight: '700', letterSpacing: 0.8 },
  fieldValue: { fontSize: 15, color: C.text, fontWeight: '600', marginTop: 2, padding: 0, minHeight: 22 },
  fieldSeparator: { height: 1, backgroundColor: C.separator },

  // ① 메모
  memoCard: { marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 1 },
  memoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  memoLabel: { fontSize: 10, color: C.textLabel, fontWeight: '700', letterSpacing: 0.8 },
  memoInput: { fontSize: 14, color: C.text, minHeight: 44, textAlignVertical: 'top', padding: 0 },

  // 저장 버튼
  saveBtn: { marginTop: 18, height: 58, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.teal, elevation: 6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10, letterSpacing: -0.2 },
});
