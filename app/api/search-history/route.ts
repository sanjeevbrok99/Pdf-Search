import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import redis from '@/lib/redis';
export async function GET(request: Request) {
  try {
    const searchHistoryRaw = await redis.lrange('search', 0, 9);

    // Parse the JSON strings into objects
    const searchHistory = searchHistoryRaw.map(entry => JSON.parse(entry));

    return NextResponse.json({ history: searchHistory });
  } catch (error) {
    console.error('Failed to fetch search history:', error);
    return NextResponse.json({ error: 'Failed to fetch search history' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { query } = await request.json();

    const { error } = await supabase
      .from('search_history')
      .delete()
      .eq('query', query);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting search history:', error);
    return NextResponse.json({ error: 'Failed to delete search history' }, { status: 500 });
  }
}
