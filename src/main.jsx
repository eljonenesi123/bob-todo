import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts are part of the app, so they're there without a connection
import '@fontsource-variable/outfit/wght.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
