import { supabase } from '../lib/supabase.js';

const LOCAL_KEY = 'chess_drill_studies';

function localStudies() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveLocalStudies(arr) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
}

export async function getStudies(userId) {
  if (!userId) return localStudies();
  const { data, error } = await supabase
    .from('studies')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

export async function saveStudy(userId, name, pgn) {
  if (!userId) {
    const study = { id: `local_${Date.now()}`, name, pgn, created_at: new Date().toISOString() };
    saveLocalStudies([study, ...localStudies()]);
    return study;
  }
  const { data, error } = await supabase
    .from('studies')
    .insert({ user_id: userId, name, pgn })
    .select('id, name, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getStudyPgn(studyId) {
  if (String(studyId).startsWith('local_')) {
    const study = localStudies().find(s => s.id === studyId);
    if (!study) throw new Error('Study not found');
    return { pgn: study.pgn, name: study.name };
  }
  const { data, error } = await supabase
    .from('studies')
    .select('pgn, name')
    .eq('id', studyId)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudy(studyId) {
  if (String(studyId).startsWith('local_')) {
    saveLocalStudies(localStudies().filter(s => s.id !== studyId));
    return;
  }
  await supabase.from('studies').delete().eq('id', studyId);
}
