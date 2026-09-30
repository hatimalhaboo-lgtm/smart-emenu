
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
      const clean = sRest.trim().toLowerCase();
      if (clean === 'banan' || clean === 'banan_platform') {
        sessionStorage.setItem('smart_emenu_restaurant_id', 'fahma_dokhan');
        return 'fahma_dokhan';
      }
      return clean;
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
// تحديث نصوص وهوية المطعم في لوحة تحكم الإدارة
// -------------------------------------------------------------
function updateAppBranding() {
  const config = typeof getStoredData === 'function' ? getStoredData('config', DEFAULT_RESTAURANT_CONFIG) : DEFAULT_RESTAURANT_CONFIG;
  document.querySelectorAll('.brand-restaurant-name').forEach(el => el.textContent = config.name);
  document.querySelectorAll('.brand-restaurant-tagline').forEach(el => el.textContent = config.tagline);
  document.querySelectorAll('.brand-currency').forEach(el => el.textContent = config.currency);

  const adminName = document.getElementById('admin-restaurant-name');
  if (adminName) adminName.textContent = config.name;

  // تحديث شارة حالة المحل الحالية في الإدارة
  const storeStatus = checkRestaurantOpenStatus(config);
  const statusBadge = document.getElementById('admin-store-current-status-badge');
  if (statusBadge) {
    if (storeStatus.isOpen) {
      statusBadge.textContent = "مفتوح الآن 🟢";
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else {
      statusBadge.textContent = "مغلق حالياً (حجوزات الغد فقط) 🌙";
      statusBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30";
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

function ensureAdminRestaurantSubscription(client) {
  if (!client || window._adminRestaurantRealtimeSubscribed) return;
  window._adminRestaurantRealtimeSubscribed = true;
  try {
    client.channel('public:restaurants_admin_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
        checkRestaurantSubscription();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_info' }, () => {
        checkRestaurantSubscription();
      })
      .subscribe();
  } catch(e) {
    console.warn("Admin realtime subscription error:", e);
  }

  window.addEventListener('focus', () => {
    checkRestaurantSubscription();
  });

  setInterval(() => {
    checkRestaurantSubscription();
  }, 4000);
}

// -------------------------------------------------------------
// فحص حالة اشتراك المطعم في Supabase وقفل الموقع عند الإلغاء
// -------------------------------------------------------------
async function checkRestaurantSubscription() {
  const client = getSupabase();
  if (!client) return { active: true };

  ensureAdminRestaurantSubscription(client);

  const restId = getActiveRestaurantId();

  try {
    const { data, error } = await client
      .from('restaurants')
      .select('*')
      .eq('id', restId)
      .limit(1);

    if (!error && data && data.length > 0) {
      const rest = data[0];

      // فحص حالة التفعيل وتاريخ انتهاء باقة الاشتراك تلقائياً
      const isDateExpired = rest.subscription_end_date && (new Date(rest.subscription_end_date).getTime() < Date.now());
      if (rest.is_active === false || isDateExpired) {
        showSubscriptionLockScreen(rest);
        return { active: false, restaurant: rest };
      } else {
        hideSubscriptionLockScreen();

        // مزامنة حالة الباقات ونوع الخطة وكافة بيانات المطعم في التخزين المحلي فوراً
        const localConfig = typeof getStoredData === 'function' ? getStoredData('config', {}) : {};
        if (typeof setStoredData === 'function' && localConfig) {
          const plan = rest.subscription_plan || rest.plan_type || 'pro';
          localConfig.planType = plan;
          localConfig.subscriptionPlan = plan;
          if (plan === 'basic') {
            localConfig.allowDineInOrders = false;
            localConfig.allowTakeawayOrders = false;
            localConfig.takeawayPackageActive = false;
          } else {
            localConfig.allowDineInOrders = !!rest.allow_dinein_orders;
            localConfig.allowTakeawayOrders = rest.allow_takeaway_orders !== false;
            localConfig.takeawayPackageActive = rest.takeaway_package_active !== false;
          }

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
          if (rest.storage_quota_mb) localConfig.storage_quota_mb = Number(rest.storage_quota_mb);
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
    }
  } catch (e) {
    console.warn("Subscription check offline:", e);
  }

  return { active: true };
}

// -------------------------------------------------------------
// شاشة القفل وتجديد الاشتراك والتواصل مع الدعم 07702265652
// -------------------------------------------------------------
function showSubscriptionLockScreen(rest) {
  let overlay = document.getElementById('subscription-locked-overlay');
  const supportPhone = rest?.support_phone || '07702265652';

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'subscription-locked-overlay';
    overlay.className = 'fixed inset-0 z-[999999] bg-[#0b1120] flex items-center justify-center p-4 text-center overflow-y-auto';
    overlay.innerHTML = `
      <div class="max-w-md w-full bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-auto">
        
        <!-- لوجو مكتب emattec -->
        <div class="w-24 h-24 rounded-3xl bg-white p-2 mx-auto shadow-2xl border-2 border-rose-500/30 flex items-center justify-center overflow-hidden">
          <img src="emattec-logo.jpg" alt="emattec" class="w-full h-full object-contain" onerror="this.src='logo.svg'" />
        </div>

        <div class="space-y-2">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-400 text-xs font-black rounded-full border border-rose-500/30">
            <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            <span>الاشتراك غير مفعّل / منتهي</span>
          </div>
          <h2 class="text-2xl font-black text-white">يرجى تجديد الاشتراك</h2>
          <p class="text-xs text-slate-300 leading-relaxed">
            عزيزي صاحب المطعم، لقد تم إيقاف الخدمة مؤقتاً لتجديد الاشتراك أو ترقية الباقات. يرجى التواصل مع مكتب <b>emattec</b> لإعادة التفعيل الفوري.
          </p>
        </div>

        <!-- بطاقة رقم الدعم والتجديد -->
        <div class="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
          <div class="text-xs text-slate-400 font-bold">رقم الدعم الفني وتجديد الباقات:</div>
          <div class="text-2xl font-black text-rose-400 font-mono tracking-wider">${supportPhone}</div>
          <div class="text-[11px] text-slate-500">مكتب emattec للحلول البرمجية والأنظمة الذكية</div>
        </div>

        <!-- أزرار التواصل والتجديد -->
        <div class="space-y-2 pt-1">
          <a href="tel:${supportPhone}" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-95">
            <span>📞 اتصال فوري لتجديد الاشتراك</span>
          </a>
          <a href="https://wa.me/964${supportPhone.replace(/^0+/, '')}" target="_blank" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition">
            <span>💬 تواصل عبر WhatsApp للتفعيل</span>
          </a>
        </div>

        <div class="text-[11px] text-slate-500 pt-3 border-t border-slate-800">
          تطوير وبرمجة <b>مكتب emattec</b> للأنظمة والحلول السحابية
        </div>

      </div>
    `;
    document.body.appendChild(overlay);
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

// تشغيل الفحص الدوري للاشتراك وتحديث الهوية في لوحة الأدمن
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
  phone: "07755009771",
  phone2: "07509009676",
  mapUrl: "https://maps.app.goo.gl/dr2x5U7NFiFKXJnQ9?g_st=com.google.maps.preview.copy",
  whatsappNumber: "07755009771",
  whatsappUrl: "https://wa.me/9647755009771",
  publishedUrl: "https://fahma-dokhan.netlify.app", 
  
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
  address: "العراق - نينوى - الشيماء",
  workingHours: "10:00 صباحاً - 10:00 بعد منتصف الليل",
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

const DEFAULT_DISHES = [{"id":101,"name":"نفر كباب لحم","nameEn":"Beef Kebab Plate (Full)","categoryId":"grills","price":8000,"ingredients":"لحم غنم عراقي مفروم طازج، لية، بصل، بقدونس، سماق، طماطم وفلفل مشوي، يقدم مع الخبز الحار وسرفيس الخضار.","calories":"680 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":102,"name":"نص نفر كباب لحم","nameEn":"Half Beef Kebab Plate","categoryId":"grills","price":5000,"ingredients":"نصف وجبة كباب لحم غنم مشوي على الفحم مع الطماطم المشوية والخبز الحار والسماق.","calories":"360 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":103,"name":"نفر تكة لحم","nameEn":"Beef Tikka Plate (Full)","categoryId":"grills","price":9000,"ingredients":"شقف لحم غنم هبرة طازجة، لية غنم، تتبيلة بهارات خاصة، بصل مشوي، طماطم، خبز حار.","calories":"620 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":104,"name":"نص نفر تكة لحم","nameEn":"Half Beef Tikka Plate","categoryId":"grills","price":5000,"ingredients":"قطع تكة لحم غنم متبلة ومشوية على الفحم مع الخبز الحار والخضار المشوية.","calories":"330 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":105,"name":"نفر معلاق","nameEn":"Liver (Malaq) Plate (Full)","categoryId":"grills","price":9000,"ingredients":"كبدة غنم طازجة مقطعة، شحم لية غنم، رشة سماق، ليمون، خبز حار صاج أو تنور.","calories":"530 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":106,"name":"نص نفر معلاق","nameEn":"Half Liver Plate","categoryId":"grills","price":5000,"ingredients":"نصف وجبة معلاق غنم طازج مشوي على جمر الفحم مع الليمون والخبز.","calories":"280 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":107,"name":"نفر تكة دجاج","nameEn":"Chicken Tikka Plate (Full)","categoryId":"grills","price":7000,"ingredients":"مكعبات صدور دجاج طرية، تتبيلة الزبادي والثوم والليمون والزعفران، صوص ثومية، خبز حار، طماطم مشوية.","calories":"510 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":108,"name":"نص نفر تكة دجاج","nameEn":"Half Chicken Tikka Plate","categoryId":"grills","price":4000,"ingredients":"نصف وجبة تكة دجاج مشوية على الفحم مع الثومية والخبز وسرفيس الخضار.","calories":"270 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":109,"name":"نفر كباب دجاج","nameEn":"Chicken Kebab Plate (Full)","categoryId":"grills","price":5000,"ingredients":"دجاج مفروم، بصل، كزبرة، بهارات مشاوي دجاج خاصة، طماطم مشوية، خبز حار، صوص ثوم.","calories":"470 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":110,"name":"نص نفر كباب دجاج","nameEn":"Half Chicken Kebab Plate","categoryId":"grills","price":3000,"ingredients":"نصف وجبة كباب دجاج مشوي على الفحم مع الخبز والصوص.","calories":"250 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":111,"name":"نفر مشكل","nameEn":"Mixed Grill Plate (Full)","categoryId":"grills","price":9000,"ingredients":"سيخ كباب لحم + سيخ تكة لحم + سيخ تكة دجاج + طماطم وبصل مشوي + خبز حار وسرفيس كامل.","calories":"740 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":112,"name":"نص نفر مشكل","nameEn":"Half Mixed Grill Plate","categoryId":"grills","price":5000,"ingredients":"تشكيلة من كباب اللحم وتكة الدجاج واللحم مع المرفقات والخبز.","calories":"390 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":113,"name":"عرايس على الفحم","nameEn":"Arayes Meat on Charcoal","categoryId":"grills","price":5000,"ingredients":"خبز محشو بلحم الغنم المفروم والمتبل بالبصل والبقدونس ودبس الرمان، محمص على جمر الفحم.","calories":"560 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":114,"name":"كيلو كباب لحم","nameEn":"1 KG Beef Kebab","categoryId":"grills","price":18000,"ingredients":"كيلو كامل كباب لحم غنم بلدي مشوي على الفحم، يقدم مع كمية وفيرة من الخبز الحار، البصل المشوي، الطماطم، والمخللات.","calories":"2200 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":115,"name":"كيلو كباب دجاج","nameEn":"1 KG Chicken Kebab","categoryId":"grills","price":10000,"ingredients":"كيلو كامل كباب دجاج متبل ومشوي على الفحم مع الخبز والصوصات وسرفيس الخضار.","calories":"1700 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":116,"name":"كيلو كباب مشكل","nameEn":"1 KG Mixed Kebab","categoryId":"grills","price":15000,"ingredients":"كيلو مشكل كباب لحم وكباب دجاج على الفحم مع الخبز والطرشي والطماطم المشوية.","calories":"1950 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":201,"name":"منسف دجاجة شواية","nameEn":"Whole Rotisserie Chicken Mansaf","categoryId":"chicken","price":15000,"ingredients":"دجاجة كاملة شواية محمرة، صينية تمن (أرز) زعفران ومبهر، مرق فاصوليا/بامية، حشو شعرية ومكسرات، ليمون وطرشي.","calories":"1650 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":202,"name":"منسف نص دجاجة شواية","nameEn":"Half Rotisserie Chicken Mansaf","categoryId":"chicken","price":10000,"ingredients":"نصف دجاجة شواية محمرة، صحن تمن مع الحشو، صحن مرق، سلطة وطرشي.","calories":"920 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":203,"name":"دجاجة شواية (بدون تمن)","nameEn":"Whole Rotisserie Chicken Only","categoryId":"chicken","price":9000,"ingredients":"دجاجة شواية كاملة متبلة ومحمرة على السيخ الدوار، تقدم مع الخبز، الطرشي، وصلصة الثومية.","calories":"1200 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":204,"name":"نص دجاجة شواية (بدون تمن)","nameEn":"Half Rotisserie Chicken Only","categoryId":"chicken","price":5000,"ingredients":"نصف دجاجة شواية محمرة مع الخبز الحار والمخللات والثومية.","calories":"600 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":205,"name":"منسف دجاجة على الفحم","nameEn":"Charcoal Grilled Chicken Mansaf","categoryId":"chicken","price":13000,"ingredients":"دجاجة كاملة مشوية على جمر الفحم بنكهة التدخين المميزة، تقدم على منسف تمن مبهر مع المرق والمخلل والخبز.","calories":"1550 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":206,"name":"منسف نص دجاجة على الفحم","nameEn":"Charcoal Half Chicken Mansaf","categoryId":"chicken","price":10000,"ingredients":"نصف دجاجة مشوية على الفحم، تمن مبهر، مرق، سلطة ومخلل.","calories":"880 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":207,"name":"دجاجة على الفحم (بدون تمن)","nameEn":"Whole Charcoal Grilled Chicken","categoryId":"chicken","price":8000,"ingredients":"دجاجة كاملة متبلة بالليمون والبهارات ومشوية على الفحم مع الخبز وصلصة الثوم والطرشي.","calories":"1150 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":208,"name":"نص دجاجة على الفحم (بدون تمن)","nameEn":"Half Charcoal Grilled Chicken","categoryId":"chicken","price":5000,"ingredients":"نصف دجاجة مشوية على الفحم مع الخبز والصلصة.","calories":"580 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":209,"name":"نفر أجنحة دجاج على تمن","nameEn":"Wings with Rice (Full Plate)","categoryId":"chicken","price":9000,"ingredients":"أجنحة دجاج متبلة ومشوية على الفحم، تقدم على وجبة تمن مع المرق وسرفيس الخضار.","calories":"820 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":210,"name":"نص نفر أجنحة دجاج على تمن","nameEn":"Half Wings with Rice Plate","categoryId":"chicken","price":5000,"ingredients":"نصف وجبة أجنحة دجاج مشوية على الفحم مع التمن والمرق.","calories":"460 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":211,"name":"نفر أجنحة دجاج مشوية","nameEn":"Grilled Wings Plate Only","categoryId":"chicken","price":7000,"ingredients":"أجنحة دجاج مقرمشة مشوية على الفحم مع الخبز والصلصات الحارة والعادية.","calories":"580 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":212,"name":"نص نفر أجنحة دجاج مشوية","nameEn":"Half Grilled Wings Plate Only","categoryId":"chicken","price":4000,"ingredients":"نصف وجبة أجنحة دجاج مشوية على الفحم مع الخبز.","calories":"310 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":301,"name":"بركر لحم عادي","nameEn":"Single Beef Burger","categoryId":"burgers","price":1500,"ingredients":"شريحة لحم مشوية، خس طازج، طماطم، مخلل خيار، صوص بركر خاص، خبز سمسم طري.","calories":"410 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":302,"name":"بركر لحم دبل","nameEn":"Double Beef Burger","categoryId":"burgers","price":2500,"ingredients":"شريحتين لحم بقري مشوي، خس، طماطم، مخلل، صوص الشيف المميز في خبز برجر كبير.","calories":"640 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":303,"name":"بركر لحم بالجبن عادي","nameEn":"Single Cheeseburger","categoryId":"burgers","price":1750,"ingredients":"شريحة لحم مشوية، شريحة جبنة شيدر أمريكية ذائبة، خس، طماطم، صوص بركر، خبز سمسم.","calories":"470 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":304,"name":"بركر لحم بالجبن دبل","nameEn":"Double Cheeseburger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم مشوي، طبقتين جبنة شيدر ذائبة، خس، مخلل، صوصات غنية، خبز محمص.","calories":"770 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":305,"name":"بركر اومليت عادي","nameEn":"Single Omelette Burger","categoryId":"burgers","price":2000,"ingredients":"شريحة لحم برجر، قرص بيض أومليت ذهبي مطهو بالزبدة، جبنة شيدر، خس، صوص المايونيز والكاتشب.","calories":"530 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":306,"name":"بركر اومليت دبل","nameEn":"Double Omelette Burger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم + قرص بيض أومليت + جبنة شيدر ذائبة + خضار وصوص.","calories":"810 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":307,"name":"بركر فطر عادي","nameEn":"Single Mushroom Burger","categoryId":"burgers","price":2000,"ingredients":"شريحة لحم مشوية، فطر (مشروم) طازج مشوح، صلصة الفطر الكريمية الغنية، جبنة، خس.","calories":"520 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":308,"name":"بركر فطر دبل","nameEn":"Double Mushroom Burger","categoryId":"burgers","price":3000,"ingredients":"شريحتين لحم مشوي مع كمية مضاعفة من صلصة المشروم الكريمية وحبات الفطر والجبنة.","calories":"780 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":401,"name":"زنجر عادي","nameEn":"Zinger Chicken Sandwich","categoryId":"western","price":1500,"ingredients":"قطعة صدر دجاج زنجر مقرمشة حارة، خس كابوتشا طازج، مايونيز، خبز صمون فرنسي طري.","calories":"470 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":402,"name":"زنجر بالجبن","nameEn":"Zinger with Cheese","categoryId":"western","price":1750,"ingredients":"صدر دجاج زنجر سبايسي حار، شريحة جبنة شيدر ذائبة، خس، صوص زنجر خاص.","calories":"530 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":403,"name":"زنجر هوني ماسترد","nameEn":"Zinger Honey Mustard","categoryId":"western","price":2000,"ingredients":"دجاج زنجر مقرمش، صلصة الهوني ماسترد (الخردل بالعسل الطبيعي)، جبنة، خس.","calories":"550 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":404,"name":"كريسبي عادي","nameEn":"Crispy Chicken Sandwich","categoryId":"western","price":1500,"ingredients":"صدر دجاج مقرمش ذهبي غير حار، خس، مايونيز، خبز صمون سمسم.","calories":"450 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":405,"name":"كريسبي بالجبن","nameEn":"Crispy with Cheese","categoryId":"western","price":1750,"ingredients":"دجاج كريسبي مقرمش غير حار مع شريحة جبنة شيدر وخس وصوص.","calories":"510 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":406,"name":"كريسبي هوني ماسترد","nameEn":"Crispy Honey Mustard","categoryId":"western","price":2000,"ingredients":"دجاج كريسبي مع صلصة الهوني ماسترد الغنية الحلوة والشهية وجبنة.","calories":"540 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":407,"name":"فاهيتا دجاج","nameEn":"Chicken Fajita Sandwich","categoryId":"western","price":1500,"ingredients":"شرائح صدور دجاج طرية، فلفل أخضر وأحمر وأصفر، بصل مكرمل، بهارات فاهيتا، صوص مايونيز بالثوم.","calories":"430 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":408,"name":"مكسيكانو دجاج حار","nameEn":"Spicy Mexicano Chicken","categoryId":"western","price":1500,"ingredients":"دجاج مطهو بصلصة المكسيكانو الحارة مع الفلفل الهالبينو، ذرة، بصل، صلصة طماطم حارة.","calories":"440 سعرة","isPopular":true,"isSpicy":true,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":409,"name":"تويستر","nameEn":"Chicken Twister Wrap","categoryId":"western","price":1500,"ingredients":"أصابع دجاج مقرمشة، خس طازج، طماطم، صوص فلفل أو مايونيز، ملفوفة في خبز تورتيلا محمص.","calories":"420 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":410,"name":"سكالوب دجاج","nameEn":"Chicken Escalope Sandwich","categoryId":"western","price":1500,"ingredients":"شريحة سكالوب دجاج بانيه مقلية ذهبية، خس، مخلل، مايونيز، كاتشب.","calories":"460 سعرة","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1608797178974-15b35a61ded7?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":411,"name":"جيكن ساب (تشيكن سب)","nameEn":"Chicken Sub Sandwich","categoryId":"western","price":2000,"ingredients":"ساندويتش صب كبير، دجاج متبل، جبنة موزاريلا وشيدر ذائبة، خضار مشكلة، صوصات غنية.","calories":"590 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":412,"name":"فنكر عادي (بطاطا مقلية)","nameEn":"Crispy French Fries","categoryId":"western","price":1000,"ingredients":"أصابع بطاطا مقلية ذهبية مقرمشة مع بهارات الفنكر وكاتشب.","calories":"320 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":413,"name":"فنكر بالجبن","nameEn":"Loaded Cheddar Cheese Fries","categoryId":"western","price":1500,"ingredients":"أصابع بطاطا مقلية ساخنة مغطاة بصلصة جبنة الشيدر الذائبة الكريمية.","calories":"490 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":501,"name":"ريزو عادي","nameEn":"Classic Chicken Rizo","categoryId":"rizo","price":4000,"ingredients":"أرز ريزو مبهر أصفر، قطع دجاج كرسبي مقرمشة مقطعة، صوص الريزو الخاص الحامض والحلو.","calories":"630 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":502,"name":"ريزو بالجبن","nameEn":"Cheese Chicken Rizo","categoryId":"rizo","price":4500,"ingredients":"أرز ريزو مبهر، قطع دجاج مقرمش، صوص جبنة شيدر غني وساخن، صوص ريزو.","calories":"750 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":503,"name":"ريزو باربيكو","nameEn":"BBQ Chicken Rizo","categoryId":"rizo","price":4500,"ingredients":"أرز ريزو، قطع دجاج مقرمشة، صلصة باربيكيو مدخنة، صوص ريزو خاص.","calories":"690 سعرة","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":601,"name":"مقبلات مشكلة - حجم كبير","nameEn":"Large Mixed Appetizers Platter","categoryId":"appetizers","price":3000,"ingredients":"تشكيلة مقبلات شرقية منوعة (حمص بطحينة، متبل باذنجان، بابا غنوج، جاجيك بالخيار والنعناع، لهانة حمراء، وسلطة زيتون).","calories":"460 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":602,"name":"مقبلات مشكلة - حجم وسط","nameEn":"Medium Mixed Appetizers","categoryId":"appetizers","price":2000,"ingredients":"صحن مقبلات وسط مشكل (حمص، متبل، جاجيك، سلطة لهانة).","calories":"310 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":603,"name":"مقبلات مشكلة - حجم صغير","nameEn":"Small Mixed Appetizers","categoryId":"appetizers","price":1000,"ingredients":"صحن مقبلات فردي صغير مشكل طازج.","calories":"190 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":701,"name":"ببسي","nameEn":"Pepsi Can (330ml)","categoryId":"drinks","price":500,"ingredients":"مشروب غازي ببسي مثلج في كان معدني.","calories":"140 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":702,"name":"سفن أب","nameEn":"7-Up Can (330ml)","categoryId":"drinks","price":500,"ingredients":"مشروب غازي سفن أب مثلج بنكهة الليمون واللايم المنعشة.","calories":"140 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":703,"name":"ميراندا برتقال","nameEn":"Mirinda Orange Can","categoryId":"drinks","price":500,"ingredients":"مشروب غازي ميراندا برتقال بارد ومنعش.","calories":"150 سعرة","isPopular":false,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":704,"name":"شنينة (لبن عيران)","nameEn":"Fresh Ayran Shanina","categoryId":"drinks","price":500,"ingredients":"لبن عيران طبيعي بارد مع رشة نعناع وملح خفيف.","calories":"90 سعرة","isPopular":true,"isSpicy":false,"isVeg":true,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1584947914532-26113214578f?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_masgouf","name":"\u0633\u0645\u0643 \u0645\u0633\u0643\u0648\u0641 \u0639\u0631\u0627\u0642\u064a (\u0628\u0627\u0644\u0648\u0632\u0646)","nameEn":"Iraqi Masgouf Fish (By Weight)","categoryId":"fish","price":10000,"unitPrice":10000,"isWeighted":true,"ingredients":"\u0633\u0645\u0643 \u0643\u0627\u0631\u0628 \u0639\u0631\u0627\u0642\u064a \u062d\u064a \u0637\u0627\u0632\u062c \u064a\u0648\u0632\u0646 \u0648\u064a\u0634\u0648\u0649 \u0639\u0644\u0649 \u0627\u0644\u062d\u0637\u0628\u060c \u064a\u062d\u0633\u0628 \u0627\u0644\u0633\u0639\u0631 \u0648\u0641\u0642 \u0627\u0644\u0648\u0632\u0646 \u0627\u0644\u0641\u0639\u0644\u064a (10,000 \u062f.\u0639 \u0643\u063a\u0645) \u0645\u0639 \u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631 \u0648\u0627\u0644\u0637\u0631\u0634\u064a \u0648\u0627\u0644\u0644\u064a\u0645\u0648\u0646 \u0648\u0627\u0644\u0639\u0645\u0628\u0629 \u0648\u0633\u064a\u0631\u0641\u064a\u0633 \u0627\u0644\u062e\u0636\u0627\u0631.","calories":"450 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_bunni","name":"\u0633\u0645\u0643 \u0628\u0646\u064a \u062f\u062c\u0644\u0627\u0648\u064a \u0645\u0633\u0643\u0648\u0641","nameEn":"Masgouf Bunni Fish (By Weight)","categoryId":"fish","price":12000,"unitPrice":12000,"isWeighted":true,"ingredients":"\u0633\u0645\u0643 \u0628\u0646\u064a \u0639\u0631\u0627\u0642\u064a \u062f\u062c\u0644\u0627\u0648\u064a \u0637\u0627\u0632\u062c \u0645\u0634\u0648\u064a \u0639\u0644\u0649 \u0627\u0644\u062d\u0637\u0628 \u0628\u0646\u0643\u0647\u0629 \u0639\u0631\u0627\u0642\u064a\u0629 \u0623\u0635\u064a\u0644\u0629\u060c \u064a\u0642\u062f\u0645 \u0645\u0639 \u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631 \u0648\u0627\u0644\u0645\u062e\u0644\u0644\u0627\u062a \u0648\u0627\u0644\u0644\u064a\u0645\u0648\u0646.","calories":"420 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_gattan","name":"\u0633\u0645\u0643 \u0643\u0637\u0627\u0646 \u0645\u0633\u0643\u0648\u0641 \u0641\u0627\u062e\u0631","nameEn":"Masgouf Gattan Fish (By Weight)","categoryId":"fish","price":14000,"unitPrice":14000,"isWeighted":true,"ingredients":"\u0633\u0645\u0643 \u0643\u0637\u0627\u0646 \u0639\u0631\u0627\u0642\u064a \u0646\u0647\u0631\u064a \u0645\u0634\u0648\u064a \u0639\u0644\u0649 \u062c\u0645\u0631 \u0627\u0644\u062e\u0634\u0628 \u0645\u0639 \u062e\u0644\u0637\u0629 \u0627\u0644\u0634\u064a\u0641 \u0648\u0633\u064a\u0631\u0641\u064a\u0633 \u0643\u0627\u0645\u0644.","calories":"480 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_shibbot","name":"\u0633\u0645\u0643 \u0634\u0628\u0648\u0637 \u0639\u0631\u0627\u0642\u064a (\u0628\u0627\u0644\u0648\u0632\u0646)","nameEn":"Iraqi Shibbot Fish (By Weight)","categoryId":"fish","price":11000,"unitPrice":11000,"isWeighted":true,"ingredients":"\u0633\u0645\u0643 \u0634\u0628\u0648\u0637 \u0639\u0631\u0627\u0642\u064a \u0646\u0647\u0631\u064a \u0637\u0627\u0632\u062c \u0645\u0634\u0648\u064a \u0639\u0644\u0649 \u0627\u0644\u062d\u0637\u0628 \u0623\u0648 \u0645\u0642\u0644\u064a \u062d\u0633\u0628 \u0627\u0644\u0637\u0644\u0628\u060c \u064a\u062d\u0633\u0628 \u0627\u0644\u0633\u0639\u0631 \u0628\u0627\u0644\u0648\u0632\u0646 \u0627\u0644\u0641\u0639\u0644\u064a \u0648\u064a\u0642\u062f\u0645 \u0645\u0639 \u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631 \u0648\u0627\u0644\u0645\u062e\u0644\u0644\u0627\u062a \u0648\u0627\u0644\u0639\u0645\u0628\u0629.","calories":"460 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_fried","name":"\u0633\u0645\u0643 \u0645\u0642\u0644\u064a \u0639\u0631\u0627\u0642\u064a \u0645\u0642\u0631\u0645\u0634 (\u0628\u0627\u0644\u0648\u0632\u0646)","nameEn":"Crispy Fried Fish (By Weight)","categoryId":"fish","price":10000,"unitPrice":10000,"isWeighted":true,"ingredients":"\u0642\u0637\u0639 \u0633\u0645\u0643 \u0637\u0627\u0632\u062c\u0629 \u0645\u0642\u0644\u064a\u0629 \u0630\u0647\u0628\u064a\u0629 \u0645\u0642\u0631\u0645\u0634\u0629 \u0648\u0645\u062a\u0628\u0644\u0629 \u0628\u0627\u0644\u0628\u0647\u0627\u0631\u0627\u062a \u0627\u0644\u0639\u0631\u0627\u0642\u064a\u0629 \u0645\u0639 \u0627\u0644\u0637\u0645\u0627\u0637\u0645 \u0648\u0627\u0644\u062e\u064a\u0627\u0631 \u0648\u0627\u0644\u0645\u062e\u0644\u0644\u0627\u062a \u0648\u0627\u0644\u0639\u0645\u0628\u0629 \u0648\u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631.","calories":"520 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_shrimp_kg","name":"\u062c\u0645\u0628\u0631\u064a \u0645\u0642\u0644\u064a (\u0628\u0627\u0644\u0648\u0632\u0646)","nameEn":"Fried Shrimp (By Weight)","categoryId":"fish","price":15000,"unitPrice":15000,"isWeighted":true,"ingredients":"\u062c\u0645\u0628\u0631\u064a \u0637\u0627\u0632\u062c \u0643\u0628\u064a\u0631 \u0627\u0644\u062d\u062c\u0645 \u0645\u0642\u0644\u064a \u0628\u0627\u0644\u0632\u0628\u062f\u0629 \u0648\u0627\u0644\u062b\u0648\u0645 \u0648\u0627\u0644\u0644\u064a\u0645\u0648\u0646 \u0648\u0645\u062a\u0628\u0644 \u0628\u0627\u0644\u0628\u0647\u0627\u0631\u0627\u062a\u060c \u064a\u062d\u0633\u0628 \u0627\u0644\u0633\u0639\u0631 \u0628\u0627\u0644\u0648\u0632\u0646 \u0648\u064a\u0642\u062f\u0645 \u0645\u0639 \u0627\u0644\u062e\u0628\u0632 \u0648\u0627\u0644\u0635\u0644\u0635\u0627\u062a.","calories":"380 \u0633\u0639\u0631\u0629 / \u062d\u0635\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1565680018434-b75b2e2a78e4?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_shrimp_portion","name":"\u062d\u0635\u0629 \u062c\u0645\u0628\u0631\u064a \u0645\u0642\u0644\u064a","nameEn":"Fried Shrimp Portion","categoryId":"fish","price":8000,"isWeighted":false,"ingredients":"\u062d\u0635\u0629 \u0641\u0631\u062f\u064a\u0629 \u0645\u0646 \u0627\u0644\u062c\u0645\u0628\u0631\u064a \u0627\u0644\u0643\u0628\u064a\u0631 \u0627\u0644\u0645\u0642\u0644\u064a \u0628\u0627\u0644\u0632\u0628\u062f\u0629 \u0648\u0627\u0644\u062b\u0648\u0645 \u0648\u0627\u0644\u0644\u064a\u0645\u0648\u0646\u060c \u062a\u0642\u062f\u0645 \u0645\u0639 \u0635\u0644\u0635\u0629 \u0627\u0644\u062b\u0648\u0645 \u0648\u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631.","calories":"320 \u0633\u0639\u0631\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1565680018434-b75b2e2a78e4?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_fillet","name":"\u0641\u064a\u0644\u064a\u0647 \u0633\u0645\u0643 \u0645\u0642\u0644\u064a","nameEn":"Crispy Fish Fillet","categoryId":"fish","price":6000,"isWeighted":false,"ingredients":"\u0641\u064a\u0644\u064a\u0647 \u0633\u0645\u0643 \u0637\u0627\u0632\u062c \u0628\u0627\u0646\u064a\u0647 \u0645\u0642\u0644\u064a \u0630\u0647\u0628\u064a \u0645\u0642\u0631\u0645\u0634 \u0645\u0639 \u0635\u0644\u0635\u0629 \u0627\u0644\u0637\u0631\u0637\u0627\u0631 \u0648\u0627\u0644\u0644\u064a\u0645\u0648\u0646 \u0648\u0627\u0644\u062e\u0628\u0632 \u0627\u0644\u062d\u0627\u0631.","calories":"490 \u0633\u0639\u0631\u0629","isPopular":false,"isSpicy":false,"isVeg":false,"isNew":false,"available":true,"image":"https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format\u0026fit=crop\u0026w=600\u0026q=80"},{"id":"fd_fish_calamari","name":"\u0643\u0627\u0644\u064a\u0645\u0627\u0631\u064a \u0645\u0642\u0644\u064a","nameEn":"Fried Calamari","categoryId":"fish","price":7000,"isWeighted":false,"ingredients":"\u062d\u0644\u0642\u0627\u062a \u0643\u0627\u0644\u064a\u0645\u0627\u0631\u064a \u0637\u0627\u0632\u062c\u0629 \u0628\u0627\u0646\u064a\u0647 \u0645\u0642\u0644\u064a\u0629 \u0630\u0647\u0628\u064a\u0629 \u0645\u0642\u0631\u0645\u0634\u0629 \u0645\u0639 \u0635\u0644\u0635\u0629 \u0627\u0644\u0637\u0631\u0637\u0627\u0631 \u0648\u062f\u0642\u0629 \u0627\u0644\u0644\u064a\u0645\u0648\u0646 \u0627\u0644\u062d\u0627\u0645\u0636.","calories":"410 \u0633\u0639\u0631\u0629","isPopular":true,"isSpicy":false,"isVeg":false,"isNew":true,"available":true,"image":"https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format\u0026fit=crop\u0026w=600\u0026q=80"}];

function getDefaultRestaurantConfig(restId) {
  if (restId === 'banan') {
    return {
      name: "مطعم بنان",
      nameEn: "Banan Restaurant",
      tagline: "أشهى المأكولات والمشروبات بنكهة مميزة",
      taglineEn: "Delicious Food & Drinks",
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
      wifiName: "Banan_WiFi",
      wifiPass: "banan2026",
      address: "العراق",
      workingHours: "10:00 صباحاً - 12:00 منتصف الليل",
      holidays: "مفتوح طوال أيام الأسبوع",
      tablesCount: 20,
      taxRate: 0,
      serviceCharge: 0,
      theme: "luxury",
      lang: "ar",
      logo: "banan-logo.jpg"
    };
  }
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
  if (restId === 'fahma_dokhan') {
    return typeof DEFAULT_RESTAURANT_CONFIG !== 'undefined' ? DEFAULT_RESTAURANT_CONFIG : {};
  }
  return {
    name: "المنيو الرقمي الذكي",
    nameEn: "Smart E-Menu",
    tagline: "لوحة الإدارة والتحكم السحابية",
    currency: "د.ع",
    currencyEn: "IQD",
    logo: "logo.svg",
    planType: "basic"
  };
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
      if (parsed !== null && parsed !== undefined) {
        if (key === 'dishes' && Array.isArray(parsed) && parsed.some(d => d.id >= 802 && d.id <= 836)) {
          const cleaned = parsed.filter(d => !(d.id >= 801 && d.id <= 836));
          const defaultFish = (typeof DEFAULT_DISHES !== 'undefined') ? DEFAULT_DISHES.filter(d => d.categoryId === 'fish') : [];
          const merged = [...cleaned, ...defaultFish];
          try { localStorage.setItem(scopedKey, JSON.stringify(merged)); } catch(e){}
          return merged;
        }
        if (key === 'dishes' && Array.isArray(parsed) && parsed.length === 0) { return (fallback && fallback.length > 0) ? fallback : DEFAULT_DISHES; }
        return parsed;
      }
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
    return (fallback !== undefined && fallback !== null) ? fallback : DEFAULT_CATEGORIES;
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
      console.log("✅ Admin: All fish dishes migrated to weighted (per_kg) successfully.");
    }
  } catch (e) {
    console.warn("Fish migration notice:", e);
  }
}
window.migrateFishDishesToWeighted = migrateFishDishesToWeighted;
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
    { id: "u_cashier_1", username: "cashier", name: "صالح (كاشير الصندوق)", pin: "••••••••", role: "cashier", active: true }
  ],
  captains: [
    { id: "u_cap_1", username: "captain", name: "كابتن الصالة", pin: "••••••••", role: "captain", active: true }
  ],
  drivers: [
    { id: "u_driver_1", username: "driver", name: "مندوب توصيل منصة بَنان", pin: "••••••••", role: "driver", active: true }
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
  
  // فحص ما إذا كانت الذاكرة المحلية تحتوي على حسابات وهمية قديمة (cash, ahmed, ali, mustafa)
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

  try {
    const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
    let data = null;

    if (client) {
      try {
        const res = await client
          .from('restaurant_users')
          .select('*')
          .eq('restaurant_id', restId);
        if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
          data = res.data;
        }
      } catch (errClient) {
        console.warn("Error querying restaurant_users from Supabase:", errClient);
      }
    }

    // احتياط الذاكرة المحلية إذا تعذر الاتصال
    if (!data || data.length === 0) {
      try {
        const rawCached = localStorage.getItem('smart_emenu_cached_users');
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            data = parsed;
          }
        }
      } catch(e) {}
    }

    if (!data || data.length === 0) {
      return getAuthConfig();
    }

    const authConfig = {
      admin: { id: "u_admin_1", username: "admin", pin: "", name: "المدير العام", role: "admin", active: true },
      cashiers: [],
      captains: [],
      drivers: []
    };

    data.forEach(user => {
      let displayPin = user.pin;
      if (typeof displayPin === 'string' && displayPin.startsWith('$2a$')) {
        displayPin = '••••••••';
      }
      const userObj = {
        id: user.id,
        username: user.username,
        pin: displayPin || '••••••••',
        name: user.full_name || user.name || (user.role === 'cashier' ? 'كاشير الصندوق الرئيسي' : (user.role === 'driver' ? 'مندوب التوصيل' : 'كابتن الصالة')),
        role: user.role,
        active: user.active !== false
      };

      if (user.role === 'admin' || user.username === 'admin') {
        authConfig.admin = userObj;
      } else if (user.role === 'cashier' || user.username === 'cashier') {
        authConfig.cashiers.push(userObj);
      } else if (user.role === 'captain' || user.username === 'captain') {
        authConfig.captains.push(userObj);
      } else if (user.role === 'driver' || user.username === 'driver') {
        authConfig.drivers.push(userObj);
      }
    });

    if (authConfig.cashiers.length === 0 && DEFAULT_AUTH_CONFIG.cashiers) {
      authConfig.cashiers = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG.cashiers));
    }
    if (authConfig.captains.length === 0 && DEFAULT_AUTH_CONFIG.captains) {
      authConfig.captains = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG.captains));
    }
    if (authConfig.drivers.length === 0 && DEFAULT_AUTH_CONFIG.drivers) {
      authConfig.drivers = JSON.parse(JSON.stringify(DEFAULT_AUTH_CONFIG.drivers));
    }

    saveAuthConfig(authConfig);
    return authConfig;
  } catch (e) {
    console.error("fetchUsersFromSupabase caught error:", e);
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

  // المصادقة السحابية الحصرية عبر سوبابيس (لا توجد أي كلمات مرور برمجية ثابتة)
  if (window.AuthCore && typeof window.AuthCore.loginUserAsync === 'function') {
    return await window.AuthCore.loginUserAsync(username, password, rememberMe);
  }

  // 2. الفحص والتحقق من سحابة Supabase الحية
  if (client) {
    try {
      let { data, error } = await client
        .from('restaurant_users')
        .select('*')
        .eq('restaurant_id', restId);

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

        // البحث عن المستخدم بمرونة
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

          const pinMatch = (matched.pin && matched.pin.trim() === pwd);

          if (pinMatch) {
            resetFailedAttempts();
            const roleName = (matched.username === 'super_admin' || matched.role === 'super_admin') ? 'super_admin' : matched.role;
            const session = {
              role: roleName,
              userId: matched.id,
              captainId: matched.role === 'captain' ? matched.id : null,
              name: matched.full_name,
              username: matched.username,
              restaurantId: matched.restaurant_id || restId,
              loginTime: Date.now(),
              rememberMe: true,
              token: `${matched.role ? matched.role.substring(0,3) : 'usr'}_${generateSecureToken()}`
            };
            saveUserSession(session, true);
            return { success: true, session, role: roleName, restaurantId: matched.restaurant_id || restId };
          } else {
            recordFailedAttempt();
            return { success: false, message: 'كلمة المرور غير صحيحة!' };
          }
        }
      }
    } catch (e) {
      console.warn("Supabase live auth notice:", e);
    }
  }

  // 3. الفحص المحلي الشامل المطابق لسوبابيس حصراً
  const localConfig = getAuthConfig();
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
async function addStaffUserAsync(name, username, pin, role = 'captain', assigned_printer_id = null) {
  const cleanName = name ? name.trim() : '';
  if (!cleanName) return { success: false, message: 'يرجى إدخال اسم صحيح للموظف!' };
  if (!pin || pin.trim().length < 4) return { success: false, message: 'يجب أن يتكون رمز المرور من 4 خانات على الأقل!' };

  const finalUsername = username && username.trim() 
    ? username.trim().toLowerCase() 
    : (role === 'cashier' ? 'cashier_' + Math.floor(100 + Math.random() * 900) : 'cap_' + Math.floor(100 + Math.random() * 900));

  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  const newId = (role === 'cashier' ? 'u_csh_' : (role === 'driver' ? 'u_drv_' : 'u_cap_')) + Date.now();
  
  const newUser = {
    id: newId,
    restaurant_id: restId,
    username: finalUsername,
    pin: pin.trim(),
    full_name: cleanName,
    role: role,
    assigned_printer_id: assigned_printer_id || null,
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
      assigned_printer_id: assigned_printer_id || null,
      active: true
    });
  } else if (role === 'driver') {
    if (!local.drivers) local.drivers = [];
    local.drivers.push({
      id: newId,
      username: finalUsername,
      name: cleanName,
      pin: pin.trim(),
      role: 'driver',
      assigned_printer_id: assigned_printer_id || null,
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
      assigned_printer_id: assigned_printer_id || null,
      active: true
    });
  }
  saveAuthConfig(local);

  return { success: true, user: newUser };
}

async function updateStaffUserAsync(id, { name, username, pin, role, assigned_printer_id }) {
  if (!name || !name.trim()) return { success: false, message: 'يرجى إدخال اسم صحيح!' };
  if (pin && pin.trim().length < 4) return { success: false, message: 'يجب أن يتكون الرمز السري من 4 خانات على الأقل!' };

  const local = getAuthConfig();
  let found = null;
  let targetList = 'captains';

  if (local.cashiers && local.cashiers.some(c => c.id === id)) {
    found = local.cashiers.find(c => c.id === id);
    targetList = 'cashiers';
  } else if (local.drivers && local.drivers.some(d => d.id === id)) {
    found = local.drivers.find(d => d.id === id);
    targetList = 'drivers';
  } else if (local.captains && local.captains.some(c => c.id === id)) {
    found = local.captains.find(c => c.id === id);
    targetList = 'captains';
  }

  if (found) {
    found.name = name.trim();
    if (username) found.username = username.trim().toLowerCase();
    if (pin) found.pin = pin.trim();
    if (role) found.role = role;
    found.assigned_printer_id = assigned_printer_id || null;
    found.assignedPrinterId = assigned_printer_id || null;
    saveAuthConfig(local);
  }

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      const updateData = { full_name: name.trim(), updated_at: new Date().toISOString() };
      if (username) updateData.username = username.trim().toLowerCase();
      if (pin) updateData.pin = pin.trim();
      if (role) updateData.role = role;
      updateData.assigned_printer_id = assigned_printer_id || null;
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
  } else if (local.drivers && local.drivers.some(d => d.id === id)) {
    item = local.drivers.find(d => d.id === id);
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
  if (local.drivers) {
    local.drivers = local.drivers.filter(d => d.id !== id);
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
    if (sessionStorage.getItem('is_super_admin_logged_in') === 'true' || 
        localStorage.getItem('is_super_admin_logged_in') === 'true' ||
        sessionStorage.getItem('emattec_master_auth') === 'true' ||
        localStorage.getItem('emattec_master_auth') === 'true') {
      const superUser = sessionStorage.getItem('super_admin_user') || localStorage.getItem('super_admin_user') || 'super_admin';
      return {
        role: 'super_admin',
        userId: 'master_super_admin',
        name: 'مدير المنظومة والمنصة المركزي (Super Admin)',
        username: superUser,
        restaurantId: restId,
        loginTime: Date.now(),
        rememberMe: true,
        token: 'sup_master_sync'
      };
    }

    let sessionStr = sessionStorage.getItem('smart_emenu_' + restId + '_session') 
                  || sessionStorage.getItem('smart_emenu_session')
                  || localStorage.getItem('smart_emenu_' + restId + '_session')
                  || localStorage.getItem('smart_emenu_session');

    if (!sessionStr) return null;
    const session = JSON.parse(sessionStr);

    if (session && session.role) {
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

function logoutSession(redirectUrl = 'login.html?role=admin') {
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
      if (typeof renderAdminDishesTable === 'function') renderAdminDishesTable();

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
      if (typeof renderAdminDishesTable === 'function') renderAdminDishesTable();

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
    alert(`✅ تم تنزيل نسخة شاملة للمطعم والمنيو (${res.filename}) بنجاح!\nالملف يحتوي على معلومات المطعم وقائمة الطعام (${res.count} طبق) بدون أي حسابات.`);
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
  order.items.forEach(item => {
    kitchenItemsHtml += `
      <tr>
        <td class="ticket-item-qty" style="font-size: ${isSmallPaper ? '12px' : '14px'}; font-weight: 900;">${item.quantity}</td>
        <td>
          <div style="font-weight: 900; font-size: ${isSmallPaper ? '11px' : '13px'};">${item.name}</div>
          <div style="font-size: ${isSmallPaper ? '8px' : '9px'}; color: #444;">سعر الصنف: ${item.price.toLocaleString()} ${config.currency || 'د.ع'}</div>
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
          ⚠️ ملاحظات وإضافات للطلب: ${order.notes}
        </div>
      ` : ''}

      <!-- المجموع الكلي البارز في بون المطبخ -->
      <div style="margin-top: 8px; border: 2.5px solid #000; padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: ${isSmallPaper ? '14px' : '17px'}; background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; border-radius: 6px;">
        <span>المجموع الكلي:</span>
        <span style="font-family: monospace; font-size: ${isSmallPaper ? '16px' : '20px'}; font-weight: 900;">${(order.total || 0).toLocaleString()} ${config.currency || 'د.ع'}</span>
      </div>

      <div class="ticket-footer" style="margin-top: 8px; border-top: 1.5px dashed #000; padding-top: 5px; text-align: center; font-weight: 900; font-size: ${isSmallPaper ? '11px' : '13px'};">
        <div>--- نهاية بون تحضير المطبخ ---</div>
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

  order.items.forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    customerItemsHtml += `
      <tr style="border-bottom: 1.5px dashed #888;">
        <td class="ticket-item-qty" style="font-size: ${isSmallPaper ? '14px' : '17px'}; font-weight: 900; text-align: center; vertical-align: middle; padding: 6px 2px;">
          <span style="display: inline-block; border: 2px solid #000; border-radius: 6px; padding: 2px 6px; min-width: 28px; background: #fff;">${item.quantity}</span>
        </td>
        <td style="vertical-align: middle; padding: 6px 4px;">
          <div style="font-weight: 900; font-size: ${isSmallPaper ? '13px' : '16px'}; color: #000;">${item.name}</div>
          <div style="font-size: ${isSmallPaper ? '10px' : '12px'}; color: #333; font-weight: bold; margin-top: 1px;">
            سعر المفرد: ${item.price.toLocaleString()} ${currency}
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
// تنسيق نصوص البونات للطباعة الصامتة المباشرة (ESC/POS & Text)
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
  
  let typeText = "سفري / خارجي";
  if (order.type === 'dine-in') {
    typeText = `صالة - طاولة [ ${order.tableNumber || 1} ]`;
  } else if (order.type === 'delivery') {
    typeText = "طلب توصيل دليفري";
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
    lines.push(` [${item.quantity}]  ${item.name}`);
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

  let typeText = "سفري / خارجي";
  if (order.type === 'dine-in') {
    typeText = `صالة - طاولة [ ${order.tableNumber || 1} ]`;
  } else if (order.type === 'delivery') {
    typeText = "طلب توصيل دليفري";
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

  const custName = order.customerInfo || order.customerName || '';
  const custPhone = order.customerPhone || '';
  const custAddr = order.customerAddress || '';

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
  lines.push("العدد | الصنف                      | الإجمالي");
  lines.push(subDiv);

  let subtotal = 0;
  (order.items || []).forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    lines.push(` [${item.quantity}]  ${item.name}`);
    lines.push(`      ${item.price.toLocaleString()} x ${item.quantity} = ${itemTotal.toLocaleString()} ${currency}`);
  });

  lines.push(subDiv);
  lines.push(`المجموع الفرعي: ${subtotal.toLocaleString()} ${currency}`);

  if (order.deliveryFee && order.deliveryFee > 0) {
    lines.push(`أجور التوصيل: +${order.deliveryFee.toLocaleString()} ${currency}`);
  }
  if (order.discount && order.discount > 0) {
    lines.push(`الخصم والتخفيض: -${order.discount.toLocaleString()} ${currency}`);
  }

  lines.push(div);
  lines.push(`المجموع النهائي المطلوب: ${(order.total || 0).toLocaleString()} ${currency}`);
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

// دالة الطباعة المباشرة الذكية للأوردر
async function printOrderDirect(order, overrideTicketType = null) {
  if (!order) return;

  const ticketEl = document.getElementById('kitchen-print-ticket');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const printSettings = getPrintSettings();

  const isSmallPaper = (printSettings.paperSize === '58mm');
  // الفواتير التي تطبع من صفحة الأدمن تطبع دائماً من طابعة الكاشير والحساب (100)
  let ticketType = overrideTicketType || 'customer';
  if (ticketType === 'separate' || ticketType === 'both' || ticketType === 'combined') {
    ticketType = 'customer';
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

  // تحديث محتوى عنصر الطباعة للمتصفح (فردي محدد فقط)
  if (ticketEl) {
    if (ticketType === 'kitchen') {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getKitchenTicketHtml(order, config, timeStr, dateStr, typeBadge, isSmallPaper)}</div>`;
    } else {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getCustomerTicketHtml(order, config, timeStr, dateStr, typeBadge, currency, isSmallPaper)}</div>`;
    }
  }

  // محاولة الطباعة الصامتة عبر وسيط ويندوز المحلي إذا كانت مفعلة (طابعة فردية فقط)
  if (printSettings.silentPrint !== false) {
    const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
    try {
      if (ticketType === 'kitchen') {
        // بون المطبخ فقط (101)
        const kitchenText = formatKitchenTextTicket(order, config, isSmallPaper);
        const res = await fetch(`${bridgeUrl}/print-kitchen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ip',
            ip: printSettings.kitchenIp || '192.168.1.101',
            port: printSettings.kitchenPort || 9100,
            text: kitchenText
          })
        }).catch(e => null);
        if (res && res.ok) {
          showSilentPrintToast("تم إرسال بون المطبخ فقط (101) 👨‍🍳✅");
          return;
        }
      } else {
        // فاتورة الكاشير فقط (100)
        const cashierText = formatCashierTextTicket(order, config, isSmallPaper);
        const res = await fetch(`${bridgeUrl}/print-cashier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: printSettings.cashierMode || 'ip',
            ip: printSettings.cashierIp || '192.168.1.100',
            port: printSettings.cashierPort || 9100,
            printerName: printSettings.cashierPrinterName,
            text: cashierText
          })
        }).catch(e => null);
        if (res && res.ok) {
          showSilentPrintToast("تم إرسال فاتورة الحساب فقط (100) 🧾✅");
          return;
        }
      }
    } catch (err) {
      console.warn("Silent bridge error, falling back to window.print:", err);
    }
  }

  // في حال تعذر وسيط الطباعة، التحويل لنافذة الطباعة العادية
  window.print();
}

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

function printOrderDirectById(orderId, type = 'customer') {
  const orders = getStoredData('orders', []);
  const order = orders.find(o => String(o.id) === String(orderId));
  if (order) {
    printOrderDirect(order, type);
  }
}
window.printOrderDirectById = printOrderDirectById;

// -------------------------------------------------------------
// إدارة الطابعات المركزية المتقدمة (شبكية IP وUSB)
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
      console.warn("fetchRestaurantPrinters notice:", err);
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
  populatePrinterSelects();
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
  populatePrinterSelects();
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

async function populatePrinterSelects() {
  const printers = await fetchRestaurantPrinters();
  const staffSelect = document.getElementById('staff-form-printer-id');
  const dishSelect = document.getElementById('dish-form-printer-id');

  if (staffSelect) {
    const currentVal = staffSelect.value;
    staffSelect.innerHTML = '<option value="">[ استخدام طابعة الكاشير الافتراضية ]</option>';
    printers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} - ${p.connection_type === 'usb' ? ('USB: ' + (p.usb_printer_name || 'ويندوز')) : (p.ip + ':' + (p.port || 9100))}`;
      staffSelect.appendChild(opt);
    });
    if (currentVal) staffSelect.value = currentVal;
  }

  if (dishSelect) {
    const currentVal = dishSelect.value;
    dishSelect.innerHTML = '<option value="">[ طابعة المطبخ الافتراضية - 101 ]</option>';
    printers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.section === 'kitchen' ? 'مطبخ' : 'قسم'}) - ${p.connection_type === 'usb' ? ('USB: ' + (p.usb_printer_name || 'ويندوز')) : (p.ip + ':' + (p.port || 9100))}`;
      dishSelect.appendChild(opt);
    });
    if (currentVal) dishSelect.value = currentVal;
  }
}
window.populatePrinterSelects = populatePrinterSelects;

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

  // جلب وعرض قائمة الطابعات الديناميكية
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

  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  let drivers = [];
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (client) {
    try {
      const { data } = await client.from('restaurant_users').select('*').eq('restaurant_id', restId).eq('role', 'driver');
      if (data && data.length > 0) drivers = data;
    } catch(e) {}
  }
  if (!drivers || drivers.length === 0) {
    try {
      const auth = getStoredData('auth', {});
      drivers = auth.drivers || [];
    } catch(e) {}
  }
  if (!drivers || drivers.length === 0) {
    drivers = [
      { id: 'u_drv_1', full_name: 'محمد السريع', username: 'driver1', phone: '07701112233', vehicle_info: 'دراجة نارية' },
      { id: 'u_drv_2', full_name: 'علي التوصيل', username: 'driver2', phone: '07702223344', vehicle_info: 'سيارة تكسي' }
    ];
  }

  const orders = getStoredData('orders', []);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const currency = config.currency || 'د.ع';

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

  alert(`✅ تمت تسوية عهدة السائق [${driverName}] بنجاح، وتصفير حسابه!`);
  renderDriverSettlementsBody();
}
window.settleDriverBalance = settleDriverBalance;


// =============================================================

function getAccountingReport(filterPreset = 'today', customDateStr = null) {
  const activeOrders = getStoredData('orders', []);
  const archivedOrders = getStoredData('accounting_archive', []);
  
  // دمج الطلبات النشطة والأرشيف المحاسبي الثابت مع استبعاد التكرار
  const orderMap = new Map();
  archivedOrders.forEach(o => { if (o && o.id) orderMap.set(String(o.id), o); });
  activeOrders.forEach(o => { if (o && o.id) orderMap.set(String(o.id), o); });
  const orders = Array.from(orderMap.values());

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

// -------------------------------------------------------------
// طباعة تقرير نهاية اليوم (Z-Report) صامتاً وفورياً لمرة واحدة فقط
// -------------------------------------------------------------
function formatEndOfDayReportText(report) {
  const line = "========================================";
  const dashed = "----------------------------------------";
  let txt = "\r\n";
  txt += "        " + (report.restaurantName || "مطعم فحمة ودخان") + "\r\n";
  txt += "     تقرير نهاية اليوم (Z-Report)\r\n";
  txt += dashed + "\r\n";
  txt += "الفترة: " + (report.title || "اليوم") + "\r\n";
  txt += "وقت الاستخراج: " + (report.generatedAt || new Date().toLocaleString('ar-IQ')) + "\r\n";
  txt += line + "\r\n";
  txt += "المؤشرات المالية:\r\n";
  txt += "إجمالي المبيعات الكلية: " + (report.totalRevenue || 0).toLocaleString() + " " + (report.currency || "د.ع") + "\r\n";
  txt += "عدد الفواتير المنفذة: " + (report.totalOrders || 0) + " طلب\r\n";
  txt += "متوسط قيمة الفاتورة: " + (report.avgOrderValue || 0).toLocaleString() + " " + (report.currency || "د.ع") + "\r\n";
  txt += dashed + "\r\n";
  txt += "تفصيل قنوات البيع:\r\n";
  txt += "- مبيعات الصالة (" + (report.dineInCount || 0) + " طلب): " + (report.dineInSales || 0).toLocaleString() + " " + (report.currency || "د.ع") + "\r\n";
  txt += "- السفري والتوصيل (" + ((report.takeawayCount || 0) + (report.deliveryCount || 0)) + " طلب): " + ((report.takeawaySales || 0) + (report.deliverySales || 0)).toLocaleString() + " " + (report.currency || "د.ع") + "\r\n";
  txt += dashed + "\r\n";
  txt += "الأصناف الأكثر مبيعاً:\r\n";
  if (report.topDishes && report.topDishes.length > 0) {
    report.topDishes.forEach((d, idx) => {
      txt += (idx + 1) + ". " + d.name + "\r\n";
      txt += "   ×" + d.quantity + " = " + (d.totalRevenue || 0).toLocaleString() + " " + (report.currency || "د.ع") + "\r\n";
    });
  } else {
    txt += "  لا توجد مبيعات مسجلة لهذه الفترة\r\n";
  }
  txt += line + "\r\n";
  txt += "توقيع الكاشير: ...............\r\n";
  txt += "توقيع المدير: ...............\r\n";
  txt += "نظام Smart E-Menu - هاتف: 07702265652\r\n";
  txt += "\r\n\r\n\r\n";
  return txt;
}

let isPrintingEndOfDayReport = false;
async function printEndOfDayReportDirect(filterPreset = 'today', customDateStr = null) {
  // قفل لمنع التكرار نهائياً وضمان الطباعة لمرة واحدة وليس مرتين
  if (isPrintingEndOfDayReport) {
    console.warn("EOD Report is already printing, skipping duplicate trigger.");
    return;
  }
  isPrintingEndOfDayReport = true;

  try {
    const report = getAccountingReport(filterPreset, customDateStr);
    const printSettings = getStoredData('print_settings', {
      bridgeUrl: 'http://127.0.0.1:8080',
      cashierMode: 'ip',
      cashierIp: '192.168.1.100',
      cashierPort: 9100,
      cashierPrinterName: '',
      paperSize: '80mm',
      silentPrint: true
    });

    const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
    let printedSilently = false;

    // محاولة الطباعة الصامتة الفورية عبر وسيط الطباعة المباشر 8080 لطابعة الكاشير 100
    if (printSettings.silentPrint !== false) {
      const reportText = formatEndOfDayReportText(report);
      try {
        const resp = await fetch(`${bridgeUrl}/print-cashier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: printSettings.cashierMode || 'ip',
            ip: printSettings.cashierIp || '192.168.1.100',
            port: printSettings.cashierPort || 9100,
            printerName: printSettings.cashierPrinterName || '',
            text: reportText
          })
        });
        if (resp && resp.ok) {
          printedSilently = true;
          alert("✅ تمت طباعة تقرير نهاية اليوم (Z-Report) صامتاً بنجاح على طابعة الكاشير (192.168.1.100) لمرة واحدة!");
        }
      } catch (err) {
        console.warn("Silent bridge print error:", err);
      }
    }

    if (!printedSilently) {
      // طباعة عبر متصفح الويب لمرة واحدة فقط كخيار بديل عند توقف الوسيط
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
      }, 150);
    }
  } finally {
    // فتح القفل بعد 3 ثوان لمنع أي نقرات متكررة نهائياً
    setTimeout(() => {
      isPrintingEndOfDayReport = false;
    }, 3000);
  }
}
window.printEndOfDayReportDirect = printEndOfDayReportDirect;

// -------------------------------------------------------------
// دوال إدارة الطابعات الحرارية في صفحة المدير
// -------------------------------------------------------------
function initAdminPrinterSettings() {
  const current = getStoredData('print_settings', {
    bridgeUrl: 'http://127.0.0.1:8080',
    cashierMode: 'ip',
    cashierIp: '192.168.1.100',
    cashierPort: 9100,
    cashierPrinterName: '',
    kitchenMode: 'ip',
    kitchenIp: '192.168.1.101',
    kitchenPort: 9100,
    paperSize: '80mm',
    silentPrint: true
  });

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('admin-printer-cashier-mode', current.cashierMode || 'ip');
  setVal('admin-printer-cashier-ip', current.cashierIp || '192.168.1.100');
  setVal('admin-printer-cashier-port', current.cashierPort || 9100);
  setVal('admin-printer-cashier-name', current.cashierPrinterName || '');
  setVal('admin-printer-kitchen-ip', current.kitchenIp || '192.168.1.101');
  setVal('admin-printer-kitchen-port', current.kitchenPort || 9100);
  setVal('admin-printer-bridge-url', current.bridgeUrl || 'http://127.0.0.1:8080');
  setVal('admin-printer-paper-size', current.paperSize || '80mm');

  const silentCb = document.getElementById('admin-printer-silent-print');
  if (silentCb) silentCb.checked = current.silentPrint !== false;

  toggleAdminCashierPrinterFields();
  testAdminPrinterBridge(false);
}
window.initAdminPrinterSettings = initAdminPrinterSettings;

function toggleAdminCashierPrinterFields() {
  const mode = document.getElementById('admin-printer-cashier-mode')?.value || 'ip';
  const ipFields = document.getElementById('admin-cashier-ip-fields');
  const winFields = document.getElementById('admin-cashier-win-fields');
  if (ipFields) ipFields.classList.toggle('hidden', mode !== 'ip');
  if (winFields) winFields.classList.toggle('hidden', mode !== 'windows');
}
window.toggleAdminCashierPrinterFields = toggleAdminCashierPrinterFields;

async function saveAdminPrinterSettings() {
  const settings = {
    bridgeUrl: document.getElementById('admin-printer-bridge-url')?.value.trim() || 'http://127.0.0.1:8080',
    cashierMode: document.getElementById('admin-printer-cashier-mode')?.value || 'ip',
    cashierIp: document.getElementById('admin-printer-cashier-ip')?.value.trim() || '192.168.1.100',
    cashierPort: parseInt(document.getElementById('admin-printer-cashier-port')?.value) || 9100,
    cashierPrinterName: document.getElementById('admin-printer-cashier-name')?.value.trim() || '',
    kitchenMode: document.getElementById('admin-printer-kitchen-mode')?.value || 'ip',
    kitchenIp: document.getElementById('admin-printer-kitchen-ip')?.value.trim() || '192.168.1.101',
    kitchenPort: parseInt(document.getElementById('admin-printer-kitchen-port')?.value) || 9100,
    paperSize: document.getElementById('admin-printer-paper-size')?.value || '80mm',
    silentPrint: document.getElementById('admin-printer-silent-print')?.checked ?? true
  };

  setStoredData('print_settings', settings);

  // مزامنة مع Supabase في جدول restaurant_printer_settings
  try {
    const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
    if (client) {
      const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
      await client.from('restaurant_printer_settings').upsert([{
        id: restId,
        restaurant_id: restId,
        cashier_printer_name: settings.cashierPrinterName,
        kitchen_printer_ip: settings.cashierIp,
        secondary_printer_ip: settings.kitchenIp,
        printer_paper_size: settings.paperSize,
        bridge_url: settings.bridgeUrl,
        dual_ip_print: true
      }]);
    }
  } catch (e) {
    console.warn("Supabase printer settings sync notice:", e);
  }

  alert("✅ تم حفظ إعدادات الطابعات الحرارية بنجاح ومزامنتها مع شاشة الكاشير والسحابة!");
}
window.saveAdminPrinterSettings = saveAdminPrinterSettings;

async function testAdminPrinterBridge(showAlert = true) {
  const bridgeUrl = document.getElementById('admin-printer-bridge-url')?.value.trim() || 'http://127.0.0.1:8080';
  const badge = document.getElementById('admin-printer-status-badge');
  if (badge) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>جاري الفحص...</span>`;
  }

  try {
    const resp = await fetch(`${bridgeUrl}/status`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      if (badge) {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span class="text-emerald-400">الوسيط متصل بنشاط (8080) ✅</span>`;
      }
      if (showAlert) alert("✅ وسيط الطباعة المحلي متصل ويعمل بكفاءة على المنفذ 8080!");
      return true;
    }
  } catch (e) {}

  if (badge) {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="text-rose-400">الوسيط غير متصل (تأكد من تشغيله) ⚠️</span>`;
  }
  if (showAlert) alert("⚠️ تعذر الاتصال بوسيط الطباعة المحلي على المنفذ 8080. يرجى التأكد من تشغيل 'تشغيل_وسيط_الطباعة.bat'.");
  return false;
}
window.testAdminPrinterBridge = testAdminPrinterBridge;

async function testAdminPrinterCashier() {
  const bridgeUrl = document.getElementById('admin-printer-bridge-url')?.value.trim() || 'http://127.0.0.1:8080';
  const ip = document.getElementById('admin-printer-cashier-ip')?.value.trim() || '192.168.1.100';
  const port = parseInt(document.getElementById('admin-printer-cashier-port')?.value) || 9100;
  const mode = document.getElementById('admin-printer-cashier-mode')?.value || 'ip';
  const name = document.getElementById('admin-printer-cashier-name')?.value.trim() || '';

  const testText = "========================================\r\n" +
    "        مطعم فحمة ودخان\r\n" +
    "     اختبار طابعة الكاشير الحرارية\r\n" +
    "----------------------------------------\r\n" +
    "طابعة: الكاشير والحساب (" + ip + ":" + port + ")\r\n" +
    "تاريخ الاختبار: " + new Date().toLocaleString('ar-IQ') + "\r\n" +
    "الحالة: الطباعة الصامتة تعمل بنجاح 100% ✅\r\n" +
    "========================================\r\n\r\n\r\n";

  try {
    const res = await fetch(`${bridgeUrl}/print-cashier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ip, port, printerName: name, text: testText })
    });
    if (res.ok) {
      alert("✅ تم إرسال أمر الطباعة التجريبية لطابعة الكاشير (192.168.1.100) بنجاح!");
      return;
    }
  } catch (e) {}
  alert("⚠️ تعذر إرسال أمر الطباعة. تأكد من تشغيل وسيط الطباعة على 8080 ومن توصيل الطابعة بالشبكة.");
}
window.testAdminPrinterCashier = testAdminPrinterCashier;

async function testAdminPrinterKitchen() {
  const bridgeUrl = document.getElementById('admin-printer-bridge-url')?.value.trim() || 'http://127.0.0.1:8080';
  const ip = document.getElementById('admin-printer-kitchen-ip')?.value.trim() || '192.168.1.101';
  const port = parseInt(document.getElementById('admin-printer-kitchen-port')?.value) || 9100;

  const testText = "========================================\r\n" +
    "        بون المطبخ والشيف 👨‍🍳\r\n" +
    "     اختبار طابعة المطبخ (101)\r\n" +
    "----------------------------------------\r\n" +
    "طابعة: المطبخ والأقسام (" + ip + ":" + port + ")\r\n" +
    "الوقت: " + new Date().toLocaleTimeString('ar-IQ') + "\r\n" +
    "جاهزية استقبال بونات الطلبات: ممتازة ✅\r\n" +
    "========================================\r\n\r\n\r\n";

  try {
    const res = await fetch(`${bridgeUrl}/print-kitchen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'ip', ip, port, text: testText })
    });
    if (res.ok) {
      alert("✅ تم إرسال أمر الطباعة التجريبية لطابعة المطبخ (192.168.1.101) بنجاح!");
      return;
    }
  } catch (e) {}
  alert("⚠️ تعذر إرسال أمر الطباعة لطابعة المطبخ. تأكد من تشغيل وسيط الطباعة 8080 وتوصيل الطابعة.");
}
window.testAdminPrinterKitchen = testAdminPrinterKitchen;

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
      if (data.phone) config.phone = data.phone;
      if (data.phone2 !== undefined) config.phone2 = data.phone2 || '';
      if (data.whatsapp_number) config.whatsappNumber = data.whatsapp_number;
      if (data.whatsapp_url) config.whatsappUrl = data.whatsapp_url;
      if (data.address) config.address = data.address;
      if (data.maps_url || data.map_url) config.mapUrl = data.maps_url || data.map_url;
      if (data.working_hours) config.workingHours = data.working_hours;
      if (data.holidays) config.holidays = data.holidays;
      if (data.wifi_name) config.wifiName = data.wifi_name;
      if (data.wifi_pass) config.wifiPass = data.wifi_pass;
      if (data.currency) config.currency = data.currency;

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

/* === admin.js === */
/**
 * Smart E-Menu - Super Admin & Kitchen Management Module
 * لوحة التحكم الشاملة لصاحب المطعم: إدارة الأصناف، الكباتن، المطبخ، والنسخ الاحتياطي
 */

// -------------------------------------------------------------
// درج القائمة الجانبي للأدمن (--- زر)
// -------------------------------------------------------------
function openAdminMenuSidebar() {
  const m = document.getElementById('admin-menu-sidebar');
  if (m) {
    m.style.display = 'flex';
    m.style.pointerEvents = 'auto';
    m.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}
function closeASidebar() {
  const m = document.getElementById('admin-menu-sidebar');
  if (m) {
    m.style.display = 'none';
    m.style.pointerEvents = 'none';
    m.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof fetchUsersFromSupabase === 'function') fetchUsersFromSupabase();
  initSuperAdmin();
});

function initSuperAdmin() {
  const loginView = document.getElementById('admin-login-view');
  const dashView = document.getElementById('admin-dashboard-view');
  if (!loginView && !dashView) return; // ليس في صفحة الأدمن

  const session = getCurrentSession();

  // فحص تسجيل دخول الأدمن أو السوبر أدمن أو مساعده
  const allowedRoles = ['admin', 'super_admin', 'assistant_super_admin'];
  if (!session || !allowedRoles.includes(session.role)) {
    const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
    window.location.replace('login.html?role=admin&rest=' + encodeURIComponent(restId));
    return;
  }

  showAdminDashboard();
}

function showAdminLoginScreen() {
  const loginView = document.getElementById('admin-login-view');
  const dashView = document.getElementById('admin-dashboard-view');
  if (loginView) loginView.classList.remove('hidden');
  if (dashView) dashView.classList.add('hidden');

  // إفراغ حقول الدخول تماماً لضمان الخصوصية والأمان
  const usernameInput = document.getElementById('superadmin-username-input');
  const pinInput = document.getElementById('superadmin-pin-input');
  const rememberCheckbox = document.getElementById('superadmin-remember-me');
  if (usernameInput) usernameInput.value = '';
  if (pinInput) pinInput.value = '';
  if (rememberCheckbox) rememberCheckbox.checked = false;
  try { resetFailedAttempts(); } catch(e){}
}

async function handleSuperAdminLogin(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('superadmin-username-input');
  const input = document.getElementById('superadmin-pin-input');
  const errorEl = document.getElementById('superadmin-login-error');
  const rememberCheckbox = document.getElementById('superadmin-remember-me');
  const btn = document.getElementById('admin-login-btn');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const pin = input ? input.value : '';
  const rememberMe = rememberCheckbox ? rememberCheckbox.checked : false;

  if (!username) {
    if (errorEl) {
      errorEl.textContent = 'يرجى إدخال اسم المستخدم!';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (btn) btn.textContent = 'جاري التحقق... ⏳';

  const res = typeof loginUserAsync === 'function' 
    ? await loginUserAsync(username, pin, rememberMe) 
    : { success: false, message: 'تعذر التحقق من تسجيل الدخول' };
  
  if (btn) btn.textContent = 'تسجيل الدخول 🚀';

  if (res.success) {
    if (errorEl) errorEl.classList.add('hidden');

    const activeRest = res.restaurantId || (typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan');
    const restParam = activeRest ? `?rest=${encodeURIComponent(activeRest)}` : '';

    if (res.role === 'cashier') {
      window.location.href = 'cashier.html' + restParam;
      return;
    } else if (res.role === 'captain') {
      window.location.href = 'captain.html' + restParam;
      return;
    } else if (res.role === 'super_admin' || res.role === 'assistant_super_admin') {
      window.location.href = 'super-admin.html';
      return;
    }
    showAdminDashboard();
  } else {
    if (errorEl) {
      errorEl.textContent = res.message;
      errorEl.classList.remove('hidden');
    }
  }
}

async function showAdminDashboard() {
  const loginView = document.getElementById('admin-login-view');
  const dashView = document.getElementById('admin-dashboard-view');
  if (loginView) loginView.classList.add('hidden');
  if (dashView) dashView.classList.remove('hidden');

  await syncRestaurantConfigFromSupabase();
  loadAdminOrders();
  loadAdminDishes();
  syncMenuFromSupabase();
  loadAdminCaptains();
  loadRestaurantSettings();
  
  if (typeof renderTableQRCardsContainer === 'function') {
    await loadAdminQR();
  }

  try {
    const savedTab = sessionStorage.getItem('smart_emenu_admin_active_tab');
    if (savedTab && typeof switchAdminTab === 'function') {
      switchAdminTab(savedTab, false);
    }
  } catch (e) {}

  window.addEventListener('storage', () => {
    loadAdminDishes();
    loadRestaurantSettings();
    loadAdminOrders();
  });

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.onmessage = (ev) => {
        if (ev.data && (ev.data.type === 'DISH_AVAILABILITY_CHANGED' || ev.data.type === 'DISH_SAVED' || ev.data.type === 'DISH_DELETED')) {
          loadAdminDishes();
        }
      };
    }
  } catch (e) {}
}

async function loadAdminQR() {
  const config = await syncRestaurantConfigFromSupabase();
  const count = parseInt(config.tablesCount) || 20;
  const countInput = document.getElementById('admin-qr-tables-count');
  if (countInput) countInput.value = count;

  const urlInput = document.getElementById('admin-qr-published-url-input');
  if (urlInput) {
    urlInput.value = getMenuTargetBaseUrl();
  }

  renderTableQRCardsContainer('admin-qr-grid', count);
}

async function saveAdminQRPublishedUrl() {
  const input = document.getElementById('admin-qr-published-url-input');
  if (!input) return;
  let newUrl = input.value.trim();
  if (newUrl) {
    newUrl = newUrl.replace(/\/index\.html$/i, '').replace(/\/$/, '');
  }

  let config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  config.publishedUrl = newUrl;
  setStoredData('config', config);

  const settingPubInput = document.getElementById('setting-published-url');
  if (settingPubInput) settingPubInput.value = newUrl;

  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  if (client) {
    try {
      await client.from('restaurants').update({ published_url: newUrl, updated_at: new Date().toISOString() }).eq('id', restId);
    } catch (e) {
      console.warn("Error updating published_url in Supabase:", e);
    }
  }

  renderTableQRCardsContainer('admin-qr-grid', config.tablesCount);
  if (typeof showAdminToast === 'function') {
    showAdminToast('تم حفظ رابط النشر سحابياً وتحديث جميع أكواد QR بنجاح! 🚀', 'success');
  } else {
    alert('تم حفظ رابط النشر سحابياً وتحديث جميع أكواد QR بنجاح! 🚀');
  }
}

function useCurrentOriginAsPublishedUrl() {
  const currentOrigin = window.location.origin + window.location.pathname.replace(/\/admin\.html$/i, '').replace(/\/cashier\.html$/i, '').replace(/\/captain\.html$/i, '').replace(/\/index\.html$/i, '').replace(/\/$/, '');
  const input = document.getElementById('admin-qr-published-url-input');
  if (input) {
    input.value = currentOrigin;
    saveAdminQRPublishedUrl();
  }
}

function updateQRTablesCountFromAdmin(newCount) {
  const count = parseInt(newCount) || 20;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  config.tablesCount = count;
  setStoredData('config', config);
  
  const settingInput = document.getElementById('setting-tables');
  if (settingInput) settingInput.value = count;

  renderTableQRCardsContainer('admin-qr-grid', count);
}

// -------------------------------------------------------------
// إدارة طاقم العمل والكاشير والكباتن (Staff & Users Management)
// -------------------------------------------------------------
async function loadAdminCaptains() {
  const container = document.getElementById('admin-captains-table-body');
  if (!container) return;

  if (typeof fetchUsersFromSupabase === 'function') {
    await fetchUsersFromSupabase();
  }

  const auth = getAuthConfig();
  const allStaff = [];

  // 1. إضافة الكاشير
  if (auth.cashiers && auth.cashiers.length > 0) {
    auth.cashiers.forEach(c => allStaff.push({ ...c, role: 'cashier' }));
  }

  // 2. إضافة الكباتن
  if (auth.captains && auth.captains.length > 0) {
    auth.captains.forEach(c => allStaff.push({ ...c, role: 'captain' }));
  }

  // 3. إضافة سائقي التوصيل
  if (auth.drivers && auth.drivers.length > 0) {
    auth.drivers.forEach(d => allStaff.push({ ...d, role: 'driver' }));
  }

  if (allStaff.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-500">لا يوجد موظفين مسجلين حالياً</td>
      </tr>
    `;
    return;
  }

  container.innerHTML = allStaff.map(member => {
    const roleBadge = member.role === 'cashier'
      ? `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1 w-fit">💻 كاشير المطعم</span>`
      : (member.role === 'driver'
        ? `<span class="bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1 w-fit">🛵 سائق توصيل</span>`
        : `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1 w-fit">👨‍🍳 كابتن صالة</span>`);

    return `
      <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition">
        <td class="p-3">
          <div class="font-bold text-white text-sm flex items-center gap-2">
            <span>${member.name}</span>
          </div>
        </td>
        <td class="p-3">
          ${roleBadge}
        </td>
        <td class="p-3">
          <span class="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">${member.username || '-'}</span>
        </td>
        <td class="p-3">
          <span class="font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-rose-400 font-bold text-xs">${member.pin}</span>
        </td>
        <td class="p-3">
          <button onclick="handleToggleStaffStatus('${member.id}', '${member.role}')" class="px-3 py-1 rounded-full text-xs font-bold transition ${member.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'}">
            ${member.active ? 'مفعل (نشط) ✅' : 'معطل (موقوف) ❌'}
          </button>
        </td>
        <td class="p-3 text-left">
          <div class="flex items-center gap-1.5 justify-end">
            <button onclick="openEditStaffModal('${member.id}', '${member.role}')" class="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1">
              <span>✏️ تعديل</span>
            </button>
            <button onclick="handleDeleteStaff('${member.id}', '${member.role}')" class="py-1 px-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg text-xs font-bold transition flex items-center gap-1">
              <span>🗑️ حذف</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddStaffModal(defaultRole = 'cashier') {
  document.getElementById('staff-modal-title').textContent = defaultRole === 'driver' 
    ? "🛵 إضافة سائق توصيل جديد" 
    : "إضافة موظف جديد (كاشير / كابتن / سائق)";
  document.getElementById('staff-form-id').value = "";
  document.getElementById('staff-form-role').value = defaultRole;
  document.getElementById('staff-form-name').value = "";
  document.getElementById('staff-form-username').value = "";
  document.getElementById('staff-form-pin').value = "";
  if (typeof populatePrinterSelects === 'function') {
    populatePrinterSelects().then(() => {
      const pSel = document.getElementById('staff-form-printer-id');
      if (pSel) pSel.value = "";
    });
  }
  const modal = document.getElementById('staff-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.classList.remove('hidden');
  }
}

function openAddCaptainModal() {
  openAddStaffModal();
}

function openEditStaffModal(id, role = 'captain') {
  const auth = getAuthConfig();
  let member = null;

  if (role === 'cashier' && auth.cashiers) {
    member = auth.cashiers.find(x => x.id === id);
  } else if (role === 'driver' && auth.drivers) {
    member = auth.drivers.find(x => x.id === id);
  } else if (auth.captains) {
    member = auth.captains.find(x => x.id === id);
  }

  if (!member) return;

  document.getElementById('staff-modal-title').textContent = `تعديل بيانات: ${member.name}`;
  document.getElementById('staff-form-id').value = member.id;
  document.getElementById('staff-form-role').value = member.role || role;
  document.getElementById('staff-form-name').value = member.name;
  document.getElementById('staff-form-username').value = member.username || '';
  document.getElementById('staff-form-pin').value = member.pin;
  if (typeof populatePrinterSelects === 'function') {
    populatePrinterSelects().then(() => {
      const pSel = document.getElementById('staff-form-printer-id');
      if (pSel) pSel.value = member.assigned_printer_id || member.assignedPrinterId || "";
    });
  }
  const modal = document.getElementById('staff-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.classList.remove('hidden');
  }
}

function openEditCaptainModal(id) {
  openEditStaffModal(id, 'captain');
}

function closeStaffModal() {
  const modal = document.getElementById('staff-edit-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
    modal.classList.add('hidden');
  }
}

function closeCaptainModal() {
  closeStaffModal();
}

async function saveStaffFromForm(e) {
  e.preventDefault();
  const id = document.getElementById('staff-form-id').value;
  const role = document.getElementById('staff-form-role').value;
  const name = document.getElementById('staff-form-name').value.trim();
  const username = document.getElementById('staff-form-username').value.trim();
  const pin = document.getElementById('staff-form-pin').value.trim();
  const assigned_printer_id = document.getElementById('staff-form-printer-id')?.value || null;

  if (id) {
    const res = typeof updateStaffUserAsync === 'function'
      ? await updateStaffUserAsync(id, { name, username, pin, role, assigned_printer_id })
      : { success: false, message: 'خطأ في التحديث' };
    if (!res.success) { alert(res.message); return; }
  } else {
    const res = typeof addStaffUserAsync === 'function' 
      ? await addStaffUserAsync(name, username, pin, role, assigned_printer_id) 
      : { success: false, message: 'خطأ في الإضافة' };
    if (!res.success) { alert(res.message); return; }
  }

  closeStaffModal();
  loadAdminCaptains();
  alert("تم حفظ وتحديث بيانات الموظف بنجاح! ✅");
}

function saveCaptainFromForm(e) {
  saveStaffFromForm(e);
}

async function handleToggleStaffStatus(id, role = 'captain') {
  if (typeof toggleStaffUserActiveAsync === 'function') {
    await toggleStaffUserActiveAsync(id, role);
  } else if (typeof toggleCaptainActiveStateAsync === 'function') {
    await toggleCaptainActiveStateAsync(id);
  }
  loadAdminCaptains();
}

function handleToggleCaptainStatus(id) {
  handleToggleStaffStatus(id, 'captain');
}

async function handleDeleteStaff(id, role = 'captain') {
  if (confirm("هل أنت متأكد من حذف هذا الحساب نهائياً من النظام؟")) {
    if (typeof deleteStaffUserAsync === 'function') {
      await deleteStaffUserAsync(id);
    } else if (typeof deleteCaptainAsync === 'function') {
      await deleteCaptainAsync(id);
    }
    loadAdminCaptains();
  }
}

function handleDeleteCaptain(id) {
  handleDeleteStaff(id, 'captain');
}

async function handleUpdateAdminPin(e) {
  e.preventDefault();
  const newPinInput = document.getElementById('admin-new-pin');
  const newPin = newPinInput ? newPinInput.value.trim() : '';

  const res = typeof changeAdminPinAsync === 'function' ? await changeAdminPinAsync(newPin) : changeAdminPin(newPin);
  if (res.success) {
    alert("تم حفظ وتحديث الرمز السري الجديد بنجاح! ✅");
    if (newPinInput) newPinInput.value = '';
  } else {
    alert(res.message);
  }
}

// -------------------------------------------------------------
// إدارة النسخ الاحتياطي واستيراد/تصدير البيانات (Backup / Restore)
// -------------------------------------------------------------
function triggerDatabaseExport() {
  const res = exportFullDatabaseBackup();
  if (res.success) {
    alert(`✅ تم سحب وتنزيل نسخة احتياطية لمعلومات وهوية المطعم (${res.filename}) بنجاح!\n\nالملف يحتوي على معلومات المطعم فقط بدون أي حسابات للموظفين وبدون المنيو.`);
  }
}

function triggerDatabaseImport() {
  const fileInput = document.getElementById('backup-file-input');
  if (!fileInput || !fileInput.files[0]) {
    alert("يرجى اختيار ملف النسخة الاحتياطية (JSON) أولاً!");
    return;
  }

  if (confirm("سيتم استرجاع وتحديث معلومات وهوية المطعم من الملف (دون المساس بالمنيو أو حسابات الموظفين). هل تود المتابعة؟")) {
    importDatabaseBackup(fileInput.files[0], (res) => {
      alert(res.message);
      if (res.success) {
        location.reload();
      }
    });
  }
}

// -------------------------------------------------------------
// إدارة الطلبات وشاشة المطبخ (Orders & Kitchen Screen)
// -------------------------------------------------------------
function loadAdminOrders(filterStatus = 'active') {
  const ordersListEl = document.getElementById('admin-orders-list');
  const emptyEl = document.getElementById('admin-orders-empty');
  if (!ordersListEl) return;

  const orders = getStoredData('orders', []);
  const now = Date.now();
  
  // تحديث تمييز أزرار الفلترة في شاشة المطبخ إن وجدت
  ['active', 'completed', 'all', 'new'].forEach(f => {
    const btn = document.getElementById(`admin-orders-tab-${f}`);
    if (btn) {
      if (f === filterStatus) {
        btn.className = "text-xs bg-rose-600/30 text-rose-400 border border-rose-500/40 px-3 py-1.5 rounded-lg font-bold shadow-sm";
      } else {
        btn.className = "text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-bold";
      }
    }
  });

  let filtered = orders;
  if (filterStatus === 'active') {
    filtered = orders.filter(o => {
      if (!o || o.status === 'completed' || o.status === 'cancelled') return false;
      const oTime = new Date(o.timestamp || 0).getTime();
      if (oTime && (now - oTime) > 24 * 60 * 60 * 1000) return false;
      return true;
    });
  } else if (filterStatus === 'completed') {
    filtered = orders.filter(o => {
      if (!o || o.status !== 'completed') return false;
      const oTime = new Date(o.timestamp || 0).getTime();
      if (oTime && (now - oTime) > 48 * 60 * 60 * 1000) return false;
      return true;
    });
  } else if (filterStatus === 'new') {
    filtered = orders.filter(o => o && (o.status === 'new' || o.status === 'pending_kitchen' || o.status === 'pending_cashier'));
  } else if (filterStatus !== 'all') {
    filtered = orders.filter(o => o && o.status === filterStatus);
  }

  if (filtered.length === 0) {
    ordersListEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  let html = '';
  filtered.forEach(order => {
    const isDineIn = order.type === 'dine-in';
    const statusBadge = getOrderStatusBadge(order.status);
    const dateFormatted = new Date(order.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    let itemsRows = '';
    order.items.forEach(item => {
      itemsRows += `
        <div class="flex justify-between items-center py-1 border-b border-slate-700/40 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded text-[11px]">x${item.quantity}</span>
            <span class="font-bold text-slate-100">${item.name}</span>
          </div>
          <span class="text-slate-400">${(item.price * item.quantity).toLocaleString()} ${order.currency || 'د.ع'}</span>
        </div>
      `;
    });

    html += `
      <div class="glass-card rounded-2xl p-4 border border-slate-700/60 relative flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-mono text-slate-400">#${order.id}</span>
                <span class="text-[11px] text-slate-400">🕒 ${dateFormatted}</span>
              </div>
              <div class="text-base font-black text-white mt-0.5 flex items-center gap-1.5">
                ${isDineIn ? `🍽️ <span class="text-rose-400">طاولة رقم ${order.tableNumber}</span>` : `🛵 <span class="text-amber-400">طلب خارجي</span>`}
              </div>
              ${order.captainName ? `<div class="text-[11px] text-amber-300 font-bold">👨‍🍳 الكابتن: ${order.captainName}</div>` : ''}
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>

          <div class="space-y-1 mb-3">
            ${itemsRows}
          </div>

          ${order.notes ? `
            <div class="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 mb-3">
              📝 <b>ملاحظة:</b> ${order.notes}
            </div>
          ` : ''}
        </div>

        <div>
          <div class="flex justify-between items-center pt-2 border-t border-slate-800 mb-3">
            <span class="text-slate-400 text-xs">المجموع:</span>
            <span class="text-base font-black text-rose-400">${order.total.toLocaleString()} ${order.currency || 'د.ع'}</span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 mb-2">
            <button onclick="printOrderDirectById('${order.id}', 'kitchen')" class="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95" title="طباعة بون المطبخ (101)">
              <span>👨‍🍳 للمطبخ (101)</span>
            </button>
            <button onclick="printOrderDirectById('${order.id}', 'customer')" class="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95" title="طباعة فاتورة الحساب (100)">
              <span>🧾 للحساب (100)</span>
            </button>
          </div>

          <div>
            ${(order.status === 'new' || order.status === 'pending_kitchen') ? `
              <button onclick="updateOrderStatus('${order.id}', 'preparing')" class="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 px-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                <span>👨‍🍳 تحضير</span>
              </button>
            ` : (order.status === 'preparing' || order.status === 'in_kitchen') ? `
              <button onclick="updateOrderStatus('${order.id}', 'completed')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95">
                <span>✅ تم التجهيز</span>
              </button>
            ` : `
              <button onclick="reopenOrderToCashier('${order.id}')" class="w-full bg-slate-800 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95" title="إرجاع الطلب إلى الطلبات الجارية للكاشير كطلب قيد التحضير">
                <span>🔄 إرجاع للكاشير (قيد التحضير)</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  });

  ordersListEl.innerHTML = html;
}

function getOrderStatusBadge(status) {
  switch (status) {
    case 'new':
    case 'pending_kitchen':
      return `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse">جديد 🔥</span>`;
    case 'preparing':
    case 'in_kitchen':
      return `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] font-black px-2 py-0.5 rounded-full">قيد التحضير ⏳</span>`;
    case 'pending_cashier':
      return `<span class="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[11px] font-black px-2 py-0.5 rounded-full">بانتظار الكاشير ⏳</span>`;
    case 'completed':
      return `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black px-2 py-0.5 rounded-full">منجز بالمطبخ ✅</span>`;
    case 'cancelled':
      return `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[11px] font-black px-2 py-0.5 rounded-full">ملغي ❌</span>`;
    default:
      return `<span class="bg-slate-700 text-slate-300 text-[11px] px-2 py-0.5 rounded-full">${status}</span>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = newStatus;
    setStoredData('orders', orders);
    loadAdminOrders();
    window.dispatchEvent(new Event('storage'));

    const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
    const client = (typeof getSupabase === 'function') ? getSupabase() : null;

    // مطابقة الحالة بدقة مع قيد جدول restaurant_orders_status_check في Supabase
    let dbStatus = newStatus;
    if (newStatus === 'new' || newStatus === 'pending') dbStatus = 'pending_kitchen';
    if (newStatus === 'preparing') dbStatus = 'in_kitchen';
    if (newStatus === 'ready' || newStatus === 'delivered') dbStatus = 'served';
    if (newStatus === 'completed') dbStatus = 'completed';
    if (newStatus === 'cancelled') dbStatus = 'cancelled';
    if (newStatus === 'pending_cashier') dbStatus = 'pending_cashier';

    // مزامنة حالة الطلب في Supabase
    if (client) {
      try {
        await client.from('restaurant_orders').update({
          status: dbStatus,
          updated_at: new Date().toISOString()
        }).eq('id', String(orderId));
      } catch (e) {
        console.warn("Supabase updateOrderStatus error:", e);
      }
    }

    // بث التحديث عبر القنوات المحلية والسحابية
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('smart_emenu_channel');
        bc.postMessage({ 
          type: 'ORDERS_CHANGED', 
          orderId: orderId, 
          status: newStatus 
        });
        bc.close();
      }
    } catch (e) {}

    if (client) {
      try {
        const ch = client.channel(`orders_channel_${restId}`);
        ch.send({
          type: 'broadcast',
          event: 'table_order_update',
          payload: { orderId: orderId, status: newStatus }
        });
      } catch (e) {}
    }
  }
}
window.updateOrderStatus = updateOrderStatus;

async function reopenOrderToCashier(orderId) {
  if (!confirm("هل أنت متأكد من إرجاع هذا الطلب للكاشير ليعود كطلب قيد التحضير واستبعاده من الحسابات؟")) {
    return;
  }

  let orders = getStoredData('orders', []);
  let archive = getStoredData('accounting_archive', []);

  // البحث في الطلبات النشطة، وإن لم يُعثر عليه نبحث في الأرشيف المحاسبي
  let targetOrder = orders.find(o => String(o.id) === String(orderId));
  if (!targetOrder) {
    targetOrder = archive.find(o => o && String(o.id) === String(orderId));
    if (targetOrder) {
      targetOrder = JSON.parse(JSON.stringify(targetOrder));
    }
  }

  if (!targetOrder) {
    alert("لم يتم العثور على الطلب في السجلات!");
    return;
  }

  // تحويل الحالة إلى in_kitchen (كطلب قيد التحضير مع استبعاده تماماً من الحسابات)
  targetOrder.status = 'in_kitchen';
  delete targetOrder.paidAt;
  delete targetOrder.completedAt;

  // إدراج الطلب أو تحديثه في مصفوفة الطلبات الجارية
  const existingOrdersIdx = orders.findIndex(o => String(o.id) === String(orderId));
  if (existingOrdersIdx !== -1) {
    orders[existingOrdersIdx] = targetOrder;
  } else {
    orders.unshift(targetOrder);
  }
  setStoredData('orders', orders);

  // حذفه نهائياً من الأرشيف المحاسبي لضمان عدم احتسابه في الإيرادات والمبيعات
  archive = archive.filter(o => o && String(o.id) !== String(orderId));
  setStoredData('accounting_archive', archive);

  window.dispatchEvent(new Event('storage'));

  // تحديث الواجهات في لوحة الإدارة فوراً
  loadAdminOrders();
  if (typeof loadAdminAccounting === 'function') loadAdminAccounting();
  if (typeof renderStats === 'function') renderStats();

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
  const client = (typeof getSupabase === 'function') ? getSupabase() : null;

  // مزامنة حالة الطلب في Supabase بحالة in_kitchen المقبولة في check constraint
  if (client) {
    try {
      await client.from('restaurant_orders').update({
        status: 'in_kitchen',
        updated_at: new Date().toISOString()
      }).eq('id', String(orderId));
    } catch (e) {
      console.warn("Supabase reopenOrder error:", e);
    }
  }

  // إرسال إشعار فوري لشاشة الكاشير عبر BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.postMessage({ 
        type: 'ORDER_REOPENED', 
        orderId: orderId,
        tableNumber: targetOrder.tableNumber,
        order: targetOrder
      });
      bc.postMessage({ type: 'ORDERS_CHANGED' });
      bc.close();
    }
  } catch (e) {}

  // إرسال إشعار فوري لشاشة الكاشير عبر Supabase Realtime
  if (client) {
    try {
      const ch = client.channel(`orders_channel_${restId}`);
      await ch.send({
        type: 'broadcast',
        event: 'order_reopened',
        payload: {
          id: orderId,
          tableNumber: targetOrder.tableNumber,
          order: targetOrder
        }
      });
    } catch (e) {}
  }

  const tableInfo = targetOrder.tableNumber ? `لطاولة [ ${targetOrder.tableNumber} ]` : '';
  alert(`✅ تم إرجاع الطلب #${orderId} ${tableInfo} إلى شاشة الكاشير بنجاح!\nالطلب الآن ضمن الطلبات الجارية (قيد التحضير) واستُبعد تماماً من الحسابات المالية.`);
}
window.reopenOrderToCashier = reopenOrderToCashier;

function clearCompletedOrders() {
  if (confirm("هل أنت متأكد من حذف وأرشفة الطلبات المكتملة؟")) {
    const orders = getStoredData('orders', []);
    const active = orders.filter(o => o.status !== 'completed');
    setStoredData('orders', active);
    loadAdminOrders();
  }
}

function printKitchenTicketById(orderId) {
  printOrderDirectById(orderId, 'kitchen');
}

function renderAndPrintKitchenTicket(order) {
  if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'kitchen');
  } else {
    window.print();
  }
}

// -------------------------------------------------------------
// إدارة وتصفية الأقسام والأصناف والأسعار (Dishes & Categories)
// -------------------------------------------------------------
let selectedAdminCategory = 'all';
let adminDishSearchQuery = '';

function setAdminDishCategoryFilter(catId) {
  selectedAdminCategory = catId;
  loadAdminDishes();
}
window.setAdminDishCategoryFilter = setAdminDishCategoryFilter;

function filterAdminDishes() {
  adminDishSearchQuery = document.getElementById('admin-dish-search')?.value?.trim().toLowerCase() || '';
  loadAdminDishes(false); // don't re-render filter buttons to keep focus
}
window.filterAdminDishes = filterAdminDishes;

function renderAdminCategoryFilters() {
  const container = document.getElementById('admin-dish-category-filters');
  if (!container) return;

  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const allFilters = [{ id: 'all', name: 'الكل 🍽️', icon: '' }, ...categories.filter(c => c.id !== 'all')];

  container.innerHTML = allFilters.map(c => {
    const isAct = (selectedAdminCategory === c.id);
    return `
      <button type="button" onclick="setAdminDishCategoryFilter('${c.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 whitespace-nowrap flex-shrink-0 active:scale-95 ${
        isAct 
          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' 
          : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
      }">
        <span>${c.icon || ''}</span>
        <span>${c.name}</span>
      </button>
    `;
  }).join('');
}

function setDishPricingType(type) {
  const isWeight = (type === 'weight');
  const rUnit = document.getElementById('dish-pricing-unit');
  const rWeight = document.getElementById('dish-pricing-weight');
  const hiddenW = document.getElementById('dish-form-is-weighted');
  const priceLabel = document.getElementById('dish-form-price-label');
  const weightHint = document.getElementById('dish-weight-pricing-hint');

  if (rUnit) rUnit.checked = !isWeight;
  if (rWeight) rWeight.checked = isWeight;
  if (hiddenW) hiddenW.value = isWeight ? 'true' : 'false';

  if (priceLabel) {
    priceLabel.innerHTML = isWeight ? '⚖️ سعر الكيلوغرام الواحد (د.ع / كغم) *' : 'السعر الحالي للوجبة (د.ع) *';
  }
  if (weightHint) {
    weightHint.style.display = isWeight ? 'block' : 'none';
  }
}
window.setDishPricingType = setDishPricingType;

function onDishWeightedToggle() {
  const isW = !!(document.getElementById('dish-pricing-weight')?.checked || document.getElementById('dish-form-is-weighted')?.value === 'true' || document.getElementById('dish-form-is-weighted')?.checked);
  setDishPricingType(isW ? 'weight' : 'unit');
}
window.onDishWeightedToggle = onDishWeightedToggle;

function loadAdminDishes(updateFilters = true) {
  const tableBody = document.getElementById('admin-dishes-table-body');
  if (!tableBody) return;

  if (updateFilters) {
    renderAdminCategoryFilters();
  }

  let dishes = getStoredData('dishes', DEFAULT_DISHES);
  dishes = dishes.filter(d => d.id && d.id !== 'undefined' && d.id !== 'null');

  // تصفية حسب القسم المختار
  if (selectedAdminCategory && selectedAdminCategory !== 'all') {
    dishes = dishes.filter(d => d.categoryId === selectedAdminCategory);
  }

  // تصفية حسب البحث
  if (adminDishSearchQuery) {
    dishes = dishes.filter(d => 
      (d.name && d.name.toLowerCase().includes(adminDishSearchQuery)) ||
      (d.nameEn && d.nameEn.toLowerCase().includes(adminDishSearchQuery)) ||
      (d.ingredients && d.ingredients.toLowerCase().includes(adminDishSearchQuery))
    );
  }

  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (dishes.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          <div class="text-3xl mb-2">🍽️</div>
          <p class="text-xs">لا توجد أطباق مطابقة للقسم أو البحث الحالي</p>
          <button onclick="openAddDishModal()" class="mt-3 py-1.5 px-3 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition">
            + إضافة طبق لهذا القسم
          </button>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  dishes.forEach(dish => {
    const cat = categories.find(c => c.id === dish.categoryId) || { name: dish.categoryId, icon: '🍽️' };
    const hasDiscount = dish.oldPrice && Number(dish.oldPrice) > Number(dish.price);
    const discountPct = hasDiscount ? Math.round(((dish.oldPrice - dish.price) / dish.oldPrice) * 100) : 0;
    const isWeighted = !!(dish.isWeighted || dish.categoryId === 'fish');

    html += `
      <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition text-xs">
        <td class="p-3">
          <img src="${dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" class="w-10 h-10 rounded-xl object-cover border border-slate-700" loading="lazy" />
        </td>
        <td class="p-3">
          <div class="font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span>${dish.name}</span>
            ${isWeighted ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">⚖️ سعر الكيلو</span>` : ''}
            ${hasDiscount ? `<span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">خصم ${discountPct}% 🔥</span>` : ''}
          </div>
          <div class="text-[10px] text-slate-400">${dish.nameEn || ''}</div>
        </td>
        <td class="p-3">
          <span class="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1 inline-flex">
            <span>${cat.icon || '🍽️'}</span>
            <span>${cat.name}</span>
          </span>
        </td>
        <td class="p-3">
          <div class="flex flex-col">
            <span class="font-black ${isWeighted ? 'text-blue-400' : 'text-rose-400'}">
              ${Number(dish.price).toLocaleString()} ${config.currency} ${isWeighted ? '<span class="text-[10px] text-slate-400">/ كغم</span>' : ''}
            </span>
            ${hasDiscount ? `
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-500 line-through font-mono">${Number(dish.oldPrice).toLocaleString()}</span>
              </div>
            ` : ''}
          </div>
        </td>
        <td class="p-3">
          <button onclick="toggleDishAvailability('${dish.id}')" class="px-2 py-0.5 rounded-full text-[11px] font-bold transition ${dish.available ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
            ${dish.available ? 'متوفر ✅' : 'نفذ ❌'}
          </button>
        </td>
        <td class="p-3 text-left">
          <div class="flex items-center gap-1.5 justify-end">
            <button onclick="editDishModal('${dish.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition" title="تعديل الصنف والوزن والسعر">
              ✏️
            </button>
            <button onclick="deleteDish('${dish.id}')" class="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg text-xs transition" title="حذف">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

function toggleDishAvailability(dishId) {
  let dishes = getStoredData('dishes', DEFAULT_DISHES);
  const idx = dishes.findIndex(d => String(d.id) === String(dishId));
  if (idx !== -1) {
    dishes[idx].available = !dishes[idx].available;
    setStoredData('dishes', dishes);
    window._lastDishSaveTime = Date.now();
    loadAdminDishes();
    window.dispatchEvent(new Event('storage'));

    // مزامنة فورية مع سحابة Supabase لتحديث حالة التوفر بدون كسر قيود الأعمدة
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

function deleteDish(dishId) {
  if (confirm("هل أنت متأكد من حذف هذا الصنف من المنيو؟")) {
    let dishes = getStoredData('dishes', DEFAULT_DISHES);
    dishes = dishes.filter(d => String(d.id) !== String(dishId));
    setStoredData('dishes', dishes);
    loadAdminDishes();
    window.dispatchEvent(new Event('storage'));

    // الحذف من سحابة Supabase
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

function openAddDishModal() {
  const title = document.getElementById('dish-modal-title');
  if (title) title.textContent = "إضافة صنف جديد للمنيو";
  const form = document.getElementById('dish-form');
  if (form) form.reset();
  const idInput = document.getElementById('dish-form-id');
  if (idInput) idInput.value = "";
  
  const defaultCat = (selectedAdminCategory && selectedAdminCategory !== 'all') ? selectedAdminCategory : 'fish';
  populateCategorySelect(defaultCat);
  updateDishImagePreview('', 'dish-form-preview-img');

  if (typeof populatePrinterSelects === 'function') {
    populatePrinterSelects().then(() => {
      const pSel = document.getElementById('dish-form-printer-id');
      if (pSel) pSel.value = "";
    });
  }

  const isWeightedEl = document.getElementById('dish-form-is-weighted');
  if (isWeightedEl) {
    isWeightedEl.checked = (defaultCat === 'fish');
  }
  if (typeof setDishPricingType === 'function') { setDishPricingType(dish.isWeighted ? 'weight' : 'unit'); } else if (typeof onDishWeightedToggle === 'function') onDishWeightedToggle();

  const modal = document.getElementById('dish-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.classList.remove('hidden');
  }
}

function closeDishModal() {
  const modal = document.getElementById('dish-edit-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function editDishModal(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish) {
    alert("لم يتم العثور على بيانات الصنف!");
    return;
  }

  const title = document.getElementById('dish-modal-title');
  if (title) title.textContent = "تعديل بيانات الصنف: " + dish.name;
  
  populateCategorySelect(dish.categoryId);
  
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
  setVal('dish-form-calories', dish.calories);
  setVal('dish-form-ingredients', dish.ingredients);
  setVal('dish-form-desc', dish.description);
  setVal('dish-form-image', dish.image);

  if (typeof populatePrinterSelects === 'function') {
    populatePrinterSelects().then(() => {
      setVal('dish-form-printer-id', dish.assigned_printer_id || dish.assignedPrinterId || '');
    });
  }

  updateDishImagePreview(dish.image, 'dish-form-preview-img');

  const isWeightedEl = document.getElementById('dish-form-is-weighted');
  if (isWeightedEl) {
    isWeightedEl.checked = !!(dish.isWeighted || dish.categoryId === 'fish');
  }
  if (typeof setDishPricingType === 'function') { setDishPricingType(dish.isWeighted ? 'weight' : 'unit'); } else if (typeof onDishWeightedToggle === 'function') onDishWeightedToggle();

  setCheck('dish-form-free-delivery', dish.freeDelivery);
  setCheck('dish-form-popular', dish.isPopular);
  setCheck('dish-form-spicy', dish.isSpicy);
  setCheck('dish-form-veg', dish.isVeg);
  setCheck('dish-form-new', dish.isNew);

  const modal = document.getElementById('dish-edit-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.classList.remove('hidden');
  }
}

function updateDishImagePreview(url, previewImgId) {
  const imgEl = document.getElementById(previewImgId);
  if (!imgEl) return;
  if (url && url.trim()) {
    imgEl.src = url.trim();
    imgEl.classList.remove('hidden');
  } else {
    imgEl.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// مزامنة فواتير ومبيعات المحاسبة سحابياً من Supabase مع حفظ ثابت ومستمر
// -------------------------------------------------------------
async function syncAdminOrdersFromSupabase(isManual = false) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client || !restId) return;

  try {
    // 1. جلب كافة العمليات السابقة للأرشيف المحاسبي والتقارير المالية
    const { data: allData, error } = await client
      .from('restaurant_orders')
      .select('*')
      .eq('restaurant_id', restId)
      .order('created_at', { ascending: false });

    // 2. جلب الطلبات النشطة فقط مباشرة من سوبابيس (استبعاد المكتمل والملغي سحابياً)
    const { data: activeCloudData } = await client
      .from('restaurant_orders')
      .select('*')
      .eq('restaurant_id', restId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100);

    const mapDbOrder = (dbOrder) => {
      let items = [];
      try {
        items = typeof dbOrder.items === 'string' ? JSON.parse(dbOrder.items) : (dbOrder.items || []);
      } catch(e) { items = []; }

      return {
        id: dbOrder.id,
        restaurant_id: dbOrder.restaurant_id,
        type: dbOrder.type || 'dine-in',
        tableNumber: dbOrder.table_number,
        customerName: dbOrder.customer_name || '',
        customerPhone: dbOrder.customer_phone || '',
        customerAddress: dbOrder.customer_address || '',
        items: items,
        notes: dbOrder.notes || '',
        total: parseFloat(dbOrder.total) || 0,
        currency: dbOrder.currency || 'د.ع',
        status: dbOrder.status || 'pending_kitchen',
        source: dbOrder.source || 'online_menu',
        timestamp: dbOrder.created_at || new Date().toISOString()
      };
    };

    if (!error && Array.isArray(allData)) {
      const mappedAll = allData.map(mapDbOrder);

      // تثبيت الأرشيف المحاسبي الدائم
      const currentArchive = getStoredData('accounting_archive', []);
      const archiveMap = new Map();
      currentArchive.forEach(o => { if (o && o.id) archiveMap.set(String(o.id), o); });
      mappedAll.forEach(o => { if (o && o.id) archiveMap.set(String(o.id), o); });

      const allMerged = Array.from(archiveMap.values());
      allMerged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setStoredData('accounting_archive', allMerged);

      // تحديث قائمة الطلبات الجارية الحالية النشطة فقط
      const now = Date.now();
      const mappedActiveCloud = Array.isArray(activeCloudData) ? activeCloudData.map(mapDbOrder) : [];
      
      const ordersMap = new Map();
      // إضافة الطلبات المحلية غير المنتهية والتي لم تتجاوز 24 ساعة
      const currentOrders = getStoredData('orders', []);
      currentOrders.forEach(o => {
        if (o && o.id && o.status !== 'completed' && o.status !== 'cancelled') {
          const oTime = new Date(o.timestamp || 0).getTime();
          if (!oTime || (now - oTime) <= 24 * 60 * 60 * 1000) {
            ordersMap.set(String(o.id), o);
          }
        }
      });
      // دمج الطلبات النشطة السحابية
      mappedActiveCloud.forEach(o => {
        if (o && o.id && o.status !== 'completed' && o.status !== 'cancelled') {
          const oTime = new Date(o.timestamp || 0).getTime();
          if (!oTime || (now - oTime) <= 24 * 60 * 60 * 1000) {
            ordersMap.set(String(o.id), o);
          }
        }
      });

      const activeOnly = Array.from(ordersMap.values());
      activeOnly.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setStoredData('orders', activeOnly);

      if (typeof loadAdminAccounting === 'function') loadAdminAccounting();
      if (typeof loadAdminOrders === 'function') loadAdminOrders();
      if (typeof renderStats === 'function') renderStats();

      if (isManual) {
        alert(`تمت مزامنة وتثبيت ${mappedAll.length} فاتورة وطلب سحابياً بنجاح! ☁️✅`);
      }
    } else if (error && isManual) {
      alert("تعذر جلب الفواتير من السحابة: " + error.message);
    }
  } catch (err) {
    console.warn("Supabase orders sync exception:", err);
    if (isManual) alert("خطأ في الاتصال بالسحابة: " + err.message);
  }
}
window.syncAdminOrdersFromSupabase = syncAdminOrdersFromSupabase;

// تشغيل المزامنة فورياً والاشتراك في التحديثات السحابية
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    syncAdminOrdersFromSupabase(false);
    if (typeof checkSupabaseStorageUsage === 'function') checkSupabaseStorageUsage(false);
  }, 1000);
});

// -------------------------------------------------------------
// تصفير الحسابات والبدء من جديد مع التأكيد المزدوج وحفظ نسخة احتياطية
// -------------------------------------------------------------
async function confirmResetAllAccounts() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

  // 1. طلب رمز PIN المدير للتأكيد
  const enteredPin = prompt("⚠️ تنبيه أمني لتصفير الحسابات والبدء من جديد:\nسيتم مسح وتصفير كافة طلبات وفواتير الصندوق وإعادة تصفير الإيرادات اليومية لبدء وردية عمل جديدة.\n\nالخطوة 1 من 2: أدخل رمز PIN الخاص بالمدير لتأكيد الصلاحية:");
  if (!enteredPin) return;

  const validPin = config.adminPin || '';
  if (enteredPin !== validPin && enteredPin !== '') {
    alert("❌ رمز PIN غير صحيح! تم إلغاء عملية التصفير لحماية بيانات المطعم.");
    return;
  }

  // 2. تأكيد كتابي نهائي لمنع الضغط بالخطأ
  const confirmWord = prompt("⚠️ تأكيد نهائي:\n\nالخطوة 2 من 2: اكتب كلمة (تصفير) في المربع أدناه لإتمام المسح وبدء الوردية الجديدة:");
  if (confirmWord !== 'تصفير') {
    if (confirmWord !== null) alert("تم إلغاء عملية التصفير.");
    return;
  }

  // 3. أرشفة نسخة احتياطية محلية تلقائية قبل المسح
  try {
    const currentOrders = getStoredData('orders', []);
    const backupKey = `smart_emenu_${restId}_orders_backup_${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(currentOrders));
  } catch (e) {}

  // 4. تصفير الذاكرة المحلية والأرشيف
  setStoredData('orders', []);
  setStoredData('accounting_archive', []);
  window.dispatchEvent(new Event('storage'));

  // 5. تصفير أو أرشفة في Supabase
  try {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (client) {
      await client.from('restaurant_orders').delete().eq('restaurant_id', restId);
    }
    const sbUrl = (typeof getActiveSupabaseUrl === 'function') ? getActiveSupabaseUrl() : DEFAULT_SUPABASE_URL;
    const sbKey = (typeof getActiveSupabaseAnonKey === 'function') ? getActiveSupabaseAnonKey() : DEFAULT_SUPABASE_ANON_KEY;
    await fetch(`${sbUrl}/rest/v1/restaurant_orders?restaurant_id=eq.${encodeURIComponent(restId)}`, {
      method: 'DELETE',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`
      }
    });
  } catch (err) {
    console.warn("Supabase orders reset error:", err);
  }

  // 6. إشعار جميع الشاشات (الكاشير، الكابتن، المدير)
  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ type: 'ORDERS_CHANGED' });
    }
  } catch (e) {}

  // 7. تحديث الواجهات
  if (typeof loadAdminAccounting === 'function') loadAdminAccounting();
  if (typeof loadAdminOrders === 'function') loadAdminOrders();
  if (typeof renderStats === 'function') renderStats();
  if (typeof checkSupabaseStorageUsage === 'function') checkSupabaseStorageUsage(false);

  alert("✅ تم تصفير كافة الحسابات والطلبات بنجاح!\nالنظام الآن نظيف 100% وجاهز لبدء وردية عمل جديدة.");
}
window.confirmResetAllAccounts = confirmResetAllAccounts;

// -------------------------------------------------------------
// فحص وعرض مساحة وسعة قاعدة بيانات سوبابيس (Supabase Storage Monitor)
// -------------------------------------------------------------
async function checkSupabaseStorageUsage(isManual = false) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';
  const badge = document.getElementById('supabase-status-badge');

  if (!client) {
    if (badge) {
      badge.className = 'badge bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px]';
      badge.innerHTML = '⚠️ جاري الاتصال...';
    }
    return;
  }

  try {
    // 1. استعلام عدد الطلبات لهذا المطعم في السحابة
    let ordersCount = 0;
    try {
      const { count, error } = await client
        .from('restaurant_orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restId);
      if (!error && typeof count === 'number') {
        ordersCount = count;
      } else {
        const { data } = await client.from('restaurant_orders').select('id').eq('restaurant_id', restId);
        if (Array.isArray(data)) ordersCount = data.length;
      }
    } catch(e) {
      console.warn("Orders count warning:", e);
    }

    // 2. استعلام عدد الوجبات
    let dishesCount = 0;
    try {
      const { count, error } = await client
        .from('restaurant_dishes')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restId);
      if (!error && typeof count === 'number') {
        dishesCount = count;
      } else {
        const localDishes = getStoredData('dishes', []);
        dishesCount = localDishes.length;
      }
    } catch(e) {
      const localDishes = getStoredData('dishes', []);
      dishesCount = localDishes.length;
    }

    // 3. استعلام عدد التصنيفات
    let catsCount = 0;
    try {
      const { count, error } = await client
        .from('restaurant_categories')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restId);
      if (!error && typeof count === 'number') {
        catsCount = count;
      } else {
        const localCats = getStoredData('categories', []);
        catsCount = localCats.length;
      }
    } catch(e) {
      const localCats = getStoredData('categories', []);
      catsCount = localCats.length;
    }

    const totalDishesAndCats = dishesCount + catsCount;

    // 4. الحجم التقديري لقاعدة البيانات:
    // متوسط حجم الطلب الواحد مع قائمة المواد JSON: ~1.5 KB
    // متوسط حجم الصنف مع الصورة والوصف: ~2.0 KB
    // متوسط حجم التصنيفات والإعدادات والروابط: ~250 KB
    const estimatedBytes = 250 * 1024 + (ordersCount * 1536) + (dishesCount * 2048) + (catsCount * 512);
    const kbUsed = (estimatedBytes / 1024).toFixed(1);
    const mbUsed = (estimatedBytes / (1024 * 1024)).toFixed(2);

    // سعة الذاكرة المخصصة لهذا المطعم (50 MB افتراضياً ما لم يحدد السوبر أدمن سعة أعلى)
    const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
    try {
      const { data: restRow } = await client
        .from('restaurants')
        .select('storage_quota_mb')
        .eq('id', restId)
        .single();
      if (restRow && restRow.storage_quota_mb) {
        config.storage_quota_mb = restRow.storage_quota_mb;
        setStoredData('config', config);
      }
    } catch(e) { /* ignore network error, fallback to stored config */ }

    const quotaMb = parseFloat(config.storage_quota_mb) || 50;
    const usagePercent = Math.min(100, Math.max(0.1, ((estimatedBytes / (quotaMb * 1024 * 1024)) * 100))).toFixed(2);

    // فحص شرط التنبيه عند وصول الذاكرة إلى 40 MB أو 80% من السعة
    const isNearFull = (parseFloat(mbUsed) >= 40) || (parseFloat(usagePercent) >= 80);

    // تحديث الواجهة
    const ordersEl = document.getElementById('sb-orders-count');
    if (ordersEl) ordersEl.innerText = `${ordersCount} طلب`;

    const dishesEl = document.getElementById('sb-dishes-count');
    if (dishesEl) dishesEl.innerText = `${totalDishesAndCats} صنف / قسم`;

    const sizeEl = document.getElementById('sb-used-size');
    if (sizeEl) {
      sizeEl.innerText = estimatedBytes > (1024 * 1024) ? `${mbUsed} MB` : `${kbUsed} KB`;
    }

    const quotaEl = document.getElementById('sb-quota-display');
    if (quotaEl) quotaEl.innerText = `${quotaMb} MB`;

    const halfQuotaEl = document.getElementById('sb-half-quota');
    if (halfQuotaEl) halfQuotaEl.innerText = `${Math.round(quotaMb / 2)} MB`;

    const maxQuotaEl = document.getElementById('sb-max-quota');
    if (maxQuotaEl) maxQuotaEl.innerText = `${quotaMb} MB (سعة المطعم)`;

    const percentTextEl = document.getElementById('sb-usage-percent-text');
    if (percentTextEl) {
      percentTextEl.innerText = `${usagePercent}% (${estimatedBytes > (1024 * 1024) ? mbUsed + ' MB' : kbUsed + ' KB'} من ${quotaMb} MB)`;
    }

    const progressBar = document.getElementById('sb-usage-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${Math.max(1, parseFloat(usagePercent))}%`;
      if (isNearFull) {
        progressBar.className = "h-full bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 transition-all duration-500 rounded-full animate-pulse";
      } else {
        progressBar.className = "h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-indigo-600 transition-all duration-500 rounded-full";
      }
    }

    // التحكم في ظهور شريط التنبيه عند بلوغ 40 MB
    const warningBanner = document.getElementById('sb-quota-warning-banner');
    const safetyIndicator = document.getElementById('sb-safety-indicator');
    if (isNearFull) {
      if (warningBanner) warningBanner.classList.remove('hidden');
      if (safetyIndicator) {
        safetyIndicator.className = 'text-[11px] text-rose-400 font-black flex items-center gap-1 animate-pulse';
        safetyIndicator.innerHTML = `<span>⚠️</span><span>تنبيه: اقتربت الذاكرة من الامتلاء (${mbUsed} MB / ${quotaMb} MB)</span>`;
      }
    } else {
      if (warningBanner) warningBanner.classList.add('hidden');
      if (safetyIndicator) {
        safetyIndicator.className = 'text-[11px] text-emerald-400 flex items-center gap-1';
        safetyIndicator.innerHTML = `<span>🛡️</span><span>المساحة المتبقية وفيرة ومحمية</span>`;
      }
    }

    if (badge) {
      if (isNearFull) {
        badge.className = 'badge bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] animate-pulse';
        badge.innerHTML = '⚠️ الذاكرة قاربت الامتلاء';
      } else {
        badge.className = 'badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]';
        badge.innerHTML = '🟢 سحابي متصل ونشط';
      }
    }

    if (isManual) {
      if (isNearFull) {
        alert(`⚠️ تنبيه امتلاء مساحة الذاكرة السحابية للمطعم:\n` +
              `• المساحة المستهلكة: ${mbUsed} MB من أصل ${quotaMb} MB المخصصة (${usagePercent}%)\n` +
              `• إجمالي الطلبات: ${ordersCount} طلب\n\n` +
              `يرجى التواصل مع إدارة النظام لترقية باقة المطعم وتوسيع الذاكرة، أو استخدام زر سلة المهملات لتصفير الحسابات القديمة وبدء وردية جديدة.`);
      } else {
        alert(`📊 تقرير سعة ومساحة سوبابيس (Supabase Cloud):\n` +
              `• إجمالي الطلبات المخزنة: ${ordersCount} طلب\n` +
              `• الأصناف والأقسام: ${totalDishesAndCats}\n` +
              `• المساحة المستهلكة: ${estimatedBytes > (1024 * 1024) ? mbUsed + ' MB' : kbUsed + ' KB'}\n` +
              `• الذاكرة المخصصة لمطعمك: ${quotaMb} MB\n` +
              `• نسبة الاستهلاك: ${usagePercent}%\n` +
              `• الحالة: المساحة وفيرة وآمنة (يتم التنبيه تلقائياً عند بلوغ 40 MB).`);
      }
    }
  } catch (err) {
    console.warn("checkSupabaseStorageUsage exception:", err);
    if (badge) {
      badge.className = 'badge bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px]';
      badge.innerHTML = '🔴 تعذر فحص السحابة';
    }
    if (isManual) alert("تعذر استعلام مساحة سوبابيس: " + err.message);
  }
}
window.checkSupabaseStorageUsage = checkSupabaseStorageUsage;

function populateCategorySelect(selectedId = null) {
  const select = document.getElementById('dish-form-category');
  if (!select) return;
  const categories = getStoredData('categories', DEFAULT_CATEGORIES).filter(c => c.id !== 'all');
  
  select.innerHTML = categories.map(c => `
    <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>
  `).join('');
}

async function saveDishFromForm(event) {
  event.preventDefault();
  const idVal = document.getElementById('dish-form-id')?.value;
  let dishes = getStoredData('dishes', DEFAULT_DISHES);

  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const getCheck = (id) => !!document.getElementById(id)?.checked;
  const oldPriceInput = getVal('dish-form-old-price');

  const catIdSelected = document.getElementById('dish-form-category')?.value || 'grills';
  const priceVal = parseFloat(document.getElementById('dish-form-price')?.value) || 0;
  const isWeightedChecked = !!(document.getElementById('dish-pricing-weight')?.checked || document.getElementById('dish-form-is-weighted')?.value === 'true' || getCheck('dish-form-is-weighted'));
  const assignedPrinterId = getVal('dish-form-printer-id') || null;

  const dishData = {
    name: getVal('dish-form-name'),
    nameEn: getVal('dish-form-name-en'),
    categoryId: catIdSelected,
    price: priceVal,
    unitPrice: isWeightedChecked ? priceVal : undefined,
    isWeighted: isWeightedChecked,
    assigned_printer_id: assignedPrinterId,
    assignedPrinterId: assignedPrinterId,
    oldPrice: (oldPriceInput && parseFloat(oldPriceInput) > 0) ? parseFloat(oldPriceInput) : null,
    calories: getVal('dish-form-calories'),
    ingredients: getVal('dish-form-ingredients'),
    description: getVal('dish-form-desc'),
    image: getVal('dish-form-image') || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
    freeDelivery: getCheck('dish-form-free-delivery'),
    isPopular: getCheck('dish-form-popular'),
    isSpicy: getCheck('dish-form-spicy'),
    isVeg: getCheck('dish-form-veg'),
    isNew: getCheck('dish-form-new'),
    available: true
  };

  if (!dishData.name) {
    alert("يرجى إدخال اسم الصنف!");
    return;
  }

  if (idVal && idVal !== 'undefined') {
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

  // تنظيف أي أصناف معرّفها undefined
  dishes = dishes.filter(d => d.id && d.id !== 'undefined' && d.id !== 'null');

  window._lastDishSaveTime = Date.now();
  setStoredData('dishes', dishes);
  closeDishModal();
  loadAdminDishes();
  window.dispatchEvent(new Event('storage'));

  // المزامنة الفورية مع سحابة Supabase
  await saveDishToSupabase(dishData);

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.postMessage({ type: 'DISH_SAVED', dish: dishData });
      bc.close();
    }
  } catch (e) {}
  alert("تم حفظ وتحديث بيانات الصنف بنجاح ونشرها سحابياً! ✅");
}

// -------------------------------------------------------------
// إعدادات المطعم والطابعة (Restaurant Settings)
// -------------------------------------------------------------
function applyRestaurantPreset(type) {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (type === 'grills') {
    config.name = "مطعم فحمة ودخان";
    config.nameEn = "Fahma & Dokhan Restaurant";
    config.tagline = "أشهى المشاوي والدجاج على الفحم، البركر، الساندويشات الغربية والريزو";
  } else if (type === 'burger') {
    config.name = "مطعم ومطبخ البرجر الملكي";
    config.nameEn = "Royal Burger & Fast Food";
    config.tagline = "برجر مشوي على اللهب، بطاطا مقرمشة، وأشهى الساندويشات";
  } else if (type === 'pizza') {
    config.name = "مطعم بيانو بيتزا وباستا";
    config.nameEn = "Piano Pizza & Italian Food";
    config.tagline = "بيتزا إيطالية على الحطب، باستا طازجة ومقبلات شهية";
  } else if (type === 'cafe') {
    config.name = "كافيه ومقهى الرواق";
    config.nameEn = "Al-Rawaq Specialty Coffee";
    config.tagline = "قهوة مختصة، مشروبات ساخنة وباردة، وحلويات فرنسية فاخرة";
  }

  setStoredData('config', config);
  loadRestaurantSettings();
  alert(`تم تطبيق قالب (${config.name}) بنجاح! يمكنك الآن تعديل القائمة والأسعار بكل سهولة.`);
}

function toggleDineInBadge(checked) {
  const badge = document.getElementById('dinein-status-badge');
  if (badge) {
    if (checked) {
      badge.textContent = "مفعل (يمكن للزبائن الطلب)";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else {
      badge.textContent = "مقفل (المنيو للعرض فقط)";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30";
    }
  }
}

function toggleTakeawayBadge(checked) {
  const badge = document.getElementById('takeaway-pkg-badge');
  if (badge) {
    if (checked) {
      badge.textContent = "الباقة مفعلة ✅";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else {
      badge.textContent = "يتطلب تفعيل الباقة 🔒";
      badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
  }
}

function loadRestaurantSettings() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : '';
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  setVal('setting-name', config.name);
  setVal('setting-name-en', config.nameEn);
  setVal('setting-tagline', config.tagline);
  setVal('setting-published-url', config.publishedUrl || '');
  setVal('setting-currency', config.currency);
  setVal('setting-tables', config.tablesCount);
  setVal('setting-phone', config.phone);
  setVal('setting-phone2', config.phone2 || '');
  setVal('setting-whatsapp', config.whatsappNumber || config.whatsappUrl || '');
  setVal('setting-address', config.address || 'العراق - نينوى - الشيماء');
  setVal('setting-map-url', config.mapUrl || '');
  setVal('setting-store-status', config.storeManualStatus || 'auto');
  setVal('setting-hours', config.workingHours || '10:00 صباحاً - 10:00 بعد منتصف الليل');
  setVal('setting-open-time', config.openTime || '');
  setVal('setting-close-time', config.closeTime || '');
  setCheck('setting-allow-preorder', config.allowPreorderNextDay !== false);
  setVal('setting-holidays', config.holidays || 'مفتوح طوال أيام الأسبوع');
  setVal('setting-wifi-name', config.wifiName || 'Fahma_Dokhan_WiFi');
  setVal('setting-wifi-pass', config.wifiPass || 'fahma2026');

  // سعة الذاكرة السحابية المخصصة (عرض فقط محصورة بالسوبر أدمن)
  const currentQuota = config.storage_quota_mb || 50;
  const quotaBadge = document.getElementById('setting-quota-status-badge');
  if (quotaBadge) quotaBadge.textContent = `${currentQuota} MB`;
  const quotaDisplay = document.getElementById('setting-storage-quota-display');
  if (quotaDisplay) quotaDisplay.textContent = `${currentQuota} MB`;

  // إعدادات الطباعة
  const printSettings = typeof getPrintSettings === 'function' ? getPrintSettings() : { paperSize: '80mm', ticketType: 'dual' };
  setVal('setting-printer-paper', printSettings.paperSize || '80mm');
  setVal('setting-ticket-type', printSettings.ticketType || 'dual');
  setCheck('setting-autoprint', config.autoPrintKitchenTicket !== false);

  const isBasicPlan = (config.planType === 'basic');
  const dineInCheckbox = document.getElementById('setting-allow-dinein');
  const takeawayCheckbox = document.getElementById('setting-takeaway-pkg');

  if (isBasicPlan) {
    config.allowDineInOrders = false;
    config.takeawayPackageActive = false;
    config.allowTakeawayOrders = false;

    if (dineInCheckbox) {
      dineInCheckbox.checked = false;
      dineInCheckbox.disabled = true;
      dineInCheckbox.title = "هذه الميزة غير متاحة في الباقة الأساسية (Basic). يتطلب الترقية من السوبر أدمن.";
    }
    if (takeawayCheckbox) {
      takeawayCheckbox.checked = false;
      takeawayCheckbox.disabled = true;
      takeawayCheckbox.title = "هذه الميزة غير متاحة في الباقة الأساسية (Basic). يتطلب الترقية من السوبر أدمن.";
    }
    const dineInBadge = document.getElementById('dinein-status-badge');
    if (dineInBadge) {
      dineInBadge.textContent = "مقفل (الباقة الأساسية للعرض فقط 🔒)";
      dineInBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
    const takeawayBadge = document.getElementById('takeaway-pkg-badge');
    if (takeawayBadge) {
      takeawayBadge.textContent = "غير مشمول في الباقة الأساسية 🔒";
      takeawayBadge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30";
    }
  } else {
    if (dineInCheckbox) {
      dineInCheckbox.disabled = false;
      dineInCheckbox.checked = !!config.allowDineInOrders;
    }
    if (takeawayCheckbox) {
      takeawayCheckbox.disabled = false;
      takeawayCheckbox.checked = !!config.takeawayPackageActive;
    }
    toggleDineInBadge(config.allowDineInOrders);
    toggleTakeawayBadge(config.takeawayPackageActive);
  }
}

async function saveRestaurantSettings(e) {
  if (e) e.preventDefault();
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  config.name = document.getElementById('setting-name')?.value?.trim() || config.name;
  config.nameEn = document.getElementById('setting-name-en')?.value?.trim() || config.nameEn;
  config.tagline = document.getElementById('setting-tagline')?.value?.trim() || config.tagline;
  config.publishedUrl = document.getElementById('setting-published-url')?.value?.trim() || config.publishedUrl;
  config.currency = document.getElementById('setting-currency')?.value?.trim() || config.currency;
  config.phone = document.getElementById('setting-phone')?.value?.trim() || config.phone;
  config.phone2 = document.getElementById('setting-phone2')?.value?.trim() || '';

  const waVal = document.getElementById('setting-whatsapp')?.value?.trim() || '';
  if (waVal) {
    if (waVal.startsWith('http')) {
      config.whatsappUrl = waVal;
      config.whatsappNumber = waVal.replace(/^.*wa\.me\//, '').replace(/^.*\?phone=/, '');
    } else {
      config.whatsappNumber = waVal;
      const cleanWa = waVal.replace(/\D/g, '').replace(/^0+/, '');
      config.whatsappUrl = `https://wa.me/${cleanWa.startsWith('964') ? cleanWa : '964' + cleanWa}`;
    }
  } else {
    config.whatsappUrl = '';
    config.whatsappNumber = '';
  }

  config.address = document.getElementById('setting-address')?.value?.trim() || config.address;
  config.mapUrl = document.getElementById('setting-map-url')?.value?.trim() || '';
  config.tablesCount = parseInt(document.getElementById('setting-tables')?.value) || 20;

  const statusVal = document.getElementById('setting-store-status')?.value;
  if (statusVal) config.storeManualStatus = statusVal;

  config.workingHours = document.getElementById('setting-hours')?.value?.trim() || config.workingHours;
  config.openTime = document.getElementById('setting-open-time')?.value || config.openTime || '';
  config.closeTime = document.getElementById('setting-close-time')?.value || config.closeTime || '';
  
  const allowPre = document.getElementById('setting-allow-preorder');
  if (allowPre) config.allowPreorderNextDay = allowPre.checked;

  config.holidays = document.getElementById('setting-holidays')?.value?.trim() || config.holidays;
  config.wifiName = document.getElementById('setting-wifi-name')?.value?.trim() || config.wifiName;
  config.wifiPass = document.getElementById('setting-wifi-pass')?.value?.trim() || config.wifiPass;
  
  if (config.planType === 'basic') {
    config.allowDineInOrders = false;
    config.takeawayPackageActive = false;
    config.allowTakeawayOrders = false;
  } else {
    config.allowDineInOrders = !!document.getElementById('setting-allow-dinein')?.checked;
    config.takeawayPackageActive = !!document.getElementById('setting-takeaway-pkg')?.checked;
    config.allowTakeawayOrders = config.takeawayPackageActive;
  }
  
  const autoPrintCheck = document.getElementById('setting-autoprint');
  if (autoPrintCheck) config.autoPrintKitchenTicket = autoPrintCheck.checked;

  // سعة الذاكرة محصورة بالسوبر أدمن ولا يمكن للأدمن تعديلها

  // حفظ إعدادات الطباعة
  const paperSize = document.getElementById('setting-printer-paper')?.value || '80mm';
  const ticketType = document.getElementById('setting-ticket-type')?.value || 'dual';
  if (typeof savePrintSettings === 'function') {
    savePrintSettings({ paperSize, ticketType });
  }

  setStoredData('config', config);

  // إرسال إشعار لتحديث جميع الصفحات المفتوحة في المتصفح فوراً
  window.dispatchEvent(new Event('storage'));

  // مزامنة مع سحابة Supabase إذا توفر العميل
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : DEFAULT_RESTAURANT_ID;
  if (client) {
    try {
      const restPayload = {
        id: restId,
        name: config.name,
        name_en: config.nameEn,
        tagline: config.tagline,
        currency: config.currency,
        tables_count: config.tablesCount,
        phone: config.phone,
        phone2: config.phone2 || '',
        whatsapp_number: config.whatsappNumber || config.phone || '',
        address: config.address,
        maps_url: config.mapUrl || '',
        working_hours: config.workingHours,
        open_time: config.openTime || '10:00',
        close_time: config.closeTime || '00:00',
        holidays: config.holidays,
        wifi_name: config.wifiName,
        wifi_pass: config.wifiPass,
        allow_dinein_orders: !!config.allowDineInOrders,
        allow_takeaway_orders: !!config.allowTakeawayOrders,
        storage_quota_mb: config.storage_quota_mb || 50,
        updated_at: new Date().toISOString()
      };

      const res = await client.from('restaurants').upsert([restPayload], { onConflict: 'id' });
      if (res.error) {
        console.warn("Supabase rest update error:", res.error);
      } else {
        console.log("✅ Restaurant settings synced to Supabase successfully!");
      }

      // مزامنة إعدادات الطابعات إلى جدولها المستقل
      try {
        const ps = (typeof getStoredData === 'function') ? getStoredData('printSettings', {}) : {};
        await client.from('restaurant_printer_settings').upsert([{
          restaurant_id: restId,
          paper_size: paperSize,
          cashier_ip: ps.cashierIp || '192.168.1.100',
          kitchen_ip: ps.kitchenIp || '192.168.1.101',
          auto_print: !!config.autoPrintKitchenTicket,
          updated_at: new Date().toISOString()
        }]);
      } catch(pe) {}
    } catch (err) {
      console.warn("Supabase rest update:", err);
    }
  }
  
  if (typeof renderTableQRCardsContainer === 'function') {
    renderTableQRCardsContainer('admin-qr-grid', config.tablesCount);
  }
  
  alert("تم حفظ وتطبيق كافة الإعدادات بنجاح ومزامنتها على جميع شاشات النظام والسحابة! ✅");
}

async function syncAssignedStorageQuotaFromCloud() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  if (!client) {
    alert("⚠️ تعذر الاتصال بسحابة Supabase!");
    return;
  }
  try {
    const { data, error } = await client
      .from('restaurants')
      .select('storage_quota_mb, name')
      .eq('id', restId)
      .single();
    if (error) throw error;
    if (data && data.storage_quota_mb) {
      const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
      config.storage_quota_mb = Number(data.storage_quota_mb);
      setStoredData('config', config);
      const display = document.getElementById('setting-storage-quota-display');
      if (display) display.textContent = `${data.storage_quota_mb} MB`;
      const badge = document.getElementById('setting-quota-status-badge');
      if (badge) badge.textContent = `${data.storage_quota_mb} MB`;
      if (typeof updateSupabaseStorageStats === 'function') updateSupabaseStorageStats();
      alert(`✅ تمت مزامنة وتحديث سعة التخزين من السوبر أدمن بنجاح: ${data.storage_quota_mb} MB`);
    } else {
      alert("ℹ️ لم يتم العثور على سعة مخصصة مسجلة في السحابة، تم الحفاظ على السعة الافتراضية (50 MB).");
    }
  } catch(e) {
    alert("❌ خطأ أثناء سحب سعة الذاكرة من السحابة: " + e.message);
  }
}
window.syncAssignedStorageQuotaFromCloud = syncAssignedStorageQuotaFromCloud;

// -------------------------------------------------------------
// قسم المحاسبة وتقرير نهاية اليوم (Accounting & End of Day Report)
// -------------------------------------------------------------
let currentAdminAccountingPreset = 'today';
let currentAdminAccountingCustomDate = null;

function filterAdminAccounting(preset) {
  currentAdminAccountingPreset = preset;
  currentAdminAccountingCustomDate = null;

  document.querySelectorAll('.acc-filter-btn').forEach(btn => {
    btn.className = 'acc-filter-btn px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 hover:text-white transition flex items-center gap-1';
  });

  const activeBtn = document.getElementById(`acc-btn-${preset}`);
  if (activeBtn) {
    activeBtn.className = 'acc-filter-btn px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white transition flex items-center gap-1';
  }

  const customInput = document.getElementById('admin-accounting-custom-date');
  if (customInput) customInput.value = '';

  loadAdminAccounting();
}

function filterAdminAccountingByCustomDate(dateVal) {
  if (!dateVal) return;
  currentAdminAccountingCustomDate = dateVal;
  currentAdminAccountingPreset = 'custom';

  document.querySelectorAll('.acc-filter-btn').forEach(btn => {
    btn.className = 'acc-filter-btn px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 hover:text-white transition flex items-center gap-1';
  });

  const customInput = document.getElementById('admin-accounting-custom-date');
  if (customInput) customInput.value = dateVal;

  loadAdminAccounting();
}

function navigateAdminAccountingDay(offset) {
  let baseDate = new Date();
  if (currentAdminAccountingCustomDate) {
    baseDate = new Date(currentAdminAccountingCustomDate);
  } else if (currentAdminAccountingPreset === 'yesterday') {
    baseDate.setDate(baseDate.getDate() - 1);
  }

  baseDate.setDate(baseDate.getDate() + offset);
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
  const dd = String(baseDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}-${mm}-${dd}`;

  filterAdminAccountingByCustomDate(formattedDate);
}

function loadAdminAccounting() {
  const report = getAccountingReport(currentAdminAccountingPreset, currentAdminAccountingCustomDate);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  // تحديث شارة الفترة المعروضة
  const labelEl = document.getElementById('acc-active-period-label');
  if (labelEl) {
    if (currentAdminAccountingPreset === 'today') {
      labelEl.textContent = `اليوم الحالي (${new Date().toLocaleDateString('ar-EG')})`;
    } else if (currentAdminAccountingPreset === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      labelEl.textContent = `يوم أمس (${yDate.toLocaleDateString('ar-EG')})`;
    } else if (currentAdminAccountingPreset === 'week') {
      labelEl.textContent = `آخر 7 أيام`;
    } else if (currentAdminAccountingPreset === 'month') {
      labelEl.textContent = `هذا الشهر`;
    } else if (currentAdminAccountingPreset === 'all') {
      labelEl.textContent = `كامل السجل المحاسبي`;
    } else if (currentAdminAccountingCustomDate) {
      const cDate = new Date(currentAdminAccountingCustomDate);
      labelEl.textContent = `تاريخ مخصص: ${cDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  }

  // 1. تحديث بطاقات الأرقام والمؤشرات
  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('acc-stat-total-revenue', `${report.totalRevenue.toLocaleString()} ${report.currency}`);
  setElText('acc-stat-total-orders', report.totalOrders);
  setElText('acc-stat-dinein-sales', `${report.dineInSales.toLocaleString()} ${report.currency}`);
  setElText('acc-stat-dinein-count', `${report.dineInCount} طلب صالة`);
  setElText('acc-stat-takeaway-sales', `${(report.takeawaySales + report.deliverySales).toLocaleString()} ${report.currency}`);
  setElText('acc-stat-takeaway-count', `${report.takeawayCount + report.deliveryCount} طلب سفري وتوصيل`);

  // حساب مبيعات وعمولات منصة بنان الخاصة بالمطعم
  const bananOrders = (report.orders || []).filter(o => {
    return o.source === 'banan_platform' || o.source === 'platform_menu' || (o.notes && o.notes.includes('بنان'));
  });
  let bananTotalSales = 0;
  let bananTotalComm = 0;
  bananOrders.forEach(o => {
    const t = parseFloat(o.total) || 0;
    bananTotalSales += t;
    let c = 0;
    if (Array.isArray(o.items)) {
      o.items.forEach(it => {
        c += Number(it.itemCommissionTotal || (it.commissionAmount ? it.commissionAmount * (it.quantity || 1) : 0)) || 0;
      });
    }
    if (c === 0) c = Math.round(t * 0.10);
    bananTotalComm += c;
  });
  const bananNet = bananTotalSales - bananTotalComm;
  setElText('acc-stat-banan-sales', `${bananTotalSales.toLocaleString()} ${report.currency}`);
  setElText('acc-stat-banan-net', `${bananNet.toLocaleString()} ${report.currency}`);
  setElText('acc-stat-banan-comm', `${bananTotalComm.toLocaleString()} ${report.currency}`);

  // 2. تحديث جدول الأصناف الأكثر مبيعاً
  const topDishesTable = document.getElementById('acc-top-dishes-table-body');
  const topDishesCount = document.getElementById('acc-top-dishes-count');
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

  // 3. تحديث جدول سجل الفواتير المفصل
  const invoicesTable = document.getElementById('acc-invoices-table-body');
  const invoicesCount = document.getElementById('acc-invoices-count');
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

        const timeStr = order.timestamp ? new Date(order.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '-';

        return `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition">
            <td class="p-2.5">
              <div class="font-bold text-white text-xs">${order.id || 'ORD-000'}</div>
              <div class="text-[10px] text-slate-400 font-mono">${timeStr}</div>
            </td>
            <td class="p-2.5">
              ${typeBadge}
            </td>
            <td class="p-2.5 font-black text-rose-400 text-xs">
              ${(order.total || 0).toLocaleString()} ${report.currency}
            </td>
            <td class="p-2.5 text-left">
              <button onclick="printOrderDirectById('${order.id}')" class="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1">
                <span>🖨️ طباعة</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function printAdminEndOfDayReport() {
  printEndOfDayReportDirect(currentAdminAccountingPreset, currentAdminAccountingCustomDate);
}

function exportAdminReportCSV() {
  exportAccountingReportCSV(currentAdminAccountingPreset, currentAdminAccountingCustomDate);
}

function printOrderDirectById(orderId) {
  const orders = getStoredData('orders', []);
  let order = orders.find(o => String(o.id) === String(orderId));
  if (!order) {
    const archive = getStoredData('accounting_archive', []);
    order = archive.find(o => o && String(o.id) === String(orderId));
  }
  if (order) {
    if (typeof printOrderDirect === 'function') {
      printOrderDirect(order, 'customer');
    } else {
      window.print();
    }
  }
}

// -------------------------------------------------------------
// إدارة ومزامنة أطباق وأقسام المنيو السحابية عبر Supabase (Admin)
// -------------------------------------------------------------
async function syncMenuFromSupabase(isManual = false) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client) {
    if (isManual) alert("تعذر الاتصال السحابي!");
    return;
  }

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
      if (Date.now() - (window._lastDishSaveTime || 0) < 3500 && !isManual) {
        return; // منع الارتداد اللحظي أثناء حفظ وتحديث الصنف محلياً
      }

      const dishes = dishData.map(d => {
        const dishId = isNaN(d.id) ? d.id : Number(d.id);
        const resolvedOldPrice = (d.old_price !== undefined && d.old_price !== null && Number(d.old_price) > 0) ? Number(d.old_price) : null;
        return {
          id: dishId,
          name: d.name,
          nameEn: d.name_en || '',
          categoryId: d.category_id,
          price: Number(d.price) || 0,
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

      // إعادة رسم المنيو في لوحة الإدارة
      if (typeof loadAdminDishes === 'function') loadAdminDishes();
      if (typeof populateCategorySelect === 'function') populateCategorySelect();

      const statusEl = document.getElementById('supabase-menu-status');
      if (statusEl) statusEl.textContent = `(تمت المزامنة: ${dishes.length} طبق سحابي)`;

      if (isManual) {
        alert(`تمت مزامنة وسحب ${dishes.length} طبق سحابياً بنجاح! ☁️✅`);
      }
    } else {
      if (isManual) {
        alert("لم يتم العثور على أطباق سحابية لهذا المطعم، يمكنك رفع المنيو الحالي الآن.");
      }
    }
  } catch (err) {
    console.warn("Admin Supabase menu sync error:", err);
    if (isManual) alert("حدث خطأ أثناء مزامنة المنيو من السحابة: " + err.message);
  }

  // اشتراك Realtime لحظي لأي تحديث سحابي
  if (client && !window._adminMenuRealtimeSubscribed) {
    window._adminMenuRealtimeSubscribed = true;
    try {
      let debounceTimer = null;
      const triggerRealtimeSync = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          syncMenuFromSupabase();
        }, 500);
      };

      client.channel(`public:admin_menu_realtime_${restId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_dishes', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_categories', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .subscribe();
    } catch (e) {
      console.warn("Admin menu realtime error:", e);
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
      console.warn("Supabase admin dish availability update error:", error);
    }
  } catch (e) {
    console.warn("Supabase admin dish availability update error:", e);
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
      old_price: (dish.oldPrice && Number(dish.oldPrice) > 0) ? Number(dish.oldPrice) : null,
      description: dish.description || dish.ingredients || '',
      ingredients: dish.ingredients || '',
      image: dish.image || '',
      calories: cal,
      prep_time: dish.prepTime || 15,
      is_available: dish.available !== false,
      is_featured: !!dish.isPopular,
      assigned_printer_id: dish.assigned_printer_id || dish.assignedPrinterId || null,
      badge: dish.isNew ? 'جديد' : (dish.isPopular ? 'مميز' : ''),
      updated_at: new Date().toISOString()
    };

    let { error } = await client.from('restaurant_dishes').upsert(payload, { onConflict: 'id' });
    if (error && error.message && error.message.includes('old_price')) {
      delete payload.old_price;
      const res = await client.from('restaurant_dishes').upsert(payload, { onConflict: 'id' });
      error = res.error;
    }
    if (error) {
      console.warn("Supabase dish save error:", error);
    }
  } catch (e) {
    console.warn("Supabase dish save error:", e);
  }
}

async function deleteDishFromSupabase(dishId) {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client || !dishId || dishId === 'undefined') return;

  try {
    await client.from('restaurant_dishes').delete().eq('id', String(dishId)).eq('restaurant_id', restId);
  } catch (e) {
    console.warn("Supabase dish delete error:", e);
  }
}

async function uploadAllMenuToSupabaseUI() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (!client) {
    alert("تعذر الاتصال السحابي!");
    return;
  }

  if (!confirm("هل أنت متأكد من رغبتك في رفع كامل قائمة الأطباق والأقسام الحالية إلى السحابة؟")) return;

  try {
    const rawCategories = getStoredData('categories', DEFAULT_CATEGORIES).filter(c => c.id !== 'all');
    const categoriesPayload = rawCategories.map((c, i) => ({
      id: c.id,
      restaurant_id: restId,
      name: c.name,
      name_en: c.nameEn || c.name_en || '',
      icon: c.icon || '🍽️',
      sort_order: i + 1,
      is_active: true
    }));

    // رفع الأقسام
    const { error: catErr } = await client.from('restaurant_categories').upsert(categoriesPayload);
    if (catErr) throw catErr;

    // رفع الأطباق
    const rawDishes = getStoredData('dishes', DEFAULT_DISHES).filter(d => d && d.id && d.id !== 'undefined');
    const dishesPayload = rawDishes.map((d, i) => {
      let cal = 0;
      if (d.calories) {
        const m = String(d.calories).match(/\d+/);
        if (m) cal = parseInt(m[0], 10);
      }
      return {
        id: String(d.id),
        restaurant_id: restId,
        category_id: d.categoryId,
        name: d.name,
        name_en: d.nameEn || '',
        price: Number(d.price) || 0,
        old_price: (d.oldPrice && Number(d.oldPrice) > 0) ? Number(d.oldPrice) : null,
        description: d.description || d.ingredients || '',
        ingredients: d.ingredients || '',
        image: d.image || '',
        calories: cal,
        prep_time: d.prepTime || 15,
        is_available: d.available !== false,
        is_featured: !!d.isPopular,
        badge: d.isNew ? 'جديد' : (d.isPopular ? 'مميز' : ''),
        sort_order: i + 1,
        updated_at: new Date().toISOString()
      };
    });

    let { error: dishErr } = await client.from('restaurant_dishes').upsert(dishesPayload);
    if (dishErr && dishErr.message && dishErr.message.includes('old_price')) {
      const fallbackPayload = dishesPayload.map(item => {
        const copy = { ...item };
        delete copy.old_price;
        return copy;
      });
      const res = await client.from('restaurant_dishes').upsert(fallbackPayload);
      dishErr = res.error;
    }
    if (dishErr) throw dishErr;

    alert(`تم رفع وتحديث المنيو السحابي بنجاح! ☁️✅\nتم رفع (${categoriesPayload.length}) قسم و (${dishesPayload.length}) طبق.`);
    syncMenuFromSupabase();
  } catch (err) {
    alert("حدث خطأ أثناء رفع المنيو للسحابة: " + err.message);
  }
}

function syncMenuFromSupabaseUI() {
  syncMenuFromSupabase(true);
}

/* AUTO_MIGRATED_FISH_DATA_V1 */
(function migrateFishData() {
  try {
    const cats = getStoredData('categories', DEFAULT_CATEGORIES);
    if (!cats.some(c => c.id === 'fish')) {
      const chickenIdx = cats.findIndex(c => c.id === 'chicken');
      const pos = chickenIdx !== -1 ? chickenIdx + 1 : cats.length;
      cats.splice(pos, 0, { id: "fish", name: "الأسماك والمسكوف", nameEn: "Fish & Masgouf", icon: "🐟" });
      setStoredData('categories', cats);
    }
    const currentDishes = getStoredData('dishes', DEFAULT_DISHES);
    const hasFish = currentDishes.some(d => d.categoryId === 'fish');
    if (!hasFish) {
      const newFish = DEFAULT_DISHES.filter(d => d.categoryId === 'fish');
      if (newFish.length > 0) {
        setStoredData('dishes', [...currentDishes, ...newFish]);
      }
    }
  } catch(e) {}
})();

// طباعة كشف حساب وتصفية مبيعات منصة بنان الخاصة بالمطعم (A4 / PDF / وتصدير ومشاركة)
function printBananRestaurantSettlementStatement() {
  const report = getAccountingReport(currentAdminAccountingPreset, currentAdminAccountingCustomDate);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة أو حفظ كشف حساب المنصة بصيغة PDF');
    return;
  }

  // تصفية طلبات منصة بنان الخاصة بالمطعم
  const bananOrders = (report.orders || []).filter(function(o) {
    return o.source === 'banan_platform' || o.source === 'platform_menu' || (o.notes && o.notes.includes('بنان'));
  });

  let totalSales = 0;
  let totalComm = 0;
  let ordersRows = bananOrders.map(function(o, idx) {
    const t = parseFloat(o.total) || 0;
    totalSales += t;
    let c = 0;
    let itemsText = [];
    if (Array.isArray(o.items)) {
      o.items.forEach(function(it) {
        c += Number(it.itemCommissionTotal || (it.commissionAmount ? it.commissionAmount * (it.quantity || 1) : 0)) || 0;
        itemsText.push(it.name + ' (×' + (it.quantity || 1) + ')');
      });
    }
    if (c === 0) c = Math.round(t * 0.10);
    totalComm += c;
    const net = t - c;
    const oDate = o.timestamp ? new Date(o.timestamp).toLocaleDateString('ar-EG') + ' ' + new Date(o.timestamp).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '-';

    return '<tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">' +
      '<td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">' + (idx + 1) + '</td>' +
      '<td style="padding: 6px 8px; font-family: monospace;">' + (o.id || '-') + '</td>' +
      '<td style="padding: 6px 8px;">' + oDate + '</td>' +
      '<td style="padding: 6px 8px;">' + (o.customerName || o.customerInfo || 'عميل منصة بنان') + '</td>' +
      '<td style="padding: 6px 8px; color: #475569;">' + (itemsText.join('، ') || 'وجبات منوعة') + '</td>' +
      '<td style="padding: 6px 8px; font-weight: bold;">' + t.toLocaleString() + ' د.ع</td>' +
      '<td style="padding: 6px 8px; color: #b45309; font-weight: bold;">' + c.toLocaleString() + ' د.ع</td>' +
      '<td style="padding: 6px 8px; color: #047857; font-weight: 900;">' + net.toLocaleString() + ' د.ع</td>' +
    '</tr>';
  }).join('');

  if (!ordersRows) {
    ordersRows = '<tr><td colspan="8" style="padding: 25px; text-align: center; color: #94a3b8; font-size: 12px;">لا توجد مبيعات مسجلة لمنصة بنان في هذه الفترة المحددة</td></tr>';
  }

  const netRestaurant = totalSales - totalComm;
  const restaurantName = config.name || 'مطعم فحمة ودخان';
  const reportPeriod = report.title || 'اليوم';
  const issueDate = new Date().toLocaleString('ar-EG');
  const countOrders = bananOrders.length;

  const htmlDoc = '<!DOCTYPE html>' +
    '<html dir="rtl" lang="ar">' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<title>كشف حساب مبيعات منصة بنان - ' + restaurantName + '</title>' +
      '<style>' +
        '@page { size: A4 portrait; margin: 15mm; }' +
        'body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #0f172a; line-height: 1.5; background: #fff; }' +
        '.action-toolbar { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }' +
        '.action-toolbar button, .action-toolbar a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; border: none; text-decoration: none; transition: 0.2s; }' +
        '.btn-print { background: #ea580c; color: #fff; }' +
        '.btn-print:hover { background: #c2410c; }' +
        '.btn-pdf { background: #0284c7; color: #fff; }' +
        '.btn-pdf:hover { background: #0369a1; }' +
        '.btn-whatsapp { background: #16a34a; color: #fff; }' +
        '.btn-whatsapp:hover { background: #15803d; }' +
        '.header { text-align: center; border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 15px; }' +
        '.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }' +
        '.kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }' +
        '.kpi-title { font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px; }' +
        '.kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; font-family: monospace; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }' +
        'th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #334155; }' +
        'td { border: 1px solid #e2e8f0; text-align: right; }' +
        '.signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 12px; font-weight: bold; }' +
        '.sig-box { width: 220px; text-align: center; }' +
        '.sig-line { margin-top: 35px; border-top: 1px solid #333; padding-top: 5px; }' +
        '@media print { .action-toolbar { display: none !important; } body { padding: 0; } }' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="action-toolbar">' +
        '<div><strong>📄 كشف الحساب المعتمد لمنصة بنان</strong></div>' +
        '<div style="display: flex; gap: 8px;">' +
          '<button class="btn-print" onclick="window.print()">🖨️ طباعة فورية</button>' +
          '<button class="btn-pdf" onclick="saveAsPDF()">📥 حفظ بصيغة PDF</button>' +
          '<a class="btn-whatsapp" id="btnAdminShareWhatsApp" target="_blank">💬 إرسال عبر واتساب</a>' +
        '</div>' +
      '</div>' +

      '<div class="header">' +
        '<h2 style="margin: 0 0 4px 0; color: #ea580c; font-size: 20px;">✨ منصة بنان الرقمية الذكية (Banan Platform)</h2>' +
        '<h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 900;">كشف مبيعات المنصة وتصفية الحصة النهائية من المطعم (مبيعات بنان بالمحصلة)</h3>' +
        '<div style="font-size: 13px;"><strong>🏢 اسم المطعم الشريك:</strong> ' + restaurantName + '</div>' +
        '<div style="font-size: 11px; color: #475569; margin-top: 3px;">' +
          '<strong>📅 فترة الكشف:</strong> ' + reportPeriod + ' &nbsp;|&nbsp; <strong>تاريخ الإصدار:</strong> ' + issueDate +
        '</div>' +
      '</div>' +

      '<div class="kpi-grid">' +
        '<div class="kpi-card">' +
          '<div class="kpi-title">عدد طلبات المنصة للمطعم</div>' +
          '<div class="kpi-val">' + countOrders + ' طلب</div>' +
        '</div>' +
        '<div class="kpi-card">' +
          '<div class="kpi-title">إجمالي طلبات وفواتير المنصة</div>' +
          '<div class="kpi-val">' + totalSales.toLocaleString() + ' د.ع</div>' +
        '</div>' +
        '<div class="kpi-card" style="border-color: #f59e0b; background: #fffbeb; box-shadow: 0 2px 8px rgba(245,158,11,0.2);">' +
          '<div class="kpi-title" style="color: #b45309; font-weight: 900;">⭐ المحصلة (مبيعات وحصة بنان)</div>' +
          '<div class="kpi-val" style="color: #b45309; font-size: 18px;">' + totalComm.toLocaleString() + ' د.ع</div>' +
        '</div>' +
        '<div class="kpi-card" style="border-color: #10b981; background: #ecfdf5;">' +
          '<div class="kpi-title" style="color: #047857;">صافي مستحقات المطعم للتسليم</div>' +
          '<div class="kpi-val" style="color: #047857;">' + netRestaurant.toLocaleString() + ' د.ع</div>' +
        '</div>' +
      '</div>' +

      '<h4 style="margin: 15px 0 6px 0; font-size: 12px; color: #1e293b;">تفاصيل الفواتير والطلبات الصادرة عبر منصة بنان:</h4>' +
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 30px;">#</th>' +
            '<th>رقم الطلب</th>' +
            '<th>التاريخ والوقت</th>' +
            '<th>العميل</th>' +
            '<th>الأصناف المطلوبة</th>' +
            '<th>المبلغ الإجمالي</th>' +
            '<th>حصة ومبيعات بنان</th>' +
            '<th>صافي المطعم</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          ordersRows +
        '</tbody>' +
      '</table>' +

      '<div style="margin-top: 20px; padding: 12px 16px; background: #fffbeb; border: 2px solid #f59e0b; border-radius: 10px; text-align: right;">' +
        '<div style="font-weight: 900; font-size: 13px; color: #b45309; margin-bottom: 6px;">📊 الخلاصة المحاسبية للحصة النهائية (مبيعات بنان بالمحصلة):</div>' +
        '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; flex-wrap: wrap; gap: 8px;">' +
          '<div>إجمالي مبيعات طلبات المنصة للمطعم: <strong>' + totalSales.toLocaleString() + ' د.ع</strong></div>' +
          '<div style="color: #047857;">صافي مستحقات المطعم لتجهيز الوجبات: <strong>' + netRestaurant.toLocaleString() + ' د.ع</strong></div>' +
          '<div style="color: #b45309; font-weight: 900; font-size: 13px;">⭐ المحصلة النهائية المستحقة لمنصة بنان: <strong>' + totalComm.toLocaleString() + ' د.ع</strong></div>' +
        '</div>' +
        '<div style="font-size: 10px; color: #78350f; margin-top: 5px;">* كشف مبيعات المنصة يحدد الحصة النهائية المستحقة لمنصة بنان من المطعم الشريك لقاء مبيعات المنصة المنفذة.</div>' +
      '</div>' +

      '<div class="signatures">' +
        '<div class="sig-box">' +
          '<div>توقيع وختم إدارة المطعم</div>' +
          '<div class="sig-line">................................................</div>' +
        '</div>' +
        '<div class="sig-box">' +
          '<div>توقيع وختم الحسابات - منصة بنان</div>' +
          '<div class="sig-line">................................................</div>' +
        '</div>' +
      '</div>' +

      '<div style="text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8;">' +
        'تم استخراج وتوثيق كشف الحساب آلياً بواسطة المنظومة الذكية لمنصة بنان' +
      '</div>' +

      '<script>' +
        'function saveAsPDF() {' +
          'window.print();' +
        '}' +
        'window.onload = function() {' +
          'const msg = "📄 كشف مبيعات منصة بنان (تصفية الحصة النهائية)\\n🏢 المطعم: ' + restaurantName + '\\n📅 الفترة: ' + reportPeriod + '\\n⭐ المحصلة النهائية (مبيعات وحصة بنان): ' + totalComm.toLocaleString() + ' د.ع\\n💰 إجمالي طلبات المنصة: ' + totalSales.toLocaleString() + ' د.ع\\n🏢 صافي مستحقات المطعم: ' + netRestaurant.toLocaleString() + ' د.ع\\n📦 عدد الطلبات: ' + countOrders + '";' +
          'const waBtn = document.getElementById("btnAdminShareWhatsApp");' +
          'if (waBtn) waBtn.href = "https://wa.me/?text=" + encodeURIComponent(msg);' +
        '};' +
      '</script>' +
    '</body>' +
    '</html>';

  printWin.document.write(htmlDoc);
  printWin.document.close();
}
window.printBananRestaurantSettlementStatement = printBananRestaurantSettlementStatement;

function scrollAdminTabs(offset) {
  const el = document.getElementById('adminMainTabsNav');
  if (el) el.scrollBy({ left: offset, behavior: 'smooth' });
}
window.scrollAdminTabs = scrollAdminTabs;

// تمكين التمرير الأفقي بعجلة الماوس للابتوب وسطح المكتب
window.addEventListener('load', () => {
  document.querySelectorAll('.tab-scroll-container, .overflow-x-auto, .category-scroll').forEach(el => {
    el.addEventListener('wheel', (evt) => {
      if (evt.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        evt.preventDefault();
        el.scrollLeft += evt.deltaY;
      }
    }, { passive: false });
  });
});




// -------------------------------------------------------------
// إدارة الأقسام والتصنيفات (Categories Management)
// -------------------------------------------------------------
function openCategoryManageModal() {
  const modal = document.getElementById('category-manage-modal');
  if (!modal) return;
  renderAdminCategoriesList();
  resetCategoryForm();
  modal.style.display = 'flex';
  modal.style.pointerEvents = 'auto';
  modal.classList.remove('hidden');
}
window.openCategoryManageModal = openCategoryManageModal;

function closeCategoryManageModal() {
  const modal = document.getElementById('category-manage-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}
window.closeCategoryManageModal = closeCategoryManageModal;

function resetCategoryForm() {
  const form = document.getElementById('category-form');
  if (form) form.reset();
  const idEl = document.getElementById('category-form-id');
  if (idEl) idEl.value = '';
  const titleEl = document.getElementById('category-form-title');
  if (titleEl) titleEl.textContent = 'إضافة قسم جديد للمنيو';
  const iconEl = document.getElementById('category-form-icon');
  if (iconEl) iconEl.value = '🍽️';
}
window.resetCategoryForm = resetCategoryForm;

function renderAdminCategoriesList() {
  const container = document.getElementById('admin-categories-list-container');
  if (!container) return;

  const categories = getStoredData('categories', DEFAULT_CATEGORIES).filter(c => c.id !== 'all');
  const dishes = getStoredData('dishes', DEFAULT_DISHES);

  container.innerHTML = categories.map((cat, idx) => {
    const dishCount = dishes.filter(d => d.categoryId === cat.id).length;
    const isFish = cat.id === 'fish';
    const borderCls = isFish ? 'border-blue-700/50' : 'border-slate-800';
    const bgCls = isFish ? 'bg-blue-950/20' : 'bg-slate-900';
    const fishBadge = isFish ? `<span class="text-[9px] text-blue-400 font-mono mr-1">🐟 كيلو/عدد</span>` : '';
    return `
      <div class="${bgCls} flex items-center justify-between p-2.5 rounded-xl border ${borderCls} text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="text-xl w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">${cat.icon || '🍽️'}</span>
          <div class="min-w-0">
            <div class="font-bold text-white truncate">${cat.name} ${fishBadge}</div>
            <div class="text-[10px] text-slate-400 font-mono">${cat.nameEn || cat.id} • ${dishCount} صنف</div>
          </div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button type="button" onclick="moveCategoryUp('${cat.id}')" class="p-1 bg-slate-800 hover:bg-slate-600 text-slate-300 rounded-lg transition text-xs" title="تحريك للأعلى">▲</button>
          <button type="button" onclick="moveCategoryDown('${cat.id}')" class="p-1 bg-slate-800 hover:bg-slate-600 text-slate-300 rounded-lg transition text-xs" title="تحريك للأسفل">▼</button>
          <button type="button" onclick="editCategory('${cat.id}')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition" title="تعديل">✏️</button>
          <button type="button" onclick="deleteCategory('${cat.id}')" class="p-1.5 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded-lg text-xs transition" title="حذف">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}
window.renderAdminCategoriesList = renderAdminCategoriesList;

function editCategory(catId) {
  const categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const cat = categories.find(c => c.id === catId);
  if (!cat) return;

  const idEl = document.getElementById('category-form-id');
  const nameEl = document.getElementById('category-form-name');
  const nameEnEl = document.getElementById('category-form-name-en');
  const iconEl = document.getElementById('category-form-icon');
  const titleEl = document.getElementById('category-form-title');

  if (idEl) idEl.value = cat.id;
  if (nameEl) nameEl.value = cat.name;
  if (nameEnEl) nameEnEl.value = cat.nameEn || '';
  if (iconEl) iconEl.value = cat.icon || '🍽️';
  if (titleEl) titleEl.textContent = 'تعديل القسم: ' + cat.name;
  if (nameEl) nameEl.focus();
}
window.editCategory = editCategory;

function saveCategoryFromForm(event) {
  event.preventDefault();
  const idVal = document.getElementById('category-form-id')?.value?.trim();
  const nameVal = document.getElementById('category-form-name')?.value?.trim();
  const nameEnVal = document.getElementById('category-form-name-en')?.value?.trim() || '';
  const iconVal = document.getElementById('category-form-icon')?.value?.trim() || '🍽️';

  if (!nameVal) {
    alert('يرجى إدخال اسم القسم بالعربي!');
    return;
  }

  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  
  if (idVal) {
    const idx = categories.findIndex(c => c.id === idVal);
    if (idx !== -1) {
      categories[idx].name = nameVal;
      categories[idx].nameEn = nameEnVal;
      categories[idx].icon = iconVal;
    }
  } else {
    const newId = 'cat_' + Date.now();
    categories.push({
      id: newId,
      name: nameVal,
      nameEn: nameEnVal,
      icon: iconVal
    });
  }

  setStoredData('categories', categories);
  resetCategoryForm();
  renderAdminCategoriesList();
  renderAdminCategoryFilters();
  populateCategorySelect();
  loadAdminDishes();
  window.dispatchEvent(new Event('storage'));
  alert('تم حفظ وتحديث القسم بنجاح! ✅');
}
window.saveCategoryFromForm = saveCategoryFromForm;

function deleteCategory(catId) {
  if (catId === 'all') {
    alert('لا يمكن حذف هذا القسم الأساسي!');
    return;
  }
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dishesInCat = dishes.filter(d => d.categoryId === catId);
  if (dishesInCat.length > 0) {
    if (!confirm(`هذا القسم يحتوي على (${dishesInCat.length}) طبق. هل أنت متأكد من حذفه؟`)) {
      return;
    }
  } else {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
  }

  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  categories = categories.filter(c => c.id !== catId);
  setStoredData('categories', categories);

  renderAdminCategoriesList();
  renderAdminCategoryFilters();
  populateCategorySelect();
  loadAdminDishes();
  window.dispatchEvent(new Event('storage'));
}
window.deleteCategory = deleteCategory;

// -------------------------------------------------------------
// 鬲乇鬲賷亘 丕賱兀賯爻丕賲 (Category Reorder)
// -------------------------------------------------------------
function moveCategoryUp(catId) {
  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const idx = categories.findIndex(c => c.id === catId);
  // 賱丕 鬲乇賮毓 兀賯賱 賲賳 賲賵囟毓 1 (丕賱賰賱 丿丕卅賲丕賸 賮賷 0)
  const firstMovable = categories.findIndex(c => c.id !== 'all');
  if (idx <= firstMovable || idx < 1) return;
  const tmp = categories[idx - 1];
  categories[idx - 1] = categories[idx];
  categories[idx] = tmp;
  setStoredData('categories', categories);
  renderAdminCategoriesList();
  renderAdminCategoryFilters();
  populateCategorySelect();
  window.dispatchEvent(new Event('storage'));
}
window.moveCategoryUp = moveCategoryUp;

function moveCategoryDown(catId) {
  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  const idx = categories.findIndex(c => c.id === catId);
  if (idx < 0 || idx >= categories.length - 1) return;
  // 賱丕 鬲丨乇賰 "all" 廿賳 賵購噩丿鬲
  if (categories[idx].id === 'all') return;
  const tmp = categories[idx + 1];
  categories[idx + 1] = categories[idx];
  categories[idx] = tmp;
  setStoredData('categories', categories);
  renderAdminCategoriesList();
  renderAdminCategoryFilters();
  populateCategorySelect();
  window.dispatchEvent(new Event('storage'));
}
window.moveCategoryDown = moveCategoryDown;

// -------------------------------------------------------------
// رفع الأقسام على Supabase فقط
// -------------------------------------------------------------
async function uploadCategoriesToSupabase() {
  const client = typeof getSupabase === 'function' ? getSupabase() : null;
  if (!client) { alert('⚠️ لا يوجد اتصال بقاعدة بيانات Supabase'); return; }
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : (typeof DEFAULT_RESTAURANT_ID !== 'undefined' ? DEFAULT_RESTAURANT_ID : 'fahma_dokhan');
  if (!restId) { alert('⚠️ لم يتم تحديد معرف المطعم'); return; }

  const rawCategories = getStoredData('categories', DEFAULT_CATEGORIES).filter(c => c.id !== 'all');
  if (rawCategories.length === 0) { alert('ℹ️ لا توجد أقسام لرفعها'); return; }

  const payload = rawCategories.map((c, i) => ({
    id: c.id,
    restaurant_id: restId,
    name: c.name,
    name_en: c.nameEn || c.name_en || '',
    icon: c.icon || '🍽️',
    sort_order: i + 1,
    is_active: true
  }));

  try {
    const { error } = await client.from('restaurant_categories').upsert(payload);
    if (error) throw error;
    alert(`✅ تم رفع (${payload.length}) أقسام على Supabase بنجاح! ☁️`);
  } catch (err) {
    alert('❌ خطأ أثناء رفع الأقسام: ' + (err.message || err));
  }
}
window.uploadCategoriesToSupabase = uploadCategoriesToSupabase;