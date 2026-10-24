import { ROLE_PERMISSIONS as WEB_ROLE_PERMISSIONS } from '../../../web/src/auth/permissions';
import { ROLE_PERMISSIONS, can } from './permissions.js';

/** The web app hides what a role can't do; the API refuses it. Both lists must be the same. */
describe('permissions', () => {
  it('match the web app, role by role', () => {
    const sorted = (m: Record<string, string[]>) => Object.fromEntries(Object.entries(m).map(([role, list]) => [role, [...list].sort()]));
    expect(sorted(ROLE_PERMISSIONS)).toEqual(sorted(WEB_ROLE_PERMISSIONS));
  });

  it('gives a site engineer only progress, own expenses and instruments', () => {
    expect(can('site_engineer', 'expense.create')).toBe(true);
    expect(can('site_engineer', 'expense.approve')).toBe(false);
    expect(can('site_engineer', 'log.create')).toBe(false);
  });
});
