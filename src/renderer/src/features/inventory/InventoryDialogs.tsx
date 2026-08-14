import { AccessFormDialog } from '@renderer/features/inventory/AccessFormDialog'
import { ClientFormDialog } from '@renderer/features/inventory/ClientFormDialog'
import { ConnectionFormDialog } from '@renderer/features/inventory/ConnectionFormDialog'
import { DatabaseConnectionFormDialog } from '@renderer/features/inventory/DatabaseConnectionFormDialog'
import { EnvironmentFormDialog } from '@renderer/features/inventory/EnvironmentFormDialog'
import { GroupFormDialog } from '@renderer/features/inventory/GroupFormDialog'
import { TagFormDialog } from '@renderer/features/inventory/TagFormDialog'

export function InventoryDialogs(): React.JSX.Element {
  return (
    <>
      <ClientFormDialog />
      <EnvironmentFormDialog />
      <GroupFormDialog />
      <TagFormDialog />
      <ConnectionFormDialog />
      <AccessFormDialog />
      <DatabaseConnectionFormDialog />
    </>
  )
}
