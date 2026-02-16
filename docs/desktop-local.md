# Desktop (macOS) — Local Setup

## How it works

The desktop app uses [Tauri](https://tauri.app/) to wrap the web frontend in a native macOS window. A local Python backend sidecar is bundled and launched by the desktop app on port `8081`.

When running in desktop mode, Vite loads `frontend/.env.desktop` which points the frontend at `localhost:8081`. The Tauri shell connects to this local backend sidecar process.

```
┌─────────────────────┐       ┌──────────────────────────────┐
│   Tauri (native)    │       │  Bundled backend sidecar     │
│                     │       │                              │
│   React frontend    │──────▶│   API         (port 8081)    │
│   (.env.desktop)    │       │   SQLite DB (local file)     │
│                     │       │   In-memory cache/pubsub      │
└─────────────────────┘       └──────────────────────────────┘
```

## Requirements

- Node.js
- Rust

## Dev workflow

1. In `frontend/`:
   ```sh
   npm install
   npm run desktop:dev
   ```

## Build (unsigned dev)

```sh
cd frontend && npm run desktop:build
```

The app bundle will be at `frontend/src-tauri/target/release/bundle/macos/Claudex.app`.

## Troubleshooting

- **Backend unavailable**: Wait for the desktop sidecar to finish starting.
- **Database errors**: Desktop uses a local SQLite database file in your app data directory.
- **Port conflict**: Desktop uses port `8081`; stop other local services using that port.
