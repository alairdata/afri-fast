# Logga – App Store launch checklist

## A. Apple account
- [x] Enrol in the Apple Developer Program (Individual)
- [x] Register App ID `com.logga.app` with Sign in with Apple

## B. App Store Connect
- [ ] Apps → + → New App: iOS, name `Logga`, bundle ID `com.logga.app`, SKU `logga-1`, Full Access

## C. Sign-in setup
- [ ] Supabase → Authentication → Providers → enable Apple, Client ID `com.logga.app`
- [ ] Supabase → Authentication → URL Configuration → add `logga://auth-callback` to redirect URLs

## D. Code changes
- [x] In-app health disclaimer
- [x] Hide the Apple button on web (web Apple OAuth needs a Services ID + key; native uses the token flow)
- [ ] Create a test account for the Apple reviewer

## E. First build
- [ ] `npx eas-cli login`
- [ ] `eas init`, then `eas build --platform ios --profile production` (sign in to Apple when asked; EAS creates certificates)
- [ ] `eas submit --platform ios`

## F. Test on a real iPhone (TestFlight)
- [ ] Apple sign-in
- [ ] Google sign-in
- [ ] Camera meal scan
- [ ] Notifications
- [ ] Account deletion

## G. Store listing
- [ ] Paste text from `store/app-store-listing.md`
- [ ] Screenshots (6.9" and 6.5" iPhone sizes)
- [ ] Age rating + App Privacy answers
- [ ] Price: Free, pick countries
- [ ] Export compliance: standard HTTPS encryption only

## H. Submit
- [ ] Add test account to review notes
- [ ] Submit for review and answer any questions from Apple
