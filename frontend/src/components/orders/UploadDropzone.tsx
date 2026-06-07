import { motion } from 'framer-motion'
import { FileImage, Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '../../lib/utils'

interface UploadDropzoneProps {
  onFiles: (files: File[]) => void
  isProcessing: boolean
}

const allowed = ['image/jpeg', 'image/png', 'application/pdf']

export function UploadDropzone({ onFiles, isProcessing }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => allowed.includes(file.type))
    if (files.length) onFiles(files)
  }

  return (
    <motion.div
      className={cn(
        'relative grid min-h-[260px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur-2xl transition',
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
      whileHover={{ scale: 1.005 }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
          {isProcessing ? <Loader2 className="animate-spin" size={25} /> : <UploadCloud size={25} />}
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">
          {isProcessing ? 'Processing order' : 'Upload handwritten order'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Drop JPG, JPEG, PNG, or PDF files here. ORDO will run OCR, validate the
          text, match catalog products, and prepare workbook outputs.
        </p>
        <button
          type="button"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-white text-sm font-medium text-black px-4 transition hover:bg-zinc-200 disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
        >
          <FileImage size={16} />
          Choose files
        </button>
      </div>
    </motion.div>
  )
}
