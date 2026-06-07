import { Bot, Boxes, BrainCircuit, FileJson, ScanText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/card'

function SettingRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Boxes
  label: string
  value: string
  detail: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-red-500/20 bg-red-500/10 text-red-300">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{detail}</p>
        </div>
      </div>
    </Card>
  )
}

export function Settings() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings })
  const data = settings.data

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-red-300">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white">
          Processing configuration
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Read-only operational settings for catalog loading, alias learning,
          OCR, and validation model configuration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingRow
          icon={Boxes}
          label="Product Catalog"
          value={`${data?.productCount ?? 0} Products Loaded`}
          detail={`Catalog source: ${data?.catalogSource ?? 'backend cache'}`}
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
