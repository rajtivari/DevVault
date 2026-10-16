# DevVault — Developer Knowledge Workspace

DevVault is a workspace for organizing developer notes, reusable code snippets, and technical resources. It brings search, collections, backups, and small developer utilities into one place.

**Live app:** https://devvault.rajtivari.qd.je/  
**Source code:** https://github.com/rajtivari/DevVault

## Features

### Notes
- Create, edit, search, and delete notes.
- Add tags and organize notes into collections.
- Favorite useful items or archive items you want to keep out of the main workspace.
- Search notes by title, content, and tags.

### Code snippets
- Save snippets with a title, language, code, tags, and an optional collection.
- Edit, search, copy, and organize snippets.
- Filter snippets by language and tags.
- Run supported JavaScript and Python snippets in the browser-based runner and view the output.

### Collections and knowledge graph
- Create named collections with descriptions to group related notes and snippets.
- Explore a visual graph of the notes, snippets, tags, and collections stored in the workspace.

### Developer utilities
- Format and validate JSON.
- Encode and decode Base64 and URLs.
- Test regular expressions.
- Compare text with a diff tool.

### Backup and data storage
- Export notes, snippets, and collections to a JSON backup.
- Restore supported DevVault JSON backups.
- Data is stored in the current browser using local storage. Clearing browser data or switching browsers/devices can remove or separate your workspace, so export backups regularly.
- The current version does not include account login, cloud synchronization, or a hosted database. Search uses stored text and tags.

## Technology
- React 19
- TypeScript
- Vite
- Lucide React
- Browser local storage
- Browser-based code execution and preview helpers for supported languages

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

DevVault is a deployed personal developer tool under active development. The feature list reflects the current frontend implementation. Account support, cloud synchronization, and hosted database integration are not currently included.

## Author

**Raj Tivari**  
GitHub: https://github.com/rajtivari  
Portfolio: https://rajtivari.github.io/  
LinkedIn: https://www.linkedin.com/in/rajtivari/
