import { eq, isNull } from 'drizzle-orm';
import { transactionDocuments, transactions } from './db/schema.js';
import { media } from './media.js';
import { teamMedia } from './teams.js';

// Whose money it is. Finances are kept for the organization and, apart from that, for each
// person in their personal team. Everything about a transaction or its papers is asked for one
// owner, so the two never show up in each other's pages.

/** The organization, written as null, or a person's personal team. */
export type FinanceOwner = { id: string; slug: string } | null;

/** Narrows a query to the owner's transactions. */
export function transactionsOf(owner: FinanceOwner) {
	return owner ? eq(transactions.teamId, owner.id) : isNull(transactions.teamId);
}

/** Narrows a query to the owner's documents. */
export function documentsOwnedBy(owner: FinanceOwner) {
	return owner ? eq(transactionDocuments.teamId, owner.id) : isNull(transactionDocuments.teamId);
}

/** What goes in the owner column of a new row. */
export function ownerId(owner: FinanceOwner) {
	return owner?.id ?? null;
}

/**
 * Where the owner's files are kept: the organization's at the top of the media folder, a
 * person's inside their personal team's folder, so they go when the team does.
 */
export function ownerMedia(owner: FinanceOwner) {
	return owner ? teamMedia(owner) : media;
}
