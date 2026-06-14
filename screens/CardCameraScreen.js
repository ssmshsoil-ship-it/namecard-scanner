import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, RotateCcw, Zap } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SW, height: SH } = Dimensions.get('window');

// 프레임: 화면 가로 95% 사용 → 가깝게 찍어도 명함이 들어감
const FRAME_W  = SW * 0.98;
const FRAME_H  = FRAME_W / 1.75;
const FRAME_X  = (SW - FRAME_W) / 2;
const FRAME_Y  = (SH - FRAME_H) / 2;

export default function CardCameraScreen({ onCapture, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing]       = useState('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        base64: false,
        skipProcessing: false,
      });

      const PW = photo.width;
      const PH = photo.height;

      // 카메라 뷰 = cover 방식
      // 화면비율 vs 사진비율 비교해서 실제 보이는 영역 계산
      const screenAR = SW / SH;
      const photoAR  = PW / PH;

      let renderedW, renderedH, offX, offY;

      if (photoAR > screenAR) {
        // 사진이 더 가로로 넓음 → 좌우 잘림
        renderedH = PH;
        renderedW = PH * screenAR;
        offX = (PW - renderedW) / 2;
        offY = 0;
      } else {
        // 사진이 더 세로로 높음 → 상하 잘림
        renderedW = PW;
        renderedH = PW / screenAR;
        offX = 0;
        offY = (PH - renderedH) / 2;
      }

      // 화면 px → 실제 사진 px 변환
      const scaleX = renderedW / SW;
      const scaleY = renderedH / SH;

      const cx = Math.round(offX + FRAME_X * scaleX);
      const cy = Math.round(offY + FRAME_Y * scaleY);
      const cw = Math.round(FRAME_W * scaleX);
      const ch = Math.round(FRAME_H * scaleY);

      // 경계 보정
      const sx = Math.max(0, cx);
      const sy = Math.max(0, cy);
      const sw = Math.min(cw, PW - sx);
      const sh = Math.min(ch, PH - sy);

      const cropped = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: sx, originY: sy, width: sw, height: sh } }],
        { compress: 0.93, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      onCapture({ uri: cropped.uri, base64: cropped.base64, mimeType: 'image/jpeg' });
    } catch (e) {
      Alert.alert('오류', '촬영 실패: ' + e.message);
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator color="#06B6D4" size="large" /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>권한 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="picture"
        zoom={0.012}
      />

      {/* 프레임 밖 어두운 오버레이 */}
      <View style={[styles.ov, { top: 0,              left: 0, right: 0, height: FRAME_Y }]} />
      <View style={[styles.ov, { top: FRAME_Y+FRAME_H, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.ov, { top: FRAME_Y, left: 0,          width: FRAME_X,          height: FRAME_H }]} />
      <View style={[styles.ov, { top: FRAME_Y, left: FRAME_X+FRAME_W, right: 0, height: FRAME_H }]} />

      {/* 명함 프레임 */}
      <View style={[styles.frame, { top: FRAME_Y, left: FRAME_X, width: FRAME_W, height: FRAME_H }]}>
        <View style={[styles.corner, styles.cTL]} />
        <View style={[styles.corner, styles.cTR]} />
        <View style={[styles.corner, styles.cBL]} />
        <View style={[styles.corner, styles.cBR]} />
        {/* 프레임 안 얇은 테두리 */}
        <View style={styles.frameBorder} />
      </View>

      {/* 프레임 위 안내 */}
      <View style={[styles.hintWrap, { top: FRAME_Y - 54 }]}>
        <Text style={styles.hintMain}>명함을 프레임에 꽉 맞춰주세요</Text>
        <Text style={styles.hintSub}>가까이 · 평평하게 · 밝은 곳에서</Text>
      </View>

      {/* 프레임 아래 안내 */}
      <View style={[styles.hintWrap, { top: FRAME_Y + FRAME_H + 12 }]}>
        <Text style={styles.hintSub}>프레임 영역만 잘라서 AI 분석합니다</Text>
      </View>

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>명함 촬영</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
          <RotateCcw size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 하단 셔터 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.shutterOuter, capturing && { opacity: 0.5 }]}
          onPress={capture}
          disabled={capturing}
          activeOpacity={0.75}
        >
          {capturing
            ? <ActivityIndicator color="#06B6D4" size="small" />
            : <View style={styles.shutterInner} />
          }
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Zap size={12} color="#06B6D4" />
          <Text style={styles.shutterHintText}>탭하여 촬영</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center:    { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', gap: 16 },
  permText:  { color: '#fff', fontSize: 16, fontWeight: '600' },
  permBtn:   { backgroundColor: '#06B6D4', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#0F172A', fontWeight: '700' },

  ov: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.68)' },

  frame:  { position: 'absolute' },
  frameBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1, borderColor: 'rgba(6,182,212,0.25)', borderRadius: 4,
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#06B6D4' },
  cTL: { top: -1,  left: -1,  borderTopWidth: 3,    borderLeftWidth: 3,   borderTopLeftRadius: 7 },
  cTR: { top: -1,  right: -1, borderTopWidth: 3,    borderRightWidth: 3,  borderTopRightRadius: 7 },
  cBL: { bottom: -1, left: -1,  borderBottomWidth: 3, borderLeftWidth: 3,   borderBottomLeftRadius: 7 },
  cBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3,  borderBottomRightRadius: 7 },

  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 4 },
  hintMain: { color: '#fff', fontSize: 15, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 8 },
  hintSub:  { color: 'rgba(255,255,255,0.55)', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 6 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iconBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, paddingTop: 20,
    alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shutterOuter: {
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner:    { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  shutterHintText: { color: '#06B6D4', fontSize: 12, fontWeight: '500' },
});
