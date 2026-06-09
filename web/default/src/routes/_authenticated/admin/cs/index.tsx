import { createFileRoute } from '@tanstack/react-router'
import { AdminCsPage } from '@/features/admin-cs'

export const Route = createFileRoute('/_authenticated/admin/cs/')({
  component: AdminCsPage,
})
