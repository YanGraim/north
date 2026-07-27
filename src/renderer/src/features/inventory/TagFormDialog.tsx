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
import { useCreateTag, useTags, useUpdateTag } from '@renderer/hooks/use-tags'
import { useInventoryDialogsStore } from '@renderer/stores/inventory-dialogs-store'
import { CreateTagInputSchema } from '@shared/types'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

const FormSchema = CreateTagInputSchema

type FormValues = z.infer<typeof FormSchema>

export function TagFormDialog(): React.JSX.Element | null {
  const dialog = useInventoryDialogsStore((s) => s.dialog)
  const close = useInventoryDialogsStore((s) => s.close)
  const open = dialog?.type === 'tag'
  const mode = open ? dialog.mode : 'create'
  const editId = open && dialog.mode === 'edit' ? dialog.id : undefined

  const { data: tags = [] } = useTags()
  const existing = useMemo(() => tags.find((t) => t.id === editId), [tags, editId])
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: '', color: null },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true
  })

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existing) {
      form.reset({ name: existing.name, color: existing.color })
    } else if (mode === 'create') {
      form.reset({ name: '', color: null })
    }
  }, [open, mode, existing, form])

  async function onSubmit(values: FormValues): Promise<void> {
    if (mode === 'edit' && editId) {
      await updateTag.mutateAsync({
        id: editId,
        input: { name: values.name, color: values.color ?? null }
      })
    } else {
      await createTag.mutateAsync({
        name: values.name,
        color: values.color ?? null
      })
    }
    close()
  }

  const pending = createTag.isPending || updateTag.isPending

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          <DialogDescription>Etiquetas reutilizáveis para filtrar conexões.</DialogDescription>
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
                    <Input placeholder="critico" {...field} />
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
