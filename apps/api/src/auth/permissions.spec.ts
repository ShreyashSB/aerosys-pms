import { ROLE_PERMISSIONS as WEB_ROLE_PERMISSIONS } from '../../../web/src/auth/permissions';
import { ROLE_PERMISSIONS, ROLES, can } from './permissions.js';

/** The web app hides what a role can't do; the API refuses it. Both lists must be the same. */
describe('permissions', () => {
  it('match the web app, role by role', () => {
    const sorted = (m: Record<string, string[]>) => Object.fromEntries(Object.entries(m).map(([role, list]) => [role, [...list].sort()]));
    expect(sorted(ROLE_PERMISSIONS)).toEqual(sorted(WEB_ROLE_PERMISSIONS));
  });

  it('gives a site engineer only progress and instruments', () => {
    expect(can('site_engineer', 'project.progress')).toBe(true);
    expect(can('site_engineer', 'expense.create')).toBe(false);
    expect(can('site_engineer', 'log.create')).toBe(false);
  });

  it('lets only Accounts record money: expenses, bills and invoices, other project costs', () => {
    for (const p of ['expense.create', 'bill.manage', 'project.costs.edit'] as const) {
      expect(ROLES.filter((r) => can(r, p))).toEqual(['accounts']);
    }
  });
});
