# Fix Worklet Error - Step by Step

## The Problem
The "Failed to create a worklet" error occurs because `react-native-reanimated` needs its Babel plugin to transform code, and this only happens during a full rebuild.

## Solution

### For Android:

1. **Stop Metro bundler** (if running)

2. **Clean Android build:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

3. **Clear Metro cache and rebuild:**
   ```bash
   # Clear watchman (if installed)
   watchman watch-del-all
   
   # Clear Metro cache
   rm -rf node_modules/.cache
   rm -rf /tmp/metro-*
   rm -rf /tmp/haste-*
   
   # On Windows PowerShell:
   Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
   ```

4. **Rebuild the app:**
   ```bash
   npx react-native run-android
   ```

### For iOS:

1. **Stop Metro bundler** (if running)

2. **Clean iOS build:**
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   ```

3. **Clear Metro cache:**
   ```bash
   watchman watch-del-all
   rm -rf node_modules/.cache
   rm -rf /tmp/metro-*
   rm -rf /tmp/haste-*
   ```

4. **Rebuild the app:**
   ```bash
   npx react-native run-ios
   ```

### Alternative: Manual Metro Start

If you prefer to start Metro separately:

1. **Terminal 1 - Start Metro with cache reset:**
   ```bash
   npx react-native start --reset-cache
   ```

2. **Terminal 2 - Rebuild app:**
   ```bash
   # For Android:
   cd android && ./gradlew clean && cd .. && npx react-native run-android
   
   # For iOS:
   cd ios && pod install && cd .. && npx react-native run-ios
   ```

## Why This Happens

The `react-native-reanimated/plugin` in `babel.config.js` transforms JavaScript code into worklets during the build process. If you only reload the app (R+R), the transformation doesn't happen because:

- The Babel plugin runs during Metro bundling
- Native modules need to be recompiled
- The worklet runtime needs to be initialized

## Verification

After rebuilding, the error should be gone. The bottom sheet should work smoothly with animations.

## If Error Persists

1. Check `babel.config.js` - ensure `react-native-reanimated/plugin` is LAST in plugins array
2. Verify `react-native-reanimated` version matches `@gorhom/bottom-sheet` requirements
3. Try removing `node_modules` and reinstalling:
   ```bash
   rm -rf node_modules
   npm install
   # Then rebuild
   ```
