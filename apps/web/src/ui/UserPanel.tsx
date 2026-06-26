/*
 * ---metadata---
 * type: app-source
 * description: Sidebar account footer with avatar, user name, and settings access.
 * last-updated: 2026-06-25
 * last-model: cursor-composer
 * last-change: v3 SaaS-style sidebar account footer with avatar and settings
 * ---end-metadata---
 */
import { Settings } from "lucide-react";

export function UserPanel() {
  return (
    <footer className="user-panel">
      <div className="user-avatar" aria-hidden="true">
        <span className="user-avatar-fallback">YO</span>
      </div>
      <p className="user-name">Yamac Ozkan</p>
      <button aria-label="Settings" className="user-panel-settings" type="button">
        <Settings size={16} strokeWidth={1.75} />
      </button>
    </footer>
  );
}
