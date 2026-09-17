import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Electron renderer Supabase client.
 *
 * Session isolation notes:
 *  - Electron's renderer process runs in its own BrowserWindow with a dedicated
 *    Chromium profile under the app's userData directory. Its localStorage is
 *    completely separate from the system browser (Chrome, Edge, etc.).
 *  - After handoff, the desktop app stores its OWN independent session
 *    (obtained via supabase.auth.admin.createSession on the backend).
 *    This session has a different refresh_token than the browser session.
 *  - autoRefreshToken: true  — Supabase automatically refreshes the access
 *    token before expiry using the stored refresh_token, without any browser
 *    involvement.
 *  - persistSession: true    — Session survives app restarts (stored in
 *    Electron's isolated localStorage).
 *  - detectSessionInUrl: false — Prevents the renderer from trying to parse
 *    auth tokens from the URL (not relevant for Electron).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
