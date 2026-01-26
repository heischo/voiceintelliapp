# Privacy Policy / Datenschutzerklärung

**Last Updated / Zuletzt aktualisiert:** January 2026

---

## English Version

### Overview

Voice Intelligence is a privacy-first desktop application. We are committed to protecting your privacy and ensuring you have full control over your data.

### Data Collection

**We do not collect any data.** Voice Intelligence runs entirely on your local machine. No data is transmitted to our servers because we don't have any servers that receive user data.

### Data Processing

#### Local Processing (Default)

By default, all voice processing happens locally on your device:

- **Audio Recording**: Captured and processed locally using your device's microphone
- **Speech-to-Text**: Transcription is performed locally using whisper.cpp
- **Storage**: All transcriptions and history are stored locally on your device
- **API Keys**: Stored securely in your operating system's keychain/credential manager

#### Optional Cloud Services

If you choose to configure cloud services, the following data may be transmitted:

| Service | Data Transmitted | Purpose |
|---------|------------------|---------|
| OpenAI Whisper API | Audio recordings | Cloud-based transcription |
| OpenAI GPT API | Transcribed text | Text enrichment/processing |
| OpenRouter API | Transcribed text | Text enrichment/processing |

**Important**: Cloud services are entirely optional. You can use Voice Intelligence completely offline with local transcription.

### Data Storage

| Data Type | Storage Location | Retention |
|-----------|------------------|-----------|
| Transcriptions | Local device only | User-configurable (0-30 days) |
| Settings | Local device only | Until manually deleted |
| API Keys | System keychain | Until manually deleted |
| Audio recordings | Temporary files only | Deleted after processing |

### Your Rights

You have complete control over your data:

- **Access**: All data is stored locally and accessible to you
- **Deletion**: Delete history anytime via Settings > Clear All
- **Portability**: Export transcriptions as Markdown files
- **Modification**: Edit retention period in Settings

### Third-Party Services

When using optional cloud services:

- **OpenAI**: Subject to [OpenAI's Privacy Policy](https://openai.com/privacy)
- **OpenRouter**: Subject to [OpenRouter's Privacy Policy](https://openrouter.ai/privacy)

We recommend reviewing these policies before enabling cloud services.

### Children's Privacy

Voice Intelligence is not intended for use by children under 13 years of age.

### Changes to This Policy

We will update this policy as needed. Significant changes will be noted in the application's release notes.

### Contact

For privacy-related questions, please open an issue on our GitHub repository.

---

## Deutsche Version (DSGVO-konform)

### Übersicht

Voice Intelligence ist eine datenschutzorientierte Desktop-Anwendung. Wir verpflichten uns, Ihre Privatsphäre zu schützen und Ihnen die volle Kontrolle über Ihre Daten zu gewährleisten.

### Verantwortlicher

Voice Intelligence ist eine Open-Source-Anwendung. Es gibt keinen zentralen Verantwortlichen im Sinne der DSGVO, da keine Daten an externe Server übertragen werden.

### Datenerhebung

**Wir erheben keine Daten.** Voice Intelligence läuft vollständig auf Ihrem lokalen Gerät. Es werden keine Daten an unsere Server übertragen, da wir keine Server betreiben, die Nutzerdaten empfangen.

### Datenverarbeitung

#### Lokale Verarbeitung (Standard)

Standardmäßig erfolgt die gesamte Sprachverarbeitung lokal auf Ihrem Gerät:

- **Audioaufnahme**: Wird lokal über das Mikrofon Ihres Geräts erfasst und verarbeitet
- **Sprache-zu-Text**: Transkription erfolgt lokal mit whisper.cpp
- **Speicherung**: Alle Transkriptionen und der Verlauf werden lokal auf Ihrem Gerät gespeichert
- **API-Schlüssel**: Sicher im Schlüsselbund/Credential-Manager Ihres Betriebssystems gespeichert

#### Optionale Cloud-Dienste

Wenn Sie Cloud-Dienste konfigurieren, können folgende Daten übertragen werden:

| Dienst | Übertragene Daten | Zweck |
|--------|-------------------|-------|
| OpenAI Whisper API | Audioaufnahmen | Cloud-basierte Transkription |
| OpenAI GPT API | Transkribierter Text | Textanreicherung/-verarbeitung |
| OpenRouter API | Transkribierter Text | Textanreicherung/-verarbeitung |

**Wichtig**: Cloud-Dienste sind vollständig optional. Sie können Voice Intelligence komplett offline mit lokaler Transkription nutzen.

### Rechtsgrundlage (Art. 6 DSGVO)

- **Lokale Verarbeitung**: Keine Rechtsgrundlage erforderlich, da keine personenbezogenen Daten an Dritte übermittelt werden
- **Cloud-Dienste**: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) durch aktive Konfiguration durch den Nutzer

### Datenspeicherung

| Datentyp | Speicherort | Aufbewahrung |
|----------|-------------|--------------|
| Transkriptionen | Nur lokales Gerät | Vom Nutzer konfigurierbar (0-30 Tage) |
| Einstellungen | Nur lokales Gerät | Bis zur manuellen Löschung |
| API-Schlüssel | System-Schlüsselbund | Bis zur manuellen Löschung |
| Audioaufnahmen | Nur temporäre Dateien | Nach Verarbeitung gelöscht |

### Ihre Rechte nach DSGVO

Sie haben die vollständige Kontrolle über Ihre Daten:

- **Auskunftsrecht (Art. 15 DSGVO)**: Alle Daten werden lokal gespeichert und sind für Sie zugänglich
- **Recht auf Löschung (Art. 17 DSGVO)**: Löschen Sie den Verlauf jederzeit über Einstellungen > Alles löschen
- **Recht auf Datenübertragbarkeit (Art. 20 DSGVO)**: Exportieren Sie Transkriptionen als Markdown-Dateien
- **Recht auf Berichtigung (Art. 16 DSGVO)**: Bearbeiten Sie die Aufbewahrungsdauer in den Einstellungen
- **Widerspruchsrecht (Art. 21 DSGVO)**: Deaktivieren Sie Cloud-Dienste jederzeit durch Entfernen der API-Schlüssel

### Drittanbieter-Dienste

Bei Nutzung optionaler Cloud-Dienste:

- **OpenAI**: Unterliegt der [Datenschutzrichtlinie von OpenAI](https://openai.com/privacy)
- **OpenRouter**: Unterliegt der [Datenschutzrichtlinie von OpenRouter](https://openrouter.ai/privacy)

**Datenübermittlung in Drittländer**: Bei Nutzung von OpenAI oder OpenRouter können Daten in die USA übertragen werden. Diese Übertragung erfolgt auf Grundlage von Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).

Wir empfehlen, diese Richtlinien vor der Aktivierung von Cloud-Diensten zu lesen.

### Datensicherheit

- Alle lokalen Daten werden in Ihrem Benutzerverzeichnis gespeichert
- API-Schlüssel werden im sicheren Schlüsselbund Ihres Betriebssystems gespeichert
- Keine unverschlüsselte Speicherung sensibler Daten
- Temporäre Audiodateien werden sofort nach der Verarbeitung gelöscht

### Kinder

Voice Intelligence ist nicht für die Nutzung durch Kinder unter 16 Jahren bestimmt.

### Änderungen dieser Richtlinie

Wir werden diese Richtlinie bei Bedarf aktualisieren. Wesentliche Änderungen werden in den Release-Notes der Anwendung vermerkt.

### Kontakt

Bei datenschutzbezogenen Fragen öffnen Sie bitte ein Issue in unserem GitHub-Repository.

---

## Norsk versjon

### Oversikt

Voice Intelligence er en personvernfokusert skrivebordsapplikasjon. Vi forplikter oss til å beskytte ditt personvern og sikre at du har full kontroll over dine data.

### Datainnsamling

**Vi samler ikke inn noen data.** Voice Intelligence kjører helt lokalt på din maskin. Ingen data overføres til våre servere fordi vi ikke har noen servere som mottar brukerdata.

### Dine rettigheter

Du har full kontroll over dine data:

- **Tilgang**: Alle data lagres lokalt og er tilgjengelige for deg
- **Sletting**: Slett historikk når som helst via Innstillinger
- **Portabilitet**: Eksporter transkripsjoner som Markdown-filer

### Kontakt

For personvernrelaterte spørsmål, vennligst åpne en sak på vårt GitHub-repository.

---

## Technical Implementation

### How We Protect Your Data

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Device                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Audio     │───▶│  whisper    │───▶│   Local     │     │
│  │  Recording  │    │    .cpp     │    │  Storage    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                                     │              │
│         │ (optional)                          │              │
│         ▼                                     ▼              │
│  ┌─────────────┐                      ┌─────────────┐       │
│  │   Cloud     │◀────────────────────▶│    LLM      │       │
│  │    STT      │  (only if configured)│  Enrichment │       │
│  └─────────────┘                      └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
                    Only if you choose
                           │
                           ▼
              ┌─────────────────────────┐
              │   External Services     │
              │  (OpenAI, OpenRouter)   │
              └─────────────────────────┘
```

### Data Flow

1. **Recording**: Audio captured → stored in temporary file
2. **Transcription**: Temp file → whisper.cpp (local) → text
3. **Enrichment**: Text → LLM (local or cloud) → enriched text
4. **Storage**: Enriched text → local database
5. **Cleanup**: Temporary audio files deleted immediately

### Security Measures

| Measure | Implementation |
|---------|----------------|
| API Key Storage | OS Keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) |
| Local Data | User's app data directory with standard OS permissions |
| Temp Files | Deleted immediately after processing |
| Network | HTTPS only for all cloud communications |
| No Telemetry | Zero analytics or tracking code |
