# VYRA v1.5 — Social UI Ready

نسخة تطويرية من منصة VYRA مع واجهة اجتماعية موبايل أول.

## الجديد
- شريط تنقل سفلي احترافي.
- الصفحة الرئيسية مع Stories وFeed.
- صفحة إنشاء منشور مستقلة.
- استكشاف وبحث المستخدمين.
- ملف شخصي وإعدادات.
- إشعارات أولية.
- رسائل مع Socket.IO عند توفر الخادم.
- مشاركة المنشور ورفع الصور/الفيديو.
- RTL عربي وتحسينات Mobile UI.
- استمرار التكامل مع Backend v1.3.
- جاهز للتغليف عبر Capacitor.

## تشغيل
```bash
npm install
npm run cap:add
npm run cap:sync
npm run android
```

قبل إصدار Android الحقيقي، ضع عنوان Backend HTTPS في:
`frontend/js/config.js`

مثال:
`API_BASE: "https://api.example.com/api"`
`SOCKET_URL: "https://api.example.com"`

هذه النسخة ما زالت مرحلة تطوير وليست إصدارًا إنتاجيًا نهائيًا.
