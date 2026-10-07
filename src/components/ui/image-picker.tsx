'use client'
import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { compressImage } from '@/lib/client/image'

/** Selector de foto (cámara o galería) que comprime antes de enviar con el formulario. */
export function ImagePicker({ name, label = 'Agregar foto', initialUrl }: { name: string; label?: string; initialUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null)
  const [busy, setBusy] = useState(false)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const compressed = await compressImage(file)
    const dt = new DataTransfer()
    dt.items.add(compressed)
    e.target.files = dt.files
    setPreview(URL.createObjectURL(compressed))
    setBusy(false)
  }

  return (
    <div>
      <input ref={inputRef} type="file" name={name} accept="image/*" className="sr-only" onChange={onChange} />
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vista previa" className="h-44 w-full rounded-2xl object-cover" />
          <button
            type="button"
            aria-label="Quitar foto"
            className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-card/90 text-ink"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = ''
              setPreview(null)
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-sandstone text-sm text-ink-soft"
        >
          <Camera className="size-5" strokeWidth={1.5} /> {busy ? 'Procesando…' : label}
        </button>
      )}
    </div>
  )
}
