import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import RegistroForm from './registro-form'

export default async function RegistroPage() {
  const userCount = await db.user.count()
  if (userCount > 0) redirect('/login')

  return <RegistroForm />
}
