# Mobile App Development Rules

## Expo Go Testing

### CRITICAL: Startup Procedure (Run in Order)

**Step 1: Start the Android Emulator**
```powershell
# From any directory - starts Pixel_API_34 emulator
Start-Process -FilePath "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -ArgumentList '-avd Pixel_API_34' -WindowStyle Hidden
```

**Step 2: Wait for emulator to boot, then set up ADB reverse**
```powershell
# Wait for device and set up port forwarding
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" wait-for-device
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8085 tcp:8085
```

**Step 3: Start Expo dev server**
```bash
cd apps/mobile
npx expo start --port 8085
```

**Step 4: Open Expo Go with the correct URL (run this command)**
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -a android.intent.action.VIEW -d 'exp://localhost:8085' host.exp.exponent
```

This directly opens Expo Go and connects to `exp://localhost:8085`.

### Quick One-Liner (PowerShell)
```powershell
# Start emulator, wait, set up ADB reverse, start Expo
Start-Process "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -ArgumentList '-avd Pixel_API_34' -WindowStyle Hidden; Start-Sleep 20; & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8085 tcp:8085; cd C:\HealthyMama\Healthymama-convex-vercel\apps\mobile; npx expo start --port 8085
```

### Why Port 8085?
We use port 8085 to avoid conflicts with other services. Always use this port consistently.

### URL Rules
- **USE:** `exp://localhost:8085` (with ADB reverse)
- **DO NOT use:** `exp://10.0.2.2:8085` - causes HTTP protocol errors on Windows
- **DO NOT use:** `exp://192.168.x.x:8085` - causes bundling to hang

### Why localhost Works But IP Address Doesn't

**ADB Reverse (localhost) - WORKS:**
```
Emulator:8085 → USB/ADB Tunnel → Host:8085 → Metro Bundler
```
- Direct tunnel through USB connection
- Bypasses all network complexity
- No firewall issues (ADB is already trusted)
- Fast and reliable for large bundles (5-10MB)

**IP Address (192.168.x.x) - FAILS:**
```
Emulator → Virtual Network → NAT → Windows Firewall → WiFi Stack → Host → Metro
```
- Goes through emulator's virtual network adapter
- Windows Firewall blocks incoming connections on custom ports
- NAT translation adds overhead and potential packet loss
- Metro's chunked HTTP responses can timeout or get corrupted
- Result: "Stuck at bundling" - Expo Go waits for data that never arrives

### Starting the Dev Server
```bash
cd apps/mobile
npx expo start --port 8085 --clear
```

## Configuration Rules

### app.json
- **DO NOT** add `runtimeVersion` during development - it breaks Expo Go
- Only add `runtimeVersion` when setting up EAS Update for production builds

### Environment Variables
Required in `apps/mobile/.env.local`:
```
EXPO_PUBLIC_CONVEX_URL=<your-convex-url>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-key>
EXPO_PUBLIC_API_URL=<your-api-url>
```

## Architecture

### Providers (in _layout.tsx)
The root layout must wrap the app with:
1. `ClerkProvider` - Authentication
2. `ConvexProviderWithClerk` - Backend with auth integration
3. `SafeAreaProvider` - Safe area insets

### Routing (expo-router)
- `app/_layout.tsx` - Root layout with providers
- `app/index.tsx` - Entry point, redirects based on auth
- `app/(auth)/` - Unauthenticated routes
- `app/(app)/` - Authenticated routes

## Common Issues

### "Failed to launch embedded or launchable update"
- Remove `runtimeVersion` from app.json
- Clear Expo Go cache: `adb shell pm clear host.exp.exponent`

### "Stuck at 100% downloading"
- Use `exp://localhost:PORT` instead of `exp://10.0.2.2:PORT`
- Set up ADB reverse: `adb reverse tcp:PORT tcp:PORT`

### Module resolution errors
- Run `bun install` from monorepo root
- Clear Metro cache: `npx expo start --clear`
