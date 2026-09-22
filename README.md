# Auto Future

Auto Future is a desktop automation recorder focused on a simple idea:

> Record it once. Run it whenever you want.

## V0

The first version focuses only on browser automation:

- Desktop app with Electron + TypeScript
- Playwright as the browser engine
- Record clicks, text input and navigation
- Save recordings locally
- Replay a recorded flow in a visible or headless browser
- Architecture prepared for scheduling, variables, recovery and future automation engines

## Run locally

```bash
npm install
npx playwright install chromium
npm start
```

## Current structure

```text
src/
  automation/
    recorder.ts
    runner.ts
  renderer/
    index.html
    app.js
    styles.css
  shared/
    types.ts
  main.ts
```

## Next milestones

1. Improve semantic selectors and fallback strategies
2. Add an automation library screen
3. Add scheduling
4. Add variables and secrets
5. Add screenshots/logs on failure
6. Add "take over from here" recovery
7. Add desktop/API/files engines

## Security

Passwords are never persisted as plain recorded input values. Authentication/session persistence will be implemented separately with encrypted local storage.
