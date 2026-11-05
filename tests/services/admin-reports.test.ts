import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { adminAuditLog, listings, reports } from '@/server/db/schema';
import { getReport, listReports, resolveReport } from '@/server/services/admin-reports';
import { Conflict, Forbidden, NotFound, ValidationError } from '@/server/services/errors';
import { withRollback } from '../helpers/db';
import { actorFor, createSchool, createUser, insertListing } from '../helpers/fixtures';
import { insertConversation, insertMessage, liveListing } from '../helpers/messaging';
import { insertReport } from '../helpers/moderation';

const auditRows = (targetId: string) =>
  db().select().from(adminAuditLog).where(eq(adminAuditLog.targetId, targetId));

describe('admin reports', () => {
  it('admins only', () =>
    withRollback(async () => {
      const user = await createUser();
      const report = await insertReport({ reporterId: user.id, targetType: 'user', targetId: 'x' });
      const actor = actorFor(user.id);
      await expect(listReports(actor, {})).rejects.toBeInstanceOf(Forbidden);
      await expect(getReport(actor, report.id)).rejects.toBeInstanceOf(Forbidden);
      await expect(resolveReport(actor, { reportId: report.id, note: 'x' })).rejects.toBeInstanceOf(
        Forbidden,
      );
    }));

  it('lists open reports newest first and filters by status, school, and reason', () =>
    withRollback(async () => {
      const admin = await createUser();
      const reporter = await createUser();
      const schoolA = await createSchool();
      const schoolB = await createSchool();
      const ownerA = await createUser();
      const listingA = await insertListing(ownerA.id, schoolA.id);
      const listingB = await insertListing(ownerA.id, schoolB.id);
      const old = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: listingA.id,
        reason: 'scam',
        createdAt: new Date('2099-01-01T00:00:00Z'),
      });
      const recent = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: listingB.id,
        reason: 'spam',
        createdAt: new Date('2099-01-02T00:00:00Z'),
      });
      const done = await insertReport({
        reporterId: reporter.id,
        targetType: 'user',
        targetId: ownerA.id,
        status: 'resolved',
        createdAt: new Date('2099-01-03T00:00:00Z'),
      });
      const actor = actorFor(admin.id, true);
      const mine = (rows: { id: string }[]) =>
        rows.map((r) => r.id).filter((id) => [old.id, recent.id, done.id].includes(id));

      expect(mine(await listReports(actor, {}))).toEqual([recent.id, old.id]);
      expect(mine(await listReports(actor, { status: 'resolved' }))).toEqual([done.id]);
      expect(mine(await listReports(actor, { status: 'all' }))).toEqual([
        done.id,
        recent.id,
        old.id,
      ]);
      expect(mine(await listReports(actor, { school: schoolA.slug }))).toEqual([old.id]);
      expect(mine(await listReports(actor, { school: '  ' }))).toEqual([recent.id, old.id]);
      expect(mine(await listReports(actor, { school: '', reason: 'spam' }))).toEqual([recent.id]);
    }));

  it('labels each target, including deleted ones', () =>
    withRollback(async () => {
      const admin = await createUser();
      const { listing } = await liveListing();
      const gone = await liveListing();
      const reporter = await createUser();
      const live = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: listing.id,
      });
      const dead = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: gone.listing.id,
      });
      await db().delete(listings).where(eq(listings.id, gone.listing.id));
      const rows = await listReports(actorFor(admin.id, true), { status: 'all' });
      expect(rows.find((r) => r.id === live.id)?.targetLabel).toBe(listing.title);
      expect(rows.find((r) => r.id === dead.id)?.targetLabel).toBe('Deleted');
    }));

  it('shows a reported message inside its conversation and logs the view', () =>
    withRollback(async () => {
      const admin = await createUser();
      const { owner, listing } = await liveListing();
      const renter = await createUser();
      const convo = await insertConversation({
        listingId: listing.id,
        hostId: owner.id,
        renterId: renter.id,
      });
      const message = await insertMessage(convo.id, renter.id, 'send money');
      const report = await insertReport({
        reporterId: owner.id,
        targetType: 'message',
        targetId: message.id,
      });
      const view = await getReport(actorFor(admin.id, true), report.id);
      expect(view.target.type).toBe('message');
      if (view.target.type !== 'message') return;
      expect(view.target.message?.body).toBe('send money');
      expect(view.target.conversation?.id).toBe(convo.id);
      expect(view.reporter?.id).toBe(owner.id);
      const rows = await auditRows(convo.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('viewed_conversation');
    }));

  it('handles a deleted message target without logging a view', () =>
    withRollback(async () => {
      const admin = await createUser();
      const report = await insertReport({
        reporterId: null,
        targetType: 'message',
        targetId: '00000000-0000-4000-8000-000000000001',
      });
      const view = await getReport(actorFor(admin.id, true), report.id);
      expect(view.target).toMatchObject({ type: 'message', message: null, conversation: null });
      expect(await auditRows('00000000-0000-4000-8000-000000000001')).toHaveLength(0);
    }));

  it('resolves with a required note and audit row', () =>
    withRollback(async () => {
      const admin = await createUser();
      const { listing } = await liveListing();
      const report = await insertReport({
        reporterId: null,
        targetType: 'listing',
        targetId: listing.id,
      });
      const actor = actorFor(admin.id, true);
      const err = await resolveReport(actor, { reportId: report.id, note: '' }).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.fieldErrors.note).toEqual(['Add a resolution note']);

      await resolveReport(actor, { reportId: report.id, note: ' Handled ' });
      const [row] = await db().select().from(reports).where(eq(reports.id, report.id));
      expect(row).toMatchObject({
        status: 'resolved',
        resolvedBy: admin.id,
        resolutionNote: 'Handled',
      });
      expect(row.resolvedAt).not.toBeNull();
      const audit = await auditRows(report.id);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'resolved_report',
        targetType: 'report',
        snapshot: { note: 'Handled' },
      });

      await expect(resolveReport(actor, { reportId: report.id, note: 'again' })).rejects.toThrow(
        new Conflict('This report is already resolved'),
      );
      const [target] = await db().select().from(listings).where(eq(listings.id, listing.id));
      expect(target.reviewStatus).toBe('approved');

      await expect(
        resolveReport(actor, { reportId: '00000000-0000-4000-8000-000000000002', note: 'x' }),
      ).rejects.toBeInstanceOf(NotFound);
    }));

  it('counts other open reports on the same target', () =>
    withRollback(async () => {
      const admin = await createUser();
      const { listing } = await liveListing();
      const [a, b, c] = [await createUser(), await createUser(), await createUser()];
      const first = await insertReport({
        reporterId: a.id,
        targetType: 'listing',
        targetId: listing.id,
      });
      await insertReport({ reporterId: b.id, targetType: 'listing', targetId: listing.id });
      await insertReport({
        reporterId: c.id,
        targetType: 'listing',
        targetId: listing.id,
        status: 'resolved',
      });
      const view = await getReport(actorFor(admin.id, true), first.id);
      expect(view.otherOpenReports).toBe(1);
      expect(view.target.type).toBe('listing');
    }));

  it('returns review note and expiry for a listing target', () =>
    withRollback(async () => {
      const admin = actorFor((await createUser()).id, true);
      const reporter = await createUser();
      const owner = await createUser();
      const school = await createSchool();
      const rejected = await insertListing(owner.id, school.id, {
        reviewStatus: 'rejected',
        reviewNote: 'Photos are unclear',
      });
      const expired = await insertListing(owner.id, school.id, {
        reviewStatus: 'approved',
        availableFrom: '2000-01-01',
        availableTo: '2000-06-01',
      });
      const rejectedReport = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: rejected.id,
      });
      const expiredReport = await insertReport({
        reporterId: reporter.id,
        targetType: 'listing',
        targetId: expired.id,
      });
      const a = (await getReport(admin, rejectedReport.id)).target;
      const b = (await getReport(admin, expiredReport.id)).target;
      expect(a.type === 'listing' && a.listing).toMatchObject({
        reviewNote: 'Photos are unclear',
        isExpired: false,
      });
      expect(b.type === 'listing' && b.listing).toMatchObject({ isExpired: true });
    }));

  it('rejects missing or malformed ids', () =>
    withRollback(async () => {
      const admin = actorFor((await createUser()).id, true);
      const missing = '00000000-0000-4000-8000-000000000003';
      await expect(getReport(admin, missing)).rejects.toBeInstanceOf(NotFound);
      await expect(getReport(admin, 'nope')).rejects.toBeInstanceOf(NotFound);
      const err = await resolveReport(admin, { reportId: 'nope', note: 'x' }).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.fieldErrors.reportId).toBeDefined();
    }));
});
