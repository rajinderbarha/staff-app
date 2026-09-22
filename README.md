# Fuvay — Staff App

Expo React Native app for field technicians (iOS + Android).

## Screens

| Screen | Description |
|---|---|
| Login | Phone + password → stores 5 keys in AsyncStorage |
| Home | Active job card, today's stats, upcoming jobs |
| Jobs | Status tabs (All/Assigned/In Progress/Done) |
| Job Detail | Status transitions, close modal, GPS tracking, Call customer |
| Chat | Room list → message thread |
| Earnings | Total earned, commission records |
| Profile | Performance signals, schedule edit, logout |

## Running

```bash
npm install
npx expo start            # → scan QR with Expo Go app
npx expo run:ios          # iOS simulator
npx expo run:android      # Android emulator
```

## Building for Distribution

Project: `@trainee05/serviceos-staff` (the EAS project ID lives in `app.json`
under `extra.eas.projectId`).

### Development build (custom dev client, replaces Expo Go)

```bash
# From mobile/staff-app. Android only -- an iOS dev build needs a Mac.
EAS_NO_VCS=1 EAS_PROJECT_ROOT="$PWD" npx eas-cli build --platform android --profile development
```

Install the resulting APK on the device, then run `npx expo start --dev-client`
and scan the QR code.

**Both env vars are required, and neither is optional flavour:**

- `EAS_NO_VCS=1` -- `mobile/` is untracked in this repo (upstream deleted it),
  so the default git-archive upload would ship a project with no source in it.
- `EAS_PROJECT_ROOT="$PWD"` -- with `EAS_NO_VCS=1`, eas-cli resolves the archive
  root from `git rev-parse --show-toplevel`, i.e. the **monorepo root**. That
  makes it read a `.easignore` that is not there and upload the entire repo
  (~262 MB) instead of just this app (~3 MB). Pointing it here makes the
  local `.easignore` apply.

### Preview / production

```bash
npm install -g eas-cli
eas login
eas build --platform all --profile preview   # internal distribution
eas build --platform all --profile production
```

## Environment

```env
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_API_BASE_URL=https://api.serviceos.in
```

## Tests

```bash
npm test -- --runInBand
```

## Connecting to Backend

```bash
# 1. Copy env file
cp .env.example .env

# 2. For iOS simulator or web on the backend machine:
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000

# 3. For Android emulator, use the host-loopback address instead:
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000

# 4. For physical device — use your computer's local IP:
#    Find it: ipconfig (Windows) | ifconfig (Mac) | ip addr (Linux)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000

# 5. Start backend, then app
uvicorn app.main:app --host 0.0.0.0 --port 8000   # --host 0.0.0.0 for device access
cd mobile/staff-app && npx expo start
```
