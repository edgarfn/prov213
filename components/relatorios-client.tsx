'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, FileSignature, Archive, Loader2 } from 'lucide-react'

interface EtapaOption {
  id: string
  numero: number
  titulo: string
}

interface Props {
  classe: string
  etapas: EtapaOption[]
}

async function baixarArquivo(
  url: string,
  nomeArquivo: string,
  setLoading: (v: boolean) => void,
  setErro: (v: string | null) => void,
) {
  setLoading(true)
  setErro(null)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setErro(err.error ?? 'Erro ao gerar o documento.')
      return
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    setErro('Erro de conexão ao gerar o documento.')
  } finally {
    setLoading(false)
  }
}

export function RelatoriosClient({ classe, etapas }: Props) {
  const [etapaSelecionada, setEtapaSelecionada] = useState(etapas[0]?.id ?? '')
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingSimplificado, setLoadingSimplificado] = useState(false)
  const [loadingPacote, setLoadingPacote] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere os documentos exigidos pelo Provimento CNJ nº 213/2026 para comprovação junto à Corregedoria e
          para a sua própria organização.
        </p>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Relatório de Status de Conformidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Visão consolidada do progresso por etapa, incidentes, vulnerabilidades e testes de restauração —
              documento de apresentação à Corregedoria (Art. 17).
            </p>
            <Button
              onClick={() =>
                baixarArquivo(
                  '/api/relatorios/status-conformidade',
                  'status-conformidade.pdf',
                  setLoadingStatus,
                  setErro,
                )
              }
              disabled={loadingStatus}
            >
              {loadingStatus ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Gerar PDF
            </Button>
          </CardContent>
        </Card>

        {classe === 'CLASSE_1' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-blue-600" />
                Relatório Simplificado (Classe 1)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Forma de comprovação dispensada da estrutura ampliada de dossiê técnico (Anexo IV, item VII),
                gerado por etapa.
              </p>
              <Select value={etapaSelecionada} onValueChange={(v) => v && setEtapaSelecionada(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      Etapa {e.numero} — {e.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  baixarArquivo(
                    `/api/relatorios/simplificado?etapaId=${etapaSelecionada}`,
                    'relatorio-simplificado.pdf',
                    setLoadingSimplificado,
                    setErro,
                  )
                }
                disabled={loadingSimplificado || !etapaSelecionada}
              >
                {loadingSimplificado ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSignature className="h-4 w-4 mr-2" />
                )}
                Gerar PDF da etapa
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-4 w-4 text-blue-600" />
              Pacote Probatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Exporta o dossiê completo de evidências em um único ZIP, com índice e lista de hashes assinável
              (Anexo IV, Disposições Gerais, IV).
            </p>
            <Button
              onClick={() =>
                baixarArquivo(
                  '/api/relatorios/pacote-probatorio',
                  'pacote-probatorio.zip',
                  setLoadingPacote,
                  setErro,
                )
              }
              disabled={loadingPacote}
            >
              {loadingPacote ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Gerar ZIP
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
