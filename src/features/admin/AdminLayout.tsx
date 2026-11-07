import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Doodle } from '../../components/Doodle'

const tabs = [
  { to: '/admin', label: 'Quiz', end: true },
  { to: '/admin/leads', label: 'Khách hàng', end: false },
  { to: '/admin/settings', label: 'Cài đặt', end: false },
]

export default function AdminLayout() {
  const location = useLocation()
  const reduced = useReducedMotion()
  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <nav aria-label="Quản trị" className="mb-4 lg:mb-0 lg:w-52 lg:shrink-0">
        <div className="mb-3 hidden items-center gap-2 lg:flex">
          <Doodle kind="star" size={24} color="var(--color-sun)" />
          <p className="font-display text-2xl">Quản trị</p>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex min-h-[44px] whitespace-nowrap rounded-[14px_18px_12px_20px] border-2 px-4 py-2 transition ${
                  isActive
                    ? 'border-ink bg-sun font-semibold shadow-sticker'
                    : 'border-transparent bg-white/70 hover:border-ink/20'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0.1 : 0.22 }}
        className="min-w-0 flex-1"
      >
        <Outlet />
      </motion.div>
    </div>
  )
}
