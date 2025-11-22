# Environment Variables Setup - Troubleshooting

## Error: "Cannot read property 'getConfig' of null"

This error occurs when `react-native-config` native module isn't properly initialized. Follow these steps:

### Step 1: Clean and Rebuild

**For Android:**
```bash
# Clean the project
cd android
./gradlew clean
cd ..

# Rebuild the app
npm run android
```

**For iOS:**
```bash
cd ios
pod install
cd ..
npm run ios
```

### Step 2: Verify .env file exists

Make sure `.env` file exists in the project root:
```bash
# Check if .env exists
ls -la .env

# If not, create it from .env.example
cp .env.example .env
```

### Step 3: Verify Configuration

Check that `android/app/build.gradle` includes:
```gradle
apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
```

And `android/settings.gradle` includes:
```gradle
include ':react-native-config'
project(':react-native-config').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-config/android')
```

### Step 4: Restart Metro Bundler

After making changes, restart Metro:
```bash
# Stop current Metro (Ctrl+C)
# Then restart
npm start -- --reset-cache
```

### Step 5: Full Clean Rebuild (if still not working)

```bash
# Android
cd android
./gradlew clean
rm -rf .gradle build app/build
cd ..
rm -rf node_modules
npm install
npm run android

# iOS
cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..
npm run ios
```

## Current Implementation

The code now handles missing config gracefully with a fallback to default values. If `react-native-config` isn't available, it will:
- Use default API URL: `https://your-api-base-url.com`
- Use default ENV: `development`
- Log a warning to console

This allows the app to run even if the native module isn't initialized, but you should still rebuild to get proper environment variable support.

