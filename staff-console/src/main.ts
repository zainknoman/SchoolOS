import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { applyTheme, loadThemePreference } from './lib/theme'
import { installFetchInterceptor } from './lib/fetchInterceptor'
import { useAuthStore } from './stores/auth'
import { i18n, applyLocaleToDocument, loadLocalePreference } from './lib/i18n'

applyTheme(loadThemePreference())
applyLocaleToDocument(loadLocalePreference())

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
installFetchInterceptor()

// BL-36: the access token lives only in memory, so a reload first gets one from the HttpOnly
// session cookie — before the router's first navigation runs its auth guard.
void useAuthStore(pinia)
  .restoreSession()
  .finally(() => {
    app.use(router)
    app.use(i18n)
    app.mount('#app')
  })
