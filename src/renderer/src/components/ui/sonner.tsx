import { Toaster as Sonner, type ToasterProps, toast } from 'sonner'

function Toaster({ ...props }: ToasterProps): React.JSX.Element {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:border-border group-[.toaster]:bg-surface-elevated group-[.toaster]:text-foreground',
          description: 'group-[.toast]:text-muted',
          actionButton: 'group-[.toast]:bg-accent group-[.toast]:text-accent-foreground',
          cancelButton: 'group-[.toast]:bg-surface group-[.toast]:text-muted'
        }
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
