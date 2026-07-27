import { AppShell } from '@renderer/components/layout/AppShell'
import { ConnectionListPage } from '@renderer/features/connections/ConnectionListPage'
import { DashboardPage } from '@renderer/features/dashboard/DashboardPage'
import { ManualPage } from '@renderer/features/help/ManualPage'
import { HistoryPage } from '@renderer/features/history/HistoryPage'
import { SettingsPage } from '@renderer/features/settings/SettingsPage'
import { Navigate, Route, Routes } from 'react-router-dom'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="connections" element={<ConnectionListPage mode="all" />} />
        <Route path="favorites" element={<ConnectionListPage mode="favorites" />} />
        <Route path="recents" element={<ConnectionListPage mode="recents" />} />
        <Route path="clients/:clientId" element={<ConnectionListPage mode="client" />} />
        <Route path="tags/:tagId" element={<ConnectionListPage mode="tag" />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/manual" element={<ManualPage />} />
        <Route path="help" element={<Navigate to="/settings/manual" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
