import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronDown, Check } from 'lucide-react'
import type { Outlet } from './types'

interface OutletSelectorProps {
  outlets: Outlet[]
  selectedOutletId?: number
  disabled?: boolean
  onChange: (id: number) => void
  variant: 'storefront' | 'manager' | 'cashier'
}

export function OutletSelector({ outlets, selectedOutletId, disabled, onChange, variant }: OutletSelectorProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId)
  const activeOutlets = outlets.filter((o) => o.active)

  const toggle = () => {
    if (!disabled) setOpen(!open)
  }

  const containerClass = 
    variant === 'storefront' ? 'store-outlet-select custom-select-container' :
    variant === 'manager' ? 'outlet-switcher custom-select-container' :
    'cashier-outlet-switch custom-select-container'

  return (
    <div className={`${containerClass} ${disabled ? 'disabled' : ''}`} ref={wrapperRef}>
      <button 
        type="button" 
        className="custom-select-trigger" 
        onClick={toggle}
        disabled={disabled}
        aria-label="Pilih outlet aktif"
        aria-expanded={open}
      >
        <Building2 size={variant === 'storefront' ? 17 : variant === 'manager' ? 16 : 15} />
        <span className="custom-select-content">
          {variant === 'manager' && <small>OUTLET AKTIF</small>}
          <span className="custom-select-text">
            {selectedOutlet?.name || 'Pilih Outlet'}
          </span>
        </span>
        {!disabled && <ChevronDown size={14} className={`custom-select-chevron ${open ? 'open' : ''}`} />}
      </button>

      {open && (
        <div className="custom-select-dropdown">
          {activeOutlets.map((outlet) => (
            <button
              key={outlet.id}
              type="button"
              className={`custom-select-option ${outlet.id === selectedOutletId ? 'selected' : ''}`}
              onClick={() => {
                onChange(outlet.id)
                setOpen(false)
              }}
            >
              <Building2 size={14} className="option-icon" />
              <span className="option-label">{outlet.name}</span>
              {outlet.id === selectedOutletId && <Check size={14} className="option-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
