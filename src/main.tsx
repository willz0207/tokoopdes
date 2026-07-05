import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminApp from './AdminApp'
import AuthApp from './AuthApp'
import CashierApp from './CashierApp'
import CustomerOrdersApp from './CustomerOrdersApp'
import ManagerApp from './ManagerApp'
import './styles.css'

const isAdminRoute = window.location.pathname.startsWith('/admin')
const isAuthRoute = window.location.pathname.startsWith('/login')
const isCashierRoute = window.location.pathname.startsWith('/cashier')
const isOrdersRoute = window.location.pathname.startsWith('/orders')
const isManagerRoute = window.location.pathname.startsWith('/manager')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : isAuthRoute ? <AuthApp /> : isManagerRoute ? <ManagerApp /> : isCashierRoute ? <CashierApp /> : isOrdersRoute ? <CustomerOrdersApp /> : <App />}
  </StrictMode>,
)
