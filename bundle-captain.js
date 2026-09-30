
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
// تحديث نصوص وهوية المطعم في تطبيق الكابتن
// -------------------------------------------------------------
function updateAppBranding() {
  const config = typeof getStoredData === 'function' ? getStoredData('config', DEFAULT_RESTAURANT_CONFIG) : DEFAULT_RESTAURANT_CONFIG;
  document.querySelectorAll('.brand-restaurant-name').forEach(el => el.textContent = config.name);
  document.querySelectorAll('.brand-restaurant-tagline').forEach(el => el.textContent = config.tagline);
  document.querySelectorAll('.brand-currency').forEach(el => el.textContent = config.currency);
  
  const capRestName = document.getElementById('captain-restaurant-name');
  if (capRestName) capRestName.textContent = config.name;

  const logoTarget = (config.logo && config.logo.trim()) ? config.logo.trim() : 'logo.svg';
  document.querySelectorAll('.restaurant-logo-img').forEach(img => {
    if (img.getAttribute('src') !== logoTarget) {
      img.src = logoTarget;
    }
    img.onerror = () => { img.src = 'logo.svg'; img.onerror = null; };
  });
}

// -------------------------------------------------------------
// فحص حالة اشتراك المطعم في Supabase وقفل الموقع عند الإلغاء
// -------------------------------------------------------------
async function checkRestaurantSubscription() {
  const client = getSupabase();
  if (!client) return { active: true };

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

      // 2. إذا كانت باقة المطعم هي الباقة الأساسية (basic) - لا يحق له الدخول للكابتن إطلاقاً
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

  // اشتراك ومزامنة حية لبيانات المطعم في شاشة الكابتن
  if (client && !window._captainRestaurantRealtimeSubscribed) {
    window._captainRestaurantRealtimeSubscribed = true;
    try {
      client.channel('public:restaurants_captain_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
          checkRestaurantSubscription();
        })
        .subscribe();
    } catch(e) {}

    window.addEventListener('focus', () => {
      checkRestaurantSubscription();
    });

    setInterval(() => {
      checkRestaurantSubscription();
    }, 4000);
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
  const titleText = isPlanRestricted ? 'شاشة كابتن الصالة غير متوفرة في باقتك' : 'يرجى تجديد الاشتراك';
  const descText = isPlanRestricted
    ? `عزيزي صاحب المطعم، اشتراكك الحالي هو <b>الباقة الأساسية (Basic - منيو فقط)</b>. شاشة كابتن الصالة والطلبات الفورية واستقبال نداء الطاولات متاحة حصرياً في <b>باقة Pro الاحترافية</b>. للترقية وتفعيل الكابتن فوراً، يرجى التواصل مع الدعم الفني.`
    : `عزيزي صاحب المطعم، لقد تم إيقاف الخدمة مؤقتاً لتجديد الاشتراك أو ترقية الباقات. يرجى التواصل مع مكتب <b>emattec</b> لإعادة التفعيل الفوري.`;
  const btnText = isPlanRestricted ? '👑 ترقية الباقة وتفعيل شاشة الكابتن الآن' : '📞 اتصال فوري لتجديد الاشتراك';

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
          <a href="https://wa.me/964${supportPhone.replace(/^0+/, '')}?text=${encodeURIComponent('مرحباً، أرغب في ترقية باقة المطعم إلى باقة Pro لتفعيل شاشة الكابتن')}" target="_blank" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition">
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

// تشغيل الفحص الدوري للاشتراك وتحديث الهوية في شاشة الكابتن
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
    tagline: "تطبيق كابتن الصالة",
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
      console.log("✅ Captain: All fish dishes migrated to weighted (per_kg) successfully.");
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

  // 3. الفحص المحلي الشامل
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

function logoutSession(redirectUrl = 'login.html?role=captain') {
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
  ticketType: 'kitchen',  // 'kitchen' (طابعة 101) | 'customer' (طابعة 100) - منع الطباعة المزدوجة
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
    `المرسل: ${order.captainName || 'كابتن الصالة'}`
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
  lines.push(`المحاسب: ${order.captainName || 'كابتن الصالة'}`);

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

function showCaptainToast(msg, icon = '✅') {
  let toast = document.getElementById('captain-action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'captain-action-toast';
    toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900 border border-emerald-500/80 text-white font-black text-sm px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 transition-all duration-300 transform -translate-y-12 opacity-0 pointer-events-none ring-4 ring-emerald-500/20';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="text-lg">${icon}</span><span class="text-emerald-300">${msg}</span>`;
  toast.classList.remove('-translate-y-12', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('-translate-y-12', 'opacity-0');
  }, 2500);
}
window.showCaptainToast = showCaptainToast;

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
      ctx.fillText(`الموظف: ${order.captainName}`, 20, y);
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
  // منع الطباعة المزدوجة نهائياً: إما مطبخ 101 أو حساب 100 فقط (افتراضي المطبخ للكابتن)
  let ticketType = overrideTicketType;
  if (!ticketType || ticketType === 'separate' || ticketType === 'both' || ticketType === 'combined') {
    ticketType = (printSettings.ticketType === 'customer') ? 'customer' : 'kitchen';
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
    if (ticketType === 'customer') {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getCustomerTicketHtml(order, config, timeStr, dateStr, typeBadge, currency, isSmallPaper)}</div>`;
    } else {
      ticketEl.innerHTML = `<div class="thermal-dual-container">${getKitchenTicketHtml(order, config, timeStr, dateStr, typeBadge, isSmallPaper)}</div>`;
    }
  }

  // محاولة الطباعة الصامتة عبر وسيط ويندوز المحلي إذا كانت مفعلة (طابعة فردية فقط)
  if (printSettings.silentPrint !== false) {
    const bridgeUrl = printSettings.bridgeUrl || 'http://127.0.0.1:8080';
    try {
      if (ticketType === 'customer') {
        // فاتورة الكاشير فقط (100)
        const cashierRaster = renderTicketToEscPosRaster(order, 'customer', isSmallPaper);
        const cashierText = formatCashierTextTicket(order, config, isSmallPaper);
        const res = await fetch(`${bridgeUrl}/print-cashier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: printSettings.cashierMode || 'ip',
            ip: printSettings.cashierIp || '192.168.1.100',
            port: printSettings.cashierPort || 9100,
            printerName: printSettings.cashierPrinterName,
            text: cashierText,
            rasterBase64: cashierRaster
          })
        }).catch(e => null);
        if (res && res.ok) {
          showSilentPrintToast("تم إرسال فاتورة الحساب فقط (100) 🧾✅");
          return;
        }
      } else {
        // بون المطبخ فقط (101)
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
        if (res && res.ok) {
          showSilentPrintToast("تم إرسال بون المطبخ فقط (101) 👨‍🍳✅");
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
  // منع الطباعة المزدوجة: توجيه تلقائي للمطبخ للكابتن أو الحساب
  printOrderDirect(order, 'kitchen');
}

function renderAndPrintKitchenTicket(order) {
  printOrderDirect(order, 'kitchen');
}

function renderAndPrintCashierTicket(order) {
  printOrderDirect(order, 'customer');
}

function printOrderDirectById(orderId, type = 'kitchen') {
  const orders = getStoredData('orders', []);
  const order = orders.find(o => String(o.id) === String(orderId));
  if (order) {
    printOrderDirect(order, type);
  }
}
window.printOrderDirectById = printOrderDirectById;

function printActiveTableKitchenTicket() {
  if (!currentActiveTableOrder) return;
  printOrderDirect(currentActiveTableOrder, 'kitchen');
}
window.printActiveTableKitchenTicket = printActiveTableKitchenTicket;

function printActiveTableBill() {
  if (!currentActiveTableOrder) return;
  printOrderDirect(currentActiveTableOrder, 'customer');
}
window.printActiveTableBill = printActiveTableBill;

// -------------------------------------------------------------
// نافذة إعدادات الطابعات والطباعة الصامتة (100 كاشير + 101 مطبخ)
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
              <p class="text-xs text-slate-400">تخصيص طابعة 1 (الكاشير 100) وطابعة 2 (المطبخ 101)</p>
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
        </div>

        <!-- زر الحفظ النهائي -->
        <button onclick="savePrinterSettingsFromModal()" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition active:scale-95">
          حفظ التفضيلات وتثبيت الطابعتين ✅
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

  // فحص الوسيط وجلب الطابعات
  checkBridgeAndRefreshPrinters();
}

// دالة فحص اتصال الوسيط وجلب الطابعات
async function checkBridgeAndRefreshPrinters() {
  const currentSettings = getPrintSettings();
  const dot = document.getElementById('ps-status-dot');
  const txt = document.getElementById('ps-status-text');
  const sel = document.getElementById('ps-cashier-printer-select');

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
      if (prRes.ok && sel) {
        const printers = await prRes.json();
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
    } catch (e) {}
    return;
  }

  if (dot && txt) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    txt.innerHTML = '<span class="text-rose-400 font-bold">وسيط الطباعة غير متصل 🔴</span> <span class="text-[10px] text-slate-400">(شغّل ملف "تشغيل_وسيط_الطباعة.bat" بالمجلد)</span>';
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
    ticketType: typeChecked ? typeChecked.value : 'kitchen',
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

  // تصفية الطلبات
  const filteredOrders = orders.filter(o => {
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

function getMenuTargetBaseUrl() {
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  if (config.publishedUrl && config.publishedUrl.trim()) {
    let url = config.publishedUrl.trim();
    // إزالة علامة / أو index.html من النهاية لضمان التنسيق
    url = url.replace(/\/index\.html$/i, '').replace(/\/$/, '');
    return url;
  }
  // في حال لم يتم تحديد رابط النشر، استخدام الرابط الحالي
  return window.location.origin + window.location.pathname.replace(/\/admin\.html$/i, '').replace(/\/cashier\.html$/i, '').replace(/\/captain\.html$/i, '').replace(/\/$/, '');
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

/* === captain.js === */
/**
 * Smart E-Menu - Captain POS Application Controller
 * تطبيق كابتن الصالة بدون رموز في الأسماء مع التحقق من الحسابات المفعلة
 */

let captainCart = [];
let captainSelectedTable = 1;
let captainCurrentCat = 'all';
let captainSearch = '';
let selectedCaptainId = null;

// -------------------------------------------------------------
// درج القائمة الجانبي للكابتن (--- زر)
// -------------------------------------------------------------
function openCaptainMenuSidebar() {
  const m = document.getElementById('captain-menu-sidebar');
  if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function closePTSidebar() {
  const m = document.getElementById('captain-menu-sidebar');
  if (m) { m.classList.add('hidden'); document.body.style.overflow = 'auto'; }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof fetchUsersFromSupabase === 'function') fetchUsersFromSupabase();
  initCaptainApp();
});

function initCaptainApp() {
  const loginView = document.getElementById('captain-login-view');
  const posView = document.getElementById('captain-pos-view');
  if (!loginView && !posView) return; // ليس في صفحة الكابتن

  const restId = typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan';
  if (restId === 'platform_market') {
    alert('سوق المنصة المركزي مخصص للمنيو ولوحة الإدارة فقط لعدم الحاجة لشاشة كابتن صالة. جاري تحويلك للوحة إدارة المنصة...');
    window.location.replace('admin.html?rest=platform_market');
    return;
  }

  const session = getCurrentSession();
  
  // التحقق من تسجيل دخول الكابتن أو السوبر أدمن
  if (!session || (session.role !== 'captain' && session.role !== 'admin' && session.role !== 'super_admin' && session.role !== 'assistant_super_admin')) {
    const restParam = restId ? `?role=captain&rest=${encodeURIComponent(restId)}` : '?role=captain';
    window.location.replace('login.html' + restParam);
    return;
  }

  showCaptainPOSScreen(session);
}

function showCaptainLoginScreen() {
  document.getElementById('captain-login-view').classList.remove('hidden');
  document.getElementById('captain-pos-view').classList.add('hidden');

  // إفراغ حقول الدخول تماماً لضمان الخصوصية والأمان
  const usernameInput = document.getElementById('captain-username-input');
  const pinInput = document.getElementById('captain-pin-input');
  const rememberCheckbox = document.getElementById('captain-remember-me');
  if (usernameInput) usernameInput.value = '';
  if (pinInput) pinInput.value = '';
  if (rememberCheckbox) rememberCheckbox.checked = false;
  try { resetFailedAttempts(); } catch(e){}
}

async function handleCaptainLogin(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('captain-username-input');
  const pinInput = document.getElementById('captain-pin-input');
  const errorEl = document.getElementById('captain-login-error');
  const rememberCheckbox = document.getElementById('captain-remember-me');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const pin = pinInput ? pinInput.value : '';
  const rememberMe = rememberCheckbox ? rememberCheckbox.checked : false;

  if (!username) {
    if (errorEl) {
      errorEl.textContent = 'يرجى إدخال اسم المستخدم!';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  const res = typeof loginUserAsync === 'function' 
    ? await loginUserAsync(username, pin, rememberMe) 
    : { success: false, message: 'تعذر التحقق من تسجيل الدخول' };
  
  if (res.success) {
    if (errorEl) errorEl.classList.add('hidden');

    const restId = res.restaurantId || (typeof getActiveRestaurantId === 'function' ? getActiveRestaurantId() : 'fahma_dokhan');
    const restParam = restId ? `?rest=${encodeURIComponent(restId)}` : '';

    if (res.role === 'cashier') {
      window.location.href = 'cashier.html' + restParam;
      return;
    } else if (res.role === 'super_admin' || res.role === 'assistant_super_admin') {
      window.location.href = 'super-admin.html';
      return;
    }
    showCaptainPOSScreen(res.session);
  } else {
    if (errorEl) {
      errorEl.textContent = res.message || 'اسم المستخدم أو كلمة المرور غير صحيحة!';
      errorEl.classList.remove('hidden');
    }
  }
}

function sanitizeCaptainDisplayName(name) {
  if (!name) return 'كابتن الصالة';
  if (/[\u4e00-\u9fa5]/.test(name) || name.includes('賲') || name.includes('賈')) {
    if (name.includes('Super Admin') || name.toLowerCase().includes('super')) {
      return 'مدير المنظومة (Super Admin)';
    }
    return 'كابتن الصالة';
  }
  return name;
}

function showCaptainPOSScreen(session) {
  document.getElementById('captain-login-view').classList.add('hidden');
  document.getElementById('captain-pos-view').classList.remove('hidden');

  // تعيين اسم الكابتن بدون أي رموز
  const cleanName = sanitizeCaptainDisplayName(session ? session.name : '');
  document.querySelectorAll('.current-captain-name').forEach(el => el.textContent = cleanName);

  // تهيئة الطاولات والفئات والأطباق
  renderTablesGrid();
  renderCaptainCategories();
  renderCaptainDishes();
  updateCaptainCartUI();
  renderCaptainActiveOrders();
  syncMenuFromSupabase();

  // ربط البحث
  const searchInput = document.getElementById('captain-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      captainSearch = e.target.value.toLowerCase().trim();
      renderCaptainDishes();
    });
  }

  // المزامنة الحية للطاولات والطلبات النشطة محلياً وسحابياً (كل 2 ثانية)
  setInterval(() => {
    renderTablesGrid();
    renderCaptainActiveOrders();
    syncCaptainOrdersFromSupabase();
  }, 2000);

  window.addEventListener('storage', () => {
    renderTablesGrid();
    renderCaptainActiveOrders();
    renderCaptainDishes();
    updateCaptainCartUI();
  });

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('smart_emenu_channel');
      bc.onmessage = (ev) => {
        if (ev.data) {
          if (ev.data.type === 'ORDERS_CHANGED') {
            // تحديث فوري من localStorage قبل انتظار Supabase
            renderTablesGrid();
            renderCaptainActiveOrders();
            // ثم مزامنة سحابية في الخلفية
            syncCaptainOrdersFromSupabase();
          }
          if (ev.data.type === 'DISH_AVAILABILITY_CHANGED' || ev.data.type === 'DISH_SAVED' || ev.data.type === 'DISH_DELETED') {
            renderCaptainDishes();
            updateCaptainCartUI();
          }
          if (ev.data.type === 'CALL_WAITER') {
            handleCaptainTableServiceAlert('call_waiter', ev.data);
          }
          if (ev.data.type === 'REQUEST_BILL') {
            handleCaptainTableServiceAlert('request_bill', ev.data);
          }
        }
      };
    }
  } catch (e) {}

  // تفعيل الاستماع للبث الفوري عبر السحابة
  initCaptainCloudOrdersListener();
}

// -------------------------------------------------------------
// إدارة وشاشات الكابتن (View A: خريطة الطاولات / View B: أخذ الطلب)
// -------------------------------------------------------------
let appendingToOrderId = null;

window.captainTableAlerts = window.captainTableAlerts || {};

function playCaptainServiceChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch(e) {}
}

window.dismissCaptainTableAlert = function(tNum) {
  if (window.captainTableAlerts && window.captainTableAlerts[tNum]) {
    delete window.captainTableAlerts[tNum];
    renderTablesGrid();
  }
};

window.handleCaptainTableServiceAlert = function(type, payload) {
  if (!payload || !payload.tableNumber) return;
  const tNum = parseInt(payload.tableNumber);
  if (isNaN(tNum) || tNum <= 0) return;

  window.captainTableAlerts[tNum] = {
    type: type,
    time: payload.timestamp || Date.now(),
    tableNumber: tNum
  };

  playCaptainServiceChime();
  renderTablesGrid();

  const isBill = (type === 'request_bill');
  const alertTitle = isBill ? `💳 طاولة [ ${tNum} ] تطلب الفاتورة والحساب!` : `🛎️ طاولة [ ${tNum} ] تطلب حضور الكابتن للخدمة!`;

  if (typeof showCaptainToast === 'function') {
    showCaptainToast(alertTitle, isBill ? '💳' : '🛎️');
  }
};

function renderTablesGrid() {
  const container = document.getElementById('captain-tables-grid');
  if (!container) return;

  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const tablesCount = config.tablesCount || 20;
  const orders = getStoredData('orders', []);
  
  // خريطة الطلبات النشطة
  const activeOrdersMap = new Map();
  orders.filter(o => o.type === 'dine-in' && o.status !== 'completed' && o.status !== 'cancelled').forEach(o => {
    const tNum = parseInt(o.tableNumber || o.table_number); if (tNum) activeOrdersMap.set(tNum, o);
  });

  let html = '';
  for (let i = 1; i <= tablesCount; i++) {
    const isOccupied = activeOrdersMap.has(i);
    const order = activeOrdersMap.get(i);
    const alertInfo = window.captainTableAlerts ? window.captainTableAlerts[i] : null;

    let alertBadgeHtml = '';
    let alertRingClass = '';
    if (alertInfo) {
      if (alertInfo.type === 'call_waiter') {
        alertRingClass = 'ring-2 ring-amber-400 animate-pulse';
        alertBadgeHtml = `
          <div class="mb-2 p-1.5 rounded-xl bg-amber-500/30 border border-amber-400 text-amber-200 text-[10px] font-black flex items-center justify-between animate-pulse">
            <span class="flex items-center gap-1"><span>🛎️</span><span>نداء الكابتن!</span></span>
            <button type="button" onclick="event.stopPropagation();dismissCaptainTableAlert(${i})" class="px-1.5 py-0.5 rounded bg-amber-400 text-black font-black text-[9px] hover:bg-amber-300">تم الاستلام ✓</button>
          </div>
        `;
      } else if (alertInfo.type === 'request_bill') {
        alertRingClass = 'ring-2 ring-emerald-400 animate-pulse';
        alertBadgeHtml = `
          <div class="mb-2 p-1.5 rounded-xl bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-[10px] font-black flex items-center justify-between animate-pulse">
            <span class="flex items-center gap-1"><span>💳</span><span>طلب الفاتورة!</span></span>
            <button type="button" onclick="event.stopPropagation();dismissCaptainTableAlert(${i})" class="px-1.5 py-0.5 rounded bg-emerald-400 text-black font-black text-[9px] hover:bg-emerald-300">تم ✓</button>
          </div>
        `;
      }
    }

    if (isOccupied) {
      const minsAgo = Math.floor((Date.now() - order.timestamp) / 60000);
      html += `
        <div onclick="openActiveTableModal(${i})" class="bg-amber-950/40 border-2 border-amber-500/70 ${alertRingClass} p-3.5 sm:p-4 rounded-3xl cursor-pointer transition flex flex-col justify-between shadow-xl hover:bg-amber-950/60 active:scale-95">
          <div>
            ${alertBadgeHtml}
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm sm:text-base font-black text-white">طاولة ${i}</span>
              <span class="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>مشغولة</span>
              </span>
            </div>
            <div class="space-y-1 bg-slate-950 p-2 rounded-2xl border border-slate-800 mb-2">
              <div class="text-[10px] text-amber-300 font-mono">🕒 منذ ${minsAgo} دقيقة</div>
              <div class="text-xs sm:text-sm font-black text-rose-400 font-mono">${order.total.toLocaleString()} ${config.currency}</div>
              <div class="text-[10px] text-slate-400 truncate">${order.items.length} أصناف • ${sanitizeCaptainDisplayName(order.captainName)}</div>
            </div>
          </div>
          <button type="button" class="w-full py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 rounded-xl text-[11px] font-black transition">
            📋 كشف الحساب
          </button>
        </div>
      `;
    } else {
      html += `
        <div onclick="openCaptainOrderTakingView(${i})" class="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 ${alertRingClass} p-3.5 sm:p-4 rounded-3xl cursor-pointer transition flex flex-col justify-between shadow-lg hover:bg-slate-850 active:scale-95 group">
          <div>
            ${alertBadgeHtml}
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm sm:text-base font-black text-white">طاولة ${i}</span>
              <span class="w-2 h-2 rounded-full bg-slate-700"></span>
            </div>
            <div class="py-2.5 text-center text-[11px] text-slate-400 font-bold bg-slate-950/60 rounded-2xl border border-slate-800/80 mb-2">
              ⚪ متاحة للطلب
            </div>
          </div>
          <button type="button" class="w-full py-1.5 px-2 bg-emerald-600/20 group-hover:bg-emerald-600 text-emerald-300 group-hover:text-white border border-emerald-500/30 rounded-xl text-[11px] font-black transition">
            ＋ فتح طلب جديد
          </button>
        </div>
      `;
    }
  }
  container.innerHTML = html;

  const statFree = document.getElementById('captain-stat-free');
  const statBusy = document.getElementById('captain-stat-busy');
  if (statFree) statFree.textContent = `⚪ ${tablesCount - activeOrdersMap.size} متاحة`;
  if (statBusy) statBusy.textContent = `🟢 ${activeOrdersMap.size} مشغولة`;
}

// فتح شاشة أخذ الطلب لطاولة معينة
function openCaptainOrderTakingView(tableNum, appendOrderId = null) {
  captainSelectedTable = tableNum;
  appendingToOrderId = appendOrderId;
  captainCart = [];

  const tablesView = document.getElementById('captain-tables-view');
  const orderView = document.getElementById('captain-order-view');
  if (tablesView) tablesView.classList.add('hidden');
  if (orderView) orderView.classList.remove('hidden');

  const titleHeader = document.getElementById('captain-order-table-title');
  if (titleHeader) {
    titleHeader.textContent = appendOrderId 
      ? `➕ إضافة أصناف لطاولة رقم [ ${tableNum} ]` 
      : `طلب جديد - طاولة رقم [ ${tableNum} ]`;
  }

  const cartTableBadge = document.getElementById('captain-cart-table-badge');
  if (cartTableBadge) cartTableBadge.textContent = `طاولة رقم ${tableNum}`;

  renderCaptainCategories();
  renderCaptainDishes();
  updateCaptainCartUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// إغلاق شاشة أخذ الطلب والعودة لخريطة الطاولات
function closeCaptainOrderTakingView() {
  captainCart = [];
  appendingToOrderId = null;

  const notesInput = document.getElementById('captain-order-notes');
  if (notesInput) notesInput.value = '';

  const tablesView = document.getElementById('captain-tables-view');
  const orderView = document.getElementById('captain-order-view');
  if (orderView) orderView.classList.add('hidden');
  if (tablesView) tablesView.classList.remove('hidden');

  renderTablesGrid();
  renderCaptainActiveOrders();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// كشف حساب وإدارة الطاولة المشغولة للكابتن (Active Table Modal)
// -------------------------------------------------------------
let currentActiveCaptainTableOrder = null;

function openActiveTableModal(tableNum, order) {
  if (!order) {
    const orders = getStoredData('orders', []);
    order = orders.find(o => o.type === 'dine-in' && o.status !== 'completed' && o.status !== 'cancelled' && parseInt(o.tableNumber || o.table_number) === tableNum);
  }
  if (!order) return;

  currentActiveCaptainTableOrder = order;
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
  if (metaEl) metaEl.textContent = `#${order.id} • 🕒 ${timeFormatted} (منذ ${minsAgo} دقيقة) • الكابتن: ${sanitizeCaptainDisplayName(order.captainName)}`;

  renderCaptainActiveTableItems();

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

function renderCaptainActiveTableItems() {
  const itemsListEl = document.getElementById('atm-items-list');
  const totalEl = document.getElementById('atm-total-price');
  if (!itemsListEl || !currentActiveCaptainTableOrder) return;
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  if (!currentActiveCaptainTableOrder.items || currentActiveCaptainTableOrder.items.length === 0) {
    itemsListEl.innerHTML = `<div class="text-center py-4 text-xs text-rose-400 font-bold">لا توجد وجبات في هذا الطلب</div>`;
    if (totalEl) totalEl.textContent = `0 ${config.currency}`;
    return;
  }

  itemsListEl.innerHTML = currentActiveCaptainTableOrder.items.map((item, idx) => `
    <div class="flex items-center justify-between py-2 px-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
      <div class="flex-1 pr-1">
        <div class="font-bold text-white">${item.name}</div>
        <div class="text-[10px] text-slate-400 font-mono">${(item.price || 0).toLocaleString()} ${config.currency} للقطعة</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
          <button type="button" onclick="updateCaptainActiveTableItemQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">-</button>
          <span class="w-7 text-center font-mono font-bold text-amber-300 text-xs">${item.quantity}</span>
          <button type="button" onclick="updateCaptainActiveTableItemQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold active:scale-90">+</button>
        </div>
        <span class="font-mono text-rose-400 font-bold min-w-[55px] text-left">${((item.price || 0) * item.quantity).toLocaleString()}</span>
        <button type="button" onclick="removeCaptainActiveTableItem(${idx})" title="حذف الصنف من الطاولة" class="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-600/80 rounded-lg transition active:scale-90">🗑️</button>
      </div>
    </div>
  `).join('');

  const newTotal = currentActiveCaptainTableOrder.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
  currentActiveCaptainTableOrder.total = newTotal;
  if (totalEl) totalEl.textContent = `${newTotal.toLocaleString()} ${config.currency}`;
}

function updateCaptainActiveTableItemQty(idx, delta) {
  if (!currentActiveCaptainTableOrder || !currentActiveCaptainTableOrder.items[idx]) return;
  const item = currentActiveCaptainTableOrder.items[idx];
  const newQty = (item.quantity || 1) + delta;
  if (newQty <= 0) {
    removeCaptainActiveTableItem(idx);
    return;
  }
  item.quantity = newQty;
  saveCaptainActiveTableOrderChanges();
}

function removeCaptainActiveTableItem(idx) {
  if (!currentActiveCaptainTableOrder || !currentActiveCaptainTableOrder.items[idx]) return;
  const item = currentActiveCaptainTableOrder.items[idx];
  if (!confirm(`هل أنت متأكد من حذف [ ${item.name} ] من طلب الطاولة؟`)) return;

  currentActiveCaptainTableOrder.items.splice(idx, 1);
  if (currentActiveCaptainTableOrder.items.length === 0) {
    if (confirm("أصبح الطلب بدون أي أصناف. هل تريد إلغاء الطلب وتفريغ الطاولة بالكامل؟")) {
      cancelAndVoidActiveTable();
      return;
    }
  }
  saveCaptainActiveTableOrderChanges();
}

function saveCaptainActiveTableOrderChanges() {
  if (!currentActiveCaptainTableOrder) return;
  const orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === currentActiveCaptainTableOrder.id);
  if (idx !== -1) {
    currentActiveCaptainTableOrder.total = currentActiveCaptainTableOrder.items.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0);
    orders[idx] = { ...orders[idx], ...currentActiveCaptainTableOrder };
    setStoredData('orders', orders);
    window.dispatchEvent(new Event('storage'));

    try {
      if ('BroadcastChannel' in window) {
        new BroadcastChannel('smart_emenu_channel').postMessage({ 
          type: 'ORDERS_CHANGED', 
          orderId: currentActiveCaptainTableOrder.id 
        });
      }
    } catch(e) {}

    // مزامنة التعديل سحابياً مع Supabase
    if (typeof sendCaptainOrderToSupabase === 'function') {
      sendCaptainOrderToSupabase(orders[idx]);
    }
  }
  renderCaptainActiveTableItems();
  renderTablesGrid();
  renderCaptainActiveOrders();
}

function cancelAndVoidActiveTable() {
  if (!currentActiveCaptainTableOrder) return;
  const tableNum = currentActiveCaptainTableOrder.tableNumber;
  const orderId = currentActiveCaptainTableOrder.id;
  if (!confirm(`هل أنت متأكد من إلغاء وحذف طلب طاولة [ ${tableNum} ] نهائياً وتفريغ الطاولة ومسحه من السحابة؟`)) return;

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

  // مسح الطلب نهائياً من Supabase لتفريغ الطاولة لدى الكاشير والصالة
  if (typeof deleteCaptainOrderFromSupabase === 'function') {
    deleteCaptainOrderFromSupabase(orderId);
  }

  closeActiveTableModal();
  renderTablesGrid();
  renderCaptainActiveOrders();
  alert(`تم إلغاء الطلب #${orderId} وتفريغ طاولة [ ${tableNum} ] بنجاح! 🗑️`);
}

function closeActiveTableModal() {
  const modal = document.getElementById('active-table-modal');
  if (modal) modal.classList.add('hidden');
  currentActiveCaptainTableOrder = null;
}

function addMoreItemsToActiveTable() {
  if (!currentActiveCaptainTableOrder) return;
  const tableNum = parseInt(currentActiveCaptainTableOrder.tableNumber);
  const orderId = currentActiveCaptainTableOrder.id;
  closeActiveTableModal();

  // فتح شاشة أخذ الطلب مع ربطها بنفس الفاتورة
  openCaptainOrderTakingView(tableNum, orderId);
}

function printActiveTableBill() {
  if (!currentActiveCaptainTableOrder) return;
  renderAndPrintCaptainTicket(currentActiveCaptainTableOrder);
}

function closeAndPayActiveTable() {
  if (!currentActiveCaptainTableOrder) return;
  const orderId = currentActiveCaptainTableOrder.id;
  const tableNum = currentActiveCaptainTableOrder.tableNumber;

  const orders = getStoredData('orders', []);
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx].status = 'completed';
    orders[idx].paidAt = Date.now();
    setStoredData('orders', orders);
  }

  // مسح الطلب نهائياً من Supabase بعد المحاسبة لتفريغ الطاولة لدى الجميع
  if (typeof deleteCaptainOrderFromSupabase === 'function') {
    deleteCaptainOrderFromSupabase(orderId);
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
  renderTablesGrid();
  renderCaptainActiveOrders();

  if (typeof showCaptainToast === 'function') {
    showCaptainToast(`تمت محاسبة طاولة [ ${tableNum} ] وتفريغها بنجاح ✅`);
  }
}

// -------------------------------------------------------------
// عرض الفئات والأطباق
// -------------------------------------------------------------
function renderCaptainCategories() {
  const container = document.getElementById('captain-categories-bar');
  if (!container) return;

  let categories = getStoredData('categories', DEFAULT_CATEGORIES);
  // التأكد من وجود قسم "الكل" في البداية دائماً
  const hasAll = categories.some(c => c.id === 'all');
  if (!hasAll) {
    categories = [{ id: "all", name: "الكل", nameEn: "All", icon: "🍽️" }, ...categories];
  }

  container.innerHTML = categories.map(cat => `
    <button onclick="selectCaptainCategory('${cat.id}')" class="cat-pill ${captainCurrentCat === cat.id ? 'active' : ''} text-xs py-2 px-3.5 whitespace-nowrap rounded-xl transition font-bold flex items-center gap-1.5 flex-shrink-0">
      <span>${cat.icon || '🍽️'}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function selectCaptainCategory(catId) {
  captainCurrentCat = catId;
  renderCaptainCategories();
  renderCaptainDishes();
}

let captainSort = 'default';
let captainAvailableOnly = false;

function setCaptainSort(sortKey) {
  captainSort = sortKey;
  
  // تحديث شكل أزرار الفرز
  ['default', 'price-asc', 'price-desc', 'name-asc'].forEach(key => {
    const btn = document.getElementById(`btn-cap-sort-${key}`);
    if (btn) {
      if (key === sortKey) {
        btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-rose-600 text-white shadow-md shadow-rose-600/30";
      } else {
        btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-slate-950 text-slate-400 hover:bg-slate-800";
      }
    }
  });

  renderCaptainDishes();
}

function toggleCaptainAvailableOnly() {
  captainAvailableOnly = !captainAvailableOnly;
  const btn = document.getElementById('btn-cap-filter-avail');
  if (btn) {
    if (captainAvailableOnly) {
      btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-emerald-600 text-white shadow-md shadow-emerald-600/30";
    } else {
      btn.className = "sort-chip text-[10px] font-bold px-2.5 py-1 rounded-xl transition whitespace-nowrap bg-slate-950 text-slate-400 hover:bg-slate-800";
    }
  }
  renderCaptainDishes();
}

function renderCaptainDishes() {
  const container = document.getElementById('captain-dishes-grid');
  if (!container) return;

  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  let filtered = dishes.filter(d => {
    if (captainCurrentCat !== 'all' && d.categoryId !== captainCurrentCat) return false;
    if (captainAvailableOnly && !d.available) return false;
    if (captainSearch) {
      const matchName = d.name && d.name.toLowerCase().includes(captainSearch);
      const matchIng = d.ingredients && d.ingredients.toLowerCase().includes(captainSearch);
      if (!matchName && !matchIng) return false;
    }
    return true;
  });

  // تطبيق الترتيب والفرز
  if (captainSort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (captainSort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (captainSort === 'name-asc') {
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-xs">لا توجد أطباق مطابقة للبحث أو الفلتر المختار</div>`;
    return;
  }

  container.innerHTML = filtered.map(dish => {
    const inCartItem = captainCart.find(i => i.id === dish.id);
    const qty = inCartItem ? inCartItem.quantity : 0;

    return `
      <div onclick="${dish.available ? `addDishToCaptainCart('${dish.id}')` : ''}" class="p-2.5 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between active:scale-98 relative group ${
        !dish.available 
          ? 'bg-slate-950 border-slate-800 opacity-40 grayscale cursor-not-allowed' 
          : qty > 0 
            ? 'bg-rose-950/40 border-rose-500/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50' 
            : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      }">
        <div>
          <!-- الصف العلوي: صورة الطبق + الاسم + زر التفاصيل -->
          <div class="flex items-start gap-2 mb-1.5">
            ${dish.image ? `
              <img src="${dish.image}" alt="${dish.name}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-slate-800" loading="lazy" onerror="this.style.display='none'">
            ` : `
              <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-lg flex-shrink-0">🍽️</div>
            `}
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-1">
                <h4 class="font-black text-white text-xs leading-snug line-clamp-2">${dish.name}</h4>
                <button type="button" onclick="event.stopPropagation(); showDishDetailsModal('${dish.id}')" title="عرض تفاصيل ومكونات الطبق" class="w-5 h-5 rounded-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 text-[10px] flex items-center justify-center flex-shrink-0 transition">ℹ️</button>
              </div>
              ${dish.nameEn ? `<div class="text-[9px] text-slate-400 font-sans truncate">${dish.nameEn}</div>` : ''}
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

          <!-- شارات السعرات والتمييز -->
          <div class="flex items-center gap-1 flex-wrap mb-1.5">
            ${dish.calories ? `<span class="text-[8px] bg-slate-800 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-slate-700">⚡ ${dish.calories}</span>` : ''}
            ${dish.isSpicy ? `<span class="text-[8px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-900">🌶️ حار</span>` : ''}
            ${dish.isPopular ? `<span class="text-[8px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-900">⭐ مميز</span>` : ''}
          </div>
        </div>

        <!-- الجزء السفلي: السعر وأزرار التحكم بالكمية -->
        <div class="flex items-center justify-between pt-1.5 border-t border-slate-800/80 mt-auto">
          <div class="flex flex-col">
            <span class="text-rose-400 font-black text-xs font-mono">${Number(dish.price).toLocaleString()} ${config.currency}</span>
            ${dish.oldPrice && Number(dish.oldPrice) > Number(dish.price) ? `
              <div class="flex items-center gap-1">
                <span class="text-[9px] text-slate-500 line-through">${Number(dish.oldPrice).toLocaleString()}</span>
                <span class="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-1 rounded">
                  -${Math.round(((Number(dish.oldPrice) - Number(dish.price)) / Number(dish.oldPrice)) * 100)}%
                </span>
              </div>
            ` : ''}
          </div>
          ${!dish.available ? `
            <span class="text-[9px] text-rose-500 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-900/50">غير متوفر</span>
          ` : qty > 0 ? `
            <div class="inline-flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-700" onclick="event.stopPropagation()">
              <button onclick="changeCaptainCartQty('${dish.id}', -1)" class="w-5 h-5 rounded-md bg-slate-800 hover:bg-rose-600 text-slate-300 font-bold flex items-center justify-center text-[10px] active:scale-90">−</button>
              <span class="text-[10px] font-mono font-bold text-white px-1">${qty}</span>
              <button onclick="changeCaptainCartQty('${dish.id}', 1)" class="w-5 h-5 rounded-md bg-rose-600 text-white font-bold flex items-center justify-center text-[10px] active:scale-90">＋</button>
            </div>
          ` : `
            <span class="text-[10px] text-slate-300 font-bold bg-slate-800 hover:bg-rose-600 hover:text-white px-2 py-0.5 rounded-lg transition">＋ إضافة</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// سلة الكابتن وإرسال الطلب للمطبخ
// -------------------------------------------------------------
function appendCaptainNote(text) {
  const notesInput = document.getElementById('captain-order-notes');
  if (!notesInput) return;
  const current = notesInput.value.trim();
  if (current) {
    if (!current.includes(text)) {
      notesInput.value = current + '، ' + text;
    }
  } else {
    notesInput.value = text;
  }
}

function clearCaptainCart() {
  captainCart = [];
  updateCaptainCartUI();
  renderCaptainDishes();
}

function toggleCaptainMobileCart() {
  const cartCol = document.getElementById('captain-cart-container-col');
  if (cartCol) {
    cartCol.scrollIntoView({ behavior: 'smooth' });
  }
}

function addDishToCaptainCart(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
  if (!dish || !dish.available) return;

  const idx = captainCart.findIndex(i => String(i.id) === String(dishId));
  if (idx !== -1) {
    captainCart[idx].quantity += 1;
  } else {
    captainCart.push({
      id: dish.id,
      name: dish.name,
      nameEn: dish.nameEn,
      price: dish.price,
      quantity: 1
    });
  }

  updateCaptainCartUI();
  renderCaptainDishes();
}

function changeCaptainCartQty(dishId, delta) {
  const idx = captainCart.findIndex(i => String(i.id) === String(dishId));
  if (idx !== -1) {
    captainCart[idx].quantity += delta;
    if (captainCart[idx].quantity <= 0) {
      captainCart.splice(idx, 1);
    }
  }

  updateCaptainCartUI();
  renderCaptainDishes();
}

function updateCaptainCartUI() {
  const container = document.getElementById('captain-cart-items');
  const totalDisplay = document.getElementById('captain-cart-total');
  const emptyDisplay = document.getElementById('captain-cart-empty');
  const mobileBadge = document.getElementById('captain-mobile-cart-badge');
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);

  const totalCount = captainCart.reduce((sum, i) => sum + i.quantity, 0);
  const total = captainCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  if (totalDisplay) totalDisplay.textContent = `${total.toLocaleString()} ${config.currency}`;
  if (mobileBadge) mobileBadge.textContent = totalCount;

  if (captainCart.length === 0) {
    if (container) container.innerHTML = '';
    if (emptyDisplay) emptyDisplay.classList.remove('hidden');
    return;
  }

  if (emptyDisplay) emptyDisplay.classList.add('hidden');

  if (container) {
    container.innerHTML = captainCart.map(item => `
      <div class="flex items-center justify-between p-2.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
        <div class="min-w-0 flex-1 pl-2">
          <div class="font-black text-white truncate">${item.name}</div>
          <div class="text-[11px] text-rose-400 font-bold font-mono">${(item.price * item.quantity).toLocaleString()} ${config.currency}</div>
        </div>
        <div class="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
          <button onclick="changeCaptainCartQty(${item.id}, -1)" class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 font-bold flex items-center justify-center text-xs">−</button>
          <span class="font-black text-white text-xs px-1.5 font-mono">${item.quantity}</span>
          <button onclick="changeCaptainCartQty(${item.id}, 1)" class="w-6 h-6 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center text-xs">＋</button>
        </div>
      </div>
    `).join('');
  }
}

function submitCaptainOrder() {
  if (captainCart.length === 0) {
    alert("السلة فارغة، يرجى اختيار وجبات أولاً!");
    return;
  }

  const session = getCurrentSession();
  const config = getStoredData('config', DEFAULT_RESTAURANT_CONFIG);
  const notesInput = document.getElementById('captain-order-notes');
  const notes = notesInput ? notesInput.value.trim() : '';
  const total = captainCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const orders = getStoredData('orders', []);

  let orderToPrint = null;
  let fullOrderToSync = null;

  if (appendingToOrderId) {
    // إلحاق أصناف جديدة بنفس الطلب المفتوح مسبقاً
    const existingIdx = orders.findIndex(o => o.id === appendingToOrderId);
    if (existingIdx !== -1) {
      // دمج الأصناف
      captainCart.forEach(cartItem => {
        const itemIdx = orders[existingIdx].items.findIndex(it => it.id === cartItem.id);
        if (itemIdx !== -1) {
          orders[existingIdx].items[itemIdx].quantity += cartItem.quantity;
        } else {
          orders[existingIdx].items.push({ ...cartItem });
        }
      });
      orders[existingIdx].total += total;
      if (notes) {
        orders[existingIdx].notes = orders[existingIdx].notes 
          ? `${orders[existingIdx].notes} | [إضافة]: ${notes}` 
          : `[إضافة]: ${notes}`;
      }
      setStoredData('orders', orders);
      fullOrderToSync = orders[existingIdx];

      // بون المطبخ للأصناف المضافة حديثاً فقط
      orderToPrint = {
        id: orders[existingIdx].id + '-ADD',
        type: 'dine-in',
        tableNumber: captainSelectedTable,
        captainName: sanitizeCaptainDisplayName(session ? session.name : 'الصالة'),
        items: [...captainCart],
        notes: `(إلحاق طلب لطاولة ${captainSelectedTable}) ${notes}`,
        total: total,
        currency: config.currency,
        timestamp: Date.now()
      };
    }
  }

  if (!orderToPrint) {
    // طلب جديد كلياً
    const orderId = 'ORD-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    const newOrder = {
      id: orderId,
      type: 'dine-in',
      tableNumber: captainSelectedTable,
      captainName: sanitizeCaptainDisplayName(session ? session.name : 'الصالة'),
      captainId: session ? session.captainId : null,
      items: [...captainCart],
      notes: notes,
      total: total,
      currency: config.currency,
      status: 'pending_kitchen',
      source: 'captain',
      timestamp: Date.now()
    };
    orders.unshift(newOrder);
    setStoredData('orders', orders);
    orderToPrint = newOrder;
    fullOrderToSync = newOrder;
  }

  // إرسال إشعار storage لتحديث الكاشير والشاشات فوراً محلياً
  window.dispatchEvent(new Event('storage'));
  try {
    if ('BroadcastChannel' in window) {
      new BroadcastChannel('smart_emenu_channel').postMessage({ 
        type: 'ORDERS_CHANGED', 
        orderId: fullOrderToSync ? fullOrderToSync.id : null 
      });
    }
  } catch(e) {}

  // إرسال ومزامنة الطلب سحابياً فوراً مع Supabase
  if (fullOrderToSync && typeof sendCaptainOrderToSupabase === 'function') {
    sendCaptainOrderToSupabase(fullOrderToSync);
  }

  // طباعة البون
  renderAndPrintCaptainTicket(orderToPrint);

  const tableNumRecorded = captainSelectedTable;

  // إغلاق شاشة الطلب وتفريغ السلة والعودة فوراً لخريطة الطاولات!
  closeCaptainOrderTakingView();

  alert(`تم إرسال طلب طاولة [ ${tableNumRecorded} ] للمطبخ وطباعة البون بنجاح! 🚀`);
}

function renderAndPrintCaptainTicket(order) {
  if (typeof printOrderDirect === 'function') {
    printOrderDirect(order, 'kitchen');
  } else {
    window.print();
  }
}

function renderCaptainActiveOrders() {
  const container = document.getElementById('captain-orders-list');
  const countBadge = document.getElementById('captain-active-orders-count');
  if (!container) return;

  const orders = getStoredData('orders', []);
  const activeOrders = orders.filter(o => o.type === 'dine-in' && o.status !== 'completed');

  if (countBadge) {
    countBadge.textContent = `${activeOrders.length} طلب`;
  }

  if (activeOrders.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">لا توجد طلبات جارية بالصالة حالياً</div>`;
    return;
  }

  container.innerHTML = activeOrders.map(order => {
    const timeFormatted = new Date(order.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const itemsSummary = order.items.map(i => `${i.name} (x${i.quantity})`).join('، ');

    return `
      <div class="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5 text-xs shadow-md">
        <div class="flex justify-between items-center">
          <span class="font-black text-rose-400">طاولة رقم [ ${order.tableNumber} ]</span>
          <span class="font-mono text-slate-400 text-[10px]">#${order.id} • ${timeFormatted}</span>
        </div>
        <div class="text-[11px] text-slate-300 line-clamp-1 bg-slate-900 p-1.5 rounded-xl">
          ${itemsSummary}
        </div>
        ${(order.isPreorder || (order.notes && order.notes.includes('حجز مسبق لليوم التالي'))) ? `
          <div class="px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center justify-between">
            <span>📅 حجز مسبق (اليوم التالي)</span>
            <span class="text-[9px] text-amber-200">${order.preorderPreferredTime ? 'موعد: ' + order.preorderPreferredTime : 'مع بداية الافتتاح'}</span>
          </div>
        ` : ''}
        ${order.notes ? `<div class="text-[10px] text-amber-300 font-bold">📝 ${order.notes}</div>` : ''}
        <div class="border-t border-slate-800/80 pt-2 flex items-center justify-between gap-1.5 flex-wrap">
          <span class="text-white font-black font-mono text-[11px]">${order.total.toLocaleString()} ${order.currency}</span>
          <div class="flex items-center gap-1 flex-wrap">
            <button onclick="openActiveTableModal(${order.tableNumber})" class="py-1 px-2 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 rounded-xl text-[10px] font-bold transition flex items-center gap-1 active:scale-95">
              <span>✏️ تعديل</span>
            </button>
            <button onclick="cancelCaptainOrderDirectly('${order.id}', ${order.tableNumber})" class="py-1 px-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 rounded-xl text-[10px] font-bold transition flex items-center gap-1 active:scale-95">
              <span>❌ إلغاء</span>
            </button>
            <button onclick="printOrderDirectById('${order.id}', 'kitchen')" class="py-1 px-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 active:scale-95" title="طباعة بون المطبخ (101)">
              <span>👨‍🍳 للمطبخ (101)</span>
            </button>
            <button onclick="printOrderDirectById('${order.id}', 'customer')" class="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-bold transition flex items-center gap-1 active:scale-95" title="طباعة فاتورة الحساب (100)">
              <span>🧾 للحساب (100)</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function cancelCaptainOrderDirectly(orderId, tableNumber) {
  if (!confirm(`هل أنت متأكد من إلغاء وحذف طلب طاولة [ ${tableNumber} ] بالكامل وتفريغها ومسحه من السحابة؟`)) return;

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

  // مسح الطلب نهائياً من Supabase لتفريغ الطاولة لدى الجميع
  if (typeof deleteCaptainOrderFromSupabase === 'function') {
    deleteCaptainOrderFromSupabase(orderId);
  }

  renderTablesGrid();
  renderCaptainActiveOrders();
  alert(`تم إلغاء الطلب #${orderId} وتفريغ طاولة [ ${tableNumber} ] بنجاح! 🗑️`);
}

// -------------------------------------------------------------
// نافذة تفاصيل ومكونات الطبق المتقدمة للكابتن (Dish Details Modal)
// -------------------------------------------------------------
function showDishDetailsModal(dishId) {
  const dishes = getStoredData('dishes', DEFAULT_DISHES);
  const dish = dishes.find(d => String(d.id) === String(dishId));
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
          <div class="flex flex-col items-end">
            <div class="text-rose-400 font-black text-lg font-mono whitespace-nowrap">${Number(dish.price).toLocaleString()} ${config.currency}</div>
            ${dish.oldPrice && Number(dish.oldPrice) > Number(dish.price) ? `
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-slate-500 line-through">${Number(dish.oldPrice).toLocaleString()}</span>
                <span class="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-1.5 py-0.2 rounded">
                  خصم ${Math.round(((Number(dish.oldPrice) - Number(dish.price)) / Number(dish.oldPrice)) * 100)}% 🔥
                </span>
              </div>
            ` : ''}
          </div>
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
          <button onclick="addDishToCaptainCart(${dish.id}); closeDishDetailsModal();" class="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30">
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
// محرك المزامنة السحابية الحية لكابتن الصالة (Supabase Realtime)
// -------------------------------------------------------------
let captainCloudOrdersChannel = null;

async function sendCaptainOrderToSupabase(order) {
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
  if (!client || !order || !order.id) return;

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

  const dbPayload = {
    id: order.id,
    restaurant_id: restId,
    type: order.type || 'dine-in',
    table_number: order.tableNumber ? parseInt(order.tableNumber) : null,
    customer_name: order.captainName || 'كابتن الصالة',
    customer_phone: '',
    customer_address: '',
    map_url: '',
    items: Array.isArray(order.items) ? order.items : [],
    notes: order.notes || '',
    total: parseFloat(order.total) || 0,
    currency: order.currency || 'د.ع',
    status: (order.status === 'new' || !order.status) ? 'pending_kitchen' : order.status,
    source: 'captain',
    created_at: new Date(order.timestamp || Date.now()).toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await client.from('restaurant_orders').upsert([dbPayload]);
    if (error) {
      console.warn("Supabase captain order upsert notice:", error.message);
    } else {
      console.log("✅ Captain order synced to Supabase successfully:", order.id);
    }
  } catch (err) {
    console.warn("Supabase upsert error:", err);
  }

  // بث التحديث عبر قناة Realtime ليصل للكاشير فوراً
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

function addCaptainOrderTombstone(orderId) {
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

function isCaptainOrderTombstoned(orderId) {
  if (!orderId) return false;
  try {
    const raw = localStorage.getItem('smart_emenu_tombstones') || '[]';
    const list = JSON.parse(raw);
    return list.includes(String(orderId).trim());
  } catch (e) {
    return false;
  }
}

async function deleteCaptainOrderFromSupabase(orderId) {
  if (!orderId) return;
  const cleanId = String(orderId).trim();
  addCaptainOrderTombstone(cleanId);
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

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
    console.log("Direct REST DELETE executed successfully for order (captain):", cleanId);
  } catch (fetchErr) {
    console.warn("Direct REST delete error (captain):", fetchErr);
  }

  // 3. بث إشعار الحذف عبر Realtime لتفريغ الطاولة لدى الجميع فوراً
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

function initCaptainCloudOrdersListener() {
  const client = (typeof getSupabase === 'function') ? getSupabase() : ((typeof getSupabaseClient === 'function') ? getSupabaseClient() : null);
  if (!client) return;

  const restId = (typeof getActiveRestaurantId === 'function') ? getActiveRestaurantId() : 'fahma_dokhan';

  try {
    const channelName = `orders_channel_${restId}`;
    captainCloudOrdersChannel = client.channel(channelName);
    captainCloudOrdersChannel
      .on('broadcast', { event: 'new_customer_order' }, ({ payload }) => {
        syncCaptainOrdersFromSupabase();
      })
      .on('broadcast', { event: 'table_order_update' }, ({ payload }) => {
        syncCaptainOrdersFromSupabase();
      })
      .on('broadcast', { event: 'order_deleted' }, ({ payload }) => {
        syncCaptainOrdersFromSupabase();
      })
      .on('broadcast', { event: 'call_waiter' }, ({ payload }) => {
        console.log("🛎️ Captain received Call Waiter event:", payload);
        handleCaptainTableServiceAlert('call_waiter', payload);
      })
      .on('broadcast', { event: 'request_bill' }, ({ payload }) => {
        console.log("💳 Captain received Request Bill event:", payload);
        handleCaptainTableServiceAlert('request_bill', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_orders', filter: `restaurant_id=eq.${restId}` }, (payload) => {
        syncCaptainOrdersFromSupabase();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ Captain subscribed to Supabase Realtime orders channel:", channelName);
        }
      });
  } catch (err) {
    console.warn("Realtime listener init error:", err);
  }

  // مزامنة أولية
  syncCaptainOrdersFromSupabase();
}

async function syncCaptainOrdersFromSupabase() {
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
    let modified = false;

    const cloudOrderIds = new Set(data.map(d => d.id));

    data.forEach(remote => {
      if (isCaptainOrderTombstoned(remote.id)) return;

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
        status: (remote.status === 'new' || !remote.status) ? 'pending_kitchen' : remote.status,
        source: remote.source || 'online_menu',
        timestamp: remote.created_at ? new Date(remote.created_at).getTime() : Date.now()
      };

      if (idx === -1) {
        const isClosed = mapped.status === 'completed' || mapped.status === 'cancelled';
        const now = Date.now();
        const oTime = new Date(mapped.timestamp || 0).getTime();
        const isOld = oTime && (now - oTime) > 24 * 60 * 60 * 1000;
        if (!isClosed && !isOld) {
          localOrders.push(mapped);
          modified = true;
        }
      } else {
        const local = localOrders[idx];
        if (local && (local.status === 'completed' || local.status === 'cancelled')) {
          return;
        }
        const itemsDiff = JSON.stringify(local.items) !== JSON.stringify(mapped.items);
        const statusDiff = local.status !== mapped.status;
        const totalDiff = local.total !== mapped.total;
        const notesDiff = local.notes !== mapped.notes;
        const tableDiff = local.tableNumber !== mapped.tableNumber;

        if (itemsDiff || statusDiff || totalDiff || notesDiff || tableDiff) {
          localOrders[idx] = { ...local, ...mapped };
          modified = true;
        }
      }
    });

    // عزل وتصفية الطلبات: تنظيف أي طلبات تخص مطعماً آخر أو محذوفة
    localOrders = localOrders.filter(o => (!o.restaurant_id || o.restaurant_id === restId) && !isCaptainOrderTombstoned(o.id));

    if (modified) {
      localOrders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setStoredData('orders', localOrders);
      renderTablesGrid();
      renderCaptainActiveOrders();
    }
  } catch (e) {
    console.warn("Captain syncOrdersFromSupabase error:", e);
  }
}

// -------------------------------------------------------------
// مزامنة أطباق وأقسام المنيو لحظياً مع سحابة Supabase للكابتن
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

      // إعادة رسم المنيو في الشاشة فوراً
      if (typeof renderCaptainCategories === 'function') renderCaptainCategories();
      if (typeof renderCaptainDishes === 'function') renderCaptainDishes();
    }
  } catch (err) {
    console.warn("Supabase captain menu sync error:", err);
  }

  // اشتراك Realtime لحظي للكابتن
  if (client && !window._captainMenuRealtimeSubscribed) {
    window._captainMenuRealtimeSubscribed = true;
    try {
      let debounceTimer = null;
      const triggerRealtimeSync = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          syncMenuFromSupabase();
        }, 500);
      };

      client.channel(`public:captain_menu_realtime_${restId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_dishes', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_categories', filter: `restaurant_id=eq.${restId}` }, triggerRealtimeSync)
        .subscribe();
    } catch (e) {
      console.warn("Captain menu realtime error:", e);
    }
  }
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

/* =========================================================
 * تعديل عدد الأفراد / الضيوف على الطاولة للكابتن
 * ========================================================= */
function adjustCaptainGuests(delta) {
  const el = document.getElementById('captain-guests-count');
  if (!el) return;
  let count = parseInt(el.textContent, 10) || 1;
  count = Math.max(1, Math.min(50, count + delta));
  el.textContent = count;
}
window.adjustCaptainGuests = adjustCaptainGuests;

