const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    eas: {
      projectId: 'c8c6d227-2004-4d79-ac6d-23ebcd8a8b57',
    },
  },
};
