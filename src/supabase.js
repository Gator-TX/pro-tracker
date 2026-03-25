// Updated: UAT CRM project
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://gnbrcfxaljunjvbnxncw.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl);
console.log("ANON KEY CHECK - first 10:", supabaseAnonKey?.substring(0, 10));
console.log("ANON KEY CHECK - last 10:", supabaseAnonKey?.slice(-10));
console.log("ANON KEY LENGTH:", supabaseAnonKey?.length);

const customStorage = {
  getItem: (key) => {
    return localStorage.getItem(key);
  },
  setItem: (key, value) => {
    localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: customStorage },
})
