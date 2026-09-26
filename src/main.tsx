import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the app (not fetched from Google Fonts), so no visitor's IP address is sent to a font CDN and the
// offline Windows edition renders identically without a network. latin-ext covers accented player names.
import '@fontsource/oswald/latin-500.css'
import '@fontsource/oswald/latin-ext-500.css'
import '@fontsource/oswald/latin-600.css'
import '@fontsource/oswald/latin-ext-600.css'
import '@fontsource/oswald/latin-700.css'
import '@fontsource/oswald/latin-ext-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-ext-500.css'
import '@fontsource/press-start-2p/latin-400.css'
import '@fontsource/press-start-2p/latin-ext-400.css'
import '@fontsource/vt323/latin-400.css'
import '@fontsource/vt323/latin-ext-400.css'
import './index.css'
import App from './App.tsx'
import { WebAnalytics } from './components/WebAnalytics'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <WebAnalytics />
  </StrictMode>,
)
