import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, SafeAreaView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { X, Zap, Check, Smartphone } from 'lucide-react-native';
import { getProducts, requestPurchase, purchaseUpdatedListener, purchaseErrorListener, finishTransaction } from 'expo-iap';
import { supabase } from '../supabase';

// ── 상품 ID (Android/iOS 공통) ─────────────────────────────
const PRODUCT_IDS = [
  'com.ssmshsoil.bizcardscanner.credits_30',
  'com.ssmshsoil.bizcardscanner.credits_100',
  'com.ssmshsoil.bizcardscanner.credits_200',
];

const PLANS_DEFAULT = [
  { id: 'com.ssmshsoil.bizcardscanner.credits_30',  qty: 30,  name: '라이트',   popular: false },
  { id: 'com.ssmshsoil.bizcardscanner.credits_100', qty: 100, name: '스탠다드', popular: true },
  { id: 'com.ssmshsoil.bizcardscanner.credits_200', qty: 200, name: '프로',     popular: false },
];

const C = {
  navy: '#0D1B2A', teal: '#00BFA5', tealTint: '#F0FBF9',
  amber: '#F59E0B', bg: '#FAFAF8', text: '#0D1B2A',
  textMuted: '#6B7785', textLabel: '#94A3B8',
  border: '#ECECE8', white: '#FFFFFF',
};

export default function CreditScreen({ user, credits, setCredits, onClose }) {
  const [selected, setSelected]   = useState(PRODUCT_IDS[1]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ── 상품 로드 ─────────────────────────────────────────────
  useEffect(() => {
    loadProducts();
    const purchaseListener = purchaseUpdatedListener(handlePurchaseUpdate);
    const errorListener    = purchaseErrorListener(handlePurchaseError);
    return () => {
      purchaseListener.remove();
      errorListener.remove();
    };
  }, []);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await getProducts({ skus: PRODUCT_IDS });
      if (result && result.length > 0) {
        setProducts(result);
      }
    } catch (e) {
      console.log('상품 로드 오류:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  // ── 구매 성공 처리 ────────────────────────────────────────
  const handlePurchaseUpdate = async (purchase) => {
    if (!purchase) return;
    setLoading(true);
    try {
      // 서버 검증 요청
      const { data, error } = await supabase.functions.invoke('verify-purchase', {
        body: {
          platform: Platform.OS,
          productId: purchase.productId,
          // Android: purchaseToken, iOS: transactionId + receipt
          purchaseToken: purchase.purchaseToken || null,
          transactionId: purchase.transactionId || null,
          transactionReceipt: purchase.transactionReceipt || null,
          userId: user.id,
        },
      });

      if (error || !data?.success) {
        throw new Error(error?.message || '구매 검증 실패');
      }

      // 거래 완료 처리 (중복 방지)
      await finishTransaction({ purchase, isConsumable: true });

      // 크레딧 업데이트
      const qty = data.credits;
      const newCredits = credits + qty;
      await supabase.from('user_credits')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      setCredits(newCredits);

      Alert.alert('충전 완료! 🎉', qty + '장이 충전되었습니다.', [
        { text: '확인', onPress: onClose }
      ]);
    } catch (e) {
      Alert.alert('오류', e.message || '구매 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseError = (error) => {
    if (error.code !== 'E_USER_CANCELLED') {
      Alert.alert('결제 오류', error.message);
    }
    setLoading(false);
  };

  // ── 구매 시작 ─────────────────────────────────────────────
  const handlePurchase = async () => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      await requestPurchase({ sku: selected });
    } catch (e) {
      if (e.code !== 'E_USER_CANCELLED') {
        Alert.alert('결제 오류', e.message);
      }
      setLoading(false);
    }
  };

  // ── 상품 정보 병합 ────────────────────────────────────────
  const getMergedPlan = (planDefault) => {
    const product = products.find(p => p.productId === planDefault.id);
    return {
      ...planDefault,
      price: product?.localizedPrice || '...',
      title: product?.title || planDefault.name,
    };
  };

  const selectedPlan = PLANS_DEFAULT.find(p => p.id === selected);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      {/* 헤더 */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>크레딧 충전</Text>
          <Text style={styles.headerSub}>유효기간 없음 · 필요할 때만</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <X size={22} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* 현재 크레딧 */}
        <View style={styles.currentBox}>
          <View style={styles.zapCircle}><Zap size={16} color={C.teal} fill={C.teal} /></View>
          <Text style={styles.currentLabel}>현재 크레딧</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.currentValue}>{credits}장</Text>
        </View>

        <Text style={styles.sectionLabel}>플랜 선택</Text>

        {/* 플랜 카드 */}
        {loadingProducts ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={C.teal} />
            <Text style={styles.loadingText}>가격 불러오는 중...</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {PLANS_DEFAULT.map(planDefault => {
              const plan = getMergedPlan(planDefault);
              const sel = plan.id === selected;
              return (
                <TouchableOpacity key={plan.id} activeOpacity={0.85}
                  onPress={() => setSelected(plan.id)}
                  style={[styles.planCard, sel && styles.planCardSel]}>
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>인기</Text>
                    </View>
                  )}
                  <View style={[styles.radio, sel && { backgroundColor: C.teal, borderColor: C.teal }]}>
                    {sel && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planQty}>{plan.qty}장</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.planPrice, sel && { color: C.teal }]}>{plan.price}</Text>
                    <Text style={styles.planPlatform}>
                      {Platform.OS === 'android' ? 'Google Play' : 'App Store'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 안내 박스 */}
        <View style={styles.infoBox}>
          {[
            '크레딧 유효기간 없음 (영구 사용)',
            '월 구독 없음 — 필요할 때만 충전',
            '미사용 크레딧 7일 이내 전액 환불',
            '1장이라도 사용 시 환불 불가',
          ].map(t => (
            <View key={t} style={styles.infoRow}>
              <View style={styles.checkCircle}><Check size={11} color="#FFFFFF" strokeWidth={3} /></View>
              <Text style={styles.infoText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* 결제 버튼 */}
        <TouchableOpacity activeOpacity={0.9}
          style={[styles.payBtn, (loading || loadingProducts) && { opacity: 0.6 }]}
          onPress={handlePurchase}
          disabled={loading || loadingProducts}>
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Smartphone size={20} color="#FFFFFF" strokeWidth={2.2} />}
          <Text style={styles.payBtnText}>
            {loading ? '처리 중...' :
              Platform.OS === 'android'
                ? `Google Play로 ${selectedPlan?.qty}장 충전`
                : `App Store로 ${selectedPlan?.qty}장 충전`}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hintText}>
          {Platform.OS === 'android'
            ? '🤖 Google Play 결제 · 국가별 통화 자동 적용'
            : '🍎 App Store 결제 · 국가별 통화 자동 적용'}
        </Text>

        {/* 환불 안내 */}
        <TouchableOpacity style={styles.refundBtn} onPress={() =>
          Alert.alert('환불 정책',
            '미사용 크레딧에 한해 구매일로부터 7일 이내 전액 환불 가능합니다.\n1장이라도 사용한 경우 환불이 불가합니다.\n\n환불 문의: ssmkra@gmail.com')}>
          <Text style={styles.refundText}>환불 정책 보기</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  header: { backgroundColor: C.navy, paddingHorizontal: 22, paddingTop: 48, paddingBottom: 26, flexDirection: 'row', alignItems: 'flex-start' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 4 },
  closeBtn: { padding: 6, marginTop: 2 },
  body: { flex: 1, backgroundColor: C.bg },
  currentBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.tealTint, borderWidth: 1, borderColor: 'rgba(0,191,165,0.25)', borderRadius: 14, padding: 16, marginBottom: 22 },
  zapCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,191,165,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  currentLabel: { fontSize: 14, color: C.text, fontWeight: '600' },
  currentValue: { fontSize: 18, color: C.teal, fontWeight: '800' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 12, letterSpacing: -0.2 },
  loadingBox: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: C.textMuted, fontSize: 14 },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 18, borderWidth: 1, borderColor: C.border, shadowColor: '#A89F88', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1, position: 'relative' },
  planCardSel: { borderWidth: 2, borderColor: C.teal, backgroundColor: C.tealTint },
  popularBadge: { position: 'absolute', top: -8, right: 16, backgroundColor: C.amber, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  popularText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D6D9DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  planName: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  planQty: { fontSize: 12, color: C.textMuted, marginTop: 3, fontWeight: '500' },
  planPrice: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  planPlatform: { fontSize: 10, color: C.textLabel, marginTop: 3, fontWeight: '500' },
  infoBox: { backgroundColor: C.tealTint, borderRadius: 14, padding: 16, marginTop: 22, borderWidth: 1, borderColor: 'rgba(0,191,165,0.18)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  infoText: { fontSize: 13, color: C.text, fontWeight: '500', flex: 1 },
  payBtn: { marginTop: 22, height: 58, borderRadius: 16, backgroundColor: C.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: C.teal, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 5 },
  payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginLeft: 10, letterSpacing: -0.2 },
  hintText: { fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 12, fontWeight: '500' },
  refundBtn: { marginTop: 16, alignItems: 'center', padding: 8 },
  refundText: { fontSize: 12, color: C.textLabel, textDecorationLine: 'underline' },
});
