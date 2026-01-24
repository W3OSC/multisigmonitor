import { useAuth } from '@/context/AuthContext'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Home, Search, Monitor, Settings, LogOut, PanelLeftClose, PanelLeft, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LeftSidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('leftSidebarExpanded')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('leftSidebarExpanded', JSON.stringify(isExpanded))
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { isExpanded } }))
  }, [isExpanded])

  const handleLogout = () => {
    signOut()
    navigate('/login')
    if (window.innerWidth < 768) {
      setIsExpanded(false)
    }
  }

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/scan', icon: Search, label: 'Scan' },
    { to: '/monitor', icon: Monitor, label: 'Monitor' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const isActive = (path: string) => location.pathname === path

  const getDisplayName = () => {
    if (user?.username) return user.username
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    if (user?.user_metadata?.name) return user.user_metadata.name
    if (user?.email) return user.email.split('@')[0]
    return 'User'
  }

  const getInitials = () => {
    const name = getDisplayName()
    return name.charAt(0).toUpperCase()
  }

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null
  }

  return (
    <div className={`fixed left-0 top-0 h-screen bg-background border-r border-border flex flex-col transition-all duration-300 overflow-hidden ${
      isExpanded ? 'w-64' : 'w-20'
    } z-50`}>
      <div className="border-b border-border px-4 py-4 min-h-[89px] flex items-center overflow-hidden">
        {isExpanded ? (
          <div className="flex items-center justify-between w-full">
            <Link to="/" className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-jsr-purple to-jsr-purple-dark rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold jsr-text-gradient whitespace-nowrap">
                multisigmonitor
              </span>
            </Link>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg text-muted-foreground hover:text-jsr-purple hover:bg-jsr-purple/10 transition-all group flex-shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex justify-center p-2 rounded-lg text-muted-foreground hover:text-jsr-purple hover:bg-jsr-purple/10 transition-all group"
            title="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => window.innerWidth < 768 && setIsExpanded(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.to)
                  ? 'bg-jsr-purple/20 text-jsr-purple'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              } ${!isExpanded ? 'justify-center' : ''}`}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isExpanded && <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      <div className={`border-t border-border ${isExpanded ? 'p-4' : 'p-3'}`}>
        {isExpanded ? (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-jsr-purple flex items-center justify-center text-white font-bold overflow-hidden">
              {getAvatarUrl() ? (
                <img 
                  src={getAvatarUrl()!}
                  alt={getDisplayName()}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold truncate text-sm">{getDisplayName()}</p>
              <p className="text-muted-foreground text-xs truncate">{user?.email || ''}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 rounded-full bg-jsr-purple flex items-center justify-center text-white font-bold overflow-hidden">
              {getAvatarUrl() ? (
                <img 
                  src={getAvatarUrl()!}
                  alt={getDisplayName()}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials()
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full ${
            !isExpanded ? 'justify-center' : ''
          }`}
          title="Sign Out"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span className="text-sm">Sign Out</span>}
        </button>
      </div>
    </div>
  )
}
