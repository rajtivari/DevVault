export type RunnerMode = 'javascript' | 'html-preview' | 'css-preview' | 'unsupported'
export type ConsoleEntryKind = 'log' | 'error'

export type ConsoleEntry = {
  id: string
  kind: ConsoleEntryKind
  text: string
}

export type SandboxRun = {
  cancel: () => void
}

type RunnerMessage = {
  source: 'devvault-runner'
  runId: string
  kind: ConsoleEntryKind | 'complete' | 'fatal'
  text?: string
}

const executionTimeoutMs = 4000
const maxConsoleEntries = 100
const maxEntryLength = 4000

const languageModes: Record<string, RunnerMode> = {
  javascript: 'javascript',
  js: 'javascript',
  ecmascript: 'javascript',
  html: 'html-preview',
  css: 'css-preview',
}

export function getRunnerMode(language: string): RunnerMode {
  return languageModes[language.trim().toLowerCase()] ?? 'unsupported'
}

export function createPreviewDocument(language: string, code: string): string {
  const contentSecurityPolicy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  const securityHeader = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`

  if (getRunnerMode(language) === 'css-preview') {
    return `<!doctype html><html><head>${securityHeader}<meta name="viewport" content="width=device-width, initial-scale=1"><style>
      :root { color-scheme: light; font: 16px/1.5 system-ui, sans-serif; }
      body { margin: 0; padding: 24px; }
      ${code}
    </style></head><body><main class="devvault-css-preview"><h1>CSS preview</h1><p>Use this sample content to inspect your styles.</p><button type="button">Example button</button></main></body></html>`
  }

  return `<!doctype html>${securityHeader}<meta name="viewport" content="width=device-width, initial-scale=1">${code}`
}

const sandboxDocument = `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<script>
let worker;
let timeoutId;
let objectUrl;
let executionCompleted = false;
const send = (message) => parent.postMessage({ source: 'devvault-runner', ...message }, '*');
const formatValue = (value) => {
  if (typeof value === 'string') return value;
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
};
const dispose = () => {
  clearTimeout(timeoutId);
  if (worker) worker.terminate();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
};
window.addEventListener('message', (event) => {
  if (event.source !== parent || event.data?.type !== 'devvault-run') return;
  const { runId, code, timeoutMs } = event.data;
  const workerSource = [
    'const emit = (kind, values) => {',
    '  let text;',
    '  try { text = values.map((value) => {',
    '    if (typeof value === "string") return value;',
    '    try { const json = JSON.stringify(value); return json === undefined ? String(value) : json; } catch { return String(value); }',
    '  }).join(" "); } catch { text = "Unable to format console output."; }',
    '  self.postMessage({ kind, text });',
    '};',
    'self.console = {',
    '  log: (...values) => emit("log", values),',
    '  info: (...values) => emit("log", values),',
    '  warn: (...values) => emit("log", values),',
    '  error: (...values) => emit("error", values)',
    '};',
    'self.Worker = undefined;',
    'self.SharedWorker = undefined;',
    'self.importScripts = () => { throw new Error("Importing scripts is disabled in this runner."); };',
    'self.addEventListener("error", (event) => { emit("error", [event.message || "Uncaught error"]); event.preventDefault(); });',
    'self.addEventListener("unhandledrejection", (event) => { emit("error", [event.reason]); event.preventDefault(); });',
    'try {',
    code,
    '} catch (error) { emit("error", [error && error.stack ? error.stack : error]); }',
    'self.postMessage({ kind: "complete" });'
  ].join('\\n');

  try {
    objectUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    worker = new Worker(objectUrl);
    worker.onmessage = (workerEvent) => {
      if (workerEvent.data?.kind === 'complete') {
        executionCompleted = true;
        send({ runId, kind: 'complete' });
        return;
      }
      send({ runId, kind: workerEvent.data?.kind === 'error' ? 'error' : 'log', text: String(workerEvent.data?.text ?? '') });
    };
    worker.onerror = (workerEvent) => {
      send({ runId, kind: 'error', text: workerEvent.message || 'The snippet could not be executed.' });
      send({ runId, kind: 'fatal' });
      dispose();
    };
    worker.postMessage({ type: 'run', runId });
    timeoutId = setTimeout(() => {
      if (!executionCompleted) send({ runId, kind: 'error', text: 'Execution stopped after 4 seconds.' });
      send({ runId, kind: 'fatal' });
      dispose();
    }, timeoutMs);
  } catch (error) {
    send({ runId, kind: 'error', text: error instanceof Error ? error.message : String(error) });
    send({ runId, kind: 'fatal' });
    dispose();
  }
});
</script>`

export function runJavaScriptInSandbox(
  code: string,
  onEntry: (entry: ConsoleEntry) => void,
  onComplete: () => void,
): SandboxRun {
  const runId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  const iframe = document.createElement('iframe')
  iframe.title = 'Isolated JavaScript execution sandbox'
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.srcdoc = sandboxDocument
  Object.assign(iframe.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    left: '-10px',
    bottom: '0',
    opacity: '0',
    pointerEvents: 'none',
  })

  let disposed = false
  let completionNotified = false
  let completed = false
  let entryCount = 0
  let truncationReported = false
  let timeoutId = 0

  const notifyCompletion = () => {
    if (completionNotified) return
    completionNotified = true
    onComplete()
  }

  const dispose = (notify = true) => {
    if (disposed) return
    disposed = true
    window.clearTimeout(timeoutId)
    window.removeEventListener('message', handleMessage)
    iframe.removeEventListener('load', startRun)
    iframe.remove()
    if (notify) notifyCompletion()
  }

  const appendEntry = (kind: ConsoleEntryKind, text: string) => {
    if (entryCount >= maxConsoleEntries) {
      if (!truncationReported) {
        truncationReported = true
        onEntry({ id: `${runId}-truncated`, kind: 'error', text: `Output limited to ${maxConsoleEntries} entries.` })
      }
      return
    }
    entryCount += 1
    onEntry({ id: `${runId}-${entryCount}`, kind, text: text.slice(0, maxEntryLength) })
  }

  const handleMessage = (event: MessageEvent<RunnerMessage>) => {
    if (event.source !== iframe.contentWindow || event.data?.source !== 'devvault-runner' || event.data.runId !== runId) return

    if (event.data.kind === 'complete') {
      completed = true
      notifyCompletion()
      return
    }
    if (event.data.kind === 'fatal') {
      dispose()
      return
    }
    appendEntry(event.data.kind, event.data.text ?? '')
  }

  const startRun = () => {
    iframe.contentWindow?.postMessage({
      type: 'devvault-run',
      runId,
      code,
      timeoutMs: executionTimeoutMs,
    }, '*')
  }

  window.addEventListener('message', handleMessage)
  iframe.addEventListener('load', startRun, { once: true })
  document.body.append(iframe)
  timeoutId = window.setTimeout(() => {
    if (!completed) appendEntry('error', 'Execution timed out after 4 seconds.')
    dispose()
  }, executionTimeoutMs + 300)

  return { cancel: () => dispose(false) }
}