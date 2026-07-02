import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hnmohhhaqinbidautzls.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhubW9oaGhhcWluYmlkYXV0emxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODA2MjUsImV4cCI6MjA5Nzg1NjYyNX0.LjA1cpyN1XLB-M8Dl8b1bkGobQOIZFR6f3y5aVl5ST0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDb() {
  const { data: assignments, error: assignErr } = await supabase.rpc('get_debug_assignments')
  console.log('Assignments:', assignments, 'Error:', assignErr)
}

checkDb()
