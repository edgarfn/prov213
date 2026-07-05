'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EtapaTimelineItem, EtapaTimelineStatus } from '@/lib/timeline'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_COR: Record<EtapaTimelineStatus, string> = {
  CONCLUIDA_NO_PRAZO: '#22c55e',
  CONCLUIDA_ATRASADA: '#f59e0b',
  EM_ANDAMENTO_NO_PRAZO: '#3b82f6',
  EM_ANDAMENTO_ATRASADA: '#ef4444',
  NAO_INICIADA: '#cbd5e1',
}

const STATUS_LABEL: Record<EtapaTimelineStatus, string> = {
  CONCLUIDA_NO_PRAZO: 'Concluída no prazo',
  CONCLUIDA_ATRASADA: 'Concluída fora do prazo',
  EM_ANDAMENTO_NO_PRAZO: 'Em andamento — no prazo',
  EM_ANDAMENTO_ATRASADA: 'Em andamento — atrasada',
  NAO_INICIADA: 'Não iniciada',
}

interface TimelineDatum {
  nome: string
  titulo: string
  offset: number
  duracao: number
  status: EtapaTimelineStatus
  inicio: Date
  fim: Date
  declarada: Date | null
}

function TimelineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TimelineDatum }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border bg-white p-3 text-xs shadow-md max-w-xs">
      <p className="font-semibold text-slate-900">{d.nome} — {d.titulo}</p>
      <p className="mt-1" style={{ color: STATUS_COR[d.status] }}>{STATUS_LABEL[d.status]}</p>
      <p className="text-muted-foreground mt-1">
        Previsto: {format(d.inicio, 'dd/MM/yyyy', { locale: ptBR })} até {format(d.fim, 'dd/MM/yyyy', { locale: ptBR })}
      </p>
      {d.declarada && (
        <p className="text-muted-foreground">
          Declarada em: {format(d.declarada, 'dd/MM/yyyy', { locale: ptBR })}
        </p>
      )}
    </div>
  )
}

interface EtapasTimelineProps {
  etapas: EtapaTimelineItem[]
  hoje?: Date
}

export function EtapasTimeline({ etapas, hoje = new Date() }: EtapasTimelineProps) {
  if (etapas.length === 0) return null

  const minTime = Math.min(...etapas.map((e) => e.dataInicioPrevista.getTime()))
  const maxTime = Math.max(...etapas.map((e) => e.dataFimPrevista.getTime()), hoje.getTime())

  const data: TimelineDatum[] = etapas.map((e) => ({
    nome: `Etapa ${e.numero}`,
    titulo: e.titulo,
    offset: e.dataInicioPrevista.getTime() - minTime,
    duracao: Math.max(e.dataFimPrevista.getTime() - e.dataInicioPrevista.getTime(), 0),
    status: e.status,
    inicio: e.dataInicioPrevista,
    fim: e.dataFimPrevista,
    declarada: e.dataDeclaracao,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linha do Tempo das Etapas (Anexo IV)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, Math.max(maxTime - minTime, 1)]}
              tickFormatter={(v) => format(new Date(minTime + Number(v)), 'MM/yy')}
              tick={{ fontSize: 11 }}
            />
            <YAxis dataKey="nome" type="category" width={64} tick={{ fontSize: 12 }} />
            <Tooltip content={<TimelineTooltip />} />
            <Bar dataKey="offset" stackId="a" fill="transparent" />
            <Bar dataKey="duracao" stackId="a" radius={[4, 4, 4, 4]}>
              {data.map((d, i) => (
                <Cell key={i} fill={STATUS_COR[d.status]} />
              ))}
            </Bar>
            <ReferenceLine
              x={hoje.getTime() - minTime}
              stroke="#0f172a"
              strokeDasharray="4 4"
              label={{ value: 'Hoje', position: 'top', fontSize: 11 }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
          {(Object.keys(STATUS_LABEL) as EtapaTimelineStatus[]).map((status) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: STATUS_COR[status] }}
              />
              {STATUS_LABEL[status]}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
