import { supabase } from '../lib/supabase.js';

export async function getOrCreateProfile(userId, displayName) {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  if (data) return data.username;

  const firstName = (displayName || 'Player').split(' ')[0];
  for (let i = 0; i < 10; i++) {
    const digits = Math.floor(1000 + Math.random() * 9000);
    const username = `${firstName}${digits}`;
    const { error } = await supabase.from('profiles').insert({ id: userId, username });
    if (!error) return username;
  }
  return `${firstName}${Date.now() % 10000}`;
}
