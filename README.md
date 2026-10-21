# Pool Night Tracker

Files: `index.html`, `styles.css`, `app.js`, `firebase-config.js` (keep all four in one folder).

Firestore rules (games can be undone; players can never be deleted):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pool_players/{id} { allow read, create, update: if true; allow delete: if false; }
    match /pool_games/{id}   { allow read, create, update, delete: if true; }
    match /meta/{id}         { allow read, create: if true; }
  }
}
```
