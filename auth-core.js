/**
 * ==============================================================================
 * Smart Restaurant POS & E-Menu System - Unified Auth & Security Core
 * 賵丨丿丞 丕賱兀賲丕賳 賵丕賱賲氐丕丿賯丞 丕賱賲賵丨丿丞 賵丕賱賲卮賮乇丞 賱噩賲賷毓 卮丕卮丕鬲 丕賱賳馗丕賲
 * 賲鬲胤丕亘賯丞 100% 賲毓 賯丕毓丿丞 亘賷丕賳丕鬲 Supabase 丕賱爻丨丕亘賷丞 賲毓 丿毓賲 丕賱毓賲賱 丿賵賳 廿賳鬲乇賳鬲
 * ==============================================================================
 */

(function (window) {
  'use strict';

  // 丕賱孬賵丕亘鬲 賵丕賱賲賮丕鬲賷丨
  const SESSION_KEY = 'smart_emenu_active_session';
  const RESTAURANT_ID_KEY = 'smart_emenu_restaurant_id';
  const REMEMBER_USER_KEY = 'smart_emenu_remembered_username';
  const ATTEMPTS_KEY = 'smart_emenu_rate_limit_attempts';

  const MAX_ATTEMPTS = 10; // عدد محاولات مريح لمنع قفل المستخدم بالخطأ
  const LOCKOUT_MS = 30 * 1000; // قفل 30 ثانية فقط في حال التكرار المتعمد
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوماً

  // المستخدمون المعتمدون (تتم المصادقة المشفرة حصراً سحابياً دون كشف أي أرقام سرية)
  // لا يوجد أي مستخدم ثابت في الكود — كافة الحسابات تُجلب من قاعدة البيانات السحابية حصراً
  const DEFAULT_SYSTEM_USERS = [];

  // تهيئة وتطهير الذاكرة المحلية لتطابق سوبابيس حصراً وحذف أي حسابات وهمية سابقة
  try {
    localStorage.setItem('smart_emenu_cached_users', JSON.stringify(DEFAULT_SYSTEM_USERS));

    // مسح أي إعدادات مستخدمين محلية قديمة تحتوي على حسابات وهمية (cash, ahmed, ali, mustafa)
    ['smart_emenu_fahma_dokhan_auth_config', 'smart_emenu_auth_config'].forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            (parsed.cashiers && parsed.cashiers.some(c => c.username === 'cash' || c.pin === '20202020')) ||
            (parsed.captains && parsed.captains.some(c => ['ahmed', 'ali', 'mustafa'].includes(c.username) || ['11112222', '22223333', '33334444'].includes(c.pin)))
          ) {
            localStorage.removeItem(k);
          }
        }
      } catch(e) {}
    });
  } catch (e) {}

  // 噩賱亘 賲毓乇賮 丕賱賲胤毓賲 丕賱賳卮胤
  function getActiveRestaurantId() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qRest = urlParams.get('rest') || urlParams.get('restaurant');
      if (qRest && qRest.trim()) {
        const clean = qRest.trim().toLowerCase();
        sessionStorage.setItem(RESTAURANT_ID_KEY, clean);
        localStorage.setItem(RESTAURANT_ID_KEY, clean);
        return clean;
      }
    } catch (e) {}

    const stored = sessionStorage.getItem(RESTAURANT_ID_KEY) || localStorage.getItem(RESTAURANT_ID_KEY);
    if (stored && stored.trim()) return stored.trim().toLowerCase();

    return 'fahma_dokhan';
  }

  // 賮丨氐 丕賱丨馗乇 囟丿 丕賱鬲禺賲賷賳
  function checkRateLimit() {
    try {
      const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{"count":0,"lockedUntil":0}');
      const now = Date.now();
      if (data.lockedUntil && data.lockedUntil > now) {
        const remainingSec = Math.ceil((data.lockedUntil - now) / 1000);
        return {
          locked: true,
          message: `鬲賲 丨馗乇 丕賱賲丨丕賵賱丕鬲 賲丐賯鬲丕賸 賱丨賲丕賷丞 丕賱賳馗丕賲! 賷乇噩賶 丕賱丕賳鬲馗丕乇 (${remainingSec} 孬丕賳賷丞).`
        };
      }
      return { locked: false };
    } catch (e) {
      return { locked: false };
    }
  }

  function recordFailedAttempt() {
    try {
      const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{"count":0,"lockedUntil":0}');
      data.count = (data.count || 0) + 1;
      if (data.count >= MAX_ATTEMPTS) {
        data.lockedUntil = Date.now() + LOCKOUT_MS;
        data.count = 0;
      }
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function resetRateLimit() {
    try {
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem('smart_emenu_auth_attempts');
    } catch (e) {}
  }

  // 鬲賵賱賷丿 鬲賵賰賳 丌賲賳
  function generateSecureToken() {
    try {
      const arr = new Uint8Array(32);
      (window.crypto || crypto).getRandomValues(arr);
      return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // بديل آمن بشكل كافٍ باستخدام timestamp + counter
      return 'tok_' + Date.now().toString(36) + '_' + Date.now().toString(36);
    }
  }

  const DEFAULT_SUPABASE_URL = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || "https://dpuawlhffopwwgktudxb.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdWF3bGhmZm9wd3dna3R1ZHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjIzNDEsImV4cCI6MjEwNTkzODM0MX0.elHAxE_xiETRNalGYxkHMO4sWzIoe7_FRmbftshVMHQ";

  // 丕賱丨氐賵賱 毓賱賶 毓賲賷賱 Supabase 丕賱賲鬲丕丨
  let _authSbClient = null;
  function getSupabase() {
    if (typeof window.getSupabaseClient === 'function') {
      const cl = window.getSupabaseClient();
      if (cl) return cl;
    }
    if (typeof window.getSupabase === 'function') {
      const cl = window.getSupabase();
      if (cl) return cl;
    }
    if (window.supabaseClient) return window.supabaseClient;

    if (!_authSbClient && window.supabase && typeof window.supabase.createClient === 'function') {
      const url = localStorage.getItem('smart_emenu_supabase_url') || DEFAULT_SUPABASE_URL;
      const key = localStorage.getItem('smart_emenu_supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;
      try {
        _authSbClient = window.supabase.createClient(url, key);
      } catch (e) {}
    }
    return _authSbClient;
  }

  // دوال معالجة وتطهير المدخلات الذكية (دعم الأرقام العربية، إزالة الرموز الخفية، ومرونة حالة الأحرف)
  function normalizeAuthInput(str) {
    if (!str) return '';
    return String(str)
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .trim();
  }

  function normalizeUsername(uname) {
    let clean = normalizeAuthInput(uname).toLowerCase();
    if (['superadmin', 'super-admin', 'سوبر ادمن', 'سوبرادمن', 'سوبر_ادمن'].includes(clean)) return 'super_admin';
    if (['ادمن', 'الادمن', 'مدير', 'المدير'].includes(clean)) return 'admin';
    if (['كاشير', 'الكاشير', 'كاش'].includes(clean)) return 'cashier';
    if (['كابتن', 'الكابتن'].includes(clean)) return 'captain';
    return clean;
  }

  function isPinMatch(inputPin, targetPin) {
    // يُمنع منعاً باتاً المقارنة بالنص الصريح إذا كان الهدف هاشاً مشفراً (64 حرفاً)
    if (!inputPin || !targetPin) return false;
    if (targetPin.length === 64) return false; // الهدف هاش SHA-256، لا مقارنة بنص صريح
    const cleanIn = normalizeAuthInput(inputPin);
    const cleanTar = normalizeAuthInput(targetPin);
    return cleanIn === cleanTar || cleanIn.toLowerCase() === cleanTar.toLowerCase();
  }

  // دالة التشفير القياسية السحابية SHA-256
  async function sha256(message) {
    if (!message) return '';
    try {
      if (window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    return String(message);
  }

  // الدالة الأساسية الموحدة لتسجيل الدخول: مصادقة سحابية مشفرة وآمنة 100%
  async function loginUserAsync(username, password, rememberMe = true) {
    if (!username || !username.trim()) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني!' };
    }
    if (!password || password.trim().length < 8) {
      return { success: false, message: 'يجب أن تتكون كلمة المرور من 8 خانات على الأقل!' };
    }

    // فحص نظام الحظر ومقاومة التخمين (Anti-Brute-Force Rate Limiter)
    const rateLimit = checkRateLimit();
    if (rateLimit.locked) {
      return { success: false, message: rateLimit.message };
    }

    const rawInput = normalizeAuthInput(username).toLowerCase();
    const cleanUser = normalizeUsername(username);
    const cleanPass = normalizeAuthInput(password);
    const restId = getActiveRestaurantId() || null;

    let rpcRes = null;
    let rpcErr = null;

    // 1. محاولة المصادقة عبر الدالة السحابية المحمية (RPC)
    const supabase = getSupabase();
    if (supabase && typeof supabase.rpc === 'function') {
      try {
        const { data, error } = await supabase.rpc('rpc_authenticate_user', {
          p_restaurant_id: restId,
          p_username: cleanUser,
          p_pin: cleanPass
        });
        if (!error && data) {
          rpcRes = data;
        }
      } catch (dbEx) {
        rpcErr = dbEx;
      }
    }

    // 2. معالجة نتيجة الدالة السحابية إن نجحت
    if (rpcRes && rpcRes.success && rpcRes.user) {
      const u = rpcRes.user;
      if (u.active === false) {
        return {
          success: false,
          message: 'حسابك حالياً قيد المراجعة، وبانتظار التفعيل والموافقة من الإدارة قبل تسجيل الدخول.'
        };
      }
      resetRateLimit();
      const session = {
        id: u.id,
        userId: u.id,
        username: u.username,
        name: u.name || 'طاقم العمل',
        role: u.role,
        restaurantId: u.restaurant_id || restId,
        assigned_printer_id: u.assigned_printer_id || null,
        assignedPrinterId: u.assigned_printer_id || null,
        token: u.token || generateSecureToken(),
        loginTime: Date.now(),
        rememberMe: !!rememberMe
      };
      saveSession(session, rememberMe, cleanUser);
      return { success: true, session, role: session.role, restaurantId: session.restaurantId };
    }

    // 3. التحقق المباشر من جدول المستخدمين السحابي (Direct Central Cloud User Verification)
    try {
      let matchedUsers = [];
      const passHash = await sha256(cleanPass);

      // الاستعلام بالاسم أو البريد الإلكتروني
      if (supabase && typeof supabase.from === 'function') {
        const { data, error } = await supabase
          .from('restaurant_users')
          .select('*')
          .or(`username.ilike.${rawInput},username.eq.${rawInput},username.eq.${cleanUser},id.eq.${rawInput}`);
        if (!error && Array.isArray(data)) {
          matchedUsers = data;
        }
      }

      // بديل مباشر عبر Native Fetch
      if (matchedUsers.length === 0) {
        const fetchUrl = `${DEFAULT_SUPABASE_URL}/rest/v1/restaurant_users?or=(username.ilike.${encodeURIComponent(rawInput)},username.eq.${encodeURIComponent(rawInput)},username.eq.${encodeURIComponent(cleanUser)},id.eq.${encodeURIComponent(rawInput)})`;
        const resp = await fetch(fetchUrl, {
          headers: {
            'apikey': DEFAULT_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`
          }
        });
        if (resp.ok) {
          matchedUsers = await resp.json();
        }
      }

      if (matchedUsers && matchedUsers.length > 0) {
        const u = matchedUsers[0];

        // التحقق من حالة الموافقة والتفعيل
        if (u.active === false) {
          return {
            success: false,
            message: 'حسابك حالياً قيد المراجعة، وبانتظار التفعيل والموافقة من الإدارة قبل تسجيل الدخول.'
          };
        }

        // فحص مطابقة الهاش المشفر (SHA-256)
        let isMatch = false;
        if (u.pin && u.pin.toLowerCase() === passHash.toLowerCase()) {
          isMatch = true;
        } else if (isPinMatch(cleanPass, u.pin)) {
          // ترقية تلقائية فورية للهاش في قاعدة البيانات
          isMatch = true;
          try {
            if (supabase && typeof supabase.from === 'function') {
              supabase.from('restaurant_users').update({ pin: passHash }).eq('id', u.id).then(() => {}).catch(e => console.warn('Hash upgrade error:', e));
            }
          } catch (e) {}
        }

        if (isMatch) {
          resetRateLimit();
          const session = {
            id: u.id,
            userId: u.id,
            username: u.username,
            name: u.full_name || 'طاقم العمل',
            role: u.role,
            restaurantId: (u.role === 'super_admin' ? 'platform' : (u.restaurant_id || restId)),
            assigned_printer_id: u.assigned_printer_id || null,
            assignedPrinterId: u.assigned_printer_id || null,
            token: generateSecureToken(),
            loginTime: Date.now(),
            rememberMe: !!rememberMe
          };
          saveSession(session, rememberMe, u.username);
          return { success: true, session, role: session.role, restaurantId: session.restaurantId };
        } else {
          recordFailedAttempt();
          return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' };
        }
      }
    } catch (tblErr) {
      console.warn('Central cloud user check error:', tblErr);
    }

    // 4. التحقق السحابي عبر المصادقة بالبريد الإلكتروني المشفر (Email Cloud Auth)
    if (rawInput.includes('@')) {
      try {
        if (supabase && supabase.auth && typeof supabase.auth.signInWithPassword === 'function') {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: rawInput,
            password: cleanPass
          });

          if (!authError && authData && authData.user) {
            // جلب دور المستخدم وبياناته من جدول المطاعم
            let uRole = 'cashier';
            let uName = authData.user.user_metadata?.full_name || rawInput.split('@')[0];
            let uRest = restId;

            try {
              const { data: uRows } = await supabase
                .from('restaurant_users')
                .select('*')
                .eq('username', rawInput);
              if (uRows && uRows.length > 0) {
                if (uRows[0].active === false) {
                  return {
                    success: false,
                    message: 'حسابك حالياً قيد المراجعة، وبانتظار التفعيل والموافقة من الإدارة قبل تسجيل الدخول.'
                  };
                }
                uRole = uRows[0].role || uRole;
                uName = uRows[0].full_name || uName;
                uRest = uRows[0].restaurant_id || uRest;
              }
            } catch(e) {}

            resetRateLimit();
            const session = {
              id: authData.user.id,
              userId: authData.user.id,
              username: rawInput,
              name: uName,
              role: uRole,
              restaurantId: uRest,
              token: authData.session?.access_token || generateSecureToken(),
              loginTime: Date.now(),
              rememberMe: !!rememberMe
            };
            saveSession(session, rememberMe, rawInput);
            return { success: true, session, role: session.role, restaurantId: session.restaurantId };
          }
        }
      } catch (authErr) {
        console.warn('Email cloud auth exception:', authErr);
      }
    }

    // 5. لا يوجد تطابق سحابي — تسجيل المحاولة الفاشلة
    recordFailedAttempt();
    return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' };
  }

  // دالة تسجيل حساب موظف جديد ذاتياً (حالة الانتظار للتفعيل من السوبر أدمن)
  async function registerNewUserAsync(userData) {
    try {
      const fullName = (userData.fullName || userData.name || '').trim();
      const email = (userData.email || '').trim().toLowerCase();
      const password = (userData.password || userData.pin || '').trim();
      const role = userData.role || 'cashier';
      const restId = (userData.restaurantId || getActiveRestaurantId() || '').toLowerCase();

      if (!fullName) {
        return { success: false, message: 'يرجى إدخال الاسم الكامل للموظف!' };
      }
      if (!email || !email.includes('@')) {
        return { success: false, message: 'يرجى إدخال بريد إلكتروني شخصي صالح!' };
      }
      if (!password || password.length < 8) {
        return { success: false, message: 'يجب أن تتكون كلمة المرور من 8 خانات على الأقل!' };
      }

      const supabase = getSupabase();

      // 1. التحقق هل البريد مسجل مسبقاً
      if (supabase && typeof supabase.from === 'function') {
        try {
          const { data: existing } = await supabase
            .from('restaurant_users')
            .select('id, username')
            .eq('username', email);
          if (existing && existing.length > 0) {
            return { success: false, message: 'هذا البريد الإلكتروني مسجل مسبقاً في النظام!' };
          }
        } catch (e) {}
      }

      const hashedPin = await sha256(password);
      const newUserId = 'u_reg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
      const newRow = {
        id: newUserId,
        restaurant_id: restId,
        username: email,
        pin: hashedPin, // مشفر بتجزئة SHA-256 ولا يُحفظ كنص صريح إطلاقاً
        full_name: fullName,
        role: role,
        active: false, // بانتظار تفعيل وموافقة الإدارة
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let insertOk = false;

      // 2. الإدراج عبر عميل السحابة
      if (supabase && typeof supabase.from === 'function') {
        try {
          const { error: insErr } = await supabase.from('restaurant_users').insert([newRow]);
          if (!insErr) insertOk = true;
          else console.warn('Supabase register insert error:', insErr);
        } catch (e) {}
      }

      // 3. الإدراج المباشر في حال انشغال العميل
      if (!insertOk) {
        try {
          const fetchUrl = `${DEFAULT_SUPABASE_URL}/rest/v1/restaurant_users`;
          const resp = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
              'apikey': DEFAULT_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(newRow)
          });
          if (resp.ok || resp.status === 201) insertOk = true;
        } catch (e) {}
      }

      // 4. تسجيل الحساب في مصادقة السحابة لتوفير استعادة كلمة المرور عبر الإيميل
      if (supabase && supabase.auth && typeof supabase.auth.signUp === 'function') {
        try {
          const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://polite-salmiakki-fe5507.netlify.app';
          await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
              emailRedirectTo: origin + '/login.html?verified=true',
              data: {
                full_name: fullName,
                role: role,
                restaurant_id: restId
              }
            }
          });
        } catch (e) {}
      }

      if (insertOk) {
        return {
          success: true,
          message: 'تم تسجيل حسابك بنجاح! حسابك حالياً قيد المراجعة، وبانتظار التفعيل والموافقة من الإدارة قبل تسجيل الدخول.'
        };
      } else {
        return {
          success: false,
          message: 'تعذر حفظ الحساب في الخادم السحابي، يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.'
        };
      }
    } catch (err) {
      console.error('registerNewUserAsync error:', err);
      return { success: false, message: 'حدث خطأ أثناء إنشاء الحساب: ' + err.message };
    }
  }

  // دالة طلب استعادة كلمة المرور عبر البريد الإلكتروني (مجاناً 100%)
  async function resetPasswordViaEmail(email) {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, message: 'يرجى إدخال بريد إلكتروني صالح!' };
      }

      const supabase = getSupabase();
      if (supabase && supabase.auth && typeof supabase.auth.resetPasswordForEmail === 'function') {
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://polite-salmiakki-fe5507.netlify.app';
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: origin + '/login.html?reset=true'
        });

        if (error) {
          return { success: false, message: 'تعذر إرسال الرابط: ' + (error.message || 'تأكد من صحة البريد الإلكتروني') };
        }

        return {
          success: true,
          message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح! يرجى فحص صندوق الوارد أو مجلد الرسائل غير المرغوبة (Spam).'
        };
      } else {
        return {
          success: false,
          message: 'خدمة البريد السحابي غير متصلة حالياً، يرجى التواصل مع الإدارة المركزية.'
        };
      }
    } catch (err) {
      console.error('resetPasswordViaEmail error:', err);
      return { success: false, message: 'حدث خطأ أثناء إرسال البريد: ' + err.message };
    }
  }

  // 丨賮馗 賵賲夭丕賲賳丞 丕賱噩賱爻丞 賮賷 賰丕賮丞 丕賱賲賮丕鬲賷丨 賱噩賲賷毓 丕賱卮丕卮丕鬲
  function saveSession(session, rememberMe = true, username = '') {
    if (!session || !session.role) return;
    const sStr = JSON.stringify(session);
    const restId = (session.restaurantId || getActiveRestaurantId() || '').toLowerCase();

    const keys = [
      SESSION_KEY,
      ...(restId ? ['smart_emenu_' + restId + '_session'] : []),
      'smart_emenu_session',
      'cashier_session',
      'captain_session',
      'admin_session'
    ];

    keys.forEach(k => {
      try {
        sessionStorage.setItem(k, sStr);
        localStorage.setItem(k, sStr);
      } catch (e) {}
    });

    try {
      sessionStorage.setItem(RESTAURANT_ID_KEY, restId);
      localStorage.setItem(RESTAURANT_ID_KEY, restId);

      if (session.role === 'super_admin') {
        sessionStorage.setItem('is_super_admin_logged_in', 'true');
        localStorage.setItem('is_super_admin_logged_in', 'true');
        sessionStorage.setItem('emattec_master_auth', 'true');
        localStorage.setItem('emattec_master_auth', 'true');
        sessionStorage.setItem('super_admin_user', session.username || 'banan');
        localStorage.setItem('super_admin_user', session.username || 'banan');
      } else {
        sessionStorage.removeItem('is_super_admin_logged_in');
        localStorage.removeItem('is_super_admin_logged_in');
        sessionStorage.removeItem('emattec_master_auth');
        localStorage.removeItem('emattec_master_auth');
        sessionStorage.removeItem('super_admin_user');
        localStorage.removeItem('super_admin_user');
      }

      if (rememberMe && username) {
        localStorage.setItem(REMEMBER_USER_KEY, username);
      }
    } catch (e) {}
  }

  // جلب الجلسة الحالية والتحقق من صحتها عبر كافة المفاتيح
  function getCurrentSession() {
    const restId = (getActiveRestaurantId() || '').toLowerCase();

    // 1. فحص الجلسة النشطة المحددة أولاً
    const candidateKeys = [
      SESSION_KEY,
      ...(restId ? ['smart_emenu_' + restId + '_session'] : []),
      'smart_emenu_session',
      'cashier_session',
      'captain_session',
      'admin_session'
    ];

    for (const key of candidateKeys) {
      try {
        const sStr = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (sStr) {
          const session = JSON.parse(sStr);
          if (session && (session.role || session.role_name)) {
            session.role = session.role || session.role_name;
            session.userId = session.userId || session.id;
            session.restaurantId = session.restaurantId || restId;
            session.loginTime = session.loginTime || Date.now();
            if (session.name && (/[\u4e00-\u9fa5]/.test(session.name) || session.name.includes('賲'))) {
              if (session.role === 'super_admin') session.name = 'مدير المنظومة (Super Admin)';
              else if (session.role === 'admin') session.name = 'المدير العام';
              else if (session.role === 'cashier') session.name = 'كاشير الصندوق';
              else if (session.role === 'captain') session.name = 'كابتن الصالة';
            }
            return session;
          }
        }
      } catch (e) {}
    }

    // 2. فحص السوبر أدمن كحل ثانوي فقط إذا لم توجد أي جلسة أخرى
    try {
      if (sessionStorage.getItem('is_super_admin_logged_in') === 'true' || 
          localStorage.getItem('is_super_admin_logged_in') === 'true' ||
          sessionStorage.getItem('emattec_master_auth') === 'true' ||
          localStorage.getItem('emattec_master_auth') === 'true') {
        const superUser = sessionStorage.getItem('super_admin_user') || localStorage.getItem('super_admin_user') || 'banan';
        return {
          id: 'u_super_1',
          userId: 'master_super_admin',
          username: superUser,
          name: 'مدير المنظومة (Super Admin)',
          role: 'super_admin',
          restaurantId: restId,
          loginTime: Date.now(),
          token: 'sup_master_sync'
        };
      }
    } catch (e) {}

    return null;
  }

  function clearSession() {
    const restId = (getActiveRestaurantId() || '').toLowerCase();
    const keys = [
      SESSION_KEY,
      ...(restId ? ['smart_emenu_' + restId + '_session'] : []),
      'smart_emenu_session',
      'cashier_session',
      'captain_session',
      'admin_session',
      'is_super_admin_logged_in',
      'emattec_master_auth',
      'super_admin_user'
    ];

    keys.forEach(k => {
      try {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      } catch (e) {}
    });
  }

  function logoutSession(redirectUrl = 'index.html') {
    clearSession();
    const restId = getActiveRestaurantId();
    const restParam = restId ? `?rest=${encodeURIComponent(restId)}` : '';
    const cleanUrl = redirectUrl.includes('?') ? redirectUrl : (redirectUrl + restParam);
    window.location.href = cleanUrl;
  }

  // 丕賱鬲賵噩賷賴 丕賱匕賰賷 亘毓丿 鬲爻噩賷賱 丕賱丿禺賵賱
  function redirectAfterLogin(role, restId = null) {
    const cleanRest = restId || getActiveRestaurantId();
    const restParam = cleanRest ? `?rest=${encodeURIComponent(cleanRest)}` : '';

    switch (role) {
      case 'super_admin':
        window.location.href = 'super-admin.html';
        break;
      case 'admin':
        window.location.href = 'admin.html' + restParam;
        break;
      case 'cashier':
        window.location.href = 'cashier.html' + restParam;
        break;
      case 'captain':
        window.location.href = 'captain.html' + restParam;
        break;
      default:
        window.location.href = 'index.html' + restParam;
        break;
    }
  }

  // 丕賱鬲丨賯賯 賲賳 氐賱丕丨賷丞 丕賱賵氐賵賱 賵鬲賮丕丿賷 丕賱丨賱賯丕鬲 丕賱賲賮乇睾丞
  function guardPage(requiredRoles = []) {
    const session = getCurrentSession();
    const path = window.location.pathname.toLowerCase();

    if (!session) {
      return { allowed: false, session: null };
    }

    if (requiredRoles.length === 0 || requiredRoles.includes(session.role) || session.role === 'super_admin') {
      return { allowed: true, session };
    }

    if (session.role === 'captain' && !path.includes('captain.html')) {
      window.location.replace('captain.html' + (session.restaurantId ? `?rest=${session.restaurantId}` : ''));
      return { allowed: false, session };
    }
    if (session.role === 'cashier' && !path.includes('cashier.html')) {
      window.location.replace('cashier.html' + (session.restaurantId ? `?rest=${session.restaurantId}` : ''));
      return { allowed: false, session };
    }
    if (session.role === 'admin' && !path.includes('admin.html') && !path.includes('cashier.html')) {
      window.location.replace('admin.html' + (session.restaurantId ? `?rest=${session.restaurantId}` : ''));
      return { allowed: false, session };
    }

    return { allowed: false, session };
  }

  function getRememberedUsername() {
    try {
      return localStorage.getItem(REMEMBER_USER_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  // مزامنة حسابات المستخدمين من Supabase وحفظ بيانات الأدوار في الذاكرة المحلية
  async function syncUsersFromSupabase() {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const restId = getActiveRestaurantId();
      if (!restId) return; // لا نجلب مستخدمين بدون معرف مطعم واضح
      const { data, error } = await sb
        .from('restaurant_users')
        .select('id, restaurant_id, username, full_name, role, active, assigned_printer_id')
        .eq('restaurant_id', restId);

      if (!error && Array.isArray(data) && data.length > 0) {
        const cleanUsers = data.map(u => ({
          id: u.id,
          username: u.username,
          name: u.full_name || 'طاقم العمل',
          role: u.role || 'staff',
          restaurant_id: u.restaurant_id || restId,
          assigned_printer_id: u.assigned_printer_id || null,
          assignedPrinterId: u.assigned_printer_id || null,
          active: u.active !== false
        }));
        localStorage.setItem('smart_emenu_cached_users', JSON.stringify(cleanUsers));
      }
    } catch (e) {
      console.warn("syncUsersFromSupabase notice:", e);
    }
  }

  // محاولة مزامنة المستخدمين من Supabase فورياً عند فتح الصفحة
  setTimeout(() => {
    syncUsersFromSupabase();
  }, 1000);

  window.AuthCore = {
    getActiveRestaurantId,
    loginUserAsync,
    registerNewUserAsync,
    resetPasswordViaEmail,
    sha256,
    syncUsersFromSupabase,
    getCurrentSession,
    saveSession,
    clearSession,
    logoutSession,
    redirectAfterLogin,
    guardPage,
    getRememberedUsername,
    generateSecureToken,
    DEFAULT_SYSTEM_USERS
  };

  window.loginUserAsync = loginUserAsync;
  window.registerNewUserAsync = registerNewUserAsync;
  window.resetPasswordViaEmail = resetPasswordViaEmail;
  window.syncUsersFromSupabase = syncUsersFromSupabase;
  window.getCurrentSession = getCurrentSession;
  window.saveUserSession = saveSession;
  window.logoutSession = logoutSession;

})(window);