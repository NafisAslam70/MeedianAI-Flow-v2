import { db } from '@/lib/db';
import { programScheduleDays } from '@/lib/schema';

// POST /api/admin/manageMeedian/pushRoutine
// Body: { programId, track, routine: { [day]: { [classId]: { [periodKey]: mspCodeId } } } }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { programId, track, routine } = req.body;
    if (!programId || !track || !routine) return res.status(400).json({ error: 'Missing fields' });
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
    await db.delete(programScheduleDays).where({ programId, track });
    // Insert new
    if (rows.length) await db.insert(programScheduleDays).values(rows);
    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
