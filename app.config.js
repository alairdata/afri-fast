const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  },
};
