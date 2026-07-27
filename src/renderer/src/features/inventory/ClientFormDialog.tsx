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
import { useClient, useCreateClient, useUpdateClient } from '@renderer/hooks/use-clients'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { CreateClientInputSchema } from '@shared/types'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const FormSchema = CreateClientInputSchema.extend({
  name: z.string().min(1, 'Nome é obrigatório'),
  notes: z.string().nullable().optional(),
  color: z.string().nullable().optional()
})

type FormValues = z.infer<typeof FormSchema>

export function ClientFormDialog(): React.JSX.Element | null {
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'client'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined

  const { data: existing } = useClient(editId)
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

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
    if (mode === 'edit' && editId) {
      await updateClient.mutateAsync({
        id: editId,
        input: {
          name: values.name,
          notes: values.notes ?? null,
          color: values.color ?? null
        }
      })
    } else {
      await createClient.mutateAsync({
        name: values.name,
        notes: values.notes ?? null,
        color: values.color ?? null
      })
    }
    close()
  }

  const pending = createClient.isPending || updateClient.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          <DialogDescription>
            Organize ambientes e conexões sob um cliente / organização.
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
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem className="gap-2">
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
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
