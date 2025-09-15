import { db } from '@/lib/db';
import { programScheduleDays, managerSectionGrants } from '@/lib/schema';
import { auth } from '@/lib/auth';
import { and, eq, or, isNull } from 'drizzle-orm';

// POST /api/admin/manageMeedian/pushRoutine
// Body: { programId, track, routine: { [day]: { [classId]: { [periodKey]: mspCodeId } } } }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const session = await auth();
    if (!session || !['admin','team_manager'].includes(session.user?.role)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { programId, track, routine } = req.body;
    if (!programId || !track || !routine) return res.status(400).json({ error: 'Missing fields' });
    // Team manager write-gating: must have metaPrograms grant (global or per-program) with canWrite
    if (session.user.role === 'team_manager') {
      const uid = Number(session.user.id);
      const rows = await db
        .select({ id: managerSectionGrants.id, canWrite: managerSectionGrants.canWrite })
        .from(managerSectionGrants)
        .where(
          and(
            eq(managerSectionGrants.userId, uid),
            eq(managerSectionGrants.section, 'metaPrograms'),
            or(isNull(managerSectionGrants.programId), eq(managerSectionGrants.programId, Number(programId)))
          )
        );
      if (!rows.length || rows.every(r => r.canWrite !== true)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    // Flatten routine to array of rows
    const rows = [];
    for (const dayName of Object.keys(routine)) {
      const byClass = routine[dayName] || {};
      for (const classId of Object.keys(byClass)) {
        const byPeriod = byClass[classId] || {};
        for (const periodKey of Object.keys(byPeriod)) {
          const mspCodeId = byPeriod[periodKey];
          if (!mspCodeId) continue;
          rows.push({
            programId,
            track,
            classId: Number(classId),
            dayName,
            periodKey,
            mspCodeId: Number(mspCodeId),
            active: true,
          });
        }
      }
    }
    // Remove existing for this program/track
    await db.delete(programScheduleDays).where(and(eq(programScheduleDays.programId, Number(programId)), eq(programScheduleDays.track, track)));
    // Insert new
    if (rows.length) await db.insert(programScheduleDays).values(rows);
    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
