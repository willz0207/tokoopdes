import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeMobile = Capacitor.isNativePlatform()

export async function initializeMobileApp() {
  if (!isNativeMobile) return
  document.documentElement.classList.add('capacitor-native')
  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#c61d23' })
    await StatusBar.setStyle({ style: Style.Light })
  } catch (error) {
    console.warn('Status bar mobile belum dapat dikonfigurasi.', error)
  }
  try {
    await SplashScreen.hide()
  } catch (error) {
    console.warn('Splash screen mobile belum dapat ditutup.', error)
  }
}

export async function openExternalUrl(url: string) {
  if (isNativeMobile && /^https?:\/\//i.test(url)) {
    await Browser.open({ url })
    return
  }
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.href = url
}
