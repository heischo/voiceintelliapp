# Voice Intelligence

A privacy-first desktop application for knowledge workers that transforms voice recordings into structured, actionable content. Record voice notes using a global hotkey, transcribe them locally with whisper.cpp for complete privacy, and enhance the output with AI-powered processing using your choice of LLM providers. The app runs entirely on your machine—your voice data never leaves your computer unless you explicitly choose cloud services. Whether you need clean transcripts, meeting notes, action items, or custom processing, Voice Intelligence streamlines your voice-to-text workflow with a focus on security and user control.

## Features

### Core Recording
- **Push-to-Talk Hotkey** — Configurable global hotkey (default: `Ctrl+Shift+Space`) works from any application
- **Microphone Selection** — Choose from available audio input devices with built-in level testing
- **Audio Visualization** — Real-time 20-bar spectrum display during recording
- **Recording Safeguards** — Minimum 5-second, maximum 3-minute duration with visual warnings

### Speech-to-Text
- **Local Transcription** — whisper.cpp for complete privacy (supports tiny through large models)
- **One-Click Install** — Install whisper.cpp directly from Settings (Windows/macOS)
- **Cloud Fallback** — Optional OpenAI Whisper API when local isn't available
- **Language Support** — English, German, Norwegian, and auto-detection

### AI Enrichment (5 Modes)
| Mode | Description |
|------|-------------|
| **Clean Transcript** | Remove filler words, fix grammar, preserve meaning |
| **Meeting Notes** | Structured notes with topics, decisions, key points |
| **Action Items** | Extract tasks as checkbox lists with assignees/deadlines |
| **Summary** | Concise summary of the content |
| **Custom Prompt** | Your own processing instructions |

### Multiple LLM Providers
- **OpenAI** — GPT-4o, GPT-4o Mini, GPT-4 Turbo
- **OpenRouter** — Unified API access to multiple models
- **Ollama** — Local, privacy-first LLM inference (llama3.2, mistral, gemma2, etc.)

### Flexible Output
- **Clipboard** — Instant copy for quick pasting
- **File** — Save as Markdown (.md) or text (.txt)
- **PDF** — Generate formatted PDF documents
- **Notion** — Send directly to Notion pages or databases

### Additional Features
- **Setup Wizard** — Guided first-run configuration
- **History Management** — Browse past transcriptions with auto-retention settings
- **System Tray** — Quick access and background operation
- **Unsaved Changes Detection** — Confirmation dialogs prevent data loss

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Interface (Next.js/React)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Recording│ │ Settings │ │ History  │ │ Transcript Modal │    │
│  │ Overlay  │ │  Panel   │ │  View    │ │ + Enrichment     │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Tauri IPC
┌─────────────────────────────┴───────────────────────────────────┐
│                    Rust Backend (Tauri v2)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Audio Capture│ │ File System  │ │ Secure Storage (Keychain)│ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                      External Services                          │
│  ┌───────────┐ ┌─────────────┐ ┌───────-──┐ ┌─────────┐         │
│  │whisper.cpp│ │ OpenAI API  │ │OpenRouter│ │ Ollama  │         │
│  │  (local)  │ │ (optional)  │ │(optional)│ │ (local) │         │
│  └───────────┘ └─────────────┘ └────────-─┘ └─────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript 5, Tailwind CSS 3.4 |
| **Desktop Runtime** | Tauri v2 (Rust) |
| **Speech-to-Text** | whisper.cpp (local) / OpenAI Whisper API (cloud) |
| **LLM Processing** | OpenAI, OpenRouter, Ollama |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **Build** | npm, Cargo |

## Setup Guide

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Rust 1.77+** — [Install via rustup](https://rustup.rs/)
- **Git** — [Download](https://git-scm.com/)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/heischo/voiceintelliapp.git
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Install whisper.cpp (for local transcription)

**Option A: Install from within the app (recommended)**
1. Run the app: `npm run tauri:dev`
2. Open **Settings** → **Transcription**
3. Click **"Install whisper.cpp"**
4. Download a model (e.g., "base" for balanced speed/accuracy)

**Option B: Manual installation**

```bash
# macOS (Homebrew)
brew install whisper-cpp

# Windows
# Download from https://github.com/ggerganov/whisper.cpp/releases

# Linux (build from source)
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make

# Download a model
./models/download-ggml-model.sh base.en
```

### Development Mode

```bash
# Run the full Tauri application with hot reload
npm run tauri:dev

# Or run just the web frontend (limited functionality)
npm run dev
```

The app will start on `http://localhost:3001` with the Tauri desktop window.

### Production Build

```bash
# Build the Next.js frontend
npm run build

# Build the Tauri application
npm run tauri:build
```

Build artifacts are created in:
- **Windows**: `src-tauri/target/release/bundle/msi/` and `nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` and `deb/`

## Configuration

### Settings UI

Most configuration is done through the in-app Settings panel (gear icon). This includes:

- Microphone selection and testing
- Global hotkey configuration
- Transcription settings (whisper.cpp path, model, language)
- LLM provider selection and API keys
- Enrichment mode defaults
- Output integrations (Notion)
- History retention period
- Notification preferences

### Secure Key Storage

API keys are stored securely in your operating system's keychain/credential manager:
- **Windows**: Credential Manager
- **macOS**: Keychain
- **Linux**: Secret Service API (libsecret)

Keys are **never** stored in plain text files or environment variables.

### Environment Variables (Optional)

For development overrides, create a `.env.local` file:

```env
# Development overrides (optional)
DEFAULT_HOTKEY=CommandOrControl+Shift+Space
DEFAULT_LANGUAGE=en

# Note: API keys should be entered through the Settings UI
# for secure storage. These env vars are for testing only.
```

### Whisper Models

| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| tiny | ~75 MB | Fastest | Basic | Quick notes, testing |
| base | ~141 MB | Fast | Good | Daily use (recommended) |
| small | ~465 MB | Medium | Better | Important recordings |
| medium | ~1.5 GB | Slow | High | Professional transcription |
| large | ~3 GB | Slowest | Best | Maximum accuracy |

Use `.en` variants (e.g., `base.en`) for English-only content—they're smaller and faster.

## Design Decisions

### Why Tauri over Electron?

- **Smaller bundle size** — Tauri apps are typically 5-10x smaller than Electron
- **Lower memory usage** — Uses native webview instead of bundled Chromium
- **Rust backend** — Better security and performance for system operations
- **Native OS integration** — Direct access to keychain, file dialogs, notifications

### Why whisper.cpp over Cloud-Only?

- **Privacy** — Audio never leaves your machine
- **Offline capability** — Works without internet connection
- **Cost** — No API charges for transcription
- **Speed** — No network latency for short recordings

### Why Multiple LLM Providers?

- **User choice** — Use preferred provider based on cost, speed, or privacy
- **Ollama support** — Complete local processing for maximum privacy
- **Flexibility** — Switch providers without changing workflow

### Why Next.js with Static Export?

- **React ecosystem** — Rich component library and hooks
- **Static generation** — No server needed for Tauri integration
- **TypeScript support** — Type safety across the codebase
- **Tailwind CSS** — Rapid UI development with consistent styling

## Usage

### First Run

On first launch, the Setup Wizard guides you through:

1. **Welcome** — Introduction to Voice Intelligence
2. **Microphone** — Select and test your audio input
3. **Transcription** — Choose local (whisper.cpp) or cloud (OpenAI)
4. **API Keys** — Configure required keys (if using cloud services)
5. **Complete** — Summary of your configuration

You can skip the wizard and configure settings manually later.

### Recording Workflow

1. **Start Recording**
   - Press and hold the global hotkey (`Ctrl+Shift+Space`), OR
   - Click the microphone button in the app

2. **During Recording**
   - Watch the audio level visualization
   - Timer shows elapsed time (max 3 minutes)
   - Release hotkey or click Stop to finish

3. **After Recording**
   - Transcription runs automatically
   - View raw transcript in the modal

4. **Enrich Content**
   - Select an enrichment mode
   - Click "Enrich Transcript"
   - View the AI-processed result

5. **Output**
   - Select destination (clipboard, file, Notion, PDF)
   - Content is sent to your chosen target
   - Click "Done" or "Start Fresh"

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Start/Stop Recording | `Ctrl+Shift+Space` (configurable) |

Alternative hotkeys available in Settings:
- `Ctrl+Shift+R`
- `Ctrl+Shift+V`
- `Alt+Space`
- `Ctrl+Space`

## Application Structure (UI Tree)

```
Voice Intelligence App
│
├── Header
│   ├── Logo + Title
│   ├── [History] → Opens History Modal
│   │   └── List of past recordings
│   │       ├── Timestamp, mode, duration
│   │       ├── Raw transcript (expandable)
│   │       └── Enriched content (expandable)
│   └── [Settings] → Opens Settings Modal
│       ├── Microphone Section
│       │   ├── Device selector dropdown
│       │   └── [Test Microphone] → Shows audio level
│       ├── Global Hotkey Section
│       │   └── Hotkey combination selector
│       ├── Transcription Section
│       │   ├── Language selector
│       │   ├── whisper.cpp configuration
│       │   │   ├── [Install whisper.cpp] → Downloads binary
│       │   │   ├── [Browse...] → Select custom path
│       │   │   └── Model manager
│       │   │       ├── Installed models list
│       │   │       ├── [Download] → Installs model
│       │   │       └── [Delete] → Removes model
│       │   └── Cloud Fallback (OpenAI Whisper)
│       │       └── API key input (masked)
│       ├── LLM Provider Section
│       │   ├── Provider selector (OpenAI/OpenRouter/Ollama)
│       │   ├── Model selector (provider-specific)
│       │   ├── API key input (for cloud providers)
│       │   └── [Test Connection] → Validates setup
│       ├── Enrichment Section
│       │   ├── Default mode selector
│       │   └── Auto-enrich toggle
│       ├── Output Integrations Section
│       │   ├── Notion configuration
│       │   │   ├── API key input
│       │   │   ├── [Connect] → Tests connection
│       │   │   └── Default destination selector
│       │   └── Google Drive (coming soon)
│       ├── History Section
│       │   ├── Retention period slider (1-30 days)
│       │   └── Notifications toggle
│       ├── About Section
│       │   └── Version info, component status
│       └── Footer
│           ├── [Cancel] → Discards changes
│           └── [Save] → Persists settings
│
├── Status Bar
│   ├── Hotkey status indicator (green/red)
│   ├── Current hotkey display
│   └── STT warning (if not configured) → Opens Settings
│
├── Main Content Area
│   │
│   ├── [Idle State]
│   │   ├── Large microphone button → Starts recording
│   │   └── Hotkey hint text
│   │
│   ├── [Recording State] (Overlay)
│   │   ├── Animated recording indicator
│   │   ├── Duration timer (mm:ss)
│   │   ├── Audio level bars (20-bar spectrum)
│   │   ├── Time warning (< 30 seconds remaining)
│   │   ├── Hotkey release hint (if started via hotkey)
│   │   ├── [Stop] → Ends recording, starts transcription
│   │   └── [Cancel] → Discards recording
│   │
│   ├── [Transcribing State]
│   │   └── Spinner with "Transcribing audio..."
│   │
│   ├── [Error State]
│   │   ├── Error message + details
│   │   ├── Troubleshooting suggestions
│   │   ├── [Try Again] → Clears error
│   │   └── [Open Settings] → Opens Settings
│   │
│   └── [Transcript Ready State] (Modal)
│       ├── Header: "Transcript" + [X] close button
│       ├── Recording section
│       │   ├── Raw transcript text
│       │   └── [New Recording] → Starts fresh recording
│       ├── Enrichment Mode Selector
│       │   ├── ○ Clean Transcript
│       │   ├── ○ Meeting Notes
│       │   ├── ○ Action Items
│       │   ├── ○ Summary
│       │   └── ○ Custom Prompt
│       │       └── Custom prompt text input
│       ├── Output Target Selector
│       │   ├── ○ Clipboard → Copies to clipboard
│       │   ├── ○ File → Opens save dialog
│       │   ├── ○ PDF → Generates PDF file
│       │   └── ○ Notion → Sends to Notion
│       ├── [Enrich Transcript] → Processes with selected mode
│       ├── Enriched Content section (after enrichment)
│       │   └── Processed text display
│       └── Footer
│           ├── [Start Fresh] → Clears transcript, returns to idle
│           └── [Done] → Closes modal, keeps transcript accessible
│
├── [Previous Transcript Link] (when modal closed but transcript exists)
│   └── "View previous transcript" → Reopens modal
│
└── Footer
    ├── App tagline
    └── Version number (vX.X.X)
```

## Development

### Available Scripts

```bash
# Development
npm run dev          # Next.js dev server (port 3001)
npm run tauri:dev    # Full Tauri app with hot reload

# Testing
npm test             # Run unit tests (Vitest)
npm run test:watch   # Unit tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:e2e     # Run E2E tests (Playwright)
npm run test:e2e:ui  # E2E with interactive UI
npm run test:e2e:headed # E2E with visible browser

# Code Quality
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check

# Build
npm run build        # Build Next.js for production
npm run tauri:build  # Build Tauri application

# Versioning
npm run version:patch # Bump patch version (0.0.X)
npm run version:minor # Bump minor version (0.X.0)
npm run version:major # Bump major version (X.0.0)
npm run version:check # Check version sync
```

### Project Structure

```
voice-intelligence/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── page.tsx            # Main recorder page
│   │   ├── layout.tsx          # Root layout
│   │   ├── settings/           # Settings page route
│   │   └── history/            # History page route
│   │
│   ├── components/             # React components
│   │   ├── RecordingOverlay.tsx    # Recording UI + waveform
│   │   ├── SetupWizard.tsx         # First-run guide
│   │   ├── SettingsPanel.tsx       # Comprehensive settings
│   │   ├── EnrichmentModeSelector.tsx
│   │   ├── OutputRouter.tsx        # Output target selector
│   │   ├── HistoryView.tsx         # Transcription history
│   │   └── MicrophoneSelector.tsx
│   │
│   ├── hooks/                  # React custom hooks
│   │   ├── useRecording.ts     # Audio capture, WAV encoding
│   │   ├── useHotkey.ts        # Global shortcut registration
│   │   ├── useLLM.ts           # LLM provider abstraction
│   │   └── useSettings.ts      # Settings state management
│   │
│   ├── services/               # Business logic
│   │   ├── llm-router.ts       # Provider-agnostic LLM routing
│   │   ├── enrichment.ts       # Prompt templates for 5 modes
│   │   └── stt.ts              # Speech-to-text orchestration
│   │
│   ├── providers/              # LLM implementations
│   │   ├── openai.ts           # OpenAI GPT integration
│   │   ├── openrouter.ts       # OpenRouter API adapter
│   │   └── ollama.ts           # Local Ollama support
│   │
│   ├── lib/                    # Utilities
│   │   ├── api.ts              # Tauri IPC wrapper
│   │   ├── config.ts           # Default configuration
│   │   ├── notion.ts           # Notion API client
│   │   └── pdf.ts              # PDF generation
│   │
│   ├── types/                  # TypeScript definitions
│   │   ├── index.ts            # Core app types
│   │   └── llm.ts              # LLM provider types
│   │
│   └── tests/                  # Test suites
│       ├── unit/               # Vitest unit tests
│       └── e2e/                # Playwright E2E tests
│
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── lib.rs              # Tauri app initialization
│   │   ├── commands.rs         # IPC command implementations
│   │   └── main.rs             # Entry point
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
│
├── public/                     # Static assets
├── package.json                # Node.js dependencies
├── tailwind.config.ts          # Tailwind CSS configuration
├── next.config.mjs             # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── playwright.config.ts        # E2E test configuration
└── .env.example                # Environment template
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main application UI and state |
| `src/hooks/useRecording.ts` | Audio capture and WAV encoding |
| `src/services/stt.ts` | Speech-to-text provider orchestration |
| `src/services/llm-router.ts` | LLM provider abstraction layer |
| `src/lib/api.ts` | Tauri IPC command wrappers |
| `src-tauri/src/commands.rs` | Rust backend commands |
| `src-tauri/tauri.conf.json` | Desktop app configuration |

## Security & Privacy

Voice Intelligence is built with privacy as a core principle.

### Data Flow

```
┌─────────────┐      ┌──────────────┐     ┌─────────────┐
│   Your      │────▶│  Your        │────▶│   Your      │
│   Voice     │      │  Computer    │     │   Output    │
└─────────────┘      └──────────────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │   Optional   │
                    │  Cloud APIs  │
                    │ (opt-in only)│
                    └──────────────┘
```

### Privacy Features

| Feature | Description |
|---------|-------------|
| **Local-First Processing** | whisper.cpp and Ollama run entirely on your machine |
| **No Telemetry** | Zero analytics, tracking, or data collection |
| **Secure Key Storage** | API keys stored in OS keychain, never in files |
| **Optional Cloud** | Cloud APIs (OpenAI, OpenRouter) are strictly opt-in |
| **Data Retention Control** | Configure history cleanup (1-30 days or never) |
| **Open Source** | Full code transparency for security auditing |

### What Data Stays Local

- All audio recordings (processed in memory, not saved)
- whisper.cpp transcriptions
- Ollama LLM processing
- Settings and preferences
- History entries

### What Can Be Sent to Cloud (Only If Configured)

- Audio for OpenAI Whisper API transcription
- Text for OpenAI/OpenRouter LLM enrichment
- Content for Notion integration

### Best Practices

1. **Maximum Privacy**: Use whisper.cpp + Ollama for fully local processing
2. **API Key Safety**: Never share API keys; they're stored encrypted
3. **Regular Cleanup**: Enable history retention to auto-delete old transcripts

## Troubleshooting

### Hotkey Not Working

**Symptoms**: Green indicator is red, or hotkey doesn't trigger recording

**Solutions**:
1. Check if another application is using the same hotkey
2. Try a different hotkey combination in Settings
3. **macOS**: Grant Accessibility permissions
   - System Preferences → Security & Privacy → Privacy → Accessibility
   - Add Voice Intelligence to the list
4. **Windows**: Run as Administrator (if needed for certain hotkeys)
5. Restart the application after changing hotkey settings

### Transcription Fails

**Symptoms**: Error message after recording, no transcript generated

**Solutions**:
1. **Check whisper.cpp installation**:
   - Open Settings → Transcription
   - Verify whisper.cpp path is valid
   - Ensure at least one model is downloaded
2. **Test with cloud fallback**:
   - Add OpenAI API key in Settings
   - Try recording again (will use cloud if local fails)
3. **Check model compatibility**:
   - For non-English audio, ensure a multilingual model is installed (not `.en` variant)
4. **Verify audio input**:
   - Test microphone in Settings
   - Check system audio permissions

### LLM Enrichment Fails

**Symptoms**: "Enrich Transcript" shows error or returns nothing

**Solutions**:
1. **Verify API key**:
   - Check key is entered correctly in Settings
   - Test with provider's API directly
2. **Check Ollama** (if using local):
   - Ensure Ollama is running: `ollama serve`
   - Verify model is pulled: `ollama list`
3. **Network issues**:
   - Check internet connection (for cloud providers)
   - Verify no firewall blocking

### Build Errors

**Symptoms**: `npm run build` or `npm run tauri:build` fails

**Solutions**:
```bash
# Clear caches and reinstall
rm -rf node_modules .next out
npm install
npm run build

# Rust-specific issues
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

### Audio Not Recording

**Symptoms**: Recording starts but audio level stays at zero

**Solutions**:
1. Check microphone permissions in system settings
2. Select correct microphone in app Settings
3. Test microphone with system audio recorder
4. Try a different microphone/audio device

## Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork:
   ```bash
   git clone https://github.com/heischo/voiceintelliapp.git
   ```
3. **Install** dependencies: `npm install`
4. **Create** a feature branch: `git checkout -b feature/my-feature`
5. **Make** your changes
6. **Test** your changes:
   ```bash
   npm test           # Unit tests
   npm run test:e2e   # E2E tests
   npm run lint       # Linting
   npm run typecheck  # Type checking
   ```
7. **Commit** with a clear message: `git commit -m "Add my feature"`
8. **Push** to your fork: `git push origin feature/my-feature`
9. **Open** a Pull Request on GitHub

### Code Style

- TypeScript with strict mode enabled
- Functional React components with hooks
- Tailwind CSS for styling
- ESLint configuration provided

### Areas for Contribution

- New LLM provider integrations
- Additional output targets (Google Drive, etc.)
- UI/UX improvements
- Documentation and translations
- Bug fixes and performance optimizations

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Heiko F. Scholze 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See [LICENSE](./LICENSE) for the full text.

## Acknowledgments

Voice Intelligence is built on the shoulders of giants:

- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** — Georgi Gerganov's incredible C++ port of OpenAI Whisper, enabling fast local transcription
- **[Tauri](https://tauri.app/)** — The framework that makes building secure, lightweight desktop apps with web technologies possible
- **[Next.js](https://nextjs.org/)** — Vercel's React framework powering our frontend
- **[OpenAI](https://openai.com/)** — For Whisper and GPT models that set the standard for AI capabilities
- **[OpenRouter](https://openrouter.ai/)** — Unified API access to the world's best AI models
- **[Ollama](https://ollama.ai/)** — Making local LLM inference accessible to everyone
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS that makes styling a joy
- **[Notion](https://notion.so/)** — For their excellent API enabling seamless integration

Special thanks to the open-source community and all contributors who help make Voice Intelligence better.

---

**Voice Intelligence** — Your voice, your data, your control.
