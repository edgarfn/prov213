import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getValidatedMembro } from '@/lib/serventia-context'
import { AuditoriaClient } from '@/components/auditoria-client'

export default async function AuditoriaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')

  return <AuditoriaClient />
}
