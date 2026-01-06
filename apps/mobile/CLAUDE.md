# Mobile App Development Rules

## Expo Go Testing

### URL for Android Emulator
Always use `localhost` with ADB reverse port forwarding:

```bash
# Set up port forwarding (run once per session)
adb reverse tcp:8081 tcp:8081

# Or for custom port
adb reverse tcp:8090 tcp:8090
```

Then use this URL in Expo Go:
```
exp://localhost:8081
```

**DO NOT use** `exp://10.0.2.2:8081` - it causes HTTP protocol errors on Windows.

### Starting the Dev Server
```bash
cd apps/mobile
npx expo start --clear
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
