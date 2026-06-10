import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Zap, X, ChevronRight, Check } from 'lucide-react-native';
import { supabase } from '../supabase';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', slate: '#0F172A',
  cyan: '#06B6D4', text: '#334155', muted: '#64748B',
  border: '#E2E8F0', secondary: '#F1F5F9', white: '#FFFFFF',
  green: '#10B981',
};

const TOSS_CLIENT_KEY = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY;

const PLANS = [
  { id: 'lite',     name: '라이트',    price: 990,   credits: 30,  priceStr: '990원',   popular: false },
  { id: 'standard',name: '스탠다드',  price: 1900,  credits: 100, priceStr: '1,900원', popular: true  },
  { id: 'pro',      name: '프로',     price: 2900,  credits: 200, priceStr: '2,900원', popular: false },
];

export default function CreditScreen({ user, credits, setCredits, onClose }) {
  const [selected, setSelected]   = useState('standard');
  const [loading, setLoading]     = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl]  = useState('');

  const selectedPlan = PLANS.find(p => p.id === selected);

  const handlePayment = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const orderId = `order_${user.id.slice(0,8)}_${Date.now()}`;
      const orderName = `명함스캔 ${selectedPlan.name} ${selectedPlan.credits}장`;

      // 토스페이먼츠 결제창 HTML
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://js.tosspayments.com/v1/payment"></script>
</head>
<body>
<script>
  const tossPayments = TossPayments('${TOSS_CLIENT_KEY}');
  tossPayments.requestPayment('카드', {
    amount: ${selectedPlan.price},
    orderId: '${orderId}',
    orderName: '${orderName}',
    customerName: '${user.email}',
    successUrl: 'https://ssmshsoil-ship-it.github.io/namecard-scanner/payment-success.html?credits=${selectedPlan.credits}&userId=${user.id}',
    failUrl: 'https://ssmshsoil-ship-it.github.io/namecard-scanner/payment-fail.html',
  }).catch(function(error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error', message: error.message}));
  });
</script>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html' });
      setPaymentUrl(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      setShowWebView(true);
    } catch (e) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') {
        // 크레딧 지급
        const newCredits = credits + selectedPlan.credits;
        await supabase
          .from('user_credits')
          .update({ credits: newCredits, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        setCredits(newCredits);
        setShowWebView(false);
        Alert.alert('충전 완료!', `${selectedPlan.credits}장이 충전됐습니다.\n현재 크레딧: ${newCredits}장`);
        onClose();
      } else if (data.type === 'error') {
        setShowWebView(false);
        Alert.alert('결제 실패', data.message || '결제에 실패했습니다.');
      }
    } catch (e) {}
  };

  const handleNavigationChange = async (navState) => {
    const url = navState.url;
    if (url.includes('payment-success')) {
      const urlParams = new URL(url);
      const addCredits = parseInt(urlParams.searchParams.get('credits') || '0');
      if (addCredits > 0) {
        const newCredits = credits + addCredits;
        await supabase
          .from('user_credits')
          .update({ credits: newCredits, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        setCredits(newCredits);
        setShowWebView(false);
        Alert.alert('충전 완료!', `${addCredits}장이 충전됐습니다.\n현재 크레딧: ${newCredits}장`);
        onClose();
      }
    } else if (url.includes('payment-fail')) {
      setShowWebView(false);
      Alert.alert('결제 실패', '결제가 취소되거나 실패했습니다.');
    }
  };

  if (showWebView) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.slate }}>
        <View style={styles.webViewHeader}>
          <Text style={styles.webViewTitle}>결제</Text>
          <TouchableOpacity onPress={() => setShowWebView(false)}>
            <X size={22} color={C.white} />
          </TouchableOpacity>
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onMessage={handleWebViewMessage}
          onNavigationStateChange={handleNavigationChange}
          javaScriptEnabled
          domStorageEnabled
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>크레딧 충전</Text>
            <Text style={styles.headerSub}>월 구독 없음 · 필요할 때만 충전</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* 현재 크레딧 */}
        <View style={styles.currentBox}>
          <Zap size={18} color={C.cyan} />
          <Text style={styles.currentText}>현재 크레딧: <Text style={styles.currentNum}>{credits}장</Text></Text>
        </View>

        {/* 플랜 선택 */}
        <View style={styles.plansSection}>
          <Text style={styles.sectionTitle}>플랜 선택</Text>

          {PLANS.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, selected === plan.id && styles.planCardSelected]}
              onPress={() => setSelected(plan.id)}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>인기</Text>
                </View>
              )}
              <View style={styles.planLeft}>
                <View style={[styles.planRadio, selected === plan.id && styles.planRadioSelected]}>
                  {selected === plan.id && <Check size={12} color={C.white} />}
                </View>
                <View>
                  <Text style={[styles.planName, selected === plan.id && styles.planNameSelected]}>
                    {plan.name}
                  </Text>
                  <Text style={styles.planCredits}>{plan.credits}장</Text>
                </View>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPrice, selected === plan.id && styles.planPriceSelected]}>
                  {plan.priceStr}
                </Text>
                <Text style={styles.planPerCard}>
                  {Math.round(plan.price / plan.credits)}원/장
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 크레딧 유효기간 안내 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>✅ 크레딧 유효기간 없음 (영구 사용)</Text>
          <Text style={styles.infoText}>✅ 월 구독 없음 — 필요할 때만 충전</Text>
          <Text style={styles.infoText}>✅ 미사용 크레딧 7일 이내 환불 가능</Text>
        </View>

        {/* 결제 버튼 */}
        <TouchableOpacity
          style={[styles.payBtn, loading && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={C.slate} />
          ) : (
            <>
              <Zap size={18} color={C.slate} />
              <Text style={styles.payBtnText}>
                {selectedPlan?.priceStr}으로 {selectedPlan?.credits}장 충전
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.slate, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: C.white, fontSize: 20, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 8 },
  currentBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' },
  currentText: { fontSize: 14, color: C.text, fontWeight: '500' },
  currentNum: { color: C.cyan, fontWeight: '800', fontSize: 16 },
  plansSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  planCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: C.border, position: 'relative' },
  planCardSelected: { borderColor: C.cyan, backgroundColor: 'rgba(6,182,212,0.05)' },
  popularBadge: { position: 'absolute', top: -8, right: 16, backgroundColor: C.cyan, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  popularText: { color: C.slate, fontSize: 10, fontWeight: '800' },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  planRadioSelected: { backgroundColor: C.cyan, borderColor: C.cyan },
  planName: { fontSize: 15, fontWeight: '700', color: C.text },
  planNameSelected: { color: C.slate },
  planCredits: { fontSize: 12, color: C.muted, marginTop: 2 },
  planRight: { alignItems: 'flex-end' },
  planPrice: { fontSize: 16, fontWeight: '800', color: C.text },
  planPriceSelected: { color: C.cyan },
  planPerCard: { fontSize: 11, color: C.muted, marginTop: 2 },
  infoBox: { marginHorizontal: 16, backgroundColor: C.secondary, borderRadius: 12, padding: 14, gap: 6, marginBottom: 16 },
  infoText: { fontSize: 13, color: C.muted },
  payBtn: { marginHorizontal: 16, backgroundColor: C.cyan, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, shadowColor: C.cyan, shadowOpacity: 0.4, shadowRadius: 12, elevation: 4 },
  payBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  payBtnText: { color: C.slate, fontSize: 15, fontWeight: '800' },
  webViewHeader: { backgroundColor: C.slate, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  webViewTitle: { color: C.white, fontSize: 18, fontWeight: '700' },
});
