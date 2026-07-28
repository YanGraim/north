import { zodResolver } from '@hookform/resolvers/zod'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  useCreateEnvironment,
  useEnvironment,
  useUpdateEnvironment
} from '@renderer/hooks/use-environments'
import { defaultEnvironmentColor, hasEnvironmentContext } from '@renderer/lib/environment-color'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const FormSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional()
})

type FormValues = z.infer<typeof FormSchema>

export function EnvironmentFormDialog(): React.JSX.Element | null {
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'environment'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined
  const clientId = open && dialog.mode === 'create' ? dialog.clientId : undefined

  const { data: existing } = useEnvironment(editId)
  const createEnvironment = useCreateEnvironment()
  const updateEnvironment = useUpdateEnvironment()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', notes: null, color: null },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existing) {
      form.reset({
        name: existing.name,
        notes: existing.notes,
        color: existing.color
      })
    } else if (mode === 'create') {
      form.reset({ name: '', notes: null, color: null })
    }
  }, [open, mode, existing, form])

  async function onSubmit(values: FormValues): Promise<void> {
    const color = values.color ?? null
    if (mode === 'edit' && editId) {
      await updateEnvironment.mutateAsync({
        id: editId,
        input: { name: values.name, notes: values.notes ?? null, color }
      })
    } else if (clientId) {
      await createEnvironment.mutateAsync({
        clientId,
        name: values.name,
        notes: values.notes ?? null,
        color
      })
    }
    close()
  }

  const pending = createEnvironment.isPending || updateEnvironment.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar ambiente' : 'Novo ambiente'}</DialogTitle>
          <DialogDescription>
            Ex.: Produção, Homologação, Dev. A cor aparece na árvore, badge e banner.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Produção"
                      {...field}
                      onChange={(event) => {
                        const name = event.target.value
                        field.onChange(name)
                        const currentColor = form.getValues('color')
                        if (!currentColor && hasEnvironmentContext(name)) {
                          form.setValue('color', defaultEnvironmentColor(name))
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value}
                      onChange={(color) => {
                        field.onChange(color)
                        form.setValue('color', color, {
                          shouldDirty: true,
                          shouldTouch: true
                        })
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações opcionais"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
