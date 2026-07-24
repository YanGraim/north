import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@renderer/components/layout/AppShell'

function App(): React.JSX.Element {
  return (
    <Routes>
      <Route path="*" element={<AppShell />} />
    </Routes>
  )
}

export default App
