import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://anzkmpcouykteflfsfgd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuemttcGNvdXlrdGVmbGZzZmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTQ5MzYsImV4cCI6MjA4OTM3MDkzNn0.oYDAUhQXYAxtDYdnpYtfT6m4CIDCCfTrwBjIuZ8cl3s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
