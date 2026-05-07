# DormDAO Phase 0 Setup Guide

## Prerequisites

- **Node.js** 20+ ([https://nodejs.org/](https://nodejs.org/))
- **Git** ([https://git-scm.com/](https://git-scm.com/))
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli`
- **Supabase CLI**: `npm install -g supabase`
- **iOS Simulator** (macOS) or **Android Emulator**

## 1. Clone & Install

```bash
git clone https://github.com/dormdao/dorm.git
cd dorm
npm install
```

## 2. Local Supabase Setup

Start Supabase locally for development:

```bash
# Start Supabase (Docker required)
supabase start

# After starting, you'll see output with API URL and keys
# Store these in .env.local
```

## 3. Create .env.local

Copy `.env.example` and fill in the values from Supabase:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321  # From supabase start output
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>         # From supabase start output
EXPO_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
EXPO_PUBLIC_DEEP_LINK_SCHEME=dorm
```

### Get Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use existing
3. Enable **Google+ API**
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `dorm://auth`
6. Copy the Client ID to `.env.local`

## 4. Initialize Supabase Database

Run migrations to set up the schema:

```bash
supabase db push
```

This creates:
- `users` table
- `chapters` table
- `chapter_domains` table (for email-based auto-assignment)
- `user_roles` table
- RLS policies

Seed data (16 chapters) is automatically inserted.

## 5. Start Development

### Option A: Expo CLI (Recommended for testing)

```bash
# Run dev server
npm run dev

# Or start for specific platform:
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### Option B: Using EAS Build

For iOS/Android builds via EAS:

```bash
# Requires EAS account: https://expo.dev
eas login

# Build for testing
eas build --platform ios --build-profile development
eas build --platform android --build-profile development
```

## 6. Test the Auth Flow

### Desktop/Web

1. Open `http://localhost:19000/` in browser (from `npm run dev`)
2. Tap "Web" to open in browser

### Mobile

1. Open Expo app on iOS or Android device
2. Scan QR code from dev server
3. Or: Run simulator and use expo-cli to open app

### Test Signup

1. Tap "Send Magic Link"
2. Enter email: `test@berkeley.edu` (auto-assigns Berkeley chapter)
3. Check Inbucket (local email) at `http://localhost:54326/`
4. Copy the magic link, click it in the app
5. Fill in profile (name, bio)
6. Land on home screen showing Berkeley chapter

### Test Different Chapters

Try emails with different domains:

```
test@uoregon.edu      → Oregon chapter
test@cornell.edu      → Cornell chapter
test@umich.edu        → Michigan chapter
test@berkeley.edu     → Berkeley chapter
... (see migrations/0002_seed_chapters.sql for full list)
```

## 7. Lint & Type Check

```bash
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run test          # Jest unit tests
```

## 8. Deploy to Production

### Prepare

1. **Create EAS account**: https://expo.dev
2. **Create Vercel account**: https://vercel.com
3. **Set GitHub secrets** (see `.github/workflows/` files):
   - `EXPO_TOKEN` (EAS token)
   - `VERCEL_TOKEN` (Vercel token)
   - `VERCEL_ORG_ID` (Vercel org)
   - `VERCEL_PROJECT_ID` (Vercel project)
   - `EXPO_PUBLIC_SUPABASE_URL` (production URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (production OAuth)

### Deploy

```bash
# iOS to TestFlight
eas build --platform ios --build-profile production --auto-submit

# Android to Google Play internal testing
eas build --platform android --build-profile production --auto-submit

# Web to Vercel (automatic on push to main)
git push origin main
```

## 9. Troubleshooting

### Magic link not appearing

- Check Inbucket at `http://localhost:54326/`
- Verify `EXPO_PUBLIC_SUPABASE_URL` is correct
- Make sure Supabase is running: `supabase status`

### Chapter not auto-assigned

- Verify email domain is in `chapter_domains` table
- Check `supabase` logs: `supabase logs --edge-functions`
- Confirm auth signup edge function is deployed

### iOS build fails

- Update Xcode: `xcode-select --install`
- Clear Expo cache: `expo doctor --fix-dependencies`
- Reinstall pods: `cd ios && rm -rf Pods && pod install && cd ..`

### Android build fails

- Install Android SDK: `sdkmanager --update`
- Set `ANDROID_HOME`: `export ANDROID_HOME=$HOME/Library/Android/Sdk`
- Clear gradle cache: `./gradlew clean`

## 10. File Structure

```
dorm/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Auth screens (login, verify, profile)
│   │   ├── login.tsx
│   │   ├── verify-email.tsx
│   │   └── complete-profile.tsx
│   └── (app)/                    # Authenticated app
│       ├── (home)/index.tsx      # Chat (Phase 1 placeholder)
│       ├── proposals.tsx         # Voting (Phase 3 placeholder)
│       ├── posts.tsx             # Blog (Phase 2 placeholder)
│       └── settings.tsx          # Settings
├── lib/
│   ├── auth-context.tsx          # Auth state management
│   ├── supabase.ts               # Supabase client
│   └── hooks/                    # Custom React hooks (empty for Phase 0)
├── components/                   # Reusable components (empty for Phase 0)
├── supabase/
│   ├── migrations/               # Database DDL
│   ├── functions/                # Edge Functions
│   └── config.toml               # Local Supabase config
├── .github/workflows/            # CI/CD (EAS, Vercel)
├── package.json                  # Dependencies
├── app.json                       # Expo config
├── tsconfig.json                 # TypeScript config
├── jest.config.js                # Testing config
├── .eslintrc.json                # Linting config
└── README.md                     # Main documentation
```

## 11. Phase 0 Demo Checklist

- [ ] Clone repo, install dependencies
- [ ] Create .env.local with Supabase keys
- [ ] Run `supabase start`
- [ ] Run `supabase db push`
- [ ] Run `npm run dev`
- [ ] Test signup with `test@berkeley.edu`
- [ ] Check magic link in Inbucket
- [ ] Complete profile and land on home screen
- [ ] Verify chapter is "Berkeley"
- [ ] Logout and re-login
- [ ] Run lint + type-check with no errors

## 12. Next Steps (Phase 1)

Once Phase 0 is complete and all tests pass:

1. Create `Phase 1 Chat` tasks in GitHub Issues
2. Begin implementing:
   - Chat channels
   - Messages with realtime updates
   - Threads and reactions
   - Typing indicators & presence

See docs/06-build-plan.md for Phase 1 details.

---

**Questions?** See docs/07-open-questions.md or contact operations@dormdao.org.
