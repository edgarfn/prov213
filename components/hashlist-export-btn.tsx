'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSignature, Loader2 } from 'lucide-react'

export function HashlistExportBtn() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch('/api/evidencias/hashlist')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Erro ao gerar a lista de hashes.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lista-hashes-dossie.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro de conexão ao gerar a lista de hashes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
      Exportar lista de hashes assinável
    </Button>
  )
}
