# Complete Fix Steps for Worklet Error

## Step-by-Step Instructions

### Step 1: Start Metro with Cache Reset
```bash
npx react-native start --reset-cache
```
**Keep this terminal running** - Metro bundler will start and stay running.

### Step 2: Open a NEW Terminal Window
**Important:** Don't close the Metro terminal. Open a **new terminal window/tab**.

### Step 3: Rebuild the Native App

#### For Android:
```bash
# Clean the build
cd android
./gradlew clean
cd ..

# Rebuild and run
npx react-native run-android
```

#### For iOS:
```bash
# Clean and reinstall pods
cd ios
pod deintegrate
pod install
cd ..

# Rebuild and run
npx react-native run-ios
```

### Step 4: Wait for Build to Complete
- The build process will:
  1. Compile native code
  2. Bundle JavaScript with Babel transformations
  3. Install the app on your device/emulator
  4. Connect to Metro bundler

### Step 5: Verify It Works
Once the app launches:
- ✅ No worklet errors in console
- ✅ Bottom sheet should work smoothly
- ✅ Animations should be smooth

## Quick Reference Commands

### All-in-One (Android):
```bash
# Terminal 1 - Start Metro
npx react-native start --reset-cache

# Terminal 2 - Clean and rebuild
cd android && ./gradlew clean && cd .. && npx react-native run-android
```

### All-in-One (iOS):
```bash
# Terminal 1 - Start Metro
npx react-native start --reset-cache

# Terminal 2 - Clean and rebuild
cd ios && pod install && cd .. && npx react-native run-ios
```

## Why Both Steps Are Needed

1. **Metro with --reset-cache**: Clears JavaScript bundle cache so Babel plugin can transform code fresh
2. **Native rebuild**: Recompiles native modules so the worklet runtime initializes properly

Both are required because:
- Metro handles JavaScript bundling and Babel transformations
- Native build handles C++/native code compilation for Reanimated

## Troubleshooting

If you still get worklet errors after these steps:

1. **Check babel.config.js** - Ensure `react-native-reanimated/plugin` is LAST:
   ```javascript
   plugins: [
     'react-native-reanimated/plugin', // MUST BE LAST
   ],
   ```

2. **Verify index.js** - Should have gesture-handler import first:
   ```javascript
   import 'react-native-gesture-handler';
   ```

3. **Check App.tsx** - Should have GestureHandlerRootView:
   ```javascript
   <GestureHandlerRootView style={{ flex: 1 }}>
   ```

4. **Try full clean**:
   ```bash
   # Remove node_modules and reinstall
   rm -rf node_modules
   npm install
   # Then repeat steps above
   ```

