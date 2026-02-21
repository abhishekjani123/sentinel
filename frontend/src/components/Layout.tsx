import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

const navItems = [
  { to: '/', label: 'Dashboard', badge: null as string | null, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  )},
  { to: '/incidents', label: 'Incidents', badge: 'incidents' as string | null, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  )},
  { to: '/services', label: 'Services', badge: null as string | null, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
  )},
  { to: '/feed', label: 'Live Feed', badge: null as string | null, icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  )},
]

export default function Layout({ children }: { children: ReactNode }) {
  const [openIncidents, setOpenIncidents] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.getIncidents({ status: 'open' })
        setOpenIncidents(data.length)
      } catch { /* ignore */ }
    }
    fetch()
    const id = setInterval(fetch, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <aside
        className="w-[260px] flex-shrink-0 flex flex-col border-r"
        style={{
          background: 'linear-gradient(180deg, #0d0d0d 0%, #050505 100%)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Logo */}
        <div className="px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'var(--color-green)',
                  boxShadow: '0 0 24px rgba(0,200,5,0.35), 0 0 60px rgba(0,200,5,0.1)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div
                className="absolute inset-0 rounded-xl"
                style={{ animation: 'pulse-ring 2.5s ease-out infinite', border: '1.5px solid rgba(0,200,5,0.3)' }}
              />
            </div>
            <div>
              <h1 className="text-[16px] font-bold tracking-[-0.02em] text-white">Sentinel</h1>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Observability
              </p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-5 mb-4" style={{ height: 1, background: 'var(--color-border)' }} />

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <p className="section-title px-3 mb-3">Navigation</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="group flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 relative"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(0,200,5,0.08)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-muted)',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: 'var(--color-green)', boxShadow: '0 0 8px rgba(0,200,5,0.5)' }}
                    />
                  )}
                  <span className="transition-colors" style={{ color: isActive ? 'var(--color-green)' : undefined }}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge === 'incidents' && openIncidents > 0 && (
                    <span
                      className="text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-md font-semibold tabular-nums"
                      style={{
                        background: 'var(--color-red-dim)',
                        color: 'var(--color-red)',
                        border: '1px solid rgba(255,80,0,0.2)',
                      }}
                    >
                      {openIncidents}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System Status */}
        <div className="mx-4 mb-4">
          <div className="p-4 rounded-xl" style={{ background: 'rgba(0,200,5,0.04)', border: '1px solid rgba(0,200,5,0.08)' }}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="relative">
                <span
                  className="block w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-green)', boxShadow: '0 0 6px rgba(0,200,5,0.6)' }}
                />
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '1px solid rgba(0,200,5,0.4)',
                    animation: 'pulse-ring 2s ease-out infinite',
                  }}
                />
              </div>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--color-green)' }}>System Online</span>
            </div>
            <p className="text-[11px] ml-[18px]" style={{ color: 'var(--color-text-muted)' }}>
              All 3 agents active
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Sentinel v1.0 &middot; Firetiger
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-[1600px] mx-auto px-10 py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
