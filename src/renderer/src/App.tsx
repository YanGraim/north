import { AppShell } from '@renderer/components/layout/AppShell'
import { Route, Routes } from 'react-router-dom'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="*" element={<AppShell />} />
    </Routes>
  )
}

export default App
