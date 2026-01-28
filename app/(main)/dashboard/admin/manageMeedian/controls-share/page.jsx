"use client";
import React from "react";
import useSWR from "swr";

const fetcher = (u) => fetch(u, { headers: { "Content-Type": "application/json" } }).then(r => r.json());

export default function ControlsSharePage() {
  const { data, mutate } = useSWR("/api/admin/manageMeedian?section=controlsShare", fetcher);
  const [saving, setSaving] = React.useState(false);
  const managers = data?.managers || [];
  const sections = data?.sections || [];
  const programs = data?.programs || [];
  const grants = data?.grants || [];
  // Build a fast lookup set for existing grants, covering both global and per-program
  const grantSet = React.useMemo(() => {
    const s = new Set();
    for (const g of grants) {
      s.add(`${g.userId}|${g.section}`);
      if (g.programId) s.add(`${g.userId}|${g.section}|${g.programId}`);
    }
    return s;
  }, [grants]);
  const [draft, setDraft] = React.useState({}); // supports `${userId}|${section}` and `${userId}|${section}|${programId}`
  // Initialize draft only when the grants set actually changes
  const grantSig = React.useMemo(
    () => JSON.stringify(grants.map(g => [g.userId, g.section, g.programId]).sort()),
    [grants]
  );
  React.useEffect(() => {
    const init = {};
    for (const g of grants) {
      init[`${g.userId}|${g.section}`] = true;
      if (g.programId) init[`${g.userId}|${g.section}|${g.programId}`] = true;
    }
    setDraft(init);
  }, [grantSig]);

  const toggle = (uid, sec) => setDraft(prev => ({ ...prev, [`${uid}|${sec}`]: !prev[`${uid}|${sec}`] }));
  const onSave = async () => {
    setSaving(true);
    try {
      const items = [];
      for (const uid of managers.map(m => m.id)) {
        for (const sec of sections) {
          const key = `${uid}|${sec}`;
          const want = !!draft[key];
          const had = grantSet.has(key);
          if (want && !had) items.push({ userId: uid, section: sec, canWrite: true });
          if (!want && had) items.push({ userId: uid, section: sec, remove: true });
        }
        // per-program grants for metaPrograms
        for (const p of programs) {
          const keyP = `${uid}|metaPrograms|${p.id}`;
          const wantP = !!draft[keyP];
          const hadP = grantSet.has(keyP);
          if (wantP && !hadP) items.push({ userId: uid, section: 'metaPrograms', programId: p.id, canWrite: true });
          if (!wantP && hadP) items.push({ userId: uid, section: 'metaPrograms', programId: p.id, remove: true });
        }
      }
      if (!items.length) return;
      const res = await fetch('/api/admin/manageMeedian?section=controlsShare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grants: items }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await mutate();
      alert('Saved');
    } catch (e) {
      console.error(e);
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Mirror Admin Sidebar items as cards with doables and manager multi-selects
  const adminItems = React.useMemo(() => ([
    {
      key: 'adminClub',
      label: 'Admin Club',
      sections: ['adminClub','mriReportAssignments','campusGateStaff','guardianGateLogs','metaPrograms','team'],
      doables: ['View leadership dashboard', 'Review PT report status', 'Monitor gate activity', 'Inspect member MRI journals'],
      description: 'Leadership-only dashboard. Also grants underlying data sets required for the Admin Club summaries.',
    },
    {
      key: 'dailySlots',
      label: 'Daily Slots',
      sections: ['slots','slotsWeekly','slotRoleAssignments','seedSlotsWeekly'],
      doables: ['View', 'Edit timings/meta', 'Weekly TOD (counts, assign/unassign)', 'Finalize'],
      description: 'Manage N‑MRI slots and weekly coverage templates.',
    },
    {
      key: 'programDesign',
      label: 'Program Design',
      sections: ['metaPrograms','metaProgramRoles','metaRoleDefs','metaRoleTasks','programPeriods','programScheduleCells'],
      doables: ['View', 'Create/Update programs', 'Setup roles & tasks', 'Configure schedule'],
      description: 'Design academic programs, roles and schedules.'
    },
    {
      key: 'mriRoles',
      label: 'MRI & Roles',
      sections: ['mriRoles','metaRoleDefs','metaRoleTasks'],
      doables: ['View MRI roles', 'Edit role definitions & tasks'],
      description: 'MRI families/roles and their tasks.'
    },
    {
      key: 'dailyReports',
      label: 'Daily Reports',
      sections: ['mriReportTemplates','mriReportAssignments'],
      doables: ['View PT template', 'Assign holders', 'Sync class teachers'],
      description: 'PT daily report template plus report holder assignments.',
    },
    {
      key: 'gateLogs',
      label: 'Daily Gate Logs',
      sections: ['campusGateStaff','guardianGateLogs'],
      doables: ['View team gate scans', 'Enter guardian/visitor ledger'],
      description: 'Campus in/out records for team members and guardian visitors.',
    },
    {
      key: 'mspCodes',
      label: 'MSP Codes',
      sections: ['mspCodes','mspCodeAssignments'],
      doables: ['View', 'Create/Update codes', 'Assign/Unassign'],
      description: 'Code catalog and assignments.'
    },
    {
      key: 'classTeachers',
      label: 'Class Teachers',
      sections: ['classTeachers'],
      doables: ['View', 'Assign/Unassign'],
      description: 'Class teacher assignments.'
    },
    {
      key: 'calendar',
      label: 'School Calendar',
      sections: ['schoolCalendar'],
      doables: ['View calendar'],
      description: 'Term and week calendar (read-only here).'
    },
    {
      key: 'team',
      label: 'Manage Team',
      sections: ['team'],
      doables: ['View team list', 'Edit roles/flags'],
      description: 'Manage team accounts and flags.'
    },
    {
      key: 'randomsLab',
      label: 'Randoms Lab',
      sections: ['randomsLab'],
      doables: ['Access experimental toggles'],
      description: 'Enable access to experimental Randoms Lab controls.',
    },
    {
      key: 'students',
      label: 'Students',
      sections: ['students'],
      doables: ['View student directory'],
      description: 'Student directory and details.'
    },
    {
      key: 'recruitmentPro',
      label: 'Meed Recruitment',
      sections: ['recruitmentPro'],
      doables: ['Manage recruitment pipeline', 'View dashboards', 'Update communication logs'],
      description: 'Teacher recruitment tracker with pipeline stages and metrics.',
    },
  ]), []);

  const isItemGranted = (uid, item) => item.sections.every(sec => draft[`${uid}|${sec}`] || grantSet.has(`${uid}|${sec}`));
  const isProgramGranted = (uid, programId) => {
    return (
      !!draft[`${uid}|metaPrograms`] ||
      !!draft[`${uid}|metaPrograms|${programId}`] ||
      grantSet.has(`${uid}|metaPrograms`) ||
      grantSet.has(`${uid}|metaPrograms|${programId}`)
    );
  };
  const addUserToItem = (uid, item) => {
    setDraft(prev => {
      const next = { ...prev };
      for (const sec of item.sections) next[`${uid}|${sec}`] = true;
      return next;
    });
  };
  const removeUserFromItem = (uid, item) => {
    setDraft(prev => {
      const next = { ...prev };
      for (const sec of item.sections) next[`${uid}|${sec}`] = false;
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Controls Share</h1>
          <p className="text-sm text-gray-600">Grant managers access to Admin sidebar items. Pick users under each item card.</p>
        </div>
        <button className="px-3 py-1.5 rounded-lg border text-sm bg-teal-600 text-white border-teal-600 disabled:opacity-60" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-gray-900 mb-2">Programs</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {programs.map((p) => (
            <div key={p.id} className="rounded-xl border bg-white p-4 flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{p.programKey || p.name}</div>
                <div className="text-xs text-gray-600">Grant access to Program Design for this program.</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Managers with access</div>
                <div className="flex flex-wrap gap-2">
                  {managers.filter(m => isProgramGranted(m.id, p.id)).map((m) => (
                    <span key={`prog-${p.id}-${m.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-xs">
                      {m.name}
                      <button className="text-red-600" title="Remove" onClick={() => setDraft(prev => ({ ...prev, [`${m.id}|metaPrograms|${p.id}`]: false }))}>×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select className="border rounded-lg px-2 py-1 text-sm flex-1" defaultValue="" onChange={(e)=>{ const uid = Number(e.target.value); if (uid) { setDraft(prev => ({ ...prev, [`${uid}|metaPrograms|${p.id}`]: true })); e.target.value=''; } }}>
                  <option value="" disabled>Add manager…</option>
                  {managers.filter(m => !isProgramGranted(m.id, p.id)).map((m) => (
                    <option key={`prog-opt-${p.id}-${m.id}`} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
        {adminItems.map((item) => (
          <div key={item.key} className="rounded-xl border bg-white p-4 flex flex-col gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-600">{item.description}</div>
            </div>
            <div className="text-xs text-gray-700">
              <span className="font-medium mr-1">Doables:</span>
              {item.doables.join(' • ')}
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Managers with access</div>
              <div className="flex flex-wrap gap-2">
                {managers.filter(m => isItemGranted(m.id, item)).map((m) => (
                  <span key={`${item.key}-${m.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border text-xs">
                    {m.name}
                    <button className="text-red-600" title="Remove" onClick={() => removeUserFromItem(m.id, item)}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select className="border rounded-lg px-2 py-1 text-sm flex-1" defaultValue="" onChange={(e)=>{ const uid = Number(e.target.value); if (uid) { addUserToItem(uid, item); e.target.value=''; } }}>
                <option value="" disabled>Add manager…</option>
                {managers.filter(m => !isItemGranted(m.id, item)).map((m) => (
                  <option key={`${item.key}-opt-${m.id}`} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
