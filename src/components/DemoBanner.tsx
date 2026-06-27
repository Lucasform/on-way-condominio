import { useAuth } from './AuthProvider'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

// J4: Banner informativo quando o condomínio ativo é modo demonstração.
export default function DemoBanner() {
  const { perfil } = useAuth()
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    if (!perfil?.condominio_id) { setIsDemo(false); return }
    void supabase
      .from('condominios')
      .select('is_demo')
      .eq('id', perfil.condominio_id)
      .maybeSingle()
      .then(({ data }) => setIsDemo(data?.is_demo === true))
  }, [perfil?.condominio_id])

  if (!isDemo) return null

  return (
    <div className="shrink-0 bg-amber-500 text-amber-950 px-4 py-2 flex items-center gap-2 text-xs font-semibold border-b border-amber-600">
      <span>🎭</span>
      <span>Este é um ambiente de demonstração — os dados não são reais.</span>
    </div>
  )
}
