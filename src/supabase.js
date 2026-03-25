// Updated: UAT CRM project
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://gnbrcfxaljunjvbnxncw.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Custom storage adapter: uses sessionStorage when "session only" mode is active,
// otherwise falls back to localStorage (Supabase default behavior).
const customStorage = {
  getItem: (key) => {
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal !== null) return sessionVal;
    return localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (sessionStorage.getItem('supabase_session_only') === 'true') {
      sessionStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: customStorage },
})
