import { Button } from './ui'

export interface Confirmation {
  title: string
  text: string
  action: string
  danger?: boolean
  run: () => Promise<unknown>
}

/** Bottom sheet asking the user to confirm an irreversible action. */
export default function ConfirmSheet({
  title,
  text,
  action,
  danger,
  loading,
  onCancel,
  onConfirm,
}: Confirmation & { loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCancel}>
      <div
        className="safe-bottom w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-felt-800 p-5 sm:rounded-3xl sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{text}</p>
        <div className="mt-5 space-y-2 pb-2">
          <Button variant={danger ? 'danger' : 'gold'} className="min-h-13 w-full text-base" loading={loading} onClick={onConfirm}>
            {action}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Kembali
          </Button>
        </div>
      </div>
    </div>
  )
}
