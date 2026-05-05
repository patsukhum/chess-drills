import { supabase } from '../lib/supabase.js';

export async function getLeaderboard(pieceType = 'rook') {
  const { data, error } = await supabase
    .from('scores')
    .select('name, score')
    .eq('piece_type', pieceType)
    .order('score', { ascending: false })
    .limit(20);
  if (error) return [];
  return data;
}

export async function saveScore(name, score, pieceType = 'rook', userId = null) {
  let query = supabase.from('scores').select('id, score');
  if (userId) {
    query = query.eq('user_id', userId).eq('piece_type', pieceType);
  } else {
    query = query.eq('name', name).eq('piece_type', pieceType).is('user_id', null);
  }
  const { data: existing, error: selectError } = await query.maybeSingle();
  if (selectError) console.error('[saveScore] select error:', selectError);

  if (!existing) {
    const { error: insertError } = await supabase
      .from('scores')
      .insert({ name, score, piece_type: pieceType, user_id: userId });
    if (insertError) console.error('[saveScore] insert error:', insertError);
  } else if (score > existing.score) {
    const { error: updateError } = await supabase
      .from('scores')
      .update({ score })
      .eq('id', existing.id);
    if (updateError) console.error('[saveScore] update error:', updateError);
  }

  return getLeaderboard(pieceType);
}
