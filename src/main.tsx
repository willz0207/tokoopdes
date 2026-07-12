import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthApp from './AuthApp'
import CashierApp from './CashierApp'
import CustomerOrdersApp from './CustomerOrdersApp'
import ManagerApp from './ManagerApp'
import PaymentSimulatorApp from './PaymentSimulatorApp'
import { initializeMobileApp } from './mobile'
import './styles.css'

void initializeMobileApp()

const isAdminRoute = window.location.pathname.startsWith('/admin')
const isAuthRoute = window.location.pathname.startsWith('/login')
const isCashierRoute = window.location.pathname.startsWith('/cashier')
const isOrdersRoute = window.location.pathname.startsWith('/orders')
const isManagerRoute = window.location.pathname.startsWith('/manager')
const isPaymentSimulatorRoute = window.location.pathname.startsWith('/payment-simulator')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAuthRoute ? <AuthApp /> : isPaymentSimulatorRoute ? <PaymentSimulatorApp /> : isAdminRoute || isManagerRoute ? <ManagerApp /> : isCashierRoute ? <CashierApp /> : isOrdersRoute ? <CustomerOrdersApp /> : <App />}
  </StrictMode>,
)
