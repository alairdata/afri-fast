// What the person meant to do when they tapped Apple / Google: log in to an existing account, or create
// one. Apple and Google sign-in quietly create a brand-new account when none exists, so App.js uses this
// to tell someone who tapped "Log in" that we couldn't find their account (instead of silently signing
// them up). Read once, then forgotten.
let intent = null;

export const setAuthIntent = (value) => { intent = value; };

export const takeAuthIntent = () => {
  const v = intent;
  intent = null;
  return v;
};
