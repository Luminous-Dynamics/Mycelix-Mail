# Mycelix-Mail

**Decentralized email on Holochain with MATL trust-based spam filtering**

[![Status](https://img.shields.io/badge/status-alpha-yellow)](https://github.com/Luminous-Dynamics/Mycelix-Mail)
[![Holochain](https://img.shields.io/badge/holochain-0.3.x-purple)](https://holochain.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Overview

Mycelix-Mail is a fully decentralized email system that runs on Holochain. Unlike traditional email:

- **No corporate servers** - Your data stays on your device
- **Trust-based spam filtering** - MATL reputation system instead of keyword blacklists
- **End-to-end encryption** - Only you and the recipient can read messages
- **Agent-centric** - You own your identity and data

## Architecture

```
Mycelix-Mail/
├── happ/                    # Holochain backend (Rust)
│   ├── dna/                 # DNA with mail zomes
│   ├── matl-bridge/         # MATL trust layer integration
│   ├── did-registry/        # Decentralized identity
│   └── smtp-bridge/         # Legacy email compatibility
├── ui/                      # React frontend (TypeScript)
│   ├── frontend/            # Vite + React + TailwindCSS
│   │   └── src/lib/
│   │       └── holochain.ts # @holochain/client integration
│   └── backend/             # Express API (for legacy features)
├── tests/                   # Tryorama integration tests
└── flake.nix               # Nix development environment
```

## Features

### Core Email
- Send/receive emails via Holochain DHT
- Contact management with nicknames
- Email threading and labels
- Draft autosave
- Search and filtering

### Trust & Security
- **MATL trust scoring** - Reputation-weighted spam detection
- **E2E encryption** - Optional per-message encryption
- **Epistemic tiers** - Classify message verifiability
- **No central authority** - Distributed trust graph

### Legacy Compatibility
- **SMTP bridge** - Receive from traditional email
- **DID registry** - Map email addresses to agent keys

## Quick Start

### Prerequisites
- [Nix](https://nixos.org/download.html) with flakes enabled
- [Holochain](https://developer.holochain.org/get-started/)

### Development

```bash
# Clone the repository
git clone https://github.com/Luminous-Dynamics/Mycelix-Mail.git
cd Mycelix-Mail

# Enter Nix environment (includes Holochain + Node.js)
nix develop

# Install UI dependencies
cd ui && npm install && cd ..

# Build the hApp
cd happ && cargo build --release && cd ..

# Run Holochain sandbox with the DNA
hc sandbox generate happ/workdir --run

# In another terminal, start the UI
cd ui/frontend && npm run dev
```

### Using the Holochain Client

The UI connects to Holochain via `@holochain/client`:

```typescript
import { sendEmail, getInbox, getTrustScore } from './lib/holochain';

// Send an email
await sendEmail({
  to: recipientPubKey,
  subject: 'Hello from Mycelix!',
  body: 'This message is stored on the DHT.',
  encrypt: true
});

// Get inbox with trust scores
const emails = await getInbox();
for (const email of emails) {
  const trust = await getTrustScore(email.from);
  console.log(`${email.subject} (trust: ${trust})`);
}
```

## Status

**Alpha** - Core functionality implemented, integration in progress

### Working
- [x] Holochain DNA with mail zomes
- [x] MATL bridge architecture
- [x] DID registry
- [x] React UI components
- [x] Holochain client adapter

### In Progress
- [ ] Full UI-to-hApp integration
- [ ] SMTP bridge implementation
- [ ] End-to-end testing
- [ ] Documentation

### Planned
- [ ] Mobile app (Tauri)
- [ ] Federation with other Mycelix apps
- [ ] Governance integration

## Related Projects

- [Mycelix-Core](https://github.com/Luminous-Dynamics/Mycelix-Core) - MATL trust layer & Zero-TrustML
- [mycelix.net](https://mycelix.net) - Protocol documentation

## Contributing

See [CONTRIBUTING.md](ui/CONTRIBUTING.md) for guidelines.

## License

MIT - See [LICENSE](ui/LICENSE)

---

*Part of the [Mycelix Protocol](https://mycelix.net) ecosystem*
