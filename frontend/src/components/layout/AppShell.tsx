import { Menu, ScanLine } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '../ui/button'
import { type Page, Sidebar } from './Sidebar'
import { cn } from '../../lib/utils'

interface AppShellProps {
  activePage: Page
  onNavigate: (page: Page) => void
  children: ReactNode
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#080808] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_6%,rgba(220,38,38,0.18),transparent_28%),radial-gradient(circle_at_8%_92%,rgba(153,27,27,0.16),transparent_32%),linear-gradient(140deg,#080808,#111111_45%,#080808)]" />
      <div className="noise pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div className="relative flex min-h-svh">
        <Sidebar
          className="hidden lg:flex"
          activePage={activePage}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onToggle={() => setCollapsed((value) => !value)}
        />

        {mobileOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/70 lg:hidden"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-40 w-[280px] transition-transform duration-300 lg:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            activePage={activePage}
            collapsed={false}
            onNavigate={(page) => {
              onNavigate(page)
              setMobileOpen(false)
            }}
            onToggle={() => setMobileOpen(false)}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.08] bg-black/45 px-4 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md border border-red-500/25 bg-red-500/10 text-red-300">
                <ScanLine size={20} />
              </div>
              <span className="font-bold text-white">ORDO</span>
            </div>
            <Button className="h-9 w-9 p-0" variant="ghost" onClick={() => setMobileOpen(true)}>
              <Menu size={18} />
            </Button>
          </header>
          <div className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
