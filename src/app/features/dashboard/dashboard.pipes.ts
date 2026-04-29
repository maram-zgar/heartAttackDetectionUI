// Import both pipes into AdminDashboardComponent's `imports` array.

import { Pipe, PipeTransform } from '@angular/core';

/**
 * titleFromId pipe
 * Resolves a nav item label from its id.
 * Usage: {{ navItems | titleFromId: activeNav() }}
 */
@Pipe({ name: 'titleFromId', standalone: true, pure: false })
export class TitleFromIdPipe implements PipeTransform {
  transform(items: { id: string; label: string }[], activeId: string): string {
    return items.find(i => i.id === activeId)?.label ?? '';
  }
}