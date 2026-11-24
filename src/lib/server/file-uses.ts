import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { projects, transactions } from './db/schema.js';

/** True if a transaction has this file attached, or a project uses it as its icon. */
export async function isFileUsed(path: string): Promise<boolean> {
	const [attachment] = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(eq(transactions.filePath, path))
		.limit(1);
	if (attachment) return true;

	const [icon] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.iconPath, path))
		.limit(1);
	return Boolean(icon);
}
