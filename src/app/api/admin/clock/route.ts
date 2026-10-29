/**
 * GET /api/admin/clock   — read current sim_clock row
 * PUT /api/admin/clock   — pause / resume / fast-forward / reset / change rate
 *
 * Admin only. Controls the virtual clock (ARCHITECTURE.md §5).
 *
 * PUT body variants:
 *   { action: 'pause' }
 *   { action: 'resume' }
 *   { action: 'fast-forward', days: number }
 *   { action: 'reset' }
 *   { action: 'set-rate', tick_minutes: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { adminSession, boundedNumber, invalid } from '@/lib/admin';
import { apiError } from '@/lib/authz';

async function readClock() {
  const [rows] = await pool.query<any[]>(
    'SELECT clock_id, virtual_now, tick_minutes, is_running FROM sim_clock WHERE clock_id = 1',
  );
  if (!rows[0]) return null;
  return { ...rows[0], is_running: Boolean(rows[0].is_running) };
}

export async function GET() {
  const { denied } = await adminSession();
  if (denied) return denied;
  try {
    const clock = await readClock();
    return clock ? NextResponse.json(clock) : apiError('NOT_FOUND', 'Virtual clock is not configured', 404);
  } catch {
    return apiError('DATABASE_ERROR', 'Unable to read the virtual clock', 500);
  }
}

export async function PUT(req: NextRequest) {
  const { denied } = await adminSession();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'pause') {
      await pool.query('ALTER EVENT evt_clock_tick DISABLE');
      await pool.execute('UPDATE sim_clock SET is_running = FALSE WHERE clock_id = 1');
    } else if (body.action === 'resume') {
      await pool.query('ALTER EVENT evt_clock_tick ENABLE');
      await pool.execute('UPDATE sim_clock SET is_running = TRUE WHERE clock_id = 1');
    } else if (body.action === 'fast-forward') {
      const days = boundedNumber(body.days, -3650, 3650);
      if (days === null || !Number.isInteger(days)) {
        return invalid('Fast-forward days must be a whole number between -3650 and 3650');
      }
      await pool.execute('UPDATE sim_clock SET virtual_now = DATE_ADD(virtual_now, INTERVAL ? DAY) WHERE clock_id = 1', [days]);
    } else if (body.action === 'reset') {
      await pool.execute('UPDATE sim_clock SET virtual_now = NOW() WHERE clock_id = 1');
    } else if (body.action === 'set-rate') {
      const minutes = boundedNumber(body.tick_minutes, 1, 10080);
      if (minutes === null || !Number.isInteger(minutes)) {
        return invalid('Tick rate must be a whole number between 1 and 10080 minutes');
      }
      await pool.execute('UPDATE sim_clock SET tick_minutes = ? WHERE clock_id = 1', [minutes]);
    } else {
      return invalid('Unknown clock action');
    }

    const clock = await readClock();
    if (!clock) return apiError('NOT_FOUND', 'Virtual clock is not configured', 404);
    return NextResponse.json(clock);
  } catch {
    return apiError(
      'CLOCK_ERROR',
      'Unable to update the virtual clock. Ensure the MariaDB event scheduler is enabled and evt_clock_tick exists.',
      500,
    );
  }
}
