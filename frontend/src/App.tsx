import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import CustomerDetail from './components/CustomerDetail'
import IncidentTimeline from './components/IncidentTimeline'
import ServiceMap from './components/ServiceMap'
import LiveFeed from './components/LiveFeed'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/incidents" element={<IncidentTimeline />} />
        <Route path="/services" element={<ServiceMap />} />
        <Route path="/feed" element={<LiveFeed />} />
      </Routes>
    </Layout>
  )
}
