export const shadowStyles = `
:host {
  all: initial;
}
.pm-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483640;
  font-family: 'Segoe UI', 'SF Pro Display', system-ui, -apple-system, sans-serif;
  color: #0f172a;
}
.pm-orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle at 20% 20%, #9ae6b4, #2563eb);
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  cursor: grab;
  position: fixed;
  user-select: none;
  pointer-events: auto;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 2147483632;
}
.pm-orb:hover { transform: scale(1.05); box-shadow: 0 12px 32px rgba(0,0,0,0.22); }
.pm-orb:active { cursor: grabbing; }

.pm-radial {
  position: fixed;
  width: 180px;
  height: 180px;
  pointer-events: none;
  z-index: 2147483631;
}
.pm-radial .pm-sector {
  position: absolute;
  width: 68px;
  height: 68px;
  transform: translate(-50%, -50%);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-align: center;
  padding: 6px;
  pointer-events: auto;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}
.pm-radial .pm-sector:hover { background: #2563eb; transform: scale(1.03); }

.pm-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  background: #f8fafc;
  border-left: 1px solid #e2e8f0;
  box-shadow: -10px 0 30px rgba(15, 23, 42, 0.1);
  transform: translateX(100%);
  transition: transform 0.28s ease;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  z-index: 2147483635;
}
.pm-drawer.open { transform: translateX(0); }
.pm-drawer header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}
.pm-drawer h2 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
.pm-close { border: none; background: transparent; font-size: 18px; cursor: pointer; color: #334155; }
.pm-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(15,23,42,0.03); }
.pm-section h3 { margin: 0 0 8px 0; font-size: 14px; color: #0f172a; }
.pm-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.pm-field label { font-size: 12px; color: #475569; }
.pm-field input, .pm-field textarea, .pm-field select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #f8fafc;
}
.pm-field textarea { min-height: 80px; resize: vertical; }
.pm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.pm-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
  font-size: 13px;
}
.pm-btn.secondary { background: #e2e8f0; color: #0f172a; }
.pm-btn.danger { background: #dc2626; }
.pm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
.pm-list { display: flex; flex-direction: column; gap: 10px; }
.pm-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pm-item .pm-item-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pm-tag { background: #e0f2fe; color: #0ea5e9; padding: 2px 6px; border-radius: 6px; font-size: 11px; }
.pm-badge { font-size: 11px; color: #64748b; }
.pm-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pm-pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.pm-pill.active { background: #2563eb; color: #fff; border-color: #1d4ed8; }
.pm-drawer footer { padding: 10px 14px; border-top: 1px solid #e2e8f0; background: #fff; font-size: 12px; color: #475569; }
.pm-inline { display: inline-flex; align-items: center; gap: 4px; }
.pm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pm-table td, .pm-table th { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
.pm-muted { color: #94a3b8; font-size: 12px; }
.pm-input-inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-toast { position: fixed; bottom: 16px; right: 16px; background: #0f172a; color: #fff; padding: 10px 12px; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.22); font-size: 13px; }
`;
