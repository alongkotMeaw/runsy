# Runsy

Runsy is a mobile running tracker built with Expo, React Native, Expo Router, and Firebase Realtime Database.

The app supports:

- account registration and login
- profile and training-goal management
- live run tracking with GPS
- background location tracking during a run
- estimated or sensor-based step tracking
- run history with route snapshots
- dashboard summaries, streaks, records, and achievements

## Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router
- Firebase Authentication
- Firebase Realtime Database
- Expo Location
- Expo Task Manager
- Expo Sensors
- React Native Maps
- React Native View Shot

## Main Features

### 1. Guest Flow

- Landing page for new users
- Register with email, password, and basic profile data
- Login with email or username

### 2. Dashboard

- Shows today stats
- Shows weekly distance vs weekly goal
- Shows latest run insight
- Shows a lightweight leaderboard based on total distance

### 3. Run Tracking

- Requests location permission before starting
- Starts a live session timer
- Tracks GPS route points
- Tracks speed, distance, pace, elevation gain, and calories
- Uses background location updates through `expo-task-manager`
- Saves completed runs to Firebase
- Captures a route snapshot image when possible

### 4. History

- Loads saved runs from Firebase
- Shows summary totals and highlights
- Displays route previews
- Opens a full-screen modal for route images

### 5. Profile

- Shows runner profile, stats, streak, records, and achievements
- Supports profile editing
- Allows weekly goal updates
- Supports logout

## Project Structure

```text
runsy/
  app/
    _layout.tsx
    createLegacyRoute.tsx
    (guest)/
      _layout.tsx
      index.tsx
      Login.tsx
      Register.tsx
    (tabs)/
      _layout.tsx
      Dashboard.tsx
      History.tsx
      Run/
        _layout.tsx
        index.tsx
      Profile/
        _layout.tsx
        index.tsx
        EditProfile.tsx
  components/
    BottomTab.tsx
  services/
    runTrackingService.js
  theme/
    premiumTheme.js
  firebaseConfig.js
  app.config.js
  app.json
  package.json
```

## Important Files

- `app/_layout.tsx`
  Controls whether the user sees guest routes or authenticated routes based on Firebase auth state.

- `app/createLegacyRoute.tsx`
  Bridges Expo Router to a navigation API that looks like older React Navigation usage.

- `services/runTrackingService.js`
  Handles the live run session, background GPS updates, AsyncStorage session state, and stop/save flow support.

- `app/(tabs)/Run/index.tsx`
  Main run screen. Starts a run, syncs session state to UI, collects metrics, captures route snapshots, and saves data to Firebase.

- `firebaseConfig.js`
  Initializes Firebase app, auth persistence, and Realtime Database.

## Environment Variables

Create a local `.env` file from `.env.example`.

Required Firebase variables:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_DATABASE_URL`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

Optional map variable:

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

If the Google Maps key is missing:

- the app still runs
- the run screen shows a map-unavailable message
- route map features are limited

## Example `.env`

See `.env.example`

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef1234567890

EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create your `.env`

Copy `.env.example` to `.env` and replace the placeholder values with your Firebase project values.

Example:

```bash
cp .env.example .env
```

### 3. Configure Firebase

In your Firebase project:

- enable Email/Password authentication
- create a Realtime Database
- make sure your database rules allow authenticated users to read and write their own profile and runs

### 4. Start the project

```bash
npm start
```

### 5. Run on Android

```bash
npm run android
```

### 6. Run on iOS

```bash
npm run ios
```

## Build and Share

This repository already includes `eas.json`, so the recommended way to create a shareable Android build is EAS Build.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

### 3. Make sure env vars are available

Before building, make sure the same Firebase and Google Maps values from your local `.env` are also available to the build environment.

At minimum, these values must exist during build:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_DATABASE_URL`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for map support

### 4. Create a preview APK for sharing

Use this when you want to send the app to a teacher, teammate, or tester.

```bash
eas build --platform android --profile preview
```

Current `preview` profile behavior from `eas.json`:

- distribution: internal
- Android output: APK

After the build finishes:

1. Open the build link from the EAS output.
2. Download the generated `.apk`.
3. Send that APK file or the EAS download link to the tester.

### 5. Create a production Android build

Use this for a more release-like build.

```bash
eas build --platform android --profile production
```

Current `production` profile behavior from `eas.json`:

- distribution: store
- Android output: APK

### 6. Local Android run for development

If you only want to run the app on your own machine/device during development:

```bash
npm run android
```

This is useful for coding and debugging, but it is not the main “send to someone else” flow.

## Recommended Local Workflow

For this project, testing on a native build is recommended, especially for:

- background location tracking
- foreground service behavior on Android
- `react-native-maps`
- route snapshot capture
- pedometer integration

`npm run android` is the safest day-to-day workflow for this repository.

## App Flow

### Authentication Flow

1. User opens the guest home screen.
2. User registers or logs in.
3. Firebase auth state changes.
4. `app/_layout.tsx` switches the app from guest routes to authenticated tab routes.

### Run Tracking Flow

1. User opens the Run screen.
2. The screen asks for location permission.
3. The app starts a live run session and background location updates.
4. `runTrackingService.js` stores the session in AsyncStorage while GPS updates arrive.
5. The UI periodically syncs the stored session into the Run screen.
6. When the user stops the run, the app:
   - stops background tracking
   - reads the final session
   - calculates summary values
   - captures a route image when possible
   - saves the run into Firebase under `users/{uid}/runs`

### History Flow

1. The app loads `users/{uid}/runs`.
2. Runs are sorted from newest to oldest.
3. The screen shows totals, highlights, and each saved run card.
4. If a route image exists, the user can open it in a modal.

### Profile Flow

1. The app loads user profile data and runs.
2. It calculates completion percentage, streak, records, and achievements.
3. The user can open Edit Profile and update stored profile values.

## Firebase Data Shape

This project mainly stores data under:

```text
users/
  {uid}/
    username
    usernameLower
    email
    gender
    weight
    height
    birthDate
    weeklyGoalKm
    createdAt
    updatedAt
    runs/
      {runId}/
        time
        distance
        pace
        route
        mapImage
        steps
        stepSource
        averageSpeedKmh
        elevationGainM
        calories
        createdAt
        startedAt
        endedAt
```

## Tracking and Calculation Notes

- distance is stored in kilometers
- time is stored in seconds
- average speed is stored in km/h
- pace is stored as a display string such as `5:12`
- steps come from the pedometer when available, otherwise they are estimated from distance
- calories are estimated from:

```text
calories = distanceKm * userWeightKg * 1.036
```

- elevation gain is accumulated only from reasonable positive altitude changes
- implausible GPS jumps are filtered before being counted into the run distance

## Scripts

- `npm start` - start Expo dev server
- `npm run android` - build/run Android app
- `npm run ios` - build/run iOS app
- `npm run web` - run on web

## Troubleshooting

### Firebase config missing

If login or register shows a Firebase config error:

- check `.env`
- confirm every required `EXPO_PUBLIC_FIREBASE_*` variable exists
- restart Expo after changing `.env`

### Map unavailable

If the Run screen says the map is unavailable:

- add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env`
- rebuild the app after adding the key

### Background tracking not working as expected

- test on a real device when possible
- use a native Android build for the most reliable results
- make sure location permission is granted

### Username login fails

Login supports both email and username.

If username login fails:

- verify the user document includes `username`
- verify the user document includes `usernameLower`
- verify database rules allow the username lookup query

## Notes and Limitations

- Many screens currently use `// @ts-nocheck`, so TypeScript safety is limited.
- Route snapshot images are captured to device storage first. Depending on environment and device, image availability may be device-specific.
- Google Maps support depends on the API key and native build configuration.
- Background GPS behavior can vary between Android versions and device vendors.

## License

This repository does not currently declare a license.
