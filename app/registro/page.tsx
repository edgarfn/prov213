import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import RegistroForm from './registro-form'

// Mesma razão do app/login/page.tsx: a checagem de userCount precisa ser
// sempre fresca por requisição, não congelada em build-time/cache estático.
export const dynamic = 'force-dynamic'

export default async function RegistroPage() {
  const userCount = await db.user.count()
  if (userCount > 0) redirect('/login')

  return <RegistroForm />
}
