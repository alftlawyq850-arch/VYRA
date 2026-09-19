# VYRA v1.5 Android

1. ثبّت Node.js 20+ وAndroid Studio وJDK 17.
2. من مجلد المشروع:
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```
3. عند استخدام Backend بعيد، عدّل `frontend/js/config.js` إلى HTTPS.
4. لبناء APK تجريبي استخدم Run أو Build APK من Android Studio.
5. للإصدار النهائي استخدم Generate Signed App Bundle / APK مع مفتاح توقيع خاص بك.

ملاحظة: مجلد `android/` وAPK لا يتم تضمينهما هنا لأنهما ينتجان من Capacitor/Android SDK أثناء البناء.
