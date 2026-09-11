import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { applyTheme, loadThemePreference } from './lib/theme'
import { installFetchInterceptor } from './lib/fetchInterceptor'
import { i18n, applyLocaleToDocument, loadLocalePreference } from './lib/i18n'

applyTheme(loadThemePreference())
applyLocaleToDocument(loadLocalePreference())

const app = createApp(App)

app.use(createPinia())
installFetchInterceptor()
app.use(router)
app.use(i18n)

app.mount('#app')
