# Voice Intelligence

A privacy-first desktop voice application for knowledge workers. Record voice notes, transcribe them locally using whisper.cpp, and enrich the content with AI-powered processing.

## Features

- **Setup Wizard** - Guided first-run setup for microphone, transcription, and API configuration
- **Microphone Selection** - Choose and test your preferred microphone
- **Global Hotkey Activation** - Press `Ctrl+Shift+Space` (configurable) to start/stop recording from any application
- **Local Transcription** - Speech-to-text using whisper.cpp for complete privacy
- **One-Click Whisper Install** - Install whisper.cpp directly from the app (Windows/macOS)
- **Cloud Fallback** - Optional OpenAI Whisper API when local transcription isn't available
- **AI Enrichment** - Process transcripts with 5 built-in modes:
  - Clean Transcript - Remove filler words, fix grammar
  - Meeting Notes - Structured notes with key points
  - Action Items - Extract tasks as a checklist
  - Summary - Concise summary of content
  - Custom Prompt - Use your own processing instructions
- **Multiple LLM Providers** - Support for OpenAI and OpenRouter
- **Flexible Output** - Copy to clipboard or save as Markdown file
- **History Management** - Browse and re-process past transcriptions
- **System Tray** - Quick access from the system tray
- **Multi-language** - Support for English, German, and Norwegian

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Desktop**: Tauri v2 (Rust)
- **Speech-to-Text**: whisper.cpp (local) / OpenAI Whisper API (cloud)
- **LLM**: OpenAI GPT-4o / OpenRouter (multiple models)
- **Testing**: Vitest (unit), Playwright (E2E)

## Prerequisites

- Node.js 18+
- Rust 1.77+
- For local transcription: whisper.cpp (can be installed from within the app)

### Installing whisper.cpp

You can install whisper.cpp directly from the app:

1. Open **Settings** > **Transcription**
2. Click **"Install whisper.cpp"**
3. The app will download and set up whisper.cpp automatically

Or install manually:

```bash
# macOS
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

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/voice-intelligence.git
cd voice-intelligence

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Configuration

### Environment Variables

Create a `.env.local` file based on `.env.example`:

```env
# Optional: OpenAI API key for cloud transcription and enrichment
OPENAI_API_KEY=sk-...

# Optional: OpenRouter API key for alternative LLM access
OPENROUTER_API_KEY=sk-or-...
```

### Settings

Access settings via the gear icon or navigate to `/settings`:

- **Hotkey**: Choose your preferred activation shortcut
- **LLM Provider**: Select OpenAI or OpenRouter
- **API Key**: Securely stored in your system keychain
- **Enrichment Mode**: Default processing mode
- **Output**: Clipboard or file
- **Language**: Transcription language
- **History Retention**: How long to keep transcriptions

## Usage

### First Run Setup

On first launch, the Setup Wizard will guide you through:

1. **Microphone Selection** - Choose and test your microphone
2. **Transcription Setup** - Install whisper.cpp or configure cloud transcription
3. **API Key Configuration** - Add your OpenAI API key (optional if using whisper.cpp)

### Recording

1. **Start Recording**: Press the global hotkey or click the microphone button
2. **Stop Recording**: Press the hotkey again or click Stop
3. **View Transcript**: The raw transcription appears automatically
4. **Enrich Content**: Select a mode and click "Enrich Transcript"
5. **Output**: Content is copied to clipboard or saved to file

### Keyboard Shortcuts

| Action | Default Shortcut |
|--------|------------------|
| Start/Stop Recording | `Ctrl+Shift+Space` |

## Development

```bash
# Start development server
npm run dev

# Run Tauri in development
npm run tauri:dev

# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run linting
npm run lint

# Type checking
npm run typecheck

# Build for production
npm run build
npm run tauri:build
```

### Project Structure

```
voice-intelligence/
├── src/
│   ├── app/                 # Next.js pages
│   │   ├── page.tsx         # Main recorder page
│   │   ├── settings/        # Settings page
│   │   └── history/         # History page
│   ├── components/          # React components
│   │   ├── RecordingOverlay.tsx
│   │   ├── EnrichmentModeSelector.tsx
│   │   ├── OutputRouter.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── HistoryView.tsx
│   ├── hooks/               # React hooks
│   │   ├── useHotkey.ts
│   │   ├── useRecording.ts
│   │   ├── useLLM.ts
│   │   └── useSettings.ts
│   ├── services/            # Business logic
│   │   ├── llm-router.ts
│   │   ├── enrichment.ts
│   │   └── stt.ts
│   ├── providers/           # LLM providers
│   │   ├── openai.ts
│   │   └── openrouter.ts
│   ├── lib/                 # Utilities
│   │   ├── api.ts           # Tauri IPC wrapper
│   │   └── config.ts        # Configuration
│   ├── types/               # TypeScript types
│   └── tests/               # Test files
│       ├── unit/
│       └── e2e/
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── lib.rs           # Main entry
│   │   └── commands.rs      # IPC commands
│   └── Cargo.toml
├── public/                  # Static assets
└── package.json
```

## Security & Privacy

Voice Intelligence is designed with privacy as a core principle:

- **Local-First Processing**: Transcription uses whisper.cpp locally by default
- **No Data Collection**: We don't collect or transmit any of your data
- **Secure API Key Storage**: API keys are stored in your system's secure keychain
- **Optional Cloud Services**: Cloud APIs are only used when explicitly configured
- **Data Retention Control**: You control how long history is kept

See [PRIVACY.md](./PRIVACY.md) for detailed privacy policy and GDPR compliance information.

## Troubleshooting

### Hotkey Not Working

- Ensure no other application is using the same hotkey
- Try a different hotkey combination in Settings
- On macOS, grant Accessibility permissions to the app

### Transcription Fails

- Verify whisper.cpp is installed: `whisper --help`
- Check that a model is downloaded
- Try the cloud fallback by configuring an OpenAI API key

### Build Errors

```bash
# Clear caches and reinstall
rm -rf node_modules .next
npm install
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test && npm run test:e2e`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Fast C++ implementation of OpenAI Whisper
- [Tauri](https://tauri.app/) - Build desktop apps with web technologies
- [Next.js](https://nextjs.org/) - React framework
- [OpenAI](https://openai.com/) - GPT and Whisper APIs
- [OpenRouter](https://openrouter.ai/) - Unified LLM API access
