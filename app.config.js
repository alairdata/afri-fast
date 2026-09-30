const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
    eas: {
      projectId: '20dad7ed-f831-40ee-a5ed-9458bac13889',
    },
  },
};
