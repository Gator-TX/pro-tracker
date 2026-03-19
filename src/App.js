import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Accounts from './pages/Accounts'
import AccountDetail from './pages/AccountDetail'
import LogActivity from './pages/LogActivity'
import Dashboard from './pages/Dashboard'
import RepDetail from './pages/RepDetail'
import ManageAccounts from './pages/ManageAccounts'
import ManagerAccounts from './pages/ManagerAccounts'
import ManagerActivities from './pages/ManagerActivities'
import SalesReps from './pages/SalesReps'
import Settings from './pages/Settings'
import ExportReports from './pages/ExportReports'
import RepSettings from './pages/RepSettings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/log" element={<LogActivity />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/reps/:repId" element={<RepDetail />} />
        <Route path="/manage" element={<ManageAccounts />} />
        <Route path="/dashboard/accounts" element={<ManagerAccounts />} />
        <Route path="/dashboard/accounts/:id" element={<AccountDetail />} />
        <Route path="/dashboard/activities" element={<ManagerActivities />} />
        <Route path="/dashboard/reps" element={<SalesReps />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/export" element={<ExportReports />} />
        <Route path="/rep/settings" element={<RepSettings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
