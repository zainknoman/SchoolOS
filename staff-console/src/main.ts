import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { applyTheme, loadThemePreference } from './lib/theme'
import { installFetchInterceptor } from './lib/fetchInterceptor'

applyTheme(loadThemePreference())

const app = createApp(App)

app.use(createPinia())
installFetchInterceptor()
app.use(router)

app.mount('#app')
