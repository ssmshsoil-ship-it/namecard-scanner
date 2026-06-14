import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { X, Zap, Check, Globe } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../supabase';

const TOSS_CLIENT_KEY = process.env.EXPO_PUBLIC_TOSS_CLIENT_KEY;

const C = {
  navy: '#0D1B2A',
  teal: '#00BFA5',
  tealTint: '#F0FBF9',
  amber: '#F59E0B',
  bg: '#FAFAF8',
  text: '#0D1B2A',
  textMuted: '#6B7785',
  textLabel: '#94A3B8',
  border: '#ECECE8',
  white: '#FFFFFF',
};

const PLANS = [
  { id: 'lite',     name: '라이트',   qty: 30,  price: 1500, priceUsd: 0.99 },
  { id: 'standard', name: '스탠다드', qty: 100, price: 2900, priceUsd: 1.99, popular: true },
  { id: 'pro',      name: '프로',     qty: 200, price: 4500, priceUsd: 2.99 },
];

export default function CreditScreen({ user, credits, setCredits, onClose }) {
  const [selected, setSelected]           = useState('standard');
  const [loading, setLoading]             = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [showWebView, setShowWebView]     = useState(false);
  const [paymentUrl, setPaymentUrl]       = useState('');

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const plan = PLANS.find(p => p.id === selected);

  const addCredits = async (amount) => {
    const newCredits = credits + amount;
    await supabase.from('user_credits').update({ credits: newCredits, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    setCredits(newCredits);
  };

  const handleToss = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const orderId   = 'order_' + user.id.slice(0, 8) + '_' + Date.now();
      const orderName = '명함스캔 ' + plan.name + ' ' + plan.qty + '장';
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://js.tosspayments.com/v1/payment"></script></head><body><script>
        TossPayments('${TOSS_CLIENT_KEY}').requestPayment('카드',{
          amount:${plan.price},orderId:'${orderId}',orderName:'${orderName}',customerName:'${user.email}',
          successUrl:'https://ssmshsoil-ship-it.github.io/namecard-scanner/payment-success.html?credits=${plan.qty}&userId=${user.id}',
          failUrl:'https://ssmshsoil-ship-it.github.io/namecard-scanner/payment-fail.html',
        }).catch(e=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.message})));
      </script></body></html>`;
      setPaymentUrl('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      setShowWebView(true);
    } catch (e) { Alert.alert('오류', e.message); }
    finally { setLoading(false); }
  };

  const handleStripe = async () => {
    if (!plan) return;
    setStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { amount: Math.round(plan.priceUsd * 100), currency: 'usd', userId: user.id, credits: plan.qty, planName: plan.name },
      });
      if (error || !data?.clientSecret) throw new Error(error?.message || '결제 초기화 실패');
      const { error: initError } = await initPaymentSheet({ paymentIntentClientSecret: data.clientSecret, merchantDisplayName: '명함스캔', defaultBillingDetails: { email: user.email }, style: 'automatic' });
      if (initError) throw new Error(initError.message);
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) { if (presentError.code !== 'Canceled') Alert.alert('결제 실패', presentError.message); return; }
      await addCredits(plan.qty);
      Alert.alert('충전 완료! 🎉', plan.qty + '장이 충전되었습니다.');
      onClose();
    } catch (e) { Alert.alert('오류', e.message); }
    finally { setStripeLoading(false); }
  };

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success') { await addCredits(plan.qty); setShowWebView(false); Alert.alert('충전 완료! 🎉', plan.qty + '장이 충전되었습니다.'); onClose(); }
      else if (data.type === 'error') { setShowWebView(false); Alert.alert('결제 실패', data.message); }
    } catch (e) {}
  };

  const handleNavChange = async (navState) => {
    if (navState.url.includes('payment-success')) {
      const u = new URL(navState.url);
      const amt = parseInt(u.searchParams.get('credits') || '0');
      if (amt > 0) { await addCredits(amt); setShowWebView(false); Alert.alert('충전 완료! 🎉', amt + '장이 충전되었습니다.'); onClose(); }
    } else if (navState.url.includes('payment-fail')) { setShowWebView(false); Alert.alert('결제 실패', '결제가 취소되었거나 실패했습니다.'); }
  };

  if (showWebView) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
        <View style={{ backgroundColor: C.navy, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.white, fontSize: 18, fontWeight: '700' }}>결제</Text>
          <TouchableOpacity onPress={() => setShowWebView(false)}><X size={22} color={C.white} /></TouchableOpacity>
        </View>
        <WebView source={{ uri: paymentUrl }} onMessage={handleWebViewMessage} onNavigationStateChange={handleNavChange} javaScriptEnabled domStorageEnabled />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>크레딧 충전</Text>
          <Text style={styles.headerSub}>유효기간 없음 · 필요할 때만</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <X size={22} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.currentBox}>
          <View style={styles.zapCircle}><Zap size={16} color={C.teal} fill={C.teal} /></View>
          <Text style={styles.currentLabel}>현재 크레딧</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.currentValue}>{credits}장</Text>
        </View>

        <Text style={styles.sectionLabel}>플랜 선택</Text>

        <View style={{ gap: 10 }}>
          {PLANS.map(p => {
            const sel = p.id === selected;
            return (
              <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => setSelected(p.id)}
                style={[styles.planCard, sel && styles.planCardSel]}>
                {p.popular && (
                  <View style={styles.popularBadge}><Text style={styles.popularText}>인기</Text></View>
                )}
                <View style={[styles.radio, sel && { backgroundColor: C.teal, borderColor: C.teal }]}>
                  {sel && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planQty}>{p.qty}장</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.planPrice, sel && { color: C.teal }]}>{p.price.toLocaleString()}원</Text>
                  <Text style={styles.planPerCard}>{Math.round(p.price / p.qty)}원/장</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoBox}>
          {['크레딧 유효기간 없음 (영구 사용)', '월 구독 없음 — 필요할 때만 충전', '미사용 크레딧 7일 이내 환불 가능'].map(t => (
            <View key={t} style={styles.infoRow}>
              <View style={styles.checkCircle}><Check size={11} color="#FFFFFF" strokeWidth={3} /></View>
              <Text style={styles.infoText}>{t}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.9} style={[styles.payKr, loading && { opacity: 0.6 }]}
          onPress={handleToss} disabled={loading || stripeLoading}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Zap size={18} color="#FFFFFF" fill="#FFFFFF" />}
          <Text style={styles.payKrText}>{plan?.price.toLocaleString()}원으로 {plan?.qty}장 충전 (한국)</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} style={[styles.payGlobal, stripeLoading && { opacity: 0.6 }]}
          onPress={handleStripe} disabled={loading || stripeLoading}>
          {stripeLoading ? <ActivityIndicator color={C.navy} size="small" /> : <Globe size={18} color={C.navy} strokeWidth={2.2} />}
          <Text style={styles.payGlobalText}>${plan?.priceUsd} · {plan?.qty}장 충전 (Global)</Text>
        </TouchableOpacity>

        <Text style={styles.hintText}>🇰🇷 한국 카드 → 위 버튼  ·  🌐 해외 카드 → 아래 버튼</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  header: { backgroundColor: C.navy, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 26, flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },
  closeBtn: { padding: 6, marginTop: 2 },
  body: { flex: 1, backgroundColor: C.bg },
  currentBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.tealTint, borderWidth: 1, borderColor: 'rgba(0,191,165,0.25)', borderRadius: 14, padding: 16, marginBottom: 22 },
  zapCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,191,165,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  currentLabel: { fontSize: 14, color: C.text, fontWeight: '600' },
  currentValue: { fontSize: 18, color: C.teal, fontWeight: '800' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 12, letterSpacing: -0.2 },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 18, borderWidth: 1, borderColor: C.border, shadowColor: '#A89F88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1, position: 'relative' },
  planCardSel: { borderWidth: 2, borderColor: C.teal, backgroundColor: C.tealTint },
  popularBadge: { position: 'absolute', top: -8, right: 16, backgroundColor: C.amber, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 2 },
  popularText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D9DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  planName: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  planQty: { fontSize: 12, color: C.textMuted, marginTop: 3, fontWeight: '500' },
  planPrice: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  planPerCard: { fontSize: 11, color: C.textLabel, marginTop: 3, fontWeight: '500' },
  infoBox: { backgroundColor: C.tealTint, borderRadius: 14, padding: 16, marginTop: 22, borderWidth: 1, borderColor: 'rgba(0,191,165,0.18)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  infoText: { fontSize: 13, color: C.text, fontWeight: '500', flex: 1 },
  payKr: { marginTop: 22, height: 56, borderRadius: 16, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: C.teal, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  payKrText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 8, letterSpacing: -0.2 },
  payGlobal: { marginTop: 10, height: 54, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  payGlobalText: { color: C.navy, fontSize: 15, fontWeight: '700', marginLeft: 8, letterSpacing: -0.2 },
  hintText: { fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 14, fontWeight: '500' },
});
