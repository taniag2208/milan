'use client'
import { useFormStatus } from 'react-dom'
import type { ComponentProps } from 'react'
import { Button } from './button'

/** Botón de envío con estado de carga automático. */
export function SubmitButton({
  children,
  pendingText = 'Guardando…',
  confirmMessage,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string; confirmMessage?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...props}
    >
      {pending ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
