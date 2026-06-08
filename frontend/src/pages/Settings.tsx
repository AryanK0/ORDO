import { Bot, Boxes, BrainCircuit, FileJson, ScanText, UploadCloud, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { api } from '../lib/api'
import { Card } from '../components/ui/card'

function SettingRow({
  icon: Icon,
  label,
  value,
  detail,
  action,
}: {
  icon: typeof Boxes
  label: string
  value: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-red-500/20 bg-red-500/10 text-red-300">
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{value}</p>
            </div>
            {action && <div>{action}</div>}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

export function Settings() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings })
  const data = settings.data

  const uploadMutation = useMutation({
    mutationFn: api.uploadCatalog,
    onSuccess: (newData) => {
      queryClient.setQueryData(['settings'], newData)
      window.alert('Catalog updated successfully!')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    onError: (error) => {
      window.alert(error instanceof Error ? error.message : 'Upload failed')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-red-300">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
          Processing configuration
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Operational settings for catalog loading, alias learning,
          OCR, and validation model configuration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingRow
          icon={Boxes}
          label="Product Catalog"
          value={`${data?.productCount ?? 0} Products Loaded`}
          detail={`Catalog source: ${data?.catalogSource ?? 'backend cache'}`}
          action={
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors"
              >
                {uploadMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin text-red-400" />
                ) : (
                  <UploadCloud size={16} className="text-red-400" />
                )}
                Upload new
              </button>
            </>
          }
        />
        <SettingRow
          icon={FileJson}
          label="Alias Learning"
          value={`${data?.aliasCount ?? 0} Learned Aliases`}
          detail="Corrections are stored in aliases.json and reused during future matching."
        />
        <SettingRow
          icon={Bot}
          label="AI Settings"
          value={data?.aiModel ?? 'gemini-latest'}
          detail="Gemini validates OCR lines and extracts structured order items when an API key is configured."
        />
        <SettingRow
          icon={ScanText}
          label="OCR"
          value={data?.ocrEngine ?? 'PaddleOCR'}
          detail="PaddleOCR is used for local image recognition with deterministic fallback handling."
        />
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-red-500/20 bg-red-500/10 text-red-300">
            <BrainCircuit size={18} />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Workflow</p>
            <p className="mt-2 text-sm leading-7 text-zinc-300">
              Upload image or PDF → PaddleOCR → raw text → Gemini validation →
              structured JSON → RapidFuzz catalog match → confidence scoring →
              Excel output generation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
