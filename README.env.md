# Environment Variables Setup

This project uses `react-native-config` to manage environment variables.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` with your actual configuration:
   ```
   API_BASE_URL=https://your-actual-api-url.com
   ENV=development
   ```

## Environment Files

- `.env` - Your local environment variables (not committed to git)
- `.env.example` - Template file showing required variables (committed to git)

## Usage

Access environment variables in your code:

```typescript
import Config from 'react-native-config';

const apiUrl = Config.API_BASE_URL;
const env = Config.ENV;
```

## Platform-Specific Notes

### Android

After updating `.env`, rebuild the app:
```bash
npm run android
```

### iOS

After updating `.env`, run:
```bash
cd ios && pod install && cd ..
npm run ios
```

## Important Notes

- Never commit `.env` file to git (it's in `.gitignore`)
- Always update `.env.example` when adding new variables
- Rebuild the app after changing environment variables
- Environment variables are bundled at build time, not runtime

