# Firebase Auth Functions

This project contains Firebase Cloud Functions for authentication with GitLab and Bitbucket.

## Setup

1. Install Firebase CLI globally:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Initialize the project (if not already):
   ```
   firebase init
   ```
   Select Functions and choose TypeScript.

4. Install dependencies:
   ```
   cd functions
   npm ci
   ```

## Development

- Build the functions: `npm run build`
- Start emulators: `npm run serve`
- Test in shell: `npm run shell`

## Deployment

Deploy to Firebase:
```
npm run deploy
```

View logs:
```
npm run logs
```

## Functions

- `gitlabAuth`: Handles GitLab authentication
- `bitbucketAuth`: Handles Bitbucket authentication