import { db } from '@/lib/db'
import LoginForm from './login-form'

export default async function LoginPage() {
  const userCount = await db.user.count()
  return <LoginForm allowRegistration={userCount === 0} />
}
