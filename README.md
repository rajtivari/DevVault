# DevVault — Developer Knowledge Workspace

DevVault is a focused workspace for keeping notes, code snippets, and developer resources together. It is designed to make everyday learning and project work easier to organize, search, reuse, and back up.

**Live app:** https://devvault.rajtivari.qd.je/  
**Repository:** https://github.com/rajtivari/DevVault

## What it does

### Notes
- Create, edit, search, and delete notes.
- Add tags and organize notes into collections.
- Mark useful items as favorites or archive items you want to keep out of the main workspace.
- Find notes by title, content, and tags.

### Code snippets
- Save snippets with a title, language, code, tags, and optional collection.
- Edit, search, copy, and organize snippets.
- Filter snippets by programming language and tags.
- Run supported JavaScript and Python snippets in the browser-based runner, with output and console feedback.

### Collections and knowledge graph
- Create named collections with descriptions and group related notes and snippets.
- Browse a lightweight visual knowledge graph based on the notes, snippets, tags, and collections stored in the workspace. It is a local visualization, not an AI-generated semantic graph.

### Developer utilities
DevVault includes utility workflows for JSON formatting/validation, Base64 encode/decode, URL encode/decode, regular-expression testing, and text diffing.

### Backup and privacy
- Export notes, snippets, and collections to a JSON backup file.
- Restore supported DevVault JSON backups.
- Data is stored in the current browser using local storage. Clearing browser data or switching browsers/devices can remove or separate your workspace, so export backups regularly.
- The current version does not have account login, cloud synchronization, a hosted database, or production AI/semantic search.

## Technology

- React 19
- TypeScript
- Vite
- Lucide React icons
- Browser local storage
- Browser-based code execution/preview helpers for supported languages

## Run locally

Requirements: Node.js and npm.

```bash
git clone https://github.com/rajtivari/DevVault.git
cd DevVault
npm install
npm run dev
```

Build and check the project:

```bash
npm run build
npm run lint
```

## Project status

DevVault is a deployed, actively developed personal developer tool. Features described above reflect the current frontend implementation; cloud sync, accounts, hosted database integration, and AI-powered semantic search are future possibilities, not current capabilities.

## Author

**Raj Tivari**  
GitHub: https://github.com/rajtivari  
Portfolio: https://rajtivari.github.io/  
LinkedIn: https://www.linkedin.com/in/rajtivari/
