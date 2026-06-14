// ============================================================
//  CardScan AI — Design Tokens (theme.js)
//  모든 화면에서 이 파일 import해서 사용
//  import { C, FONT, RADIUS, SHADOW, SPACING } from '../theme';
// ============================================================

// ── 색상 ────────────────────────────────────────────────────
export const C = {
  // 메인 배경
  navy:       '#0D1B2A',   // 헤더, 다크 카드 배경
  navySoft:   '#1A2B3C',   // 발신자 카드, 서브 배경
  navyMid:    '#243447',   // 구분선, 보더

  // 포인트 컬러
  teal:       '#00BFA5',   // 주요 버튼, 아이콘, 뱃지
  tealSoft:   '#E6F9F6',   // 틸 배경 (연하게)
  tealTint:   '#F0FBF9',   // 선택된 플랜 배경
  tealBorder: 'rgba(0,191,165,0.3)',  // 틸 테두리

  // 앰버 (강조)
  amber:      '#F59E0B',   // 인기 뱃지
  amberSoft:  '#FEF3C7',   // 앰버 배경

  // 앱 배경 & 카드
  bg:         '#FAFAF8',   // 전체 배경 (밝은 오프화이트)
  card:       '#FFFFFF',   // 카드 배경
  surface2:   '#F1F5F9',   // 입력창, 보조 배경

  // 텍스트
  text:       '#0D1B2A',   // 기본 텍스트
  textMuted:  '#6B7785',   // 보조 텍스트
  textLabel:  '#94A3B8',   // 레이블, 플레이스홀더
  textWhite:  '#FFFFFF',   // 다크 배경 위 텍스트

  // 보더 & 구분선
  border:     '#ECECE8',   // 카드 테두리
  separator:  '#F1F1ED',   // 행 구분선

  // 상태
  green:      '#10B981',   // 성공, 저장 버튼
  greenSoft:  '#ECFDF5',   // 성공 배경
  red:        '#EF4444',   // 에러, 탈퇴
  redSoft:    '#FEF2F2',   // 에러 배경
  warning:    '#F59E0B',   // 경고
};

// ── 폰트 사이즈 ──────────────────────────────────────────────
export const FONT = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 15,
  lg:   17,
  xl:   20,
  xxl:  24,
  h2:   28,
  h1:   32,
};

// ── 폰트 굵기 ────────────────────────────────────────────────
export const WEIGHT = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  extrabold:'800',
  black:    '900',
};

// ── 라운드 ───────────────────────────────────────────────────
export const RADIUS = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  pill: 999,
};

// ── 간격 ─────────────────────────────────────────────────────
export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
};

// ── 그림자 ───────────────────────────────────────────────────
export const SHADOW = {
  card: {
    shadowColor: '#A89F88',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  teal: {
    shadowColor: '#00BFA5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  navy: {
    shadowColor: '#0D1B2A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  green: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
};

// ── 공통 스타일 컴포넌트 ─────────────────────────────────────
import { StyleSheet } from 'react-native';

export const COMMON = StyleSheet.create({
  // 카드
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: C.border,
    ...SHADOW.card,
  },
  // 헤더
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: SPACING.xxl,
    paddingTop: 48,
    paddingBottom: SPACING.xxxl,
  },
  headerTitle: {
    color: C.textWhite,
    fontSize: FONT.xxl,
    fontWeight: WEIGHT.extrabold,
    letterSpacing: -0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: FONT.sm,
    marginTop: 4,
  },
  // 섹션 레이블
  sectionLabel: {
    fontSize: FONT.xs,
    fontWeight: WEIGHT.bold,
    color: C.textLabel,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
  },
  // 틸 버튼
  btnTeal: {
    backgroundColor: C.teal,
    borderRadius: RADIUS.lg,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.teal,
  },
  btnTealText: {
    color: C.textWhite,
    fontSize: FONT.base,
    fontWeight: WEIGHT.extrabold,
    marginLeft: SPACING.sm,
    letterSpacing: -0.2,
  },
  // 네이비 아웃라인 버튼
  btnNavy: {
    backgroundColor: C.navy,
    borderRadius: RADIUS.lg,
    height: 56,
    borderWidth: 1.5,
    borderColor: C.teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnNavyText: {
    color: C.textWhite,
    fontSize: FONT.base,
    fontWeight: WEIGHT.extrabold,
    marginLeft: SPACING.sm,
  },
  // 구분선
  separator: {
    height: 1,
    backgroundColor: C.separator,
  },
  // 아이콘 박스 (틸)
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,191,165,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── 앱 정보 ──────────────────────────────────────────────────
export const APP = {
  name:    'CardScan AI',
  nameKo:  '명함스캔',
  nameJp:  '名刺スキャナー',
  version: '1.0.0',
  email:   'ssmkra@gmail.com',
  privacyUrl: 'https://ssmshsoil-ship-it.github.io/namecard-scanner/privacy.html',
  termsUrl:   'https://ssmshsoil-ship-it.github.io/namecard-scanner/terms.html',
};
