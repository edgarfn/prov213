'use client'

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EtapaData {
  nome: string
  titulo: string
  concluidos: number
  pendentes: number
  percentual: number
}

interface StatusData {
  name: string
  value: number
  color: string
}

interface DashboardChartsProps {
  etapasData: EtapaData[]
  statusData: StatusData[]
}

export function DashboardCharts({ etapasData, statusData }: DashboardChartsProps) {
  const totalGeral = statusData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Geral dos Requisitos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const v = Number(value)
                  return `${v} (${totalGeral > 0 ? Math.round((v / totalGeral) * 100) : 0}%)`
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={etapasData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [
                  Number(value),
                  String(name) === 'concluidos' ? 'Concluídos' : 'Pendentes',
                ]}
              />
              <Legend formatter={(value) => value === 'concluidos' ? 'Concluídos' : 'Pendentes'} />
              <Bar dataKey="concluidos" stackId="a" fill="#22c55e" />
              <Bar dataKey="pendentes" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
