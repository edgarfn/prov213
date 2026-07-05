import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, ShieldCheck } from 'lucide-react'
import type { Evidencia } from '@/types/prisma'
import { EvidenciasDownloadBtn } from '@/components/evidencias-download-btn'
import { HashlistExportBtn } from '@/components/hashlist-export-btn'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function EvidenciasPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')

  const serventiaId = membro.serventia.id

  const evidencias = await db.evidencia.findMany({
    where: {
      deletedAt: null,
      OR: [{ progressoRequisito: { serventiaId } }, { testeRestauracao: { serventiaId } }],
    },
    orderBy: { uploadedAt: 'desc' },
    include: {
      progressoRequisito: {
        include: {
          requisito: { select: { codigo: true, titulo: true } },
        },
      },
      testeRestauracao: {
        select: { dataTeste: true },
      },
    },
  })

  const podeExportarHashlist = ['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dossiê de Evidências</h1>
          <p className="text-muted-foreground">
            {evidencias.length} arquivo(s) — todos com hash SHA-256 para integridade verificável
          </p>
          {(membro.serventia.classe === 'CLASSE_2' || membro.serventia.classe === 'CLASSE_3') && (
            <p className="text-xs text-muted-foreground mt-1">
              Classes 2 e 3 exigem lista de hashes assinável do dossiê (Anexo IV, Disposições Gerais, IV, &quot;a&quot;).
            </p>
          )}
        </div>
        {podeExportarHashlist && evidencias.length > 0 && <HashlistExportBtn />}
      </div>

      {evidencias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma evidência anexada ainda.</p>
            <p className="text-sm mt-1">Acesse os checklists e anexe documentos nos requisitos.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Repositório de Evidências com Cadeia de Custódia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {evidencias.map((ev: Evidencia & {
                progressoRequisito: { requisito: { codigo: string; titulo: string } } | null
                testeRestauracao: { dataTeste: Date } | null
              }) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{ev.nomeArquivo}</span>
                      <Badge variant="outline" className="text-xs">
                        {ev.progressoRequisito
                          ? ev.progressoRequisito.requisito.codigo
                          : `Teste de restauração ${format(ev.testeRestauracao!.dataTeste, 'dd/MM/yyyy', { locale: ptBR })}`}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{ev.tipo}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ev.progressoRequisito
                        ? ev.progressoRequisito.requisito.titulo
                        : 'Ata de teste de restauração (Anexo V)'}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5 break-all">
                      SHA256: {ev.hashSha256}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{formatBytes(ev.tamanhoBytes)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(ev.uploadedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    {/* Botão de download com auditoria — Client Component */}
                    <EvidenciasDownloadBtn
                      evidenciaId={ev.id}
                      nomeArquivo={ev.nomeArquivo}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
