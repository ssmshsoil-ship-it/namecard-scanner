import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert, TextInput
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import { useState } from 'react';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async (useCamera) => {
    let pickerResult;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
        return;
      }
      pickerResult = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 권한이 필요합니다.');
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
    }
    if (!pickerResult.canceled) {
      setImage(pickerResult.assets[0]);
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const base64 = image.base64;
      const mimeType = image.mimeType || 'image/jpeg';

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
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
              { type: 'text', text:  '이 명함 이미지에서 정보를 정확하게 추출하세요.\n한글 이름은 특히 정확하게 읽으세요. 받침 등 헷갈리는 글자 주의.\n반드시 순수 JSON만 응답 (마크다운 없이):\n{"company":"상호","branch":"지점명(없으면 빈문자열)","name":"성함(정확히)","title":"직책(없으면 빈문자열)","mobile":"휴대폰(없으면 빈문자열)","tel":"회사전화(없으면 빈문자열)","fax":"팩스(없으면 빈문자열)","email":"이메일(없으면 빈문자열)","address":"직장주소(없으면 빈문자열)","url":"홈페이지URL www포함 전부(없으면 빈문자열)"}\n없는 필드는 빈문자열. JSON 외 텍스트 절대 금지.' }
            ]
          }]
        })
      });

      if (!response.ok) throw new Error(`API 오류: ${response.status}`);
      const data = await response.json();
      const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      setResult(parsed);
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '명함 분석에 실패했습니다.\n' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildDisplayName = (r) => {
    return [r.company, r.branch, r.name, r.title]
      .map(s => (s || '').trim()).filter(Boolean).join(' ');
  };

  const saveContact = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '연락처 접근 권한이 필요합니다.');
        return;
      }
      const displayName = buildDisplayName(result);
      const contact = {
        [Contacts.Fields.FirstName]: displayName,
        [Contacts.Fields.PhoneNumbers]: [],
        [Contacts.Fields.Emails]: [],
      };
      if (result.mobile) contact[Contacts.Fields.PhoneNumbers].push({ label: 'mobile', number: result.mobile });
      if (result.tel)    contact[Contacts.Fields.PhoneNumbers].push({ label: 'work',   number: result.tel });
      if (result.fax)    contact[Contacts.Fields.PhoneNumbers].push({ label: 'other',  number: result.fax });
      if (result.email)  contact[Contacts.Fields.Emails].push({ label: 'work', email: result.email });
      if (result.company) contact[Contacts.Fields.Company] = result.company;
      if (result.title)   contact[Contacts.Fields.JobTitle] = result.title;

      await Contacts.addContactAsync(contact);
      Alert.alert('저장 완료', `"${displayName}" 연락처에 저장됐습니다.`);
    } catch (e) {
      Alert.alert('오류', '연락처 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setResult(prev => ({ ...prev, [key]: value }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>🌱 명함 스캐너</Text>
        <Text style={styles.headerSub}>찍으면 3초 · 발신번호 자동 표시</Text>
      </View>

      <View style={styles.imageBox}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>명함 사진을 추가하세요</Text>
          </View>
        )}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => pickImage(true)}>
          <Text style={styles.btnSecondaryText}>📷 카메라</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => pickImage(false)}>
          <Text style={styles.btnSecondaryText}>🖼 갤러리</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btnMain, (!image || loading) && styles.btnDisabled]}
        onPress={analyze}
        disabled={!image || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnMainText}>명함 분석 시작</Text>
        }
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.displayNameBox}>
            <Text style={styles.displayNameLabel}>📱 발신번호 표시</Text>
            <Text style={styles.displayName}>{buildDisplayName(result)}</Text>
          </View>

          {[
            { key: 'company', label: '상호' },
            { key: 'branch',  label: '지점' },
            { key: 'name',    label: '성함' },
            { key: 'title',   label: '직책' },
            { key: 'mobile',  label: '휴대폰' },
            { key: 'tel',     label: '직통' },
            { key: 'fax',     label: '팩스' },
            { key: 'email',   label: '이메일' },
            { key: 'address', label: '직장주소' },
            { key: 'url', label: '홈페이지' },
          ].map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={result[field.key] || ''}
                onChangeText={(v) => updateField(field.key, v)}
                placeholder={field.label}
                placeholderTextColor="#ccc"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btnSave, saving && styles.btnDisabled]}
            onPress={saveContact}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnSaveText}>📲 연락처 저장</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8f6' },
  content: { paddingBottom: 60 },
  header: { backgroundColor: '#1a4a2e', paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  imageBox: {
    margin: 16, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#fff', height: 200,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderText: { color: '#b0b5a8', fontSize: 14 },
  btnRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  btnSecondary: {
    flex: 1, backgroundColor: '#e8f5ee',
    borderWidth: 1.5, borderColor: '#2d7a4f',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  btnSecondaryText: { color: '#1a4a2e', fontWeight: '700', fontSize: 14 },
  btnMain: {
    marginHorizontal: 16, backgroundColor: '#2d7a4f',
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    shadowColor: '#2d7a4f', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { backgroundColor: '#b0b5a8' },
  btnMainText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultCard: {
    margin: 16, backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  displayNameBox: { backgroundColor: '#1a4a2e', borderRadius: 10, padding: 12, marginBottom: 14 },
  displayNameLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 4 },
  displayName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  fieldLabel: { width: 55, fontSize: 12, fontWeight: '700', color: '#2d7a4f' },
  fieldInput: {
    flex: 1, fontSize: 14, color: '#3a3d36',
    paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: '#f7f8f6', borderRadius: 6,
  },
  btnSave: {
    marginTop: 16, backgroundColor: '#2d7a4f',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
