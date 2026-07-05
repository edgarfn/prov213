'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShieldCheck, ShieldAlert, Download, RefreshCw,
  ChevronLeft, ChevronRight, Search, AlertTriangle,
} from 'lucide-react'

interface LogEntry {
  id: string
  acao: string
  entidade: string
  entidadeId?: string
  userId?: string
  userEmail?: string
  userName?: string
  valorAnterior?: Record<string, unknown>
  valorNovo?: Record<string, unknown>
  timestamp: string
  ipAddress?: string
  userAgent?: string
  hashIntegridade?: string
}

interface ListaResponse {
  entradas: LogEntry[]
  total: number
  paginas: number
  paginaAtual: number
}

interface IntegrityResponse {
  totalEntradas: number
  entradasVerificadas: number
  falhas: { id: string; timestamp: string; acao: string }[]
  integraPercent: number
}

const ACOES_LABELS: Record<string, string> = {
  LOGIN_SUCESSO: 'Login OK',
  LOGIN_FALHOU: 'Login falhou',
  MFA_SUCESSO: 'MFA OK',
  MFA_FALHOU: 'MFA falhou',
  LOGOUT: 'Logout',
  SENHA_ALTERADA: 'Senha alterada',
  SENHA_RECUPERADA: 'Senha recuperada',
  MFA_ATIVADO: 'MFA ativado',
  ACESSO_NEGADO: 'Acesso negado',
  USUARIO_CRIADO: 'Usuário criado',
  USUARIO_REMOVIDO: 'Usuário removido',
  PAPEL_ALTERADO: 'Papel alterado',
  SERVENTIA_CRIADA: 'Serventia criada',
  SERVENTIA_ATUALIZADA: 'Serventia atualizada',
  PROGRESSO_ATUALIZADO: 'Progresso atualizado',
  ETAPA_DECLARADA: 'Etapa declarada',
  EVIDENCIA_UPLOAD: 'Evidência enviada',
  EVIDENCIA_DOWNLOAD: 'Evidência baixada',
  EVIDENCIA_EXCLUIDA: 'Evidência excluída',
  BACKUP_CRIADO: 'Backup criado',
  BACKUP_DOWNLOAD: 'Backup baixado',
  BACKUP_EXCLUIDO: 'Backup excluído',
  EXPORTACAO_AUDITORIA: 'Exportação de auditoria',
}

const ACAO_COR: Record<string, string> = {
  LOGIN_FALHOU: 'text-red-700 border-red-200 bg-red-50',
  MFA_FALHOU: 'text-red-700 border-red-200 bg-red-50',
  ACESSO_NEGADO: 'text-red-700 border-red-200 bg-red-50',
  LOGIN_SUCESSO: 'text-green-700 border-green-200 bg-green-50',
  MFA_SUCESSO: 'text-green-700 border-green-200 bg-green-50',
  LOGOUT: 'text-slate-600 border-slate-200',
  EVIDENCIA_UPLOAD: 'text-blue-700 border-blue-200 bg-blue-50',
  BACKUP_CRIADO: 'text-purple-700 border-purple-200 bg-purple-50',
  BACKUP_DOWNLOAD: 'text-purple-700 border-purple-200 bg-purple-50',
  USUARIO_CRIADO: 'text-indigo-700 border-indigo-200 bg-indigo-50',
  USUARIO_REMOVIDO: 'text-orange-700 border-orange-200 bg-orange-50',
}

export default function AuditoriaPage() {
  const [dados, setDados] = useState<ListaResponse | null>(null)
  const [integridade, setIntegridade] = useState<IntegrityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [filtros, setFiltros] = useState({
    acao: '',
    dataInicio: '',
    dataFim: '',
  })
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtros.acao) params.set('acao', filtros.acao)
    if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio)
    if (filtros.dataFim) params.set('dataFim', filtros.dataFim)
    params.set('page', String(pg))

    const res = await fetch(`/api/auditoria?${params}`)
    const d = await res.json()
    setDados(d)
    setPage(pg)
    setLoading(false)
  }, [filtros])

  useEffect(() => { fetchLogs(1) }, [])

  async function verificarIntegridade() {
    setVerifying(true)
    const res = await fetch('/api/auditoria/verify')
    const d = await res.json()
    setIntegridade(d)
    setVerifying(false)
  }

  function exportar(formato: 'json' | 'csv') {
    const params = new URLSearchParams({ formato })
    if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio)
    if (filtros.dataFim) params.set('dataFim', filtros.dataFim)
    window.open(`/api/auditoria/export?${params}`, '_blank')
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registro de Auditoria</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Trilha imutável de todas as operações do sistema · Retenção mínima: 5 anos (Art. 7º)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={verificarIntegridade} disabled={verifying}>
            {verifying ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Verificar integridade
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportar('csv')}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportar('json')}>
            <Download className="h-4 w-4 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* Status de integridade */}
      {integridade && (
        <Alert className={integridade.falhas.length === 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {integridade.falhas.length === 0 ? (
            <ShieldCheck className="h-4 w-4 text-green-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={integridade.falhas.length === 0 ? 'text-green-800' : 'text-red-800'}>
            {integridade.falhas.length === 0 ? (
              <>
                ✓ Cadeia de hash íntegra — {integridade.totalEntradas} registros verificados ({integridade.integraPercent}% OK)
              </>
            ) : (
              <>
                ⚠ {integridade.falhas.length} entrada(s) com hash inconsistente detectada(s). Possível adulteração!
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de ação</Label>
              <Select value={filtros.acao || '_todos'} onValueChange={(v) => { if (v) setFiltros(p => ({ ...p, acao: v === '_todos' ? '' : v })) }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_todos">Todas as ações</SelectItem>
                  {Object.entries(ACOES_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data início</Label>
              <Input type="date" className="text-sm"
                value={filtros.dataInicio}
                onChange={e => setFiltros(p => ({ ...p, dataInicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data fim</Label>
              <Input type="date" className="text-sm"
                value={filtros.dataFim}
                onChange={e => setFiltros(p => ({ ...p, dataFim: e.target.value }))} />
            </div>
            <Button size="sm" onClick={() => fetchLogs(1)} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {dados ? `${dados.total} registros encontrados` : 'Carregando…'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
            </div>
          ) : !dados?.entradas.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro encontrado com os filtros aplicados.
            </p>
          ) : (
            <div className="space-y-1">
              {dados.entradas.map((e) => (
                <div key={e.id} className="border rounded-lg overflow-hidden">
                  {/* Linha principal */}
                  <button
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground flex-shrink-0 w-32">
                        {format(new Date(e.timestamp), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs flex-shrink-0 ${ACAO_COR[e.acao] ?? 'text-slate-600 border-slate-200'}`}
                      >
                        {ACOES_LABELS[e.acao] ?? e.acao}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{e.entidade}</span>
                      <span className="text-sm text-slate-700 truncate">
                        {e.userName ?? e.userEmail ?? e.userId ?? '—'}
                      </span>
                      {e.ipAddress && (
                        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                          {e.ipAddress}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {expanded === e.id && (
                    <div className="px-3 pb-3 pt-1 bg-slate-50 border-t text-xs space-y-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <span>ID do registro:</span>
                        <span className="font-mono text-slate-700">{e.id}</span>
                        {e.entidadeId && <><span>ID da entidade:</span><span className="font-mono">{e.entidadeId}</span></>}
                        {e.userEmail && <><span>E-mail:</span><span>{e.userEmail}</span></>}
                        {e.ipAddress && <><span>IP:</span><span className="font-mono">{e.ipAddress}</span></>}
                        {e.userAgent && <><span>User-Agent:</span><span className="truncate max-w-xs">{e.userAgent}</span></>}
                      </div>
                      {e.valorNovo && (
                        <div>
                          <p className="text-muted-foreground mb-0.5">Dados registrados:</p>
                          <pre className="bg-white rounded border p-2 text-xs overflow-auto max-h-28">
                            {JSON.stringify(e.valorNovo, null, 2)}
                          </pre>
                        </div>
                      )}
                      {e.valorAnterior && (
                        <div>
                          <p className="text-muted-foreground mb-0.5">Dados anteriores:</p>
                          <pre className="bg-white rounded border p-2 text-xs overflow-auto max-h-28">
                            {JSON.stringify(e.valorAnterior, null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="flex items-center gap-1 pt-1 border-t">
                        <ShieldCheck className="h-3 w-3 text-slate-400" />
                        <span className="text-muted-foreground">SHA-256:</span>
                        <span className="font-mono text-slate-600 text-xs break-all">{e.hashIntegridade}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {dados && dados.paginas > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {dados.paginaAtual} de {dados.paginas}
              </span>
              <Button variant="outline" size="sm" disabled={page >= dados.paginas} onClick={() => fetchLogs(page + 1)}>
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota legal */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex gap-3 text-sm text-blue-800">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Conformidade com o Provimento CNJ 213/2026</p>
              <ul className="text-xs space-y-0.5 opacity-90 list-disc list-inside">
                <li>Registros <strong>imutáveis</strong> via trigger PostgreSQL (Art. 7º, IV)</li>
                <li>Cadeia de hash SHA-256 detecta adulteração (tamper-evident)</li>
                <li>Dados sensíveis <strong>mascarados</strong> antes de persistir (Privacy by Design)</li>
                <li>Retenção mínima obrigatória: <strong>5 anos</strong> (Art. 7º, IV)</li>
                <li>IP e User-Agent registrados para fins forenses</li>
                <li>Exportação disponível para integração com SIEM (DevSecOps)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
