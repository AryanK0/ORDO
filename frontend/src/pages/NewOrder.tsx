import {
  Download,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  Headphones,
  Loader2,
  Mic,
  Pause,
  Play,
  Save,
  Send,
  Square,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { useLiveOrderStore } from '../store/useLiveOrderStore'
import { useOrdersStore } from '../store/useOrdersStore'
import type { GeneratedOutput, RecognitionRow } from '../types'
import { RecognitionTable } from '../components/orders/RecognitionTable'
import { UploadDropzone, type UploadPreview } from '../components/orders/UploadDropzone'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog } from '../components/ui/dialog'

type OrderMode = 'handwritten' | 'audio' | 'live'

interface BrowserSpeechRecognitionResult {
  isFinal: boolean
  0: {
    transcript: string
  }
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

interface BrowserSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

const modeOptions: Array<{
  id: OrderMode
  label: string
  icon: typeof FileImage
  description: string
}> = [
  {
    id: 'handwritten',
    label: 'Handwritten Order',
    icon: FileImage,
    description: 'Images, PDFs, and multi-page batches',
  },
  {
    id: 'audio',
    label: 'Audio Order',
    icon: FileAudio,
    description: 'Call recordings and voice notes',
  },
  {
    id: 'live',
    label: 'Live Voice Order',
    icon: Headphones,
    description: 'Speakerphone capture with live edits',
  },
]

function buildPreviews(files: File[]): UploadPreview[] {
  return files.map((file, index) => ({
    id: crypto.randomUUID(),
    fileName: file.name,
    label: files.length > 1 ? `Page ${index + 1}` : file.name,
    status: 'queued',
    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  }))
}

export function NewOrder() {
  const queryClient = useQueryClient()
  const { activeOrder, previewUrl, setActiveOrder, setPreviewUrl, updateRows } = useOrdersStore()
  const liveStore = useLiveOrderStore()
  const [mode, setMode] = useState<OrderMode>('handwritten')
  const [success, setSuccess] = useState<GeneratedOutput | null>(null)
  const [previews, setPreviews] = useState<UploadPreview[]>([])
  const [transcriptDraft, setTranscriptDraft] = useState('')
  const [liveDraft, setLiveDraft] = useState('')
  const [liveStatus, setLiveStatus] = useState('Idle')
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const rowsRef = useRef<RecognitionRow[]>([])
  const previewsRef = useRef<UploadPreview[]>([])
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    rowsRef.current = activeOrder?.rows ?? []
  }, [activeOrder?.rows])

  useEffect(() => {
    previewsRef.current = previews
  }, [previews])

  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  useEffect(
    () => () => {
      previewsRef.current.forEach((preview) => {
        if (preview.url) URL.revokeObjectURL(preview.url)
      })
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop()
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  function refreshData() {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    void queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  function setOrder(order: typeof activeOrder) {
    setActiveOrder(order)
    refreshData()
  }

  const processOrder = useMutation({
    mutationFn: api.processOrder,
    onSuccess: (order) => {
      setOrder(order)
      setPreviews((current) =>
        current.map((preview, index) => {
          const page = order.pages[index]
          return {
            ...preview,
            status: page?.status ?? 'complete',
            message: page ? `${page.rowCount} rows from ${page.lineCount} OCR lines` : undefined,
          }
        }),
      )
    },
  })

  const processAudio = useMutation({
    mutationFn: api.processAudio,
    onSuccess: (order) => {
      setOrder(order)
      setTranscriptDraft(order.transcript ?? '')
      setPreviews((current) => current.map((preview) => ({ ...preview, status: 'complete' })))
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Audio transcription failed.'
      setPreviews((current) =>
        current.map((preview) => ({
          ...preview,
          status: 'failed',
          message,
        })),
      )
    },
  })

  const processTranscript = useMutation({
    mutationFn: () => api.processTranscript(transcriptDraft, 'Manual Audio Transcript'),
    onSuccess: (order) => {
      setOrder(order)
      setMode('audio')
    },
  })

  const saveRows = useMutation({
    mutationFn: () => api.updateRows(activeOrder?.id ?? '', activeOrder?.rows ?? []),
    onSuccess: (order) => setOrder(order),
  })

  const generate = useMutation({
    mutationFn: (kind: 'updated' | 'items') => api.generateOutput(activeOrder?.id ?? '', kind),
    onSuccess: (output) => {
      setSuccess(output)
      refreshData()
    },
  })

  async function submitLiveText(text: string, sessionId = liveStore.sessionId) {
    const cleaned = text.trim()
    if (!cleaned || !sessionId) return
    const response = await api.sendLiveTranscript(sessionId, cleaned, rowsRef.current)
    liveStore.applyLiveState({
      transcript: response.transcript,
      rows: response.order.rows,
      events: response.events,
    })
    setOrder(response.order)
  }

  async function startLiveSession() {
    const response = await api.createLiveSession('Live Voice Order')
    liveStore.reset()
    liveStore.setSession(response.sessionId)
    liveStore.applyLiveState({
      transcript: response.transcript,
      rows: response.order.rows,
      events: response.events,
    })
    setOrder(response.order)
    try {
      await startBrowserCapture(response.sessionId)
    } catch (error) {
      setLiveStatus(error instanceof Error ? error.message : 'Microphone capture could not start.')
    }
  }

  async function startBrowserCapture(sessionId: string) {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = false
      recognition.lang = 'en-IN'
      recognition.onresult = (event) => {
        const chunks: string[] = []
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (result.isFinal) chunks.push(result[0].transcript)
        }
        if (chunks.length) void submitLiveText(chunks.join(' '), sessionId)
      }
      recognition.onerror = () => setLiveStatus('Speech recognition error. Use manual live text or resume.')
      recognition.onend = () => liveStore.setListening(false)
      recognition.start()
      recognitionRef.current = recognition
      liveStore.setListening(true)
      setLiveStatus('Listening with browser speech recognition')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser microphone capture is not available. Use the manual live text input.')
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        void api.sendLiveChunk(sessionId, event.data, rowsRef.current).then((response) => {
          liveStore.applyLiveState({
            transcript: response.transcript,
            rows: response.order.rows,
            events: response.events,
          })
          setOrder(response.order)
        })
      }
    }
    recorder.start(6000)
    mediaStreamRef.current = stream
    mediaRecorderRef.current = recorder
    liveStore.setListening(true)
    setLiveStatus('Listening with microphone chunks')
  }

  function stopBrowserCapture() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    mediaRecorderRef.current = null
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    liveStore.setListening(false)
  }

  async function pauseLive() {
    stopBrowserCapture()
    setLiveStatus('Paused')
  }

  async function resumeLive() {
    if (!liveStore.sessionId) return
    await startBrowserCapture(liveStore.sessionId)
  }

  async function stopLive() {
    stopBrowserCapture()
    if (!liveStore.sessionId) return
    const order = await api.stopLiveSession(liveStore.sessionId)
    setOrder(order)
    setLiveStatus('Stopped. Review and generate Excel outputs.')
  }

  function handleHandwrittenFiles(files: File[]) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    previews.forEach((preview) => {
      if (preview.url) URL.revokeObjectURL(preview.url)
    })
    const nextPreviews = buildPreviews(files)
    setPreviews(nextPreviews.map((preview) => ({ ...preview, status: 'processing' })))
    setPreviewUrl(nextPreviews.find((preview) => preview.url)?.url ?? null)
    processOrder.mutate(files)
  }

  function handleAudioFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setPreviews(buildPreviews([file]).map((preview) => ({ ...preview, status: 'transcribing' })))
    processAudio.mutate(file)
  }

  const isBusy = processOrder.isPending || processAudio.isPending || processTranscript.isPending
  const activeError = processOrder.error ?? processAudio.error ?? processTranscript.error

  return (
    <div className="space-y-6 pb-24">
      <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/35 p-6 shadow-2xl shadow-black/25 md:p-8">
        <p className="text-sm font-medium text-red-300">New order</p>
        <h1 className="mt-2 max-w-full text-wrap text-3xl font-semibold tracking-normal text-white md:text-5xl">
          ORDO Order Processing
        </h1>
        <p className="mt-4 max-w-2xl text-wrap text-sm leading-6 text-zinc-500">
          Upload written orders, transcribe call recordings, or capture live speakerphone orders into the same editable Excel workflow.
        </p>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {modeOptions.map((option) => {
          const Icon = option.icon
          const selected = mode === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`min-h-[132px] overflow-hidden rounded-lg border p-4 text-left shadow-xl shadow-black/10 transition ${
                selected
                  ? 'border-red-500/50 bg-red-500/10 text-white shadow-red-950/20'
                  : 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <Icon size={20} className={selected ? 'text-red-300' : 'text-zinc-500'} />
              <p className="mt-3 text-wrap font-medium">{option.label}</p>
              <p className="mt-1 text-wrap text-sm leading-5 text-zinc-500">{option.description}</p>
            </button>
          )
        })}
      </div>

      {mode === 'handwritten' && (
        <UploadDropzone
          onFiles={handleHandwrittenFiles}
          isProcessing={processOrder.isPending}
          accept=".jpg,.jpeg,.png,.pdf"
          allowedTypes={['image/jpeg', 'image/png', 'application/pdf', '.jpg', '.jpeg', '.png', '.pdf']}
          title="Upload handwritten order"
          description="Drop one image, multiple images, image batches, or PDFs. ORDO merges duplicates and aggregates quantities into one order."
          previews={previews}
          multiple
        />
      )}

      {mode === 'audio' && (
        <div className="grid gap-5 xl:grid-cols-[45fr_55fr]">
          <UploadDropzone
            onFiles={handleAudioFiles}
            isProcessing={processAudio.isPending}
            accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.oga,.opus,.webm,.weba,.flac,.aif,.aiff"
            allowedTypes={[
              'audio/aac',
              'audio/*',
              'audio/aiff',
              'audio/flac',
              'audio/m4a',
              'audio/mpeg',
              'audio/mp3',
              'audio/ogg',
              'audio/opus',
              'audio/wav',
              'audio/webm',
              'audio/x-aiff',
              'audio/x-m4a',
              'audio/x-wav',
              '.aac',
              '.aif',
              '.aiff',
              '.flac',
              '.m4a',
              '.mp3',
              '.oga',
              '.ogg',
              '.opus',
              '.wav',
              '.weba',
              '.webm',
            ]}
            title="Upload audio order"
            description="Drop call recordings, WhatsApp voice notes, OGG, MP3, M4A, WAV, AAC, OPUS, WEBM, FLAC, or other audio files."
            previews={previews}
            multiple={false}
          />
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Transcript view</h2>
                <p className="mt-1 text-wrap text-sm text-zinc-500">Use this panel to review or process a typed transcript.</p>
              </div>
              <Button
                onClick={() => processTranscript.mutate()}
                disabled={!transcriptDraft.trim() || processTranscript.isPending}
              >
                {processTranscript.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Process transcript
              </Button>
            </div>
            <textarea
              className="mt-4 min-h-[220px] w-full resize-y rounded-md border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 outline-none focus:border-red-500/40"
              value={transcriptDraft}
              onChange={(event) => setTranscriptDraft(event.target.value)}
              placeholder="Raw transcript appears here. You can also paste: Ventoran-A 10, Histigca 5, Ventoran-A aur 5..."
            />
            {activeOrder?.transcript && (
              <div className="mt-4 rounded-md border border-white/10 bg-black/25 p-3">
                <p className="text-xs uppercase text-zinc-600">Detected products</p>
                <p className="mt-2 break-words text-sm leading-6 text-zinc-300">
                  {activeOrder.rows.map((row) => `${row.matchedProduct?.name ?? row.ocrText} (${row.quantity})`).join(', ')}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {mode === 'live' && (
        <div className="grid gap-5 xl:grid-cols-[42fr_58fr]">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-white">Live transcript</h2>
                <p className="mt-1 text-sm text-zinc-500">{liveStatus}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => void startLiveSession()} disabled={liveStore.isListening}>
                  <Mic size={16} />
                  Start Listening
                </Button>
                <Button onClick={() => void pauseLive()} disabled={!liveStore.isListening}>
                  <Pause size={16} />
                  Pause
                </Button>
                <Button onClick={() => void resumeLive()} disabled={!liveStore.sessionId || liveStore.isListening}>
                  <Play size={16} />
                  Resume
                </Button>
                <Button variant="danger" onClick={() => void stopLive()} disabled={!liveStore.sessionId}>
                  <Square size={16} />
                  Stop
                </Button>
              </div>
            </div>
            <div className="mt-4 min-h-[300px] overflow-auto rounded-md border border-white/10 bg-black/30 p-3 text-sm leading-6 text-zinc-300">
              {liveStore.transcript || 'Start listening or type a live transcript chunk below.'}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-red-500/40"
                value={liveDraft}
                onChange={(event) => setLiveDraft(event.target.value)}
                placeholder="Manual live chunk: Ventoran-A das, Histigca 5, Ventoran-A nahi 12"
              />
              <Button
                onClick={() => {
                  void submitLiveText(liveDraft)
                  setLiveDraft('')
                }}
                disabled={!liveStore.sessionId || !liveDraft.trim()}
              >
                <Send size={16} />
                Add
              </Button>
            </div>
          </Card>
          <RecognitionTable rows={activeOrder?.rows ?? []} onRowsChange={updateRows} />
        </div>
      )}

      {activeError && (
        <Card className="border-red-500/30 p-4 text-sm text-red-200">
          {(activeError as Error).message}
        </Card>
      )}

      {activeOrder && mode !== 'live' && (
        <div className="grid gap-5 xl:grid-cols-[45fr_55fr]">
          <Card className="min-h-[520px] overflow-hidden">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="font-semibold text-white">Order source</h2>
              <p className="mt-1 truncate text-sm text-zinc-500">{activeOrder.fileName}</p>
            </div>
            <div className="grid min-h-[450px] place-items-center bg-black/35 p-4">
              {previewUrl && activeOrder.source === 'handwritten' ? (
                <img
                  className="max-h-[640px] w-full rounded-md object-contain"
                  src={previewUrl}
                  alt="Uploaded handwritten order preview"
                />
              ) : (
                <div className="max-w-md text-center text-sm leading-6 text-zinc-500">
                  {activeOrder.source === 'audio'
                    ? 'Audio transcript and detected products are available in the transcript and review panels.'
                    : 'PDF uploaded. OCR results are available in the table.'}
                </div>
              )}
            </div>
          </Card>
          <RecognitionTable rows={activeOrder.rows} onRowsChange={updateRows} />
        </div>
      )}

      {activeOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.08] bg-black/75 px-4 py-3 backdrop-blur-xl lg:left-[280px]">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">{activeOrder.fileName}</p>
              <p className="text-xs text-zinc-500">
                Save corrections before generating final workbook outputs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="max-w-full whitespace-normal text-center" onClick={() => saveRows.mutate()} disabled={saveRows.isPending || isBusy}>
                {saveRows.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>Save edits</span>
              </Button>
              <Button
                className="max-w-full whitespace-normal text-center"
                variant="primary"
                onClick={() => generate.mutate('updated')}
                disabled={generate.isPending || isBusy}
              >
                <FileSpreadsheet size={16} />
                <span>Generate Updated Booklet</span>
              </Button>
              <Button
                className="max-w-full whitespace-normal text-center"
                variant="primary"
                onClick={() => generate.mutate('items')}
                disabled={generate.isPending || isBusy}
              >
                <FileSpreadsheet size={16} />
                <span>Generate Ordered Products Workbook</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(success)} onOpenChange={() => setSuccess(null)} title="Download ready">
        {success && (
          <div className="space-y-4">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-zinc-500">File name</p>
              <p className="mt-1 font-medium text-white">{success.fileName}</p>
              <p className="mt-3 text-sm text-zinc-500">Generated</p>
              <p className="mt-1 text-sm text-zinc-300">{formatDate(success.timestamp)}</p>
            </div>
            <a href={api.downloadUrl(success.downloadUrl)} download>
              <Button className="w-full" variant="primary">
                <Download size={16} />
                Download workbook
              </Button>
            </a>
          </div>
        )}
      </Dialog>
    </div>
  )
}
