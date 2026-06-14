import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_PACKAGE = 'com.ssmshsoil.bizcardscanner'
const APPLE_BUNDLE   = 'com.ssmshsoil.bizcardscanner'

// 상품별 크레딧 수량
const CREDIT_MAP: Record<string, number> = {
  'com.ssmshsoil.bizcardscanner.credits_30':  30,
  'com.ssmshsoil.bizcardscanner.credits_100': 100,
  'com.ssmshsoil.bizcardscanner.credits_200': 200,
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      platform, productId, purchaseToken,
      transactionId, transactionReceipt, userId
    } = await req.json()

    if (!platform || !productId || !userId) {
      return new Response(JSON.stringify({ success: false, error: '필수 파라미터 누락' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const credits = CREDIT_MAP[productId]
    if (!credits) {
      return new Response(JSON.stringify({ success: false, error: '유효하지 않은 상품 ID' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── 중복 지급 방지 ──────────────────────────────────────
    const purchaseKey = platform === 'android' ? purchaseToken : transactionId
    const { data: existing } = await supabase
      .from('purchase_records')
      .select('id')
      .eq('purchase_key', purchaseKey)
      .single()

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: '이미 처리된 구매입니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Android Google Play 검증 ───────────────────────────
    if (platform === 'android') {
      const GOOGLE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '{}')

      // Google Access Token 발급
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: await createGoogleJWT(GOOGLE_SERVICE_ACCOUNT),
        }),
      })
      const tokenData = await tokenRes.json()
      const accessToken = tokenData.access_token

      // Google Play 구매 검증
      const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PACKAGE}/purchases/products/${productId}/tokens/${purchaseToken}`
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const verifyData = await verifyRes.json()

      if (verifyData.purchaseState !== 0) {
        return new Response(JSON.stringify({ success: false, error: 'Google 구매 검증 실패' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── iOS Apple 검증 ────────────────────────────────────
    if (platform === 'ios') {
      const APPLE_SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET') || ''

      // 프로덕션 검증 먼저 시도
      let appleRes = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'receipt-data': transactionReceipt, password: APPLE_SHARED_SECRET }),
      })
      let appleData = await appleRes.json()

      // 샌드박스 환경이면 샌드박스로 재시도
      if (appleData.status === 21007) {
        appleRes = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 'receipt-data': transactionReceipt, password: APPLE_SHARED_SECRET }),
        })
        appleData = await appleRes.json()
      }

      if (appleData.status !== 0) {
        return new Response(JSON.stringify({ success: false, error: 'Apple 구매 검증 실패: ' + appleData.status }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── 크레딧 지급 ───────────────────────────────────────
    const { data: userCredit } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single()

    const currentCredits = userCredit?.credits || 0
    const newCredits = currentCredits + credits

    await supabase.from('user_credits')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    // ── 구매 기록 저장 (중복 방지용) ─────────────────────
    await supabase.from('purchase_records').insert({
      user_id: userId,
      product_id: productId,
      platform,
      purchase_key: purchaseKey,
      credits,
      created_at: new Date().toISOString(),
    })

    return new Response(JSON.stringify({ success: true, credits }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Google JWT 생성 (서비스 계정용)
async function createGoogleJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${encode(header)}.${encode(payload)}`

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${signingInput}.${sigBase64}`
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buffer
}
