import { Download, FileSpreadsheet, Loader2, Save } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { useOrdersStore } from '../store/useOrdersStore'
import type { GeneratedOutput } from '../types'
import { RecognitionTable } from '../components/orders/RecognitionTable'
import { UploadDropzone } from '../components/orders/UploadDropzone'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Dialog } from '../components/ui/dialog'

export function NewOrder() {
  const queryClient = useQueryClient()
  const { activeOrder, previewUrl, setActiveOrder, setPreviewUrl, updateRows } = useOrdersStore()
  const [success, setSuccess] = useState<GeneratedOutput | null>(null)

  const processOrder = useMutation({
    mutationFn: api.processOrder,
    onSuccess: (order) => {
      setActiveOrder(order)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const saveRows = useMutation({
    mutationFn: () => api.updateRows(activeOrder?.id ?? '', activeOrder?.rows ?? []),
    onSuccess: (order) => {
      setActiveOrder(order)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const generate = useMutation({
    mutationFn: (kind: 'updated' | 'items') => api.generateOutput(activeOrder?.id ?? '', kind),
    onSuccess: (output) => {
      setSuccess(output)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  function handleFiles(files: File[]) {
    const previewFile = files.find((file) => file.type.startsWith('image/'))
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(previewFile ? URL.createObjectURL(previewFile) : null)
    processOrder.mutate(files)
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="rounded-lg border border-white/[0.08] bg-black/30 p-6 md:p-8">
        <p className="text-sm font-medium text-red-300">New order</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white md:text-5xl">
          Handwritten Order Recognition
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
          Upload handwritten orders and automatically generate structured Excel outputs.
        </p>
      </section>

      <UploadDropzone onFiles={handleFiles} isProcessing={processOrder.isPending} />

      {processOrder.isError && (
        <Card className="border-red-500/30 p-4 text-sm text-red-200">
          {(processOrder.error as Error).message}
        </Card>
      )}

      {activeOrder && (
        <div className="grid gap-5 xl:grid-cols-[45fr_55fr]">
          <Card className="min-h-[520px] overflow-hidden">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="font-semibold text-white">Uploaded preview</h2>
              <p className="mt-1 text-sm text-zinc-500">{activeOrder.fileName}</p>
            </div>
            <div className="grid min-h-[450px] place-items-center bg-black/35 p-4">
              {previewUrl ? (
                <img
                  className="max-h-[640px] w-full rounded-md object-contain"
                  src={previewUrl}
                  alt="Uploaded handwritten order preview"
                />
              ) : (
                <div className="text-center text-sm text-zinc-500">
                  PDF uploaded. OCR results are available in the table.
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
              <Button onClick={() => saveRows.mutate()} disabled={saveRows.isPending}>
                {saveRows.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save edits
              </Button>
              <Button
                variant="primary"
                onClick={() => generate.mutate('updated')}
                disabled={generate.isPending}
              >
                <FileSpreadsheet size={16} />
                Generate Updated Booklet
              </Button>
              <Button
                variant="primary"
                onClick={() => generate.mutate('items')}
                disabled={generate.isPending}
              >
                <FileSpreadsheet size={16} />
                Generate Ordered Products Workbook
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
