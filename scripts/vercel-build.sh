#!/bin/bash
# Vercel build: the web app plus the static pages and files served from public/.
set -e
npx expo export:web
cp public/{google6d3904b783f66eb3.html,privacy.html,terms.html,auth-callback.html,confirm-email.html,reset-password.html,logga-wordmark.png,sw.js,manifest.json,apple-touch-icon.png,icon-192.png,icon-512.png} web-build/
cp -r public/food web-build/food
