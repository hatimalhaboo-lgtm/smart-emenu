/**
 * env-config.js - الإعدادات المركزية لبيانات الربط السحابي (Supabase)
 * يتم تعديل هذا الملف تلقائياً عند توليد حزمة مطعم جديد أو عبر Netlify Build
 */
(function (window) {
  'use strict';

  window.__ENV__ = Object.assign(
    {
      SUPABASE_URL: "https://dpuawlhffopwwgktudxb.supabase.co",
      SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdWF3bGhmZm9wd3dna3R1ZHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjIzNDEsImV4cCI6MjEwNTkzODM0MX0.elHAxE_xiETRNalGYxkHMO4sWzIoe7_FRmbftshVMHQ"
    },
    window.__ENV__ || {}
  );
})(window);
