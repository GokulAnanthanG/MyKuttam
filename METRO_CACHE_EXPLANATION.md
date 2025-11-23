# Metro Cache Configuration - Explanation

## ❌ What DOESN'T Work

The following is **NOT** a valid Metro config option:

```javascript
const config = {
  resetCache: true // ❌ This is NOT a valid Metro config option
};
```

**Why it doesn't work:**
- Metro bundler doesn't have a `resetCache` property in its config
- This property is ignored by Metro
- If it "worked" for someone, it was likely due to:
  - Restarting Metro (which naturally clears some cache)
  - Rebuilding the app
  - Other changes made simultaneously

## ✅ Correct Ways to Reset Metro Cache

### Method 1: CLI Flag (Recommended)
```bash
npx react-native start --reset-cache
```

### Method 2: Clear Cache Manually
```bash
# Stop Metro, then:
rm -rf /tmp/metro-*
rm -rf /tmp/haste-*
rm -rf node_modules/.cache

# On Windows PowerShell:
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
```

### Method 3: Programmatic (in metro.config.js)
If you want to force cache clearing programmatically, you can use:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  // Metro config options here
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'cjs', 'json'],
  },
  // Note: There's no resetCache option
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

## 🔍 Why the Worklet Error Occurs

The worklet error happens because:

1. **Babel Plugin Transformation**: The `react-native-reanimated/plugin` transforms your code during the build process
2. **Cache Issue**: Metro caches the transformed code, but if the plugin wasn't configured when the cache was created, you get stale code
3. **Native Rebuild Needed**: The native modules also need to be rebuilt to initialize the worklet runtime

## ✅ Proper Solution for Worklet Error

### Step 1: Ensure Babel Config is Correct
```javascript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin', // MUST BE LAST
  ],
};
```

### Step 2: Clear Metro Cache
```bash
npx react-native start --reset-cache
```

### Step 3: Rebuild Native App
```bash
# Android
cd android && ./gradlew clean && cd ..
npx react-native run-android

# iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

## 📝 Your Current Setup

Your current `metro.config.js` is correct:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'cjs', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

**Don't add `resetCache: true`** - it's not a valid option and won't do anything.

## 🎯 Summary

- ❌ `resetCache: true` in metro.config.js is **NOT valid**
- ✅ Use `npx react-native start --reset-cache` instead
- ✅ Rebuild the native app after clearing cache
- ✅ Your current metro.config.js is already correct

