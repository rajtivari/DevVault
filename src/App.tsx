import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Code2, Copy, Download, FileText, FolderOpen, Home, PanelLeftClose, PanelLeftOpen, Pencil, Star, Play, Plus, Search, Save, Tag, Trash2, Upload, Wrench, X } from 'lucide-react'
import { createPreviewDocument, getRunnerMode, runJavaScriptInSandbox, type ConsoleEntry, type SandboxRun } from './codeRunner'
import './App.css'

type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  collectionId?: string
  updatedAt: string
  favorite?: boolean
}

type Snippet = {
  id: string
  title: string
  language: string
  code: string
  tags: string[]
  collectionId?: string
  updatedAt: string
  favorite?: boolean
}

type Collection = {
  id: string
  name: string
  description: string
}

type SnippetDraft = Pick<Snippet, 'title' | 'language' | 'code' | 'collectionId'> & { tagsText: string }
type SnippetErrors = Partial<Record<'title' | 'language' | 'code', string>>
type CollectionDraft = { id: string | null; name: string; description: string }

const storageKey = 'devvault-notes'
const snippetsStorageKey = 'devvault-snippets'
const collectionsStorageKey = 'devvault-collections'
const uncategorizedId = '__uncategorized__'

function readNotes(): Note[] {
  try {
    const savedNotes: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(savedNotes)) return []

    return savedNotes.filter(
      (note): note is Note =>
        typeof note === 'object' &&
        note !== null &&
        typeof note.id === 'string' &&
        typeof note.title === 'string' &&
        typeof note.content === 'string' &&
        Array.isArray(note.tags) &&
        note.tags.every((tag: unknown) => typeof tag === 'string') &&
        typeof note.updatedAt === 'string',
    )
  } catch {
    return []
  }
}

function readSnippets(): Snippet[] {
  try {
    const savedSnippets: unknown = JSON.parse(localStorage.getItem(snippetsStorageKey) ?? '[]')
    if (!Array.isArray(savedSnippets)) return []

    return savedSnippets.filter(
      (snippet): snippet is Snippet =>
        typeof snippet === 'object' &&
        snippet !== null &&
        typeof snippet.id === 'string' &&
        typeof snippet.title === 'string' &&
        typeof snippet.language === 'string' &&
        typeof snippet.code === 'string' &&
        Array.isArray(snippet.tags) &&
        snippet.tags.every((tag: unknown) => typeof tag === 'string') &&
        typeof snippet.updatedAt === 'string',
    )
  } catch {
    return []
  }
}

function readCollections(): Collection[] {
  try {
    const savedCollections: unknown = JSON.parse(localStorage.getItem(collectionsStorageKey) ?? '[]')
    if (!Array.isArray(savedCollections)) return []

    return savedCollections.filter(
      (collection): collection is Collection =>
        typeof collection === 'object' &&
        collection !== null &&
        typeof collection.id === 'string' &&
        typeof collection.name === 'string' &&
        typeof collection.description === 'string',
    )
  } catch {
    return []
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function App() {
  const [notes, setNotes] = useState<Note[]>(readNotes)
  const [snippets, setSnippets] = useState<Snippet[]>(readSnippets)
  const [collections, setCollections] = useState<Collection[]>(readCollections)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'notes' | 'snippets' | 'collections' | 'favorites' | 'tools'>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const globalSearchInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [collectionSearch, setCollectionSearch] = useState('')
  const [collectionDraft, setCollectionDraft] = useState<CollectionDraft | null>(null)
  const [collectionError, setCollectionError] = useState('')
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null)
  const [snippetDraft, setSnippetDraft] = useState<SnippetDraft | null>(null)
  const [snippetErrors, setSnippetErrors] = useState<SnippetErrors>({})
  const [snippetDirty, setSnippetDirty] = useState(false)
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [runFinished, setRunFinished] = useState(false)
  const [search, setSearch] = useState('')
  const [toolName, setToolName] = useState<'json' | 'base64' | 'url'>('json')
  const [toolInput, setToolInput] = useState('')
  const [toolOutput, setToolOutput] = useState('')
  const [toolError, setToolError] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeSnippetTag, setActiveSnippetTag] = useState<string | null>(null)
  const [languageFilter, setLanguageFilter] = useState('')
  const [feedback, setFeedback] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [snippetStorageError, setSnippetStorageError] = useState(false)
  const [collectionStorageError, setCollectionStorageError] = useState(false)
  const [tagDraft, setTagDraft] = useState<{ noteId: string; value: string } | null>(null)
  const backupInputRef = useRef<HTMLInputElement | null>(null)
  const sandboxRunRef = useRef<SandboxRun | null>(null)

  const sortedNotes = useMemo(
    () => [...notes].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    [notes],
  )
  const allTags = useMemo(
    () => [...new Set(notes.flatMap((note) => note.tags))].sort((first, second) => first.localeCompare(second)),
    [notes],
  )
  const allSnippetTags = useMemo(
    () => [...new Set(snippets.flatMap((snippet) => snippet.tags))].sort((first, second) => first.localeCompare(second)),
    [snippets],
  )
  const snippetLanguages = useMemo(
    () => [...new Set(snippets.map((snippet) => snippet.language))].sort((first, second) => first.localeCompare(second)),
    [snippets],
  )
  const filteredCollections = useMemo(() => {
    const query = collectionSearch.trim().toLowerCase()
    return [...collections]
      .filter((collection) => `${collection.name} ${collection.description}`.toLowerCase().includes(query))
      .sort((first, second) => first.name.localeCompare(second.name))
  }, [collectionSearch, collections])
  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sortedNotes.filter((note) => {
      const matchesSearch =
        !query ||
        `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase().includes(query)
      const matchesTag = !activeTag || note.tags.includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [activeTag, search, sortedNotes])
  const activeNote = notes.find((note) => note.id === activeNoteId) ?? filteredNotes[0] ?? null
  const sortedSnippets = useMemo(
    () => [...snippets].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    [snippets],
  )
  const filteredSnippets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sortedSnippets.filter((snippet) => {
      const searchableText = `${snippet.title} ${snippet.code} ${snippet.language} ${snippet.tags.join(' ')}`.toLowerCase()
      const matchesSearch = !query || searchableText.includes(query)
      const matchesTag = !activeSnippetTag || snippet.tags.includes(activeSnippetTag)
      const matchesLanguage = !languageFilter || snippet.language === languageFilter
      return matchesSearch && matchesTag && matchesLanguage
    })
  }, [activeSnippetTag, languageFilter, search, sortedSnippets])
  const activeSnippet = snippets.find((snippet) => snippet.id === activeSnippetId) ?? null
  const snippetRunnerMode = snippetDraft ? getRunnerMode(snippetDraft.language) : 'unsupported'
  const visibleTags = activeSection === 'notes' ? allTags : activeSection === 'snippets' ? allSnippetTags : []
  const currentStorageError = activeSection === 'notes' ? storageError : activeSection === 'snippets' ? snippetStorageError : collectionStorageError
  const feedbackIsError = currentStorageError || feedback.startsWith('Could not')
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? null
  const isUncategorizedSelected = selectedCollectionId === uncategorizedId
  const belongsToCollection = (collectionId: string | undefined) => {
    if (isUncategorizedSelected) return !collectionId || !collections.some((collection) => collection.id === collectionId)
    return selectedCollectionId !== null && collectionId === selectedCollectionId
  }
  const collectionNotes = selectedCollectionId === null ? [] : notes.filter((note) => belongsToCollection(note.collectionId))
  const collectionSnippets = selectedCollectionId === null ? [] : snippets.filter((snippet) => belongsToCollection(snippet.collectionId))

  useEffect(() => () => sandboxRunRef.current?.cancel(), [])

  useEffect(() => {
    function handleWorkspaceShortcuts(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setGlobalSearchOpen(true)
        globalSearchInputRef.current?.focus()
      }
      if (event.key === 'Escape') setGlobalSearchOpen(false)
    }
    window.addEventListener('keydown', handleWorkspaceShortcuts)
    return () => window.removeEventListener('keydown', handleWorkspaceShortcuts)
  }, [])

  function exportBackup() {
    const backup = { app: 'DevVault', formatVersion: 1, exportedAt: new Date().toISOString(), notes, snippets, collections }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `devvault-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setFeedback('Backup exported. Keep the file somewhere safe.')
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Choose a valid DevVault backup.')
      const data = parsed as Record<string, unknown>
      if (data.app !== 'DevVault' || data.formatVersion !== 1 ||
          !Array.isArray(data.notes) || !Array.isArray(data.snippets) || !Array.isArray(data.collections)) {
        throw new Error('This file is not a supported DevVault backup.')
      }
      const validNotes = data.notes.every((item) => typeof item === 'object' && item !== null &&
        typeof (item as Note).id === 'string' && typeof (item as Note).title === 'string' &&
        typeof (item as Note).content === 'string' && Array.isArray((item as Note).tags) &&
        typeof (item as Note).updatedAt === 'string')
      const validSnippets = data.snippets.every((item) => typeof item === 'object' && item !== null &&
        typeof (item as Snippet).id === 'string' && typeof (item as Snippet).title === 'string' &&
        typeof (item as Snippet).language === 'string' && typeof (item as Snippet).code === 'string' &&
        Array.isArray((item as Snippet).tags) && typeof (item as Snippet).updatedAt === 'string')
      const validCollections = data.collections.every((item) => typeof item === 'object' && item !== null &&
        typeof (item as Collection).id === 'string' && typeof (item as Collection).name === 'string' &&
        typeof (item as Collection).description === 'string')
      if (!validNotes || !validSnippets || !validCollections) throw new Error('The backup contains invalid data and was not imported.')
      const confirmed = window.confirm(`Restore this backup? It contains ${data.notes.length} notes, ${data.snippets.length} snippets, and ${data.collections.length} collections. This replaces the data currently saved in this browser.`)
      if (!confirmed) return
      commitNotes(data.notes as Note[])
      commitSnippets(data.snippets as Snippet[])
      commitCollections(data.collections as Collection[])
      setActiveNoteId(null)
      setActiveSnippetId(null)
      setSnippetDraft(null)
      setSnippetDirty(false)
      setSelectedCollectionId(null)
      setCollectionDraft(null)
      setActiveSection('dashboard')
      setSearch('')
      setCollectionSearch('')
      setFeedback('Backup restored successfully.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not read this backup file.')
    }
  }

  function clearOutput() {
    sandboxRunRef.current?.cancel()
    sandboxRunRef.current = null
    setConsoleEntries([])
    setIsRunning(false)
    setRunFinished(false)
  }

  function runSnippetCode() {
    if (!snippetDraft || snippetRunnerMode !== 'javascript') return
    clearOutput()
    if (!snippetDraft.code.trim()) {
      setConsoleEntries([{ id: 'empty-code', kind: 'error', text: 'Add JavaScript code before running.' }])
      setRunFinished(true)
      return
    }

    setIsRunning(true)
    sandboxRunRef.current = runJavaScriptInSandbox(
      snippetDraft.code,
      (entry) => setConsoleEntries((entries) => [...entries, entry]),
      () => {
        setIsRunning(false)
        setRunFinished(true)
      },
    )
  }

  function commitNotes(nextNotes: Note[]) {
    setNotes(nextNotes)
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextNotes))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  function createNote() {
    const note: Note = {
      id: makeId(),
      title: '',
      content: '',
      tags: [],
      updatedAt: new Date().toISOString(),
    }
    commitNotes([note, ...notes])
    setActiveNoteId(note.id)
    setActiveTag(null)
    setSearch('')
    setFeedback('New note created.')
  }

  function runUtilityTool() {
    setToolError('')
    try {
      if (toolName === 'json') setToolOutput(JSON.stringify(JSON.parse(toolInput), null, 2))
      else if (toolName === 'base64') setToolOutput(btoa(toolInput))
      else setToolOutput(encodeURIComponent(toolInput))
    } catch { setToolError(toolName === 'json' ? 'Invalid JSON. Check commas, quotes, and brackets.' : 'Could not process this input.'); setToolOutput('') }
  }

  function toggleNoteFavorite(noteId: string) {
    commitNotes(notes.map((note) => note.id === noteId ? { ...note, favorite: !note.favorite } : note))
    setFeedback(notes.find((note) => note.id === noteId)?.favorite ? 'Removed from favorites.' : 'Added to favorites.')
  }

  function toggleSnippetFavorite(snippetId: string) {
    commitSnippets(snippets.map((snippet) => snippet.id === snippetId ? { ...snippet, favorite: !snippet.favorite } : snippet))
    setFeedback(snippets.find((snippet) => snippet.id === snippetId)?.favorite ? 'Removed from favorites.' : 'Added to favorites.')
  }

  function updateNote(noteId: string, changes: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'collectionId'>>) {
    commitNotes(
      notes.map((note) =>
        note.id === noteId ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note,
      ),
    )
  }

  function deleteNote() {
    if (!activeNote) return
    commitNotes(notes.filter((note) => note.id !== activeNote.id))
    setActiveNoteId(null)
    setTagDraft(null)
    setFeedback('Note deleted.')
  }

  function updateTags(noteId: string, value: string) {
    setTagDraft({ noteId, value })
    const tags = [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))]
    updateNote(noteId, { tags })
  }

  function commitSnippets(nextSnippets: Snippet[]) {
    setSnippets(nextSnippets)
    try {
      localStorage.setItem(snippetsStorageKey, JSON.stringify(nextSnippets))
      setSnippetStorageError(false)
    } catch {
      setSnippetStorageError(true)
    }
  }

  function commitCollections(nextCollections: Collection[]) {
    setCollections(nextCollections)
    try {
      localStorage.setItem(collectionsStorageKey, JSON.stringify(nextCollections))
      setCollectionStorageError(false)
    } catch {
      setCollectionStorageError(true)
    }
  }

  function startCollectionEdit(collection?: Collection) {
    setCollectionDraft(collection
      ? { id: collection.id, name: collection.name, description: collection.description }
      : { id: null, name: '', description: '' })
    setCollectionError('')
  }

  function saveCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!collectionDraft?.name.trim()) {
      setCollectionError('Enter a collection name.')
      return
    }
    const normalizedName = collectionDraft.name.trim().toLocaleLowerCase()
    if (collections.some((collection) =>
      collection.id !== collectionDraft.id && collection.name.trim().toLocaleLowerCase() === normalizedName,
    )) {
      setCollectionError('A collection with this name already exists.')
      return
    }

    const savedCollection: Collection = {
      id: collectionDraft.id ?? makeId(),
      name: collectionDraft.name.trim(),
      description: collectionDraft.description.trim(),
    }
    commitCollections(collectionDraft.id
      ? collections.map((collection) => collection.id === savedCollection.id ? savedCollection : collection)
      : [...collections, savedCollection])
    setSelectedCollectionId(savedCollection.id)
    setCollectionDraft(null)
    setCollectionError('')
    setFeedback(collectionDraft.id ? 'Collection renamed.' : 'Collection created.')
  }

  function deleteCollection(collection: Collection) {
    const itemCount = notes.filter((note) => note.collectionId === collection.id).length +
      snippets.filter((snippet) => snippet.collectionId === collection.id).length
    const confirmed = window.confirm(
      `Delete "${collection.name}" and move its ${itemCount} ${itemCount === 1 ? 'item' : 'items'} to Uncategorized? Choose Cancel to keep the collection.`,
    )
    if (!confirmed) return

    commitNotes(notes.map((note) => note.collectionId === collection.id ? { ...note, collectionId: undefined } : note))
    commitSnippets(snippets.map((snippet) => snippet.collectionId === collection.id ? { ...snippet, collectionId: undefined } : snippet))
    commitCollections(collections.filter((item) => item.id !== collection.id))
    if (selectedCollectionId === collection.id) setSelectedCollectionId(uncategorizedId)
    if (collectionDraft?.id === collection.id) setCollectionDraft(null)
    setFeedback('Collection deleted. Its items are now Uncategorized.')
  }

  function openCollectionNote(note: Note) {
    setActiveSection('notes')
    setActiveNoteId(note.id)
    setActiveTag(null)
    setSearch('')
  }

  function openCollectionSnippet(snippet: Snippet) {
    if (!canDiscardSnippetDraft()) return
    clearOutput()
    setActiveSection('snippets')
    setActiveSnippetId(snippet.id)
    setSnippetDraft({
      title: snippet.title,
      language: snippet.language,
      code: snippet.code,
      tagsText: snippet.tags.join(', '),
      collectionId: snippet.collectionId,
    })
    setSnippetErrors({})
    setSnippetDirty(false)
    setSearch('')
  }

  function canDiscardSnippetDraft() {
    return !snippetDirty || window.confirm('Discard your unsaved snippet changes?')
  }

  function createSnippet() {
    if (!canDiscardSnippetDraft()) return
    clearOutput()
    setActiveSection('snippets')
    setActiveSnippetId(null)
    setSnippetDraft({ title: '', language: 'TypeScript', code: '', tagsText: '', collectionId: undefined })
    setSnippetErrors({})
    setSnippetDirty(false)
    setActiveSnippetTag(null)
    setLanguageFilter('')
    setSearch('')
    setFeedback('New snippet started.')
  }

  function selectSnippet(snippet: Snippet) {
    if (!canDiscardSnippetDraft()) return
    clearOutput()
    setActiveSnippetId(snippet.id)
    setSnippetDraft({
      title: snippet.title,
      language: snippet.language,
      code: snippet.code,
      tagsText: snippet.tags.join(', '),
      collectionId: snippet.collectionId,
    })
    setSnippetErrors({})
    setSnippetDirty(false)
  }

  function updateSnippetDraft(field: keyof SnippetDraft, value: string) {
    if (field === 'code' || field === 'language') clearOutput()
    setSnippetDraft((draft) => draft ? { ...draft, [field]: value } : draft)
    setSnippetDirty(true)
  }

  function saveSnippet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!snippetDraft) return

    const errors: SnippetErrors = {}
    if (!snippetDraft.title.trim()) errors.title = 'Enter a title.'
    if (!snippetDraft.language.trim()) errors.language = 'Choose or enter a language.'
    if (!snippetDraft.code.trim()) errors.code = 'Add code before saving.'
    setSnippetErrors(errors)
    if (Object.keys(errors).length > 0) return

    const savedSnippet: Snippet = {
      id: activeSnippetId ?? makeId(),
      title: snippetDraft.title.trim(),
      language: snippetDraft.language.trim(),
      code: snippetDraft.code,
      tags: [...new Set(snippetDraft.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean))],
      collectionId: snippetDraft.collectionId || undefined,
      updatedAt: new Date().toISOString(),
    }
    const nextSnippets = activeSnippetId
      ? snippets.map((snippet) => snippet.id === activeSnippetId ? savedSnippet : snippet)
      : [savedSnippet, ...snippets]
    commitSnippets(nextSnippets)
    setActiveSnippetId(savedSnippet.id)
    setSnippetDraft({ ...savedSnippet, tagsText: savedSnippet.tags.join(', ') })
    setSnippetDirty(false)
    setSnippetErrors({})
    setFeedback('Snippet saved.')
  }

  function deleteSnippet() {
    if (!activeSnippetId) return
    commitSnippets(snippets.filter((snippet) => snippet.id !== activeSnippetId))
    setActiveSnippetId(null)
    setSnippetDraft(null)
    setSnippetDirty(false)
    setFeedback('Snippet deleted.')
  }

  function cancelSnippetEdit() {
    if (!canDiscardSnippetDraft()) return
    if (activeSnippet) {
      setSnippetDraft({
        title: activeSnippet.title,
        language: activeSnippet.language,
        code: activeSnippet.code,
        tagsText: activeSnippet.tags.join(', '),
        collectionId: activeSnippet.collectionId,
      })
    } else {
      setSnippetDraft(null)
      setActiveSnippetId(null)
    }
    setSnippetErrors({})
    setSnippetDirty(false)
  }

  async function copySnippetCode() {
    if (!snippetDraft?.code) return
    try {
      await navigator.clipboard.writeText(snippetDraft.code)
      setFeedback('Code copied to clipboard.')
    } catch {
      setFeedback('Could not copy code. Check clipboard permissions.')
    }
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Workspace navigation">
        <a className="brand" href="#notes" aria-label="DevVault home">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" aria-hidden="true" />
          <span>DevVault</span>
        </a>

        <div className="sidebar-section">
          <p className="sidebar-label">Workspace</p>
          <button className={`nav-item${activeSection === 'dashboard' ? ' is-active' : ''}`} type="button" onClick={() => setActiveSection('dashboard')} aria-current={activeSection === 'dashboard' ? 'page' : undefined}>
            <Home size={16} aria-hidden="true" /><span>Dashboard</span>
          </button>
          <button
            className={`nav-item${activeSection === 'notes' && activeTag === null ? ' is-active' : ''}`}
            type="button"
            onClick={() => { setActiveSection('notes'); setActiveTag(null) }}
            aria-current={activeSection === 'notes' && activeTag === null ? 'page' : undefined}
          >
            <FileText size={16} aria-hidden="true" />
            <span>All notes</span>
            <span className="nav-count">{notes.length}</span>
          </button>
          <button
            className={`nav-item${activeSection === 'snippets' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveSection('snippets')}
            aria-current={activeSection === 'snippets' ? 'page' : undefined}
          >
            <Code2 size={16} aria-hidden="true" />
            <span>Code snippets</span>
            <span className="nav-count">{snippets.length}</span>
          </button>
          <button
            className={`nav-item${activeSection === 'collections' && selectedCollectionId === null ? ' is-active' : ''}`}
            type="button"
            onClick={() => { setActiveSection('collections'); setSelectedCollectionId(null); setCollectionDraft(null) }}
            aria-current={activeSection === 'collections' && selectedCollectionId === null ? 'page' : undefined}
          >
            <FolderOpen size={16} aria-hidden="true" />
            <span>Collections</span>
            <span className="nav-count">{collections.length}</span>
          </button>
          <button className={`nav-item${activeSection === 'tools' ? ' is-active' : ''}`} type="button" onClick={() => setActiveSection('tools')}><Wrench size={16} aria-hidden="true" /><span>Developer tools</span></button>
        </div>

        {activeSection === 'collections' && (
          <div className="sidebar-section collection-sidebar-section">
            <p className="sidebar-label">Your collections</p>
            <div className="collection-nav-list">
              <button
                className={`nav-item tag-nav-item${selectedCollectionId === uncategorizedId ? ' is-active' : ''}`}
                type="button"
                onClick={() => { setSelectedCollectionId(uncategorizedId); setCollectionDraft(null) }}
                aria-pressed={selectedCollectionId === uncategorizedId}
              >
                <FolderOpen size={14} aria-hidden="true" />
                <span className="tag-name">Uncategorized</span>
                <span className="nav-count">{notes.filter((note) => !note.collectionId || !collections.some((collection) => collection.id === note.collectionId)).length + snippets.filter((snippet) => !snippet.collectionId || !collections.some((collection) => collection.id === snippet.collectionId)).length}</span>
              </button>
              {collections.map((collection) => (
                <button
                  className={`nav-item tag-nav-item${selectedCollectionId === collection.id ? ' is-active' : ''}`}
                  key={collection.id}
                  type="button"
                  onClick={() => { setSelectedCollectionId(collection.id); setCollectionDraft(null) }}
                  aria-pressed={selectedCollectionId === collection.id}
                >
                  <FolderOpen size={14} aria-hidden="true" />
                  <span className="tag-name">{collection.name}</span>
                  <span className="nav-count">{notes.filter((note) => note.collectionId === collection.id).length + snippets.filter((snippet) => snippet.collectionId === collection.id).length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSection !== 'collections' && <div className="sidebar-section tag-section">
          <div className="sidebar-label-row">
            <p className="sidebar-label">Tags</p>
            <Tag size={14} aria-hidden="true" />
          </div>
          {visibleTags.length > 0 ? (
            <div className="tag-nav-list">
              {visibleTags.map((tag) => (
                <button
                  className={`nav-item tag-nav-item${(activeSection === 'notes' ? activeTag : activeSnippetTag) === tag ? ' is-active' : ''}`}
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (activeSection === 'notes') setActiveTag(activeTag === tag ? null : tag)
                    else setActiveSnippetTag(activeSnippetTag === tag ? null : tag)
                  }}
                  aria-pressed={(activeSection === 'notes' ? activeTag : activeSnippetTag) === tag}
                >
                  <span className="tag-dot" aria-hidden="true" />
                  <span className="tag-name">{tag}</span>
                  <span className="nav-count">
                    {activeSection === 'notes'
                      ? notes.filter((note) => note.tags.includes(tag)).length
                      : snippets.filter((snippet) => snippet.tags.includes(tag)).length}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sidebar-hint">Tags you add to {activeSection} will appear here.</p>
          )}
        </div>}

        <div className="sidebar-footer">
          <span className="status-dot" aria-hidden="true" />
          <span>Stored on this device</span>
        </div>
      </aside>

      <main className="main-content" id="notes">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="icon-button sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{activeSection === 'dashboard' ? 'Dashboard' : activeSection === 'notes' ? 'Notes' : activeSection === 'snippets' ? 'Code snippets' : activeSection === 'favorites' ? 'Favorites' : 'Collections'}</strong></div>
          </div>
          <div className="global-search-wrap">
            <label className="global-search-box">
              <Search size={15} aria-hidden="true" />
              <input
                ref={globalSearchInputRef}
                type="search"
                value={globalSearch}
                onFocus={() => setGlobalSearchOpen(true)}
                onChange={(event) => { setGlobalSearch(event.target.value); setGlobalSearchOpen(true) }}
                onKeyDown={(event) => { if (event.key === 'Escape') { setGlobalSearchOpen(false); setGlobalSearch('') } }}
                placeholder="Search everything..."
                aria-label="Search all notes, snippets, and collections"
                aria-expanded={globalSearchOpen}
                aria-controls="global-search-results"
              />
              <kbd>Esc</kbd>
            </label>
            {globalSearchOpen && (
              <div className="global-search-results" id="global-search-results">
                {!globalSearch.trim() ? (
                  <p className="global-search-hint">Search across notes, code, tags, and collections.</p>
                ) : (
                  <>
                    {notes.filter((note) => `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 5).map((note) => (
                      <button className="global-search-result" type="button" key={`note-${note.id}`} onClick={() => { setActiveSection('notes'); setActiveNoteId(note.id); setActiveTag(null); setSearch(''); setGlobalSearchOpen(false); setGlobalSearch('') }}>
                        <FileText size={15} aria-hidden="true" /><span><strong>{note.title.trim() || 'Untitled note'}</strong><small>Note · {note.tags.join(', ') || 'No tags'}</small></span>
                      </button>
                    ))}
                    {snippets.filter((snippet) => `${snippet.title} ${snippet.code} ${snippet.language} ${snippet.tags.join(' ')}`.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 5).map((snippet) => (
                      <button className="global-search-result" type="button" key={`snippet-${snippet.id}`} onClick={() => { if (canDiscardSnippetDraft()) { clearOutput(); setActiveSection('snippets'); setActiveSnippetId(snippet.id); setSnippetDraft({ title: snippet.title, language: snippet.language, code: snippet.code, tagsText: snippet.tags.join(', '), collectionId: snippet.collectionId }); setSnippetErrors({}); setSnippetDirty(false); setGlobalSearchOpen(false); setGlobalSearch('') } }}>
                        <Code2 size={15} aria-hidden="true" /><span><strong>{snippet.title}</strong><small>Snippet · {snippet.language}</small></span>
                      </button>
                    ))}
                    {collections.filter((collection) => `${collection.name} ${collection.description}`.toLowerCase().includes(globalSearch.trim().toLowerCase())).slice(0, 3).map((collection) => (
                      <button className="global-search-result" type="button" key={`collection-${collection.id}`} onClick={() => { setActiveSection('collections'); setSelectedCollectionId(collection.id); setCollectionDraft(null); setGlobalSearchOpen(false); setGlobalSearch('') }}>
                        <FolderOpen size={15} aria-hidden="true" /><span><strong>{collection.name}</strong><small>Collection · {collection.description || 'No description'}</small></span>
                      </button>
                    ))}
                    {!notes.some((note) => `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase().includes(globalSearch.trim().toLowerCase())) &&
                     !snippets.some((snippet) => `${snippet.title} ${snippet.code} ${snippet.language} ${snippet.tags.join(' ')}`.toLowerCase().includes(globalSearch.trim().toLowerCase())) &&
                     !collections.some((collection) => `${collection.name} ${collection.description}`.toLowerCase().includes(globalSearch.trim().toLowerCase())) && (
                      <p className="global-search-hint">No results found for “{globalSearch.trim()}”.</p>
                    )}
                  </>
                )}
                <button className="global-search-close" type="button" onClick={() => { setGlobalSearchOpen(false); setGlobalSearch('') }}>Close search</button>
              </div>
            )}
          </div>
        </header>

        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">{activeSection === 'notes' ? 'PERSONAL KNOWLEDGE BASE' : activeSection === 'snippets' ? 'DEVELOPER TOOLBOX' : 'ORGANIZE YOUR WORK'}</p>
            <h1 id="page-title">{activeSection === 'notes' ? 'Your notes' : activeSection === 'snippets' ? 'Code snippets' : activeSection === 'tools' ? 'Developer tools' : selectedCollection?.name ?? (isUncategorizedSelected ? 'Uncategorized' : 'Collections')}</h1>
            <p className="page-description">
              {activeSection === 'notes' ? 'A quiet place for the things worth remembering.' : activeSection === 'snippets' ? 'Keep useful code close at hand.' : activeSection === 'tools' ? 'Small utilities for everyday development tasks.' : selectedCollection?.description || (isUncategorizedSelected ? 'Notes and snippets not assigned to a collection.' : 'Group related notes and code snippets together.')}
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={activeSection === 'notes' ? createNote : activeSection === 'snippets' ? createSnippet : () => startCollectionEdit()}
            aria-label={activeSection === 'notes' ? 'Create a new note' : activeSection === 'snippets' ? 'Create a new code snippet' : 'Create a collection'}
          >
            <Plus size={17} aria-hidden="true" />
            <span>{activeSection === 'notes' ? 'New note' : activeSection === 'snippets' ? 'New snippet' : 'New collection'}</span>
          </button>
        </section>

        <section className="overview" aria-label={`${activeSection} overview`}>
          <div className="overview-item">
            <span className="overview-icon">{activeSection === 'notes' ? <FileText size={16} aria-hidden="true" /> : activeSection === 'snippets' ? <Code2 size={16} aria-hidden="true" /> : <FolderOpen size={16} aria-hidden="true" />}</span>
            <span className="overview-value">{activeSection === 'notes' ? notes.length : activeSection === 'snippets' ? snippets.length : collections.length}</span>
            <span className="overview-label">
              {activeSection === 'notes' ? (notes.length === 1 ? 'note' : 'notes') : activeSection === 'snippets' ? (snippets.length === 1 ? 'snippet' : 'snippets') : (collections.length === 1 ? 'collection' : 'collections')}
            </span>
          </div>
          <span className="overview-divider" aria-hidden="true" />
          <div className="overview-item">
            <span className="overview-icon"><Tag size={16} aria-hidden="true" /></span>
            <span className="overview-value">{activeSection === 'collections' ? collectionNotes.length + collectionSnippets.length : visibleTags.length}</span>
            <span className="overview-label">{activeSection === 'collections' ? 'items in view' : visibleTags.length === 1 ? 'tag in use' : 'tags in use'}</span>
          </div>
          <p className="feedback" data-state={feedback ? feedbackIsError ? 'error' : 'success' : undefined} role={feedbackIsError ? 'alert' : 'status'} aria-live={feedbackIsError ? 'assertive' : 'polite'}>
            {feedback && (feedbackIsError
              ? <AlertCircle size={14} aria-hidden="true" />
              : <Check size={14} aria-hidden="true" />)}
            {currentStorageError ? `Could not save ${activeSection} to this browser.` : feedback}
          </p>
        </section>

        {currentStorageError && (
          <p className="storage-warning" role="alert">Browser storage is unavailable. Changes may not survive a refresh.</p>
        )}

        <label className="search-box workspace-search">
          <Search size={17} aria-hidden="true" />
            <span className="visually-hidden">Search {activeSection}</span>
          <input
            type="search"
            value={activeSection === 'collections' ? collectionSearch : search}
            onChange={(event) => activeSection === 'collections' ? setCollectionSearch(event.target.value) : setSearch(event.target.value)}
            placeholder={activeSection === 'notes'
              ? 'Search notes by title, content, or tag...'
              : activeSection === 'snippets'
                ? 'Search snippets by title, code, language, or tag...'
                : 'Search collections by name...'}
            aria-label={activeSection === 'notes'
              ? 'Search notes by title, content, or tag'
              : activeSection === 'snippets'
                ? 'Search snippets by title, code, language, or tag'
                : 'Search collections by name'}
          />
          {(activeSection === 'collections' ? collectionSearch : search) && (
            <button
              className="icon-button search-clear"
              type="button"
              onClick={() => activeSection === 'collections' ? setCollectionSearch('') : setSearch('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </label>

        {activeSection === 'dashboard' ? (
          <section className="dashboard-workspace" aria-label="DevVault dashboard">
            <div className="dashboard-welcome">
              <div><p className="eyebrow">YOUR DEVELOPER WORKSPACE</p><h2>Keep what you learn.</h2><p>Save useful ideas, code patterns, and notes — and find them when you need them.</p></div>
              <div className="dashboard-quick-actions">
                <button className="secondary-button" type="button" onClick={exportBackup} title="Download a backup of your workspace"><Download size={15} aria-hidden="true" />Export backup</button>
                <button className="secondary-button" type="button" onClick={() => backupInputRef.current?.click()} title="Restore from a DevVault backup"><Upload size={15} aria-hidden="true" />Import backup</button>
                <input ref={backupInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} aria-label="Choose DevVault backup file" />
                <button className="primary-button" type="button" onClick={createNote}><Plus size={15} aria-hidden="true" />New note</button>
                <button className="secondary-button" type="button" onClick={createSnippet}><Code2 size={15} aria-hidden="true" />New snippet</button>
              </div>
            </div>
            <div className="dashboard-stat-grid">
              <button className="dashboard-stat" type="button" onClick={() => setActiveSection('notes')}><span className="dashboard-stat-icon"><FileText size={17} aria-hidden="true" /></span><span className="dashboard-stat-label">Notes</span><strong>{notes.length}</strong><span className="dashboard-stat-foot">Open your notebook <span aria-hidden="true">↗</span></span></button>
              <button className="dashboard-stat" type="button" onClick={() => setActiveSection('snippets')}><span className="dashboard-stat-icon"><Code2 size={17} aria-hidden="true" /></span><span className="dashboard-stat-label">Code snippets</span><strong>{snippets.length}</strong><span className="dashboard-stat-foot">Browse saved code <span aria-hidden="true">↗</span></span></button>
              <button className="dashboard-stat" type="button" onClick={() => setActiveSection('collections')}><span className="dashboard-stat-icon"><FolderOpen size={17} aria-hidden="true" /></span><span className="dashboard-stat-label">Collections</span><strong>{collections.length}</strong><span className="dashboard-stat-foot">Organize your work <span aria-hidden="true">↗</span></span></button>
            </div>
            <div className="dashboard-recent-grid">
              <section className="dashboard-section">
                <div className="dashboard-section-heading"><div><h3>Recently updated notes</h3><p>Your latest saved knowledge</p></div><button className="text-button" type="button" onClick={() => setActiveSection('notes')}>All notes →</button></div>
                {sortedNotes.length ? <div className="dashboard-recent-list">{sortedNotes.slice(0, 4).map((note) => <button className="dashboard-recent-item" type="button" key={note.id} onClick={() => { setActiveNoteId(note.id); setActiveSection('notes') }}><FileText size={15} aria-hidden="true" /><span><strong>{note.title.trim() || 'Untitled note'}</strong><small>{note.content.trim().slice(0, 90) || 'No content yet'}</small></span><time>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></button>)}</div> : <div className="dashboard-empty"><FileText size={18} aria-hidden="true" /><p>No notes yet. Create one to capture something useful.</p></div>}
              </section>
              <section className="dashboard-section">
                <div className="dashboard-section-heading"><div><h3>Recently saved snippets</h3><p>Reusable code at a glance</p></div><button className="text-button" type="button" onClick={() => setActiveSection('snippets')}>All snippets →</button></div>
                {sortedSnippets.length ? <div className="dashboard-recent-list">{sortedSnippets.slice(0, 4).map((snippet) => <button className="dashboard-recent-item" type="button" key={snippet.id} onClick={() => { setActiveSnippetId(snippet.id); setSnippetDraft({ title: snippet.title, language: snippet.language, code: snippet.code, tagsText: snippet.tags.join(', '), collectionId: snippet.collectionId }); setSnippetDirty(false); setActiveSection('snippets') }}><Code2 size={15} aria-hidden="true" /><span><strong>{snippet.title}</strong><small>{snippet.language} · {snippet.code.trim().split('\n')[0].slice(0, 80)}</small></span><time>{new Date(snippet.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></button>)}</div> : <div className="dashboard-empty"><Code2 size={18} aria-hidden="true" /><p>No snippets yet. Save a useful pattern or command.</p></div>}
              </section>
            </div>
            <div className="dashboard-lower-grid">
              <section className="dashboard-section dashboard-start-section">
                <div className="dashboard-section-heading"><div><h3>Build your library</h3><p>A simple workflow for useful knowledge</p></div></div>
                <div className="dashboard-start-list">
                  <button type="button" className="dashboard-start-item" onClick={createNote}><span className="dashboard-start-number">01</span><span><strong>Capture an idea</strong><small>Save a lesson, command, or solution as a note.</small></span><Plus size={16} aria-hidden="true" /></button>
                  <button type="button" className="dashboard-start-item" onClick={createSnippet}><span className="dashboard-start-number">02</span><span><strong>Keep reusable code</strong><small>Store a pattern once so you can find it later.</small></span><Plus size={16} aria-hidden="true" /></button>
                  <button type="button" className="dashboard-start-item" onClick={() => setActiveSection('collections')}><span className="dashboard-start-number">03</span><span><strong>Organize by project</strong><small>Group related notes and snippets into collections.</small></span><FolderOpen size={16} aria-hidden="true" /></button>
                </div>
              </section>
              <section className="dashboard-section dashboard-backup-section">
                <div className="dashboard-section-heading"><div><h3>Your data, your control</h3><p>Local-first by design</p></div><span className="dashboard-privacy-icon"><Check size={15} aria-hidden="true" /></span></div>
                <p className="dashboard-backup-copy">Your notes, snippets, and collections are stored in this browser. Export a backup regularly to move your workspace to another device or keep a safe copy.</p>
                <div className="dashboard-backup-actions">
                  <button className="secondary-button" type="button" onClick={exportBackup}><Download size={14} aria-hidden="true" />Download backup</button>
                  <button className="text-button" type="button" onClick={() => backupInputRef.current?.click()}><Upload size={14} aria-hidden="true" />Restore backup</button>
                </div>
              </section>
            </div>
            <p className="dashboard-local-note"><span className="status-dot" aria-hidden="true" />Local storage is device-specific. Backups let you move your data safely.</p>
          </section>
        ) : activeSection === 'tools' ? (
          <section className="tools-workspace" aria-label="Developer utilities"><div className="tools-intro"><p className="eyebrow">UTILITY DESK</p><h2>Get the small jobs done.</h2><p>Format JSON and encode text without leaving your workspace. Runs in your browser.</p></div><div className="tool-tabs" role="tablist" aria-label="Choose a developer tool"><button type="button" role="tab" aria-selected={toolName === 'json'} className={toolName === 'json' ? 'is-active' : ''} onClick={() => { setToolName('json'); setToolOutput(''); setToolError('') }}>JSON formatter</button><button type="button" role="tab" aria-selected={toolName === 'base64'} className={toolName === 'base64' ? 'is-active' : ''} onClick={() => { setToolName('base64'); setToolOutput(''); setToolError('') }}>Base64 encoder</button><button type="button" role="tab" aria-selected={toolName === 'url'} className={toolName === 'url' ? 'is-active' : ''} onClick={() => { setToolName('url'); setToolOutput(''); setToolError('') }}>URL encoder</button></div><div className="tool-workbench"><label htmlFor="tool-input">{toolName === 'json' ? 'JSON input' : 'Text input'}</label><textarea id="tool-input" className="tool-textarea" value={toolInput} onChange={(event) => { setToolInput(event.target.value); setToolError('') }} placeholder={toolName === 'json' ? '{\n  "name": "DevVault",\n  "localFirst": true\n}' : 'Enter text to encode…'} spellCheck={false} /><div className="tool-actions"><button className="primary-button" type="button" onClick={runUtilityTool}><Play size={14} />{toolName === 'json' ? 'Format JSON' : 'Encode text'}</button><button className="secondary-button" type="button" onClick={() => { setToolInput(''); setToolOutput(''); setToolError('') }}>Clear</button></div>{toolError && <p className="tool-error" role="alert">{toolError}</p>}{toolOutput && <div className="tool-output"><div className="tool-output-heading"><strong>Output</strong><button className="text-button" type="button" onClick={() => { void navigator.clipboard.writeText(toolOutput).then(() => setFeedback('Output copied.')).catch(() => setToolError('Clipboard access was blocked by your browser.')) }}><Copy size={13} />Copy output</button></div><pre>{toolOutput}</pre></div>}</div></section>
        ) : activeSection === 'favorites' ? (
          <section className="favorites-workspace" aria-label="Favorite items"><div className="favorites-heading"><div><h2>Quick access</h2><p>Star notes and snippets to keep them close at hand.</p></div><span>{notes.filter((note) => note.favorite).length + snippets.filter((snippet) => snippet.favorite).length} saved</span></div><div className="favorites-grid">
          {notes.filter((note) => note.favorite).map((note) => <article className="favorite-card" key={note.id}><div className="favorite-card-type"><FileText size={14} /> NOTE <button className="icon-button favorite-toggle is-favorite" type="button" onClick={() => toggleNoteFavorite(note.id)} aria-label="Remove note from favorites"><Star size={15} fill="currentColor" /></button></div><button className="favorite-card-open" type="button" onClick={() => { setActiveSection('notes'); setActiveNoteId(note.id); setActiveTag(null) }}><strong>{note.title.trim() || 'Untitled note'}</strong><p>{note.content.trim() || 'No content yet'}</p></button></article>)}
          {snippets.filter((snippet) => snippet.favorite).map((snippet) => <article className="favorite-card" key={snippet.id}><div className="favorite-card-type"><Code2 size={14} /> {snippet.language.toUpperCase()} <button className="icon-button favorite-toggle is-favorite" type="button" onClick={() => toggleSnippetFavorite(snippet.id)} aria-label="Remove snippet from favorites"><Star size={15} fill="currentColor" /></button></div><button className="favorite-card-open" type="button" onClick={() => { setActiveSection('snippets'); setActiveSnippetId(snippet.id); setSnippetDraft({ title: snippet.title, language: snippet.language, code: snippet.code, tagsText: snippet.tags.join(', '), collectionId: snippet.collectionId }); setSnippetDirty(false) }}><strong>{snippet.title}</strong><p>{snippet.code.trim() || 'No code yet'}</p></button></article>)}
          </div>{notes.every((note) => !note.favorite) && snippets.every((snippet) => !snippet.favorite) && <div className="dashboard-empty favorites-empty"><Star size={20} /><h3>No favorites yet</h3><p>Open a note or snippet and tap its star to keep it here.</p></div>}</section>
        ) : activeSection === 'notes' ? (
        <section className="workspace" aria-label="Notes workspace">
          <div className="notes-panel">
            <div className="panel-heading">
              <div>
                <h2>{activeTag ? `Tagged “${activeTag}”` : 'All notes'}</h2>
                <p>{filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}</p>
              </div>
              {activeTag && (
                <button className="text-button" type="button" onClick={() => setActiveTag(null)}>Clear filter</button>
              )}
            </div>

            {filteredNotes.length > 0 ? (
              <div className="notes-list" aria-label="Notes">
                {filteredNotes.map((note) => (
                  <button
                    className={`note-card${activeNote?.id === note.id ? ' is-selected' : ''}`}
                    key={note.id}
                    type="button"
                    onClick={() => setActiveNoteId(note.id)}
                    aria-pressed={activeNote?.id === note.id}
                  >
                    <span className="note-card-title">{note.title.trim() || 'Untitled note'}</span>
                    <span className="note-card-preview">{note.content.trim() || 'No content yet'}</span>
                    <span className="note-card-footer">
                      <span className="note-date">{new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      {note.tags.length > 0 && (
                        <span className="note-card-tags">{note.tags.slice(0, 2).map((tag) => <span className="mini-tag" key={tag}>{tag}</span>)}{note.tags.length > 2 && <span className="more-tags">+{note.tags.length - 2}</span>}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="list-empty-state">
                <span className="empty-icon"><Search size={19} aria-hidden="true" /></span>
                <h3>{notes.length === 0 ? 'Your notebook is ready' : 'No matching notes'}</h3>
                <p>{notes.length === 0 ? 'Capture a useful snippet, idea, or reminder.' : 'Try another search or clear the active filter.'}</p>
                {notes.length === 0 ? (
                  <button className="text-button" type="button" onClick={createNote}>Create your first note</button>
                ) : (
                  <button className="text-button" type="button" onClick={() => { setSearch(''); setActiveTag(null) }}>Clear search and filters</button>
                )}
              </div>
            )}
          </div>

          <section className="editor-panel" aria-label={activeNote ? 'Edit note' : 'Note editor'}>
            {activeNote ? (
              <>
                <div className="editor-toolbar">
                  <span className="editor-state"><span className="status-dot" aria-hidden="true" />{storageError ? 'Not saved' : 'Saved on this device'}</span>
                  <button className={`icon-button favorite-toggle${activeNote.favorite ? " is-favorite" : ""}`} type="button" onClick={() => toggleNoteFavorite(activeNote.id)} aria-label={activeNote.favorite ? "Remove note from favorites" : "Add note to favorites"} title="Toggle favorite"><Star size={16} fill={activeNote.favorite ? "currentColor" : "none"} aria-hidden="true" /></button>
                  <button className="icon-button delete-button" type="button" onClick={deleteNote} aria-label="Delete note" title="Delete note">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="editor-fields">
                  <label className="visually-hidden" htmlFor="note-title">Note title</label>
                  <input
                    className="title-input"
                    id="note-title"
                    type="text"
                    value={activeNote.title}
                    onChange={(event) => updateNote(activeNote.id, { title: event.target.value })}
                    placeholder="Untitled note"
                    maxLength={120}
                  />
                  <div className="editor-meta">
                    <span>Edited {new Date(activeNote.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <label className="field-label" htmlFor="note-tags">Tags <span>Separate with commas</span></label>
                  <input
                    className="tags-input"
                    id="note-tags"
                    type="text"
                    value={tagDraft?.noteId === activeNote.id ? tagDraft.value : activeNote.tags.join(', ')}
                    onChange={(event) => updateTags(activeNote.id, event.target.value)}
                    placeholder="typescript, snippets"
                  />
                  <label className="field-label" htmlFor="note-collection">Collection</label>
                  <select
                    className="tags-input collection-select"
                    id="note-collection"
                    value={activeNote.collectionId ?? ''}
                    onChange={(event) => updateNote(activeNote.id, { collectionId: event.target.value || undefined })}
                  >
                    <option value="">Uncategorized</option>
                    {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                  </select>
                  {activeNote.tags.length > 0 && (
                    <div className="editor-tags" aria-label="Current tags">
                      {activeNote.tags.map((tag) => <span className="tag-chip" key={tag}><Tag size={12} aria-hidden="true" />{tag}</span>)}
                    </div>
                  )}
                  <label className="visually-hidden" htmlFor="note-content">Note content</label>
                  <textarea
                    className="content-input"
                    id="note-content"
                    value={activeNote.content}
                    onChange={(event) => updateNote(activeNote.id, { content: event.target.value })}
                    placeholder="Write something worth keeping..."
                    spellCheck
                  />
                  <div className="editor-footer"><span>{activeNote.content.length} characters</span><span>Autosaved locally</span></div>
                </div>
              </>
            ) : (
              <div className="editor-empty-state">
                <span className="empty-icon"><FileText size={20} aria-hidden="true" /></span>
                <h3>Select a note to read</h3>
                <p>Or start with a fresh note for your next idea.</p>
                <button className="secondary-button" type="button" onClick={createNote}><Plus size={16} aria-hidden="true" />New note</button>
              </div>
            )}
          </section>
        </section>
        ) : activeSection === 'snippets' ? (
          <section className="workspace snippets-workspace" aria-label="Code snippets workspace">
            <div className="notes-panel">
              <div className="panel-heading snippet-list-heading">
                <div>
                  <h2>{activeSnippetTag ? `Tagged “${activeSnippetTag}”` : 'All snippets'}</h2>
                  <p>{filteredSnippets.length} {filteredSnippets.length === 1 ? 'snippet' : 'snippets'}</p>
                </div>
                {activeSnippetTag && (
                  <button className="text-button" type="button" onClick={() => setActiveSnippetTag(null)}>Clear tag</button>
                )}
              </div>
              <label className="language-filter-label" htmlFor="language-filter">Filter by language</label>
              <select
                className="language-filter"
                id="language-filter"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
              >
                <option value="">All languages</option>
                {snippetLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>

              {filteredSnippets.length > 0 ? (
                <div className="notes-list snippets-list" aria-label="Code snippets">
                  {filteredSnippets.map((snippet) => (
                    <button
                      className={`note-card snippet-card${activeSnippetId === snippet.id ? ' is-selected' : ''}`}
                      key={snippet.id}
                      type="button"
                      onClick={() => selectSnippet(snippet)}
                      aria-pressed={activeSnippetId === snippet.id}
                    >
                      <span className="snippet-card-heading">
                        <span className="note-card-title">{snippet.title}</span>
                        <span className="language-badge">{snippet.language}</span>
                      </span>
                      <code className="snippet-preview">{snippet.code}</code>
                      <span className="note-card-footer">
                        <span className="note-date">{new Date(snippet.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        {snippet.tags.length > 0 && (
                          <span className="note-card-tags">{snippet.tags.slice(0, 2).map((tag) => <span className="mini-tag" key={tag}>{tag}</span>)}{snippet.tags.length > 2 && <span className="more-tags">+{snippet.tags.length - 2}</span>}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="list-empty-state snippet-list-empty">
                  <span className="empty-icon"><Code2 size={19} aria-hidden="true" /></span>
                  <h3>{snippets.length === 0 ? 'Your snippet library is ready' : 'No matching snippets'}</h3>
                  <p>{snippets.length === 0 ? 'Save a useful command, pattern, or code example.' : 'Try a different search or clear your filters.'}</p>
                  {snippets.length === 0 ? (
                    <button className="text-button" type="button" onClick={createSnippet}>Create your first snippet</button>
                  ) : (
                    <button className="text-button" type="button" onClick={() => { setSearch(''); setActiveSnippetTag(null); setLanguageFilter('') }}>
                      Clear search and filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <section className="editor-panel snippet-editor-panel" aria-label={snippetDraft ? 'Snippet editor' : 'Snippet details'}>
              {snippetDraft ? (
                <form className="snippet-form" onSubmit={saveSnippet} noValidate>
                  <div className="editor-toolbar">
                    <span className="editor-state">
                      <span className={`status-dot${snippetDirty ? ' is-unsaved' : ''}`} aria-hidden="true" />
                      {snippetStorageError ? 'Not saved' : snippetDirty ? 'Unsaved changes' : 'Saved on this device'}
                    </span>
                    <div className="snippet-toolbar-actions">
                      <button className="text-button copy-button" type="button" onClick={copySnippetCode} disabled={!snippetDraft.code}>
                        <Copy size={14} aria-hidden="true" />Copy code
                      </button>
                      {activeSnippetId && (
                        <>
                          <button className={`icon-button favorite-toggle${activeSnippet?.favorite ? ' is-favorite' : ''}`} type="button" onClick={() => toggleSnippetFavorite(activeSnippetId)} aria-label={activeSnippet?.favorite ? 'Remove snippet from favorites' : 'Add snippet to favorites'} title="Toggle favorite"><Star size={16} fill={activeSnippet?.favorite ? 'currentColor' : 'none'} aria-hidden="true" /></button>
                          <button className="icon-button delete-button" type="button" onClick={deleteSnippet} aria-label="Delete snippet" title="Delete snippet"><Trash2 size={16} aria-hidden="true" /></button>
                        </>
                      )}}
                    </div>
                  </div>
                  <div className="editor-fields snippet-fields">
                    <label className="field-label snippet-field-label" htmlFor="snippet-title">Title</label>
                    <input
                      className="title-input snippet-title-input"
                      id="snippet-title"
                      type="text"
                      value={snippetDraft.title}
                      onChange={(event) => updateSnippetDraft('title', event.target.value)}
                      placeholder="e.g. Fetch with timeout"
                      maxLength={120}
                      aria-invalid={Boolean(snippetErrors.title)}
                      aria-describedby={snippetErrors.title ? 'snippet-title-error' : undefined}
                    />
                    {snippetErrors.title && <span className="snippet-error" id="snippet-title-error" role="alert">{snippetErrors.title}</span>}

                    <label className="field-label snippet-field-label" htmlFor="snippet-language">Language</label>
                    <input
                      className="tags-input snippet-language-input"
                      id="snippet-language"
                      type="text"
                      value={snippetDraft.language}
                      onChange={(event) => updateSnippetDraft('language', event.target.value)}
                      placeholder="e.g. TypeScript"
                      list="snippet-language-options"
                      aria-invalid={Boolean(snippetErrors.language)}
                      aria-describedby={snippetErrors.language ? 'snippet-language-error' : undefined}
                    />
                    <datalist id="snippet-language-options">
                      {['TypeScript', 'JavaScript', 'Python', 'CSS', 'HTML', 'SQL', 'Bash', 'JSON', 'Other']
                        .map((language) => <option key={language} value={language} />)}
                    </datalist>
                    {snippetErrors.language && <span className="snippet-error" id="snippet-language-error" role="alert">{snippetErrors.language}</span>}

                    <label className="field-label snippet-field-label" htmlFor="snippet-tags">Tags <span>Separate with commas</span></label>
                    <input
                      className="tags-input snippet-language-input"
                      id="snippet-tags"
                      type="text"
                      value={snippetDraft.tagsText}
                      onChange={(event) => updateSnippetDraft('tagsText', event.target.value)}
                      placeholder="utility, api"
                    />

                    <label className="field-label snippet-field-label" htmlFor="snippet-collection">Collection</label>
                    <select
                      className="tags-input snippet-language-input collection-select"
                      id="snippet-collection"
                      value={snippetDraft.collectionId ?? ''}
                      onChange={(event) => updateSnippetDraft('collectionId', event.target.value)}
                    >
                      <option value="">Uncategorized</option>
                      {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                    </select>

                    <label className="field-label snippet-field-label" htmlFor="snippet-code">Code</label>
                    <textarea
                      className="content-input snippet-code-input"
                      id="snippet-code"
                      value={snippetDraft.code}
                      onChange={(event) => updateSnippetDraft('code', event.target.value)}
                      placeholder={'// Paste or write your snippet here'}
                      spellCheck={false}
                      aria-invalid={Boolean(snippetErrors.code)}
                      aria-describedby={snippetErrors.code ? 'snippet-code-error' : undefined}
                    />
                    {snippetErrors.code && <span className="snippet-error" id="snippet-code-error" role="alert">{snippetErrors.code}</span>}
                    <section className="snippet-output" aria-labelledby="snippet-output-title">
                      <div className="snippet-output-header">
                        <h3 id="snippet-output-title">Output</h3>
                        <div className="snippet-output-actions">
                          {snippetRunnerMode === 'javascript' && (
                            <button
                              className="secondary-button run-code-button"
                              type="button"
                              onClick={runSnippetCode}
                              disabled={isRunning}
                            >
                              <Play size={14} aria-hidden="true" />
                              {isRunning ? 'Running...' : 'Run Code'}
                            </button>
                          )}
                          {snippetRunnerMode === 'javascript' && (
                            <button className="text-button clear-output-button" type="button" onClick={clearOutput}>
                              Clear Output
                            </button>
                          )}
                        </div>
                      </div>
                      {snippetRunnerMode === 'html-preview' || snippetRunnerMode === 'css-preview' ? (
                        <div className="snippet-preview-output">
                          <iframe
                            className="live-preview-frame"
                            title={`${snippetDraft.language} live preview`}
                            sandbox=""
                            srcDoc={createPreviewDocument(snippetDraft.language, snippetDraft.code)}
                          />
                          <p className="output-helper" role="status">Live preview only. Scripts and external resources are blocked.</p>
                        </div>
                      ) : snippetRunnerMode === 'unsupported' ? (
                        <p className="output-message" role="status">
                          {snippetDraft.language.trim()
                            ? `${snippetDraft.language} execution is not available yet. This code has not been run.`
                            : 'Choose a language to see whether execution or preview is available.'}
                        </p>
                      ) : (
                        <div className="console-output" aria-live="polite" aria-relevant="additions text">
                          {consoleEntries.length > 0 ? consoleEntries.map((entry) => (
                            <pre className={`console-entry is-${entry.kind}`} key={entry.id}>{entry.text}</pre>
                          )) : (
                            <p className="output-message">
                              {runFinished
                                ? 'No console output was produced. Add a console.log() call to inspect a value.'
                                : 'Run the snippet to see console output here.'}
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                    <div className="snippet-form-footer">
                      <span>{snippetDraft.code.length} characters</span>
                      <div>
                        <button className="secondary-button snippet-cancel" type="button" onClick={cancelSnippetEdit}>Cancel</button>
                        <button className="primary-button snippet-save" type="submit"><Save size={15} aria-hidden="true" />Save snippet</button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="editor-empty-state snippet-editor-empty">
                  <span className="empty-icon"><Code2 size={20} aria-hidden="true" /></span>
                  <h3>Select a snippet to view</h3>
                  <p>Choose a saved example or add a new piece of code.</p>
                  <button className="secondary-button" type="button" onClick={createSnippet}><Plus size={16} aria-hidden="true" />New snippet</button>
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="workspace collection-workspace" aria-label="Collections workspace">
            <div className="notes-panel collection-list-panel">
              <div className="panel-heading">
                <div>
                  <h2>Collections</h2>
                  <p>{filteredCollections.length} {filteredCollections.length === 1 ? 'collection' : 'collections'}</p>
                </div>
              </div>
              <button
                className={`collection-list-item${selectedCollectionId === uncategorizedId ? ' is-selected' : ''}`}
                type="button"
                onClick={() => { setSelectedCollectionId(uncategorizedId); setCollectionDraft(null) }}
                aria-pressed={selectedCollectionId === uncategorizedId}
              >
                <FolderOpen size={16} aria-hidden="true" />
                <span>Uncategorized</span>
                <span className="nav-count">{notes.filter((note) => !note.collectionId || !collections.some((collection) => collection.id === note.collectionId)).length + snippets.filter((snippet) => !snippet.collectionId || !collections.some((collection) => collection.id === snippet.collectionId)).length}</span>
              </button>
              {filteredCollections.length > 0 ? (
                <div className="collection-card-list">
                  {filteredCollections.map((collection) => (
                    <div className={`collection-list-card${selectedCollectionId === collection.id ? ' is-selected' : ''}`} key={collection.id}>
                      <button
                        className="collection-list-select"
                        type="button"
                        onClick={() => { setSelectedCollectionId(collection.id); setCollectionDraft(null) }}
                        aria-pressed={selectedCollectionId === collection.id}
                      >
                        <FolderOpen size={16} aria-hidden="true" />
                        <span className="collection-list-name">{collection.name}</span>
                        <span className="nav-count">{notes.filter((note) => note.collectionId === collection.id).length + snippets.filter((snippet) => snippet.collectionId === collection.id).length}</span>
                      </button>
                      <button className="icon-button collection-action" type="button" onClick={() => startCollectionEdit(collection)} aria-label={`Rename ${collection.name}`} title="Rename collection">
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : collectionSearch.trim() ? (
                <p className="collection-search-empty">No collections match that search.</p>
              ) : (
                <p className="collection-search-empty">Create a collection to group related notes and code.</p>
              )}
              <button className="text-button collection-add-button" type="button" onClick={() => startCollectionEdit()}>
                <Plus size={14} aria-hidden="true" />New collection
              </button>
            </div>

            <section className="editor-panel collection-detail-panel" aria-label={collectionDraft ? 'Collection form' : 'Collection contents'}>
              {collectionDraft ? (
                <form className="collection-form" onSubmit={saveCollection} noValidate>
                  <div className="editor-toolbar">
                    <span className="editor-state"><FolderOpen size={14} aria-hidden="true" />{collectionDraft.id ? 'Edit collection' : 'New collection'}</span>
                  </div>
                  <div className="editor-fields">
                    <label className="field-label collection-field-label" htmlFor="collection-name">Name</label>
                    <input
                      className="tags-input collection-form-input"
                      id="collection-name"
                      type="text"
                      value={collectionDraft.name}
                      onChange={(event) => { setCollectionDraft({ ...collectionDraft, name: event.target.value }); setCollectionError('') }}
                      placeholder="e.g. Frontend patterns"
                      maxLength={60}
                      required
                      aria-invalid={Boolean(collectionError)}
                      aria-describedby={collectionError ? 'collection-name-error' : undefined}
                    />
                    {collectionError && <p className="collection-error" id="collection-name-error" role="alert">{collectionError}</p>}
                    <label className="field-label collection-field-label" htmlFor="collection-description">Description <span>Optional</span></label>
                    <textarea
                      className="content-input collection-description-input"
                      id="collection-description"
                      value={collectionDraft.description}
                      onChange={(event) => setCollectionDraft({ ...collectionDraft, description: event.target.value })}
                      placeholder="What belongs in this collection?"
                      maxLength={180}
                    />
                    <div className="collection-icon-preview"><FolderOpen size={17} aria-hidden="true" /><span>Collection icon</span></div>
                    <div className="collection-form-actions">
                      <button className="secondary-button collection-cancel" type="button" onClick={() => { setCollectionDraft(null); setCollectionError('') }}>Cancel</button>
                      <button className="primary-button collection-save" type="submit">{collectionDraft.id ? 'Save changes' : 'Create collection'}</button>
                    </div>
                  </div>
                </form>
              ) : selectedCollectionId !== null ? (
                <div className="collection-detail">
                  <div className="collection-detail-heading">
                    <div className="collection-detail-title">
                      <span className="collection-icon"><FolderOpen size={18} aria-hidden="true" /></span>
                      <div>
                        <h2>{selectedCollection?.name ?? 'Uncategorized'}</h2>
                        <p>{selectedCollection?.description || 'Notes and snippets not assigned to a collection.'}</p>
                      </div>
                    </div>
                    {selectedCollection && (
                      <div className="collection-detail-actions">
                        <button className="icon-button collection-action" type="button" onClick={() => startCollectionEdit(selectedCollection)} aria-label="Rename collection" title="Rename collection">
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button className="icon-button delete-button" type="button" onClick={() => deleteCollection(selectedCollection)} aria-label="Delete collection" title="Delete collection">
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                  {collectionNotes.length === 0 && collectionSnippets.length === 0 ? (
                    <div className="editor-empty-state collection-empty-state">
                      <span className="empty-icon"><FolderOpen size={20} aria-hidden="true" /></span>
                      <h3>This collection is empty</h3>
                      <p>Assign notes or code snippets to this collection from their editors.</p>
                    </div>
                  ) : (
                    <div className="collection-content-list">
                      {collectionNotes.length > 0 && (
                        <section className="collection-content-group" aria-labelledby="collection-notes-heading">
                          <h3 id="collection-notes-heading">Notes <span>{collectionNotes.length}</span></h3>
                          {collectionNotes.map((note) => (
                            <article className="collection-entry" key={`note-${note.id}`}>
                              <FileText size={15} aria-hidden="true" />
                              <div className="collection-entry-text">
                                <strong>{note.title.trim() || 'Untitled note'}</strong>
                                <p>{note.content.trim() || 'No content yet'}</p>
                              </div>
                              <button className="text-button collection-open-button" type="button" onClick={() => openCollectionNote(note)}>Open</button>
                            </article>
                          ))}
                        </section>
                      )}
                      {collectionSnippets.length > 0 && (
                        <section className="collection-content-group" aria-labelledby="collection-snippets-heading">
                          <h3 id="collection-snippets-heading">Code snippets <span>{collectionSnippets.length}</span></h3>
                          {collectionSnippets.map((snippet) => (
                            <article className="collection-entry" key={`snippet-${snippet.id}`}>
                              <Code2 size={15} aria-hidden="true" />
                              <div className="collection-entry-text">
                                <strong>{snippet.title}</strong>
                                <p>{snippet.language} · {snippet.code.trim().split('\n')[0] || 'Empty code'}</p>
                              </div>
                              <button className="text-button collection-open-button" type="button" onClick={() => openCollectionSnippet(snippet)}>Open</button>
                            </article>
                          ))}
                        </section>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="editor-empty-state collection-empty-state">
                  <span className="empty-icon"><FolderOpen size={20} aria-hidden="true" /></span>
                  <h3>Organize your knowledge</h3>
                  <p>Select a collection to see its notes and snippets, or create one to get started.</p>
                  <button className="secondary-button" type="button" onClick={() => startCollectionEdit()}><Plus size={15} aria-hidden="true" />New collection</button>
                </div>
              )}
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
