/**
 * inject-env.js - سكربت الحقن التلقائي لمتغيرات البيئة أثناء البناء في Netlify
 * يقرأ المتغيرات المشفرة SUPABASE_URL و SUPABASE_ANON_KEY من Netlify Environment Variables
 * ويقوم بكتابتها داخل env-config.js ليعمل الموقع عليها بأمان تام
 */

const fs = require('fs');
const path = require('path');

const envConfigPath = path.join(__dirname, 'env-config.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  console.log('>>> [Netlify Build] Injected SUPABASE_URL & SUPABASE_ANON_KEY successfully.');
  const newContent = `/**
 * env-config.js - الإعدادات المركزية لبيانات الربط السحابي (Supabase)
 * تم حقن هذا الملف آلياً أثناء البناء في Netlify
 */
(function (window) {
  'use strict';

  window.__ENV__ = Object.assign(
    {
      SUPABASE_URL: ${JSON.stringify(supabaseUrl.trim())},
      SUPABASE_ANON_KEY: ${JSON.stringify(supabaseAnonKey.trim())}
    },
    window.__ENV__ || {}
  );
})(window);
`;
  fs.writeFileSync(envConfigPath, newContent, 'utf8');
} else {
  console.log('>>> [Netlify Build] No custom environment variables detected. Using default env-config.js settings.');
}
