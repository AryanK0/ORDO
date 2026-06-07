import { motion } from 'framer-motion'
import { FileAudio, FileImage, FileText, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '../../lib/utils'

export interface UploadPreview {
  id: string
  fileName: string
  label: string
  status: string
  url?: string
  message?: string | null
}

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void
  isProcessing: boolean
  accept: string
  allowedTypes: string[]
  title: string
  description: string
  previews?: UploadPreview[]
  multiple?: boolean
}

function fileIcon(fileName: string) {
  const lower = fileName.toLowerCase()
  if (/\.(m4a|mp3|wav|aac|ogg|oga|opus|webm|weba|flac|aif|aiff)$/.test(lower)) return <FileAudio size={16} />
  if (/\.(pdf)$/.test(lower)) return <FileText size={16} />
  return <FileImage size={16} />
}

export function UploadDropzone({
  onFiles,
  isProcessing,
  accept,
  allowedTypes,
  title,
  description,
  previews = [],
  multiple = true,
}: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => {
      const suffix = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
      return (
        allowedTypes.includes(file.type)
        || allowedTypes.includes(suffix)
        || (allowedTypes.includes('audio/*') && file.type.startsWith('audio/'))
      )
    })
    if (files.length) onFiles(files)
  }

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-lg border border-dashed border-white/10 bg-white/[0.05] p-6 text-center backdrop-blur-2xl transition',
        dragging && 'border-red-400/70 bg-red-500/10',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      whileHover={{ scale: 1.003 }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="mx-auto max-w-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
          {isProcessing ? <Loader2 className="animate-spin" size={25} /> : <UploadCloud size={25} />}
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">
          {isProcessing ? 'Processing order' : title}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-wrap text-sm leading-6 text-zinc-500">{description}</p>
        <button
          type="button"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
        >
          <FileImage size={16} />
          Choose files
        </button>
      </div>

      {previews.length > 0 && (
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2 xl:grid-cols-3">
          {previews.map((preview) => (
            <div
            className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-black/30 p-3"
            key={preview.id}
          >
            <div className="flex min-w-0 gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.06] text-zinc-400">
                {preview.url ? (
                  <img src={preview.url} alt={preview.label} className="h-full w-full object-cover" />
                ) : (
                  fileIcon(preview.fileName)
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{preview.label}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{preview.fileName}</p>
                <p className="mt-2 truncate text-xs uppercase tracking-wide text-red-300">{preview.status}</p>
                {preview.message && <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-500">{preview.message}</p>}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
