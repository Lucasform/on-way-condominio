import { useEffect, useRef, useState } from 'react'
import Button from './Button'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

// J3: Leitor de código de barras via BarcodeDetector API (Chrome/Edge/iOS 16.4+).
// Fallback automático para input de texto quando API não está disponível.
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    const api = 'BarcodeDetector' in window
    setSupported(api)
    if (!api) return

    let stream: MediaStream | null = null
    let animId: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any

    async function start() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
        })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        scan()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Câmera indisponível.')
      }
    }

    function scan() {
      if (!videoRef.current || !detector) return
      detector.detect(videoRef.current).then((results: Array<{ rawValue: string }>) => {
        if (results.length > 0) {
          onDetected(results[0].rawValue)
          stopStream()
        } else {
          animId = requestAnimationFrame(scan)
        }
      }).catch(() => { animId = requestAnimationFrame(scan) })
    }

    function stopStream() {
      cancelAnimationFrame(animId)
      stream?.getTracks().forEach((t) => t.stop())
    }

    start()
    return () => stopStream()
  }, [onDetected])

  if (supported === false || error) {
    return (
      <div className="space-y-3">
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!error && <p className="text-xs text-slate-400">BarcodeDetector não suportado neste dispositivo. Digite o código manualmente:</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Código de barras..."
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) { onDetected(manual.trim()); onClose() } }}
          />
          <Button onClick={() => { if (manual.trim()) { onDetected(manual.trim()); onClose() } }}>OK</Button>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Aponte a câmera para o código de barras:</p>
      <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
        <video ref={videoRef} className="w-full max-h-48 object-cover" muted playsInline />
        <div className="absolute inset-0 border-2 border-violet-400/40 rounded-lg pointer-events-none" />
      </div>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
    </div>
  )
}
