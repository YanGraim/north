import { AgentsBoard } from '@renderer/features/agents/AgentsBoard'
import { ConnectionListPage } from '@renderer/features/connections/ConnectionListPage'
import { DashboardPage } from '@renderer/features/dashboard/DashboardPage'
import { ManualPage } from '@renderer/features/help/ManualPage'
import { HistoryPage } from '@renderer/features/history/HistoryPage'
import { SettingsPage } from '@renderer/features/settings/SettingsPage'
import { VpnsPage } from '@renderer/features/vpns/VpnsPage'
import {
  LegacyRouteRedirect,
  ScopedRedirect,
  WorkspaceScope
} from '@renderer/features/workspaces/WorkspaceScope'
import { Route, Routes } from 'react-router-dom'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="w/:workspaceId" element={<WorkspaceScope />}>
        <Route index element={<ScopedRedirect to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="connections" element={<ConnectionListPage mode="all" />} />
        <Route path="favorites" element={<ConnectionListPage mode="favorites" />} />
        <Route path="recents" element={<ConnectionListPage mode="recents" />} />
        <Route path="clients/:clientId" element={<ConnectionListPage mode="client" />} />
        <Route path="tags/:tagId" element={<ConnectionListPage mode="tag" />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="vpns" element={<VpnsPage />} />
        <Route path="agents" element={<AgentsBoard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/manual" element={<ManualPage />} />
        <Route path="help" element={<ScopedRedirect to="/settings/manual" />} />
        <Route path="*" element={<ScopedRedirect to="/dashboard" />} />
      </Route>
      <Route path="*" element={<LegacyRouteRedirect />} />
    </Routes>
  )
}

export default App
