// supabase-config.js

const SUPABASE_URL = "https://gccxrpvmokaqotywrtgx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY3hycHZtb2thcW90eXdydGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTU5MDQsImV4cCI6MjEwNjgzMTkwNH0.QEaExOgv5dIX42KqCjdG258amvR0rXTYYjFs4-yxmaI";

// Supabase Client তৈরি করা
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
