
/* === supabase.js === */
/**
 * Smart E-Menu - Supabase Integration Client
 * تهيئة الاتصال السحابي بقاعدة بيانات Supabase
 */

const DEFAULT_SUPABASE_URL = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || "https://vyeolhhipsdcnntfbksy.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZW9saGhpcHNkY25udGZia3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDk2MDksImV4cCI6MjEwNDYyNTYwOX0.mLBkQh2r1iCarmWU76xrQVQprq305hnDAK95nMe1yh8";

// دعم تمرير عنوان ومفتاح السحابة عبر الرابط (URL Params)
try {
  const p = new URLSearchParams(window.location.search);
  const u = p.get('sb_url');
  const k = p.get('sb_key');
  if (u && u.trim()) localStorage.setItem('smart_emenu_supabase_url', u.trim());
  if (k && k.trim()) localStorage.setItem('smart_emenu_supabase_anon_key', k.trim());
} catch(e) {}

function getActiveSupabaseUrl() {
  return localStorage.getItem('smart_emenu_supabase_url') || DEFAULT_SUPABASE_URL;
}

function getActiveSupabaseAnonKey() {
  return localStorage.getItem('smart_emenu_supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;
}

const SUPABASE_URL = getActiveSupabaseUrl();
const SUPABASE_ANON_KEY = getActiveSupabaseAnonKey();

// إنشاء عميل Supabase ديناميكي
let supabaseClient = null;
let _cachedClientUrl = null;
let _cachedClientKey = null;

function getSupabase() {
  const currentUrl = getActiveSupabaseUrl();
  const currentKey = getActiveSupabaseAnonKey();
  if ((!supabaseClient || _cachedClientUrl !== currentUrl || _cachedClientKey !== currentKey) && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(currentUrl, currentKey);
      _cachedClientUrl = currentUrl;
      _cachedClientKey = currentKey;
    } catch (e) {
      console.warn("Supabase init warning:", e);
    }
  }
  return supabaseClient;
}

function getSupabaseClient() {
  return getSupabase();
}
window.getSupabase = getSupabase;
window.getSupabaseClient = getSupabase;

// دوال التحكم بتغيير السحابة
window.setSupabaseConfig = function(url, key) {
  if (url && url.trim()) localStorage.setItem('smart_emenu_supabase_url', url.trim());
  if (key && key.trim()) localStorage.setItem('smart_emenu_supabase_anon_key', key.trim());
  location.reload();
};
window.resetSupabaseConfig = function() {
  localStorage.removeItem('smart_emenu_supabase_url');
  localStorage.removeItem('smart_emenu_supabase_anon_key');
  location.reload();
};

// الاستماع لأي تغيير في إعدادات السحابة لتحديث الصفحة فورياً
window.addEventListener('storage', (e) => {
  if (e.key === 'smart_emenu_supabase_url' || e.key === 'smart_emenu_supabase_anon_key') {
    supabaseClient = null;
    location.reload();
  }
});

// معرف المطعم الافتراضي (لدعم تعدد المطاعم والفروع)
const DEFAULT_RESTAURANT_ID = "fahma_dokhan";

function getActiveRestaurantId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const qRest = params.get('rest') || params.get('restaurant');
    if (qRest && qRest.trim()) {
      const clean = qRest.trim().toLowerCase();
      try { sessionStorage.setItem('smart_emenu_restaurant_id', clean); } catch (e) {}
      return clean;
    }
    const sRest = sessionStorage.getItem('smart_emenu_restaurant_id');
    if (sRest && sRest.trim()) {
      return sRest.trim().toLowerCase();
    }
  } catch (e) {}

  try {
    const sessStr = sessionStorage.getItem('smart_emenu_session');
    if (sessStr) {
      const sess = JSON.parse(sessStr);
      if (sess && sess.restaurantId && sess.restaurantId.trim()) {
        return sess.restaurantId.trim().toLowerCase();
      }
    }
  } catch (e) {}

  try { sessionStorage.setItem('smart_emenu_restaurant_id','fahma_dokhan'); } catch(e) {} 
  return 'fahma_dokhan';
}

function setActiveRestaurantId(id) {
  if (!id) return;
  const clean = id.trim().toLowerCase();
  try {
    sessionStorage.setItem('smart_emenu_restaurant_id', clean);
  } catch (e) {}
}

// -------------------------------------------------------------
// محرك التحقق من أوقات العمل الرسمية وحالة استقبال الطلبات
// -------------------------------------------------------------
function parseArabicTimeToMinutes(timeStr, isPMHint) {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  let m = parseInt(match[2], 10);

  const lower = clean.toLowerCase();
  const hasMidnight = lower.includes('منتصف الليل') || lower.includes('نصف الليل');
  const hasDawn = lower.includes('فجر') || lower.includes('صباح') || lower.includes('am');
  const hasEvening = lower.includes('مساء') || lower.includes('ظهرا') || lower.includes('ظهر') || lower.includes('عصر') || lower.includes('ليل') || lower.includes('pm');

  if (hasMidnight) {
    if (h === 12 || h === 0) {
      return isClosingTime ? 24 * 60 : 0;
    } else if (h >= 1 && h <= 5) {
      return h * 60 + m;
    } else if (h >= 6 && h <= 11) {
      h += 12;
      return h * 60 + m;
    }
  }

  const isPM = isPMHint !== undefined ? isPMHint : (hasEvening && !hasDawn);
  if (isPM && h < 12) h += 12;
  if (!isPM && hasDawn && h === 12) h = 0;

  return h * 60 + m;
}

function parseWorkingHoursString(workingHoursText) {
  let openMin = 10 * 60;  // 10:00 AM (600)
  let closeMin = 24 * 60; // 12:00 Midnight (1440)

  if (!workingHoursText) return { openMin, closeMin };

  const matches = [...workingHoursText.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (matches.length >= 2) {
    const m1 = matches[0];
    const m2 = matches[1];

    const sub1 = workingHoursText.substring(0, m2.index);
    const sub2 = workingHoursText.substring(m2.index);

    const t1 = parseArabicTimeToMinutes(sub1, false, false);
    const t2 = parseArabicTimeToMinutes(sub2, undefined, true);

    if (t1 !== null) openMin = t1;
    if (t2 !== null) closeMin = t2;
  }
  return { openMin, closeMin };
}

function checkRestaurantOpenStatus(config, testDate) {
  const cfg = config || (typeof getStoredData === 'function' ? getStoredData('config', DEFAULT_RESTAURANT_CONFIG) : {});

  // 1. فحص التحكم اليدوي المباشر إن وُجد
  if (cfg.storeManualStatus === 'open') {
    return {
      isOpen: true,
      status: 'open',
      reason: 'manual_open',
      workingHoursText: cfg.workingHours || '',
      allowPreorderNextDay: cfg.allowPreorderNextDay !== false
    };
  }
  if (cfg.storeManualStatus === 'closed') {
    return {
      isOpen: false,
      status: 'closed',
      reason: 'manual_closed',
      workingHoursText: cfg.workingHours || '',
      allowPreorderNextDay: cfg.allowPreorderNextDay !== false
    };
  }

  // 2. فحص الحقول الصريحة openTime و closeTime أولاً
  let openMin = null;
  let closeMin = null;

  if (cfg.openTime && cfg.closeTime) {
    const oMatch = cfg.openTime.match(/(\d{1,2}):(\d{2})/);
    const cMatch = cfg.closeTime.match(/(\d{1,2}):(\d{2})/);
    if (oMatch && cMatch) {
      openMin = parseInt(oMatch[1], 10) * 60 + parseInt(oMatch[2], 10);
      closeMin = parseInt(cMatch[1], 10) * 60 + parseInt(cMatch[2], 10);

      // إذا كان وقت الإغلاق 00:00 (منتصف الليل) أو 24:00، فهذا يعني نهاية اليوم (1440 دقيقة)
      if (closeMin === 0 && openMin > 0) {
        closeMin = 24 * 60;
      }
    }
  }

  // إذا لم تكن موجودة بصيغة صريحة أو كانت متطابقة، نستنتجها بدقة من نص ساعات العمل workingHours
  if (openMin === null || closeMin === null || openMin === closeMin) {
    const parsed = parseWorkingHoursString(cfg.workingHours || "من 10:00 صباحاً وحتى 12:00 منتصف الليل");
    openMin = parsed.openMin;
    closeMin = parsed.closeMin;
    if (closeMin === 0 && openMin > 0) {
      closeMin = 24 * 60;
    }
  }

  // إذا بقيا متساويين، نضبطهما افتراضياً على ساعات عمل قياسية (10 صباحاً إلى 12 منتصف الليل)
  if (openMin === null || closeMin === null || openMin === closeMin) {
    openMin = 10 * 60;
    closeMin = 24 * 60;
  }

  const now = testDate || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let isOpen = false;
  if (openMin < closeMin) {
    // دوام بنفس اليوم (مثلاً 10:00 صباحاً إلى 12:00 منتصف الليل 1440)
    isOpen = currentMinutes >= openMin && currentMinutes < closeMin;
  } else {
    // دوام يمتد لما بعد منتصف الليل (مثلاً 12:00 ظهراً إلى 02:00 فجراً)
    isOpen = currentMinutes >= openMin || currentMinutes < closeMin;
  }

  return {
    isOpen,
    status: isOpen ? 'open' : 'closed',
    reason: isOpen ? 'in_working_hours' : 'outside_hours',
    currentMinutes,
    openMin,
    closeMin,
    workingHoursText: cfg.workingHours || 'من 10:00 صباحاً وحتى 12:00 منتصف الليل',
    allowPreorderNextDay: cfg.allowPreorderNextDay !== false
  };
}

// -------------------------------------------------------------
// تحديث هوية ونصوص المطعم في واجهة الكاشير
// -------------------------------------------------------------
function updateAppBranding() {
  const config = typeof getStoredData === 'function' ? getStoredData('config', DEFAULT_RESTAURANT_CONFIG) : DEFAULT_RESTAURANT_CONFIG;
  document.querySelectorAll('.brand-restaurant-name').forEach(el => el.textContent = config.name);
  document.querySelectorAll('.brand-restaurant-tagline').forEach(el => el.textContent = config.tagline);
  document.querySelectorAll('.brand-currency').forEach(el => el.textContent = config.currency);
  
  const cName = document.getElementById('cashier-restaurant-name');
  if (cName) cName.textContent = config.name;

  // تحديث شارة حالة المحل الحالية في الكاشير
  const storeStatus = checkRestaurantOpenStatus(config);
  const statusBadge = document.getElementById('cashier-store-current-status-badge');
  if (statusBadge) {
    if (storeStatus.isOpen) {
      statusBadge.textContent = "مفتوح الآن لاستقبال الطلبات 🟢";
      statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else {
      statusBadge.textContent = "مغلق حالياً (استقبال حجوزات الغد فقط) 🌙";
      statusBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30";
    }
  }

  const logoTarget = (config.logo && config.logo.trim()) ? config.logo.trim() : 'logo.svg';
  document.querySelectorAll('.restaurant-logo-img').forEach(img => {
    if (img.getAttribute('src') !== logoTarget) {
      img.src = logoTarget;
    }
    img.onerror = () => { img.src = 'logo.svg'; img.onerror = null; };
  });
}

// -------------------------------------------------------------
function ensureCashierRestaurantSubscription(client) {
  if (!client || window._cashierRestaurantRealtimeSubscribed) return;
  window._cashierRestaurantRealtimeSubscribed = true;
  try {
    client.channel('public:restaurants_cashier_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        checkRestaurantSubscription();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_info' }, () => {
        checkRestaurantSubscription();
      })
      .subscribe();
  } catch(e) {
    console.warn("Cashier realtime subscription error:", e);
  }

  window.addEventListener('focus', () => {
    checkRestaurantSubscription();
  });

  setInterval(() => {
    checkRestaurantSubscription();
  }, 4000);
}

// -------------------------------------------------------------
// فحص حالة اشتراك ومزامنة بيانات المطعم في Supabase لحظياً
// -------------------------------------------------------------
async function checkRestaurantSubscription() {
  const client = getSupabase();
  if (!client) return { active: true };

  ensureCashierRestaurantSubscription(client);

  const restId = getActiveRestaurantId();

  try {
    const { data, error } = await client
      .from('restaurants')
      .select('*')
      .eq('id', restId)
      .limit(1);

    if (!error && data && data.length > 0) {
      const rest = data[0];
      const plan = rest.subscription_plan || rest.plan_type || 'pro';

      // 1. فحص حالة التفعيل وتاريخ انتهاء باقة الاشتراك تلقائياً
      const isDateExpired = rest.subscription_end_date && (new Date(rest.subscription_end_date).getTime() < Date.now());
      if (rest.is_active === false || isDateExpired) {
        showSubscriptionLockScreen(rest, 'expired');
        return { active: false, restaurant: rest };
      }

      // 2. إذا كانت باقة المطعم هي الباقة الأساسية (basic) - لا يحق له الدخول للكاشير إطلاقاً
      if (plan === 'basic') {
        showSubscriptionLockScreen(rest, 'plan_restricted');
        return { active: false, restaurant: rest };
      }

      hideSubscriptionLockScreen();

      // مزامنة حالة الباقات وكافة بيانات المطعم في التخزين المحلي فوراً
      const localConfig = typeof getStoredData === 'function' ? getStoredData('config', {}) : {};
      if (typeof setStoredData === 'function' && localConfig) {
        localConfig.planType = plan;
        localConfig.subscriptionPlan = plan;
        localConfig.allowDineInOrders = !!rest.allow_dinein_orders;
        localConfig.allowTakeawayOrders = rest.allow_takeaway_orders !== false;
        localConfig.takeawayPackageActive = rest.takeaway_package_active !== false;
        
        if (rest.name) localConfig.name = rest.name;
        if (rest.name_en) localConfig.nameEn = rest.name_en;
        if (rest.tagline) localConfig.tagline = rest.tagline;
        if (rest.tagline_en) localConfig.taglineEn = rest.tagline_en;
        if (rest.phone) localConfig.phone = rest.phone;
        if (rest.phone2 !== undefined) localConfig.phone2 = rest.phone2 || '';
        if (rest.whatsapp_url) localConfig.whatsappUrl = rest.whatsapp_url;
        if (rest.whatsapp_number) localConfig.whatsappNumber = rest.whatsapp_number;
        if (rest.address) localConfig.address = rest.address;
        if (rest.maps_url || rest.map_url) localConfig.mapUrl = rest.maps_url || rest.map_url;
        if (rest.working_hours) localConfig.workingHours = rest.working_hours;
        if (rest.holidays) localConfig.holidays = rest.holidays;
        if (rest.wifi_name) localConfig.wifiName = rest.wifi_name;
        if (rest.wifi_pass) localConfig.wifiPass = rest.wifi_pass;
        if (rest.tables_count) localConfig.tablesCount = Number(rest.tables_count);
        if (rest.currency) localConfig.currency = rest.currency;
        if (rest.logo !== undefined && rest.logo !== null && rest.logo.trim() !== '') {
          localConfig.logo = rest.logo.trim();
        } else if (rest.logo !== undefined) {
          localConfig.logo = 'logo.svg';
        }

        setStoredData('config', localConfig);
        updateAppBranding();
      }

      return { active: true, restaurant: rest };
    }
  } catch (e) {
    console.warn("Subscription check offline:", e);
  }

  return { active: true };
}

// -------------------------------------------------------------
// شاشة القفل وتجديد الاشتراك والتواصل مع الدعم 07702265652
// -------------------------------------------------------------
function showSubscriptionLockScreen(rest, lockReason = 'expired') {
  let overlay = document.getElementById('subscription-locked-overlay');
  const supportPhone = rest?.support_phone || '07702265652';
  const isPlanRestricted = lockReason === 'plan_restricted';

  const badgeText = isPlanRestricted ? 'الترقية إلى باقة Pro مطلوبة 👑' : 'الاشتراك غير مفعّل / منتهي';
  const titleText = isPlanRestricted ? 'شاشة الكاشير غير متوفرة في باقتك' : 'يرجى تجديد الاشتراك';
  const descText = isPlanRestricted
    ? `عزيزي صاحب المطعم، اشتراكك الحالي هو <b>الباقة الأساسية (Basic - منيو فقط)</b>. شاشة الكاشير والمحاسبة ونقاط البيع متاحة حصرياً في <b>باقة Pro الاحترافية</b>. للترقية وتفعيل الكاشير فوراً، يرجى التواصل مع الدعم الفني.`
    : `عزيزي صاحب المطعم، لقد تم إيقاف الخدمة مؤقتاً لتجديد الاشتراك أو ترقية الباقات. يرجى التواصل مع مكتب <b>emattec</b> لإعادة التفعيل الفوري.`;
  const btnText = isPlanRestricted ? '👑 ترقية الباقة وتفعيل الكاشير الآن' : '📞 اتصال فوري لتجديد الاشتراك';

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'subscription-locked-overlay';
    overlay.className = 'fixed inset-0 z-[999999] bg-[#0b1120] flex items-center justify-center p-4 text-center overflow-y-auto';
    overlay.innerHTML = `
      <div class="max-w-md w-full bg-slate-900 border-2 ${isPlanRestricted ? 'border-amber-500/50' : 'border-rose-500/50'} rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-auto">
        
        <!-- لوجو مكتب emattec -->
        <div class="w-24 h-24 rounded-3xl bg-white p-2 mx-auto shadow-2xl border-2 ${isPlanRestricted ? 'border-amber-500/30' : 'border-rose-500/30'} flex items-center justify-center overflow-hidden">
          <img src="emattec-logo.jpg" alt="emattec" class="w-full h-full object-contain" onerror="this.src='logo.svg'" />
        </div>

        <div class="space-y-2">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 ${isPlanRestricted ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'} text-xs font-black rounded-full border">
            <span class="w-2 h-2 rounded-full ${isPlanRestricted ? 'bg-amber-500' : 'bg-rose-500'} animate-ping"></span>
            <span id="sub-lock-badge-text">${badgeText}</span>
          </div>
          <h2 id="sub-lock-title-text" class="text-2xl font-black text-white">${titleText}</h2>
          <p id="sub-lock-desc-text" class="text-xs text-slate-300 leading-relaxed">
            ${descText}
          </p>
        </div>

        <!-- بطاقة رقم الدعم والتجديد -->
        <div class="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
          <div class="text-xs text-slate-400 font-bold">رقم الدعم الفني وترقية الباقات:</div>
          <div class="text-2xl font-black text-amber-400 font-mono tracking-wider">${supportPhone}</div>
          <div class="text-[11px] text-slate-500">مكتب emattec للحلول البرمجية والأنظمة الذكية</div>
        </div>

        <!-- أزرار التواصل والتجديد -->
        <div class="space-y-2 pt-1">
          <a id="sub-lock-phone-btn" href="tel:${supportPhone}" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-95">
            <span>${btnText}</span>
          </a>
          <a href="https://wa.me/964${supportPhone.replace(/^0+/, '')}?text=${encodeURIComponent('مرحباً، أرغب في ترقية باقة المطعم إلى باقة Pro لتفعيل شاشة الكاشير')}" target="_blank" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition">
            <span>💬 تواصل عبر WhatsApp للترقية</span>
          </a>
          <a href="admin.html?rest=${encodeURIComponent(rest?.id || '')}" class="w-full py-2 bg-navy-950 hover:bg-slate-800 text-blue-400 hover:text-blue-300 text-xs font-bold rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition">
            <span>🏢 العودة للوحة تحكم إدارة الأطباق (Admin)</span>
          </a>
        </div>

        <div class="text-[11px] text-slate-500 pt-3 border-t border-slate-800">
          تطوير وبرمجة <b>مكتب emattec</b> للأنظمة والحلول السحابية
        </div>

      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    const badgeEl = document.getElementById('sub-lock-badge-text');
    const titleEl = document.getElementById('sub-lock-title-text');
    const descEl = document.getElementById('sub-lock-desc-text');
    if (badgeEl) badgeEl.textContent = badgeText;
    if (titleEl) titleEl.textContent = titleText;
    if (descEl) descEl.innerHTML = descText;
  }

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideSubscriptionLockScreen() {
  const overlay = document.getElementById('subscription-locked-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

// -------------------------------------------------------------
// قسم / نافذة التعريف بمكتب emattec (About Emattec)
// -------------------------------------------------------------
function openAboutEmattecModal() {
  let modal = document.getElementById('about-emattec-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'about-emattec-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-center relative">
        
        <button onclick="closeAboutEmattecModal()" class="absolute left-4 top-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold">
          ✕
        </button>

        <!-- لوجو مكتب emattec -->
        <div class="w-24 h-24 rounded-3xl bg-white p-2.5 mx-auto shadow-2xl border border-slate-700 flex items-center justify-center overflow-hidden">
          <img src="emattec-logo.jpg" alt="لوجو مكتب emattec" class="w-full h-full object-contain" />
        </div>

        <div class="space-y-1.5">
          <div class="inline-block px-3 py-1 bg-rose-600/10 text-rose-400 text-xs font-black rounded-full border border-rose-500/30">
            الحلول البرمجية والأنظمة الذكية
          </div>
          <h3 class="text-2xl font-black text-white">مكتب emattec</h3>
          <p class="text-xs text-slate-300 leading-relaxed px-2">
            متخصصون في برمجة وتطوير أنظمة المطاعم، المنيو الرقمي التفاعلي، تطبيقات الكاشير والطلبات، والربط السحابي مع أنظمة الخرائط والملاحة.
          </p>
        </div>

        <!-- بطاقة طلب نفس النظام -->
        <div class="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-right">
          <div class="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <span>🚀</span>
            <span>هل ترغب بإنشاء نفس هذا النظام لمطعمك أو مشروعك؟</span>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            نقدم حلولاً مخصصة تناسب كافة الأنشطة التجارية مع استضافة سحابية، استوديو باركود، دعم الطباعة الحرارية، وتطبيقات متكاملة.
          </p>
        </div>

        <!-- رقم التواصل المباشر -->
        <div class="space-y-2">
          <a href="tel:07702265652" class="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2">
            <span>📞 اتصل الآن لطلب النظام: 07702265652</span>
          </a>
          <a href="https://wa.me/9647702265652" target="_blank" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition">
            <span>💬 تواصل معنا عبر واتساب</span>
          </a>
        </div>

        <div class="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
          جميع الحقوق محفوظة © مكتب <b>emattec</b> 2026
        </div>

      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAboutEmattecModal() {
  const modal = document.getElementById('about-emattec-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

function preserveRestaurantParamInLinks() {
  try {
    const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : null;
    if (!restId) return;
    const pages = ['index.html', 'admin.html', 'cashier.html', 'captain.html'];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const isTargetPage = pages.some(p => href === p || href.startsWith(p + '?') || href.startsWith(p + '#'));
      if (isTargetPage && !href.includes('rest=')) {
        const hashParts = href.split('#');
        const mainPart = hashParts[0];
        const hash = hashParts.length > 1 ? ('#' + hashParts[1]) : '';
        const sep = mainPart.includes('?') ? '&' : '?';
        a.setAttribute('href', `${mainPart}${sep}rest=${encodeURIComponent(restId)}${hash}`);
      }
    });
  } catch(e) {}
}

// تشغيل الفحص الدوري للاشتراك وتحديث الهوية
document.addEventListener('DOMContentLoaded', () => {
  preserveRestaurantParamInLinks();
  updateAppBranding();
  setTimeout(() => {
    checkRestaurantSubscription();
    preserveRestaurantParamInLinks();
  }, 100);
});

/* === data.js === */
/**
 * مطعم فحمة ودخان - بيانات المنيو وإعدادات رابط النشر والباركود
 */

const DEFAULT_RESTAURANT_CONFIG = {
  name: "مطعم فحمة ودخان",
  nameEn: "Fahma & Dokhan Restaurant",
  tagline: "أشهى المشاوي والدجاج على الفحم، البركر، الساندويشات الغربية والريزو",
  taglineEn: "Delicious Charcoal Grills, Mansaf, Burgers & Western Sandwiches",
  currency: "د.ع",
  currencyEn: "IQD",
  phone: "+9647700000000",
  phone2: "",
  mapUrl: "",
  whatsappNumber: "+9647700000000",
  publishedUrl: "", 
  
  // خيارات وقفل الطلبات في المنيو (التحكم من لوحة الأدمن)
  allowDineInOrders: true,           // تفعيل الطلب الذاتي داخل الصالة
  allowTakeawayOrders: true,         // طلب السفري والتوصيل أونلاين (مفعل)
  takeawayPackageActive: true,       // باقة التوصيل السريع (مفعلة)
  planType: "pro",                   // نوع الباقة: pro

  whatsappDirectOrderEnabled: false,
  whatsappLockReason: "للتواصل والطلب المباشر أو تفعيل الخدمات، يرجى الاتصال برقم الدعم الفني: 07702265652.",
  autoPrintKitchenTicket: true,
  printerPaperSize: "80mm",
  adminPin: "",
  wifiName: "Fahma_Dokhan_WiFi",
  wifiPass: "fahma2026",
  address: "العراق - نرحب بكم في صالتنا لتناول أشهى الوجبات",
  workingHours: "12:00 ظهراً - 02:00 بعد منتصف الليل",
  holidays: "مفتوح طوال أيام الأسبوع",
  tablesCount: 20,
  taxRate: 0,
  serviceCharge: 0,
  theme: "luxury",
  lang: "ar"
};

const DEFAULT_CATEGORIES = [
  { id: "all", name: "الكل", nameEn: "All", icon: "🍽️" },
  { id: "grills", name: "المشاوي والكباب", nameEn: "Grills", icon: "🥩" },
  { id: "chicken", name: "الدجاج والمناسف", nameEn: "Chicken & Mansaf", icon: "🍗" },
  { id: "fish", name: "الأسماك والمسكوف", nameEn: "Fish & Masgouf", icon: "🐟" },
  { id: "burgers", name: "البركر", nameEn: "Burgers", icon: "🍔" },
  { id: "western", name: "الساندويشات الغربية", nameEn: "Western", icon: "🌯" },
  { id: "rizo", name: "الريزو", nameEn: "Rizo", icon: "🍚" },
  { id: "appetizers", name: "المقبلات والبطاطا", nameEn: "Appetizers", icon: "🥗" },
  { id: "drinks", name: "المشروبات", nameEn: "Drinks", icon: "🥤" }
];

const DEFAULT_DISHES = [{"id":101,"name":"نفر كباب لحم","nameEn":"Beef Kebab Plate (Full)","categoryId":"grills","price":8000,"ingredients":"لحم غنم عراقي مفروم طازج، لية، بصل، بقدونس، سماق، طماطم وفلفل مشوي، يقدم مع الخبز الحار وسرفيس الخضار.","calories":"680 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":102,"name":"نص نفر كباب لحم","nameEn":"Half Beef Kebab Plate","categoryId":"grills","price":5000,"ingredients":"نصف وجبة كباب لحم غنم مشوي على الفحم مع الطماطم المشوية والخبز الحار والسماق.","calories":"360 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":103,"name":"نفر تكة لحم","nameEn":"Beef Tikka Plate (Full)","categoryId":"grills","price":9000,"ingredients":"شقف لحم غنم هبرة طازجة، لية غنم، تتبيلة بهارات خاصة، بصل مشوي، طماطم، خبز حار.","calories":"620 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":104,"name":"نص نفر تكة لحم","nameEn":"Half Beef Tikka Plate","categoryId":"grills","price":5000,"ingredients":"قطع تكة لحم غنم متبلة ومشوية على الفحم مع الخبز الحار والخضار المشوية.","calories":"330 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":105,"name":"نفر معلاق","nameEn":"Liver (Malaq) Plate (Full)","categoryId":"grills","price":9000,"ingredients":"كبدة غنم طازجة مقطعة، شحم لية غنم، رشة سماق، ليمون، خبز حار صاج أو تنور.","calories":"530 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":106,"name":"نص نفر معلاق","nameEn":"Half Liver Plate","categoryId":"grills","price":5000,"ingredients":"نصف وجبة معلاق غنم طازج مشوي على جمر الفحم مع الليمون والخبز.","calories":"280 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":107,"name":"نفر تكة دجاج","nameEn":"Chicken Tikka Plate (Full)","categoryId":"grills","price":7000,"ingredients":"مكعبات صدور دجاج طرية، تتبيلة الزبادي والثوم والليمون والزعفران، صوص ثومية، خبز حار، طماطم مشوية.","calories":"510 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":108,"name":"نص نفر تكة دجاج","nameEn":"Half Chicken Tikka Plate","categoryId":"grills","price":4000,"ingredients":"نصف وجبة تكة دجاج مشوية على الفحم مع الثومية والخبز وسرفيس الخضار.","calories":"270 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":109,"name":"نفر كباب دجاج","nameEn":"Chicken Kebab Plate (Full)","categoryId":"grills","price":5000,"ingredients":"دجاج مفروم، بصل، كزبرة، بهارات مشاوي دجاج خاصة، طماطم مشوية، خبز حار، صوص ثوم.","calories":"470 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":110,"name":"نص نفر كباب دجاج","nameEn":"Half Chicken Kebab Plate","categoryId":"grills","price":3000,"ingredients":"نصف وجبة كباب دجاج مشوي على الفحم مع الخبز والصوص.","calories":"250 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":111,"name":"نفر مشكل","nameEn":"Mixed Grill Plate (Full)","categoryId":"grills","price":9000,"ingredients":"سيخ كباب لحم + سيخ تكة لحم + سيخ تكة دجاج + طماطم وبصل مشوي + خبز حار وسرفيس كامل.","calories":"740 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":112,"name":"نص نفر مشكل","nameEn":"Half Mixed Grill Plate","categoryId":"grills","price":5000,"ingredients":"تشكيلة من كباب اللحم وتكة الدجاج واللحم مع المرفقات والخبز.","calories":"390 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":113,"name":"عرايس على الفحم","nameEn":"Arayes Meat on Charcoal","categoryId":"grills","price":5000,"ingredients":"خبز محشو بلحم الغنم المفروم والمتبل بالبصل والبقدونس ودبس الرمان، محمص على جمر الفحم.","calories":"560 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":114,"name":"كيلو كباب لحم","nameEn":"1 KG Beef Kebab","categoryId":"grills","price":18000,"ingredients":"كيلو كامل كباب لحم غنم بلدي مشوي على الفحم، يقدم مع كمية وفيرة من الخبز الحار، البصل المشوي، الطماطم، والمخللات.","calories":"2200 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":115,"name":"كيلو كباب دجاج","nameEn":"1 KG Chicken Kebab","categoryId":"grills","price":10000,"ingredients":"كيلو كامل كباب دجاج متبل ومشوي على الفحم مع الخبز والصوصات وسرفيس الخضار.","calories":"1700 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":116,"name":"كيلو كباب مشكل","nameEn":"1 KG Mixed Kebab","categoryId":"grills","price":15000,"ingredients":"كيلو مشكل كباب لحم وكباب دجاج على الفحم مع الخبز والطرشي والطماطم المشوية.","calories":"1950 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":201,"name":"منسف دجاجة شواية","nameEn":"Whole Rotisserie Chicken Mansaf","categoryId":"chicken","price":15000,"ingredients":"دجاجة كاملة شواية محمرة، صينية تمن (أرز) زعفران ومبهر، مرق فاصوليا/بامية، حشو شعرية ومكسرات، ليمون وطرشي.","calories":"1650 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":202,"name":"منسف نص دجاجة شواية","nameEn":"Half Rotisserie Chicken Mansaf","categoryId":"chicken","price":10000,"ingredients":"نصف دجاجة شواية محمرة، صحن تمن مع الحشو، صحن مرق، سلطة وطرشي.","calories":"920 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":203,"name":"دجاجة شواية (بدون تمن)","nameEn":"Whole Rotisserie Chicken Only","categoryId":"chicken","price":9000,"ingredients":"دجاجة شواية كاملة متبلة ومحمرة على السيخ الدوار، تقدم مع الخبز، الطرشي، وصلصة الثومية.","calories":"1200 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":204,"name":"نص دجاجة شواية (بدون تمن)","nameEn":"Half Rotisserie Chicken Only","categoryId":"chicken","price":5000,"ingredients":"نصف دجاجة شواية محمرة مع الخبز الحار والمخللات والثومية.","calories":"600 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":205,"name":"منسف دجاجة على الفحم","nameEn":"Charcoal Grilled Chicken Mansaf","categoryId":"chicken","price":13000,"ingredients":"دجاجة كاملة مشوية على جمر الفحم بنكهة التدخين المميزة، تقدم على منسف تمن مبهر مع المرق والمخلل والخبز.","calories":"1550 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":206,"name":"منسف نص دجاجة على الفحم","nameEn":"Charcoal Half Chicken Mansaf","categoryId":"chicken","price":10000,"ingredients":"نصف دجاجة مشوية على الفحم، تمن مبهر، مرق، سلطة ومخلل.","calories":"880 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":207,"name":"دجاجة على الفحم (بدون تمن)","nameEn":"Whole Charcoal Grilled Chicken","categoryId":"chicken","price":8000,"ingredients":"دجاجة كاملة متبلة بالليمون والبهارات ومشوية على الفحم مع الخبز وصلصة الثوم والطرشي.","calories":"1150 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":208,"name":"نص دجاجة على الفحم (بدون تمن)","nameEn":"Half Charcoal Grilled Chicken","categoryId":"chicken","price":5000,"ingredients":"نصف دجاجة مشوية على الفحم مع الخبز والصلصة.","calories":"580 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":209,"name":"نفر أجنحة دجاج على تمن","nameEn":"Wings with Rice (Full Plate)","categoryId":"chicken","price":9000,"ingredients":"أجنحة دجاج متبلة ومشوية على الفحم، تقدم على وجبة تمن مع المرق وسرفيس الخضار.","calories":"820 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":210,"name":"نص نفر أجنحة دجاج على تمن","nameEn":"Half Wings with Rice Plate","categoryId":"chicken","price":5000,"ingredients":"نصف وجبة أجنحة دجاج مشوية على الفحم مع التمن والمرق.","calories":"460 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":211,"name":"نفر أجنحة دجاج مشوية","nameEn":"Grilled Wings Plate Only","categoryId":"chicken","price":7000,"ingredients":"أجنحة دجاج مقرمشة مشوية على الفحم مع الخبز والصلصات الحارة والعادية.","calories":"580 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":212,"name":"نص نفر أجنحة دجاج مشوية","nameEn":"Half Grilled Wings Plate Only","categoryId":"chicken","price":4000,"ingredients":"نصف وجبة أجنحة دجاج مشوية على الفحم مع الخبز.","calories":"310 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":301,"name":"بركر لحم عادي","nameEn":"Single Beef Burger","categoryId":"burgers","price":1500,"ingredients":"شريحة لحم مشوية، خس طازج، طماطم، مخلل خيار، صوص بركر خاص، خبز سمسم طري.","calories":"410 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":302,"name":"بركر لحم دبل","nameEn":"Double Beef Burger","categoryId":"burgers","price":2500,"ingredients":"شريحتين لحم بقري مشوي، خس، طماطم، مخلل، صوص الشيف المميز في خبز برجر كبير.","calories":"640 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":303,"name":"بركر لحم بالجبن عادي","nameEn":"Single Cheeseburger","categoryId":"burgers","price":1750,"ingredients":"شريحة لحم مشوية، شريحة جبنة شيدر أمريكية ذائبة، خس، طماطم، صوص بركر، خبز سمسم.","calories":"470 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":304,"name":"بركر لحم بالجبن دبل","nameEn":"Double Cheeseburger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم مشوي، طبقتين جبنة شيدر ذائبة، خس، مخلل، صوصات غنية، خبز محمص.","calories":"770 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":305,"name":"بركر اومليت عادي","nameEn":"Single Omelette Burger","categoryId":"burgers","price":2000,"ingredients":"شريحة لحم برجر، قرص بيض أومليت ذهبي مطهو بالزبدة، جبنة شيدر، خس، صوص المايونيز والكاتشب.","calories":"530 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":306,"name":"بركر اومليت دبل","nameEn":"Double Omelette Burger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم + قرص بيض أومليت + جبنة شيدر ذائبة + خضار وصوص.","calories":"810 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":307,"name":"بركر فطر عادي","nameEn":"Single Mushroom Burger","categoryId":"burgers","price":2000,"ingredients":"شريحة لحم مشوية، فطر (مشروم) طازج مشوح، صلصة الفطر الكريمية الغنية، جبنة، خس.","calories":"520 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":308,"name":"بركر فطر دبل","nameEn":"Double Mushroom Burger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم مشوي مع كمية مضاعفة من صلصة المشروم الكريمية وحبات الفطر والجبنة.","calories":"780 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":401,"name":"زنجر عادي","nameEn":"Zinger Chicken Sandwich","categoryId":"western","price":1500,"ingredients":"قطعة صدر دجاج زنجر مقرمشة حارة، خس كابوتشا طازج، مايونيز، خبز صمون فرنسي طري.","calories":"470 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":402,"name":"زنجر بالجبن","nameEn":"Zinger with Cheese","categoryId":"western","price":1750,"ingredients":"صدر دجاج زنجر سبايسي حار، شريحة جبنة شيدر ذائبة، خس، صوص زنجر خاص.","calories":"530 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":403,"name":"زنجر هوني ماسترد","nameEn":"Zinger Honey Mustard","categoryId":"western","price":2000,"ingredients":"دجاج زنجر مقرمش، صلصة الهوني ماسترد (الخردل بالعسل الطبيعي)، جبنة، خس.","calories":"550 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":404,"name":"كريسبي عادي","nameEn":"Crispy Chicken Sandwich","categoryId":"western","price":1500,"ingredients":"صدر دجاج مقرمش ذهبي غير حار، خس، مايونيز، خبز صمون سمسم.","calories":"450 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":405,"name":"كريسبي بالجبن","nameEn":"Crispy with Cheese","categoryId":"western","price":1750,"ingredients":"دجاج كريسبي مقرمش غير حار مع شريحة جبنة شيدر وخس وصوص.","calories":"510 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":406,"name":"كريسبي هوني ماسترد","nameEn":"Crispy Honey Mustard","categoryId":"western","price":2000,"ingredients":"دجاج كريسبي مع صلصة الهوني ماسترد الغنية الحلوة والشهية وجبنة.","calories":"540 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":407,"name":"فاهيتا دجاج","nameEn":"Chicken Fajita Sandwich","categoryId":"western","price":1500,"ingredients":"شرائح صدور دجاج طرية، فلفل أخضر وأحمر وأصفر، بصل مكرمل، بهارات فاهيتا، صوص مايونيز بالثوم.","calories":"430 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":408,"name":"مكسيكانو دجاج حار","nameEn":"Spicy Mexicano Chicken","categoryId":"western","price":1500,"ingredients":"دجاج مطهو بصلصة المكسيكانو الحارة مع الفلفل الهالبينو، ذرة، بصل، صلصة طماطم حارة.","calories":"440 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":409,"name":"تويستر","nameEn":"Chicken Twister Wrap","categoryId":"western","price":1500,"ingredients":"أصابع دجاج مقرمشة، خس طازج، طماطم، صوص فلفل أو مايونيز، ملفوفة في خبز تورتيلا محمص.","calories":"420 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":410,"name":"سكالوب دجاج","nameEn":"Chicken Escalope Sandwich","categoryId":"western","price":1500,"ingredients":"شريحة سكالوب دجاج بانيه مقلية ذهبية، خس، مخلل، مايونيز، كاتشب.","calories":"460 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1608797178974-15b35a61ded7?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":411,"name":"جيكن ساب (تشيكن سب)","nameEn":"Chicken Sub Sandwich","categoryId":"western","price":2000,"ingredients":"ساندويتش صب كبير، دجاج متبل، جبنة موزاريلا وشيدر ذائبة، خضار مشكلة، صوصات غنية.","calories":"590 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":412,"name":"فنكر عادي (بطاطا مقلية)","nameEn":"Crispy French Fries","categoryId":"western","price":1000,"ingredients":"أصابع بطاطا مقلية ذهبية مقرمشة مع بهارات الفنكر وكاتشب.","calories":"320 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":413,"name":"فنكر بالجبن","nameEn":"Loaded Cheddar Cheese Fries","categoryId":"western","price":1500,"ingredients":"أصابع بطاطا مقلية ساخنة مغطاة بصلصة جبنة الشيدر الذائبة الكريمية.","calories":"490 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":501,"name":"ريزو عادي","nameEn":"Classic Chicken Rizo","categoryId":"rizo","price":4000,"ingredients":"أرز ريزو مبهر أصفر، قطع دجاج كرسبي مقرمشة مقطعة، صوص الريزو الخاص الحامض والحلو.","calories":"630 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":502,"name":"ريزو بالجبن","nameEn":"Cheese Chicken Rizo","categoryId":"rizo","price":4500,"ingredients":"أرز ريزو مبهر، قطع دجاج مقرمش، صوص جبنة شيدر غني وساخن، صوص ريزو.","calories":"750 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":503,"name":"ريزو باربيكو","nameEn":"BBQ Chicken Rizo","categoryId":"rizo","price":4500,"ingredients":"أرز ريزو، قطع دجاج مقرمشة، صلصة باربيكيو مدخنة، صوص ريزو خاص.","calories":"690 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":601,"name":"مقبلات مشكلة - حجم كبير","nameEn":"Large Mixed Appetizers Platter","categoryId":"appetizers","price":3000,"ingredients":"تشكيلة مقبلات شرقية منوعة (حمص بطحينة، متبل باذنجان، بابا غنوج، جاجيك بالخيار والنعناع، لهانة حمراء، وسلطة زيتون).","calories":"460 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":602,"name":"مقبلات مشكلة - حجم وسط","nameEn":"Medium Mixed Appetizers","categoryId":"appetizers","price":2000,"ingredients":"صحن مقبلات وسط مشكل (حمص، متبل، جاجيك، سلطة لهانة).","calories":"310 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":603,"name":"مقبلات مشكلة - حجم صغير","nameEn":"Small Mixed Appetizers","categoryId":"appetizers","price":1000,"ingredients":"صحن مقبلات فردي صغير مشكل طازج.","calories":"190 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":701,"name":"ببسي","nameEn":"Pepsi Can (330ml)","categoryId":"drinks","price":500,"ingredients":"مشروب غازي ببسي مثلج في كان معدني.","calories":"140 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":702,"name":"سفن أب","nameEn":"7-Up Can (330ml)","categoryId":"drinks","price":500,"ingredients":"مشروب غازي سفن أب مثلج بنكهة الليمون واللايم المنعشة.","calories":"140 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":703,"name":"ميراندا برتقال","nameEn":"Mirinda Orange Can","categoryId":"drinks","price":500,"ingredients":"مشروب غازي ميراندا برتقال بارد ومنعش.","calories":"150 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":704,"name":"شنينة (لبن عيران)","nameEn":"Fresh Ayran Shanina","categoryId":"drinks","price":500,"ingredients":"لبن عيران طبيعي بارد مع رشة نعناع وملح خفيف.","calories":"90 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1584947914532-26113214578f?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_masgouf","name":"سمك مسكوف عراقي (بالوزن)","nameEn":"Iraqi Masgouf Fish (By Weight)","categoryId":"fish","price":10000,"unitPrice":10000,"isWeighted":true,"ingredients":"سمك كارب عراقي حي طازج يوزن ويشوى على الحطب، يحسب السعر وفق الوزن الفعلي للسمكة (10,000 د.ع لكل كغم) ويقدم مع الخبز الحار والطرشي والليمون والعمبة وسيرفيس الخضار.","calories":"450 سعرة / حصة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_bunni","name":"سمك بني دجلاوي مسكوف","nameEn":"Masgouf Bunni Fish (By Weight)","categoryId":"fish","price":12000,"unitPrice":12000,"isWeighted":true,"ingredients":"سمك بني عراقي دجلاوي طازج مشوي على الحطب بنكهة عراقية أصيلة، يقدم مع الخبز الحار والمخللات والليمون وسيرفيس الخضار.","calories":"420 سعرة / حصة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_gattan","name":"سمك كطان مسكوف فاخر","nameEn":"Masgouf Gattan Fish (By Weight)","categoryId":"fish","price":14000,"unitPrice":14000,"isWeighted":true,"ingredients":"سمك كطان عراقي نهري شط العرب مشوي على جمر الخشب الطبيعي مع خلطة الشيف الخاصة وسيرفيس كامل.","calories":"480 سعرة / حصة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_shibbot","name":"سمك شبوط عراقي (بالوزن)","nameEn":"Iraqi Shibbot Fish (By Weight)","categoryId":"fish","price":11000,"unitPrice":11000,"isWeighted":true,"ingredients":"سمك شبوط عراقي نهري طازج مشوي على الحطب أو مقلي حسب الطلب، يحسب السعر بالوزن الفعلي ويقدم مع الخبز الحار والمخللات والعمبة.","calories":"460 سعرة / حصة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_fried","name":"سمك مقلي عراقي مقرمش (بالوزن)","nameEn":"Crispy Fried Fish (By Weight)","categoryId":"fish","price":10000,"unitPrice":10000,"isWeighted":true,"ingredients":"قطع سمك طازجة مقلية ذهبية مقرمشة ومتبلة بالبهارات العراقية الخاصة مع الطماطم والخيار والمخللات والعمبة والخبز الحار.","calories":"520 سعرة / حصة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_shrimp_kg","name":"جمبري مقلي (بالوزن)","nameEn":"Fried Shrimp (By Weight)","categoryId":"fish","price":15000,"unitPrice":15000,"isWeighted":true,"ingredients":"جمبري طازج كبير الحجم مقلي بالزبدة والثوم والليمون ومتبل بالبهارات الخاصة، يحسب السعر بالوزن الفعلي ويقدم مع الخبز والصلصات.","calories":"380 سعرة / حصة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1565680018434-b75b2e2a78e4?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_shrimp_portion","name":"حصة جمبري مقلي","nameEn":"Fried Shrimp Portion","categoryId":"fish","price":8000,"isWeighted":false,"ingredients":"حصة فردية من الجمبري الكبير المقلي بالزبدة والثوم والليمون، تقدم مع صلصة الثوم والخبز الحار.","calories":"320 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1565680018434-b75b2e2a78e4?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_fillet","name":"فيليه سمك مقلي","nameEn":"Crispy Fish Fillet","categoryId":"fish","price":6000,"isWeighted":false,"ingredients":"فيليه سمك طازج بانيه مقلي ذهبي مقرمش مع صلصة الطرطار والليمون والخبز الحار.","calories":"490 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80"},{"id":"fd_fish_calamari","name":"كاليماري مقلي","nameEn":"Fried Calamari","categoryId":"fish","price":7000,"isWeighted":false,"ingredients":"حلقات كاليماري طازجة بانيه مقلية ذهبية مقرمشة مع صلصة الطرطار ودقة الليمون الحامض.","calories":"410 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format&fit=crop&w=600&q=80"}];

function getDefaultRestaurantConfig(restId) {
  if (restId === 'haidouri') {
    return {
      name: "لحم بعجين حيدوري",
      nameEn: "Haidouri Lahm Bi Ajeen",
      tagline: "أشهى لحم بعجين وصفيحة بالفرن الحجري والعصائر الطبيعية",
      taglineEn: "Delicious Fresh Lahm Bi Ajeen & Meat Pies",
      currency: "د.ع",
      currencyEn: "IQD",
      phone: "+9647700000000",
      phone2: "",
      mapUrl: "",
      whatsappNumber: "+9647700000000",
      publishedUrl: "",
      allowDineInOrders: true,
      allowTakeawayOrders: true,
      takeawayPackageActive: true,
      planType: "pro",
      whatsappDirectOrderEnabled: false,
      whatsappLockReason: "للتواصل والطلب المباشر أو تفعيل الخدمات، يرجى الاتصال برقم الدعم الفني: 07702265652.",
      autoPrintKitchenTicket: true,
      printerPaperSize: "80mm",
      adminPin: "",
      wifiName: "Haidouri_WiFi",
      wifiPass: "haidouri2026",
      address: "العراق - نينوى",
      workingHours: "08:00 صباحاً - 11:00 مساءً",
      holidays: "مفتوح طوال أيام الأسبوع",
      tablesCount: 15,
      taxRate: 0,
      serviceCharge: 0,
      theme: "luxury",
      lang: "ar",
      logo: "logo.svg"
    };
  }
  return typeof DEFAULT_RESTAURANT_CONFIG !== 'undefined' ? DEFAULT_RESTAURANT_CONFIG : {};
}

// استرجاع أو حفظ البيانات في LocalStorage مع عزل كامل لكل مطعم (Multi-Tenant Scoped Storage)
function getScopedStorageKey(key) {
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  const globalKeys = [
    'supabase_url',
    'supabase_anon_key',
    'master_pin',
    'super_assistants',
    'master_auth'
  ];
  if (globalKeys.includes(key)) {
    return 'smart_emenu_' + key;
  }
  return 'smart_emenu_' + restId + '_' + key;
}

function getStoredData(key, fallback) {
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  try {
    const scopedKey = getScopedStorageKey(key);
    let item = localStorage.getItem(scopedKey);
    // ترحيل البيانات القديمة حصراً لمطعم فحمة ودخان إن لم تكن موجودة بالمفتاح الجديد
    if (item === null || item === undefined) {
      if (restId === 'fahma_dokhan') {
        item = localStorage.getItem('smart_emenu_' + key);
      }
    }
    if (item !== null && item !== undefined) {
      const parsed = JSON.parse(item);
      if (parsed !== null && parsed !== undefined) return parsed;
    }
  } catch (e) {
    console.error("Storage error:", e);
  }

  // إذا لم توجد بيانات، تخصيص القيمة الافتراضية المناسبة لكل مطعم
  if (key === 'config') {
    return getDefaultRestaurantConfig(restId);
  }
  if (key === 'dishes') {
    return (fallback !== undefined && fallback !== null) ? fallback : DEFAULT_DISHES;
  }
  if (key === 'categories') {
    return restId === 'fahma_dokhan' ? (fallback || DEFAULT_CATEGORIES) : [{ id: "all", name: "الكل", nameEn: "All", icon: "🍽️" }];
  }
  return fallback;
}

function setStoredData(key, data) {
  try {
    const scopedKey = getScopedStorageKey(key);
    localStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

// -------------------------------------------------------------
// دالة التعرف الذكي التلقائي على أطباق الأسماك والأصناف المباعة بالوزن/الكيلوغرام
// -------------------------------------------------------------
function isDishWeighted(dish) {
  if (!dish) return false;
  if (dish.isWeighted === true || dish.pricingType === 'per_kg') return true;
  const cat = (dish.categoryId || dish.category || dish.category_id || '').toLowerCase();
  if (cat === 'fish' || cat === 'cat_fish' || cat.includes('fish')) return true;
  const t = ((dish.name || '') + ' ' + (dish.description || '') + ' ' + (dish.ingredients || '')).toLowerCase();
  return /سمك|مسكوف|سبريم|كطان|شبوط|بني|سلمون|سالمون|زبيدي|هامور|وزن|يوزن|بالكيلو|كيلوغرام|كغم/i.test(t);
}
window.isDishWeighted = isDishWeighted;

function migrateFishDishesToWeighted() {
  try {
    const dishes = getStoredData('dishes', DEFAULT_DISHES);
    let changed = false;
    dishes.forEach(d => {
      if (isDishWeighted(d)) {
        if (d.isWeighted !== true || d.pricingType !== 'per_kg') {
          d.isWeighted = true;
          d.pricingType = 'per_kg';
          d.unitPrice = Number(d.price) || Number(d.unitPrice) || 0;
          d.pricePerKg = d.unitPrice;
          changed = true;
        }
      }
    });
    if (changed) {
      setStoredData('dishes', dishes);
      console.log("✅ All fish dishes migrated to weighted (per_kg) successfully.");
    }
  } catch (e) {
    console.warn("Fish migration notice:", e);
  }
}
window.migrateFishDishesToWeighted = migrateFishDishesToWeighted;
// تشغيل الترقية التلقائية فوراً
try { migrateFishDishesToWeighted(); } catch(e) {}

/* === auth.js === */
/**
 * Smart E-Menu - Supabase Cloud Authentication & User Management
 * إدارة تسجيل الدخول والمستخدمين السحابية عبر Supabase مع دعم تعدد المطاعم
 */

const DEFAULT_AUTH_CONFIG = {
  admin: {
    id: "u_admin_1",
    username: "admin",
    pin: "",
    name: "المدير العام (مطعم فحمة ودخان)",
    role: "admin",
    active: true
  },
  cashiers: [
    { id: "u_cashier_1", username: "cashier", name: "كاشير الصندوق الرئيسي", pin: "", role: "cashier", active: true }
  ],
  captains: [
    { id: "u_cap_1", username: "captain", name: "كابتن الصالة", pin: "", role: "captain", active: true }
  ]
};

// -------------------------------------------------------------
// 1. تعقيم وتنظيف المدخلات (XSS Protection)
// -------------------------------------------------------------
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// -------------------------------------------------------------
// 2. نظام الحظر ضد التخمين (Brute-Force Rate Limiter)
// -------------------------------------------------------------
const ATTEMPTS_KEY = 'smart_emenu_auth_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 3 * 60 * 1000; // 3 دقائق

function getAuthAttempts() {
  try {
    const data = localStorage.getItem(ATTEMPTS_KEY);
    return data ? JSON.parse(data) : { count: 0, lockedUntil: 0 };
  } catch (e) {
    return { count: 0, lockedUntil: 0 };
  }
}

function checkLockout() {
  const attempts = getAuthAttempts();
  const now = Date.now();
  if (attempts.lockedUntil > now) {
    const remainingSecs = Math.ceil((attempts.lockedUntil - now) / 1000);
    return {
      locked: true,
      remainingSecs,
      message: `تم حظر المحاولات مؤقتاً لحماية النظام! يرجى الانتظار (${remainingSecs} ثانية) للمحاولة مجدداً.`
    };
  }
  return { locked: false };
}

function recordFailedAttempt() {
  const attempts = getAuthAttempts();
  attempts.count = (attempts.count || 0) + 1;
  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    attempts.count = 0;
  }
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  return attempts;
}

function resetFailedAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
}

// -------------------------------------------------------------
// 3. جلب وحفظ بيانات المستخدمين مع مطابقة سوبابيس وتطهير الذاكرة المحلية
// -------------------------------------------------------------
function getAuthConfig() {
  let data = getStoredData('auth_config', null);
  
  const isOldDummyData = data && (
    (Array.isArray(data.cashiers) && data.cashiers.some(c => c.username === 'cash' || c.pin === '20202020')) ||
    (Array.isArray(data.captains) && data.captains.some(c => ['ahmed', 'ali', 'mustafa'].includes(c.username) || ['11112222', '22223333', '33334444'].includes(c.pin)))
  );

  if (!data || isOldDummyData) {
    data = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG));
    setStoredData('auth_config', data);
    try {
      localStorage.setItem('smart_emenu_fahma_dokhan_auth_config', JSON.stringify(data));
      localStorage.setItem('smart_emenu_auth_config', JSON.stringify(data));
    } catch(e) {}
  }

  if (!data.cashiers || data.cashiers.length === 0) {
    data.cashiers = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG.cashiers));
  }
  if (!data.captains || data.captains.length === 0) {
    data.captains = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG.captains));
  }
  return data;
}

function saveAuthConfig(config) {
  setStoredData('auth_config', config);
  try {
    localStorage.setItem('smart_emenu_fahma_dokhan_auth_config', JSON.stringify(config));
    localStorage.setItem('smart_emenu_auth_config', JSON.stringify(config));
  } catch(e) {}
}

// جلب المستخدمين السحابيين من Supabase
async function fetchUsersFromSupabase() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (!client) return getAuthConfig();

  try {
    const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
    const { data, error } = await client
      .from('restaurant_users')
      .select('*')
      .eq('restaurant_id', restId);

    if (error || !data || data.length === 0) {
      return getAuthConfig();
    }

    const authConfig = {
      admin: { id: "u_admin_1", username: "admin", pin: "", name: "المدير العام", role: "admin", active: true },
      cashiers: [],
      captains: []
    };

    data.forEach(user => {
      const userObj = {
        id: user.id,
        username: user.username,
        pin: user.pin,
        name: user.full_name,
        role: user.role,
        active: user.active !== false
      };

      if (user.role === 'admin') {
        authConfig.admin = userObj;
      } else if (user.role === 'cashier') {
        authConfig.cashiers.push(userObj);
      } else if (user.role === 'captain') {
        authConfig.captains.push(userObj);
      }
    });

    if (authConfig.cashiers.length === 0) {
      authConfig.cashiers = DEFAULT_AUTH_CONFIG.cashiers;
    }

    saveAuthConfig(authConfig);
    return authConfig;
  } catch (e) {
    return getAuthConfig();
  }
}

function saveUserSession(session, rememberMe = true) {
  if (window.AuthCore && typeof window.AuthCore.saveSession === 'function') {
    window.AuthCore.saveSession(session, rememberMe);
  }
  const restId = (session && session.restaurantId) ? session.restaurantId.toLowerCase() : (typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan');
  try {
    const sStr = JSON.stringify(session);
    sessionStorage.setItem('smart_emenu_' + restId + '_session', sStr);
    sessionStorage.setItem('smart_emenu_session', sStr);
    sessionStorage.setItem('smart_emenu_restaurant_id', restId);
    // حفظ دائم ومستقر في localStorage لضمان عدم ضياع الجلسة عند التنقل بين الصفحات والتبويبات
    localStorage.setItem('smart_emenu_' + restId + '_session', sStr);
    localStorage.setItem('smart_emenu_session', sStr);
    localStorage.setItem('smart_emenu_restaurant_id', restId);
  } catch(e) {}
}

// -------------------------------------------------------------
// 4. تسجيل دخول الأدمن
// -------------------------------------------------------------
async function loginAdminAsync(pin, username = 'admin', rememberMe = true) {
  return loginUserAsync(username, pin, rememberMe);
}

// -------------------------------------------------------------
// 4. تسجيل دخول موحد وغير فاضح (Unified Flexible Discrete Login)
// -------------------------------------------------------------
async function loginUserAsync(username, password, rememberMe = true) {
  if (window.AuthCore && typeof window.AuthCore.loginUserAsync === 'function') {
    return await window.AuthCore.loginUserAsync(username, password, rememberMe);
  }
  if (!username || !username.trim()) {
    return { success: false, message: 'يرجى إدخال اسم المستخدم!' };
  }
  if (!password || password.trim().length < 4) {
    return { success: false, message: 'يرجى إدخال كلمة المرور (4 خانات على الأقل)!' };
  }

  const uName = username.trim().toLowerCase();
  const pwd = password.trim();

  const lockout = checkLockout();
  if (lockout.locked) return { success: false, message: lockout.message };

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;

  // 1. الفحص والتحقق من سحابة Supabase الحية
  if (client) {
    try {
      let { data, error } = await client
        .from('restaurant_users')
        .select('*')
        .eq('restaurant_id', restId);

      // إذا لم يجد مستخدمين للمطعم المحدد، نجلب مستخدمي مطعم fahma_dokhan
      if ((error || !data || data.length === 0) && restId !== 'fahma_dokhan') {
        const retry = await client
          .from('restaurant_users')
          .select('*')
          .eq('restaurant_id', 'fahma_dokhan');
        if (!retry.error && retry.data && retry.data.length > 0) {
          data = retry.data;
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        // تحديث وتزامن الـ cache المحلي بالبيانات الحية
        const authConfig = {
          admin: { id: "u_admin_1", username: "admin", pin: "", name: "المدير العام", role: "admin", active: true },
          cashiers: [],
          captains: []
        };

        data.forEach(user => {
          const userObj = {
            id: user.id,
            username: user.username,
            pin: user.pin,
            name: user.full_name,
            role: user.role,
            active: user.active !== false
          };
          if (user.role === 'admin') authConfig.admin = userObj;
          else if (user.role === 'cashier') authConfig.cashiers.push(userObj);
          else if (user.role === 'captain') authConfig.captains.push(userObj);
        });
        saveAuthConfig(authConfig);

        // البحث المرن عن المستخدم بجميع الرتب والأسماء
        const matched = data.find(u => 
          (u.username && u.username.toLowerCase() === uName) || 
          (u.full_name && u.full_name.toLowerCase() === uName) || 
          (u.id && u.id.toLowerCase() === uName) ||
          (uName === 'admin' && u.role === 'admin') ||
          (uName === 'مدير' && u.role === 'admin') ||
          (uName === 'المدير' && u.role === 'admin') ||
          (uName === 'cashier' && u.role === 'cashier') ||
          (uName === 'كاشير' && u.role === 'cashier') ||
          (uName === 'الكاشير' && u.role === 'cashier')
        );

        if (matched) {
          if (matched.active === false) {
            return { success: false, message: 'هذا الحساب معطل حالياً من قبل الإدارة.' };
          }

          // مطابقة كلمة المرور الصارمة مع المسجل في قاعدة البيانات سحابياً
          const pinMatch = (matched.pin && matched.pin.trim() === pwd);

          if (pinMatch) {
            resetFailedAttempts();
            const session = {
              role: matched.role,
              userId: matched.id,
              captainId: matched.role === 'captain' ? matched.id : null,
              name: matched.full_name,
              username: matched.username,
              restaurantId: matched.restaurant_id || restId,
              loginTime: Date.now(),
              rememberMe: true,
              token: `${matched.role.substring(0,3)}_${generateSecureToken()}`
            };
            saveUserSession(session, true);
            return { success: true, session, role: matched.role, restaurantId: matched.restaurant_id || restId };
          } else {
            recordFailedAttempt();
            return { success: false, message: 'كلمة المرور غير صحيحة!' };
          }
        }
      }
    } catch (e) {
      console.warn("Supabase live auth network issue:", e);
    }
  }

  // 2. الفحص المحلي في حال انقطاع السحابة أو عدم العثور على المستخدم
  const localConfig = getAuthConfig();
  
  // فحص الأدمن
  if (localConfig.admin) {
    const adm = localConfig.admin;
    if (((adm.username && adm.username.toLowerCase() === uName) ||
         (adm.name && adm.name.toLowerCase() === uName) ||
         uName === 'admin' || uName === 'المدير' || uName === 'مدير') &&
        (adm.pin && adm.pin.trim() === pwd)) {
      resetFailedAttempts();
      const session = {
        role: 'admin',
        userId: adm.id || 'u_admin_1',
        name: adm.name || 'المدير العام',
        username: adm.username || 'admin',
        restaurantId: restId,
        loginTime: Date.now(),
        rememberMe: true,
        token: 'adm_' + generateSecureToken()
      };
      saveUserSession(session, true);
      return { success: true, session, role: 'admin', restaurantId: restId };
    }
  }

  // فحص الكاشير
  if (localConfig.cashiers && Array.isArray(localConfig.cashiers)) {
    const csh = localConfig.cashiers.find(c => 
      ((c.username && c.username.toLowerCase() === uName) || 
       (c.name && c.name.toLowerCase() === uName) || 
       (c.id && c.id.toLowerCase() === uName) ||
       (uName === 'cashier' || uName === 'كاشير' || uName === 'الكاشير')) &&
      (c.pin && c.pin.trim() === pwd)
    );
    if (csh) {
      if (csh.active === false) return { success: false, message: 'هذا الحساب معطل حالياً.' };
      resetFailedAttempts();
      const session = {
        role: 'cashier',
        userId: csh.id || 'u_cashier_1',
        name: csh.name || 'كاشير الصندوق الرئيسي',
        username: csh.username || 'cashier',
        restaurantId: restId,
        loginTime: Date.now(),
        rememberMe: true,
        token: 'csh_' + generateSecureToken()
      };
      saveUserSession(session, true);
      return { success: true, session, role: 'cashier', restaurantId: restId };
    }
  }

  // فحص الكباتن
  if (localConfig.captains && Array.isArray(localConfig.captains)) {
    const cap = localConfig.captains.find(c => 
      ((c.username && c.username.toLowerCase() === uName) || 
       (c.name && c.name.toLowerCase() === uName) || 
       (c.id && c.id.toLowerCase() === uName) ||
       (uName === 'captain' || uName === 'كابتن')) &&
      (c.pin && c.pin.trim() === pwd)
    );
    if (cap) {
      if (cap.active === false) return { success: false, message: 'هذا الحساب معطل حالياً.' };
      resetFailedAttempts();
      const session = {
        role: 'captain',
        userId: cap.id,
        captainId: cap.id,
        name: cap.name,
        username: cap.username || cap.name,
        restaurantId: restId,
        loginTime: Date.now(),
        rememberMe: true,
        token: 'cap_' + generateSecureToken()
      };
      saveUserSession(session, true);
      return { success: true, session, role: 'captain', restaurantId: restId };
    }
  }

  // فحص السوبر أدمن المعتمد عبر السحابة وجلسات النظام الموحدة
  if ((uName === 'super_admin' || uName === 'superadmin') && window.AuthCore && typeof window.AuthCore.loginUserAsync === 'function') {
    try {
      const authRes = await window.AuthCore.loginUserAsync(uName, pwd, true);
      if (authRes && authRes.success && authRes.role === 'super_admin') {
        resetFailedAttempts();
        return { success: true, session: authRes.session, role: 'super_admin', restaurantId: restId };
      }
    } catch(e) {}
  }

  recordFailedAttempt();
  return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' };
}

// -------------------------------------------------------------
// 5. دوال تسجيل الدخول التوافقية
// -------------------------------------------------------------
async function loginCashierAsync(pin, username = 'cashier', rememberMe = true) {
  return loginUserAsync(username, pin, rememberMe);
}

// -------------------------------------------------------------
// 6. تسجيل دخول الكابتن عبر المعرف السريع
// -------------------------------------------------------------
async function loginCaptainByIdAsync(captainId, pin, rememberMe = true) {
  const lockout = checkLockout();
  if (lockout.locked) return { success: false, message: lockout.message };

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;

  if (client) {
    try {
      const { data, error } = await client
        .from('restaurant_users')
        .select('*')
        .eq('id', captainId)
        .limit(1);

      if (!error && data && data.length > 0) {
        const cap = data[0];
        if (!cap.active) {
          return { success: false, message: 'هذا الحساب معطل حالياً من قبل الإدارة.' };
        }
        if (cap.pin.trim() !== pin.trim()) {
          recordFailedAttempt();
          return { success: false, message: 'رمز المرور غير صحيح!' };
        }

        resetFailedAttempts();
        const session = {
          role: 'captain',
          userId: cap.id,
          captainId: cap.id,
          name: cap.full_name,
          username: cap.username || cap.full_name,
          restaurantId: cap.restaurant_id || restId,
          loginTime: Date.now(),
          rememberMe: !!rememberMe,
          token: 'cap_' + generateSecureToken()
        };
        saveUserSession(session, rememberMe);
        return { success: true, session };
      }
    } catch (e) {}
  }

  // الفحص المحلي في حال انقطاع النت
  const localConfig = getAuthConfig();
  const captain = localConfig.captains.find(c => c.id === captainId);
  if (!captain) return { success: false, message: 'لم يتم العثور على حساب الكابتن!' };
  if (!captain.active) return { success: false, message: 'هذا الحساب معطل حالياً.' };
  if (captain.pin.trim() !== pin.trim()) {
    recordFailedAttempt();
    return { success: false, message: 'رمز المرور غير صحيح!' };
  }

  resetFailedAttempts();
  const session = {
    role: 'captain',
    userId: captain.id,
    captainId: captain.id,
    name: captain.name,
    username: captain.username || captain.name,
    restaurantId: restId,
    loginTime: Date.now(),
    rememberMe: !!rememberMe,
    token: 'cap_' + generateSecureToken()
  };
  saveUserSession(session, rememberMe);
  return { success: true, session };
}

// -------------------------------------------------------------
// 7. تغيير رمز PIN للأدمن في Supabase
// -------------------------------------------------------------
async function changeAdminPinAsync(newPin) {
  if (!newPin || newPin.trim().length < 8) {
    return { success: false, message: 'يجب أن يتكون الرمز السري الجديد من 8 أحرف أو أرقام على الأقل لتعزيز الأمان!' };
  }

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;

  if (client) {
    try {
      await client
        .from('restaurant_users')
        .update({ pin: newPin.trim(), updated_at: new Date().toISOString() })
        .eq('restaurant_id', restId)
        .eq('role', 'admin');
    } catch (e) {
      console.warn("Supabase update error:", e);
    }
  }

  // تحديث محلي
  const config = getAuthConfig();
  config.admin.pin = newPin.trim();
  saveAuthConfig(config);

  const restConfig = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  restConfig.adminPin = newPin.trim();
  setStoredData('config', restConfig);

  return { success: true };
}

// -------------------------------------------------------------
// 8. إضافة وتعديل وحذف الموظفين (الكاشير والكباتن) في Supabase والمحلي
// -------------------------------------------------------------
async function addStaffUserAsync(name, username, pin, role = 'captain') {
  const cleanName = name ? name.trim() : '';
  if (!cleanName) return { success: false, message: 'يرجى إدخال اسم صحيح للموظف!' };
  if (!pin || pin.trim().length < 8) return { success: false, message: 'يجب أن يتكون رمز المرور من 8 خانات على الأقل!' };

  const finalUsername = username && username.trim() 
    ? username.trim().toLowerCase() 
    : (role === 'cashier' ? 'cashier_' + Math.floor(100 + Math.random() * 900) : 'cap_' + Math.floor(100 + Math.random() * 900));

  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  const newId = (role === 'cashier' ? 'u_csh_' : 'u_cap_') + Date.now();
  
  const newUser = {
    id: newId,
    restaurant_id: restId,
    username: finalUsername,
    pin: pin.trim(),
    full_name: cleanName,
    role: role,
    active: true
  };

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      await client.from('restaurant_users').insert([newUser]);
    } catch (e) {
      console.warn("Supabase insert error:", e);
    }
  }

  const local = getAuthConfig();
  if (role === 'cashier') {
    if (!local.cashiers) local.cashiers = [];
    local.cashiers.push({
      id: newId,
      username: finalUsername,
      name: cleanName,
      pin: pin.trim(),
      role: 'cashier',
      active: true
    });
  } else {
    if (!local.captains) local.captains = [];
    local.captains.push({
      id: newId,
      username: finalUsername,
      name: cleanName,
      pin: pin.trim(),
      role: 'captain',
      active: true
    });
  }
  saveAuthConfig(local);

  return { success: true, user: newUser };
}

async function updateStaffUserAsync(id, { name, username, pin, role }) {
  if (!name || !name.trim()) return { success: false, message: 'يرجى إدخال اسم صحيح!' };
  if (pin && pin.trim().length < 8) return { success: false, message: 'يجب أن يتكون الرمز السري من 8 خانات على الأقل!' };

  const local = getAuthConfig();
  let found = null;
  let targetList = 'captains';

  if (local.cashiers && local.cashiers.some(c => c.id === id)) {
    found = local.cashiers.find(c => c.id === id);
    targetList = 'cashiers';
  } else if (local.captains && local.captains.some(c => c.id === id)) {
    found = local.captains.find(c => c.id === id);
    targetList = 'captains';
  }

  if (found) {
    found.name = name.trim();
    if (username) found.username = username.trim().toLowerCase();
    if (pin) found.pin = pin.trim();
    if (role) found.role = role;
    saveAuthConfig(local);
  }

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      const updateData = { full_name: name.trim(), updated_at: new Date().toISOString() };
      if (username) updateData.username = username.trim().toLowerCase();
      if (pin) updateData.pin = pin.trim();
      if (role) updateData.role = role;
      await client.from('restaurant_users').update(updateData).eq('id', id);
    } catch (e) {}
  }

  return { success: true };
}

async function toggleStaffUserActiveAsync(id, role = 'captain') {
  const local = getAuthConfig();
  let item = null;

  if (local.cashiers && local.cashiers.some(c => c.id === id)) {
    item = local.cashiers.find(c => c.id === id);
  } else if (local.captains && local.captains.some(c => c.id === id)) {
    item = local.captains.find(c => c.id === id);
  }

  if (!item) return { success: false };

  item.active = !item.active;
  const newState = item.active;
  saveAuthConfig(local);

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      await client
        .from('restaurant_users')
        .update({ active: newState, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (e) {}
  }

  return { success: true, newState };
}

async function deleteStaffUserAsync(id) {
  const local = getAuthConfig();
  if (local.cashiers) {
    local.cashiers = local.cashiers.filter(c => c.id !== id);
  }
  if (local.captains) {
    local.captains = local.captains.filter(c => c.id !== id);
  }
  saveAuthConfig(local);

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      await client.from('restaurant_users').delete().eq('id', id);
    } catch (e) {}
  }

  return { success: true };
}

// دوال التوافق القديمة
async function addCaptainAsync(name, pin) {
  return addStaffUserAsync(name, '', pin, 'captain');
}

async function toggleCaptainActiveStateAsync(id) {
  return toggleStaffUserActiveAsync(id, 'captain');
}

async function deleteCaptainAsync(id) {
  return deleteStaffUserAsync(id);
}

// -------------------------------------------------------------
// دوال مساعدة للجلسات وتوليد التوكن
// -------------------------------------------------------------
function generateSecureToken() {
  const array = new Uint32Array(4);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(36)).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getCurrentSession() {
  if (window.AuthCore && typeof window.AuthCore.getCurrentSession === 'function') {
    return window.AuthCore.getCurrentSession();
  }
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  try {
    let sessionStr = sessionStorage.getItem('smart_emenu_' + restId + '_session') 
                  || sessionStorage.getItem('smart_emenu_session')
                  || localStorage.getItem('smart_emenu_' + restId + '_session')
                  || localStorage.getItem('smart_emenu_session');

    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);

    if (session && session.role) {
      // الاحتفاظ بتسجيل الدخول لمدة 30 يوماً
      if (session.loginTime && (Date.now() - session.loginTime > 30 * 24 * 60 * 60 * 1000)) {
        logoutSession(null);
        return null;
      }
      return session;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function logoutSession(redirectUrl = 'login.html?role=cashier') {
  if (window.AuthCore && typeof window.AuthCore.logoutSession === 'function') {
    return window.AuthCore.logoutSession(redirectUrl);
  }
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  try {
    sessionStorage.removeItem('smart_emenu_' + restId + '_session');
    sessionStorage.removeItem('smart_emenu_session');
    localStorage.removeItem('smart_emenu_' + restId + '_session');
    localStorage.removeItem('smart_emenu_session');
  } catch (e) {}
  if (redirectUrl) {
    const restParam = restId ? `?rest=${encodeURIComponent(restId)}` : '';
    const cleanUrl = redirectUrl.includes('?') ? redirectUrl : (redirectUrl + restParam);
    window.location.href = cleanUrl;
  }
}

function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (btnEl) btnEl.textContent = "🔓";
  } else {
    input.type = "password";
    if (btnEl) btnEl.textContent = "👁️";
  }
}

/* === db.js === */
/**
 * Smart E-Menu - Database, Backup & Data Migration Module
 * نظام حفظ وتصدير واسترجاع البيانات لمنع فقدان البيانات عند التحديث
 */

const DB_VERSION = "2.1.0";

// سحب نسخة احتياطية لمعلومات وهوية المطعم فقط (بدون الأفراد وحساباتهم وبدون المنيو)
function exportFullDatabaseBackup() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  
  // استخراج وتطهير معلومات وهوية المطعم فقط بدون أي حسابات أو أرقام سرية للموظفين
  const cleanConfig = {
    id: (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan',
    name: config.name || '',
    nameEn: config.nameEn || '',
    tagline: config.tagline || '',
    taglineEn: config.taglineEn || '',
    currency: config.currency || 'د.ع',
    currencyEn: config.currencyEn || 'IQD',
    phone: config.phone || '',
    phone2: config.phone2 || '',
    mapUrl: config.mapUrl || '',
    whatsappNumber: config.whatsappNumber || '',
    publishedUrl: config.publishedUrl || '',
    address: config.address || '',
    workingHours: config.workingHours || '',
    holidays: config.holidays || '',
    tablesCount: config.tablesCount || 20,
    theme: config.theme || 'luxury',
    lang: config.lang || 'ar',
    logo: config.logo || 'logo.svg',
    allowDineInOrders: config.allowDineInOrders !== false,
    allowTakeawayOrders: config.allowTakeawayOrders !== false,
    takeawayPackageActive: config.takeawayPackageActive !== false
  };

  const backupData = {
    app: "Smart E-Menu",
    type: "restaurant_info_only",
    note: "نسخة احتياطية لمعلومات وهوية المطعم فقط (بدون الأفراد وحساباتهم وبدون المنيو أو الأصناف)",
    exportDate: new Date().toISOString(),
    restaurantName: cleanConfig.name,
    restaurant_info: cleanConfig,
    restaurant: cleanConfig
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const filename = `restaurant_info_${cleanConfig.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename };
}

// استيراد واسترجاع معلومات المطعم و/أو المنيو من ملف JSON
function importDatabaseBackup(file, callback) {
  if (!file) {
    if (callback) callback({ success: false, message: "لم يتم تحديد أي ملف!" });
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      let restoredItems = [];

      // 1. استرجاع معلومات المطعم إذا كانت موجودة في الملف
      const info = backup.restaurant_info || backup.restaurant || (backup.data && backup.data.config);
      if (info && (info.name || info.id)) {
        const currentConfig = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
        const mergedConfig = {
          ...currentConfig,
          name: info.name || currentConfig.name,
          nameEn: info.nameEn || info.name_en || currentConfig.nameEn,
          tagline: info.tagline || currentConfig.tagline,
          taglineEn: info.taglineEn || info.tagline_en || currentConfig.taglineEn,
          currency: info.currency || currentConfig.currency,
          currencyEn: info.currencyEn || info.currency_en || currentConfig.currencyEn,
          phone: info.phone || currentConfig.phone,
          phone2: info.phone2 || currentConfig.phone2,
          mapUrl: info.mapUrl || info.map_url || currentConfig.mapUrl,
          whatsappNumber: info.whatsappNumber || info.whatsapp_number || currentConfig.whatsappNumber,
          publishedUrl: info.publishedUrl || info.published_url || currentConfig.publishedUrl,
          address: info.address || currentConfig.address,
          workingHours: info.workingHours || info.working_hours || currentConfig.workingHours,
          holidays: info.holidays || currentConfig.holidays,
          tablesCount: info.tablesCount || info.tables_count || currentConfig.tablesCount,
          logo: info.logo || currentConfig.logo,
          theme: info.theme || currentConfig.theme,
          lang: info.lang || currentConfig.lang
        };
        setStoredData('config', mergedConfig);
        restoredItems.push("معلومات وهوية المطعم");
      }

      // 2. استرجاع قائمة الطعام (الأطباق والأقسام) إذا كانت موجودة في الملف
      const dishes = backup.dishes || (backup.data && backup.data.dishes);
      const categories = backup.categories || (backup.data && backup.data.categories);
      if (dishes && Array.isArray(dishes) && dishes.length > 0) {
        setStoredData('dishes', dishes);
        if (categories && Array.isArray(categories)) {
          setStoredData('categories', categories);
        }
        restoredItems.push(`قائمة الطعام (${dishes.length} طبق)`);
      }

      if (restoredItems.length === 0) {
        throw new Error("الملف لا يحتوي على بيانات مطعم أو منيو صالحة!");
      }

      window.dispatchEvent(new Event('storage'));

      if (callback) callback({ 
        success: true, 
        message: `تمت استعادة البيانات بنجاح: [ ${restoredItems.join(' + ')} ] بدون المساس بحسابات الأفراد! ✅` 
      });
    } catch (err) {
      if (callback) callback({ success: false, message: "خطأ في قراءة الملف: " + err.message });
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// سحب وتحميل قائمة الطعام (المنيو والأقسام) بصيغة JSON
// -------------------------------------------------------------
function exportMenuDishesBackup() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const dishes = getStoredData('dishes', DEFAULT_DISHES);

  const menuPackage = {
    app: "Smart E-Menu",
    type: "menu_dishes_only",
    note: "نسخة احتياطية لقائمة طعام المطعم (الأقسام، الأطباق، الأسعار، المكونات، الصور)",
    exportDate: new Date().toISOString(),
    restaurantName: config.name || "مطعم فحمة ودخان",
    currency: config.currency || "د.ع",
    totalCategories: (categories || []).length,
    totalDishes: (dishes || []).length,
    categories: categories || [],
    dishes: dishes || []
  };

  const jsonStr = JSON.stringify(menuPackage, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const filename = `menu_dishes_${(config.name || 'restaurant').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename, count: (dishes || []).length };
}

// -------------------------------------------------------------
// تصدير قائمة الطعام كملف إكسل / CSV (يدعم اللغة العربية في Excel)
// -------------------------------------------------------------
function exportMenuDishesCSV() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const dishes = getStoredData('dishes', DEFAULT_DISHES);

  const catMap = {};
  (categories || []).forEach(c => { catMap[c.id] = c.name; });

  let csv = "\uFEFF"; // UTF-8 BOM for Arabic in Excel
  csv += `قائمة طعام,${config.name || 'المطعم'},تاريخ الاستخراج,${new Date().toLocaleDateString('ar-EG')}\n`;
  csv += `رقم الصنف,اسم الطبق,الاسم بالإنجليزية,القسم,السعر (${config.currency || 'د.ع'}),السعرات,المكونات,الحالة\n`;

  (dishes || []).forEach(d => {
    const catName = catMap[d.categoryId] || d.categoryId || 'عام';
    const cleanName = (d.name || '').replace(/,/g, ' - ');
    const cleanEn = (d.nameEn || '').replace(/,/g, ' - ');
    const cleanIng = (d.ingredients || '').replace(/,/g, ' - ').replace(/\n/g, ' ');
    const status = d.available !== false ? 'متوفر' : 'غير متوفر';
    csv += `"${d.id}","${cleanName}","${cleanEn}","${catName}","${d.price || 0}","${d.calories || ''}","${cleanIng}","${status}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `menu_excel_${(config.name || 'restaurant').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename, count: (dishes || []).length };
}

// -------------------------------------------------------------
// استيراد واسترجاع قائمة الطعام من ملف JSON
// -------------------------------------------------------------
function importMenuDishesBackup(file, callback) {
  if (!file) {
    if (callback) callback({ success: false, message: "لم يتم تحديد أي ملف!" });
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      const dishes = backup.dishes || (backup.data && backup.data.dishes);
      const categories = backup.categories || (backup.data && backup.data.categories);

      if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
        throw new Error("الملف لا يحتوي على أصناف طعام صالحة!");
      }

      setStoredData('dishes', dishes);
      if (categories && Array.isArray(categories) && categories.length > 0) {
        setStoredData('categories', categories);
      }

      window.dispatchEvent(new Event('storage'));

      if (callback) callback({
        success: true,
        message: `تم استيراد واسترجاع قائمة الطعام بنجاح (${dishes.length} طبق)! 🎉`
      });
    } catch (err) {
      if (callback) callback({ success: false, message: "خطأ في قراءة ملف المنيو: " + err.message });
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// سحب شامل لمعلومات المطعم والمنيو معاً (بدون أي أفراد أو حسابات)
// -------------------------------------------------------------
function exportRestaurantAndMenuBackup() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const dishes = getStoredData('dishes', DEFAULT_DISHES);

  const cleanConfig = {
    id: (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan',
    name: config.name || '',
    nameEn: config.nameEn || '',
    tagline: config.tagline || '',
    taglineEn: config.taglineEn || '',
    currency: config.currency || 'د.ع',
    currencyEn: config.currencyEn || 'IQD',
    phone: config.phone || '',
    phone2: config.phone2 || '',
    mapUrl: config.mapUrl || '',
    whatsappNumber: config.whatsappNumber || '',
    publishedUrl: config.publishedUrl || '',
    address: config.address || '',
    workingHours: config.workingHours || '',
    holidays: config.holidays || '',
    tablesCount: config.tablesCount || 20,
    theme: config.theme || 'luxury',
    lang: config.lang || 'ar',
    logo: config.logo || 'logo.svg',
    allowDineInOrders: config.allowDineInOrders !== false,
    allowTakeawayOrders: config.allowTakeawayOrders !== false,
    takeawayPackageActive: config.takeawayPackageActive !== false
  };

  const backupData = {
    app: "Smart E-Menu",
    type: "restaurant_and_menu_backup",
    note: "نسخة احتياطية شاملة لمعلومات المطعم وقائمة الطعام (خالية تماماً من حسابات الأفراد أو كلمات المرور)",
    exportDate: new Date().toISOString(),
    restaurantName: cleanConfig.name,
    restaurant_info: cleanConfig,
    categories: categories || [],
    dishes: dishes || []
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const filename = `full_menu_${cleanConfig.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename, count: (dishes || []).length };
}

// -------------------------------------------------------------
// دوال استدعاء التصدير والاستيراد للمنيو من واجهة المستخدم
// -------------------------------------------------------------
function triggerMenuExport() {
  const res = exportMenuDishesBackup();
  if (res.success) {
    alert(`✅ تم تحميل وتنزيل قائمة الطعام كاملة (${res.count} طبق) بنجاح!\nاسم الملف: ${res.filename}`);
  }
}

function triggerMenuExportCSV() {
  const res = exportMenuDishesCSV();
  if (res.success) {
    alert(`✅ تم تصدير قائمة الطعام كملف إكسل (${res.filename}) بنجاح!\nيمكنك فتحه في برنامج Excel مباشرة.`);
  }
}

function triggerMenuImport() {
  const fileInput = document.getElementById('menu-import-file-input');
  if (!fileInput || !fileInput.files[0]) return;
  if (confirm("سيتم استرجاع وتحديث قائمة أطباق المنيو من الملف. هل تود المتابعة؟")) {
    importMenuDishesBackup(fileInput.files[0], (res) => {
      alert(res.message);
      if (res.success) location.reload();
    });
  }
}

function triggerCombinedExport() {
  const res = exportRestaurantAndMenuBackup();
  if (res.success) {
    alert(`✅ تم تنزيل النسخة الشاملة (المطعم + المنيو) بنجاح (${res.filename})!\nتحتوي على معلومات المطعم وقائمة الأطباق كاملة بدون أي حسابات للأفراد.`);
  }
}

// تهيئة وفحص البيانات عند إقلاع أي صفحة
function initDatabase() {
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  // تهيئة البيانات الافتراضية الأولية لمطعم فحمة ودخان فقط (المطعم الافتراضي)
  if (restId === 'fahma_dokhan') {
    const existingConfig = localStorage.getItem('smart_emenu_fahma_dokhan_config') || localStorage.getItem('smart_emenu_config');
    if (!existingConfig) {
      setStoredData('config', DEFAULT_RESTAURANT_CONFIG);
    }
    const existingCategories = localStorage.getItem('smart_emenu_fahma_dokhan_categories') || localStorage.getItem('smart_emenu_categories');
    if (!existingCategories) {
      setStoredData('categories', DEFAULT_CATEGORIES);
    }
    const existingDishes = localStorage.getItem('smart_emenu_fahma_dokhan_dishes') || localStorage.getItem('smart_emenu_dishes');
    if (!existingDishes || existingDishes === '[]' || existingDishes === 'null') {
      setStoredData('dishes', DEFAULT_DISHES);
    }
    const existingAuth = localStorage.getItem('smart_emenu_fahma_dokhan_auth_config') || localStorage.getItem('smart_emenu_auth_config');
    if (!existingAuth) {
      setStoredData('auth_config', DEFAULT_AUTH_CONFIG);
    }
  }
  const existingAuth = localStorage.getItem(getScopedStorageKey('auth_config')) || localStorage.getItem('smart_emenu_auth_config');
  if (existingAuth) {
    // تنظيف أسماء الكباتن وفصل رمز الكاشير عن رمز المدير
    try {
      const auth = JSON.parse(existingAuth);
      let changed = false;
      if (auth && auth.cashiers) {
        auth.cashiers.forEach(c => {
          if (c.pin === '20262026' || c.pin === '12341234') {
            c.pin = '';
            changed = true;
          }
        });
      }
      if (auth && auth.captains) {
        auth.captains.forEach(c => {
          const clean = c.name.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, '').trim();
          if (clean !== c.name) {
            c.name = clean;
            changed = true;
          }
        });
      }
      if (changed) {
        setStoredData('auth_config', auth);
      }
    } catch(e) {}
  }
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// نظام إعدادات الطابعة الحرارية وتخصيص نوع وحجم الورق
// -------------------------------------------------------------
// =============================================================
// نظام إعدادات الطابعة الحرارية وتخصيص الطابعتين (100 كاشير + 101 مطبخ)
// =============================================================
const DEFAULT_PRINT_SETTINGS = {
  paperSize: '80mm',      // '80mm' | '58mm'
  ticketType: 'customer', // 'kitchen' (طابعة 101) | 'customer' (طابعة 100) - منع الطباعة المزدوجة
  autoDirectPrint: true,
  silentPrint: true,      // طباعة صامتة فورية
  bridgeUrl: 'http://127.0.0.1:8080',

  // 1. طابعة الكاشير (فواتير وحساب الزبائن)
  cashierMode: 'ip',      // 'ip' | 'windows'
  cashierIp: '192.168.1.100',
  cashierPort: 9100,
  cashierPrinterName: '', // اسم طابعة ويندوز USB إذا تم اختيارها

  // 2. طابعة المطبخ (بونات التحضير والأطباق)
  kitchenMode: 'ip',
  kitchenIp: '192.168.1.101',
  kitchenPort: 9100,
  kitchenPrinterName: 'Generic / Text Only'
};

function getPrintSettings() {
  const current = getStoredData('print_settings', DEFAULT_PRINT_SETTINGS);
  if (!current.cashierIp) current.cashierIp = '192.168.1.100';
  if (!current.kitchenIp || current.kitchenIp === '192.168.1.100') current.kitchenIp = '192.168.1.101';
  if (!current.cashierPort) current.cashierPort = 9100;
  if (!current.kitchenPort) current.kitchenPort = 9100;
  if (!current.cashierMode) current.cashierMode = 'ip';
  return current;
}

function savePrintSettings(settings) {
  setStoredData('print_settings', settings);
}


function getKitchenTicketHtml(order, config, timeStr, dateStr, typeBadge, isSmallPaper = false) {
  let kitchenItemsHtml = '';

  (order.items || []).forEach(item => {
    const qtyDisplay = (item.isWeighted || item.weight) ? `${item.weight} كغم` : item.quantity;
    const nameDisplay = item.baseName || item.name;

    kitchenItemsHtml += `
      <tr style="border-bottom: 2px dashed #000;">
        <td style="width: 25%; text-align: center; vertical-align: middle; padding: 6px 2px;">
          <span style="display: inline-block; font-size: ${isSmallPaper ? '16px' : '20px'}; font-weight: 900; border: 2.5px solid #000; border-radius: 6px; padding: 2px 8px; min-width: 32px; background: #000; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">${qtyDisplay}</span>
        </td>
        <td style="width: 75%; vertical-align: middle; padding: 6px 4px;">
          <div style="font-weight: 900; font-size: ${isSmallPaper ? '14px' : '17px'}; line-height: 1.3;">${nameDisplay}</div>
          ${item.notes ? `<div style="font-size: ${isSmallPaper ? '11px' : '13px'}; color: #000; font-weight: 900; background: #eee; padding: 2px 4px; border-radius: 4px; margin-top: 2px;">👈 ملاحظة: ${item.notes}</div>` : ''}
        </td>
      </tr>
    `;
  });

  return `
    <div class="thermal-receipt kitchen-ticket" style="width: ${isSmallPaper ? '48mm' : '72mm'}; margin: 0 auto; color: #000; font-family: 'Cairo', monospace, sans-serif; line-height: 1.35;">
      <div class="ticket-header" style="text-align: center; padding-bottom: 6px; border-bottom: 2px solid #000;">
        <h2 style="font-size: ${isSmallPaper ? '18px' : '23px'}; font-weight: 900; margin: 0 0 2px 0;">${config.name}</h2>
        <div class="ticket-subtitle" style="font-size: ${isSmallPaper ? '13px' : '16px'}; font-weight: 900; margin-top: 2px;">👨‍🍳 بون تحضير المطبخ / KITCHEN</div>
        <div class="ticket-badge-box" style="margin-top: 4px; font-size: ${isSmallPaper ? '14px' : '17px'}; font-weight: 900; padding: 4px 6px; background: #000; color: #fff !important; border-radius: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          ${typeBadge}
        </div>
        ${(order.isPreorder || (order.notes && order.notes.includes('حجز مسبق لليوم التالي'))) ? `
          <div style="margin-top: 6px; padding: 6px; background: #000; color: #fff !important; font-weight: 900; font-size: ${isSmallPaper ? '12px' : '14px'}; border-radius: 6px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            📅 *** حجز مسبق لليوم التالي *** 📅<br>
            <span style="font-size: ${isSmallPaper ? '10px' : '12px'}; font-weight: bold;">موعد التجهيز: غداً (${order.preorderPreferredTime || 'مع بداية الافتتاح'})</span>
          </div>
        ` : ''}
      </div>

      <div class="ticket-info" style="font-size: ${isSmallPaper ? '11px' : '13px'}; padding: 6px 0; border-bottom: 2px solid #000;">
        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>رقم البون: <b style="font-size: ${isSmallPaper ? '14px' : '17px'}; font-family: monospace;">#${order.id}</b></span>
          <span>الوقت: <b style="font-size: ${isSmallPaper ? '12px' : '14px'};">${timeStr}</b></span>
        </div>
        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>التاريخ: <b>${dateStr}</b></span>
          <span>المرسل: <b>${order.captainName || 'كاشير المطعم'}</b></span>
        </div>

        ${order.customerInfo || order.customerName ? `
          <div class="customer-highlight" style="margin-top: 4px; font-size: ${isSmallPaper ? '13px' : '16px'}; font-weight: 900; border-top: 1px dashed #aaa; padding-top: 3px;">
            👤 الزبون: <b>${order.customerInfo || order.customerName}</b>
          </div>
        ` : ''}

        ${order.customerPhone ? `
          <!-- هاتف الزبون بارز ومكبر جداً -->
          <div style="margin: 6px 0; padding: 8px 10px; background: #000; color: #fff !important; border: 2px solid #000; border-radius: 8px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <div style="font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 800; margin-bottom: 2px;">📞 هاتف الزبون والتوصيل:</div>
            <div style="font-size: ${isSmallPaper ? '24px' : '30px'}; font-weight: 900; font-family: monospace; letter-spacing: 2px; direction: ltr;">${order.customerPhone}</div>
          </div>
        ` : ''}
      </div>

      <div class="ticket-items" style="margin-top: 6px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="width: 25%; text-align: center; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; padding: 4px 0;">العدد</th>
              <th style="width: 75%; text-align: right; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; padding: 4px;">الصنف والوجبة المطلوبة</th>
            </tr>
          </thead>
          <tbody>
            ${kitchenItemsHtml}
          </tbody>
        </table>
      </div>

      ${order.notes ? `
        <div class="ticket-kitchen-notes" style="font-size: ${isSmallPaper ? '12px' : '15px'}; border: 2px solid #000; padding: 6px; margin-top: 8px; font-weight: 900; background: #f9f9f9; border-radius: 5px;">
          ⚠️ ملاحظات وإضافات هامة: ${order.notes}
        </div>
      ` : ''}

      <!-- المجموع الكلي البارز في بون المطبخ -->
      <div style="margin-top: 8px; border: 2.5px solid #000; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: ${isSmallPaper ? '14px' : '17px'}; background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-radius: 6px;">
        <span>المجموع الكلي:</span>
        <span style="font-family: monospace; font-size: ${isSmallPaper ? '16px' : '20px'}; font-weight: 900;">${(order.total || 0).toLocaleString()} ${config.currency || 'د.ع'}</span>
      </div>

      <div class="ticket-footer" style="margin-top: 8px; border-top: 1.5px dashed #000; padding-top: 5px; text-align: center; font-weight: 900; font-size: ${isSmallPaper ? '11px' : '13px'};">
        <div>⚡ يرجى سرعة التحضير والجودة العالية ⚡</div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// توليد كود HTML لفاتورة وحساب الزبون والتوصيل فائقة التفصيل
// -------------------------------------------------------------
function getCustomerTicketHtml(order, config, timeStr, dateStr, typeBadge, currency, isSmallPaper = false) {
  let customerItemsHtml = '';
  let subtotal = 0;

  (order.items || []).forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    const priceSubtext = (item.isWeighted || item.weight)
      ? `${item.weight} كغم × ${(item.pricePerKg || item.price).toLocaleString()} ${currency}/كغم`
      : `سعر المفرد: ${item.price.toLocaleString()} ${currency}`;

    const qtyDisplay = (item.isWeighted || item.weight) ? `${item.weight} كغم` : item.quantity;

    customerItemsHtml += `
      <tr style="border-bottom: 1.5px dashed #888;">
        <td class="ticket-item-qty" style="font-size: ${isSmallPaper ? '14px' : '17px'}; font-weight: 900; text-align: center; vertical-align: middle; padding: 6px 2px;">
          <span style="display: inline-block; border: 2px solid #000; border-radius: 6px; padding: 2px 6px; min-width: 28px; background: #fff;">${qtyDisplay}</span>
        </td>
        <td style="vertical-align: middle; padding: 6px 4px;">
          <div style="font-weight: 900; font-size: ${isSmallPaper ? '13px' : '16px'}; color: #000;">${item.baseName || item.name}</div>
          <div style="font-size: ${isSmallPaper ? '10px' : '12px'}; color: #333; font-weight: bold; margin-top: 1px;">
            ${priceSubtext}
          </div>
        </td>
        <td style="text-align: left; font-weight: 900; font-size: ${isSmallPaper ? '13px' : '16px'}; vertical-align: middle; padding: 6px 2px; white-space: nowrap; font-family: monospace;">
          ${itemTotal.toLocaleString()} ${currency}
        </td>
      </tr>
    `;
  });

  const isTakeawayOrDelivery = (order.type === 'takeaway' || order.type === 'delivery');
  const deliveryFee = order.deliveryFee !== undefined ? order.deliveryFee : (isTakeawayOrDelivery ? 0 : null);

  return `
    <div class="thermal-receipt customer-invoice" style="width: ${isSmallPaper ? '48mm' : '72mm'}; margin: 0 auto; color: #000; font-family: 'Cairo', monospace, sans-serif; line-height: 1.35;">
      <div class="ticket-header" style="text-align: center; padding-bottom: 6px; border-bottom: 2px solid #000;">
        <h2 style="font-size: ${isSmallPaper ? '18px' : '23px'}; font-weight: 900; margin: 0 0 2px 0;">${config.name}</h2>
        ${config.tagline ? `<div class="tagline-print" style="font-size: ${isSmallPaper ? '9px' : '11px'}; color: #222; font-weight: bold;">${config.tagline}</div>` : ''}
        
        ${config.phone ? `
          <div style="margin: 4px 0; font-size: ${isSmallPaper ? '13px' : '16px'}; font-weight: 900; border: 1.5px solid #000; border-radius: 6px; padding: 3px 6px; display: inline-block;">
            <span>📞 هاتف المطعم:</span> <b style="font-family: monospace; letter-spacing: 1px; direction: ltr;">${config.phone}</b>
          </div>
        ` : ''}

        <div class="ticket-subtitle" style="font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; margin-top: 4px; letter-spacing: 0.5px;">🧾 فاتورة حساب الزبون / INVOICE</div>
        <div class="ticket-badge-box" style="margin-top: 4px; font-size: ${isSmallPaper ? '13px' : '16px'}; font-weight: 900; padding: 3px 6px; background: #000; color: #fff !important; border-radius: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          ${typeBadge}
        </div>
        ${(order.isPreorder || (order.notes && order.notes.includes('حجز مسبق لليوم التالي'))) ? `
          <div style="margin-top: 6px; padding: 6px; background: #000; color: #fff !important; font-weight: 900; font-size: ${isSmallPaper ? '12px' : '14px'}; border-radius: 6px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            📅 *** حجز مسبق لليوم التالي *** 📅<br>
            <span style="font-size: ${isSmallPaper ? '10px' : '12px'}; font-weight: bold;">موعد التجهيز: غداً (${order.preorderPreferredTime || 'مع بداية الافتتاح'})</span>
          </div>
        ` : ''}
      </div>

      <div class="ticket-info" style="font-size: ${isSmallPaper ? '11px' : '13px'}; padding: 6px 0; border-bottom: 2px solid #000;">
        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>رقم الفاتورة: <b style="font-size: ${isSmallPaper ? '13px' : '16px'}; font-family: monospace;">#${order.id}</b></span>
          <span>الوقت: <b style="font-size: ${isSmallPaper ? '12px' : '14px'};">${timeStr}</b></span>
        </div>
        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 3px;">
          <span>التاريخ: <b>${dateStr}</b></span>
          <span>الخدمة: <b>${order.captainName || 'كاشير المطعم'}</b></span>
        </div>

        ${(order.customerInfo || order.customerName) ? `
          <div class="customer-highlight" style="margin-top: 4px; font-size: ${isSmallPaper ? '13px' : '16px'}; font-weight: 900; border-top: 1px dashed #aaa; padding-top: 3px;">
            👤 اسم الزبون: <b>${order.customerInfo || order.customerName}</b>
          </div>
        ` : ''}

        ${order.customerPhone ? `
          <!-- هاتف الزبون بارز ومكبر جداً -->
          <div style="margin: 6px 0; padding: 8px 10px; background: #000; color: #fff !important; border: 2px solid #000; border-radius: 8px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <div style="font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 800; margin-bottom: 2px;">📞 هاتف الزبون والتوصيل:</div>
            <div style="font-size: ${isSmallPaper ? '24px' : '30px'}; font-weight: 900; font-family: monospace; letter-spacing: 2px; direction: ltr;">${order.customerPhone}</div>
          </div>
        ` : ''}

        ${order.customerAddress ? `
          <div class="info-row" style="margin-top: 4px; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: bold; background: #f0f0f0; padding: 4px 6px; border-radius: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <span>📍 عنوان التوصيل:</span> <b style="display: block; margin-top: 1px;">${order.customerAddress}</b>
          </div>
        ` : ''}
      </div>

      <div class="ticket-items" style="margin-top: 4px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="width: 20%; text-align: center; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; padding: 4px 0;">العدد</th>
              <th style="width: 50%; text-align: right; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; padding: 4px;">الصنف والوجبة</th>
              <th style="width: 30%; text-align: left; font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900; padding: 4px 0;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${customerItemsHtml}
          </tbody>
        </table>
      </div>

      <!-- تفصيل الحساب والمجاميع وأجور التوصيل -->
      <div class="ticket-summary" style="margin-top: 8px; border-top: 2px solid #000; padding-top: 6px; font-size: ${isSmallPaper ? '12px' : '14px'};">
        <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: bold;">المجموع الفرعي:</span>
          <b style="font-family: monospace; font-size: ${isSmallPaper ? '13px' : '15px'};">${subtotal.toLocaleString()} ${currency}</b>
        </div>

        ${isTakeawayOrDelivery ? `
          <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: bold;">أجور التوصيل:</span>
            <b style="font-family: monospace; font-size: ${isSmallPaper ? '13px' : '15px'};">${deliveryFee && deliveryFee > 0 ? `${deliveryFee.toLocaleString()} ${currency}` : '0 ' + currency + ' (مجاني 🛵)'}</b>
          </div>
        ` : ''}

        ${order.discount && order.discount > 0 ? `
          <div class="info-row" style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #c00;">
            <span style="font-weight: bold;">الخصم الممنوح:</span>
            <b style="font-family: monospace; font-size: ${isSmallPaper ? '13px' : '15px'};">-${order.discount.toLocaleString()} ${currency}</b>
          </div>
        ` : ''}

        <div class="summary-row total-row" style="font-size: ${isSmallPaper ? '15px' : '18px'}; font-weight: 900; border: 2.5px solid #000; margin-top: 8px; padding: 6px 8px; background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; justify-content: space-between; align-items: center; border-radius: 6px;">
          <span>المجموع الكلي:</span>
          <span style="font-family: monospace; font-size: ${isSmallPaper ? '19px' : '24px'}; font-weight: 900;">${order.total.toLocaleString()} ${currency}</span>
        </div>
      </div>

      ${order.notes ? `
        <div style="margin-top: 6px; font-size: ${isSmallPaper ? '11px' : '13px'}; border: 1.5px dashed #000; padding: 5px; border-radius: 5px; font-weight: bold;">
          <b>📝 ملاحظات الطلب:</b> ${order.notes}
        </div>
      ` : ''}

      ${order.mapUrl ? `
        <!-- قسم باركود الخريطة والملاحة لعامل التوصيل -->
        <div style="text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1.5px dashed #000;">
          <div style="font-weight: 900; font-size: ${isSmallPaper ? '11px' : '13px'}; margin-bottom: 4px;">🗺️ موقع الزبون على الخريطة GPS:</div>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(order.mapUrl)}" style="width: ${isSmallPaper ? '90px' : '110px'}; height: ${isSmallPaper ? '90px' : '110px'}; margin: 0 auto; display: block; border: 1.5px solid #000; padding: 2px;" alt="QR Map" />
          <div style="font-size: ${isSmallPaper ? '9px' : '11px'}; font-weight: bold; margin-top: 3px;">امسح الكود بكاميرا الهاتف للملاحة المباشرة</div>
        </div>
      ` : ''}

      <div class="ticket-footer" style="margin-top: 8px; border-top: 2px dashed #000; padding-top: 6px; text-align: center;">
        <div class="thank-you-msg" style="font-weight: 900; font-size: ${isSmallPaper ? '12px' : '14px'};">❤️ نتشرف بزيارتكم وبالصحة والعافية! ❤️</div>
        ${config.phone ? `
          <div style="font-size: ${isSmallPaper ? '11px' : '13px'}; font-weight: 800; margin-top: 3px;">
            خدمة الزبائن والطلبات: <b style="font-family: monospace; direction: ltr;">${config.phone}</b>
          </div>
        ` : ''}
        <div style="font-size: ${isSmallPaper ? '9px' : '10px'}; color: #333; margin-top: 3px; font-weight: bold;">نظام إدارة المطاعم الذكي - ${config.name}</div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// محرك الطباعة المباشر الذكي وفق إعدادات الكاشير / الكابتن
// -------------------------------------------------------------
// 賲丨乇賰 丕賱胤亘丕毓丞 丕賱賲亘丕卮乇 丕賱匕賰賷 賵賮賯 廿毓丿丕丿丕鬲 丕賱賰丕卮賷乇 / 丕賱賰丕亘鬲賳
// -------------------------------------------------------------
function centerTicketText(text, width = 42) {
  text = String(text || '');
  const len = text.length;
  if (len >= width) return text;
  const pad = Math.floor((width - len) / 2);
  return " ".repeat(pad) + text;
}

function formatKitchenTextTicket(order, config, isSmallPaper = false) {
  const width = isSmallPaper ? 30 : 42;
  const div = "=".repeat(width);
  const subDiv = "-".repeat(width);
  const dateObj = new Date(order.timestamp || Date.now());
  const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString('ar-EG');
  
  // ✅ نوع الطلب واضح
  let typeText = "سفري (استلام شخصي)";
  if (order.type === 'dine-in') {
    typeText = `صالة - طاولة [ ${order.tableNumber || 1} ]`;
  } else if (order.type === 'delivery') {
    typeText = "دليفري (توصيل خارجي)";
  }

  let lines = [
    div,
    centerTicketText(config.name || "مطعم فحمة ودخان", width),
    centerTicketText("👨‍🍳 بون تحضير المطبخ / KITCHEN", width),
    div,
    `رقم البون: #${order.id}   الوقت: ${timeStr}`,
    `التاريخ: ${dateStr}`,
    `نوع الطلب: ${typeText}`,
    `المرسل: ${order.captainName || 'كاشير المطعم'}`
  ];

  // ✅ اسم الزبون وهاتفه في بون المطبخ
  const custName = order.customerInfo || order.customerName || '';
  const custPhone = order.customerPhone || '';
  if (custName) {
    lines.push(`الزبون: ${custName}`);
  }
  if (custPhone) {
    lines.push(div);
    lines.push(centerTicketText(`📞 هاتف الزبون: ${custPhone}`, width));
    lines.push(div);
  }

  lines.push(subDiv);
  lines.push("العدد | الصنف المطلوب");
  lines.push(subDiv);

  (order.items || []).forEach(item => {
    if (item.isWeighted || item.weight) {
      lines.push(` [1]  ${item.baseName || item.name} [وزن: ${item.weight} كغم]`);
    } else {
      lines.push(` [${item.quantity}]  ${item.name}`);
    }
  });

  if (order.notes) {
    lines.push(subDiv);
    lines.push(`ملاحظات: ${order.notes}`);
  }

  lines.push(subDiv);
  lines.push(`المجموع الكلي: ${(order.total || 0).toLocaleString()} ${config.currency || 'د.ع'}`);
  lines.push(div);
  lines.push(centerTicketText("--- نهاية بون تحضير المطبخ ---", width));
  return lines.join("\r\n");
}

function formatCashierTextTicket(order, config, isSmallPaper = false) {
  const width = isSmallPaper ? 30 : 42;
  const div = "=".repeat(width);
  const subDiv = "-".repeat(width);
  const dateObj = new Date(order.timestamp || Date.now());
  const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString('ar-EG');
  const currency = order.currency || config.currency || 'د.ع';

  // ✅ نوع الطلب بالعربي الواضح
  let typeText = "سفري (استلام شخصي)";
  if (order.type === 'dine-in') {
    typeText = `صالة - طاولة [ ${order.tableNumber || 1} ]`;
  } else if (order.type === 'delivery') {
    typeText = "دليفري (توصيل خارجي)";
  }

  let lines = [
    div,
    centerTicketText(config.name || "مطعم فحمة ودخان", width)
  ];

  if (config.phone) {
    lines.push(centerTicketText(`📞 هاتف المطعم: ${config.phone}`, width));
  }

  lines.push(centerTicketText("فاتورة حساب وبون محاسبة", width));
  lines.push(div);
  lines.push(`رقم الفاتورة: #${order.id}   الوقت: ${timeStr}`);
  lines.push(`التاريخ: ${dateStr}`);
  lines.push(`نوع الطلب: ${typeText}`);
  lines.push(`المحاسب: ${order.captainName || 'كاشير المطعم'}`);

  // ✅ معلومات الزبون وهاتفه بشكل مكبر وبارز
  const custName = order.customerInfo || order.customerName || '';
  const custPhone = order.customerPhone || '';
  const custAddr  = order.customerAddress || '';

  if (custName) {
    lines.push(subDiv);
    lines.push(`الزبون: ${custName}`);
  }
  if (custPhone) {
    lines.push(div);
    lines.push(centerTicketText(`📞 هاتف الزبون: ${custPhone}`, width));
    lines.push(div);
  }
  if (custAddr) {
    lines.push(`عنوان التوصيل: ${custAddr}`);
  }

  lines.push(subDiv);
  lines.push("العدد | الصنف                      | الاجمالي");
  lines.push(subDiv);

  let subtotal = 0;
  (order.items || []).forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    if (item.isWeighted || item.weight) {
      lines.push(` [1]  ${item.baseName || item.name}`);
      lines.push(`      ${item.weight} كغم x ${(item.pricePerKg || item.price).toLocaleString()} = ${itemTotal.toLocaleString()} ${currency}`);
    } else {
      lines.push(` [${item.quantity}]  ${item.name}`);
      lines.push(`      ${item.price.toLocaleString()} x ${item.quantity} = ${itemTotal.toLocaleString()} ${currency}`);
    }
  });

  lines.push(subDiv);
  lines.push(`المجموع الفرعي: ${subtotal.toLocaleString()} ${currency}`);

  if (order.deliveryFee && order.deliveryFee > 0) {
    lines.push(`اجور التوصيل: +${order.deliveryFee.toLocaleString()} ${currency}`);
  }
  if (order.discount && order.discount > 0) {
    lines.push(`الخصم: -${order.discount.toLocaleString()} ${currency}`);
  }

  lines.push(div);
  lines.push(`المجموع النهائي: ${(order.total || 0).toLocaleString()} ${currency}`);
  lines.push(div);
  if (order.notes) {
    lines.push(`ملاحظات: ${order.notes}`);
  }
  lines.push(centerTicketText("شكراً لزيارتكم وبالصحة والعافية", width));
  if (config.phone) {
    lines.push(centerTicketText(`خدمة الزبائن: ${config.phone}`, width));
  }
  lines.push(div);
  return lines.join("\r\n");
}

function showSilentPrintToast(msg) {
  let toast = document.getElementById('silent-print-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'silent-print-toast';
    toast.className = 'fixed bottom-5 left-5 z-[9999] bg-emerald-600 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 transition-all duration-300 transform translate-y-10 opacity-0 pointer-events-none';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>🖨️</span><span>${msg}</span>`;
  toast.classList.remove('translate-y-10', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
  }, 3500);
}

function showCashierToast(msg, icon = '✅') {
  let toast = document.getElementById('cashier-action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cashier-action-toast';
    toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900 border border-emerald-500/80 text-white font-black text-sm px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 transition-all duration-300 transform -translate-y-12 opacity-0 pointer-events-none ring-4 ring-emerald-500/20';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="text-lg">${icon}</span><span class="text-emerald-300">${msg}</span>`;
  toast.classList.remove('-translate-y-12', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('-translate-y-12', 'opacity-0');
  }, 2500);
}
window.showCashierToast = showCashierToast;

// -------------------------------------------------------------
// توليد بون ورقي كصورة نقطية Raster ESC/POS خالية 100% من الرموز الصينية
// -------------------------------------------------------------
function renderTicketToEscPosRaster(order, ticketType = 'kitchen', isSmallPaper = false) {
  if (!order) return null;
  try {
    const width = isSmallPaper ? 384 : 576;
    const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
    const currency = order.currency || config.currency || 'د.ع';

    const canvas = document.createElement('canvas');
    canvas.width = width;
    const ctx = canvas.getContext('2d');

    const items = Array.isArray(order.items) ? order.items : [];
    let estHeight = 480 + (items.length * 90);
    if (order.notes) estHeight += 90;
    if (order.customerInfo || order.customerPhone || order.customerAddress) estHeight += 180;
    if (config.phone) estHeight += 60;
    canvas.height = estHeight;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, canvas.height);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    let y = 38;

    // 1. اسم المطعم بخط كبير
    ctx.font = 'bold 30px "Cairo", "Tahoma", "Arial", sans-serif';
    ctx.fillText(config.name || 'مطعم فحمة ودخان', width / 2, y);
    y += 34;

    // هاتف المطعم بالترويسة
    if (config.phone) {
      ctx.font = 'bold 18px "Cairo", "Tahoma", monospace, sans-serif';
      ctx.fillText(`📞 هاتف المطعم: ${config.phone}`, width / 2, y);
      y += 28;
    }

    // 2. عنوان البون
    ctx.font = 'bold 22px "Cairo", "Tahoma", "Arial", sans-serif';
    if (ticketType === 'kitchen') {
      ctx.fillRect(20, y - 24, width - 40, 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('👨‍🍳 بون تحضير المطبخ 👨‍🍳', width / 2, y + 4);
      ctx.fillStyle = '#000000';
      y += 40;
    } else {
      ctx.fillText('🧾 فاتورة الحساب والدفع 🧾', width / 2, y);
      y += 32;
    }

    // خط فاصل
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();
    y += 28;

    // 3. تفاصيل الطلب
    ctx.font = 'bold 20px "Cairo", "Tahoma", "Arial", sans-serif';
    ctx.textAlign = 'right';

    let typeText = "🛵 طلب سفري / خارجي";
    if (order.type === 'dine-in') {
      typeText = `🍽️ صالة داخلية - طاولة [ ${order.tableNumber || 1} ]`;
    } else if (order.type === 'delivery') {
      typeText = `🛵 طلب توصيل دليفري`;
    }

    ctx.fillText(typeText, width - 20, y);
    const dateObj = new Date(order.timestamp || Date.now());
    const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('ar-EG');
    ctx.textAlign = 'left';
    ctx.fillText(`${dateStr} ${timeStr}`, 20, y);
    y += 28;

    ctx.textAlign = 'right';
    ctx.font = 'bold 17px "Cairo", "Tahoma", monospace, sans-serif';
    ctx.fillText(`رقم الطلب: #${order.id || '--'}`, width - 20, y);
    if (order.captainName) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px "Cairo", "Tahoma", sans-serif';
      ctx.fillText(`الخدمة: ${order.captainName}`, 20, y);
    }
    y += 26;

    // اسم الزبون
    const custName = order.customerInfo || order.customerName || '';
    const custPhone = order.customerPhone || '';
    const custAddr = order.customerAddress || '';

    if (custName) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 19px "Cairo", "Tahoma", sans-serif';
      ctx.fillText(`👤 الزبون: ${custName}`, width - 20, y);
      y += 26;
    }

    // هاتف الزبون مكبر ومؤطر بشكل بارز جداً
    if (custPhone) {
      ctx.fillRect(15, y, width - 30, 72);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px "Cairo", "Tahoma", sans-serif';
      ctx.fillText('📞 هاتف الزبون والتوصيل:', width / 2, y + 20);
      ctx.font = 'bold 32px monospace, "Cairo", sans-serif';
      ctx.fillText(custPhone, width / 2, y + 55);
      ctx.fillStyle = '#000000';
      y += 84;
    }

    if (custAddr) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 17px "Cairo", "Tahoma", sans-serif';
      ctx.fillText(`📍 عنوان التوصيل: ${custAddr}`, width - 20, y);
      y += 26;
    }

    // خط فاصل
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();
    y += 26;

    // 4. رأس جدول الأصناف
    ctx.font = 'bold 18px "Cairo", "Tahoma", "Arial", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الصنف / الوجبة', width - 20, y);
    if (ticketType === 'customer') {
      ctx.textAlign = 'center';
      ctx.fillText('الكمية', width / 2, y);
      ctx.textAlign = 'left';
      ctx.fillText('السعر', 20, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText('الكمية', 20, y);
    }
    y += 14;

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();
    y += 28;

    // 5. الأصناف بخطوط كبيرة وواضحة
    items.forEach(item => {
      ctx.textAlign = 'right';
      ctx.font = 'bold 20px "Cairo", "Tahoma", "Arial", sans-serif';

      const isW = (typeof isDishWeighted === 'function') ? isDishWeighted(item) : false;
      const itemName = item.baseName || item.name || '';
      const weightVal = item.weight || (item.name && item.name.match(/\(([\d\.]+)\s*كغم\)/)?.[1]);

      ctx.fillText(itemName, width - 20, y);

      if (ticketType === 'customer') {
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px monospace, "Cairo", sans-serif';
        if (isW && weightVal) {
          ctx.fillText(`${weightVal} كغم`, width / 2, y);
        } else {
          ctx.fillText(`× ${item.quantity || 1}`, width / 2, y);
        }

        ctx.textAlign = 'left';
        ctx.font = 'bold 19px monospace, "Cairo", sans-serif';
        const itemTot = Number(item.price) || 0;
        ctx.fillText(`${itemTot.toLocaleString()} ${currency}`, 20, y);
      } else {
        ctx.textAlign = 'left';
        ctx.font = 'bold 22px monospace, "Cairo", sans-serif';
        if (isW && weightVal) {
          ctx.fillText(`⚖️ ${weightVal} كغم`, 20, y);
        } else {
          ctx.fillText(`[ × ${item.quantity || 1} ]`, 20, y);
        }
      }
      y += 28;

      if (item.notes) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 15px "Cairo", "Tahoma", sans-serif';
        ctx.fillText(`   ↳ ملاحظة: ${item.notes}`, width - 30, y);
        y += 24;
      }
    });

    // 6. ملاحظات المطبخ
    if (order.notes) {
      y += 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();
      y += 26;

      ctx.textAlign = 'right';
      ctx.font = 'bold 17px "Cairo", "Tahoma", sans-serif';
      ctx.fillText(`📝 ملاحظات: ${order.notes}`, width - 20, y);
      y += 26;
    }

    // 7. قسم الحساب الكلي
    if (ticketType !== 'kitchen') {
      y += 8;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(15, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();
      y += 28;

      if (order.deliveryFee && Number(order.deliveryFee) > 0) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 17px "Cairo", "Tahoma", sans-serif';
        ctx.fillText('أجور التوصيل:', width - 20, y);
        ctx.textAlign = 'left';
        ctx.fillText(`${Number(order.deliveryFee).toLocaleString()} ${currency}`, 20, y);
        y += 26;
      }

      ctx.textAlign = 'right';
      ctx.font = 'bold 24px "Cairo", "Tahoma", sans-serif';
      ctx.fillText('المجموع الإجمالي:', width - 20, y);
      ctx.textAlign = 'left';
      ctx.font = 'bold 26px monospace, "Cairo", sans-serif';
      const grandTot = Number(order.total) || 0;
      ctx.fillText(`${grandTot.toLocaleString()} ${currency}`, 20, y);
      y += 36;

      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Cairo", "Tahoma", sans-serif';
      ctx.fillText('شكراً لزيارتكم! نتشرف دائماً بخدمتكم 🌟', width / 2, y);
      y += 26;

      if (config.phone) {
        ctx.font = 'bold 16px monospace, "Cairo", sans-serif';
        ctx.fillText(`خدمة الزبائن والطلبات: ${config.phone}`, width / 2, y);
        y += 26;
      }
    } else {
      y += 15;
      ctx.textAlign = 'center';
      ctx.font = 'bold 18px "Cairo", "Tahoma", sans-serif';
      ctx.fillText('⚡ يرجى سرعة التحضير والجودة العالية ⚡', width / 2, y);
      y += 26;
    }

    const finalHeight = y + 25;

    const trimmed = document.createElement('canvas');
    trimmed.width = width;
    trimmed.height = finalHeight;
    const tCtx = trimmed.getContext('2d');
    tCtx.drawImage(canvas, 0, 0, width, finalHeight, 0, 0, width, finalHeight);

    const imgData = tCtx.getImageData(0, 0, width, finalHeight).data;
    const widthBytes = Math.ceil(width / 8);
    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = finalHeight & 0xFF;
    const yH = (finalHeight >> 8) & 0xFF;

    const header = [0x1B, 0x40, 0x1C, 0x2E, 0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];
    const raster = [];

    for (let row = 0; row < finalHeight; row++) {
      for (let colByte = 0; colByte < widthBytes; colByte++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = colByte * 8 + bit;
          if (x < width) {
            const idx = (row * width + x) * 4;
            const a = imgData[idx + 3];
            if (a > 120) {
              const gray = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
              if (gray < 160) {
                b |= (1 << (7 - bit));
              }
            }
          }
        }
        raster.push(b);
      }
    }

    const footer = [0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00];
    const fullBytes = new Uint8Array([...header, ...raster, ...footer]);

    let binary = '';
    const len = fullBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(fullBytes[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.warn("renderTicketToEscPosRaster error:", err);
    return null;
  }
}
window.renderTicketToEscPosRaster = renderTicketToEscPosRaster;

// دالة الطباعة المباشرة الذكية للأوردر
async function printOrderDirect(order, overrideTicketType = null) {
  if (!order) return;

  const ticketEl = document.getElementById('kitchen-print-ticket');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const printSettings = getPrintSettings();

  const isSmallPaper = (printSettings.paperSize === '58mm');
  // منع الطباعة المزدوجة نهائياً بناءً على طلب المستخدم الصارم: إما مطبخ أو حساب فقط
  let ticketType = overrideTicketType;
  if (!ticketType || ticketType === 'separate' || ticketType === 'both' || ticketType === 'combined') {
    ticketType = (printSettings.ticketType === 'kitchen') ? 'kitchen' : 'customer';
  }

  const dateObj = new Date(order.timestamp || Date.now());
  const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString('ar-EG');
  const currency = order.currency || config.currency || 'د.ع';

  let typeBadge = "🛵 سفري / خارجي";
  if (order.type === 'dine-in') {
    typeBadge = `🍽️ صالة داخلية - طاولة [ ${order.tableNumber || 1} ]`;
  } else if (order.type === 'delivery') {
    typeBadge = `🛵 طلب توصيل دليفري`;
  }

  // تحديث محتوى عنصر الطباعة للمتصفح (طباعة فردية محددة فقط)
  if (ticketEl) {
    if (ticketType === 'kitchen') {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getKitchenTicketHtml(order, config, timeStr, dateStr, typeBadge, isSmallPaper)}</div>`;
    } else {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getCustomerTicketHtml(order, config, timeStr, dateStr, typeBadge, currency, isSmallPaper)}</div>`;
    }
  }

  // محاولة الطباعة الصامتة عبر وسيط ويندوز المحلي إذا كانت مفعلة (طابعة واحدة فقط في كل مرة)
  if (printSettings.silentPrint !== false) {
    const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
    try {
      if (ticketType === 'kitchen') {
        // 1. بون المطبخ المرجعي الشامل (Master Expediter Ticket - طابعة 101)
        const kitchenRaster = renderTicketToEscPosRaster(order, 'kitchen', isSmallPaper);
        const kitchenText = formatKitchenTextTicket(order, config, isSmallPaper);
        const res = await fetch(`${bridgeUrl}/print-kitchen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ip',
            ip: printSettings.kitchenIp || '192.168.1.101',
            port: printSettings.kitchenPort || 9100,
            text: kitchenText,
            rasterBase64: kitchenRaster
          })
        }).catch(e => null);

        // 2. فحص طابعات المحطات المساندة (Station Printers - مثل طابعة طباخ الدجاج، المشاوي، البار)
        try {
          const printers = await fetchRestaurantPrinters();
          const stationPrinters = printers.filter(p => p.section && p.section !== 'cashier' && p.section !== 'kitchen' && p.section !== 'kitchen_main');
          for (const sp of stationPrinters) {
            const sec = (sp.section || '').toLowerCase();
            const name = (sp.name || '').toLowerCase();
            const stationItems = (order.items || []).filter(item => {
              const cat = (item.category || item.category_name || item.section || '').toLowerCase();
              const itemName = (item.name || '').toLowerCase();
              return cat.includes(sec) || name.includes(cat) ||
                     (cat.includes('دجاج') || itemName.includes('دجاج') || itemName.includes('منسف')) && (sec.includes('chicken') || name.includes('دجاج')) ||
                     (cat.includes('مشاوي') || itemName.includes('كباب') || itemName.includes('تكا') || itemName.includes('لحم')) && (sec.includes('grill') || name.includes('مشاوي')) ||
                     (cat.includes('بار') || cat.includes('مشروبات') || itemName.includes('عصير') || itemName.includes('كولا') || itemName.includes('شاي')) && (sec.includes('bar') || name.includes('بار') || name.includes('مشروبات'));
            });
            if (stationItems.length > 0) {
              const stationOrder = { ...order, items: stationItems, stationName: sp.name || `محطة ${sp.section}` };
              const subRaster = renderTicketToEscPosRaster(stationOrder, 'kitchen', isSmallPaper);
              const subText = formatKitchenTextTicket(stationOrder, config, isSmallPaper);
              await fetch(`${bridgeUrl}/print-station`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectionType: sp.connection_type || 'ip',
                  ip: sp.ip,
                  port: sp.port || 9100,
                  usbPrinterName: sp.usb_printer_name || '',
                  text: subText,
                  rasterBase64: subRaster,
                  cut: true,
                  buzzer: true
                })
              }).catch(() => null);
            }
          }
        } catch(stationErr) {
          console.warn("Station sub-printer routing notice:", stationErr);
        }

        if (res && res.ok) {
          showSilentPrintToast("تم إرسال بون المطبخ الشامل وبونات المحطات المساندة 👨‍🍳✅");
          return;
        }
      } else {
        // فاتورة كشف حساب الزبون فقط (طابعة 100 أو طابعة الكاشير المخصصة للمستخدم)
        const session = (typeof getCurrentSession === 'function' ? getCurrentSession() : null) || (window.AuthCore ? window.AuthCore.getCurrentSession() : null);
        const assignedPrinterId = localStorage.getItem('smart_emenu_user_assigned_printer') || session?.assigned_printer_id || session?.assignedPrinterId;
        let assignedPrinter = null;
        if (assignedPrinterId) {
          try {
            const printers = JSON.parse(localStorage.getItem('smart_emenu_printers') || '[]');
            assignedPrinter = printers.find(p => p.id === assignedPrinterId);
          } catch (e) {}
        }

        const targetMode = assignedPrinter ? (assignedPrinter.connection_type === 'usb' ? 'windows' : 'ip') : (printSettings.cashierMode || 'ip');
        const targetIp = assignedPrinter ? (assignedPrinter.ip || '192.168.1.100') : (printSettings.cashierIp || '192.168.1.100');
        const targetPort = assignedPrinter ? (assignedPrinter.port || 9100) : (printSettings.cashierPort || 9100);
        const targetUsb = assignedPrinter ? (assignedPrinter.usb_printer_name || '') : (printSettings.cashierPrinterName || '');

        const cashierRaster = renderTicketToEscPosRaster(order, 'customer', isSmallPaper);
        const cashierText = formatCashierTextTicket(order, config, isSmallPaper);
        const res = await fetch(`${bridgeUrl}/print-station`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionType: targetMode === 'windows' ? 'usb' : 'ip',
            ip: targetIp,
            port: targetPort,
            usbPrinterName: targetUsb,
            text: cashierText,
            rasterBase64: cashierRaster,
            cut: true,
            buzzer: false
          })
        }).catch(e => null);
        if (res && res.ok) {
          showSilentPrintToast("تم إرسال فاتورة الحساب فقط 🧾✅");
          return;
        }
      }
    } catch (err) {
      console.warn("Silent bridge error, falling back to window.print:", err);
    }
  }

  // في حال تعذر وسيط الطباعة، التحويل لنافذة الطباعة الفردية
  window.print();
}
window.printOrderDirect = printOrderDirect;

function printDualThermalReceipt(order) {
  // منع الطباعة المزدوجة: توجيه تلقائي لفاتورة الحساب الفردية
  printOrderDirect(order, 'customer');
}

function renderAndPrintKitchenTicket(order) {
  printOrderDirect(order, 'kitchen');
}

function renderAndPrintCashierTicket(order) {
  printOrderDirect(order, 'customer');
}

// -------------------------------------------------------------
// إدارة طابعات المطعم (شبكية IP وUSB) والطباعة متعددة المحطات
// -------------------------------------------------------------
async function fetchRestaurantPrinters() {
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  let cached = [];
  try {
    cached = JSON.parse(localStorage.getItem('smart_emenu_printers') || '[]');
  } catch (e) {}
  
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      const { data, error } = await client
        .from('restaurant_printers')
        .select('*')
        .eq('restaurant_id', restId)
        .order('created_at', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        cached = data;
        localStorage.setItem('smart_emenu_printers', JSON.stringify(cached));
      }
    } catch (err) {
      console.warn("fetchRestaurantPrinters cashier notice:", err);
    }
  }

  if (!cached || cached.length === 0) {
    cached = [
      { id: 'p_cashier_1', restaurant_id: restId, name: 'طابعة الكاشير 1 (100)', connection_type: 'ip', ip: '192.168.1.100', port: 9100, section: 'cashier', paper_size: '80mm', is_active: true },
      { id: 'p_kitchen_main', restaurant_id: restId, name: 'طابعة المطبخ الرئيسي (101)', connection_type: 'ip', ip: '192.168.1.101', port: 9100, section: 'kitchen', paper_size: '80mm', is_active: true }
    ];
    localStorage.setItem('smart_emenu_printers', JSON.stringify(cached));
  }
  return cached;
}
window.fetchRestaurantPrinters = fetchRestaurantPrinters;

async function saveRestaurantPrinter(printer) {
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  
  if (!printer.id) {
    printer.id = 'prn_' + Date.now();
  }
  printer.restaurant_id = restId;
  printer.updated_at = new Date().toISOString();

  let printers = await fetchRestaurantPrinters();
  const idx = printers.findIndex(p => p.id === printer.id);
  if (idx !== -1) {
    printers[idx] = { ...printers[idx], ...printer };
  } else {
    printers.push(printer);
  }
  localStorage.setItem('smart_emenu_printers', JSON.stringify(printers));

  if (client) {
    try {
      await client.from('restaurant_printers').upsert(printer);
    } catch (e) {
      console.warn("Supabase upsert printer error:", e);
    }
  }
  return printer;
}
window.saveRestaurantPrinter = saveRestaurantPrinter;

async function deleteRestaurantPrinter(id) {
  let printers = await fetchRestaurantPrinters();
  printers = printers.filter(p => p.id !== id);
  localStorage.setItem('smart_emenu_printers', JSON.stringify(printers));

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      await client.from('restaurant_printers').delete().eq('id', id);
    } catch (e) {
      console.warn("Supabase delete printer error:", e);
    }
  }
}
window.deleteRestaurantPrinter = deleteRestaurantPrinter;

async function testStationPrinter(printer) {
  const currentSettings = getPrintSettings();
  const bridgeUrl = currentSettings.bridgeUrl || 'http://127.0.0.1:8080';
  const now = new Date().toLocaleTimeString('ar-EG');
  const sample = `\n==========================================\n     نظام إدارة وتشغيل المطاعم الذكي\n        SMART RESTAURANT SYSTEM\n==========================================\nتجربة طابعة: ${printer.name || 'طابعة القسم'}\nالنوع: ${printer.connection_type === 'usb' ? 'USB ويندوز' : 'شبكية Ethernet/IP'}\nالهدف: ${printer.connection_type === 'usb' ? (printer.usb_printer_name || 'USB Printer') : ((printer.ip || '192.168.1.100') + ':' + (printer.port || 9100))}\nالقسم: ${printer.section || 'عام'}\nالوقت: ${now}\nالحالة: متصلة بنجاح وجاهزة للطباعة الصامتة OK\n==========================================\n`;

  try {
    const res = await fetch(`${bridgeUrl}/print-station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionType: printer.connection_type || 'ip',
        ip: printer.ip || '192.168.1.100',
        port: printer.port || 9100,
        usbPrinterName: printer.usb_printer_name || '',
        text: sample,
        cut: true,
        buzzer: (printer.section === 'kitchen')
      })
    });
    const d = await res.json();
    if (d && d.success) {
      alert(`✅ تم إرسال أمر الطباعة التجريبي لطابعة [ ${printer.name} ] بنجاح!`);
    } else {
      alert(`❌ تعذر الاتصال بالطابعة [ ${printer.name} ]: ` + (d?.error || "تأكد من عنوان IP/USB واتصال الشبكة"));
    }
  } catch (err) {
    alert("❌ تعذر الوصول لوسيط الطباعة المحلي. تأكد من تشغيل وسيط الطباعة الصامتة أولاً.");
  }
}
window.testStationPrinter = testStationPrinter;

async function renderDynamicPrintersList() {
  const listEl = document.getElementById('ps-printers-dynamic-list');
  if (!listEl) return;
  const printers = await fetchRestaurantPrinters();

  if (printers.length === 0) {
    listEl.innerHTML = '<div class="text-center py-3 text-xs text-slate-500">لا توجد طابعات إضافية مسجلة حالياً.</div>';
    return;
  }

  const session = (typeof getCurrentSession === 'function' ? getCurrentSession() : null) || (window.AuthCore ? window.AuthCore.getCurrentSession() : null);
  const currentAssignedId = localStorage.getItem('smart_emenu_user_assigned_printer') || session?.assigned_printer_id || session?.assignedPrinterId || 'p_cashier_1';

  listEl.innerHTML = printers.map(p => {
    const isIp = (p.connection_type !== 'usb');
    const targetText = isIp ? `${p.ip || '192.168.1.100'}:${p.port || 9100}` : `USB: ${p.usb_printer_name || 'ويندوز'}`;
    const sectionLabels = {
      kitchen: '👨‍🍳 مطبخ رئيسي',
      cashier: '💵 كاشير',
      chicken: '🍗 قسم الدجاج والطيور',
      bar: '🍹 بار ومشروبات',
      grill: '🥩 شواء ومشاوي',
      other: '⚙️ أخرى'
    };
    const secLabel = sectionLabels[p.section] || 'عام';
    const isAssigned = (p.id === currentAssignedId);

    return `
      <div class="p-2.5 bg-slate-900 border ${isAssigned ? 'border-indigo-500/60 ring-1 ring-indigo-500/40' : 'border-slate-800'} rounded-xl flex items-center justify-between gap-2">
        <div class="space-y-0.5 text-right">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-black text-white">${p.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${isIp ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}">${isIp ? 'شبكية IP' : 'USB'}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">${secLabel}</span>
            ${isAssigned ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">⭐ طابعتي المخصصة</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-400 font-mono" dir="ltr">${targetText}</div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          ${!isAssigned ? `
            <button type="button" onclick="setUserAssignedPrinter('${p.id}')" class="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-[10px] font-bold transition" title="تعيين كطابعتي الافتراضية">
              ⭐ تعيين لي
            </button>
          ` : ''}
          <button type="button" onclick="testStationPrinterById('${p.id}')" class="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition" title="تجربة الطباعة">
            🧪 تجربة
          </button>
          <button type="button" onclick="editDynPrinter('${p.id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition" title="تعديل">
            ✏️
          </button>
          <button type="button" onclick="deleteDynPrinter('${p.id}')" class="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold transition" title="حذف">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}
window.renderDynamicPrintersList = renderDynamicPrintersList;

async function setUserAssignedPrinter(printerId) {
  if (!printerId) return;
  localStorage.setItem('smart_emenu_user_assigned_printer', printerId);
  const session = (typeof getCurrentSession === 'function' ? getCurrentSession() : null) || (window.AuthCore ? window.AuthCore.getCurrentSession() : null);
  if (session) {
    session.assigned_printer_id = printerId;
    session.assignedPrinterId = printerId;
    try {
      sessionStorage.setItem('smart_emenu_active_session', JSON.stringify(session));
      localStorage.setItem('smart_emenu_active_session', JSON.stringify(session));
    } catch(e) {}
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (client && session.userId) {
      try {
        await client.from('restaurant_users').update({ assigned_printer_id: printerId }).eq('id', session.userId);
      } catch(e) {}
    }
  }
  if (typeof showToast === 'function') {
    showToast('تم تعيين الطابعة كطابعتك الافتراضية المخصصة بنجاح ⭐', 'success');
  } else {
    alert('تم تعيين الطابعة كطابعتك الافتراضية المخصصة بنجاح ⭐');
  }
  renderDynamicPrintersList();
}
window.setUserAssignedPrinter = setUserAssignedPrinter;

async function testStationPrinterById(id) {
  const printers = await fetchRestaurantPrinters();
  const p = printers.find(x => x.id === id);
  if (p) testStationPrinter(p);
}
window.testStationPrinterById = testStationPrinterById;

function showAddPrinterForm(printerId = null) {
  const form = document.getElementById('ps-add-printer-form');
  if (!form) return;
  form.classList.remove('hidden');

  if (!printerId) {
    document.getElementById('dyn-printer-id').value = '';
    document.getElementById('dyn-printer-name').value = '';
    document.getElementById('dyn-printer-section').value = 'kitchen';
    document.getElementById('dyn-printer-type').value = 'ip';
    document.getElementById('dyn-printer-ip').value = '192.168.1.102';
    onDynPrinterTypeChange();
  }
}
window.showAddPrinterForm = showAddPrinterForm;

function cancelAddPrinterForm() {
  const form = document.getElementById('ps-add-printer-form');
  if (form) form.classList.add('hidden');
}
window.cancelAddPrinterForm = cancelAddPrinterForm;

function onDynPrinterTypeChange() {
  const type = document.getElementById('dyn-printer-type')?.value || 'ip';
  const boxIp = document.getElementById('dyn-box-ip');
  const boxUsb = document.getElementById('dyn-box-usb');
  if (type === 'usb') {
    if (boxIp) boxIp.classList.add('hidden');
    if (boxUsb) boxUsb.classList.remove('hidden');
  } else {
    if (boxIp) boxIp.classList.remove('hidden');
    if (boxUsb) boxUsb.classList.add('hidden');
  }
}
window.onDynPrinterTypeChange = onDynPrinterTypeChange;

async function saveDynPrinter() {
  const id = document.getElementById('dyn-printer-id')?.value;
  const name = document.getElementById('dyn-printer-name')?.value?.trim();
  const section = document.getElementById('dyn-printer-section')?.value || 'kitchen';
  const connType = document.getElementById('dyn-printer-type')?.value || 'ip';
  const ip = document.getElementById('dyn-printer-ip')?.value?.trim() || '192.168.1.102';
  const usbPrinterName = document.getElementById('dyn-printer-usb-select')?.value || '';

  if (!name) {
    alert("يرجى إدخال اسم الطابعة!");
    return;
  }
  if (connType === 'usb' && !usbPrinterName) {
    alert("يرجى اختيار طابعة USB من القائمة!");
    return;
  }

  const printerObj = {
    id: id || ('prn_' + Date.now()),
    name: name,
    section: section,
    connection_type: connType,
    ip: ip,
    port: 9100,
    usb_printer_name: usbPrinterName,
    paper_size: '80mm',
    is_active: true
  };

  await saveRestaurantPrinter(printerObj);
  cancelAddPrinterForm();
  renderDynamicPrintersList();
  alert(`✅ تم حفظ الطابعة [ ${name} ] بنجاح!`);
}
window.saveDynPrinter = saveDynPrinter;

async function editDynPrinter(id) {
  const printers = await fetchRestaurantPrinters();
  const p = printers.find(x => x.id === id);
  if (!p) return;

  showAddPrinterForm(id);
  document.getElementById('dyn-printer-id').value = p.id;
  document.getElementById('dyn-printer-name').value = p.name;
  document.getElementById('dyn-printer-section').value = p.section || 'kitchen';
  document.getElementById('dyn-printer-type').value = p.connection_type || 'ip';
  document.getElementById('dyn-printer-ip').value = p.ip || '192.168.1.102';
  onDynPrinterTypeChange();

  const usbSel = document.getElementById('dyn-printer-usb-select');
  if (usbSel && p.usb_printer_name) {
    usbSel.value = p.usb_printer_name;
  }
}
window.editDynPrinter = editDynPrinter;

async function deleteDynPrinter(id) {
  if (!confirm("هل أنت متأكد من حذف هذه الطابعة من النظام؟")) return;
  await deleteRestaurantPrinter(id);
  renderDynamicPrintersList();
}
window.deleteDynPrinter = deleteDynPrinter;

// طباعة بون المطبخ مع توجيه الأصناف المتخصصة لأقسامها (مثل الشواء أو البار)
async function printKitchenWithSubStations(order) {
  if (!order) return;
  
  // 1. طباعة البون الشامل على طابعة المطبخ الرئيسي 101
  if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'kitchen');
  }

  // 2. فحص الأصناف وتوجيه بونات الأقسام الفرعية المتخصصة
  if (!Array.isArray(order.items)) return;
  const stationItemsMap = new Map();
  let printers = [];
  try {
    printers = JSON.parse(localStorage.getItem('smart_emenu_printers') || '[]');
  } catch (e) {}

  order.items.forEach(item => {
    const assignedPrinterId = item.assigned_printer_id || item.assignedPrinterId;
    if (assignedPrinterId && assignedPrinterId !== 'p_kitchen_main' && assignedPrinterId !== 'kitchen') {
      if (!stationItemsMap.has(assignedPrinterId)) {
        stationItemsMap.set(assignedPrinterId, []);
      }
      stationItemsMap.get(assignedPrinterId).push(item);
    }
  });

  if (stationItemsMap.size === 0) return;

  const printSettings = getPrintSettings();
  const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  stationItemsMap.forEach(async (subItems, printerId) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) return;

    const subOrder = {
      ...order,
      id: `${order.id}-${printer.section || 'SEC'}`,
      items: subItems
    };

    const subText = formatKitchenTextTicket(subOrder, config, (printer.paper_size === '58mm'));
    try {
      await fetch(`${bridgeUrl}/print-station`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionType: printer.connection_type || 'ip',
          ip: printer.ip || '192.168.1.100',
          port: printer.port || 9100,
          usbPrinterName: printer.usb_printer_name || '',
          text: subText,
          cut: true,
          buzzer: true
        })
      });
    } catch (e) {
      console.warn(`Sub-station print error for [${printer.name}]:`, e);
    }
  });
}
window.printKitchenWithSubStations = printKitchenWithSubStations;

// -------------------------------------------------------------
// إنهاء جلسة الكاشير وطباعة تقرير الوردية واليومية (Z-Report)
// -------------------------------------------------------------
async function endCashierShiftAndPrintZReport() {
  const confirmEnd = confirm("هل أنت متأكد من إنهاء جلسة الكاشير وطباعة ملخص اليوم (Z-Report)؟");
  if (!confirmEnd) return;

  const orders = getStoredData('orders', []);
  const archive = getStoredData('accounting_archive', []);
  const allOrders = [...orders, ...archive];
  const uniqueOrders = new Map();
  allOrders.forEach(o => {
    if (o && o.id) uniqueOrders.set(String(o.id), o);
  });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // تصفية طلبات اليوم المحاسبة والمكتملة
  const todayCompleted = Array.from(uniqueOrders.values()).filter(o => {
    const isCompleted = (o.status === 'completed' || o.paidAt || o.completedAt);
    if (!isCompleted) return false;
    const orderTime = o.paidAt || o.completedAt || o.timestamp || 0;
    return orderTime >= startOfDay;
  });

  // تجميع إحصائيات الأصناف المباعة والمجموع الكلي
  const dishMap = new Map();
  let totalRevenue = 0;

  todayCompleted.forEach(order => {
    totalRevenue += (Number(order.total) || 0);
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const name = item.baseName || item.name || 'صنف غير محدد';
        const qty = Number(item.quantity) || 1;
        const currentQty = dishMap.get(name) || 0;
        dishMap.set(name, currentQty + qty);
      });
    }
  });

  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const session = (typeof getCurrentSession === 'function' ? getCurrentSession() : null) || (window.AuthCore ? window.AuthCore.getCurrentSession() : null);
  const cashierName = session?.name || session?.username || 'كاشير الوردية';
  const currency = config.currency || 'د.ع';
  const printSettings = getPrintSettings();
  const isSmallPaper = (printSettings.paperSize === '58mm');

  // توليد تقرير Z النصي المباشر
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const w = isSmallPaper ? 30 : 42;
  const div = "=".repeat(w);
  const subDiv = "-".repeat(w);

  let zText = `\n${div}\n`;
  zText += `      ${config.name || 'مطعم فحمة ودخان'}\n`;
  zText += `   ملخص نهاية الوردية اليومية (Z-Report)\n`;
  zText += `${div}\n`;
  zText += `التاريخ: ${dateStr}  |  الوقت: ${timeStr}\n`;
  zText += `الكاشير: ${cashierName}\n`;
  zText += `عدد الفواتير المنفذة: ${todayCompleted.length}\n`;
  zText += `${div}\n`;
  zText += `الأطباق والأصناف المباعة اليوم:\n`;
  zText += `${subDiv}\n`;
  zText += `العدد | اسم الصنف\n`;
  zText += `${subDiv}\n`;

  dishMap.forEach((qty, name) => {
    zText += `[ ${String(qty).padEnd(3)} ]  ${name}\n`;
  });

  zText += `${div}\n`;
  zText += `إجمالي المبيعات النهائي:\n`;
  zText += `>>>  ${totalRevenue.toLocaleString()} ${currency}  <<<\n`;
  zText += `${div}\n`;
  zText += `   تم إغلاق الوردية وحفظ السجلات بنجاح\n`;
  zText += `${div}\n\n`;

  // توليد قالب HTML للطباعة في المتصفح في حال كان الوسيط غير متصل
  let itemsRowsHtml = '';
  dishMap.forEach((qty, name) => {
    itemsRowsHtml += `
      <tr style="border-bottom: 1.5px dashed #666;">
        <td style="font-weight: 900; font-size: 16px; text-align: center; padding: 6px 2px; width: 25%;">
          <span style="border: 2px solid #000; padding: 2px 6px; border-radius: 6px; background: #fff;">${qty}</span>
        </td>
        <td style="font-weight: 900; font-size: 15px; padding: 6px 4px; width: 75%;">${name}</td>
      </tr>
    `;
  });

  const zHtml = `
    <div class="thermal-receipt" style="width: ${isSmallPaper ? '48mm' : '72mm'}; margin: 0 auto; color: #000; font-family: 'Cairo', monospace, sans-serif; line-height: 1.35; padding: 10px;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px;">
        <h2 style="font-size: 20px; font-weight: 900; margin: 0;">${config.name || 'مطعم فحمة ودخان'}</h2>
        <div style="font-size: 14px; font-weight: 900; margin-top: 4px; background: #000; color: #fff; padding: 4px; border-radius: 5px;">ملخص نهاية الوردية (Z-Report)</div>
      </div>
      <div style="font-size: 12px; padding: 6px 0; border-bottom: 2px solid #000;">
        <div style="display: flex; justify-content: space-between;"><span>التاريخ: <b>${dateStr}</b></span><span>الوقت: <b>${timeStr}</b></span></div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;"><span>الكاشير: <b>${cashierName}</b></span><span>عدد الفواتير: <b>${todayCompleted.length}</b></span></div>
      </div>
      <div style="margin-top: 6px;">
        <div style="font-size: 13px; font-weight: 900; margin-bottom: 4px; text-align: center;">الأطباق المباعة خلال الوردية:</div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #000; font-size: 13px;">
              <th style="padding: 4px; width: 25%;">العدد</th>
              <th style="text-align: right; padding: 4px; width: 75%;">اسم الصنف</th>
            </tr>
          </thead>
          <tbody>${itemsRowsHtml}</tbody>
        </table>
      </div>
      <div style="margin-top: 10px; border: 3px solid #000; padding: 8px; text-align: center; background: #f0f0f0; border-radius: 8px;">
        <div style="font-size: 13px; font-weight: 900;">إجمالي المبيعات النهائي:</div>
        <div style="font-size: 24px; font-weight: 900; font-family: monospace; margin-top: 4px;">${totalRevenue.toLocaleString()} ${currency}</div>
      </div>
      <div style="text-align: center; margin-top: 10px; font-size: 11px; font-weight: bold; border-top: 1.5px dashed #000; padding-top: 6px;">
        تم إنهاء الجلسة وإغلاق حسابات الوردية بنجاح ✅
      </div>
    </div>
  `;

  // إرسال للطباعة الصامتة
  const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
  let printedSilently = false;

  try {
    const res = await fetch(`${bridgeUrl}/print-station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionType: printSettings.cashierMode === 'windows' ? 'usb' : 'ip',
        ip: printSettings.cashierIp || '192.168.1.100',
        port: printSettings.cashierPort || 9100,
        usbPrinterName: printSettings.cashierPrinterName || '',
        text: zText,
        cut: true,
        buzzer: false
      })
    });
    if (res && res.ok) {
      printedSilently = true;
    }
  } catch (e) {}

  if (!printedSilently) {
    const ticketEl = document.getElementById('kitchen-print-ticket');
    if (ticketEl) {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${zHtml}</div>`;
      window.print();
    }
  }

  const logoutConfirm = confirm(`✅ تم طباعة ملخص نهاية الوردية (Z-Report) بإجمالي مبيعات [ ${totalRevenue.toLocaleString()} ${currency} ].\n\nهل ترغب في تسجيل الخروج الآن لإنهاء الجلسة تماماً؟`);
  if (logoutConfirm) {
    if (typeof logoutSession === 'function') {
      logoutSession();
    } else if (window.AuthCore && typeof window.AuthCore.logoutSession === 'function') {
      window.AuthCore.logoutSession();
    } else {
      window.location.replace('login.html');
    }
  }
}
window.endCashierShiftAndPrintZReport = endCashierShiftAndPrintZReport;

// -------------------------------------------------------------
// نافذة إعدادات الطابعات والطباعة الصامتة (100 كاشير + 101 مطبخ + الطابعات الإضافية)
// -------------------------------------------------------------
function openPrinterSettingsModal() {
  let modal = document.getElementById('printer-settings-modal');
  const currentSettings = getPrintSettings();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'printer-settings-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
      <div class="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right relative my-8 max-h-[90vh] overflow-y-auto">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🖨️</span>
            <div>
              <h3 class="text-base font-black text-white">إعدادات الطابعات والطباعة الصامتة</h3>
              <p class="text-xs text-slate-400">إدارة الطابعات الشبكية (IP) و USB وتخصيصها للكاشير والمطبخ</p>
            </div>
          </div>
          <button onclick="closePrinterSettingsModal()" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold">
            ✕
          </button>
        </div>

        <!-- مؤشر اتصال وسيط الطباعة المحلي -->
        <div id="ps-bridge-indicator" class="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span id="ps-status-dot" class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span id="ps-status-text" class="text-slate-300 font-bold">جاري فحص وسيط الطباعة المحلي...</span>
          </div>
          <button onclick="checkBridgeAndRefreshPrinters()" class="text-[11px] text-rose-400 font-bold hover:underline flex items-center gap-1">
            <span>🔄</span> <span>إعادة فحص</span>
          </button>
        </div>

        <!-- زر اختبار سريع لكلا الطابعتين معاً -->
        <button type="button" onclick="testBothPrinters()" class="w-full py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg">
          <span>⚡</span> <span>تجربة الطابعتين معاً (100 كاشير + 101 مطبخ)</span>
        </button>

        <!-- إدارة الطابعات المسجلة ديناميكياً (شبكية IP و USB) -->
        <div class="p-4 bg-slate-950 border border-amber-900/40 rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-amber-400 font-black text-xs">
              <span>🖨️</span>
              <span>طابعات المطعم المسجلة (شبكية IP و USB):</span>
            </div>
            <button type="button" onclick="showAddPrinterForm()" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] transition flex items-center gap-1 active:scale-95 shadow">
              <span>➕ إضافة طابعة</span>
            </button>
          </div>
          
          <div id="ps-printers-dynamic-list" class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div class="text-center py-2 text-xs text-slate-500">جاري تحميل الطابعات...</div>
          </div>

          <!-- نموذج إضافة / تعديل طابعة -->
          <div id="ps-add-printer-form" class="hidden p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2.5">
            <input type="hidden" id="dyn-printer-id" value="" />
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-slate-300 font-bold mb-1">اسم الطابعة:</label>
                <input type="text" id="dyn-printer-name" placeholder="مثال: طابعة المشاوي" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 font-bold mb-1">القسم:</label>
                <select id="dyn-printer-section" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                  <option value="kitchen">المطبخ الرئيسي / تحضير</option>
                  <option value="chicken">قسم الدجاج والطيور 🍗</option>
                  <option value="grill">المشاوي / الشواء 🥩</option>
                  <option value="cashier">الكاشير / حسابات 💵</option>
                  <option value="bar">المشروبات / البار 🍹</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-slate-300 font-bold mb-1">نوع التوصيل:</label>
                <select id="dyn-printer-type" onchange="onDynPrinterTypeChange()" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                  <option value="ip">شبكية Ethernet / IP</option>
                  <option value="usb">طابعة ويندوز USB</option>
                </select>
              </div>
              <div id="dyn-box-ip">
                <label class="block text-[10px] text-slate-300 font-bold mb-1">عنوان IP:</label>
                <input type="text" id="dyn-printer-ip" placeholder="192.168.1.102" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono" dir="ltr" />
              </div>
              <div id="dyn-box-usb" class="hidden">
                <label class="block text-[10px] text-slate-300 font-bold mb-1">طابعة ويندوز USB:</label>
                <select id="dyn-printer-usb-select" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                  <option value="">[ اختر من طابعات ويندوز ]</option>
                </select>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1">
              <button type="button" onclick="cancelAddPrinterForm()" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-bold">إلغاء</button>
              <button type="button" onclick="saveDynPrinter()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-black shadow">حفظ الطابعة ✅</button>
            </div>
          </div>
        </div>

        <!-- 1. قسم طابعة الكاشير (طابعة 1: 192.168.1.100) -->
        <div class="p-4 bg-slate-950 border border-emerald-900/40 rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-emerald-400 font-black text-xs">
              <span>💵</span>
              <span>1. طابعة الكاشير وفواتير الحساب (طابعة 1):</span>
            </div>
            <button type="button" onclick="testCashierPrinter()" class="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
              <span>🧪</span> <span>تجربة طابعة الكاشير (100)</span>
            </button>
          </div>

          <div class="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div class="md:col-span-2 space-y-1">
                <label class="block text-[10px] text-slate-400 font-bold">عنوان IP طابعة الكاشير:</label>
                <input type="text" id="ps-cashier-ip" placeholder="192.168.1.100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-emerald-400 font-mono text-xs text-left placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" dir="ltr" />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] text-slate-400 font-bold">المنفذ (Port):</label>
                <input type="number" id="ps-cashier-port" placeholder="9100" value="9100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono text-xs text-center focus:outline-none focus:border-emerald-500" dir="ltr" />
              </div>
            </div>

            <!-- خيار اختياري لطابعة ويندوز USB -->
            <div class="pt-2 border-t border-slate-800/80">
              <label class="block text-[10px] text-slate-400 mb-1">أو اختر طابعة USB مثبتة في ويندوز (اختياري):</label>
              <select id="ps-cashier-printer-select" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-emerald-500">
                <option value="">[ استخدام طابعة الشبكة IP 192.168.1.100 ]</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 2. قسم طابعة المطبخ (طابعة 2: 192.168.1.101) -->
        <div class="p-4 bg-slate-950 border border-rose-900/40 rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-rose-400 font-black text-xs">
              <span>👨‍🍳</span>
              <span>2. طابعة المطبخ وبونات التحضير (طابعة 2):</span>
            </div>
            <button type="button" onclick="testKitchenPrinter()" class="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
              <span>🧪</span> <span>تجربة طابعة المطبخ (101)</span>
            </button>
          </div>

          <div class="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div class="md:col-span-2 space-y-1">
                <label class="block text-[10px] text-slate-400 font-bold">عنوان IP طابعة المطبخ:</label>
                <input type="text" id="ps-kitchen-ip" placeholder="192.168.1.101" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-rose-400 font-mono text-xs text-left placeholder:text-slate-600 focus:outline-none focus:border-rose-500" dir="ltr" />
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] text-slate-400 font-bold">المنفذ (Port):</label>
                <input type="number" id="ps-kitchen-port" placeholder="9100" value="9100" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono text-xs text-center focus:outline-none focus:border-rose-500" dir="ltr" />
              </div>
            </div>
            <p class="text-[10px] text-slate-500">يتصل النظام بطابعة المطبخ (192.168.1.101) لإطلاق صفارة التنبيه وقص بون الطباخ آلياً.</p>
          </div>
        </div>

        <!-- 3. آلية توزيع الطباعة التلقائية (فردية لكل طابعة) -->
        <div class="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-2">
          <div class="flex items-center justify-between">
            <span class="block text-xs font-black text-white">3. نظام الطباعة المنفصل (منع الطباعة المزدوجة نهائياً):</span>
            <span class="text-[10px] text-emerald-400 font-bold">كل طابعة بزر مستقل ✨</span>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            تم توفير أزرار مستقلة في جميع الشاشات: زر لإرسال بون المطبخ (101)، وزر لطباعة فاتورة الحساب (100).
          </p>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <label class="p-2.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-rose-500 transition flex items-center gap-2">
              <input type="radio" name="printer-type-radio" value="kitchen" id="ps-type-kitchen" class="accent-rose-600" />
              <div>
                <div class="text-xs font-black text-white">👨‍🍳 بون المطبخ (101)</div>
              </div>
            </label>
            <label class="p-2.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-rose-500 transition flex items-center gap-2">
              <input type="radio" name="printer-type-radio" value="customer" id="ps-type-customer" class="accent-rose-600" />
              <div>
                <div class="text-xs font-black text-amber-300">🧾 فاتورة الحساب (100)</div>
              </div>
            </label>
          </div>
        </div>

        <!-- 4. خيارات إضافية: الحجم والطباعة الصامتة -->
        <div class="grid grid-cols-2 gap-2">
          <div class="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
            <span class="block text-[11px] font-bold text-slate-300">مقاس الورق الحراري:</span>
            <div class="flex gap-2 text-xs">
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="printer-size-radio" value="80mm" id="ps-size-80" class="accent-rose-600" />
                <span class="text-white text-xs">80mm عريض</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="printer-size-radio" value="58mm" id="ps-size-58" class="accent-rose-600" />
                <span class="text-white text-xs">58mm صغير</span>
              </label>
            </div>
          </div>

          <label class="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-2 cursor-pointer hover:border-rose-500 transition">
            <input type="checkbox" id="ps-silent-toggle" class="w-4 h-4 accent-rose-600 rounded" />
            <div>
              <div class="text-xs font-black text-white">الطباعة الصامتة الفورية</div>
              <div class="text-[10px] text-slate-400">تخطي شاشة المعاينة تماماً</div>
            </div>
          </label>
        <!-- 5. دليل إرشادي مرئي مدمج لشرح التعامل مع تغير عنوان الـ IP -->
        <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between cursor-pointer select-none" onclick="toggleIpTroubleGuide()">
            <div class="flex items-center gap-2">
              <span class="text-lg">📖</span>
              <h4 class="text-xs font-black text-amber-400">دليل استخراج وتحديث عنوان IP الطابعة في حال تغيره</h4>
            </div>
            <span id="ip-guide-toggle-icon" class="text-xs text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded-lg">عرض الشرح ▼</span>
          </div>

          <div id="ip-trouble-guide-content" class="space-y-2.5 text-xs text-slate-300 pt-1 border-t border-slate-800/80">
            <div class="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <b class="text-amber-300 block">1️⃣ كيف تعرف عنوان الـ IP الجديد للطابعة (ورقة الفحص الذاتي)؟</b>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                أطفئ الطابعة ⬅️ اضغط باستمرار على زر <b>FEED</b> ⬅️ شغّل زر الطاقة <b>POWER</b> مع الاستمرار بالضغط على FEED لمدة 4 ثوانٍ ثم ارفع إصبعك ⬅️ ستطبع الطابعة تلقائياً ورقة (Self-Test) يظهر فيها عنوان الـ IP الحالي بوضوح (مثال: <span class="font-mono text-emerald-400">192.168.1.105</span>).
              </p>
            </div>

            <div class="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <b class="text-emerald-300 block">2️⃣ كيف تحدث الـ IP في النظام إذا تغير؟</b>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                اضغط زر <b>تعديل ✏️</b> أمام الطابعة في قائمة الطابعات أعلاه ⬅️ اكتب عنوان الـ IP الجديد الذي ظهر في ورقة الفحص ⬅️ اضغط <b>حفظ الطابعة</b>. سيتعرف عليها النظام ووسيط الطباعة فورياً دون الحاجة لإعادة تشغيل أو تعديل أي برامج!
              </p>
            </div>

            <div class="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <b class="text-sky-300 block">3️⃣ كيف تثبت الـ IP نهائياً (الحل الجذري لمنع تغيره مستقبلاً)؟</b>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                للحفاظ على ثبات الطابعة عند إعادة تشغيل الراوتر، يُفضل الدخول لصفحة إعدادات الراوتر وربط الماك أدرس (MAC Address) الخاص بالطابعة بعنوان IP ثابت (DHCP IP Reservation).
              </p>
            </div>

            <div class="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
              <b class="text-purple-300 block">4️⃣ فحص وسيط الطباعة الصامت:</b>
              <p class="text-[11px] text-slate-400 leading-relaxed">
                تأكد من تشغيل وسيط الطباعة الصامت بالخلفية عبر تشغيل ملف <code class="text-rose-400 font-mono">install_printer_service.bat</code> مرة واحدة، وظهور النقطة الخضراء أعلاه: "متصل بالوسيط المحلي".
              </p>
            </div>
          </div>
        </div>

        <!-- زر الحفظ النهائي -->
        <button onclick="savePrinterSettingsFromModal()" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95">
          حفظ التفضيلات وتثبيت الطابعات ✅
        </button>

      </div>
    `;
    document.body.appendChild(modal);
  }

  // تعبئة الحقول بالقيم المخزنة الحالية
  const cashierIpInput = document.getElementById('ps-cashier-ip');
  if (cashierIpInput) cashierIpInput.value = currentSettings.cashierIp || '192.168.1.100';

  const cashierPortInput = document.getElementById('ps-cashier-port');
  if (cashierPortInput) cashierPortInput.value = currentSettings.cashierPort || 9100;

  const kitchenIpInput = document.getElementById('ps-kitchen-ip');
  if (kitchenIpInput) kitchenIpInput.value = currentSettings.kitchenIp || '192.168.1.101';

  const kitchenPortInput = document.getElementById('ps-kitchen-port');
  if (kitchenPortInput) kitchenPortInput.value = currentSettings.kitchenPort || 9100;

  const silentToggle = document.getElementById('ps-silent-toggle');
  if (silentToggle) silentToggle.checked = (currentSettings.silentPrint !== false);

  const sizeRadio = modal.querySelector(`input[name="printer-size-radio"][value="${currentSettings.paperSize || '80mm'}"]`);
  if (sizeRadio) sizeRadio.checked = true;

  const typeRadio = modal.querySelector(`input[name="printer-type-radio"][value="${currentSettings.ticketType || 'separate'}"]`);
  if (typeRadio) typeRadio.checked = true;

  modal.classList.remove('hidden');

  // جلب وعرض قائمة الطابعات المسجلة ديناميكياً
  renderDynamicPrintersList();

  // فحص الوسيط وجلب الطابعات
  checkBridgeAndRefreshPrinters();
}

// دالة فحص اتصال الوسيط وجلب الطابعات
async function checkBridgeAndRefreshPrinters() {
  const currentSettings = getPrintSettings();
  const dot = document.getElementById('ps-status-dot');
  const txt = document.getElementById('ps-status-text');
  const sel = document.getElementById('ps-cashier-printer-select');
  const dynUsbSel = document.getElementById('dyn-printer-usb-select');

  if (dot && txt) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
    txt.innerText = 'جاري التحقق من وسيط الطباعة المحلي...';
  }

  const probeUrls = [currentSettings.bridgeUrl, 'http://127.0.0.1:8080', 'http://127.0.0.1:9090', 'http://localhost:8080', 'http://localhost:9090'].filter(Boolean);
  let activeUrl = null;

  for (const u of [...new Set(probeUrls)]) {
    try {
      const res = await fetch(`${u}/status`, { method: 'GET' });
      if (res.ok) {
        activeUrl = u;
        break;
      }
    } catch (e) {}
  }

  if (activeUrl) {
    currentSettings.bridgeUrl = activeUrl;
    savePrintSettings(currentSettings);

    if (dot && txt) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
      const portNum = activeUrl.split(':').pop().replace(/\D/g, '');
      txt.innerHTML = `<span class="text-emerald-400 font-bold">وسيط الطباعة متصل ويعمل بنجاح 🟢 (المنفذ ${portNum}) - الطباعة الصامتة نشطة</span>`;
    }

    try {
      const prRes = await fetch(`${activeUrl}/printers`);
      if (prRes.ok) {
        const printers = await prRes.json();
        if (sel) {
          sel.innerHTML = '<option value="">[ استخدام طابعة الشبكة IP 192.168.1.100 ]</option>';
          printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.innerText = `${p.name} ${p.port ? `(${p.port})` : ''}`;
            if (p.name === currentSettings.cashierPrinterName) {
              opt.selected = true;
            }
            sel.appendChild(opt);
          });
        }
        if (dynUsbSel) {
          dynUsbSel.innerHTML = '<option value="">[ اختر من طابعات ويندوز ]</option>';
          printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.innerText = `${p.name} ${p.port ? `(${p.port})` : ''}`;
            dynUsbSel.appendChild(opt);
          });
        }
      }
    } catch (e) {}
    return;
  }

  if (dot && txt) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    txt.innerHTML = '<span class="text-rose-400 font-bold">وسيط الطباعة غير متصل 🔴</span> <span class="text-[10px] text-slate-400">(شغّل خدمة الطباعة الصامتة بالمجلد)</span>';
  }
}

// اختبار طابعة الكاشير (طابعة 1: 192.168.1.100)
async function testCashierPrinter() {
  const ip = (document.getElementById('ps-cashier-ip')?.value || '192.168.1.100').trim();
  const port = parseInt(document.getElementById('ps-cashier-port')?.value || '9100', 10);
  const sel = document.getElementById('ps-cashier-printer-select');
  const printerName = sel ? sel.value : '';
  const currentSettings = getPrintSettings();
  const bridgeUrl = currentSettings.bridgeUrl || 'http://127.0.0.1:8080';

  try {
    const res = await fetch(`${bridgeUrl}/test-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cashier',
        ip: ip,
        port: port,
        printerName: printerName,
        mode: printerName ? 'windows' : 'ip'
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ تم إرسال أمر الطباعة التجريبي لطابعة الكاشير (${printerName ? printerName : ip}) بنجاح!`);
    } else {
      alert("❌ تعذر الاتصال بطابعة الكاشير: " + (data.error || "تأكد من عنوان IP وتشغيل الطابعة واتصال الشبكة"));
    }
  } catch (err) {
    alert("❌ تعذر الوصول لوسيط الطباعة المحلي. تأكد من تشغيل ملف 'تشغيل_وسيط_الطباعة.bat' أولاً على المنفذ 8080.");
  }
}

// اختبار طابعة المطبخ (طابعة 2: 192.168.1.101)
async function testKitchenPrinter() {
  const ip = (document.getElementById('ps-kitchen-ip')?.value || '192.168.1.101').trim();
  const port = parseInt(document.getElementById('ps-kitchen-port')?.value || '9100', 10);
  const currentSettings = getPrintSettings();
  const bridgeUrl = currentSettings.bridgeUrl || 'http://127.0.0.1:8080';

  try {
    const res = await fetch(`${bridgeUrl}/test-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'kitchen',
        ip: ip,
        port: port
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ تم إرسال أمر الطباعة التجريبي لطابعة المطبخ (${ip}) بنجاح (مع إطلاق صفارة التنبيه)!`);
    } else {
      alert("❌ تعذر الاتصال بطابعة المطبخ: " + (data.error || "تأكد من عنوان IP وتشغيل الطابعة واتصال الشبكة"));
    }
  } catch (err) {
    alert("❌ تعذر الوصول لوسيط الطباعة المحلي. تأكد من تشغيل ملف 'تشغيل_وسيط_الطباعة.bat' أولاً على المنفذ 8080.");
  }
}

// اختبار الطابعتين معاً (100 كاشير + 101 مطبخ)
async function testBothPrinters() {
  const cashierIp = (document.getElementById('ps-cashier-ip')?.value || '192.168.1.100').trim();
  const kitchenIp = (document.getElementById('ps-kitchen-ip')?.value || '192.168.1.101').trim();
  const cashierPort = parseInt(document.getElementById('ps-cashier-port')?.value || '9100', 10);
  const sel = document.getElementById('ps-cashier-printer-select');
  const printerName = sel ? sel.value : '';
  const currentSettings = getPrintSettings();
  const bridgeUrl = currentSettings.bridgeUrl || 'http://127.0.0.1:8080';

  try {
    const res = await fetch(`${bridgeUrl}/test-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'both',
        cashierIp: cashierIp,
        kitchenIp: kitchenIp,
        port: cashierPort,
        printerName: printerName,
        mode: printerName ? 'windows' : 'ip'
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ تم إرسال أمر الطباعة التجريبي للطابعتين معاً بنجاح:\n- طابعة 1 (الكاشير): ${printerName ? printerName : cashierIp}\n- طابعة 2 (المطبخ): ${kitchenIp}`);
    } else {
      alert("❌ حدث خطأ في أحد الطابعتين أو كلاهما: " + (data.error || "تحقق من اتصال الشبكة للطابعات"));
    }
  } catch (err) {
    alert("❌ تعذر الوصول لوسيط الطباعة المحلي. تأكد من تشغيل ملف 'تشغيل_وسيط_الطباعة.bat' أولاً.");
  }
}

function closePrinterSettingsModal() {
  const modal = document.getElementById('printer-settings-modal');
  if (modal) modal.classList.add('hidden');
}

function savePrinterSettingsFromModal() {
  const sizeChecked = document.querySelector('input[name="printer-size-radio"]:checked');
  const typeChecked = document.querySelector('input[name="printer-type-radio"]:checked');
  const cashierIp = (document.getElementById('ps-cashier-ip')?.value || '192.168.1.100').trim();
  const cashierPort = parseInt(document.getElementById('ps-cashier-port')?.value || '9100', 10);
  const kitchenIp = (document.getElementById('ps-kitchen-ip')?.value || '192.168.1.101').trim();
  const kitchenPort = parseInt(document.getElementById('ps-kitchen-port')?.value || '9100', 10);
  const cashierPrinter = document.getElementById('ps-cashier-printer-select')?.value || '';
  const silentPrint = document.getElementById('ps-silent-toggle')?.checked ?? true;

  const current = getPrintSettings();
  const settings = {
    ...current,
    paperSize: sizeChecked ? sizeChecked.value : '80mm',
    ticketType: typeChecked ? typeChecked.value : 'customer',
    cashierMode: cashierPrinter ? 'windows' : 'ip',
    cashierIp: cashierIp,
    cashierPort: cashierPort,
    cashierPrinterName: cashierPrinter,
    kitchenMode: 'ip',
    kitchenIp: kitchenIp,
    kitchenPort: kitchenPort,
    silentPrint: silentPrint,
    autoDirectPrint: true
  };

  savePrintSettings(settings);
  closePrinterSettingsModal();
  alert(`✅ تم حفظ إعدادات الطابعات بنجاح!\n- طابعة 1 (الكاشير): ${cashierPrinter ? cashierPrinter : cashierIp}\n- طابعة 2 (المطبخ): ${kitchenIp}\n- نظام الطباعة الصامتة نشط.`);
}

// -------------------------------------------------------------
// إدارة عُهد وأرصدة السائقين وتخصيص السائق للطلب ودليل الـ IP
// -------------------------------------------------------------
function toggleIpTroubleGuide() {
  const content = document.getElementById('ip-trouble-guide-content');
  const icon = document.getElementById('ip-guide-toggle-icon');
  if (!content) return;
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    if (icon) icon.textContent = 'إخفاء الشرح ▲';
  } else {
    content.classList.add('hidden');
    if (icon) icon.textContent = 'عرض الشرح ▼';
  }
}
window.toggleIpTroubleGuide = toggleIpTroubleGuide;

let cachedRestaurantDrivers = [];
async function fetchRestaurantDrivers() {
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      const { data, error } = await client
        .from('restaurant_users')
        .select('*')
        .eq('restaurant_id', restId)
        .eq('role', 'driver');
      if (!error && Array.isArray(data) && data.length > 0) {
        cachedRestaurantDrivers = data;
        localStorage.setItem('smart_emenu_drivers_' + restId, JSON.stringify(data));
        return data;
      }
    } catch(e) {}
  }
  try {
    cachedRestaurantDrivers = JSON.parse(localStorage.getItem('smart_emenu_drivers_' + restId) || '[]');
  } catch(e) {}
  if (!cachedRestaurantDrivers || cachedRestaurantDrivers.length === 0) {
    cachedRestaurantDrivers = [
      { id: 'u_drv_1', full_name: 'محمد السريع', username: 'driver1', phone: '07701112233', role: 'driver', active: true },
      { id: 'u_drv_2', full_name: 'علي التوصيل', username: 'driver2', phone: '07702223344', role: 'driver', active: true }
    ];
  }
  return cachedRestaurantDrivers;
}
window.fetchRestaurantDrivers = fetchRestaurantDrivers;

function getCachedDriversOptions(currentDriverId) {
  if (!cachedRestaurantDrivers || cachedRestaurantDrivers.length === 0) {
    fetchRestaurantDrivers().then(() => {});
  }
  const drivers = cachedRestaurantDrivers || [];
  return drivers.map(d => {
    const isSelected = (d.id === currentDriverId || d.username === currentDriverId) ? 'selected' : '';
    return `<option value="${d.id}" data-name="${d.full_name || d.name || d.username}" ${isSelected}>${d.full_name || d.name || d.username}</option>`;
  }).join('');
}
window.getCachedDriversOptions = getCachedDriversOptions;

async function assignOrderDriver(orderId, driverId) {
  if (!orderId) return;
  const drivers = cachedRestaurantDrivers || [];
  const driver = drivers.find(d => d.id === driverId);
  const driverName = driver ? (driver.full_name || driver.name || driver.username) : '';

  const orders = getStoredData('orders', []);
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.driver_id = driverId || null;
    order.driver_name = driverName || null;
    order.delivery_status = driverId ? 'out_for_delivery' : 'pending_driver';
    saveStoredData('orders', orders);
  }

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      await client.from('restaurant_orders').update({
        driver_id: driverId || null,
        driver_name: driverName || null,
        delivery_status: driverId ? 'out_for_delivery' : 'pending_driver',
        updated_at: new Date().toISOString()
      }).eq('id', orderId);
    } catch(e) {}
  }
  loadCashierOrders();
  if (typeof showToast === 'function') {
    showToast(driverId ? `تم إسناد الطلب للسائق ${driverName} 🛵` : 'تم إلغاء إسناد السائق للطلب', 'success');
  }
}
window.assignOrderDriver = assignOrderDriver;

async function openDriverSettlementsModal() {
  let modal = document.getElementById('driver-settlements-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'driver-settlements-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-right relative my-8 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🛵</span>
          <div>
            <h3 class="text-base font-black text-white">إدارة عُهد وأرصدة سائقي التوصيل</h3>
            <p class="text-xs text-slate-400">كشف حساب النقد بعهدة كل سائق وتسوية وتصفير الصندوق</p>
          </div>
        </div>
        <button onclick="closeDriverSettlementsModal()" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold">
          ✕
        </button>
      </div>

      <div id="driver-settlements-body" class="space-y-3">
        <div class="text-center py-6 text-xs text-slate-400">جاري احتساب أرصدة السائقين والطلبات اليومية... ⏳</div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  renderDriverSettlementsBody();
}
window.openDriverSettlementsModal = openDriverSettlementsModal;

function closeDriverSettlementsModal() {
  const modal = document.getElementById('driver-settlements-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeDriverSettlementsModal = closeDriverSettlementsModal;

async function renderDriverSettlementsBody() {
  const container = document.getElementById('driver-settlements-body');
  if (!container) return;

  const drivers = await fetchRestaurantDrivers();
  const orders = getStoredData('orders', []);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const currency = config.currency || 'د.ع';

  if (!drivers || drivers.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">لا يوجد سائقين مسجلين حالياً.</div>`;
    return;
  }

  container.innerHTML = drivers.map(d => {
    const dOrders = orders.filter(o => {
      const isDel = (o.type === 'delivery' || o.order_type === 'delivery') && (o.status === 'completed' || o.delivery_status === 'delivered');
      const isDrv = (o.driver_id === d.id || (!o.driver_id && d.id === 'u_drv_1'));
      return isDel && isDrv && !o.driver_settled;
    });

    const totalCashCollected = dOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const totalFeesEarned = dOrders.reduce((sum, o) => sum + (parseFloat(o.deliveryFee || o.delivery_fee || 0) || 0), 0);
    const netToCashier = Math.max(0, totalCashCollected - totalFeesEarned);

    return `
      <div class="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 shadow-md">
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg font-black border border-sky-500/30">
              🛵
            </div>
            <div>
              <div class="text-sm font-black text-white">${d.full_name || d.name || d.username}</div>
              <div class="text-[11px] text-slate-400 font-mono">${d.phone || 'بدون هاتف'} ${d.vehicle_info ? `• ${d.vehicle_info}` : ''}</div>
            </div>
          </div>
          <span class="text-[10px] px-2.5 py-1 rounded-full font-bold ${dOrders.length > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
            ${dOrders.length} طلبات بعهدته
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <span class="text-[10px] text-slate-400 block mb-0.5">💵 النقد المحصل</span>
            <span class="text-xs sm:text-sm font-black text-emerald-400 font-mono">${totalCashCollected.toLocaleString()} ${currency}</span>
          </div>
          <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
            <span class="text-[10px] text-slate-400 block mb-0.5">🛵 عمولة التوصيل</span>
            <span class="text-xs sm:text-sm font-black text-amber-400 font-mono">${totalFeesEarned.toLocaleString()} ${currency}</span>
          </div>
          <div class="bg-slate-900 p-2.5 rounded-xl border border-indigo-500/40">
            <span class="text-[10px] text-indigo-300 block mb-0.5">🏦 الصافي للصندوق</span>
            <span class="text-xs sm:text-sm font-black text-white font-mono">${netToCashier.toLocaleString()} ${currency}</span>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button type="button" onclick="settleDriverBalance('${d.id}', '${d.full_name || d.name || d.username}', ${netToCashier}, ${totalCashCollected}, ${totalFeesEarned}, ${dOrders.length})" ${dOrders.length === 0 ? 'disabled' : ''} class="py-2 px-4 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md active:scale-95 ${dOrders.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}">
            <span>💰</span>
            <span>استلام النقد وتسوية العهدة (${netToCashier.toLocaleString()} ${currency})</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}
window.renderDriverSettlementsBody = renderDriverSettlementsBody;

async function settleDriverBalance(driverId, driverName, netAmount, cashCollected, feesEarned, ordersCount) {
  if (!confirm(`هل أنت متأكد من استلام مبلغ (${netAmount.toLocaleString()} د.ع) نقداً من السائق [${driverName}] وإغلاق عهدته لـ ${ordersCount} طلب؟`)) {
    return;
  }

  const orders = getStoredData('orders', []);
  const settledIds = [];
  orders.forEach(o => {
    const isDel = (o.type === 'delivery' || o.order_type === 'delivery') && (o.status === 'completed' || o.delivery_status === 'delivered');
    const isDrv = (o.driver_id === driverId || (!o.driver_id && driverId === 'u_drv_1'));
    if (isDel && isDrv && !o.driver_settled) {
      o.driver_settled = true;
      o.driver_settled_at = new Date().toISOString();
      settledIds.push(o.id);
    }
  });
  saveStoredData('orders', orders);

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client && settledIds.length > 0) {
    try {
      await client.from('restaurant_orders').update({
        driver_settled: true,
        driver_settled_at: new Date().toISOString()
      }).in('id', settledIds);
    } catch(e) {}
  }

  printDriverSettlementThermalTicket({
    driverName: driverName,
    driverId: driverId,
    netAmount: netAmount,
    cashCollected: cashCollected,
    feesEarned: feesEarned,
    ordersCount: ordersCount,
    settledAt: new Date()
  });

  alert(`✅ تمت تسوية عهدة السائق [${driverName}] بنجاح، وتصفير حسابه وإصدار الإيصال الحراري!`);
  renderDriverSettlementsBody();
}
window.settleDriverBalance = settleDriverBalance;

function printDriverSettlementThermalTicket(data) {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const currency = config.currency || 'د.ع';
  const printSettings = getPrintSettings();
  const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';

  const ticketText = `
================================
  إيصال تسوية عهدة سائق توصيل
================================
المطعم: ${config.name || 'مطعم فحمة ودخان'}
اسم السائق: ${data.driverName}
التاريخ: ${new Date(data.settledAt).toLocaleString('ar-IQ')}
--------------------------------
عدد الطلبات المسلمة: ${data.ordersCount} طلب
إجمالي النقد المحصل: ${data.cashCollected.toLocaleString()} ${currency}
عمولة التوصيل للسائق: -${data.feesEarned.toLocaleString()} ${currency}
--------------------------------
المبلغ المورد للصندوق: ${data.netAmount.toLocaleString()} ${currency}
الكاشير المستلم: كاشير الصندوق
================================
تمت التسوية بنجاح وتصفير العهدة.
`;

  try {
    fetch(`${bridgeUrl}/print-station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionType: printSettings.cashierMode || 'ip',
        ip: printSettings.cashierIp || '192.168.1.100',
        port: printSettings.cashierPort || 9100,
        text: ticketText,
        cut: true
      })
    }).catch(() => null);
  } catch(e) {}
}
window.printDriverSettlementThermalTicket = printDriverSettlementThermalTicket;


// =============================================================

function getAccountingReport(filterPreset = 'today', customDateStr = null) {
  const orders = getStoredData('orders', []);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const now = new Date();
  
  // تحديد نطاق التاريخ
  let startDate = new Date();
  let endDate = new Date();
  let reportTitle = "تقرير مبيعات اليوم";

  if (customDateStr) {
    const parts = customDateStr.split('-');
    startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    reportTitle = `تقرير يوم: ${customDateStr}`;
  } else if (filterPreset === 'today') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    reportTitle = `تقرير مبيعات اليوم (${now.toLocaleDateString('ar-IQ')})`;
  } else if (filterPreset === 'yesterday') {
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    reportTitle = "تقرير مبيعات الأمس";
  } else if (filterPreset === 'week') {
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    reportTitle = "تقرير آخر 7 أيام";
  } else if (filterPreset === 'month') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    reportTitle = "تقرير الشهر الحالي";
  } else if (filterPreset === 'all') {
    startDate = new Date(0);
    reportTitle = "التقرير المالي الشامل (كافة الفترات)";
  }

  // تصفية الطلبات - عزل صارم بحسب معرف المطعم النشط واحتساب الطلبات المكتملة والمحاسبة فقط
  const currentRestId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  const filteredOrders = orders.filter(o => {
    if (o.restaurant_id && o.restaurant_id !== currentRestId) return false;
    // التأكيد على عدم احتساب أي طلب غير مكتمل أو قيد التحضير أو معاد للكاشير ضمن الحسابات
    if (o.status !== 'completed' && !o.paidAt) return false;
    if (o.status === 'cancelled' || o.status === 'in_kitchen' || o.status === 'preparing' || o.status === 'pending_kitchen' || o.status === 'pending_cashier') return false;
    const oTime = o.timestamp ? new Date(o.timestamp) : new Date(o.createdAt || Date.now());
    return oTime >= startDate && oTime <= endDate;
  });

  // الحسابات المالية
  let totalRevenue = 0;
  let dineInSales = 0;
  let dineInCount = 0;
  let takeawaySales = 0;
  let takeawayCount = 0;
  let deliverySales = 0;
  let deliveryCount = 0;

  const dishMap = {};

  filteredOrders.forEach(o => {
    const orderTotal = parseFloat(o.total) || 0;
    totalRevenue += orderTotal;

    const type = (o.type || '').toLowerCase();
    if (type === 'dinein' || type === 'dine-in' || o.tableNumber) {
      dineInSales += orderTotal;
      dineInCount++;
    } else if (type === 'delivery') {
      deliverySales += orderTotal;
      deliveryCount++;
    } else {
      takeawaySales += orderTotal;
      takeawayCount++;
    }

    if (Array.isArray(o.items)) {
      o.items.forEach(item => {
        const dishId = item.id || item.name;
        if (!dishMap[dishId]) {
          dishMap[dishId] = {
            id: item.id,
            name: item.name,
            price: item.price || 0,
            quantity: 0,
            totalRevenue: 0
          };
        }
        const q = parseInt(item.quantity) || 1;
        const p = parseFloat(item.price) || 0;
        dishMap[dishId].quantity += q;
        dishMap[dishId].totalRevenue += (q * p);
      });
    }
  });

  const topDishes = Object.values(dishMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
  const avgOrderValue = filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0;

  return {
    title: reportTitle,
    generatedAt: new Date().toLocaleString('ar-IQ'),
    startDate: startDate.toLocaleDateString('ar-IQ'),
    endDate: endDate.toLocaleDateString('ar-IQ'),
    currency: config.currency,
    restaurantName: config.name,
    totalRevenue,
    totalOrders: filteredOrders.length,
    dineInSales,
    dineInCount,
    takeawaySales,
    takeawayCount,
    deliverySales,
    deliveryCount,
    avgOrderValue,
    topDishes,
    orders: filteredOrders
  };
}

function getEndOfDayTicketHtml(report) {
  const settings = getPrintSettings();
  const is58mm = settings.paperSize === '58mm';
  const widthClass = is58mm ? 'max-w-[58mm] text-[10px]' : 'max-w-[80mm] text-xs';

  let dishesRows = report.topDishes.map((d, i) => `
    <tr style="border-bottom: 1px dashed #bbb; font-size: ${is58mm ? '9px' : '11px'};">
      <td style="padding: 3px 0; text-align: right;">${i + 1}. ${d.name}</td>
      <td style="padding: 3px 0; text-align: center; font-weight: bold;">×${d.quantity}</td>
      <td style="padding: 3px 0; text-align: left; font-weight: bold;">${d.totalRevenue.toLocaleString()}</td>
    </tr>
  `).join('');

  if (!dishesRows) {
    dishesRows = `<tr><td colspan="3" style="text-align: center; padding: 10px; color: #888;">لا توجد مبيعات مسجلة لهذه الفترة</td></tr>`;
  }

  return `
    <div class="thermal-ticket ${widthClass}" style="margin: 0 auto; padding: 8px; font-family: monospace, sans-serif; color: #000; background: #fff; direction: rtl; text-align: right;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
        <h2 style="font-size: ${is58mm ? '13px' : '16px'}; font-weight: 900; margin: 0;">${report.restaurantName}</h2>
        <div style="font-size: ${is58mm ? '10px' : '12px'}; font-weight: bold; margin-top: 4px; background: #000; color: #fff; padding: 2px 6px; border-radius: 4px; display: inline-block;">
          📋 تقرير نهاية اليوم (Z-Report)
        </div>
        <div style="font-size: 10px; margin-top: 4px; color: #444;">
          الفترة: ${report.title}
        </div>
        <div style="font-size: 9px; color: #666;">
          وقت الطباعة: ${report.generatedAt}
        </div>
      </div>

      <!-- الملخص المالي -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: ${is58mm ? '10px' : '11px'};">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 3px;">
          <span>إجمالي المبيعات الكلية:</span>
          <span style="font-size: ${is58mm ? '12px' : '14px'}; font-weight: 900;">${report.totalRevenue.toLocaleString()} ${report.currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #333;">
          <span>عدد الفواتير المنفذة:</span>
          <span style="font-weight: bold;">${report.totalOrders} طلب</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #333;">
          <span>متوسط قيمة الفاتورة:</span>
          <span style="font-weight: bold;">${report.avgOrderValue.toLocaleString()} ${report.currency}</span>
        </div>
      </div>

      <!-- تفصيل القنوات -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 10px;">
        <div style="font-weight: bold; margin-bottom: 3px;">📊 تفصيل قنوات البيع:</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>🍽️ مبيعات الصالة (${report.dineInCount} طلب):</span>
          <span style="font-weight: bold;">${report.dineInSales.toLocaleString()} ${report.currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>🛵 مبيعات التوصيل والسفري (${report.takeawayCount + report.deliveryCount} طلب):</span>
          <span style="font-weight: bold;">${(report.takeawaySales + report.deliverySales).toLocaleString()} ${report.currency}</span>
        </div>
      </div>

      <!-- الأصناف المباعة -->
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">🍽️ الأصناف الأكثر مبيعاً:</div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 9px; font-weight: bold;">
              <th style="text-align: right; padding-bottom: 2px;">الصنف</th>
              <th style="text-align: center; padding-bottom: 2px;">الكمية</th>
              <th style="text-align: left; padding-bottom: 2px;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${dishesRows}
          </tbody>
        </table>
      </div>

      <!-- التوقيع والإغلاق -->
      <div style="text-align: center; font-size: 9px; color: #555; margin-top: 10px;">
        <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dotted #888;">
          <span>توقيع الكاشير: ...............</span>
          <span>توقيع المدير: ...............</span>
        </div>
        <div style="margin-top: 10px; font-weight: bold; font-size: 8px;">
          تم استخراج التقرير بواسطة نظام Smart E-Menu (emattec 07702265652)
        </div>
      </div>
    </div>
  `;
}

function printEndOfDayReportDirect(filterPreset = 'today', customDateStr = null) {
  const report = getAccountingReport(filterPreset, customDateStr);
  const ticketHtml = getEndOfDayTicketHtml(report);

  let printContainer = document.getElementById('kitchen-print-ticket');
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = 'kitchen-print-ticket';
    printContainer.className = 'print-only';
    document.body.appendChild(printContainer);
  }

  printContainer.innerHTML = ticketHtml;
  setTimeout(() => {
    window.print();
  }, 100);
}

function exportAccountingReportCSV(filterPreset = 'today', customDateStr = null) {
  const report = getAccountingReport(filterPreset, customDateStr);
  
  let csvContent = "\uFEFF"; // UTF-8 BOM for Arabic support in Excel
  csvContent += `تقرير مبيعات المطعم,${report.restaurantName}\n`;
  csvContent += `الفترة,${report.title}\n`;
  csvContent += `تاريخ التوليد,${report.generatedAt}\n\n`;
  
  csvContent += "المؤشر المالي,القيمة,العملة\n";
  csvContent += `إجمالي المبيعات الكلية,${report.totalRevenue},${report.currency}\n`;
  csvContent += `عدد الطلبات والفواتير,${report.totalOrders},طلب\n`;
  csvContent += `مبيعات الصالة,${report.dineInSales},${report.currency}\n`;
  csvContent += `مبيعات التوصيل والسفري,${report.takeawaySales + report.deliverySales},${report.currency}\n`;
  csvContent += `متوسط قيمة الفاتورة,${report.avgOrderValue},${report.currency}\n\n`;

  csvContent += "الأصناف الأكثر مبيعاً:\n";
  csvContent += "اسم الصنف,الكمية المباعة,سعر الوحدة,إجمالي الإيراد\n";
  report.topDishes.forEach(d => {
    csvContent += `"${d.name}",${d.quantity},${d.price},${d.totalRevenue}\n`;
  });

  csvContent += "\nسجل الفواتير التفصيلي:\n";
  csvContent += "رقم الطلب,الوقت والتاريخ,نوع الطلب,المبلغ الإجمالي,الحالة\n";
  report.orders.forEach(o => {
    const oTime = o.timestamp ? new Date(o.timestamp).toLocaleTimeString('ar-IQ') : '-';
    csvContent += `"${o.id || '-'}",${oTime},"${o.type || '-'}",${o.total || 0},"${o.status || '-'}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `EOD_Report_${report.restaurantName}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// 10. دوال إدارة صور الأطباق (معاينة، رفع من الجهاز، وتنزيل)
// -------------------------------------------------------------
function handleDishImageUpload(fileInput, targetUrlInputId, previewImgId) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];

  // التحقق من أن الملف صورة
  if (!file.type.startsWith('image/')) {
    alert("يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP) 📸");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    const urlInput = document.getElementById(targetUrlInputId);
    const previewImg = document.getElementById(previewImgId);

    if (urlInput) urlInput.value = base64Data;
    if (previewImg) previewImg.src = base64Data;
  };
  reader.readAsDataURL(file);
}

function updateDishImagePreview(url, previewImgId) {
  const previewImg = document.getElementById(previewImgId);
  if (!previewImg) return;
  if (url && url.trim()) {
    previewImg.src = url.trim();
  } else {
    previewImg.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120';
  }
}

async function downloadCurrentDishImage(urlInputId, nameInputId) {
  const urlInput = document.getElementById(urlInputId);
  const nameInput = document.getElementById(nameInputId);
  
  const imgUrl = urlInput ? urlInput.value.trim() : '';
  const dishName = (nameInput ? nameInput.value.trim() : '') || 'dish-image';

  if (!imgUrl) {
    alert("لا توجد صورة محددة لتنزيلها حالياً! 📸");
    return;
  }

  try {
    if (imgUrl.startsWith('data:image/')) {
      // صورة Base64 مرفوعة من الجهاز
      const a = document.createElement('a');
      a.href = imgUrl;
      a.download = `${dishName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // صورة من رابط إنترنت (URL)
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${dishName}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err) {
    // في حال وجود قيود CORS في بعض الروابط الخارجية، يتم فتح الصورة في نافذة جديدة
    window.open(imgUrl, '_blank');
  }
}

// تشغيل التهيئة
initDatabase();


/* === qr.js === */
/**
 * Smart E-Menu - Table QR Generator & Image Downloader
 * توليد باركود الطاولات استناداً لرابط موقع المطعم وتنزيل الصور للطباعة
 */

// مزامنة إعدادات المطعم ورابط النشر سحابياً لحظياً
async function syncRestaurantConfigFromSupabase() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  if (!client) return getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  try {
    const { data, error } = await client.from('restaurants').select('*').eq('id', restId).single();
    if (data && !error) {
      let config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
      if (data.name) config.name = data.name;
      if (data.name_en) config.nameEn = data.name_en;
      if (data.tagline) config.tagline = data.tagline;
      if (data.published_url) config.publishedUrl = data.published_url;
      else if (data.website_url) config.publishedUrl = data.website_url;
      if (data.tables_count) config.tablesCount = Number(data.tables_count);
      if (data.logo) config.logo = data.logo;
      if (data.currency) config.currency = data.currency;
      if (data.address) config.address = data.address;
      if (data.working_hours) config.workingHours = data.working_hours;
      if (data.holidays) config.holidays = data.holidays;
      if (data.wifi_name) config.wifiName = data.wifi_name;
      if (data.wifi_pass) config.wifiPass = data.wifi_pass;
      if (data.printer_paper_size) config.printerPaperSize = data.printer_paper_size;

      setStoredData('config', config);
      return config;
    }
  } catch (e) {
    console.warn("syncRestaurantConfigFromSupabase error:", e);
  }
  return getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
}

function getMenuTargetBaseUrl() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  if (config.publishedUrl && config.publishedUrl.trim()) {
    let url = config.publishedUrl.trim();
    // إزالة علامة / أو index.html من النهاية لضمان التنسيق
    url = url.replace(/\/index\.html$/i, '').replace(/\/$/, '');
    return url;
  }
  // في حال لم يتم تحديد رابط النشر، استخدام الرابط الحالي
  return window.location.origin + window.location.pathname.replace(/\/admin\.html$/i, '').replace(/\/cashier\.html$/i, '').replace(/\/captain\.html$/i, '').replace(/\/index\.html$/i, '').replace(/\/$/, '');
}

function generateTableQRCode(tableNumber) {
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  const baseUrl = getMenuTargetBaseUrl();
  
  let targetUrl = '';
  try {
    const fullBase = baseUrl.startsWith('http') ? baseUrl : (window.location.origin + (baseUrl.startsWith('/') ? '' : '/') + baseUrl);
    const parsed = new URL(fullBase);
    parsed.pathname = parsed.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '') + '/index.html';
    parsed.searchParams.set('rest', restId);
    if (tableNumber !== null && tableNumber !== undefined && tableNumber !== '' && tableNumber !== 0) {
      parsed.searchParams.set('table', tableNumber);
    } else {
      parsed.searchParams.delete('table');
    }
    targetUrl = parsed.toString();
  } catch (e) {
    const cleanBase = baseUrl.replace(/\/index\.html$/i, '').replace(/\/$/, '');
    const tableParam = (tableNumber !== null && tableNumber !== undefined && tableNumber !== '' && tableNumber !== 0) ? `&table=${tableNumber}` : '';
    targetUrl = `${cleanBase}/index.html?rest=${encodeURIComponent(restId)}${tableParam}`;
  }
  
  // توليد صورة باركود عالية الدقة والوضوح قابلة للطباعة
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(targetUrl)}&color=0b1120&bgcolor=ffffff&margin=2`;
  
  return {
    tableNumber,
    targetUrl,
    qrImageUrl
  };
}

function renderTableQRCardsContainer(containerId, customCount = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const tablesCount = customCount !== null ? parseInt(customCount) : (parseInt(config.tablesCount) || 20);

  let html = '';

  // 1. بطاقة الباركود العام للمطعم (للسفري / التوصيل / الملصقات الإعلانية / واجهة المحل)
  const generalQR = generateTableQRCode(null);
  html += `
    <div class="bg-gradient-to-b from-rose-50 to-white text-slate-900 rounded-3xl p-5 shadow-xl border-2 border-rose-500 text-center flex flex-col items-center justify-between relative group transition">
      <div class="w-full border-b border-rose-200 pb-2 mb-3">
        <div class="inline-block px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black tracking-wider mb-1 shadow-sm">⭐ الباركود العام</div>
        <div class="text-[11px] font-extrabold text-rose-700 tracking-wider">${config.name}</div>
        <div class="text-base font-black text-slate-900 mt-0.5">منيو المطعم العام (سفري / صالة)</div>
      </div>

      <div class="p-2 bg-white rounded-2xl shadow-inner border border-rose-200 mb-3 relative">
        <img src="${generalQR.qrImageUrl}" alt="QR General" class="w-40 h-40 mx-auto object-contain" loading="lazy" />
      </div>

      <div class="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg mb-2 max-w-full truncate dir-ltr" title="${generalQR.targetUrl}">
        ${generalQR.targetUrl}
      </div>

      <div class="text-[11px] text-slate-600 font-medium mb-3 leading-tight">
        امسح الرمز لتصفح المنيو بدون تحديد طاولة (مناسب لطلبات السفري والمدخل) 📱🍽️
      </div>

      <div class="flex gap-2 w-full pt-2 border-t border-rose-100">
        <button onclick="downloadQRCodeImageDirectly(0, '${generalQR.qrImageUrl}')" class="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow">
          <span>تنزيل صورة</span>
          <span>💾</span>
        </button>
        <button onclick="printSingleTableQR(0, '${generalQR.qrImageUrl}', '${generalQR.targetUrl}')" class="py-2 px-3 bg-white text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition border border-rose-300">
          🖨️ طباعة
        </button>
      </div>
    </div>
  `;

  // 2. بطاقات باركود الطاولات من طاولة 1 إلى الحد الأقصى
  for (let i = 1; i <= tablesCount; i++) {
    const qrData = generateTableQRCode(i);
    html += `
      <div class="bg-white text-slate-900 rounded-3xl p-5 shadow-xl border-2 border-slate-200 text-center flex flex-col items-center justify-between relative group hover:border-rose-500 transition">
        
        <div class="w-full border-b border-slate-200 pb-2 mb-3">
          <div class="text-[11px] font-extrabold text-rose-600 tracking-wider">${config.name}</div>
          <div class="text-xl font-black text-slate-900 mt-0.5">طاولة رقم [ ${i} ]</div>
        </div>

        <div class="p-2 bg-white rounded-2xl shadow-inner border border-slate-200 mb-3 relative">
          <img src="${qrData.qrImageUrl}" alt="QR Table ${i}" class="w-40 h-40 mx-auto object-contain" loading="lazy" />
        </div>

        <div class="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded mb-2 max-w-full truncate dir-ltr" title="${qrData.targetUrl}">
          ${qrData.targetUrl}
        </div>

        <div class="text-[11px] text-slate-600 font-medium mb-3 leading-tight">
          امسح الرمز لعرض المنيو والطلب من طاولة ${i} مباشرة 🍽️
        </div>

        <div class="flex gap-2 w-full pt-2 border-t border-slate-100">
          <button onclick="downloadQRCodeImageDirectly(${i}, '${qrData.qrImageUrl}')" class="flex-1 py-2 px-3 bg-slate-900 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow">
            <span>تنزيل صورة</span>
            <span>💾</span>
          </button>
          <button onclick="printSingleTableQR(${i}, '${qrData.qrImageUrl}', '${qrData.targetUrl}')" class="py-2 px-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition border border-rose-200">
            🖨️ طباعة
          </button>
        </div>

      </div>
    `;
  }
  container.innerHTML = html;
}

// تنزيل صورة الباركود كملف PNG/JPG بجودة عالية
function downloadQRCodeImageDirectly(tableNumber, qrImageUrl) {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const label = (tableNumber && tableNumber !== 0) ? `طاولة-${tableNumber}` : 'المنيو-العام';
  
  // إنشاء رابط تحميل مباشر
  fetch(qrImageUrl)
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = `QR-${label}-${config.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    })
    .catch(() => {
      window.open(qrImageUrl, '_blank');
    });
}

function printSingleTableQR(tableNumber, qrUrl, targetUrl = '') {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const isGeneral = (!tableNumber || tableNumber === 0);
  const titleText = isGeneral ? 'منيو المطعم الرقمي (سفري / صالة)' : `طاولة رقم [ ${tableNumber} ]`;
  const hintText = isGeneral 
    ? 'امسح الباركود بكاميرا هاتفك لتصفح المنيو والطلب مباشرة 📱🍽️' 
    : `امسح الباركود بكاميرا هاتفك لتصفح المنيو والطلب من طاولة ${tableNumber} مباشرة 📱🍽️`;

  const printWindow = window.open('', '_blank', 'width=500,height=680');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>${titleText} - ${config.name}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 30px; margin: 0; background: #fff; }
        .card { border: 3px solid #e11d48; border-radius: 24px; padding: 25px; max-width: 320px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .logo { font-size: 16px; font-weight: bold; color: #e11d48; margin-bottom: 4px; }
        .title { font-size: 22px; font-weight: 900; margin-bottom: 12px; color: #0f172a; }
        .qr { width: 220px; height: 220px; margin: 8px auto; display: block; }
        .hint { font-size: 12px; color: #475569; margin-top: 12px; font-weight: 500; }
        .url { font-size: 9px; font-family: monospace; color: #94a3b8; margin-top: 8px; direction: ltr; word-break: break-all; }
        .footer { font-size: 10px; color: #94a3b8; margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">${config.name}</div>
        <div class="title">${titleText}</div>
        <img src="${qrUrl}" class="qr" onload="window.print();" />
        <div class="hint">${hintText}</div>
        ${targetUrl ? `<div class="url">${targetUrl}</div>` : ''}
        <div class="footer">المنيو الرقمي الذكي - نظام إدارة المطاعم</div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/* === cashier.js === */
/**
 * Smart E-Menu - Cashier POS & Menu Management Controller
 * صفحة الكاشير: أخذ الطلبات الهاتفية والسريعة (سفري / صالة / توصيل)، وتعديل وتوفر الأطباق
 */

let cashierCurrentCat = 'all';
let cashierSearch = '';

// متغيرات قسم الـ POS لأخذ الطلبات عند الكاشير
let cashierOrderType = 'dine-in'; // 'dine-in' | 'takeaway' | 'delivery'
let cashierPOSCart = [];
let cashierPOSCat = 'all';
let cashierPOSSearch = '';
window.getCashierCart = () => cashierPOSCart;
window.getCashierOrderType = () => cashierOrderType;
window.getSelectedCashierTable = () => selectedCashierTable;

// -------------------------------------------------------------
// درج القائمة الجانبي للكاشير (--- زر)
// -------------------------------------------------------------
function openCashierMenuSidebar() {
  const m = document.getElementById('cashier-menu-sidebar');
  if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function closeCSidebar() {
  const m = document.getElementById('cashier-menu-sidebar');
  if (m) { m.classList.add('hidden'); document.body.style.overflow = 'auto'; }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof fetchUsersFromSupabase === 'function') fetchUsersFromSupabase();
  initCashierPortal();
});

function initCashierPortal() {
  const loginEl = document.getElementById('cashier-login-view');
  const workEl = document.getElementById('cashier-workspace-view');
  if (!loginEl && !workEl) return; // ليس في صفحة الكاشير

  const session = getCurrentSession();

  if (!session || (session.role !== 'admin' && session.role !== 'cashier' && session.role !== 'super_admin')) {
    const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
    window.location.replace('login.html?role=cashier&rest=' + encodeURIComponent(restId));
    return;
  }

  showCashierWorkspace(session);
}

function showCashierLoginScreen() {
  const loginEl = document.getElementById('cashier-login-view');
  const workEl = document.getElementById('cashier-workspace-view');
  if (loginEl) loginEl.classList.remove('hidden');
  if (workEl) workEl.classList.add('hidden');

  // إفراغ حقول الدخول تماماً لضمان الخصوصية والأمان
  const usernameInput = document.getElementById('cashier-username-input');
  const pinInput = document.getElementById('cashier-pin-input');
  const rememberCheckbox = document.getElementById('cashier-remember-me');
  if (usernameInput) usernameInput.value = '';
  if (pinInput) pinInput.value = '';
  if (rememberCheckbox) rememberCheckbox.checked = false;
  try { resetFailedAttempts(); } catch(e){}
}

async function handleCashierLogin(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const usernameInput = document.getElementById('cashier-username-input');
  const pinInput      = document.getElementById('cashier-pin-input');
  const errorEl       = document.getElementById('cashier-login-error');
  const btnEl         = document.getElementById('cashier-login-btn');
  const rememberChk   = document.getElementById('cashier-remember-me');

  const username   = usernameInput ? usernameInput.value.trim() : '';
  const pin        = pinInput ? pinInput.value.trim() : '';
  const rememberMe = rememberChk ? rememberChk.checked : true;

  if (!username) {
    if (errorEl) {
      errorEl.textContent = 'يرجى إدخال اسم المستخدم!';
      errorEl.classList.remove('hidden');
    }
    return false;
  }

  if (!pin || pin.length < 4) {
    if (errorEl) {
      errorEl.textContent = 'يرجى إدخال كلمة المرور أو الرمز (4 خانات على الأقل)!';
      errorEl.classList.remove('hidden');
    }
    return false;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span>جارٍ التحقق... ⏳</span>';
  }
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const res = (typeof loginUserAsync === 'function')
      ? await loginUserAsync(username, pin, rememberMe)
      : { success: false, message: 'وحدة تسجيل الدخول غير متوفرة' };

    if (!res || !res.success) {
      if (errorEl) {
        errorEl.textContent = (res && res.message) ? res.message : 'اسم المستخدم أو رمز الدخول غير صحيح!';
        errorEl.classList.remove('hidden');
      }
      return false;
    }

    if (errorEl) errorEl.classList.add('hidden');

    const role = res.role || 'cashier';
    const restId = res.restaurantId || (typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan');
    const restParam = restId ? `?rest=${encodeURIComponent(restId)}` : '';

    // توجيه الكابتن لصفحته الخاصة
    if (role === 'captain') {
      window.location.href = 'captain.html' + restParam;
      return true;
    }
    if (role === 'super_admin' || role === 'assistant_super_admin') {
      window.location.href = 'super-admin.html';
      return true;
    }

    // الكاشير والمدير (Admin) يدخلان لشاشة عمل الكاشير مباشرة
    showCashierWorkspace(res.session || res);
    return true;

  } catch (err) {
    console.error('Login error:', err);
    if (errorEl) {
      errorEl.textContent = 'حدث خطأ أثناء محاولة الدخول: ' + (err.message || 'خطأ غير معروف');
      errorEl.classList.remove('hidden');
    }
    return false;
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = '<span>تسجيل الدخول 🚀</span>';
    }
  }
}
window.handleCashierLogin = handleCashierLogin;
window.loginUserAsync = loginUserAsync;
function showCashierWorkspace(session) {
  const loginEl = document.getElementById('cashier-login-view');
  const workEl = document.getElementById('cashier-workspace-view');
  if (loginEl) loginEl.classList.add('hidden');
  if (workEl) workEl.classList.remove('hidden');

  renderCashierStats();
  
  // تهيئة قسم الطلبات السريعة (POS) والضبط الافتراضي على الصالة (طاولة)
  setCashierOrderType('dine-in');
  renderCashierTablesGrid();
  renderCashierPOSCategories();
  renderCashierPOSDishes();
  updateCashierCartUI();

  // تهيئة قسم إدارة المنيو
  renderCashierCategories();
  renderCashierDishes();
  loadCashierOrders();
  syncMenuFromSupabase();  // 乇亘胤 丕賱亘丨孬 賮賷 賯爻賲 丕賱賭 POS
  const posSearchInput = document.getElementById('cashier-pos-search');
  if (posSearchInput) {
    posSearchInput.addEventListener('input', (e) => {
      cashierPOSSearch = e.target.value.toLowerCase().trim();
      renderCashierPOSDishes();
    });
  }

  // 乇亘胤 丕賱亘丨孬 賮賷 賯爻賲 鬲毓丿賷賱 丕賱賲賳賷賵
  const searchInput = document.getElementById('cashier-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      cashierSearch = e.target.value.toLowerCase().trim();
      renderCashierDishes();
    });
  }

  // تشغيل الاستماع اللحظي للطلبات الواردة الجديدة من المنيو
  startCashierLiveSync();
}

let cashierAppendingOrderId = null;
let selectedCashierTable = 1;

window.cashierTableAlerts = window.cashierTableAlerts || {};

window.dismissTableAlert = function(tNum) {
  if (window.cashierTableAlerts && window.cashierTableAlerts[tNum]) {
    delete window.cashierTableAlerts[tNum];
    renderCashierTablesGrid();
  }
};

window.handleCashierTableServiceAlert = function(type, payload) {
  if (!payload || !payload.tableNumber) return;
  const tNum = parseInt(payload.tableNumber);
  if (isNaN(tNum) || tNum <= 0) return;

  window.cashierTableAlerts[tNum] = {
    type: type,
    time: payload.timestamp || Date.now(),
    tableNumber: tNum
  };

  playCashierOrderChime();
  renderCashierTablesGrid();

  const isBill = (type === 'request_bill');
  const alertTitle = isBill ? `💳 طلب فاتورة وحساب!` : `🛎️ نداء كابتن الصالة!`;
  const alertMsg = isBill ? `طاولة رقم [ ${tNum} ] تطلب الفاتورة والدفع فوراً!` : `طاولة رقم [ ${tNum} ] تطلب حضور الكابتن / الخدمة!`;

  if (typeof showCashierToast === 'function') {
    showCashierToast(`${alertTitle} ${alertMsg}`, isBill ? '💳' : '🛎️');
  }
};

function renderCashierTablesGrid() {
  const container = document.getElementById('cashier-tables-grid');
  if (!container) return;

  const config = (typeof getStoredData === 'function') ? getStoredData('config', DEFAULT_RESTAURANT_CONFIG) : DEFAULT_RESTAURANT_CONFIG;
  const tablesCount = (config && config.tablesCount) ? config.tablesCount : 20;
  const orders = (typeof getStoredData === 'function') ? getStoredData('orders', []) : [];
  
  const activeOrdersMap = new Map();
  orders.filter(o => o.type === 'dine-in' && o.status !== 'completed' && o.status !== 'cancelled').forEach(o => {
    const tNum = parseInt(o.tableNumber || o.table_number);
    if (tNum) activeOrdersMap.set(tNum, o);
  });

  let html = '';
  for (let i = 1; i <= tablesCount; i++) {
    const isOccupied = activeOrdersMap.has(i);
    const order = activeOrdersMap.get(i);
    const alertInfo = window.cashierTableAlerts ? window.cashierTableAlerts[i] : null;

    let alertBadgeHtml = '';
    let alertRingClass = '';
    if (alertInfo) {
      if (alertInfo.type === 'call_waiter') {
        alertRingClass = 'ring-2 ring-amber-400 animate-pulse';
        alertBadgeHtml = `
          <div class="mb-2 p-1.5 rounded-xl bg-amber-500/30 border border-amber-400 text-amber-200 text-[10px] font-black flex items-center justify-between animate-pulse">
            <span class="flex items-center gap-1"><span>🛎️</span><span>يطلب الكابتن!</span></span>
            <button type="button" onclick="event.stopPropagation();dismissTableAlert(${i})" class="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[9px] hover:bg-amber-300">تمت الخدمة ✓</button>
          </div>
        `;
      } else if (alertInfo.type === 'request_bill') {
        alertRingClass = 'ring-2 ring-emerald-400 animate-pulse';
        alertBadgeHtml = `
          <div class="mb-2 p-1.5 rounded-xl bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-[10px] font-black flex items-center justify-between animate-pulse">
            <span class="flex items-center gap-1"><span>💳</span><span>يطلب الفاتورة!</span></span>
            <button type="button" onclick="event.stopPropagation();dismissTableAlert(${i})" class="px-1.5 py-0.5 rounded bg-emerald-400 text-black font-black text-[9px] hover:bg-emerald-300">تم الحساب ✓</button>
          </div>
        `;
      }
    }

    if (isOccupied) {
      const minsAgo = order.timestamp ? Math.floor((Date.now() - order.timestamp) / 60000) : 0;
      const totalAmount = order.total || order.total_amount || 0;
      const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
      html += `
        <div onclick="handleCashierTableClick(${i})" class="bg-amber-950/40 border-2 border-amber-500/70 ${alertRingClass} p-3 sm:p-3.5 rounded-2xl cursor-pointer transition flex flex-col justify-between shadow-xl hover:bg-amber-950/60 active:scale-95">
          <div>
            ${alertBadgeHtml}
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs sm:text-sm font-black text-white">طاولة ${i}</span>
              <span class="flex items-center gap-1 text-[9px] text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>مشغولة</span>
              </span>
            </div>
            <div class="space-y-0.5 bg-slate-950 p-2 rounded-xl border border-slate-800 mb-2">
              <div class="text-[9px] text-amber-300 font-mono">🕒 منذ ${minsAgo} دقيقة</div>
              <div class="text-xs sm:text-sm font-black text-rose-400 font-mono">${Number(totalAmount).toLocaleString()} ${(config && config.currency) ? config.currency : 'د.ع'}</div>
              <div class="text-[9px] text-slate-400 truncate">${itemsCount} أصناف</div>
            </div>
          </div>
          <button type="button" onclick="event.stopPropagation();handleCashierTableClick(${i})" class="w-full py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-[10px] font-black transition">
            📋 كشف الحساب / إضافة وجبات
          </button>
        </div>
      `;
    } else {
      html += `
        <div onclick="handleCashierTableClick(${i})" class="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 ${alertRingClass} p-3 sm:p-3.5 rounded-2xl cursor-pointer transition flex flex-col justify-between shadow-lg hover:bg-slate-850 active:scale-95 group">
          <div>
            ${alertBadgeHtml}
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs sm:text-sm font-black text-white">طاولة ${i}</span>
              <span class="flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>متاحة</span>
              </span>
            </div>
            <div class="py-2.5 text-center text-[10px] text-emerald-400 font-bold bg-slate-950/60 rounded-xl border border-slate-800/80 mb-2">
              🟢 جاهزة للطلب
            </div>
          </div>
          <button type="button" onclick="event.stopPropagation();handleCashierTableClick(${i})" class="w-full py-1.5 px-2 bg-emerald-600/20 group-hover:bg-emerald-600 text-emerald-300 group-hover:text-white border border-emerald-500/30 rounded-xl text-[10px] font-black transition">
            ＋ فتح طلب وتحديد الأطعمة
          </button>
        </div>
      `;
    }
  }
  container.innerHTML = html;

  const occupiedCount = activeOrdersMap.size;
  const summaryEl = document.getElementById('cashier-stat-tables-summary');
  if (summaryEl) summaryEl.textContent = `${occupiedCount} مشغولة / ${tablesCount} إجمالي`;

  // مزامنة قائمة الطاولات المنسدلة في شاشة الـ POS
  populateCashierTableSelect(tablesCount, activeOrdersMap);
}
window.renderCashierTablesGrid = renderCashierTablesGrid;

function populateCashierTableSelect(tablesCount, activeOrdersMap) {
  const select = document.getElementById('cashier-table-select');
  if (!select) return;

  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const count = tablesCount || config.tablesCount || 20;

  if (!activeOrdersMap) {
    const orders = getStoredData('orders', []);
    activeOrdersMap = new Map();
    orders.filter(o => o.type === 'dine-in' && o.status !== 'completed' && o.status !== 'cancelled').forEach(o => {
      const tNum = parseInt(o.tableNumber || o.table_number);
      if (tNum) activeOrdersMap.set(tNum, o);
    });
  }

  const currentVal = parseInt(select.value) || selectedCashierTable || 1;
  let optionsHtml = '';
  for (let i = 1; i <= count; i++) {
    const isOccupied = activeOrdersMap.has(i);
    const label = isOccupied ? `طاولة [ ${i} ] 🔴 (مشغولة)` : `طاولة [ ${i} ] 🟢 (متاحة)`;
    const selected = (i === currentVal) ? 'selected' : '';
    optionsHtml += `<option value="${i}" ${selected}>${label}</option>`;
  }
  select.innerHTML = optionsHtml;

  updateCashierTableBoxUI(currentVal, activeOrdersMap.has(currentVal));
}
window.populateCashierTableSelect = populateCashierTableSelect;

function updateCashierTableBoxUI(tableNum, isOccupied) {
  const badge = document.getElementById('cashier-selected-table-badge');
  const statBadge = document.getElementById('cashier-table-stat-badge');
  if (badge) {
    badge.textContent = `🍽️ طاولة [ ${tableNum} ]`;
  }
  if (statBadge) {
    if (isOccupied) {
      statBadge.className = "text-[10px] text-amber-300 font-bold bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-500/40 animate-pulse";
      statBadge.textContent = "🔴 مشغولة (إلحاق وجبات)";
    } else {
      statBadge.className = "text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/40";
      statBadge.textContent = "🟢 متاحة لطلب جديد";
    }
  }
}
window.updateCashierTableBoxUI = updateCashierTableBoxUI;

function changeCashierSelectedTable(val) {
  selectedCashierTable = parseInt(val) || 1;
  const orders = getStoredData('orders', []);
  const activeOrder = orders.find(o => o.type === 'dine-in' && o.status !== 'completed' && parseInt(o.tableNumber) === selectedCashierTable);
  
  if (activeOrder) {
    cashierAppendingOrderId = activeOrder.id;
  } else {
    cashierAppendingOrderId = null;
  }

  updateCashierTableBoxUI(selectedCashierTable, !!activeOrder);
  openCashierOrderTakingView(selectedCashierTable, cashierAppendingOrderId);
}
window.changeCashierSelectedTable = changeCashierSelectedTable;

function openCashierTablePickerModal() {
  const modal = document.getElementById('cashier-table-picker-modal');
  if (!modal) return;

  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const tablesCount = (config && config.tablesCount) ? config.tablesCount : 20;
  const orders = getStoredData('orders', []);

  const activeOrdersMap = new Map();
  orders.filter(o => o.type === 'dine-in' && o.status !== 'completed' && o.status !== 'cancelled').forEach(o => {
    const tNum = parseInt(o.tableNumber || o.table_number);
    if (tNum) activeOrdersMap.set(tNum, o);
  });

  const countBadge = document.getElementById('cashier-picker-tables-count-badge');
  if (countBadge) countBadge.textContent = `${tablesCount} طاولة محددة في النظام`;

  const grid = document.getElementById('cashier-table-picker-grid');
  if (grid) {
    let html = '';
    for (let i = 1; i <= tablesCount; i++) {
      const isOccupied = activeOrdersMap.has(i);
      const order = activeOrdersMap.get(i);
      const isCurrentSelected = (i === selectedCashierTable && cashierOrderType === 'dine-in');

      if (isOccupied) {
        const total = order.total || 0;
        html += `
          <button type="button" onclick="selectCashierTableFromPicker(${i})" class="p-3 rounded-2xl border-2 text-right transition flex flex-col justify-between active:scale-95 ${
            isCurrentSelected 
              ? 'bg-amber-900/60 border-amber-400 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30' 
              : 'bg-amber-950/40 border-amber-500/60 hover:bg-amber-900/40'
          }">
            <div class="flex items-center justify-between w-full mb-1">
              <span class="font-black text-white text-sm">طاولة ${i}</span>
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            </div>
            <div class="text-[10px] text-amber-300 font-bold mb-1">🔴 مشغولة</div>
            <div class="text-[11px] font-mono font-black text-rose-400">${Number(total).toLocaleString()} ${config.currency || 'د.ع'}</div>
            <div class="text-[9px] text-slate-400 mt-1 bg-slate-950/60 px-1.5 py-0.5 rounded text-center w-full">إلحاق أطعمة ➕</div>
          </button>
        `;
      } else {
        html += `
          <button type="button" onclick="selectCashierTableFromPicker(${i})" class="p-3 rounded-2xl border text-right transition flex flex-col justify-between active:scale-95 ${
            isCurrentSelected 
              ? 'bg-emerald-900/60 border-emerald-400 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30' 
              : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900'
          }">
            <div class="flex items-center justify-between w-full mb-1">
              <span class="font-black text-white text-sm">طاولة ${i}</span>
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div class="text-[10px] text-emerald-400 font-bold mb-1">🟢 متاحة</div>
            <div class="text-[9px] text-slate-500">جاهزة للطلب</div>
            <div class="text-[9px] text-emerald-300 mt-1 bg-emerald-950/60 px-1.5 py-0.5 rounded text-center font-bold w-full">اختيار الطاولة ✨</div>
          </button>
        `;
      }
    }
    grid.innerHTML = html;
  }

  modal.classList.remove('hidden');
}
window.openCashierTablePickerModal = openCashierTablePickerModal;

function closeCashierTablePickerModal() {
  const modal = document.getElementById('cashier-table-picker-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeCashierTablePickerModal = closeCashierTablePickerModal;

function selectCashierTableFromPicker(tableNum) {
  selectedCashierTable = parseInt(tableNum);
  setCashierOrderType('dine-in');

  const select = document.getElementById('cashier-table-select');
  if (select) select.value = selectedCashierTable;

  const orders = getStoredData('orders', []);
  const activeOrder = orders.find(o => o.type === 'dine-in' && o.status !== 'completed' && parseInt(o.tableNumber) === selectedCashierTable);

  if (activeOrder) {
    cashierAppendingOrderId = activeOrder.id;
  } else {
    cashierAppendingOrderId = null;
  }

  updateCashierTableBoxUI(selectedCashierTable, !!activeOrder);
  closeCashierTablePickerModal();
  openCashierOrderTakingView(selectedCashierTable, cashierAppendingOrderId);
  switchCashierTab('pos');
}
window.selectCashierTableFromPicker = selectCashierTableFromPicker;

function openCashierOrderTakingView(tableNum = null, appendOrderId = null) {
  const cartLabel = document.getElementById('cashier-cart-mode-label');

  cashierAppendingOrderId = appendOrderId;
  const custInfo = document.getElementById('cashier-customer-info')?.value?.trim() || '';

  if (cashierOrderType === 'dine-in') {
    selectedCashierTable = parseInt(tableNum) || selectedCashierTable || 1;
    if (appendOrderId) {
      if (cartLabel) cartLabel.textContent = `⚡ إلحاق أصناف لطاولة [ ${selectedCashierTable} ]`;
    } else {
      if (cartLabel) cartLabel.textContent = `🍽️ طلب صالة - طاولة [ ${selectedCashierTable} ]`;
    }
  } else if (cashierOrderType === 'delivery') {
    if (cartLabel) cartLabel.textContent = custInfo ? `🛵 توصيل: ${custInfo}` : `🛵 طلب توصيل دليفري`;
  } else {
    if (cartLabel) cartLabel.textContent = custInfo ? `🛍️ سفري: ${custInfo}` : `🛍️ طلب سفري (استلام)`;
  }

  const select = document.getElementById('cashier-table-select');
  if (select && selectedCashierTable) {
    select.value = selectedCashierTable;
  }

  const orders = getStoredData('orders', []);
  const isOccupied = orders.some(o => o.type === 'dine-in' && o.status !== 'completed' && parseInt(o.tableNumber) === selectedCashierTable);
  updateCashierTableBoxUI(selectedCashierTable, isOccupied);

  renderCashierTablesGrid();
  renderCashierPOSCategories();
  renderCashierPOSDishes();
  updateCashierCartUI();
}
window.openCashierOrderTakingView = openCashierOrderTakingView;

function closeCashierOrderTakingView() {
  cashierPOSCart = [];
  cashierAppendingOrderId = null;
  updateCashierCartUI();
  renderCashierTablesGrid();
  renderCashierStats();
}
window.closeCashierOrderTakingView = closeCashierOrderTakingView;

function appendCashierNote(text) {
  const notesInput = document.getElementById('cashier-pos-notes');
  if (!notesInput) return;
  const current = notesInput.value.trim();
  if (current) {
    if (!current.includes(text)) {
      notesInput.value = current + '貙 ' + text;
    }
  } else {
    notesInput.value = text;
  }
}
window.appendCashierNote = appendCashierNote;

function handleCashierTableClick(tableNum) {
  tableNum = parseInt(tableNum);
  const orders = getStoredData('orders', []);
  const activeOrder = orders.find(o => o.type === 'dine-in' && o.status !== 'completed' && parseInt(o.tableNumber) === tableNum);

  if (activeOrder) {
    openActiveTableModal(tableNum, activeOrder);
  } else {
    selectedCashierTable = tableNum;
    cashierAppendingOrderId = null;
    setCashierOrderType('dine-in');
    openCashierOrderTakingView(tableNum);
    switchCashierTab('pos');
  }
}
window.handleCashierTableClick = handleCashierTableClick;

// -------------------------------------------------------------
// 賰卮賮 丨爻丕亘 賵廿丿丕乇丞 丕賱胤丕賵賱丞 丕賱賲卮睾賵賱丞 (Active Table Modal)
// -------------------------------------------------------------
function openActiveTableModal(tableNum, order) {
  if (!order) {
    const orders = getStoredData('orders', []);
    order = orders.find(o => o.type === 'dine-in' && o.status !== 'completed' && parseInt(o.tableNumber) === tableNum);
  }
  if (!order) return;

  currentActiveTableOrder = order;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const titleEl = document.getElementById('atm-table-title');
  const metaEl = document.getElementById('atm-order-meta');
  const itemsListEl = document.getElementById('atm-items-list');
  const notesBoxEl = document.getElementById('atm-notes-box');
  const notesTextEl = document.getElementById('atm-notes-text');
  const totalEl = document.getElementById('atm-total-price');

  if (titleEl) titleEl.textContent = `طاولة رقم [ ${tableNum} ] - مشغولة 🟢`;
  
  const timeFormatted = new Date(order.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const minsAgo = Math.floor((Date.now() - order.timestamp) / 60000);
  if (metaEl) metaEl.textContent = `#${order.id} • 🕒 ${timeFormatted} (منذ ${minsAgo} دقيقة) • الكابتن: ${order.captainName || 'الصالة'}`;

  renderActiveTableItems();

  if (order.notes) {
    if (notesBoxEl) notesBoxEl.classList.remove('hidden');
    if (notesTextEl) notesTextEl.textContent = order.notes;
  } else {
    if (notesBoxEl) notesBoxEl.classList.add('hidden');
  }

  if (totalEl) totalEl.textContent = `${order.total.toLocaleString()} ${config.currency}`;

  const modal = document.getElementById('active-table-modal');
  if (modal) modal.classList.remove('hidden');
}

function renderActiveTableItems() {
  const itemsListEl = document.getElementById('atm-items-list');
  const totalEl = document.getElementById('atm-total-price');
  if (!itemsListEl || !currentActiveTableOrder) return;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (!currentActiveTableOrder.items || currentActiveTableOrder.items.length === 0) {
    itemsListEl.innerHTML = `<div class="text-center py-4 text-xs text-rose-400 font-bold">لا توجد وجبات في هذا الطلب</div>`;
    if (totalEl) totalEl.textContent = `0 ${config.currency}`;
    return;
  }

  itemsListEl.innerHTML = currentActiveTableOrder.items.map((item, idx) => {
    const isW = item.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(item));
    const weightVal = item.weight || (item.name && item.name.match(/\(([\d\.]+)\s*كغم\)/)?.[1]);
    let priceSubText = '';
    if (isW) {
      if (!weightVal || Number(weightVal) <= 0) {
        priceSubText = `<span class="text-amber-400 font-bold">⚠️ بانتظار الوزن لدفع الحساب</span> <button type="button" onclick="openWeightModalForActiveTableItem(${idx})" class="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 rounded text-[9px] font-black border border-amber-500/40">⚖️ إدخال الوزن</button>`;
      } else {
        priceSubText = `<span class="text-emerald-400 font-bold">⚖️ ${weightVal} كغم (سعر الكيلو: ${(item.pricePerKg || 0).toLocaleString()} ${config.currency})</span> <button type="button" onclick="openWeightModalForActiveTableItem(${idx})" class="text-slate-400 hover:text-white underline text-[9px]">تعديل</button>`;
      }
    } else {
      priceSubText = `${(item.price || 0).toLocaleString()} ${config.currency} للقطعة`;
    }

    return `
    <div class="flex items-center justify-between py-2 px-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
      <div class="flex-1 pr-1">
        <div class="font-bold text-white">${item.name}</div>
        <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">${priceSubText}</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
          <button type="button" onclick="updateActiveTableItemQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">-</button>
          <span class="w-7 text-center font-mono font-bold text-amber-300 text-xs">${item.quantity}</span>
          <button type="button" onclick="updateActiveTableItemQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">+</button>
        </div>
        <span class="font-mono text-rose-400 font-bold min-w-[55px] text-left">${((item.price || 0) * item.quantity).toLocaleString()}</span>
        <button type="button" onclick="removeActiveTableItem(${idx})" title="حذف الصنف من الطاولة" class="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition active:scale-90">🗑️</button>
      </div>
    </div>
    `;
  }).join('');

  const newTotal = currentActiveTableOrder.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
  currentActiveTableOrder.total = newTotal;
  if (totalEl) totalEl.textContent = `${newTotal.toLocaleString()} ${config.currency}`;
}

function updateActiveTableItemQty(idx, delta) {
  if (!currentActiveTableOrder || !currentActiveTableOrder.items[idx]) return;
  const item = currentActiveTableOrder.items[idx];
  const newQty = (item.quantity || 1) + delta;
  if (newQty <= 0) {
    removeActiveTableItem(idx);
    return;
  }
  item.quantity = newQty;
  saveActiveTableOrderChanges();
}

function removeActiveTableItem(idx) {
  if (!currentActiveTableOrder || !currentActiveTableOrder.items[idx]) return;
  const item = currentActiveTableOrder.items[idx];
  if (!confirm(`هل أنت متأكد من حذف [ ${item.name} ] من طلب الطاولة؟`)) return;

  currentActiveTableOrder.items.splice(idx, 1);
  if (currentActiveTableOrder.items.length === 0) {
    if (confirm("أصبح الطلب بدون أي أصناف. هل تريد إلغاء الطلب وتفريغ الطاولة بالكامل؟")) {
      cancelAndVoidActiveTable();
      return;
    }
  }
  saveActiveTableOrderChanges();
}

function saveActiveTableOrderChanges() {
  if (!currentActiveTableOrder) return;
  const orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === currentActiveTableOrder.id);
  if (idx !== -1) {
    currentActiveTableOrder.total = currentActiveTableOrder.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
    orders[idx] = { ...orders[idx], ...currentActiveTableOrder };
    setStoredData('orders', orders);
    window.dispatchEvent(new Event('storage'));

    try {
      if ('BroadcastChannel' in window) {
        new BroadcastChannel('smart_emenu_channel').postMessage({ 
          type: 'ORDERS_CHANGED', 
          orderId: currentActiveTableOrder.id 
        });
      }
    } catch(e) {}

    // مزامنة التعديلات سحابياً فوراً مع Supabase
    if (typeof sendOrderToSupabase === 'function') {
      sendOrderToSupabase(orders[idx]);
    }
  }
  renderActiveTableItems();
  renderCashierTablesGrid();
  loadCashierOrders();
  renderCashierStats();
}

function cancelAndVoidActiveTable() {
  if (!currentActiveTableOrder) return;
  const tableNum = currentActiveTableOrder.tableNumber;
  const orderId = currentActiveTableOrder.id;
  if (!confirm(`هل أنت متأكد من إلغاء وحذف طلب طاولة [ ${tableNum} ] وتفريغها ومسحه من السحابة؟`)) return;

  let orders = getStoredData('orders', []);
  orders = orders.filter(o => o.id !== orderId);
  setStoredData('orders', orders);
  window.dispatchEvent(new Event('storage'));

  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: orderId 
      });
    }
  } catch(e) {}

  // تحديث حالة الطلب إلى ملغي في Supabase وتفريغ الطاولة مع الحفاظ على السجل التراكمي
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(orderId, { status: 'cancelled', updated_at: new Date().toISOString() });
  }

  closeActiveTableModal();
  renderCashierTablesGrid();
  loadCashierOrders();
  renderCashierStats();
  alert(`تم إلغاء الطلب #${orderId} وتفريغ طاولة [ ${tableNum} ] وحفظه في السجل بنجاح! ❌`);
}

function closeActiveTableModal() {
  const modal = document.getElementById('active-table-modal');
  if (modal) modal.classList.add('hidden');
  currentActiveTableOrder = null;
}

function addMoreItemsToActiveTable() {
  if (!currentActiveTableOrder) return;
  const tableNum = parseInt(currentActiveTableOrder.tableNumber);
  const orderId = currentActiveTableOrder.id;

  closeActiveTableModal();
  setCashierOrderType('dine-in');
  openCashierOrderTakingView(tableNum, orderId);
  switchCashierTab('pos');
}

function printActiveTableKitchenTicket() {
  if (!currentActiveTableOrder) return;
  if (typeof printCashierKitchenOnly === 'function') {
    printCashierKitchenOnly(currentActiveTableOrder);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(currentActiveTableOrder, 'kitchen');
  } else {
    window.print();
  }
}
window.printActiveTableKitchenTicket = printActiveTableKitchenTicket;

function printActiveTableBill() {
  if (!currentActiveTableOrder) return;
  
  // التحقق من الأصناف التي تباع بالوزن قبل طباعة الحساب (مثل السمك)
  const unweighedIdx = currentActiveTableOrder.items.findIndex(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || i.weight <= 0));
  if (unweighedIdx !== -1) {
    if (typeof showCashierToast === 'function') {
      showCashierToast("يرجى تحديد وزن الصنف أولاً لطباعة الحساب بدقة! ⚖️", "⚠️");
    }
    openWeightModalForActiveTableItem(unweighedIdx, () => {
      printActiveTableBill();
    });
    return;
  }

  if (typeof printCashierBillOnly === 'function') {
    printCashierBillOnly(currentActiveTableOrder);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(currentActiveTableOrder, 'customer');
  } else {
    window.print();
  }
}
window.printActiveTableBill = printActiveTableBill;

function closeAndPayActiveTable() {
  if (!currentActiveTableOrder) return;

  // التحقق من الأصناف التي تباع بالوزن لدفع الحساب (مثل السمك): فتح نافذة إدخال الوزن إن لم يُدخل بعد
  const unweighedIdx = currentActiveTableOrder.items.findIndex(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || i.weight <= 0));
  if (unweighedIdx !== -1) {
    openWeightModalForActiveTableItem(unweighedIdx, () => {
      closeAndPayActiveTable();
    });
    return;
  }

  const orderId = currentActiveTableOrder.id;
  const tableNum = currentActiveTableOrder.tableNumber;

  const orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = 'completed';
    orders[idx].paidAt = Date.now();
    setStoredData('orders', orders);
  }

  // تحديث حالة الطلب إلى مكتمل في Supabase وتفريغ الطاولة مع الحفاظ على السجل الدائم
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(orderId, { status: 'completed', updated_at: new Date().toISOString() });
  }

  // طباعة وصل الحساب للزبون
  printActiveTableBill();

  // بث التحديث لجميع الصفحات فوراً
  window.dispatchEvent(new Event('storage'));
  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: orderId 
      });
    }
  } catch(e) {}

  closeActiveTableModal();
  renderCashierTablesGrid();
  loadCashierOrders();
  renderCashierStats();

  // إشعار فوري لطيف بدون تجميد الشاشة برسالة منبثقة
  if (typeof showCashierToast === 'function') {
    showCashierToast(`تمت محاسبة طاولة [ ${tableNum} ] وتفريغها بنجاح ✅`);
  }
}
window.closeAndPayActiveTable = closeAndPayActiveTable;

function renderCashierPOSCategories() {
  const container = document.getElementById('cashier-pos-categories-bar');
  if (!container) return;

  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  // التأكد من وجود قسم "الكل" في البداية دائماً
  const hasAll = categories.some(c => c.id === 'all');
  if (!hasAll) {
    categories = [{ id: "all", name: "الكل", nameEn: "All", icon: "🍽️" }, ...categories];
  }

  container.innerHTML = categories.map(cat => `
    <button type="button" onclick="selectCashierPOSCategory('${cat.id}')" class="cat-pill ${cashierPOSCat === cat.id ? 'active' : ''} text-xs py-2 px-3.5 whitespace-nowrap rounded-xl transition font-bold flex items-center gap-1.5 flex-shrink-0">
      <span>${cat.icon || '🍽️'}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function selectCashierPOSCategory(catId) {
  cashierPOSCat = catId;
  renderCashierPOSCategories();
  renderCashierPOSDishes();
}

// -------------------------------------------------------------
// عرض الأطباق ببلاطات مدمجة سريعة ومريحة (Compact POS Touch Grid)
// -------------------------------------------------------------
let cashierSort = 'default';
let cashierAvailableOnly = false;

function setCashierSort(sortKey) {
  cashierSort = sortKey;
  
  // تحديث شكل أزرار الفرز
  ['default', 'price-asc', 'price-desc', 'name-asc'].forEach(key => {
    const btn = document.getElementById(`btn-cash-sort-${key}`);
    if (btn) {
      if (key === sortKey) {
        btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-rose-600 text-white shadow-md shadow-rose-600/30";
      } else {
        btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-slate-950 text-slate-400 hover:bg-slate-800";
      }
    }
  });

  renderCashierPOSDishes();
}

function toggleCashierAvailableOnly() {
  cashierAvailableOnly = !cashierAvailableOnly;
  const btn = document.getElementById('btn-cash-filter-avail');
  if (btn) {
    if (cashierAvailableOnly) {
      btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-emerald-600 text-white shadow-md shadow-emerald-600/30";
    } else {
      btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-slate-950 text-slate-400 hover:bg-slate-800";
    }
  }
  renderCashierPOSDishes();
}

function setCashierOrderType(type) {
  if (!['takeaway', 'dine-in', 'delivery'].includes(type)) type = 'dine-in';
  cashierOrderType = type;

  const btnTakeaway = document.getElementById('btn-type-takeaway');
  const btnDineIn   = document.getElementById('btn-type-dine-in');
  const btnDelivery = document.getElementById('btn-type-delivery');

  const activeDineInCls   = "py-2 px-1 rounded-xl text-xs font-black text-center transition flex flex-col items-center justify-center gap-0.5 bg-emerald-600/20 border border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-500/50";
  const activeTakeawayCls = "py-2 px-1 rounded-xl text-xs font-black text-center transition flex flex-col items-center justify-center gap-0.5 bg-amber-600/20 border border-amber-500 text-amber-300 shadow-lg shadow-amber-600/20 ring-1 ring-amber-500/50";
  const activeDeliveryCls = "py-2 px-1 rounded-xl text-xs font-black text-center transition flex flex-col items-center justify-center gap-0.5 bg-blue-600/20 border border-blue-500 text-blue-300 shadow-lg shadow-blue-600/20 ring-1 ring-blue-500/50";
  const inactiveCls       = "py-2 px-1 rounded-xl text-xs font-bold text-center transition flex flex-col items-center justify-center gap-0.5 bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white";

  if (btnTakeaway) btnTakeaway.className = (type === 'takeaway') ? activeTakeawayCls : inactiveCls;
  if (btnDineIn)   btnDineIn.className   = (type === 'dine-in')  ? activeDineInCls   : inactiveCls;
  if (btnDelivery) btnDelivery.className = (type === 'delivery') ? activeDeliveryCls : inactiveCls;

  const badgeEl          = document.getElementById('cashier-order-type-badge');
  const modeLabel        = document.getElementById('cashier-cart-mode-label');
  const custBox          = document.getElementById('cashier-customer-box');
  const tableBox         = document.getElementById('cashier-table-box');
  const deliveryAddrRow  = document.getElementById('cashier-delivery-address-row');
  const deliveryFeeBox   = document.getElementById('cashier-delivery-fee-box');
  const deliveryChargeRow= document.getElementById('cashier-delivery-charge-row');
  // حقل الاسم والهاتف فقط (بدون عنوان) للسفري
  const custNameInput    = document.getElementById('cashier-customer-info');
  const custPhoneInput   = document.getElementById('cashier-customer-phone');

  if (type === 'takeaway') {
    // ✅ السفري: اسم الزبون + هاتف فقط (لنداء الاستلام)، بدون عنوان، بدون أجور توصيل
    if (badgeEl) {
      badgeEl.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30";
      badgeEl.innerHTML = "🛍️ سفري (استلام)";
    }
    if (modeLabel) modeLabel.textContent = "سفري — الزبون يأتي بنفسه للاستلام (أدخل الاسم لنداء الزبون)";
    if (custBox) custBox.classList.remove('hidden');
    if (custNameInput) { custNameInput.placeholder = "👤 اسم الزبون (للنداء عند جاهزية الطلب)..."; }
    if (custPhoneInput) { custPhoneInput.placeholder = "📱 رقم الهاتف (اختياري)..."; }
    if (tableBox) tableBox.classList.add('hidden');
    if (deliveryAddrRow) deliveryAddrRow.classList.add('hidden');
    if (deliveryFeeBox) deliveryFeeBox.classList.add('hidden');
    if (deliveryChargeRow) deliveryChargeRow.classList.add('hidden');

  } else if (type === 'dine-in') {
    // ✅ الصالة: يُخفى اسم الزبون (الطاولة تُعرِّف الزبون) ويُظهر خارطة الطاولات
    if (badgeEl) {
      badgeEl.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      badgeEl.innerHTML = `🍽️ صالة (طاولة ${selectedCashierTable || 1})`;
    }
    if (modeLabel) modeLabel.textContent = `طلب صالة داخلي — طاولة ${selectedCashierTable || 1}`;
    if (custBox) custBox.classList.add('hidden');      // الصالة لا تحتاج اسم زبون
    if (tableBox) tableBox.classList.remove('hidden');
    if (deliveryAddrRow) deliveryAddrRow.classList.add('hidden');
    if (deliveryFeeBox) deliveryFeeBox.classList.add('hidden');
    if (deliveryChargeRow) deliveryChargeRow.classList.add('hidden');

    if (typeof populateCashierTableSelect === 'function') {
      populateCashierTableSelect();
    }

  } else if (type === 'delivery') {
    // ✅ الدليفري: اسم + هاتف + عنوان + أجور توصيل (كاملة)
    if (badgeEl) {
      badgeEl.className = "px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30";
      badgeEl.innerHTML = "🛵 دليفري (توصيل)";
    }
    if (modeLabel) modeLabel.textContent = "دليفري — توصيل خارجي (أدخل اسم الزبون وهاتفه وعنوانه)";
    if (custBox) custBox.classList.remove('hidden');
    if (custNameInput) { custNameInput.placeholder = "👤 اسم الزبون (مطلوب للتوصيل)..."; }
    if (custPhoneInput) { custPhoneInput.placeholder = "📱 رقم الهاتف (مطلوب للتوصيل)..."; }
    if (tableBox) tableBox.classList.add('hidden');
    if (deliveryAddrRow) deliveryAddrRow.classList.remove('hidden');
    if (deliveryFeeBox) deliveryFeeBox.classList.remove('hidden');
    if (deliveryChargeRow) deliveryChargeRow.classList.remove('hidden');
  }

  if (typeof updateCashierCartUI === 'function') {
    updateCashierCartUI();
  }
}
window.setCashierOrderType = setCashierOrderType;

function renderCashierPOSDishes() {
  const container = document.getElementById('cashier-pos-dishes-grid');
  if (!container) return;

  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  let filtered = dishes.filter(d => {
    if (cashierPOSCat !== 'all' && d.categoryId !== cashierPOSCat) return false;
    if (cashierAvailableOnly && !d.available) return false;
    if (cashierPOSSearch) {
      const matchName = d.name && d.name.toLowerCase().includes(cashierPOSSearch);
      const matchIng = d.ingredients && d.ingredients.toLowerCase().includes(cashierPOSSearch);
      if (!matchName && !matchIng) return false;
    }
    return true;
  });

  // تطبيق الترتيب والفرز
  if (cashierSort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (cashierSort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (cashierSort === 'name-asc') {
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full py-10 text-center text-xs text-slate-500">لا توجد أطباق مطابقة للبحث أو الفلتر المختار</div>`;
    return;
  }

  container.innerHTML = filtered.map(dish => {
    const inCart = cashierPOSCart.find(i => String(i.dishId || i.id) === String(dish.id));
    const qty = inCart ? inCart.quantity : 0;
    const safeId = String(dish.id).replace(/'/g, "\\'");
    const isWeighted = (typeof isDishWeighted === 'function' && isDishWeighted(dish));
    const pricePerKg = Number(dish.price) || Number(dish.pricePerKg) || 0;

    return `
      <div onclick="${dish.available ? `addDishToCashierCart('${safeId}')` : ''}" class="p-3 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between active:scale-98 relative group ${
        !dish.available 
          ? 'bg-slate-950 border-slate-800 opacity-40 grayscale cursor-not-allowed' 
          : qty > 0 
            ? 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50' 
            : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      }">
        <div>
          <!-- الصف العلوي: صورة الطبق + الاسم + زر التفاصيل -->
          <div class="flex items-start gap-2.5 mb-2">
            ${dish.image ? `
              <img src="${dish.image}" alt="${dish.name}" class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover flex-shrink-0 border border-slate-800 shadow-sm" loading="lazy" onerror="this.style.display='none'">
            ` : `
              <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-lg sm:text-xl flex-shrink-0">🍽️</div>
            `}
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-1">
                <h4 class="font-black text-white text-xs sm:text-sm leading-snug line-clamp-2">${dish.name}</h4>
                <button type="button" onclick="event.stopPropagation(); showDishDetailsModal('${safeId}')" title="عرض تفاصيل ومكونات الطبق" class="w-5 h-5 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 text-[10px] flex items-center justify-center flex-shrink-0 transition">ℹ️</button>
              </div>
              ${dish.nameEn ? `<div class="text-[10px] text-slate-400 font-sans truncate">${dish.nameEn}</div>` : ''}
            </div>
          </div>

          <!-- تفاصيل ومكونات الطبق -->
          ${dish.ingredients ? `
            <div class="text-[10px] text-slate-300 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/80 line-clamp-2 leading-relaxed mb-1.5">
              <span class="text-amber-400 font-bold">🌿</span> ${dish.ingredients}
            </div>
          ` : dish.description ? `
            <div class="text-[10px] text-slate-400 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/80 line-clamp-2 leading-relaxed mb-1.5">
              ${dish.description}
            </div>
          ` : ''}

          <!-- شارات السعرات والتمييز وبطاقة الوزن -->
          <div class="flex items-center gap-1 flex-wrap mb-2">
            ${isWeighted ? `<span class="text-[9px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.5 rounded border border-amber-500/30">⚖️ بالوزن</span>` : ''}
            ${dish.calories ? `<span class="text-[9px] bg-slate-800 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-slate-700">⚡ ${dish.calories}</span>` : ''}
            ${dish.isSpicy ? `<span class="text-[9px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-900">🌶️ حار</span>` : ''}
            ${dish.isPopular ? `<span class="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-900">⭐ مميز</span>` : ''}
          </div>
        </div>

        <!-- الجزء السفلي: السعر وأزرار الإضافة والوزن -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-auto gap-1">
          ${isWeighted ? `
            <div class="flex flex-col">
              <span class="text-[9px] sm:text-[10px] text-slate-400 font-bold">سعر الكيلو:</span>
              <span class="text-amber-400 font-black text-xs sm:text-sm font-mono leading-tight">
                ${pricePerKg.toLocaleString()} ${config.currency}
              </span>
            </div>
            <button type="button" onclick="event.stopPropagation(); addDishToCashierCart('${safeId}')" class="text-xs text-amber-200 font-black bg-amber-950/80 hover:bg-amber-800 border border-amber-500/50 active:scale-95 px-2.5 py-1 rounded-xl transition shadow flex items-center gap-1">
              <span>⚖️</span>
              <span>طلب بالوزن</span>
            </button>
          ` : `
            <div class="flex flex-col">
              <span class="text-[9px] sm:text-[10px] text-slate-400 font-bold">السعر:</span>
              <span class="text-rose-400 font-black text-xs sm:text-sm font-mono leading-tight">
                ${(Number(dish.price) || 0).toLocaleString()} ${config.currency}
              </span>
            </div>
            ${!dish.available ? `
              <span class="text-[10px] text-rose-500 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/50">غير متوفر</span>
            ` : qty > 0 ? `
              <div class="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700" onclick="event.stopPropagation()">
                <button type="button" onclick="changeCashierCartQty('${safeId}', -1)" class="w-5 h-5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 font-bold flex items-center justify-center text-xs active:scale-90">−</button>
                <span class="text-xs font-mono font-bold text-white px-1.5">${qty}</span>
                <button type="button" onclick="changeCashierCartQty('${safeId}', 1)" class="w-5 h-5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center text-xs active:scale-90">＋</button>
              </div>
            ` : `
              <button type="button" onclick="event.stopPropagation(); addDishToCashierCart('${safeId}')" class="text-xs text-white font-black bg-rose-600 hover:bg-rose-500 active:scale-95 px-3 py-1 rounded-xl transition shadow">＋ إضافة</button>
            `}
          `}
        </div>
      </div>
    `;
  }).join('');
}
window.renderCashierPOSDishes = renderCashierPOSDishes;

// -------------------------------------------------------------
// إدارة الأطباق بالوزن / بالكيلوغرام (مثل الأسماك والمشاوي بالوزن)
// -------------------------------------------------------------
let currentWeightContext = null;

function openCashierWeightModal(context) {
  currentWeightContext = context;
  const modal = document.getElementById('cashier-weight-modal');
  if (!modal) return;

  const nameEl = document.getElementById('cwm-dish-name');
  const priceKgEl = document.getElementById('cwm-dish-price-kg');
  const weightInput = document.getElementById('cwm-weight-input');
  const titleEl = document.getElementById('cwm-modal-title');
  const totalDisplay = document.getElementById('cwm-total-display');
  const confirmText = document.getElementById('cwm-confirm-text');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (titleEl) {
    titleEl.textContent = context.title || "إدخال وزن الطلب ⚖️";
  }
  if (nameEl) {
    nameEl.textContent = context.name || "اسم الصنف";
  }
  const pricePerKg = Number(context.pricePerKg) || 0;
  if (priceKgEl) {
    priceKgEl.textContent = `سعر الكيلوغرام: ${pricePerKg.toLocaleString()} ${config.currency || 'د.ع'}`;
  }

  if (weightInput) {
    if (context.initialWeight && Number(context.initialWeight) > 0) {
      weightInput.value = context.initialWeight;
      const initialTotal = Math.round(Number(context.initialWeight) * pricePerKg);
      if (totalDisplay) {
        totalDisplay.textContent = `${initialTotal.toLocaleString()} ${config.currency || 'د.ع'}`;
      }
    } else {
      weightInput.value = "";
      weightInput.placeholder = "أدخل الوزن (كغم)...";
      if (totalDisplay) {
        totalDisplay.textContent = `0 ${config.currency || 'د.ع'}`;
      }
    }
  }
  if (confirmText) {
    confirmText.textContent = context.btnText || "⚖️ تأكيد وحفظ الوزن";
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    if (weightInput) {
      weightInput.focus();
    }
  }, 60);
}
window.openCashierWeightModal = openCashierWeightModal;

function closeCashierWeightModal() {
  const modal = document.getElementById('cashier-weight-modal');
  if (modal) modal.classList.add('hidden');
  currentWeightContext = null;
}
window.closeCashierWeightModal = closeCashierWeightModal;

function adjustWeightInput(delta) {
  const inp = document.getElementById('cwm-weight-input');
  if (!inp) return;
  let val = parseFloat(inp.value);
  if (isNaN(val) || val <= 0) {
    val = delta > 0 ? delta : 0.5;
  } else {
    val = Math.max(0.05, Math.round((val + delta) * 100) / 100);
  }
  inp.value = val;
  calculateWeightModalTotal();
}
window.adjustWeightInput = adjustWeightInput;

function setWeightInput(val) {
  const inp = document.getElementById('cwm-weight-input');
  if (!inp) return;
  inp.value = val;
  calculateWeightModalTotal();
}
window.setWeightInput = setWeightInput;

function calculateWeightModalTotal() {
  if (!currentWeightContext) return;
  const inp = document.getElementById('cwm-weight-input');
  const display = document.getElementById('cwm-total-display');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const weight = parseFloat(inp?.value) || 0;
  const pricePerKg = Number(currentWeightContext.pricePerKg) || 0;
  const total = Math.round(weight * pricePerKg);
  if (display) display.textContent = `${total.toLocaleString()} ${config.currency || 'د.ع'}`;
}
window.calculateWeightModalTotal = calculateWeightModalTotal;

function confirmWeightModalAction() {
  if (!currentWeightContext) return;
  const inp = document.getElementById('cwm-weight-input');
  const weight = parseFloat(inp?.value) || 0;
  if (weight <= 0) {
    if (typeof showCashierToast === 'function') {
      showCashierToast("يرجى إدخال وزن صحيح بالكيلوغرام!", "⚠️");
    } else {
      alert("يرجى إدخال وزن صحيح بالكيلوغرام!");
    }
    inp?.focus();
    return;
  }

  const ctx = currentWeightContext;
  const pricePerKg = Number(ctx.pricePerKg) || 0;
  const itemTotal = Math.round(weight * pricePerKg);
  const rawBase = ctx.baseName || ctx.name || '';
  const baseName = rawBase.replace(/\(.*?\)/g, '').replace(/⚖️/g, '').trim();
  const updatedName = `${baseName} (${weight} كغم)`;

  // 1. إذا كان الوزن لصنف في سلة الكاشير
  if (ctx.type === 'cart_item') {
    const item = cashierPOSCart.find(i => String(i.id) === String(ctx.itemId));
    if (item) {
      item.weight = weight;
      item.price = itemTotal;
      item.name = updatedName;
      item.weightPending = false;
    }
    updateCashierCartUI();
    renderCashierPOSDishes();
  }

  // 2. إذا كان الوزن لصنف داخل طاولة صالة نشطة عند المحاسبة
  else if (ctx.type === 'table_item' && currentActiveTableOrder) {
    const item = currentActiveTableOrder.items[ctx.itemIndex];
    if (item) {
      item.weight = weight;
      item.price = itemTotal;
      item.name = updatedName;
      item.weightPending = false;
      saveActiveTableOrderChanges();
    }
  }

  // 3. إذا كان الوزن لطلب في قائمة الطلبات الجارية
  else if (ctx.type === 'order_item' && ctx.orderId) {
    const orders = getStoredData('orders', []);
    const oIdx = orders.findIndex(o => o.id === ctx.orderId);
    if (oIdx !== -1 && orders[oIdx].items[ctx.itemIndex]) {
      const item = orders[oIdx].items[ctx.itemIndex];
      item.weight = weight;
      item.price = itemTotal;
      item.name = updatedName;
      item.weightPending = false;
      orders[oIdx].total = orders[oIdx].items.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0);
      setStoredData('orders', orders);
      window.dispatchEvent(new Event('storage'));
      if (typeof updateOrderInSupabase === 'function') {
        updateOrderInSupabase(orders[oIdx].id, {
          items: orders[oIdx].items,
          total: orders[oIdx].total,
          updated_at: new Date().toISOString()
        });
      }
      loadCashierOrders();
      renderCashierStats();
      if (typeof showCashierToast === 'function') {
        showCashierToast(`تم حفظ وزن [ ${baseName} ] (${weight} كغم) بنجاح! ⚖️`);
      }
    }
  }

  // 4. إذا كان الوزن لصنف داخل نافذة تعديل الطلب المفتوحة حالياً
  else if (ctx.type === 'editing_order_item' && currentEditingPendingOrder) {
    const item = currentEditingPendingOrder.items[ctx.itemIndex];
    if (item) {
      item.weight = weight;
      item.price = itemTotal;
      item.name = updatedName;
      item.weightPending = false;
      renderPendingEditItemsList();
      if (typeof showCashierToast === 'function') {
        showCashierToast(`تم تحديث وزن الصنف في الطلب (${weight} كغم) ⚖️`);
      }
    }
  }

  // استدعاء دالة رد الاتصال إن وُجدت
  if (typeof ctx.callback === 'function') {
    ctx.callback(weight, itemTotal);
  }

  closeCashierWeightModal();
}
window.confirmWeightModalAction = confirmWeightModalAction;
window.confirmWeightAndAddToCart = confirmWeightModalAction;

function openCashierWeightModalForItem(itemId, source = 'cart', callback = null) {
  if (source === 'cart') {
    const item = cashierPOSCart.find(i => String(i.id) === String(itemId));
    if (!item) return;
    openCashierWeightModal({
      type: 'cart_item',
      itemId: item.id,
      name: item.baseName || item.name,
      baseName: item.baseName || item.name,
      pricePerKg: item.pricePerKg || item.price || 0,
      title: "تحديد وزن الصنف في السلة ⚖️",
      btnText: "⚖️ حفظ الوزن وتحديث السعر",
      callback: callback
    });
  }
}
window.openCashierWeightModalForItem = openCashierWeightModalForItem;

function openWeightModalForActiveTableItem(itemIndex, callback = null) {
  if (!currentActiveTableOrder || !currentActiveTableOrder.items[itemIndex]) return;
  const item = currentActiveTableOrder.items[itemIndex];
  openCashierWeightModal({
    type: 'table_item',
    itemIndex: itemIndex,
    name: item.baseName || item.name,
    baseName: item.baseName || item.name,
    pricePerKg: item.pricePerKg || item.price || 0,
    title: `إدخال وزن [ ${item.baseName || item.name} ] لدفع الحساب ⚖️`,
    btnText: "⚖️ تأكيد الوزن وحساب الفاتورة",
    callback: callback
  });
}
window.openWeightModalForActiveTableItem = openWeightModalForActiveTableItem;

function openWeightModalForOrder(orderId, itemIndex, callback = null) {
  const orders = getStoredData('orders', []);
  const order = orders.find(o => o.id === orderId);
  if (!order || !order.items[itemIndex]) return;
  const item = order.items[itemIndex];
  openCashierWeightModal({
    type: 'order_item',
    orderId: orderId,
    itemIndex: itemIndex,
    name: item.baseName || item.name,
    baseName: item.baseName || item.name,
    pricePerKg: item.pricePerKg || item.price || 0,
    initialWeight: item.weight && item.weight > 0 ? item.weight : null,
    title: `تحديد وزن [ ${item.baseName || item.name} ] ⚖️`,
    btnText: "⚖️ تأكيد وحفظ الوزن",
    callback: callback
  });
}
window.openWeightModalForOrder = openWeightModalForOrder;

function addDishToCashierCart(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish || !dish.available) return;

  // الأصناف بالوزن (مثل السمك والمشاوي بالوزن): تضاف مباشرة للتذكرة بخانة وزن ظاهرة خالية من الأرقام
  if (isDishWeighted(dish)) {
    const pricePerKg = Number(dish.price) || Number(dish.unitPrice) || 0;
    // إذا كان نفس الصنف موجوداً في السلة ووزنه ما زال فارغاً، نركز على خانته مباشرة
    const existingEmpty = cashierPOSCart.find(i => String(i.dishId || i.id) === String(dishId) && (!i.weight || Number(i.weight) <= 0));
    if (existingEmpty) {
      const el = document.getElementById(`cart-weight-input-${existingEmpty.id}`);
      if (el) {
        el.focus();
        el.select();
      }
      return;
    }

    const uniqueId = `${dish.id}_w_${Date.now()}`;
    cashierPOSCart.push({
      id: uniqueId,
      dishId: dish.id,
      name: dish.name,
      baseName: dish.name,
      ingredients: dish.ingredients || '',
      price: 0,
      pricePerKg: pricePerKg,
      weight: '', // خانة فارغة لسهولة وسرعة الكتابة
      isWeighted: true,
      weightPending: true,
      quantity: 1
    });

    updateCashierCartUI();
    renderCashierPOSDishes();

    // التركيز الفوري داخل الخانة للكتابة المباشرة بدون أي نقرة إضافية
    setTimeout(() => {
      const inp = document.getElementById(`cart-weight-input-${uniqueId}`);
      if (inp) {
        inp.focus();
        inp.select();
      }
    }, 60);
    return;
  }

  const idx = cashierPOSCart.findIndex(i => String(i.id) === String(dishId));
  if (idx !== -1) {
    cashierPOSCart[idx].quantity += 1;
  } else {
    cashierPOSCart.push({
      id: dish.id,
      dishId: dish.id,
      name: dish.name,
      baseName: dish.name,
      ingredients: dish.ingredients || '',
      price: Number(dish.price) || 0,
      quantity: 1
    });
  }

  updateCashierCartUI();
  renderCashierPOSDishes();
}
window.addDishToCashierCart = addDishToCashierCart;

function changeCashierCartQty(dishId, delta) {
  const idx = cashierPOSCart.findIndex(i => String(i.id) === String(dishId));
  if (idx === -1) return;

  cashierPOSCart[idx].quantity += delta;
  if (cashierPOSCart[idx].quantity <= 0) {
    cashierPOSCart.splice(idx, 1);
  }

  updateCashierCartUI();
  renderCashierPOSDishes();
}
window.changeCashierCartQty = changeCashierCartQty;

function removeCashierCartItem(itemId) {
  const idx = cashierPOSCart.findIndex(i => String(i.id) === String(itemId));
  if (idx !== -1) {
    cashierPOSCart.splice(idx, 1);
    updateCashierCartUI();
    renderCashierPOSDishes();
  }
}
window.removeCashierCartItem = removeCashierCartItem;

function clearCashierCart() {
  cashierPOSCart = [];
  updateCashierCartUI();
  renderCashierPOSDishes();
}
window.clearCashierCart = clearCashierCart;

// تحديث وزن الصنف في تذكرة الطلب فورياً أثناء الكتابة دون فقدان التركيز
function updateCashierCartItemWeight(itemId, val) {
  const item = cashierPOSCart.find(i => String(i.id) === String(itemId));
  if (!item) return;

  const rawVal = String(val).trim();
  const weight = parseFloat(rawVal);
  if (!isNaN(weight) && weight > 0) {
    item.weight = weight;
    item.price = Math.round(weight * (item.pricePerKg || 0));
    item.weightPending = false;
  } else {
    item.weight = rawVal;
    item.price = 0;
    item.weightPending = true;
  }

  // تحديث سعر الصنف الفردي فورياً في الـ DOM
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const lineTotalEl = document.getElementById(`cart-item-total-${itemId}`);
  if (lineTotalEl) {
    const itemTotal = item.price * (item.quantity || 1);
    lineTotalEl.textContent = `${itemTotal.toLocaleString()} ${config.currency}`;
    if (itemTotal > 0) {
      lineTotalEl.className = "text-xs sm:text-sm font-black font-mono text-emerald-400";
    } else {
      lineTotalEl.className = "text-xs sm:text-sm font-black font-mono text-amber-400";
    }
  }

  // تحديث إجماليات التذكرة دون إعادة بناء الـ HTML حتى لا يفقد المؤشر تركيزه
  updateCashierCartTotalsOnly();
}
window.updateCashierCartItemWeight = updateCashierCartItemWeight;

// تحديث خانات الإجماليات فقط
function updateCashierCartTotalsOnly() {
  const totalDisplay = document.getElementById('cashier-pos-total');
  const subtotalDisplay = document.getElementById('cashier-pos-items-subtotal') || document.getElementById('cashier-pos-subtotal');
  const deliveryDisplay = document.getElementById('cashier-pos-delivery-charge');
  const headerCount = document.getElementById('cashier-header-cart-count');
  const headerTotal = document.getElementById('cashier-header-cart-total');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const itemsSubtotal = cashierPOSCart.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
  const totalCount = cashierPOSCart.reduce((sum, i) => sum + (i.quantity || 1), 0);

  let deliveryFee = 0;
  if (cashierOrderType === 'delivery') {
    const feeInput = document.getElementById('cashier-delivery-fee');
    deliveryFee = feeInput ? (parseInt(feeInput.value) || 0) : 0;
  }
  const grandTotal = itemsSubtotal + deliveryFee;

  if (subtotalDisplay) subtotalDisplay.textContent = `${itemsSubtotal.toLocaleString()} ${config.currency}`;
  if (deliveryDisplay) deliveryDisplay.textContent = `${deliveryFee.toLocaleString()} ${config.currency}`;
  if (totalDisplay) totalDisplay.textContent = `${grandTotal.toLocaleString()} ${config.currency}`;
  if (headerCount) headerCount.textContent = totalCount;
  if (headerTotal) headerTotal.textContent = `${grandTotal.toLocaleString()} ${config.currency}`;
}
window.updateCashierCartTotalsOnly = updateCashierCartTotalsOnly;

function updateCashierCartUI() {
  const container = document.getElementById('cashier-cart-items');
  const emptyDisplay = document.getElementById('cashier-cart-empty');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  // تحديث المبالغ أولاً
  updateCashierCartTotalsOnly();

  if (cashierPOSCart.length === 0) {
    if (container) container.innerHTML = '';
    if (emptyDisplay) emptyDisplay.classList.remove('hidden');
    if (typeof syncCashierDrawerCart === 'function') syncCashierDrawerCart();
    return;
  }

  if (emptyDisplay) emptyDisplay.classList.add('hidden');

  if (container) {
    container.innerHTML = cashierPOSCart.map(item => {
      const safeId = String(item.id).replace(/'/g, "\\'");
      const isW = item.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(item));
      const hasWeight = item.weight !== '' && item.weight !== null && item.weight !== undefined && Number(item.weight) > 0;

      if (isW) {
        return `
          <div class="p-3 bg-slate-800/95 rounded-2xl border border-amber-500/50 text-xs space-y-2 shadow-md transition">
            <!-- الصف 1: اسم الوجبة وزر الحذف -->
            <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/60">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-base flex-shrink-0">⚖️</span>
                  <span class="font-black text-white text-xs sm:text-sm truncate">${item.baseName || item.name}</span>
                </div>
                ${item.ingredients ? `<div class="text-[10px] text-amber-200/80 font-medium mt-0.5 line-clamp-2 pr-5">🌿 ${item.ingredients}</div>` : ''}
              </div>
              <button type="button" onclick="removeCashierCartItem('${safeId}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-600/40 text-slate-400 hover:text-rose-300 border border-slate-700 flex items-center gap-1 text-[11px] font-bold transition flex-shrink-0" title="حذف الصنف من التذكرة">
                <span>✕</span>
                <span class="hidden sm:inline">حذف</span>
              </button>
            </div>

            <!-- الصف 2: خانة إدخال الوزن (رقم صحيح أو عشري بدون أرقام مسبقة) -->
            <div class="flex items-center justify-between gap-2 bg-slate-950/90 p-2 rounded-xl border border-amber-500/40">
              <label for="cart-weight-input-${safeId}" class="text-[11px] font-bold text-amber-300 flex items-center gap-1 flex-shrink-0">
                <span>الوزن المطلوب:</span>
              </label>
              <div class="flex items-center gap-1.5 flex-1 justify-end">
                <input 
                  type="number" 
                  step="any" 
                  min="0" 
                  id="cart-weight-input-${safeId}"
                  value="${(item.weight !== undefined && item.weight !== null) ? item.weight : ''}"
                  placeholder="أدخل الوزن (مثلاً: 1 أو 1.5)..."
                  oninput="updateCashierCartItemWeight('${safeId}', this.value)"
                  class="w-full max-w-[150px] bg-slate-900 border border-slate-700 focus:border-amber-400 text-white font-mono font-black text-xs sm:text-sm rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-amber-400 transition text-center"
                  dir="ltr"
                />
                <span class="text-xs font-bold text-amber-400 flex-shrink-0">كغم</span>
              </div>
            </div>

            <!-- الصف 3: سعر الكيلو والمجموع المحسوب للسطر -->
            <div class="flex items-center justify-between pt-1 text-xs">
              <div class="text-[11px] text-amber-400 font-bold">
                سعر الكيلو: ${(item.pricePerKg || 0).toLocaleString()} ${config.currency}
              </div>
              <div class="text-left flex items-center gap-1">
                <span class="text-[11px] text-slate-400 font-bold">المجموع:</span>
                <span id="cart-item-total-${safeId}" class="text-xs sm:text-sm font-black font-mono ${hasWeight ? 'text-emerald-400' : 'text-amber-400'}">
                  ${(item.price * item.quantity).toLocaleString()} ${config.currency}
                </span>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="p-3 bg-slate-800/90 rounded-2xl border border-slate-700/80 text-xs space-y-2 shadow-md transition">
          <!-- الصف 1: اسم الوجبة وزر الحذف -->
          <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/60">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-base flex-shrink-0">🍽️</span>
                <span class="font-black text-white text-xs sm:text-sm truncate">${item.name}</span>
              </div>
              ${item.ingredients ? `<div class="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-2 pr-5">🌿 ${item.ingredients}</div>` : ''}
            </div>
            <button type="button" onclick="removeCashierCartItem('${safeId}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-600/40 text-slate-400 hover:text-rose-300 border border-slate-700 flex items-center gap-1 text-[11px] font-bold transition flex-shrink-0" title="حذف الصنف من التذكرة">
              <span>✕</span>
              <span class="hidden sm:inline">حذف</span>
            </button>
          </div>

          <!-- الصف 2: شريط التحكم بالكمية كامل العرض ومريح للمس -->
          <div class="flex items-center justify-between gap-2 bg-slate-950/90 p-2 rounded-xl border border-slate-700/60">
            <span class="text-xs font-bold text-slate-300">الكمية المطلوبة:</span>
            <div class="inline-flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
              <button type="button" onclick="changeCashierCartQty('${safeId}', -1)" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 font-black flex items-center justify-center text-sm active:scale-90 transition" title="إنقاص الكمية">−</button>
              <span class="text-xs sm:text-sm font-mono font-black text-white px-2">${item.quantity}</span>
              <button type="button" onclick="changeCashierCartQty('${safeId}', 1)" class="w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black flex items-center justify-center text-sm active:scale-90 transition" title="زيادة الكمية">+</button>
            </div>
          </div>

          <!-- الصف 3: سعر المفرد والمجموع الكلي للصنف -->
          <div class="flex items-center justify-between pt-1 text-xs">
            <div class="text-[11px] text-slate-400 font-bold">
              سعر المفرد: ${(item.price).toLocaleString()} ${config.currency}
            </div>
            <div class="text-left flex items-center gap-1">
              <span class="text-[11px] text-slate-400 font-bold">المجموع:</span>
              <span class="text-xs sm:text-sm font-black font-mono text-emerald-400">
                ${(item.price * item.quantity).toLocaleString()} ${config.currency}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (typeof syncCashierDrawerCart === 'function') {
    syncCashierDrawerCart();
  }
}
window.updateCashierCartUI = updateCashierCartUI;

function setCashierDeliveryFee(fee) {
  const feeInput = document.getElementById('cashier-delivery-fee');
  if (feeInput) {
    feeInput.value = parseInt(fee) || 0;
  }
  updateCashierCartUI();
}
window.setCashierDeliveryFee = setCashierDeliveryFee;

function submitCashierPOSOrder(dest = 'both') {
  if (cashierPOSCart.length === 0) {
    alert("السلة فارغة! يرجى اختيار وجبات الزبون أولاً.");
    return;
  }

  // إذا كان المطلوب طباعة كشف حساب الزبون أو الحساب النهائي: التأكد من إدخال وزن أي صنف بالوزن في التذكرة
  if (dest === 'customer' || dest === 'both') {
    const unweighedItem = cashierPOSCart.find(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || Number(i.weight) <= 0));
    if (unweighedItem) {
      const dishLabel = unweighedItem.baseName || unweighedItem.name || 'الصنف بالوزن';
      if (typeof showCashierToast === 'function') {
        showCashierToast(`يرجى كتابة وزن صنف [ ${dishLabel} ] في تذكرة الطلب أولاً ⚖️`, "⚠️");
      } else {
        alert(`يرجى كتابة وزن صنف [ ${dishLabel} ] في تذكرة الطلب أولاً ⚖️`);
      }
      const inp = document.getElementById(`cart-weight-input-${unweighedItem.id}`);
      if (inp) {
        inp.focus();
        inp.select();
        inp.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => inp.classList.remove('ring-2', 'ring-rose-500'), 2500);
      }
      return;
    }
  }

  // تجهيز الأصناف مع تثبيت الاسم والوزن الصحيح
  const finalCartItems = cashierPOSCart.map(item => {
    const isW = item.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(item));
    const w = parseFloat(item.weight);
    if (isW && !isNaN(w) && w > 0) {
      const rawBase = item.baseName || item.name || '';
      const cleanBase = rawBase.replace(/\(.*?\)/g, '').replace(/⚖️/g, '').trim();
      return {
        ...item,
        name: `${cleanBase} (${w} كغم)`,
        weight: w,
        price: Math.round(w * (item.pricePerKg || item.price || 0)),
        weightPending: false
      };
    }
    return { ...item };
  });

  const session = getCurrentSession();
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const notes = document.getElementById('cashier-pos-notes')?.value?.trim() || '';
  const custInfo = document.getElementById('cashier-customer-info')?.value?.trim() || '';
  const custPhone = document.getElementById('cashier-customer-phone')?.value?.trim() || '';
  const custAddress = document.getElementById('cashier-customer-address')?.value?.trim() || '';
  const tableNum = selectedCashierTable || document.getElementById('cashier-table-select')?.value || 1;

  const deliveryFee = (cashierOrderType === 'delivery') 
    ? (parseInt(document.getElementById('cashier-delivery-fee')?.value) || 0) 
    : 0;
  const itemsSubtotal = finalCartItems.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
  const total = itemsSubtotal + deliveryFee;

  const orders = getStoredData('orders', []);
  let orderToPrint = null;
  let fullOrderToSync = null;

  if (cashierAppendingOrderId && cashierOrderType === 'dine-in') {
    // إلحاق أصناف إضافية بنفس الفاتورة المفتوحة مسبقاً
    const existingIdx = orders.findIndex(o => o.id === cashierAppendingOrderId);
    if (existingIdx !== -1) {
      finalCartItems.forEach(cartItem => {
        const itemIdx = orders[existingIdx].items.findIndex(it => String(it.id) === String(cartItem.id));
        if (itemIdx !== -1) {
          orders[existingIdx].items[itemIdx].quantity += cartItem.quantity;
        } else {
          orders[existingIdx].items.push({ ...cartItem });
        }
      });
      orders[existingIdx].total += itemsSubtotal;
      if (notes) {
        orders[existingIdx].notes = orders[existingIdx].notes 
          ? `${orders[existingIdx].notes} | [إضافة]: ${notes}` 
          : `[إضافة]: ${notes}`;
      }
      setStoredData('orders', orders);
      fullOrderToSync = orders[existingIdx];

      orderToPrint = {
        id: orders[existingIdx].id + '-ADD',
        type: 'dine-in',
        tableNumber: parseInt(tableNum),
        captainName: 'كاشير المطعم (مباشر)',
        items: [...finalCartItems],
        notes: `(إلحاق طلب لطاولة ${tableNum}) ${notes}`,
        subtotal: itemsSubtotal,
        deliveryFee: 0,
        total: itemsSubtotal,
        currency: config.currency,
        status: 'pending_kitchen',
        timestamp: Date.now()
      };
    }
  }

  if (!orderToPrint) {
    const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
    const orderId = 'ORD-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    const newOrder = {
      id: orderId,
      restaurant_id: restId,
      type: cashierOrderType, // 'takeaway' | 'dine-in' | 'delivery'
      tableNumber: cashierOrderType === 'dine-in' ? parseInt(tableNum) : null,
      customerInfo: custInfo,
      customerName: custInfo,
      customerPhone: custPhone,
      customerAddress: cashierOrderType === 'delivery' ? custAddress : '',
      captainName: 'كاشير المطعم (مباشر)',
      items: [...finalCartItems],
      notes: notes,
      subtotal: itemsSubtotal,
      deliveryFee: deliveryFee,
      total: total,
      currency: config.currency,
      status: 'pending_kitchen',
      source: 'cashier',
      timestamp: Date.now()
    };
    orders.unshift(newOrder);
    setStoredData('orders', orders);
    orderToPrint = newOrder;
    fullOrderToSync = newOrder;
  }

  // إعادة ضبط السلة والحقول
  cashierPOSCart = [];
  cashierAppendingOrderId = null;
  const notesInput = document.getElementById('cashier-pos-notes');
  if (notesInput) notesInput.value = '';
  const custInput = document.getElementById('cashier-customer-info');
  if (custInput) custInput.value = '';
  const phoneInput = document.getElementById('cashier-customer-phone');
  if (phoneInput) phoneInput.value = '';
  const addrInput = document.getElementById('cashier-customer-address');
  if (addrInput) addrInput.value = '';
  const feeInput = document.getElementById('cashier-delivery-fee');
  if (feeInput) feeInput.value = '0';

  // إغلاق شاشة المنيو والعودة للوحة الكاشير الرئيسية
  closeCashierOrderTakingView();

  loadCashierOrders();
  renderCashierStats();

  // ✅ إشغال الطاولة فورياً في واجهة الكاشير قبل انتظار Supabase
  if (cashierOrderType === 'dine-in' && tableNum) {
    const tNum = parseInt(tableNum);
    if (tNum > 0) {
      updateCashierTableBoxUI(tNum, true);
      // تحديث شبكة الطاولات في نافذة الاختيار إن كانت مفتوحة
      if (typeof populateCashierTableSelect === 'function') {
        const cfg = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
        populateCashierTableSelect(cfg.tablesCount || 20, null);
      }
    }
  }

  // إشعار جميع الشاشات محلياً
  window.dispatchEvent(new Event('storage'));
  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: fullOrderToSync ? fullOrderToSync.id : null 
      });
    }
  } catch(e) {}

  // فتح ومزامنة جلسة الطلب النشطة في Supabase لجميع الأجهزة والشاشات
  if (fullOrderToSync && typeof sendOrderToSupabase === 'function') {
    sendOrderToSupabase(fullOrderToSync);
  }
  if (typeof showCashierToast === 'function') {
    showCashierToast("تم حفظ الطلب وتحديث السحابة بنجاح 🚀✅", "✅");
  }

  // طباعة الفاتورة أو بون المطبخ حسب الوجهة المحددة بدقة (فردية دائماً)
  try {
    if (dest === 'customer') {
      printCashierBillOnly(orderToPrint);
    } else {
      printCashierKitchenOnly(orderToPrint);
    }
  } catch (printErr) {
    console.warn("Print execution error in submitCashierPOSOrder:", printErr);
  }
}
window.submitCashierPOSOrder = submitCashierPOSOrder;

function printCashierKitchenOnly(order) {
  if (!order) return;
  if (typeof printKitchenWithSubStations === 'function') {
    printKitchenWithSubStations(order);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'kitchen');
  } else if (typeof renderAndPrintCashierTicket === 'function') {
    renderAndPrintCashierTicket(order);
  }
}
window.printCashierKitchenOnly = printCashierKitchenOnly;

function printCashierBillOnly(order) {
  if (!order) return;
  if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'customer');
  } else if (typeof renderAndPrintCashierTicket === 'function') {
    renderAndPrintCashierTicket(order);
  }
}
window.printCashierBillOnly = printCashierBillOnly;

function printOrderDirectById(orderId, type = 'kitchen') {
  const orders = getStoredData('orders', []);
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;
  if (type === 'customer') {
    // التحقق من الأصناف بالوزن (مثل السمك): لا يمكن طباعة الحساب إلا بعد تحديد الوزن الفعلي
    const unweighedIdx = order.items.findIndex(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || i.weight <= 0));
    if (unweighedIdx !== -1) {
      if (typeof showCashierToast === 'function') {
        showCashierToast("يرجى تحديد وزن الصنف أولاً لطباعة الحساب بدقة! ⚖️", "⚠️");
      }
      openWeightModalForOrder(orderId, unweighedIdx, () => {
        // بعد إدخال وتأكيد الوزن، نقوم بطباعة الحساب تلقائياً
        printOrderDirectById(orderId, 'customer');
      });
      return;
    }
    printCashierBillOnly(order);
  } else {
    printCashierKitchenOnly(order);
  }
}
window.printOrderDirectById = printOrderDirectById;

function renderAndPrintCashierTicket(order) {
  if (typeof printCashierBillOnly === 'function') {
    printCashierBillOnly(order);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'customer');
  } else {
    window.print();
  }
}
window.renderAndPrintCashierTicket = renderAndPrintCashierTicket;

// -------------------------------------------------------------
// 2. إحصائيات سريعة للكاشير
// -------------------------------------------------------------
function renderCashierStats() {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const orders = getStoredData('orders', []);

  const totalDishes = dishes.length;
  const availableDishes = dishes.filter(d => d.available).length;
  const outOfStockDishes = dishes.filter(d => !d.available).length;
  const activeOrders = orders.filter(o => o.status !== 'completed').length;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('stat-total-dishes', totalDishes);
  setEl('stat-available-dishes', availableDishes);
  setEl('stat-out-dishes', outOfStockDishes);
  setEl('stat-active-orders', activeOrders);
}

// -------------------------------------------------------------
// 3. عرض وتصفية أطباق المنيو في قسم التعديل
// -------------------------------------------------------------
function renderCashierCategories() {
  const container = document.getElementById('cashier-categories-bar');
  if (!container) return;

  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  container.innerHTML = categories.map(cat => `
    <button onclick="selectCashierCategory('${cat.id}')" class="cat-pill ${cashierCurrentCat === cat.id ? 'active' : ''} text-xs py-2 px-3.5">
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function selectCashierCategory(catId) {
  cashierCurrentCat = catId;
  renderCashierCategories();
  renderCashierDishes();
}

function renderCashierDishes() {
  const container = document.getElementById('cashier-dishes-table-body');
  if (!container) return;

  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  let filtered = dishes.filter(d => {
    if (cashierCurrentCat !== 'all' && d.categoryId !== cashierCurrentCat) return false;
    if (cashierSearch) {
      const matchName = d.name && d.name.toLowerCase().includes(cashierSearch);
      const matchIng = d.ingredients && d.ingredients.toLowerCase().includes(cashierSearch);
      if (!matchName && !matchIng) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-500 text-xs">
          لم يتم العثور على أطباق مطابقة
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered.map(dish => {
    const cat = categories.find(c => c.id === dish.categoryId) || { name: dish.categoryId };

    return `
      <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition text-xs">
        <td class="p-3">
          <img src="${dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" class="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow" loading="lazy" />
        </td>
        <td class="p-3">
          <div class="font-bold text-white text-sm">${dish.name}</div>
          ${dish.nameEn ? `<div class="text-[10px] text-slate-400 mb-1">${dish.nameEn}</div>` : ''}
          ${dish.ingredients ? `<div class="text-[10px] text-slate-300 line-clamp-1">🌿 ${dish.ingredients}</div>` : ''}
        </td>
        <td class="p-3">
          <span class="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-medium">${cat.name}</span>
        </td>
        <td class="p-3">
          <div class="flex flex-col">
            <span class="font-black text-rose-400 text-sm">${Number(dish.price).toLocaleString()} ${config.currency}</span>
            ${dish.oldPrice && Number(dish.oldPrice) > Number(dish.price) ? `
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[10px] text-slate-500 line-through">${Number(dish.oldPrice).toLocaleString()}</span>
                <span class="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-1.5 py-0.2 rounded">
                  خصم ${Math.round(((Number(dish.oldPrice) - Number(dish.price)) / Number(dish.oldPrice)) * 100)}% 🔥
                </span>
              </div>
            ` : ''}
          </div>
        </td>
        <td class="p-3">
          <button onclick="toggleDishAvailabilityFromCashier('${dish.id}')" class="py-1 px-3 rounded-full text-xs font-black transition flex items-center gap-1.5 ${
            dish.available 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30' 
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
          }">
            <span class="w-2 h-2 rounded-full ${dish.available ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            <span>${dish.available ? 'متوفر للطلب ✅' : 'نفذت الكمية ❌'}</span>
          </button>
        </td>
        <td class="p-3 text-left">
          <div class="flex items-center gap-1.5 justify-end">
            <button onclick="openCashierEditModal('${dish.id}')" class="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1">
              <span>✏️ تعديل</span>
            </button>
            <button onclick="deleteDishFromCashier('${dish.id}')" class="py-1.5 px-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-bold transition" title="حذف الصنف">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleDishAvailabilityFromCashier(dishId) {
  let dishes = getStoredData('dishes', DEFAULT_DISHES);
  const idx = dishes.findIndex(d => String(d.id) === String(dishId));
  if (idx !== -1) {
    dishes[idx].available = !dishes[idx].available;
    setStoredData('dishes', dishes);
    window._lastDishSaveTime = Date.now();
    renderCashierDishes();
    renderCashierPOSDishes();
    renderCashierStats();
    window.dispatchEvent(new Event('storage'));
    
    // المزامنة الفورية السحابية لتحديث حالة التوفر بدون كسر قيود الأعمدة
    updateDishAvailabilityInSupabase(dishId, dishes[idx].available);

    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_emenu_channel');
        bc.postMessage({ type: 'DISH_AVAILABILITY_CHANGED', dishId: dishId, available: dishes[idx].available });
        bc.close();
      }
    } catch (e) {}
  }
}

function deleteDishFromCashier(dishId) {
  if (confirm("هل أنت متأكد من حذف هذا الصنف بالكامل من المنيو؟")) {
    let dishes = getStoredData('dishes', DEFAULT_DISHES);
    dishes = dishes.filter(d => String(d.id) !== String(dishId));
    setStoredData('dishes', dishes);
    renderCashierDishes();
    renderCashierPOSDishes();
    renderCashierStats();
    window.dispatchEvent(new Event('storage'));
    
    // الحذف من Supabase
    deleteDishFromSupabase(dishId);

    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_emenu_channel');
        bc.postMessage({ type: 'DISH_DELETED', dishId: dishId });
        bc.close();
      }
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// 4. إضافة وتعديل طبق من صفحة الكاشير
// -------------------------------------------------------------
function toggleDishPricingTypeUI() {
  const type = document.getElementById('dish-form-pricing-type')?.value || 'fixed';
  const label = document.getElementById('dish-form-price-label');
  const priceInput = document.getElementById('dish-form-price');
  if (label) {
    if (type === 'per_kg') {
      label.textContent = "سعر الكيلوغرام الواحد (د.ع) *";
      label.className = "block text-xs font-bold text-amber-300 mb-1";
      if (priceInput) priceInput.placeholder = "مثال: 12000 د.ع / كغم";
    } else {
      label.textContent = "السعر الحالي (د.ع) *";
      label.className = "block text-xs font-bold text-slate-300 mb-1";
      if (priceInput) priceInput.placeholder = "مثال: 5000";
    }
  }
}
window.toggleDishPricingTypeUI = toggleDishPricingTypeUI;

function openCashierAddModal() {
  document.getElementById('dish-modal-title').textContent = "إضافة طبق جديد للمنيو";
  document.getElementById('cashier-dish-form').reset();
  document.getElementById('dish-form-id').value = "";
  const pt = document.getElementById('dish-form-pricing-type');
  if (pt) pt.value = "fixed";
  toggleDishPricingTypeUI();
  updateDishImagePreview('', 'cashier-dish-form-preview-img');
  populateCashierCategorySelect();
  document.getElementById('cashier-dish-modal').classList.remove('hidden');
}

function openCashierEditModal(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish) {
    alert("لم يتم العثور على بيانات الصنف!");
    return;
  }

  document.getElementById('dish-modal-title').textContent = "تعديل بيانات وصورة الطبق: " + dish.name;
  populateCashierCategorySelect(dish.categoryId);

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  setVal('dish-form-id', dish.id);
  setVal('dish-form-name', dish.name);
  setVal('dish-form-name-en', dish.nameEn);
  setVal('dish-form-price', dish.price);
  setVal('dish-form-old-price', dish.oldPrice);
  setVal('dish-form-ingredients', dish.ingredients);
  setVal('dish-form-calories', dish.calories);
  setVal('dish-form-image', dish.image);
  setVal('dish-form-desc', dish.description);

  const pricingType = dish.pricingType || (dish.isWeighted ? 'per_kg' : 'fixed');
  setVal('dish-form-pricing-type', pricingType);
  toggleDishPricingTypeUI();

  updateDishImagePreview(dish.image, 'cashier-dish-form-preview-img');

  setCheck('dish-form-free-delivery', dish.freeDelivery);
  setCheck('dish-form-popular', dish.isPopular);
  setCheck('dish-form-spicy', dish.isSpicy);
  setCheck('dish-form-veg', dish.isVeg);
  setCheck('dish-form-new', dish.isNew);
  setCheck('dish-form-available', dish.available !== false);

  document.getElementById('cashier-dish-modal').classList.remove('hidden');
}

function closeCashierDishModal() {
  document.getElementById('cashier-dish-modal').classList.add('hidden');
}

function populateCashierCategorySelect(selectedId = null) {
  const select = document.getElementById('dish-form-category');
  if (!select) return;
  const categories = getStoredData('categories', DEFAULT_CATEGORIES).filter(c => c.id !== 'all');
  
  select.innerHTML = categories.map(c => `
    <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>
  `).join('');
}

async function saveDishFromCashier(e) {
  e.preventDefault();
  const idVal = document.getElementById('dish-form-id').value;
  let dishes = getStoredData('dishes', DEFAULT_DISHES);

  const oldPriceVal = document.getElementById('dish-form-old-price')?.value?.trim();
  const pricingType = document.getElementById('dish-form-pricing-type')?.value || 'fixed';
  const isWeighted = (pricingType === 'per_kg');
  const priceNum = parseFloat(document.getElementById('dish-form-price').value) || 0;

  const dishData = {
    name: document.getElementById('dish-form-name').value.trim(),
    nameEn: document.getElementById('dish-form-name-en').value.trim(),
    categoryId: document.getElementById('dish-form-category').value,
    price: priceNum,
    pricingType: pricingType,
    isWeighted: isWeighted,
    unitPrice: isWeighted ? priceNum : null,
    pricePerKg: isWeighted ? priceNum : null,
    oldPrice: (oldPriceVal && !isNaN(parseFloat(oldPriceVal))) ? parseFloat(oldPriceVal) : null,
    ingredients: document.getElementById('dish-form-ingredients').value.trim(),
    calories: document.getElementById('dish-form-calories').value.trim(),
    image: document.getElementById('dish-form-image').value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    description: document.getElementById('dish-form-desc').value.trim(),
    freeDelivery: document.getElementById('dish-form-free-delivery')?.checked || false,
    isPopular: document.getElementById('dish-form-popular').checked,
    isSpicy: document.getElementById('dish-form-spicy').checked,
    isVeg: document.getElementById('dish-form-veg').checked,
    isNew: document.getElementById('dish-form-new').checked,
    available: document.getElementById('dish-form-available').checked
  };

  if (idVal) {
    dishData.id = isNaN(idVal) ? idVal : Number(idVal);
    const idx = dishes.findIndex(d => String(d.id) === String(idVal));
    if (idx !== -1) {
      dishes[idx] = { ...dishes[idx], ...dishData };
    } else {
      dishes.push(dishData);
    }
  } else {
    dishData.id = Date.now();
    dishes.push(dishData);
  }

  dishes = dishes.filter(d => d && d.id && d.id !== 'undefined' && d.id !== 'null');
  window._lastDishSaveTime = Date.now();
  setStoredData('dishes', dishes);
  closeCashierDishModal();
  renderCashierDishes();
  renderCashierPOSDishes();
  renderCashierStats();
  window.dispatchEvent(new Event('storage'));

  // المزامنة الفورية مع Supabase
  await saveDishToSupabase(dishData);

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.postMessage({ type: 'DISH_SAVED', dish: dishData });
      bc.close();
    }
  } catch (e) {}
  alert("تم حفظ وتحديث الطبق بنجاح ونشره على المنيو! ✅");
}

// -------------------------------------------------------------
// 5. إدارة ومتابعة الطلبات وموافقة الكاشير والطباعة
// -------------------------------------------------------------
// -------------------------------------------------------------
// صوت تنبيه وصول طلب جديد للكاشير (Web Audio Chime - Ding Dong)
// -------------------------------------------------------------
function playCashierOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    // النغمة الأولى
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // النغمة الثانية المرتفعة (Ding-Dong)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18); // A5
    gain2.gain.setValueAtTime(0.28, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.75);
  } catch (e) {
    console.warn("Audio chime playback notice:", e);
  }
}

// -------------------------------------------------------------
// نافذة تفاصيل ومكونات الطبق المتقدمة (Dish Details Modal)
// -------------------------------------------------------------
function showDishDetailsModal(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => d.id === dishId);
  if (!dish) return;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  let modal = document.getElementById('dish-details-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dish-details-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
      <div class="relative h-48 sm:h-56 bg-slate-950 flex items-center justify-center overflow-hidden">
        ${dish.image ? `
          <img src="${dish.image}" alt="${dish.name}" class="w-full h-full object-cover">
        ` : `
          <span class="text-6xl">🍽️</span>
        `}
        <button onclick="closeDishDetailsModal()" class="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white font-bold flex items-center justify-center backdrop-blur-md transition">✕</button>
        ${!dish.available ? `
          <div class="absolute inset-0 bg-black/75 flex items-center justify-center">
            <span class="bg-rose-600 text-white font-black text-sm px-4 py-1.5 rounded-xl shadow-lg">غير متوفر حالياً (نافذ)</span>
          </div>
        ` : ''}
      </div>

      <div class="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-xl font-black text-white leading-tight">${dish.name}</h3>
            ${dish.nameEn ? `<div class="text-xs text-slate-400 font-sans mt-0.5">${dish.nameEn}</div>` : ''}
          </div>
          <div class="text-rose-400 font-black text-lg font-mono whitespace-nowrap">${dish.price.toLocaleString()} ${config.currency}</div>
        </div>

        <!-- المميزات والشارات -->
        <div class="flex flex-wrap gap-1.5">
          ${dish.calories ? `<span class="text-xs bg-slate-800 text-amber-300 font-mono px-2.5 py-1 rounded-xl border border-slate-700">⚡ ${dish.calories}</span>` : ''}
          ${dish.isSpicy ? `<span class="text-xs bg-rose-950/90 text-rose-300 px-2.5 py-1 rounded-xl border border-rose-800">🌶️ حار جداً</span>` : ''}
          ${dish.isVeg ? `<span class="text-xs bg-emerald-950/90 text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-800">🥗 نباتي</span>` : ''}
          ${dish.isPopular ? `<span class="text-xs bg-amber-950/90 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-800">⭐ الأكثر طلباً</span>` : ''}
          ${dish.isNew ? `<span class="text-xs bg-blue-950/90 text-blue-300 px-2.5 py-1 rounded-xl border border-blue-800">✨ صنف جديد</span>` : ''}
        </div>

        <!-- المكونات الكاملة -->
        ${dish.ingredients ? `
          <div class="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <div class="text-xs font-black text-amber-400 flex items-center gap-1.5">
              <span>🌿</span>
              <span>المكونات وتفاصيل التحضير:</span>
            </div>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${dish.ingredients}</p>
          </div>
        ` : ''}

        <!-- الوصف الإضافي -->
        ${dish.description && dish.description !== dish.ingredients ? `
          <div class="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60">
            ${dish.description}
          </div>
        ` : ''}
      </div>

      <div class="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
        <button onclick="closeDishDetailsModal()" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">إغلاق</button>
        ${dish.available ? `
          <button onclick="addDishToCashierCart('${dish.id}'); closeDishDetailsModal();" class="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30">
            <span>➕ إضافة إلى طلب الطاولة</span>
          </button>
        ` : `
          <span class="text-xs text-slate-500 font-bold">الطبق غير متوفر للطلب</span>
        `}
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

function closeDishDetailsModal() {
  const modal = document.getElementById('dish-details-modal');
  if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------
// محرك المزامنة السحابية الحية (Supabase Realtime + Postgres Changes)
// -------------------------------------------------------------
let cashierCloudOrdersChannel = null;

async function sendOrderToSupabase(order) {
  if (!order || !order.id) return;

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);

  // مطابقة حالة الطلب بدقة مع قيد الجدول CHECK constraint في Supabase لتجنب أخطاء 400
  let dbStatus = order.status || 'pending_kitchen';
  if (dbStatus === 'new' || dbStatus === 'pending') dbStatus = 'pending_kitchen';
  if (dbStatus === 'cooking' || dbStatus === 'in_progress') dbStatus = 'in_kitchen';
  if (dbStatus === 'ready' || dbStatus === 'delivered') dbStatus = 'served';
  if (dbStatus === 'paid') dbStatus = 'completed';
  if (!['pending_kitchen', 'in_kitchen', 'served', 'completed', 'cancelled', 'call_waiter', 'request_bill', 'pending_cashier'].includes(dbStatus)) {
    dbStatus = 'pending_kitchen';
  }

  // الحفاظ على السعة المجانية 500MB: إرسال بيانات الأصناف بنقاء وبدون صور base64
  const leanItems = (Array.isArray(order.items) ? order.items : []).map(i => ({
    id: i.id,
    name: i.name,
    price: Number(i.price) || 0,
    quantity: Number(i.quantity) || 1,
    weight: i.weight !== undefined && i.weight !== null ? Number(i.weight) : null,
    isWeighted: !!i.isWeighted,
    pricePerKg: i.pricePerKg ? Number(i.pricePerKg) : null,
    notes: i.notes || ''
  }));

  const totalVal = parseFloat(order.total) || 0;

  const dbPayload = {
    id: String(order.id),
    restaurant_id: restId,
    type: (['dine-in', 'takeaway', 'delivery'].includes(order.type)) ? order.type : 'dine-in',
    table_number: order.tableNumber ? parseInt(order.tableNumber) : null,
    customer_name: order.customerName || order.customerInfo || order.captainName || 'طلب كاشير',
    customer_phone: order.customerPhone || '',
    customer_address: order.customerAddress || '',
    map_url: order.mapUrl || '',
    items: leanItems,
    notes: order.notes || '',
    total: totalVal,
    currency: order.currency || 'د.ع',
    status: dbStatus,
    source: order.source || 'cashier',
    created_at: new Date(order.timestamp || Date.now()).toISOString(),
    updated_at: new Date().toISOString()
  };

  let synced = false;
  if (client) {
    try {
      const { error } = await client.from('restaurant_orders').upsert([dbPayload]);
      if (!error) {
        synced = true;
        console.log("✅ Order synced to Supabase successfully via SDK:", order.id);
      } else {
        console.warn("Supabase cashier order upsert notice:", error.message);
      }
    } catch (err) {
      console.warn("Supabase upsert error:", err);
    }
  }

  // إذا لم يتم الرفع بنجاح عبر SDK أو كان client غير جاهز، نقوم برفعه فوراً واحتياطياً عبر REST المباشر
  if (!synced) {
    try {
      const sbUrl = (typeof getActiveSupabaseUrl === 'function') ? getActiveSupabaseUrl() : DEFAULT_SUPABASE_URL;
      const sbKey = (typeof getActiveSupabaseAnonKey === 'function') ? getActiveSupabaseAnonKey() : DEFAULT_SUPABASE_ANON_KEY;
      const resp = await fetch(`${sbUrl}/rest/v1/restaurant_orders`, {
        method: 'POST',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(dbPayload)
      });
      if (resp.ok) {
        synced = true;
        console.log("✅ Order synced to Supabase via direct REST fallback:", order.id);
      } else {
        const errText = await resp.text();
        console.warn("Direct REST upsert failed:", resp.status, errText);
      }
    } catch (e) {
      console.warn("Direct REST upsert fallback notice:", e);
    }
  }

  // بث التحديث عبر قناة Realtime ليصل لجميع الكباتن فوراً
  if (client) {
    try {
      const channelName = `orders_channel_${restId}`;
      const ch = client.channel(channelName);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'table_order_update',
            payload: order
          });
        }
      });
    } catch (e) {}
  }
}

function addOrderTombstone(orderId) {
  if (!orderId) return;
  try {
    const raw = localStorage.getItem('smart_emenu_tombstones') || '[]';
    const list = JSON.parse(raw);
    const sid = String(orderId).trim();
    if (!list.includes(sid)) {
      list.push(sid);
      if (list.length > 500) list.shift();
      localStorage.setItem('smart_emenu_tombstones', JSON.stringify(list));
    }
  } catch (e) {}
}

function isOrderTombstoned(orderId) {
  if (!orderId) return false;
  try {
    const raw = localStorage.getItem('smart_emenu_tombstones') || '[]';
    const list = JSON.parse(raw);
    return list.includes(String(orderId).trim());
  } catch (e) {
    return false;
  }
}

async function deleteOrderFromSupabase(orderId, forcePurge = false) {
  if (!orderId) return;
  const cleanId = String(orderId).trim();

  // لا يتم مسح الطلب نهائياً من سوبابيس إلا إذا كان الحذف صادراً صراحة من سلة تصفير الأدمن أو السوبر أدمن
  if (!forcePurge) {
    if (typeof updateOrderInSupabase === 'function') {
      await updateOrderInSupabase(cleanId, { status: 'cancelled', updated_at: new Date().toISOString() });
    }
    return;
  }

  addOrderTombstone(cleanId);
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);

  // 1. حذف مباشر عبر Supabase JS Client
  if (client) {
    try {
      const { error } = await client.from('restaurant_orders').delete().eq('id', cleanId);
      if (!error) {
        console.log("Deleted order from Supabase restaurant_orders successfully:", cleanId);
      } else {
        console.warn("Supabase client delete notice:", error.message);
      }
    } catch (e) {
      console.warn("Supabase delete error:", e);
    }
  }

  // 2. حذف احتياطي حتمي ومباشر عبر HTTP REST API لضمان المسح التام 100%
  try {
    const sbUrl = (typeof getActiveSupabaseUrl === 'function') ? getActiveSupabaseUrl() : DEFAULT_SUPABASE_URL;
    const sbKey = (typeof getActiveSupabaseAnonKey === 'function') ? getActiveSupabaseAnonKey() : DEFAULT_SUPABASE_ANON_KEY;
    await fetch(`${sbUrl}/rest/v1/restaurant_orders?id=eq.${encodeURIComponent(cleanId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Direct REST DELETE executed successfully for order:", cleanId);
  } catch (fetchErr) {
    console.warn("Direct REST delete error:", fetchErr);
  }

  // 3. بث إشعار الحذف عبر Realtime لتفريغ الطاولة والشاشات لدى الجميع فوراً
  if (client) {
    try {
      const channelName = `orders_channel_${restId}`;
      const ch = client.channel(channelName);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'order_deleted',
            payload: { orderId: cleanId }
          });
        }
      });
    } catch (e) {}
  }
}

async function updateOrderInSupabase(orderId, updateFields) {
  if (!orderId) return;
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);

  // مطابقة الحالة بدقة مع قيد الجدول restaurant_orders_status_check في Supabase
  if (updateFields && updateFields.status) {
    let s = updateFields.status;
    if (s === 'new' || s === 'pending') s = 'pending_kitchen';
    if (s === 'preparing' || s === 'cooking') s = 'in_kitchen';
    if (s === 'ready' || s === 'delivered') s = 'served';
    if (s === 'paid') s = 'completed';
    if (!['pending_kitchen', 'in_kitchen', 'served', 'completed', 'cancelled', 'call_waiter', 'request_bill', 'pending_cashier'].includes(s)) {
      s = 'pending_kitchen';
    }
    updateFields.status = s;
  }

  let updated = false;
  if (client) {
    try {
      const { error } = await client.from('restaurant_orders').update(updateFields).eq('id', String(orderId));
      if (!error) updated = true;
    } catch (e) {
      console.warn("Supabase SDK update error:", e);
    }
  }
  if (!updated) {
    try {
      const sbUrl = (typeof getActiveSupabaseUrl === 'function') ? getActiveSupabaseUrl() : DEFAULT_SUPABASE_URL;
      const sbKey = (typeof getActiveSupabaseAnonKey === 'function') ? getActiveSupabaseAnonKey() : DEFAULT_SUPABASE_ANON_KEY;
      await fetch(`${sbUrl}/rest/v1/restaurant_orders?id=eq.${encodeURIComponent(String(orderId))}`, {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateFields)
      });
    } catch (restErr) {
      console.warn("Direct REST update fallback error:", restErr);
    }
  }
}

function initCashierCloudOrdersListener() {
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
  if (!client) return;

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

  try {
    const channelName = `orders_channel_${restId}`;
    cashierCloudOrdersChannel = client.channel(channelName);
    cashierCloudOrdersChannel
      .on('broadcast', { event: 'new_customer_order' }, ({ payload }) => {
        console.log("🔔 Realtime new order received:", payload);
        handleIncomingCloudOrder(payload);
        syncOrdersFromSupabase();
      })
      .on('broadcast', { event: 'table_order_update' }, ({ payload }) => {
        console.log("🔄 Realtime table order updated:", payload);
        syncOrdersFromSupabase();
      })
      .on('broadcast', { event: 'order_reopened' }, ({ payload }) => {
        console.log("🔄 Realtime order reopened by admin:", payload);
        const reopenedId = payload ? (payload.id || (payload.order && payload.order.id)) : null;
        if (reopenedId) {
          let orders = getStoredData('orders', []);
          const oIdx = orders.findIndex(o => String(o.id) === String(reopenedId));
          if (oIdx !== -1) {
            orders[oIdx].status = 'in_kitchen';
            delete orders[oIdx].paidAt;
            delete orders[oIdx].completedAt;
            setStoredData('orders', orders);
          } else if (payload.order) {
            const ord = { ...payload.order, status: 'in_kitchen' };
            delete ord.paidAt;
            delete ord.completedAt;
            orders.unshift(ord);
            setStoredData('orders', orders);
          } else {
            const archive = getStoredData('accounting_archive', []);
            const arch = archive.find(o => o && String(o.id) === String(reopenedId));
            if (arch) {
              const ord = { ...arch, status: 'in_kitchen' };
              delete ord.paidAt;
              delete ord.completedAt;
              orders.unshift(ord);
              setStoredData('orders', orders);
            }
          }
        }
        // الانتقال تلقائياً إلى قسم الطلبات الجارية
        if (typeof switchCashierTab === 'function') {
          switchCashierTab('orders');
        }
        loadCashierOrders();
        renderCashierStats();
        renderCashierTablesGrid();
        if (typeof loadCashierAccounting === 'function') {
          loadCashierAccounting();
        }
        syncOrdersFromSupabase();
        playCashierOrderChime();
        if (typeof showCashierToast === 'function') {
          const tInfo = (payload && payload.tableNumber) ? `طاولة [ ${payload.tableNumber} ]` : (reopenedId ? '#' + reopenedId : '');
          showCashierToast(`🔔 تنبيه: تم إرجاع طلب ${tInfo} إلى الطلبات الجارية (قيد التحضير) من قبل المطبخ/الإدارة`, '🔄');
        }
      })
      .on('broadcast', { event: 'order_deleted' }, ({ payload }) => {
        console.log("🗑️ Realtime order deleted:", payload);
        syncOrdersFromSupabase();
      })
      .on('broadcast', { event: 'call_waiter' }, ({ payload }) => {
        console.log("🛎️ Call Waiter event received:", payload);
        handleCashierTableServiceAlert('call_waiter', payload);
      })
      .on('broadcast', { event: 'request_bill' }, ({ payload }) => {
        console.log("💳 Request Bill event received:", payload);
        handleCashierTableServiceAlert('request_bill', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `restaurant_id=eq.${restId}` }, (payload) => {
        console.log("⚡ Postgres table change detected:", payload);
        if (payload.eventType === 'INSERT') {
          playCashierOrderChime();
        }
        syncOrdersFromSupabase();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ Cashier subscribed to Supabase Realtime orders channel:", channelName);
        }
      });

    // الاستماع الإضافي لقناة الكاشير الحية
    const chLive = client.channel('cashier-live-orders');
    chLive
      .on('broadcast', { event: 'new_customer_order' }, ({ payload }) => {
        console.log("🔔 Cashier live broadcast order received:", payload);
        handleIncomingCloudOrder(payload);
        syncOrdersFromSupabase();
      })
      .subscribe();
  } catch (err) {
    console.warn("Realtime listener init error:", err);
  }

  // مزامنة أولية عند الفتح
  syncOrdersFromSupabase();
}

function handleIncomingCloudOrder(newOrder) {
  if (!newOrder || !newOrder.id) return;
  if (isOrderTombstoned(newOrder.id)) return;
  if (newOrder.status === 'completed' || newOrder.status === 'cancelled') return;

  const orders = getStoredData('orders', []);
  const existingIndex = orders.findIndex(o => o.id === newOrder.id);

  if (existingIndex === -1) {
    const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
    const cleanOrder = {
      ...newOrder,
      restaurant_id: newOrder.restaurant_id || restId,
      status: newOrder.status || 'pending_cashier'
    };
    orders.unshift(cleanOrder);
    setStoredData('orders', orders);

    // تشغيل صوت التنبيه فوراً
    playCashierOrderChime();

    // تحديث واجهة الطلبات والبانر الوامض وخريطة الطاولات
    loadCashierOrders();
    renderCashierStats();
    renderCashierTablesGrid();

    // إشعار باقي التبويبات محلياً
    window.dispatchEvent(new Event('storage'));
  }
}

async function syncOrdersFromSupabase() {
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
  if (!client) return;

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

  try {
    const { data, error } = await client
      .from('restaurant_orders')
      .select('*')
      .eq('restaurant_id', restId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return;

    let localOrders = getStoredData('orders', []);
    let hasNewPending = false;
    let modified = false;

    const cloudOrderIds = new Set(data.map(d => d.id));

    data.forEach(remote => {
      if (isOrderTombstoned(remote.id)) return;

      const idx = localOrders.findIndex(o => o.id === remote.id);
      const mapped = {
        id: remote.id,
        restaurant_id: remote.restaurant_id || restId,
        type: remote.type || 'dine-in',
        tableNumber: remote.table_number ? parseInt(remote.table_number) : null,
        items: Array.isArray(remote.items) ? remote.items : [],
        notes: remote.notes || '',
        customerName: remote.customer_name || '',
        customerPhone: remote.customer_phone || '',
        customerAddress: remote.customer_address || '',
        mapUrl: remote.map_url || '',
        total: parseFloat(remote.total || remote.total_amount) || 0,
        currency: remote.currency || 'د.ع',
        status: remote.status || 'pending_kitchen',
        source: remote.source || 'online_menu',
        timestamp: remote.created_at ? new Date(remote.created_at).getTime() : Date.now()
      };

      const recentlyCompletedTime = (window._recentlyCompletedOrders && window._recentlyCompletedOrders.get(String(remote.id))) || 0;
      const isRecentlyCompleted = (Date.now() - recentlyCompletedTime < 45000);

      if (idx === -1) {
        if (isRecentlyCompleted) return; // منع إعادة إدراج طلب تم حسابه محلياً للتو
        const isClosed = mapped.status === 'completed' || mapped.status === 'cancelled';
        const now = Date.now();
        const oTime = new Date(mapped.timestamp || 0).getTime();
        const isOld = oTime && (now - oTime) > 24 * 60 * 60 * 1000;
        if (!isClosed && !isOld) {
          localOrders.push(mapped);
          modified = true;
          if (mapped.status === 'pending_cashier') {
            hasNewPending = true;
          }
        }
      } else {
        const local = localOrders[idx];
        const isClosed = mapped.status === 'completed' || mapped.status === 'cancelled';

        // حماية تامة ضد ارتداد إتمام المحاسبة من الاستعلامات العالقة
        if ((local.status === 'completed' || local.status === 'cancelled' || isRecentlyCompleted) && !isClosed) {
          const remoteUpdated = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
          const localCompleted = local.completedAt || recentlyCompletedTime || 0;
          const isExplicitReopen = remote.reopened === true || mapped.status === 'in_kitchen' || mapped.status === 'pending_cashier';

          // لا يُعاد فتح الطلب إلا إذا كان إعادة فتح صريحة بتوقيت أحدث من توقيت إتمام الحساب
          if (!isExplicitReopen || (localCompleted && remoteUpdated <= (localCompleted + 1000))) {
            return; // تجاهل النتيجة السحابية العالقة منعاً لارتداد الطلب
          }
        }

        const isReopenedFromCloud = (local.status === 'completed' || local.status === 'cancelled') && !isClosed;
        if ((local.status === 'completed' || local.status === 'cancelled') && !isReopenedFromCloud) {
          return;
        }

        const itemsDiff = JSON.stringify(local.items) !== JSON.stringify(mapped.items);
        const statusDiff = local.status !== mapped.status;
        const totalDiff = local.total !== mapped.total;
        const notesDiff = local.notes !== mapped.notes;
        const tableDiff = local.tableNumber !== mapped.tableNumber;

        if (itemsDiff || statusDiff || totalDiff || notesDiff || tableDiff || isReopenedFromCloud) {
          localOrders[idx] = { ...local, ...mapped };
          if (isReopenedFromCloud) {
            delete localOrders[idx].paidAt;
            delete localOrders[idx].completedAt;
            if (mapped.status === 'pending_cashier') {
              hasNewPending = true;
            }
          }
          modified = true;
        }
      }
    });

    // عزل وتصفية الطلبات: تنظيف أي طلبات تخص مطعماً آخر أو محذوفة (Tombstoned) أو وهمية
    localOrders = localOrders.filter(o => (!o.restaurant_id || o.restaurant_id === restId) && !isOrderTombstoned(o.id));

    // حفظ وتحديث الواجهات فورياً
    localOrders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    setStoredData('orders', localOrders);
    loadCashierOrders();
    renderCashierStats();
    renderCashierTablesGrid();
    if (typeof loadCashierAccounting === 'function') {
      loadCashierAccounting();
    }
    if (hasNewPending) {
      playCashierOrderChime();
    }
  } catch (e) {
    console.warn("Cashier syncOrdersFromSupabase error:", e);
  }
}

let cashierLiveTimer = null;

function startCashierLiveSync() {
  if (cashierLiveTimer) clearInterval(cashierLiveTimer);
  cashierLiveTimer = setInterval(() => {
    loadCashierOrders();
    renderCashierStats();
    renderCashierTablesGrid();
    syncOrdersFromSupabase();
  }, 4000);

  window.addEventListener('storage', () => {
    loadCashierOrders();
    renderCashierStats();
    renderCashierTablesGrid();
    renderCashierPOSDishes();
    renderCashierDishes();
  });

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.onmessage = (ev) => {
        if (ev.data) {
          if (ev.data.type === 'ORDER_REOPENED') {
            const reopenedId = ev.data.orderId;
            const tNum = ev.data.tableNumber;
            let orders = getStoredData('orders', []);
            const oIdx = orders.findIndex(o => String(o.id) === String(reopenedId));
            if (oIdx !== -1) {
              orders[oIdx].status = 'in_kitchen';
              delete orders[oIdx].paidAt;
              delete orders[oIdx].completedAt;
              setStoredData('orders', orders);
            } else if (ev.data.order) {
              const ord = { ...ev.data.order, status: 'in_kitchen' };
              delete ord.paidAt;
              delete ord.completedAt;
              orders.unshift(ord);
              setStoredData('orders', orders);
            } else {
              const archive = getStoredData('accounting_archive', []);
              const arch = archive.find(o => o && String(o.id) === String(reopenedId));
              if (arch) {
                const ord = { ...arch, status: 'in_kitchen' };
                delete ord.paidAt;
                delete ord.completedAt;
                orders.unshift(ord);
                setStoredData('orders', orders);
              }
            }
            // الانتقال الفوري لقسم الطلبات الجارية
            if (typeof switchCashierTab === 'function') {
              switchCashierTab('orders');
            }
            loadCashierOrders();
            renderCashierStats();
            renderCashierTablesGrid();
            if (typeof loadCashierAccounting === 'function') {
              loadCashierAccounting();
            }
            syncOrdersFromSupabase();
            playCashierOrderChime();
            if (typeof showCashierToast === 'function') {
              showCashierToast(`🔔 تنبيه: تم إرجاع طلب ${tNum ? 'طاولة [' + tNum + ']' : '#' + reopenedId} إلى الطلبات الجارية (قيد التحضير) من قبل المطبخ/الإدارة`, '🔄');
            }
          }
          if (ev.data.type === 'ORDERS_CHANGED') {
            loadCashierOrders();
            renderCashierStats();
            renderCashierTablesGrid();
            syncOrdersFromSupabase();
          }
          if (ev.data.type === 'DISH_AVAILABILITY_CHANGED' || ev.data.type === 'DISH_SAVED' || ev.data.type === 'DISH_DELETED') {
            renderCashierStats();
            renderCashierPOSDishes();
            renderCashierDishes();
          }
          if (ev.data.type === 'CALL_WAITER') {
            handleCashierTableServiceAlert('call_waiter', ev.data);
          }
          if (ev.data.type === 'REQUEST_BILL') {
            handleCashierTableServiceAlert('request_bill', ev.data);
          }
        }
      };
    }
  } catch (e) {}

  // تفعيل الاستماع للبث الفوري عبر السحابة
  initCashierCloudOrdersListener();
}

function loadCashierOrders() {
  const container = document.getElementById('cashier-orders-grid');
  if (!container) return;

  const orders = getStoredData('orders', []);
  const now = Date.now();
  const activeOrders = orders.filter(o => {
    if (!o || o.status === 'completed' || o.status === 'cancelled') return false;
    const oTime = new Date(o.timestamp || 0).getTime();
    if (oTime && (now - oTime) > 24 * 60 * 60 * 1000) return false;
    return true;
  });

  // فحص الطلبات الواردة من المنيو بانتظار موافقة الكاشير
  const pendingOrders = activeOrders.filter(o => o.status === 'pending_cashier');
  const banner = document.getElementById('cashier-pending-alert-banner');
  const badge = document.getElementById('cashier-pending-orders-badge');

  if (pendingOrders.length > 0) {
    if (banner) banner.classList.remove('hidden');
    if (badge) {
      badge.textContent = `${pendingOrders.length} جديد 🔥`;
      badge.classList.remove('hidden');
    }
  } else {
    if (banner) banner.classList.add('hidden');
    if (badge) badge.classList.add('hidden');
  }

  if (activeOrders.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-10 bg-slate-900/60 rounded-3xl border border-slate-800">
        <div class="text-3xl mb-2">🍽️</div>
        <p class="text-sm text-slate-400 font-bold">لا توجد طلبات جارية حالياً</p>
        <p class="text-xs text-slate-500 mt-1">ستظهر طلبات الزبائن الواردة من المنيو وطلبات الصالة هنا فورياً</p>
      </div>
    `;
    return;
  }

  // ترتيب: الطلبات بانتظار الموافقة تظهر في البداية
  const sortedOrders = [...activeOrders].sort((a, b) => {
    if (a.status === 'pending_cashier' && b.status !== 'pending_cashier') return -1;
    if (b.status === 'pending_cashier' && a.status !== 'pending_cashier') return 1;
    return b.timestamp - a.timestamp;
  });

  container.innerHTML = sortedOrders.map(order => {
    const isPending = order.status === 'pending_cashier';
    const isPreorder = order.isPreorder === true || (order.notes && order.notes.includes('حجز مسبق لليوم التالي'));
    const dateFormatted = new Date(order.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let itemsHtml = order.items.map((i, itemIdx) => {
      const isW = (typeof isDishWeighted === 'function' && isDishWeighted(i)) || i.isWeighted || (i.pricePerKg && i.pricePerKg > 0);
      const qtyText = `<span class="text-amber-400 font-mono font-bold">(x${i.quantity || 1})</span>`;
      if (isW) {
        if (i.weight && i.weight > 0) {
          return `
            <span class="inline-flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/40 rounded-xl px-2 py-1 my-0.5 shadow-sm">
              <span class="font-bold text-white">${i.name}</span>
              ${qtyText}
              <button type="button" onclick="openWeightModalForOrder('${order.id}', ${itemIdx})" class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 rounded-lg text-emerald-300 font-mono text-[11px] font-bold transition active:scale-95 cursor-pointer" title="انقر لتعديل وزن الصنف قبل الطباعة أو الحساب">
                <span>⚖️</span>
                <span>${i.weight} كغم</span>
                <span class="text-[9px] text-emerald-400 opacity-80">(تعديل)</span>
              </button>
            </span>
          `;
        } else {
          return `
            <span class="inline-flex items-center gap-1.5 bg-slate-900/90 border border-amber-500/50 rounded-xl px-2 py-1 my-0.5 shadow-sm">
              <span class="font-bold text-white">${i.name}</span>
              ${qtyText}
              <button type="button" onclick="openWeightModalForOrder('${order.id}', ${itemIdx})" class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/70 rounded-lg text-amber-300 font-bold text-[11px] animate-pulse transition active:scale-95 cursor-pointer" title="يجب إدخال الوزن لتحديد السعر الفعلي وطباعة الحساب">
                <span>⚖️</span>
                <span>أدخل الوزن 👈</span>
              </button>
            </span>
          `;
        }
      }
      return `<span class="inline-block py-0.5 px-1">${i.name} ${qtyText}</span>`;
    }).join('، ');

    let orderTypeBadge = order.type === 'dine-in' 
      ? `🍽️ طاولة [ ${order.tableNumber || 1} ]` 
      : order.type === 'delivery' 
        ? `🚗 توصيل دليفري` 
        : `🛵 سفري / خارجي`;

    return `
      <div class="bg-slate-900 border rounded-3xl p-4 flex flex-col justify-between shadow-xl transition ${
        isPreorder
          ? 'border-purple-500/80 bg-gradient-to-b from-purple-950/40 to-slate-900 ring-2 ring-purple-500/40'
          : isPending 
            ? 'border-amber-500/80 bg-gradient-to-b from-amber-950/30 to-slate-900 ring-2 ring-amber-500/40' 
            : 'border-slate-800'
      }">
        <div>
          <div class="flex justify-between items-start pb-2 border-b border-slate-800 mb-2.5">
            <div>
              <div class="font-black text-white text-base">${orderTypeBadge}</div>
              <div class="text-[11px] text-slate-400">#${order.id} • 🕒 ${dateFormatted}</div>
              ${order.customerInfo || order.customerName ? `
                <div class="text-xs text-amber-300 font-black mt-0.5">👤 الزبون: ${order.customerInfo || order.customerName}</div>
              ` : ''}
              ${order.customerPhone ? `
                <div class="text-xs text-slate-300 font-mono mt-0.5">
                  📞 <a href="tel:${order.customerPhone}" class="text-rose-400 font-bold hover:underline">${order.customerPhone}</a>
                </div>
              ` : ''}
              ${order.customerAddress ? `<div class="text-[11px] text-slate-300 mt-0.5">📍 ${order.customerAddress}</div>` : ''}
              ${order.mapUrl ? `
                <div class="mt-1.5">
                  <a href="${order.mapUrl}" target="_blank" class="inline-flex items-center gap-1.5 py-1 px-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-xl text-[11px] font-bold hover:bg-blue-600 hover:text-white transition">
                    <span>🗺️ فتح موقع الزبون على الخريطة</span>
                    <span>↗</span>
                  </a>
                </div>
              ` : ''}
              ${order.captainName ? `<div class="text-[10px] text-slate-400 mt-1">بواسطة: ${order.captainName}</div>` : ''}
              ${(order.type === 'delivery' || order.order_type === 'delivery') ? `
                <div class="mt-2 p-2 bg-slate-950/80 rounded-xl border border-sky-500/30 flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-1.5 text-xs text-sky-400 font-bold">
                    <span>🛵</span>
                    <span>السائق:</span>
                    <span class="text-white font-mono">${order.driver_name || 'غير مسند'}</span>
                  </div>
                  <select onchange="assignOrderDriver('${order.id}', this.value)" class="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500">
                    <option value="">-- إسناد سائق --</option>
                    ${typeof getCachedDriversOptions === 'function' ? getCachedDriversOptions(order.driver_id) : ''}
                  </select>
                </div>
              ` : ''}
            </div>
            
            ${isPreorder ? `
              <span class="bg-purple-600/20 text-purple-300 border border-purple-500/50 text-[11px] font-black px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
                <span>📅</span>
                <span>حجز مسبق (اليوم التالي)</span>
              </span>
            ` : isPending ? `
              <span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>بانتظار الموافقة ⏳</span>
              </span>
            ` : `
              <span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
                ${order.status === 'new' ? 'جديد 🔥' : 'قيد التحضير 👨‍🍳'}
              </span>
            `}
          </div>

          ${isPreorder ? `
            <div class="bg-gradient-to-r from-purple-950/70 to-amber-950/60 border border-amber-500/40 rounded-2xl p-2.5 mb-2.5 text-xs text-amber-200 flex items-center justify-between font-bold">
              <span>📅 موعد تجهيز الحجز:</span>
              <span class="text-white font-black">غداً (${order.preorderPreferredTime || 'مع بداية الافتتاح'}) ✨</span>
            </div>
          ` : ''}

          <div class="text-xs text-slate-200 mb-3 bg-slate-950 p-3 rounded-2xl border border-slate-800/80 leading-relaxed flex flex-wrap gap-1.5 items-center">
            ${itemsHtml}
          </div>

          ${order.notes ? `
            <div class="text-xs text-amber-300 mb-2 p-2 bg-amber-950/40 rounded-xl border border-amber-500/30 font-bold">
              📝 ملاحظة: ${order.notes}
            </div>
          ` : ''}
        </div>

        <div class="pt-2 border-t border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-400 font-bold">المجموع المطلوب:</span>
            <span class="text-base font-black text-rose-400">
              ${order.total.toLocaleString()} ${order.currency || 'د.ع'}
            </span>
          </div>

          ${isPending ? `
            <!-- أزرار منفصلة: موافقة للمطبخ (101)، طباعة الحساب (100)، تعديل/إضافة، محاسبة، رفض -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
              <button onclick="acceptMenuOrderToKitchen('${order.id}')" class="py-2 px-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-md active:scale-95" title="موافقة وإرسال للمطبخ فقط (طابعة 101)">
                <span>👨‍🍳 موافقة (101)</span>
              </button>
              <button onclick="printOrderDirectById('${order.id}', 'customer')" class="py-2 px-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="طباعة كشف حساب الزبون فقط (طابعة 100)">
                <span>🧾 حساب (100)</span>
              </button>
              <button onclick="openCashierEditPendingOrderModal('${order.id}')" class="py-2 px-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="تعديل أو إضافة وجبات أو ضبط الوزن">
                <span>✏️ تعديل / إضافة</span>
              </button>
              <button onclick="completeCashierOrder('${order.id}')" class="py-2 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-md shadow-emerald-600/30 active:scale-95" title="إتمام المحاسبة">
                <span>✅ تم الحساب</span>
              </button>
              <button onclick="rejectMenuOrder('${order.id}')" class="py-2 px-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="رفض الطلب نهائياً">
                <span>❌ رفض</span>
              </button>
            </div>
          ` : `
            <!-- أزرار الطلبات المعتمدة: عزل طباعة المطبخ 101 عن الحساب 100 مع إمكانية التعديل والإضافة -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
              <button onclick="printOrderDirectById('${order.id}', 'kitchen')" class="py-2 px-1 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-md shadow-rose-600/30 active:scale-95" title="طباعة بون المطبخ على طابعة 101">
                <span>👨‍🍳 بون (101)</span>
              </button>
              <button onclick="printOrderDirectById('${order.id}', 'customer')" class="py-2 px-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="طباعة كشف حساب الزبون على طابعة 100">
                <span>🧾 حساب (100)</span>
              </button>
              <button onclick="openCashierEditPendingOrderModal('${order.id}')" class="py-2 px-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="تعديل أو إضافة أطباق أخرى لهذا الطلب">
                <span>✏️ تعديل / إضافة</span>
              </button>
              <button onclick="completeCashierOrder('${order.id}')" class="py-2 px-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1 shadow-md shadow-emerald-600/30 active:scale-95">
                <span>✅ تم الحساب</span>
              </button>
              <button onclick="deleteApprovedCashierOrder('${order.id}')" title="مسح الطلب نهائياً من السحابة لتوفير المساحة" class="py-2 px-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center active:scale-95">
                <span>🗑️ حذف</span>
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// إدارة وتعديل وحذف طلبات المنيو المعلقة (Pending Orders Editing)
// -------------------------------------------------------------
let currentEditingPendingOrder = null;

function populateEditOrderDishSelect() {
  const select = document.getElementById('ceom-add-dish-select');
  if (!select) return;
  const dishes = getStoredData('dishes', DEFAULT_DISHES).filter(d => d.available !== false);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  
  let html = '<option value="">-- اختر صنفاً من قائمة المنيو لإضافته للطلب --</option>';
  dishes.forEach(d => {
    const isW = (typeof isDishWeighted === 'function' && isDishWeighted(d)) || d.pricingType === 'per_kg';
    const priceText = `${(d.price || 0).toLocaleString()} ${config.currency || 'د.ع'}${isW ? ' / كغم' : ''}`;
    html += `<option value="${d.id}">${d.name} (${priceText})</option>`;
  });
  select.innerHTML = html;
}
window.populateEditOrderDishSelect = populateEditOrderDishSelect;

function addDishToCurrentEditingOrder() {
  if (!currentEditingPendingOrder) return;
  const select = document.getElementById('ceom-add-dish-select');
  if (!select || !select.value) {
    alert("يرجى اختيار صنف من القائمة أولاً!");
    return;
  }

  const dishId = select.value;
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish) return;

  const isW = (typeof isDishWeighted === 'function' && isDishWeighted(dish)) || dish.pricingType === 'per_kg';
  if (!currentEditingPendingOrder.items) currentEditingPendingOrder.items = [];

  // إذا كان الصنف عادياً موجوداً مسبقاً، نزيد كميته
  const existingIdx = currentEditingPendingOrder.items.findIndex(i => String(i.dishId || i.id) === String(dish.id) && !isW);
  if (existingIdx !== -1) {
    currentEditingPendingOrder.items[existingIdx].quantity = (currentEditingPendingOrder.items[existingIdx].quantity || 1) + 1;
  } else {
    currentEditingPendingOrder.items.push({
      id: dish.id,
      dishId: dish.id,
      name: dish.name,
      baseName: dish.name,
      price: isW ? 0 : (dish.price || 0),
      pricePerKg: isW ? (dish.price || 0) : null,
      isWeighted: isW,
      weight: isW ? 0 : null,
      weightPending: isW,
      quantity: 1
    });
  }

  select.value = "";
  renderPendingEditItemsList();

  // إذا كان الصنف بالوزن، نفتح نافذة إدخال الوزن فوراً
  if (isW) {
    const newIdx = currentEditingPendingOrder.items.length - 1;
    openWeightModalForEditingOrderItem(newIdx);
  }
}
window.addDishToCurrentEditingOrder = addDishToCurrentEditingOrder;

function openWeightModalForEditingOrderItem(itemIndex) {
  if (!currentEditingPendingOrder || !currentEditingPendingOrder.items[itemIndex]) return;
  const item = currentEditingPendingOrder.items[itemIndex];
  openCashierWeightModal({
    type: 'editing_order_item',
    itemIndex: itemIndex,
    name: item.baseName || item.name,
    baseName: item.baseName || item.name,
    pricePerKg: item.pricePerKg || item.price || 0,
    title: `تحديد وزن [ ${item.baseName || item.name} ] ⚖️`,
    btnText: "⚖️ تثبيت الوزن في الطلب",
    callback: () => {
      renderPendingEditItemsList();
    }
  });
}
window.openWeightModalForEditingOrderItem = openWeightModalForEditingOrderItem;

function openCashierEditPendingOrderModal(orderId) {
  let orders = getStoredData('orders', []);
  let order = orders.find(o => String(o.id) === String(orderId));
  if (!order) {
    const archive = getStoredData('accounting_archive', []);
    order = archive.find(o => o && String(o.id) === String(orderId));
    if (order) {
      order = JSON.parse(JSON.stringify(order));
      order.status = 'pending_cashier';
      delete order.paidAt;
      orders.unshift(order);
      setStoredData('orders', orders);
    }
  }
  if (!order) return;

  currentEditingPendingOrder = JSON.parse(JSON.stringify(order));
  const modal = document.getElementById('cashier-edit-order-modal');
  if (!modal) return;

  const titleEl = document.getElementById('ceom-order-title');
  const metaEl = document.getElementById('ceom-order-meta');
  const tableInput = document.getElementById('ceom-order-table');
  const notesInput = document.getElementById('ceom-order-notes');

  if (titleEl) titleEl.textContent = `تعديل وإضافة أطباق للطلب (${order.type === 'dine-in' ? `طاولة [ ${order.tableNumber || 1} ]` : 'سفري / دليفري'})`;
  if (metaEl) metaEl.textContent = `#${order.id} • العميل: ${order.customerName || (order.tableNumber ? 'طاولة ' + order.tableNumber : 'زبون')}`;
  if (tableInput) tableInput.value = order.tableNumber || '';
  if (notesInput) notesInput.value = order.notes || '';

  populateEditOrderDishSelect();
  renderPendingEditItemsList();
  modal.classList.remove('hidden');
}

function closeCashierEditOrderModal() {
  const modal = document.getElementById('cashier-edit-order-modal');
  if (modal) modal.classList.add('hidden');
  currentEditingPendingOrder = null;
}

function renderPendingEditItemsList() {
  const container = document.getElementById('ceom-items-list');
  const totalEl = document.getElementById('ceom-total-price');
  if (!container || !currentEditingPendingOrder) return;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (!currentEditingPendingOrder.items || currentEditingPendingOrder.items.length === 0) {
    container.innerHTML = `<div class="text-center py-4 text-xs text-rose-400 font-bold">⚠️ لا توجد أصناف في الطلب! يمكنك إضافة صنف جديد أدناه أو حذف الطلب</div>`;
    if (totalEl) totalEl.textContent = `0 ${config.currency || 'د.ع'}`;
    return;
  }

  container.innerHTML = currentEditingPendingOrder.items.map((item, idx) => {
    const isW = (typeof isDishWeighted === 'function' && isDishWeighted(item)) || item.isWeighted || (item.pricePerKg && item.pricePerKg > 0);
    const itemTotal = (item.price || 0) * (item.quantity || 1);

    return `
      <div class="flex items-center justify-between py-2 px-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
        <div class="flex-1 pr-1">
          <div class="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span>${item.name}</span>
            ${isW ? (
              item.weight && item.weight > 0 ? `
                <button type="button" onclick="openWeightModalForEditingOrderItem(${idx})" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 rounded text-emerald-300 font-mono text-[10px] font-bold cursor-pointer" title="تعديل الوزن">
                  <span>⚖️ ${item.weight} كغم</span>
                </button>
              ` : `
                <button type="button" onclick="openWeightModalForEditingOrderItem(${idx})" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-950 hover:bg-amber-900 border border-amber-500/70 rounded text-amber-300 text-[10px] font-bold animate-pulse cursor-pointer" title="أدخل وزن الصنف">
                  <span>⚖️ أدخل الوزن</span>
                </button>
              `
            ) : ''}
          </div>
          <div class="text-[10px] text-slate-400 font-mono">
            ${isW ? `سعر الكيلو: ${(item.pricePerKg || item.price || 0).toLocaleString()} ${config.currency || 'د.ع'}` : `${(item.price || 0).toLocaleString()} ${config.currency || 'د.ع'} للقطعة`}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
            <button type="button" onclick="updatePendingOrderItemQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">-</button>
            <span class="w-7 text-center font-mono font-bold text-amber-300 text-xs">${item.quantity || 1}</span>
            <button type="button" onclick="updatePendingOrderItemQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">+</button>
          </div>
          <span class="font-mono text-amber-400 font-bold min-w-[55px] text-left">${itemTotal.toLocaleString()}</span>
          <button type="button" onclick="removePendingOrderItem(${idx})" title="حذف الصنف" class="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition active:scale-90">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  const total = currentEditingPendingOrder.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
  currentEditingPendingOrder.total = total;
  if (totalEl) totalEl.textContent = `${total.toLocaleString()} ${config.currency || 'د.ع'}`;
}

function updatePendingOrderItemQty(idx, delta) {
  if (!currentEditingPendingOrder || !currentEditingPendingOrder.items[idx]) return;
  const item = currentEditingPendingOrder.items[idx];
  const newQty = (item.quantity || 1) + delta;
  if (newQty <= 0) {
    removePendingOrderItem(idx);
    return;
  }
  item.quantity = newQty;
  renderPendingEditItemsList();
}

function removePendingOrderItem(idx) {
  if (!currentEditingPendingOrder || !currentEditingPendingOrder.items[idx]) return;
  const item = currentEditingPendingOrder.items[idx];
  if (!confirm(`هل أنت متأكد من حذف [ ${item.name} ] من الطلب؟`)) return;
  currentEditingPendingOrder.items.splice(idx, 1);
  renderPendingEditItemsList();
}

function saveCashierEditOrder() {
  if (!currentEditingPendingOrder) return;
  if (!currentEditingPendingOrder.items || currentEditingPendingOrder.items.length === 0) {
    alert("لا يمكن حفظ طلب فارغ بدون أي أصناف! يرجى حذف الطلب بدلاً من ذلك.");
    return;
  }

  const tableInput = document.getElementById('ceom-order-table');
  const notesInput = document.getElementById('ceom-order-notes');
  if (tableInput && tableInput.value.trim()) {
    currentEditingPendingOrder.tableNumber = tableInput.value.trim();
  }
  if (notesInput) {
    currentEditingPendingOrder.notes = notesInput.value.trim();
  }

  let orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => String(o.id) === String(currentEditingPendingOrder.id));
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...currentEditingPendingOrder };
  } else {
    orders.unshift({ ...currentEditingPendingOrder });
  }
  setStoredData('orders', orders);
  window.dispatchEvent(new Event('storage'));

  // تحديث الطلب سحابياً في Supabase
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(currentEditingPendingOrder.id, {
      items: currentEditingPendingOrder.items,
      total: currentEditingPendingOrder.total,
      table_number: parseInt(currentEditingPendingOrder.tableNumber) || null,
      notes: currentEditingPendingOrder.notes || '',
      updated_at: new Date().toISOString()
    });
  }

  closeCashierEditOrderModal();
  loadCashierOrders();
  renderCashierStats();
  alert(`تم حفظ وتحديث الطلب #${currentEditingPendingOrder.id} بنجاح! ✅`);
}

function deleteCurrentEditOrderPermanently() {
  if (!currentEditingPendingOrder) return;
  const orderId = currentEditingPendingOrder.id;
  if (!confirm(`هل أنت متأكد من إلغاء الطلب #${orderId}؟`)) return;

  let orders = getStoredData('orders', []);
  const editIdx = orders.findIndex(o => o.id === orderId);
  if (editIdx !== -1) {
    orders[editIdx].status = 'cancelled';
    setStoredData('orders', orders);
  }
  window.dispatchEvent(new Event('storage'));

  // تحديث الطلب كملغي سحابياً لحفظ السجل التراكمي
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(orderId, { status: 'cancelled', updated_at: new Date().toISOString() });
  }

  closeCashierEditOrderModal();
  loadCashierOrders();
  renderCashierStats();
  alert(`تم إلغاء الطلب #${orderId} وحفظه في سجل الطلبات الملغاة بنجاح! ❌`);
}

// -------------------------------------------------------------
// موافقة الكاشير على طلب المنيو وإرساله للمطبخ فقط (طابعة 101)
// -------------------------------------------------------------
function acceptMenuOrderToKitchen(orderId) {
  let orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;

  orders[idx].status = 'preparing';
  orders[idx].acceptedBy = 'كاشير المطعم';
  orders[idx].acceptedTime = Date.now();
  setStoredData('orders', orders);

  const approvedOrder = orders[idx];

  loadCashierOrders();
  renderCashierStats();

  // تحديث حالة الطلب سحابياً
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(orderId, { status: 'preparing', updated_at: new Date().toISOString() });
  }

  // طباعة بون المطبخ فقط على طابعة 101 (لا طباعة مزدوجة أبداً)
  if (typeof printCashierKitchenOnly === 'function') {
    printCashierKitchenOnly(approvedOrder);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(approvedOrder, 'kitchen');
  }

  if (typeof showCashierToast === 'function') {
    showCashierToast(`تمت الموافقة على الطلب #${approvedOrder.id} وإرسال البون للمطبخ (101) 👨‍🍳✅`);
  }
}
window.acceptMenuOrderToKitchen = acceptMenuOrderToKitchen;

function acceptAndPrintMenuOrder(orderId) {
  acceptMenuOrderToKitchen(orderId);
}
window.acceptAndPrintMenuOrder = acceptAndPrintMenuOrder;

function rejectMenuOrder(orderId) {
  if (confirm("هل أنت متأكد من إلغاء هذا الطلب؟")) {
    let orders = getStoredData('orders', []);
    const rIdx = orders.findIndex(o => o.id === orderId);
    if (rIdx !== -1) {
      orders[rIdx].status = 'cancelled';
      setStoredData('orders', orders);
    }
    window.dispatchEvent(new Event('storage'));

    // تحويل الطلب لملغي سحابياً لحفظ السجل
    if (typeof updateOrderInSupabase === 'function') {
      updateOrderInSupabase(orderId, { status: 'cancelled', updated_at: new Date().toISOString() });
    }

    loadCashierOrders();
    renderCashierStats();
    alert(`تم إلغاء الطلب #${orderId} وحفظه في السجل بنجاح! ❌`);
  }
}

function deleteApprovedCashierOrder(orderId) {
  if (!confirm(`هل أنت متأكد من إلغاء الطلب #${orderId}؟`)) return;

  let orders = getStoredData('orders', []);
  const aIdx = orders.findIndex(o => o.id === orderId);
  if (aIdx !== -1) {
    orders[aIdx].status = 'cancelled';
    setStoredData('orders', orders);
  }
  window.dispatchEvent(new Event('storage'));

  // تحويل الطلب لملغي سحابياً لحفظ السجل
  if (typeof updateOrderInSupabase === 'function') {
    updateOrderInSupabase(orderId, { status: 'cancelled', updated_at: new Date().toISOString() });
  }

  loadCashierOrders();
  renderCashierStats();
  renderCashierTablesGrid();
  alert(`تم إلغاء الطلب #${orderId} وتفريغ الطاولة مع حفظه في السجل بنجاح!`);
}

async function completeCashierOrder(orderId) {
  let orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;

  // التحقق من الأصناف التي تباع بالوزن لدفع الحساب (مثل السمك): فتح نافذة إدخال الوزن إن لم يُدخل بعد
  const unweighedIdx = orders[idx].items.findIndex(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || i.weight <= 0));
  if (unweighedIdx !== -1) {
    openWeightModalForOrder(orderId, unweighedIdx, () => {
      completeCashierOrder(orderId);
    });
    return;
  }

  // تسجيل الطلب ضمن الطلبات المحاسبة حديثاً لمنع أي ارتداد شبكي أثناء المزامنة
  window._recentlyCompletedOrders = window._recentlyCompletedOrders || new Map();
  window._recentlyCompletedOrders.set(String(orderId), Date.now());

  orders[idx].status = 'completed';
  orders[idx].completedAt = Date.now();
  orders[idx].paidAt = Date.now();
  setStoredData('orders', orders);

  // إرسال معلومات الفاتورة فوراً إلى الحسابات (مع تعديل القيمة السابقة إذا كان معدلاً لمنع التكرار)
  let archive = getStoredData('accounting_archive', []);
  const archIdx = archive.findIndex(a => a && String(a.id) === String(orderId));
  if (archIdx !== -1) {
    archive[archIdx] = JSON.parse(JSON.stringify(orders[idx]));
  } else {
    archive.unshift(JSON.parse(JSON.stringify(orders[idx])));
  }
  setStoredData('accounting_archive', archive);

  loadCashierOrders();
  renderCashierStats();
  renderCashierTablesGrid();
  if (typeof loadCashierAccounting === 'function') {
    loadCashierAccounting();
  }

  // إرسال إشعار storage لتحديث جميع الشاشات فوراً
  window.dispatchEvent(new Event('storage'));

  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: orderId 
      });
    }
  } catch(e) {}

  // تحديث حالة وتفاصيل الطلب سحابياً في الحسابات
  if (typeof updateOrderInSupabase === 'function') {
    await updateOrderInSupabase(orderId, {
      status: 'completed',
      total: orders[idx].total,
      subtotal: orders[idx].subtotal || orders[idx].total,
      deliveryFee: orders[idx].deliveryFee || 0,
      items: orders[idx].items,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // إشعار لطيف فوري بدون تجميد الشاشة
  if (typeof showCashierToast === 'function') {
    showCashierToast(`تمت محاسبة الطلب #${orderId} وحفظه في الحسابات بنجاح ✅`);
  }
}

async function acceptAndPayMenuOrderDirectly(orderId) {
  let orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;

  // التحقق من الأصناف التي تباع بالوزن لدفع الحساب (مثل السمك): فتح نافذة إدخال الوزن إن لم يُدخل بعد
  const unweighedIdx = orders[idx].items.findIndex(i => (i.isWeighted || (typeof isDishWeighted === 'function' && isDishWeighted(i))) && (!i.weight || i.weight <= 0));
  if (unweighedIdx !== -1) {
    openWeightModalForOrder(orderId, unweighedIdx, () => {
      acceptAndPayMenuOrderDirectly(orderId);
    });
    return;
  }

  // تسجيل الطلب لمنع الارتداد اللحظي
  window._recentlyCompletedOrders = window._recentlyCompletedOrders || new Map();
  window._recentlyCompletedOrders.set(String(orderId), Date.now());

  orders[idx].status = 'completed';
  orders[idx].acceptedBy = 'كاشير المطعم';
  orders[idx].acceptedTime = Date.now();
  orders[idx].completedAt = Date.now();
  orders[idx].paidAt = Date.now();
  setStoredData('orders', orders);

  // إرسال معلومات الفاتورة فوراً إلى الحسابات
  let archive = getStoredData('accounting_archive', []);
  const archIdx = archive.findIndex(a => a && String(a.id) === String(orderId));
  if (archIdx !== -1) {
    archive[archIdx] = JSON.parse(JSON.stringify(orders[idx]));
  } else {
    archive.unshift(JSON.parse(JSON.stringify(orders[idx])));
  }
  setStoredData('accounting_archive', archive);

  const approvedOrder = orders[idx];

  loadCashierOrders();
  renderCashierStats();
  renderCashierTablesGrid();
  if (typeof loadCashierAccounting === 'function') {
    loadCashierAccounting();
  }

  window.dispatchEvent(new Event('storage'));
  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: orderId 
      });
    }
  } catch(e) {}

  // طباعة فاتورة الحساب للزبون فقط على طابعة 100 أو طابعة الكاشير المخصصة
  if (typeof printCashierBillOnly === 'function') {
    printCashierBillOnly(approvedOrder);
  } else if (typeof printOrderDirect === 'function') {
    printOrderDirect(approvedOrder, 'customer');
  }

  // تحديث حالة وتفاصيل الطلب سحابياً لحفظه في الحسابات
  if (typeof updateOrderInSupabase === 'function') {
    await updateOrderInSupabase(orderId, {
      status: 'completed',
      total: approvedOrder.total,
      subtotal: approvedOrder.subtotal || approvedOrder.total,
      deliveryFee: approvedOrder.deliveryFee || 0,
      items: approvedOrder.items,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // إشعار لطيف فوري بدون تجميد الشاشة
  if (typeof showCashierToast === 'function') {
    showCashierToast(`تمت الموافقة والمحاسبة على الطلب #${approvedOrder.id} وحفظه في الحسابات 🚀✅`);
  }
}

// -------------------------------------------------------------
// 6. باركود الطاولات وتنزيل الصور للكاشير
// -------------------------------------------------------------
async function loadCashierQRCards() {
  const config = await syncRestaurantConfigFromSupabase();
  const count = parseInt(config.tablesCount) || 20;
  const countInput = document.getElementById('cashier-qr-tables-count');
  if (countInput) countInput.value = count;
  if (typeof renderTableQRCardsContainer === 'function') {
    renderTableQRCardsContainer('cashier-qr-grid', count);
  }
}

function updateQRTablesCountFromCashier(newCount) {
  const count = parseInt(newCount) || 20;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  config.tablesCount = count;
  setStoredData('config', config);

  renderCashierTablesGrid();
  if (typeof renderTableQRCardsContainer === 'function') {
    renderTableQRCardsContainer('cashier-qr-grid', count);
  }
}

function populateCashierTables() {
  renderCashierTablesGrid();
}

// -------------------------------------------------------------
// التنقل بين تبويبات وأقسام الكاشير (Switch Cashier Tabs)
// -------------------------------------------------------------
function switchCashierTab(tabName) {
  if (tabName === 'accounting' || tabName === 'settings') tabName = 'pos';
  const sections = ['pos', 'orders', 'tables', 'menu', 'qr'];
  const targetSection = tabName;

  const labelMap = {
    pos: '🛒 أخذ الطلبات (POS)',
    orders: '🔔 الطلبات الجارية',
    tables: '🪑 طاولات الصالة',
    menu: '🍽️ إدارة المنيو والأسعار',
    qr: '📱 باركود الطاولات'
  };

  sections.forEach(s => {
    const sec = document.getElementById(`cashier-sec-${s}`);
    if (sec) {
      if (s === targetSection) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    }
  });

  // تحديث أزرار شريط التنقل العلوي والقائمة الجانبية
  ['pos', 'orders', 'tables', 'menu', 'qr'].forEach(b => {
    const navBtn = document.getElementById(`csh-nav-${b}`);
    if (navBtn) {
      if (b === tabName) {
        navBtn.className = "csh-nav-tab py-2 px-3 sm:px-4 rounded-xl text-xs font-black transition flex items-center gap-1.5 bg-rose-600 text-white shadow-lg shadow-rose-600/30 whitespace-nowrap active:scale-95";
      } else {
        navBtn.className = "csh-nav-tab py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white whitespace-nowrap active:scale-95";
      }
    }

    const sideBtn = document.getElementById(`cashier-side-btn-${b}`);
    if (sideBtn) {
      if (b === tabName) {
        sideBtn.className = "w-full text-right py-2.5 px-3 bg-rose-600/20 text-rose-400 border border-rose-500/40 rounded-xl text-xs font-black transition flex items-center justify-between";
      } else {
        sideBtn.className = "w-full text-right py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-between";
      }
    }
  });

  const labelEl = document.getElementById('cashier-active-tab-label');
  if (labelEl && labelMap[tabName]) {
    labelEl.textContent = labelMap[tabName];
  }

  // تهيئة خاصة بكل تبويب عند فتحه
  if (targetSection === 'pos') {
    renderCashierPOSCategories();
    renderCashierPOSDishes();
    updateCashierCartUI();
    renderCashierTablesGrid();
  } else if (targetSection === 'orders') {
    loadCashierOrders();
  } else if (targetSection === 'tables') {
    renderCashierTablesGrid();
  } else if (targetSection === 'menu') {
    renderCashierDishes();
    renderCashierCategories();
  } else if (targetSection === 'qr') {
    loadCashierQRCards();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// 7. قسم المحاسبة وتقارير نهاية اليوم للكاشير (Cashier Accounting)
// -------------------------------------------------------------
let currentCashierAccountingPreset = 'today';
let currentCashierAccountingCustomDate = null;

function filterCashierAccounting(preset) {
  currentCashierAccountingPreset = preset;
  currentCashierAccountingCustomDate = null;

  document.querySelectorAll('.csh-acc-filter-btn').forEach(btn => {
    btn.className = 'csh-acc-filter-btn px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 hover:text-white transition flex items-center gap-1';
  });

  const activeBtn = document.getElementById(`csh-acc-btn-${preset}`);
  if (activeBtn) {
    activeBtn.className = 'csh-acc-filter-btn px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white transition flex items-center gap-1';
  }

  const customInput = document.getElementById('cashier-accounting-custom-date');
  if (customInput) customInput.value = '';

  loadCashierAccounting();
}

function filterCashierAccountingByCustomDate(dateVal) {
  if (!dateVal) return;
  currentCashierAccountingCustomDate = dateVal;
  currentCashierAccountingPreset = 'custom';

  document.querySelectorAll('.csh-acc-filter-btn').forEach(btn => {
    btn.className = 'csh-acc-filter-btn px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 hover:text-white transition flex items-center gap-1';
  });

  const customInput = document.getElementById('cashier-accounting-custom-date');
  if (customInput) customInput.value = dateVal;

  loadCashierAccounting();
}

function navigateCashierAccountingDay(offset) {
  let baseDate = new Date();
  if (currentCashierAccountingCustomDate) {
    baseDate = new Date(currentCashierAccountingCustomDate);
  } else if (currentCashierAccountingPreset === 'yesterday') {
    baseDate.setDate(baseDate.getDate() - 1);
  }

  baseDate.setDate(baseDate.getDate() + offset);
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(baseDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  filterCashierAccountingByCustomDate(formattedDate);
}

function loadCashierAccounting() {
  const report = getAccountingReport(currentCashierAccountingPreset, currentCashierAccountingCustomDate);

  // تحديث شارة الفترة المعروضة
  const labelEl = document.getElementById('csh-acc-active-period-label');
  if (labelEl) {
    if (currentCashierAccountingPreset === 'today') {
      labelEl.textContent = `اليوم الحالي (${new Date().toLocaleDateString('ar-EG')})`;
    } else if (currentCashierAccountingPreset === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      labelEl.textContent = `يوم أمس (${yDate.toLocaleDateString('ar-EG')})`;
    } else if (currentCashierAccountingPreset === 'week') {
      labelEl.textContent = `آخر 7 أيام`;
    } else if (currentCashierAccountingPreset === 'all') {
      labelEl.textContent = `كامل السجل المحاسبي`;
    } else if (currentCashierAccountingCustomDate) {
      const cDate = new Date(currentCashierAccountingCustomDate);
      labelEl.textContent = `تاريخ مخصص: ${cDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  }

  // 1. تحديث المؤشرات الإحصائية
  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('csh-acc-stat-total-revenue', `${report.totalRevenue.toLocaleString()} ${report.currency}`);
  setElText('csh-acc-stat-total-orders', report.totalOrders);
  setElText('csh-acc-stat-dinein-sales', `${report.dineInSales.toLocaleString()} ${report.currency}`);
  setElText('csh-acc-stat-dinein-count', `${report.dineInCount} طلب صالة`);
  setElText('csh-acc-stat-takeaway-sales', `${(report.takeawaySales + report.deliverySales).toLocaleString()} ${report.currency}`);
  setElText('csh-acc-stat-takeaway-count', `${report.takeawayCount + report.deliveryCount} طلب سفري وتوصيل`);

  // 2. الأصناف الأكثر مبيعاً
  const topDishesTable = document.getElementById('csh-acc-top-dishes-table-body');
  const topDishesCount = document.getElementById('csh-acc-top-dishes-count');
  if (topDishesCount) topDishesCount.textContent = `${report.topDishes.length} صنف`;

  if (topDishesTable) {
    if (report.topDishes.length === 0) {
      topDishesTable.innerHTML = `
        <tr>
          <td colspan="3" class="text-center py-8 text-slate-500 text-xs">لا توجد مبيعات مسجلة لهذه الفترة</td>
        </tr>
      `;
    } else {
      topDishesTable.innerHTML = report.topDishes.map((dish, i) => `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition">
          <td class="p-2.5">
            <div class="font-bold text-white text-xs">${i + 1}. ${dish.name}</div>
            <div class="text-[10px] text-slate-400">سعر الصنف: ${dish.price.toLocaleString()} ${report.currency}</div>
          </td>
          <td class="p-2.5 text-center font-black text-amber-400 text-xs">
            ${dish.quantity}
          </td>
          <td class="p-2.5 text-left font-black text-emerald-400 text-xs">
            ${dish.totalRevenue.toLocaleString()} ${report.currency}
          </td>
        </tr>
      `).join('');
    }
  }

  // 3. سجل فواتير اليوم
  const invoicesTable = document.getElementById('csh-acc-invoices-table-body');
  const invoicesCount = document.getElementById('csh-acc-invoices-count');
  if (invoicesCount) invoicesCount.textContent = `${report.orders.length} فاتورة`;

  if (invoicesTable) {
    if (report.orders.length === 0) {
      invoicesTable.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-8 text-slate-500 text-xs">لا توجد طلبات مسجلة لهذه الفترة</td>
        </tr>
      `;
    } else {
      invoicesTable.innerHTML = report.orders.map(order => {
        const isDineIn = order.type === 'dine-in' || order.type === 'dinein' || order.tableNumber;
        const typeBadge = isDineIn
          ? `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold">🍽️ طاولة ${order.tableNumber || '-'}</span>`
          : `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-bold">🛵 سفري/توصيل</span>`;

        return `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition">
            <td class="p-2.5">
              <div class="font-bold text-white text-xs">${order.id || 'ORD-000'}</div>
            </td>
            <td class="p-2.5">
              ${typeBadge}
            </td>
            <td class="p-2.5 font-black text-rose-400 text-xs">
              ${(order.total || 0).toLocaleString()} ${report.currency}
            </td>
            <td class="p-2.5 text-left">
              <button onclick="reprintCashierOrder('${order.id}')" class="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                <span>🖨️</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function printCashierEndOfDayReport() {
  printEndOfDayReportDirect(currentCashierAccountingPreset, currentCashierAccountingCustomDate);
}

function exportCashierReportCSV() {
  exportAccountingReportCSV(currentCashierAccountingPreset, currentCashierAccountingCustomDate);
}

function reprintCashierOrder(orderId) {
  const orders = getStoredData('orders', []);
  const order = orders.find(o => o.id === orderId);
  if (order) {
    if (typeof printOrderDirect === 'function') {
      printOrderDirect(order);
    } else {
      window.print();
    }
  }
}

// -------------------------------------------------------------
// 8. التحكم بأوقات وساعات العمل، العطل، وشبكة الواي فاي
// -------------------------------------------------------------
function openCashierWorkHoursModal() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  
  const statusInput = document.getElementById('cashier-setting-store-status');
  const hoursInput = document.getElementById('cashier-setting-hours');
  const openTimeInput = document.getElementById('cashier-setting-open-time');
  const closeTimeInput = document.getElementById('cashier-setting-close-time');
  const allowPreorderInput = document.getElementById('cashier-setting-allow-preorder');
  const holidaysInput = document.getElementById('cashier-setting-holidays');
  const wifiNameInput = document.getElementById('cashier-setting-wifi-name');
  const wifiPassInput = document.getElementById('cashier-setting-wifi-pass');

  if (statusInput) statusInput.value = config.storeManualStatus || "auto";
  if (hoursInput) hoursInput.value = config.workingHours || "12:00 ظهراً - 02:00 بعد منتصف الليل";
  if (openTimeInput) openTimeInput.value = config.openTime || "";
  if (closeTimeInput) closeTimeInput.value = config.closeTime || "";
  if (allowPreorderInput) allowPreorderInput.checked = (config.allowPreorderNextDay !== false);
  if (holidaysInput) holidaysInput.value = config.holidays || "مفتوح طوال أيام الأسبوع";
  if (wifiNameInput) wifiNameInput.value = config.wifiName || "Fahma_Dokhan_WiFi";
  if (wifiPassInput) wifiPassInput.value = config.wifiPass || "fahma2026";

  const modal = document.getElementById('cashier-work-hours-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeCashierWorkHoursModal() {
  const modal = document.getElementById('cashier-work-hours-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveCashierWorkHours(e) {
  if (e) e.preventDefault();
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const statusVal = document.getElementById('cashier-setting-store-status')?.value;
  if (statusVal) config.storeManualStatus = statusVal;

  config.workingHours = document.getElementById('cashier-setting-hours')?.value?.trim() || config.workingHours;
  config.openTime = document.getElementById('cashier-setting-open-time')?.value || config.openTime || "";
  config.closeTime = document.getElementById('cashier-setting-close-time')?.value || config.closeTime || "";
  
  const allowPre = document.getElementById('cashier-setting-allow-preorder');
  if (allowPre) config.allowPreorderNextDay = allowPre.checked;

  config.holidays = document.getElementById('cashier-setting-holidays')?.value?.trim() || config.holidays;
  config.wifiName = document.getElementById('cashier-setting-wifi-name')?.value?.trim() || config.wifiName;
  config.wifiPass = document.getElementById('cashier-setting-wifi-pass')?.value?.trim() || config.wifiPass;

  setStoredData('config', config);
  updateAppBranding();
  window.dispatchEvent(new Event('storage'));

  // المزامنة مع سحابة Supabase إن توفرت
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  if (client) {
    try {
      await client.from('restaurants').update({
        working_hours: config.workingHours,
        holidays: config.holidays,
        wifi_name: config.wifiName,
        wifi_pass: config.wifiPass,
        updated_at: new Date().toISOString()
      }).eq('id', restId);
    } catch (err) {
      console.warn("Supabase hours update:", err);
    }
  }

  closeCashierWorkHoursModal();
  alert("تم حفظ ونشر أوقات العمل وحالة المتجر على المنيو بنجاح! ✅");
}

// -------------------------------------------------------------
// 9. إدارة وتحميل وحفظ الإعدادات المركزية والطابعة في شاشة الكاشير
// -------------------------------------------------------------
function loadCashierCentralSettings() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const printSettings = typeof getPrintSettings === 'function' ? getPrintSettings() : { paperSize: '80mm', ticketType: 'dual', autoDirectPrint: true };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('cashier-cset-store-status', config.storeManualStatus || "auto");
  setVal('cashier-cset-hours', config.workingHours || "12:00 ظهراً - 02:00 بعد منتصف الليل");
  setVal('cashier-cset-open-time', config.openTime || "");
  setVal('cashier-cset-close-time', config.closeTime || "");
  
  const allowPre = document.getElementById('cashier-cset-allow-preorder');
  if (allowPre) allowPre.checked = (config.allowPreorderNextDay !== false);

  setVal('cashier-cset-holidays', config.holidays || "مفتوح طوال أيام الأسبوع");
  setVal('cashier-cset-address', config.address || "العراق - نرحب بكم في صالتنا");
  setVal('cashier-cset-wifi-name', config.wifiName || "Fahma_Dokhan_WiFi");
  setVal('cashier-cset-wifi-pass', config.wifiPass || "fahma2026");

  setVal('cashier-cset-printer-paper', printSettings.paperSize || "80mm");
  setVal('cashier-cset-ticket-type', printSettings.ticketType || "dual");
  
  const autoPrintEl = document.getElementById('cashier-cset-autoprint');
  if (autoPrintEl) autoPrintEl.checked = (printSettings.autoDirectPrint !== false);

  updateAppBranding();
}

async function saveCashierCentralSettings(e) {
  if (e) e.preventDefault();
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const getVal = (id) => document.getElementById(id)?.value?.trim();

  const statusVal = document.getElementById('cashier-cset-store-status')?.value;
  if (statusVal) config.storeManualStatus = statusVal;

  config.workingHours = getVal('cashier-cset-hours') || config.workingHours;
  config.openTime = document.getElementById('cashier-cset-open-time')?.value || config.openTime || "";
  config.closeTime = document.getElementById('cashier-cset-close-time')?.value || config.closeTime || "";
  
  const allowPre = document.getElementById('cashier-cset-allow-preorder');
  if (allowPre) config.allowPreorderNextDay = allowPre.checked;

  config.holidays = getVal('cashier-cset-holidays') || config.holidays;
  config.address = getVal('cashier-cset-address') || config.address;
  config.wifiName = getVal('cashier-cset-wifi-name') || config.wifiName;
  config.wifiPass = getVal('cashier-cset-wifi-pass') || config.wifiPass;

  setStoredData('config', config);
  updateAppBranding();

  // حفظ إعدادات الطابعة الحرارية
  const paperSize = document.getElementById('cashier-cset-printer-paper')?.value || '80mm';
  const ticketType = document.getElementById('cashier-cset-ticket-type')?.value || 'dual';
  const autoDirectPrint = document.getElementById('cashier-cset-autoprint')?.checked ?? true;

  if (typeof savePrintSettings === 'function') {
    savePrintSettings({ paperSize, ticketType, autoDirectPrint });
  }

  // إرسال إشعار storage لتحديث جميع الصفحات المفتوحة فوراً
  window.dispatchEvent(new Event('storage'));

  // المزامنة مع سحابة Supabase
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  if (client) {
    try {
      await client.from('restaurants').update({
        working_hours: config.workingHours,
        holidays: config.holidays,
        wifi_name: config.wifiName,
        wifi_pass: config.wifiPass,
        address: config.address,
        printer_paper_size: paperSize,
        auto_print: autoDirectPrint,
        updated_at: new Date().toISOString()
      }).eq('id', restId);
    } catch (err) {
      console.warn("Supabase cashier settings sync error:", err);
    }
  }

  const msgEl = document.getElementById('cashier-settings-save-msg');
  if (msgEl) {
    msgEl.classList.remove('hidden');
    setTimeout(() => msgEl.classList.add('hidden'), 4000);
  }
}

// -------------------------------------------------------------
// مزامنة أطباق وأقسام المنيو لحظياً مع سحابة Supabase للكاشير
// -------------------------------------------------------------
async function syncMenuFromSupabase() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  if (!client) return;

  try {
    // 1. جلب الأقسام من السحابة
    const { data: catData, error: catErr } = await client
      .from('restaurant_categories')
      .select('*')
      .eq('restaurant_id', restId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (!catErr && catData && catData.length > 0) {
      const categories = [
        { id: "all", name: "الكل", nameEn: "All", icon: "🍽️" },
        ...catData.map(c => ({
          id: c.id,
          name: c.name,
          nameEn: c.name_en || '',
          icon: c.icon || '🍽️'
        }))
      ];
      setStoredData('categories', categories);
    }

    // 2. جلب الأطباق من السحابة
    const { data: dishData, error: dishErr } = await client
      .from('restaurant_dishes')
      .select('*')
      .eq('restaurant_id', restId)
      .order('created_at', { ascending: true });

    if (!dishErr && dishData && dishData.length > 0) {
      if (Date.now() - (window._lastDishSaveTime || 0) < 3500) {
        return; // منع الارتداد اللحظي أثناء حفظ وتحديث الصنف محلياً
      }

      const dishes = dishData.map(d => {
        const dishId = isNaN(d.id) ? d.id : Number(d.id);
        const resolvedOldPrice = (d.old_price !== undefined && d.old_price !== null && Number(d.old_price) > 0) ? Number(d.old_price) : null;
        const isWeighted = d.is_weighted === true || d.pricing_type === 'per_kg';
        return {
          id: dishId,
          name: d.name,
          nameEn: d.name_en || '',
          categoryId: d.category_id,
          price: Number(d.price) || 0,
          pricingType: d.pricing_type || (isWeighted ? 'per_kg' : 'fixed'),
          isWeighted: isWeighted,
          unitPrice: d.unit_price || d.price_per_kg || Number(d.price) || 0,
          pricePerKg: d.price_per_kg || Number(d.price) || 0,
          oldPrice: resolvedOldPrice,
          ingredients: d.ingredients || d.description || '',
          description: d.description || d.ingredients || '',
          calories: d.calories ? `${d.calories} سعرة` : '',
          prepTime: d.prep_time || 15,
          available: d.is_available !== false,
          isPopular: !!d.is_featured,
          isNew: d.badge === 'جديد',
          image: d.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600'
        };
      }).filter(d => d && d.id && d.id !== 'undefined');

      setStoredData('dishes', dishes);

      // إعادة رسم المنيو في الشاشة فوراً بعد تحديث الكاش
      if (typeof renderCashierCategories === 'function') renderCashierCategories();
      if (typeof renderCashierDishes === 'function') renderCashierDishes();
      if (typeof renderCashierPOSCategories === 'function') renderCashierPOSCategories();
      if (typeof renderCashierPOSDishes === 'function') renderCashierPOSDishes();
    } else {
      // لا توجد أطباق في السحابة — أعِد رسم الواجهة لإظهار الحالة الفارغة بوضوح
      if (typeof renderCashierPOSCategories === 'function') renderCashierPOSCategories();
      if (typeof renderCashierCategories === 'function') renderCashierCategories();
      if (typeof renderCashierDishes === 'function') renderCashierDishes();
      const posGrid = document.getElementById('cashier-pos-dishes-grid');
      if (posGrid) {
        posGrid.innerHTML = `<div class="col-span-full py-12 text-center space-y-3">
          <div class="text-4xl">🍽️</div>
          <div class="text-sm font-black text-slate-300">لا توجد أطباق مضافة لهذا المطعم بعد</div>
          <div class="text-xs text-slate-500">أضف الأطباق من لوحة الإدارة أو من قسم "إدارة المنيو" أعلاه</div>
        </div>`;
      }
    }
  } catch (err) {
    console.warn("Supabase cashier menu sync error:", err);
  }

  // اشتراك Realtime لحظي للكاشير
  if (client && !window._cashierMenuRealtimeSubscribed) {
    window._cashierMenuRealtimeSubscribed = true;
    try {
      let debounceTimer = null;
      const triggerRealtimeSync = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          syncMenuFromSupabase();
        }, 500);
      };

      client.channel(`public:cashier_menu_realtime_${restId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_dishes', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_categories', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .subscribe();
    } catch (e) {
      console.warn("Cashier menu realtime error:", e);
    }
  }
}

async function updateDishAvailabilityInSupabase(dishId, isAvailable) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  if (!client || !dishId || dishId === 'undefined') return;

  window._lastDishSaveTime = Date.now();
  try {
    const { error } = await client
      .from('restaurant_dishes')
      .update({ 
        is_available: !!isAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('id', String(dishId))
      .eq('restaurant_id', restId);

    if (error) {
      console.warn("Supabase cashier dish availability update error:", error);
    }
  } catch (e) {
    console.warn("Supabase cashier dish availability update error:", e);
  }
}

async function saveDishToSupabase(dish) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client || !dish || !dish.id || dish.id === 'undefined') return;

  window._lastDishSaveTime = Date.now();
  try {
    let cal = 0;
    if (dish.calories) {
      const m = String(dish.calories).match(/\d+/);
      if (m) cal = parseInt(m[0], 10);
    }
    const resolvedCatId = dish.categoryId || dish.category_id || (typeof DEFAULT_CATEGORIES !== 'undefined' && DEFAULT_CATEGORIES[1] ? DEFAULT_CATEGORIES[1].id : null);
    const payload = {
      id: String(dish.id),
      restaurant_id: restId,
      category_id: resolvedCatId,
      name: dish.name,
      name_en: dish.nameEn || '',
      price: Number(dish.price) || 0,
      pricing_type: dish.pricingType || (dish.isWeighted ? 'per_kg' : 'fixed'),
      is_weighted: !!dish.isWeighted,
      price_per_kg: dish.isWeighted ? (Number(dish.pricePerKg) || Number(dish.price) || 0) : null,
      old_price: (dish.oldPrice && Number(dish.oldPrice) > 0) ? Number(dish.oldPrice) : null,
      description: dish.description || dish.ingredients || '',
      ingredients: dish.ingredients || '',
      image: dish.image || '',
      calories: cal,
      prep_time: dish.prepTime || 15,
      is_available: dish.available !== false,
      is_featured: !!dish.isPopular,
      badge: dish.isNew ? 'جديد' : (dish.isPopular ? 'مميز' : ''),
      updated_at: new Date().toISOString()
    };

    let { error } = await client.from('restaurant_dishes').upsert(payload, { onConflict: 'id' });
    if (error && error.message && (error.message.includes('old_price') || error.message.includes('pricing_type') || error.message.includes('is_weighted'))) {
      delete payload.pricing_type;
      delete payload.is_weighted;
      delete payload.price_per_kg;
      delete payload.old_price;
      const res = await client.from('restaurant_dishes').upsert(payload, { onConflict: 'id' });
      error = res.error;
    }
    if (error) {
      console.warn("Supabase cashier dish save error:", error);
    }
  } catch (e) {
    console.warn("Supabase cashier dish save error:", e);
  }
}

async function deleteDishFromSupabase(dishId) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client || !dishId || dishId === 'undefined') return;

  try {
    await client.from('restaurant_dishes').delete().eq('id', String(dishId)).eq('restaurant_id', restId);
  } catch (e) {
    console.warn("Supabase cashier dish delete error:", e);
  }
}

/* =========================================================
 * دوال سلة الكاشير الجانبية وتنبيه نداء الويتر
 * ========================================================= */
function toggleCashierCartDrawer() {
  const drawer = document.getElementById('cashier-cart-drawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
      syncCashierDrawerCart();
    }
  }
}

function syncCashierDrawerCart() {
  const drawerItems = document.getElementById('cashier-drawer-cart-items');
  const drawerEmpty = document.getElementById('cashier-drawer-cart-empty');
  const drawerTotal = document.getElementById('cashier-drawer-total');
  const drawerNotes = document.getElementById('cashier-drawer-notes');
  const drawerType = document.getElementById('cashier-drawer-order-type');

  const mainItems = document.getElementById('cashier-pos-cart-items');
  const mainEmpty = document.getElementById('cashier-pos-cart-empty');
  const mainTotal = document.getElementById('cashier-pos-total');
  const mainNotes = document.getElementById('cashier-pos-notes');

  if (drawerItems && mainItems) {
    drawerItems.innerHTML = mainItems.innerHTML;
  }
  if (drawerEmpty && mainEmpty) {
    if (mainEmpty.classList.contains('hidden')) {
      drawerEmpty.classList.add('hidden');
    } else {
      drawerEmpty.classList.remove('hidden');
    }
  }
  if (drawerTotal && mainTotal) {
    drawerTotal.textContent = mainTotal.textContent;
  }
  if (drawerNotes && mainNotes && document.activeElement !== drawerNotes) {
    drawerNotes.value = mainNotes.value || '';
  }

  if (drawerType) {
    const isDineIn = document.getElementById('btn-type-dine-in')?.classList.contains('ring-1') || false;
    const isTakeaway = document.getElementById('btn-type-takeaway')?.classList.contains('ring-1') || false;
    const isDelivery = document.getElementById('btn-type-delivery')?.classList.contains('ring-1') || false;
    if (isDineIn) drawerType.textContent = 'طلب صالة / محلي';
    else if (isTakeaway) drawerType.textContent = 'طلب سفري / استلام';
    else if (isDelivery) drawerType.textContent = 'طلب توصيل / دليفري';
  }
}

function syncCashierNotes(val) {
  const mainNotes = document.getElementById('cashier-pos-notes');
  if (mainNotes) {
    mainNotes.value = val;
  }
}

function dismissCashierCallAlert() {
  const el = document.getElementById('cashier-call-waiter-banner');
  if (el) el.classList.add('hidden');
}

window.toggleCashierCartDrawer = toggleCashierCartDrawer;
window.syncCashierDrawerCart = syncCashierDrawerCart;
window.syncCashierNotes = syncCashierNotes;
window.dismissCashierCallAlert = dismissCashierCallAlert;


