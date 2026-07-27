import { zodResolver } from '@hookform/resolvers/zod'
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
import { useCreateGroup, useGroup, useUpdateGroup } from '@renderer/hooks/use-groups'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const FormSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  notes: z.string().nullable().optional()
})

type FormValues = z.infer<typeof FormSchema>

export function GroupFormDialog(): React.JSX.Element | null {
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'group'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined
  const environmentId = open && dialog.mode === 'create' ? dialog.environmentId : undefined

  const { data: existing } = useGroup(editId)
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', notes: null },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existing) {
      form.reset({ name: existing.name, notes: existing.notes })
    } else if (mode === 'create') {
      form.reset({ name: '', notes: null })
    }
  }, [open, mode, existing, form])

  async function onSubmit(values: FormValues): Promise<void> {
    if (mode === 'edit' && editId) {
      await updateGroup.mutateAsync({
        id: editId,
        input: { name: values.name, notes: values.notes ?? null }
      })
    } else if (environmentId) {
      await createGroup.mutateAsync({
        environmentId,
        name: values.name,
        notes: values.notes ?? null
      })
    }
    close()
  }

  const pending = createGroup.isPending || updateGroup.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar grupo' : 'Novo grupo'}</DialogTitle>
          <DialogDescription>Ex.: App, Banco, Edge.</DialogDescription>
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
                    <Input placeholder="App" {...field} />
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
