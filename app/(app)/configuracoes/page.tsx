import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { calcularPrazos } from '@/lib/business-rules'
import { getProrrogacaoAtivaData } from '@/lib/prorrogacao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MFASetupCard } from '@/components/mfa-setup-card'
import { ProrrogacaoCard } from '@/components/prorrogacao-card'

export default async function ConfiguracoesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, mfaEnabled: true, mfaVerified: true, createdAt: true },
  })

  const membro = await getValidatedMembro(session.user.id)

  let prazoEtapas12Atual: Date | null = null
  let historicoProrrogacoes: Awaited<ReturnType<typeof db.prorrogacao.findMany>> = []
  if (membro) {
    const prorrogacaoNovaData = await getProrrogacaoAtivaData(membro.serventia.id)
    const prazos = calcularPrazos(
      membro.serventia.dataVigenciaNorma,
      membro.serventia.classe,
      !!prorrogacaoNovaData,
      prorrogacaoNovaData,
    )
    prazoEtapas12Atual = prazos.etapas12
    historicoProrrogacoes = await db.prorrogacao.findMany({
      where: { serventiaId: membro.serventia.id },
      orderBy: { dataSolicitacao: 'desc' },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>

      {/* Dados do usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nome</span>
            <span className="font-medium">{user?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Conta criada em</span>
            <span className="font-medium">
              {user?.createdAt ? format(user.createdAt, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* MFA */}
      <MFASetupCard mfaEnabled={user?.mfaEnabled ?? false} mfaVerified={user?.mfaVerified ?? false} />

      {/* Dados da Serventia */}
      {membro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Serventia</CardTitle>
            <CardDescription>{membro.serventia.nome}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNS</span>
              <span className="font-medium font-mono">{membro.serventia.cns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Classe</span>
              <Badge variant="outline">{membro.serventia.classe.replace('_', ' ')}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seu papel</span>
              <Badge>{membro.papel.replace('_', ' ')}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data de vigência</span>
              <span className="font-medium">
                {format(membro.serventia.dataVigenciaNorma, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
            {membro.serventia.responsavelTecnico && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Responsável Técnico</span>
                <span className="font-medium">{membro.serventia.responsavelTecnico}</span>
              </div>
            )}
            {membro.serventia.dpo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">DPO</span>
                <span className="font-medium">{membro.serventia.dpo}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prorrogação de prazo (Art. 21) */}
      {membro && prazoEtapas12Atual && (
        <ProrrogacaoCard
          serventiaId={membro.serventia.id}
          classe={membro.serventia.classe}
          prazoEtapas12Atual={prazoEtapas12Atual}
          historico={historicoProrrogacoes}
          podeGerenciar={['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)}
        />
      )}
    </div>
  )
}
