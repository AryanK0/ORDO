import {
  FileClock,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Settings,
  UploadCloud,
} from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export type Page = 'dashboard' | 'new-order' | 'history' | 'settings'

const items: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new-order', label: 'New Order', icon: UploadCloud },
  { id: 'history', label: 'Order History', icon: FileClock },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  activePage: Page
  collapsed: boolean
  onNavigate: (page: Page) => void
  onToggle: () => void
  className?: string
}

export function Sidebar({ activePage, collapsed, onNavigate, onToggle, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex min-h-svh shrink-0 flex-col border-r border-white/[0.08] bg-black/45 p-4 backdrop-blur-xl transition-[width] duration-300',
        collapsed ? 'w-20' : 'w-[280px]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
            <ScanLine size={22} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-normal text-white">ORDO</p>
              <p className="truncate text-xs text-zinc-500">Order digitization</p>
            </div>
          )}
        </div>
        <Button className="h-9 w-9 shrink-0 p-0" variant="ghost" onClick={onToggle}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </Button>
      </div>

      <nav className="mt-8 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white',
                isActive && 'bg-red-500/12 text-white ring-1 ring-red-500/20',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
