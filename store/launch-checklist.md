# Logga – App Store launch checklist

## A. Apple account
- [x] Enrol in the Apple Developer Program (Individual)
- [x] Register App ID `com.logga.app` with Sign in with Apple

## B. App Store Connect
- [x] Apps → + → New App: iOS, name `Logga`, bundle ID `com.logga.app`, SKU `logga-1`, Full Access

## C. Sign-in setup
- [x] Supabase → Authentication → Providers → enable Apple, Client ID `com.logga.app`
- [x] Supabase → Authentication → URL Configuration → add `logga://auth-callback` to redirect URLs

## D. Code changes
- [x] In-app health disclaimer
- [x] Hide the Apple button on web (web Apple OAuth needs a Services ID + key; native uses the token flow)
- [ ] Create a test account for the Apple reviewer

## E. First build
- [x] `npx eas-cli login`
- [x] `eas init`, then `eas build --platform ios --profile production` (sign in to Apple when asked; EAS creates certificates)
- [x] `eas submit --platform ios`

## F. Test on a real iPhone (TestFlight)
- [x] Apple sign-in
- [x] Google sign-in
- [x] Camera meal scan
- [x] Notifications
- [x] Account deletion

## G. Store listing
- [x] Paste text from `store/app-store-listing.md`
- [x] Screenshots (6.9" and 6.5" iPhone sizes)
- [x] Age rating + App Privacy answers
- [x] Price: Free, pick countries
- [x] Export compliance: standard HTTPS encryption only

## H. Submit
- [ ] Add test account to review notes
- [ ] Submit for review and answer any questions from Apple
