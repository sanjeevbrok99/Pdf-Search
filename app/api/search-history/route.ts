import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import redis from '@/lib/redis';
export async function GET(request: Request) {
  try {
    const searchHistoryRaw = await redis.lrange('search-history', 0, -1);

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

    // Fetch all search history from Redis
    const rawHistory = await redis.lrange('search-history', 0, -1);

    for (const item of rawHistory) {
      try {
        const parsed = JSON.parse(item);
        if (parsed.query === query) {
          await redis.lrem('search-history', 1, item); // Remove the first matching entry
          break;
        }
      } catch (e) {
        console.error('Failed to parse Redis item:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting search history from Redis:', error);
    return NextResponse.json({ error: 'Failed to delete search history' }, { status: 500 });
  }
}
