import { db } from '@/lib/db'
import LoginForm from './login-form'

// Sem isso, o Next.js trata esta rota como estática: tenta pré-renderizar em
// build-time (exigindo DB disponível nesse momento — quebra o build Docker,
// que só tem um DATABASE_URL fictício) e, se conseguir, congela o resultado
// de "allowRegistration" para sempre (cache de 1 ano), tornando o registro
// permanentemente liberado ou bloqueado independente do estado real do banco.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const userCount = await db.user.count()
  return <LoginForm allowRegistration={userCount === 0} />
}
