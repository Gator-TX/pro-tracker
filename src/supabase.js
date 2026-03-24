import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gnbrcfxaljunjvbnxncw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuemttcGNvdXlrdGVmbGZzZmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTQ5MzYsImV4cCI6MjA4OTM3MDkzNn0.oYDAUhQXYAxtDYdnpYtfT6m4CIDCCfTrwBjIuZ8cl3s'

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
