#!/bin/bash
# Vercel build: the website (logga.space), the web app (logga.space/app) and the static pages and files from public/.
set -e
npx expo export:web
# The app's page moves to app.html (served at /app) and the website takes index.html.
mv web-build/index.html web-build/app.html
cp public/home.html web-build/index.html
cp public/{google6d3904b783f66eb3.html,privacy.html,terms.html,auth-callback.html,confirm-email.html,reset-password.html,logga-wordmark.png,sw.js,manifest.json,apple-touch-icon.png,icon-192.png,icon-512.png} web-build/
cp -r public/food web-build/food
cp -r public/site web-build/site
