# NAVYHUB private mobile app
## Architecture
- The PWA is the installable web app on the existing HTTPS origin.
- Capacitor 8 is prepared for private iOS and Android shells with app ID `id.navyhub.app`.
- Next.js has a protected server route at `/api/gps`; do not enable static export, as that removes server endpoints and breaks GPS ingestion.
- The private Capacitor shell loads `https://navyhub.app` and requires internet. It does not cache authenticated pages or user records.
## Generate native projects
Run from `src/`:
```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
npx cap open ios
```
Android requires Android Studio and Android SDK. iOS requires macOS and Xcode. Generated native project directories must be committed from the development machine.
## Private distribution
- Android: sign APK/AAB and distribute through a controlled private channel or managed Google Play.
- iOS: use Apple Business Manager Custom Apps, Enterprise distribution where eligible, or ad hoc/TestFlight for testing. Apple signing and organization eligibility are required.
- Never embed Supabase service-role keys in the client.
## Release gates
Test login/session persistence, Admin/non-Admin authorization, file upload/download, GPS permission, camera/file picker, PDF viewing, navigation and logout in both WKWebView and Android WebView. Restrict navigation to the NAVYHUB origin and sign only after device testing.