import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import type { Page } from './components/layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { NewOrder } from './pages/NewOrder'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
    },
  },
})

function PageContent({ page }: { page: Page }) {
  if (page === 'new-order') return <NewOrder />
  if (page === 'history') return <History />
  if (page === 'settings') return <Settings />
  return <Dashboard />
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell activePage={page} onNavigate={setPage}>
        <PageContent page={page} />
      </AppShell>
    </QueryClientProvider>
  )
}
