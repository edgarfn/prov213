'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, ShieldAlert } from 'lucide-react'

interface EvidenciasDownloadBtnProps {
  evidenciaId: string
  nomeArquivo: string
}

export function EvidenciasDownloadBtn({ evidenciaId, nomeArquivo }: EvidenciasDownloadBtnProps) {
  const [loading, setLoading] = useState(false)
  const [integridadeFalhou, setIntegridadeFalhou] = useState(false)

  async function handleDownload() {
    setLoading(true)
    setIntegridadeFalhou(false)

    try {
      const res = await fetch(`/api/evidencias/${evidenciaId}/download`)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Erro ao baixar o arquivo.')
        setLoading(false)
        return
      }

      // Verifica o header de integridade retornado pela API
      const integrity = res.headers.get('X-Integrity')
      if (integrity === 'FAILED') {
        setIntegridadeFalhou(true)
      }

      // Dispara o download via blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro de conexão ao baixar o arquivo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={loading}
        className="h-7 text-xs gap-1.5"
        title={`Baixar ${nomeArquivo}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {loading ? 'Baixando…' : 'Download'}
      </Button>

      {integridadeFalhou && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" />
          Hash SHA-256 divergente!
        </p>
      )}
    </div>
  )
}
