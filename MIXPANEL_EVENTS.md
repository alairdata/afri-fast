# Logga: Mixpanel events

Logga uses its **own Mixpanel project** (not So-UnFiltered AI's). The app sends events through Mixpanel's
HTTP API from `src/lib/analytics.js`; the server sends a few from `api/_analytics.js`.

**Setup**
- App: set `EXPO_PUBLIC_MIXPANEL_TOKEN` to the project token (EAS env var / `.env`) before building.
- Server: set `MIXPANEL_TOKEN` (same token) in Vercel.
- With no token set, every analytics call is a silent no-op.

Every event carries `platform` (ios / android / web) and `app_version`. People are identified by their
Supabase user id the moment they sign in, and what they did before sign-up (their anonymous device id)
is merged into their profile.

**User properties** (Mixpanel profile): `$name`, `$email`, `$created`, `last_active_date`,
`onboarding_completed`, `platform`, `total_sessions`, `total_meals`, `total_water_logs`, `total_weight_logs`.

---

## Session
| Event | Properties | Why |
|---|---|---|
| `session_started` | `returning` | Every time the app opens or comes back to the foreground while signed in. DAU, session counts, new vs returning. |
| `session_ended` | `session_duration_seconds`, `logs_this_session` | Fires when the app goes to the background. Engagement and stickiness. |
| `bounce_detected` | `session_duration_seconds` | A visit under 30 seconds. |

## Auth & account
| Event | Properties | Why |
|---|---|---|
| `user_signed_up` | `method` (email) | Acquisition. Fires when the sign-up form is accepted (before the email is confirmed). |
| `email_verified` | none | They tapped the link and landed back in the app. Drop-off from `user_signed_up` = email friction. |
| `user_logged_in` | `method` (credentials / apple / google) | Successful logins by method. |
| `login_failed` | `method`, `error_type` | `email_not_verified`, `rate_limited`, `invalid_credentials`, `oauth_error`. |
| `password_reset_requested` | none | How often people forget. Fired by the app. |
| `password_reset_completed` | none | Server-side. Recovery rate = completed / requested. |
| `user_logged_out`, `account_deleted` | none | Churn signals. |
| `form_validation_error` | `form`, `field` | Sign-up friction (missing fields, weak password). |

## Onboarding
| Event | Properties | Why |
|---|---|---|
| `onboarding_started` | none | Top of the onboarding funnel. |
| `onboarding_screen_viewed` | `screen`, `index` | Screen-by-screen drop-off. |
| `onboarding_completed` | none | Strongly tied to retention. |
| `onboarding_skipped` | none | Left the flow early. |

## The core loop (what Logga is for)
| Event | Properties | Why |
|---|---|---|
| `meal_logged` | `method`, `calories`, `has_photo`, `is_first_meal` | The most important engagement event. `method` shows camera vs text vs recipe. |
| `first_meal_logged` | none | **Activation.** Fires once per user. |
| `activation_milestone` | `total_meals` (3 / 10 / 50) | Depth after activation. |
| `water_logged` | `source` (quick_add / widget), `unit` | Hydration feature usage, and whether the widget is used. |
| `weight_logged` | `unit` | Weigh-ins. |
| `steps_logged` | `steps` | Steps feature usage. |
| `activity_logged` | `type`, `duration_min` | Workouts. |

## Retention
| Event | Properties | Why |
|---|---|---|
| `retention_day` | `day` (1, 3, 7, 14, 30) | First return on or after each milestone day since sign-up. Fires once each. |
| `streak_milestone` | `streak_days` (3, 7, 14, 30, 60, 100) | Consecutive days the app was opened. |
| `notification_opened` | `type` | Which reminders bring people back. |
| `widget_opened` | `target` | Home-screen widget taps. |

## Quality
| Event | Properties | Why |
|---|---|---|
| `client_error` | `message`, `fatal` | Uncaught errors (max 10 per launch). |
| `unhandled_rejection` | `reason` | Silent async failures (web build). |
| `email_sent` | `email_type` (verification / password_reset / ...) | Server-side. Confirms emails go out. |

---

## Funnels to build in Mixpanel

1. **Sign-up to activation:** `user_signed_up` -> `email_verified` -> `user_logged_in` -> `first_meal_logged`.
   Watch the gap between `email_verified` and `user_logged_in`: the app asks people to log in by hand.
2. **Onboarding:** `onboarding_started` -> `onboarding_screen_viewed` (screen: `weight`) -> `onboarding_screen_viewed` (screen: `done`) -> `onboarding_completed`.
3. **Activation depth:** `first_meal_logged` -> `activation_milestone` (3) -> (10) -> (50).
4. **Password recovery:** `password_reset_requested` -> `password_reset_completed` -> `user_logged_in`.
5. **Retention:** `first_meal_logged` -> `retention_day` 1 -> 3 -> 7 -> 14 -> 30.
6. **Sign-up friction:** `form_validation_error` count by `field`, plus `login_failed` by `error_type`.

## Not built yet
- AI-quality events (photo analysis errors / low confidence).
- Rage-tap and idle detection (SUAI tracks these on the web; they are less meaningful on a phone).
- A/B experiment helpers (`assignExperiment` in SUAI).
