import { extractText, getDocumentProxy } from 'unpdf';
import { AI_MODEL, AI_URL } from '$app/env/private';

/** True when a model server is configured, which is what turns the invoice upload on. */
export const invoiceReadingEnabled = Boolean(AI_URL);

export type InvoiceFields = {
	/** YYYY-MM-DD */
	date: string;
	/** A positive amount with at most two decimals, as text: "7.49". */
	amount: string;
	/** Three letters, upper case: "EUR". */
	currency: string;
	counterparty: string;
};

// Enough for several pages. Longer text is cut, since the totals are near the start or the end.
const MAX_CHARS = 12_000;
const TIMEOUT_MS = 60_000;

const schema = {
	type: 'object',
	additionalProperties: false,
	required: ['date', 'amount', 'currency', 'counterparty'],
	properties: {
		date: { type: 'string', description: 'Invoice date as YYYY-MM-DD' },
		amount: { type: 'number', description: 'Total amount to pay, including tax' },
		currency: { type: 'string', description: 'Three-letter currency code, such as EUR or USD' },
		counterparty: { type: 'string', description: 'Name of the company that issued the invoice' }
	}
};

/**
 * Reads the four fields of a transaction out of a PDF invoice.
 *
 * The PDF's own text is extracted first, and only that text is given to the model. A scan or a
 * photo has no text, so it is refused with a message. Whatever the model answers is checked
 * here and is only ever used to fill in a form the person confirms: the PDF is someone else's
 * content, and nothing in it is acted on.
 */
export async function readInvoice(
	bytes: Uint8Array
): Promise<{ fields: InvoiceFields } | { error: string }> {
	if (!AI_URL) return { error: 'Reading invoices is not set up on this Studio.' };

	let text: string;
	try {
		const pdf = await getDocumentProxy(bytes);
		({ text } = await extractText(pdf, { mergePages: true }));
	} catch {
		return { error: 'That file could not be read as a PDF.' };
	}

	text = text.trim();
	if (text.length < 40) {
		return {
			error: 'This PDF has no readable text, so it is probably a scan. Enter it by hand.'
		};
	}
	if (text.length > MAX_CHARS) {
		text = `${text.slice(0, MAX_CHARS / 2)}\n...\n${text.slice(-MAX_CHARS / 2)}`;
	}

	let answer: unknown;
	try {
		const response = await fetch(new URL('/v1/chat/completions', AI_URL), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS),
			body: JSON.stringify({
				model: AI_MODEL,
				temperature: 0,
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'invoice', strict: true, schema }
				},
				messages: [
					{
						role: 'user',
						content: `Below is the text of an invoice or receipt. Return: the invoice date as YYYY-MM-DD, the total amount to pay including tax as a number, the three-letter currency code, and the name of the company that issued it (the seller, not the customer).\n\n---\n${text}\n---`
					}
				]
			})
		});
		if (!response.ok) return { error: 'The model server did not answer. Enter it by hand.' };

		const body = await response.json();
		answer = JSON.parse(body.choices?.[0]?.message?.content ?? '');
	} catch {
		return { error: 'The invoice could not be read in time. Enter it by hand.' };
	}

	const fields = checkAnswer(answer);
	if (!fields) return { error: 'The invoice could not be understood. Enter it by hand.' };

	return { fields };
}

/** Accepts the model's answer only if every field has the shape the form expects. */
function checkAnswer(answer: unknown): InvoiceFields | null {
	if (typeof answer !== 'object' || answer === null) return null;
	const { date, amount, currency, counterparty } = answer as Record<string, unknown>;

	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	if (Number.isNaN(Date.parse(date))) return null;
	if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
	if (amount >= 1e10) return null;
	if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) return null;
	if (typeof counterparty !== 'string' || !counterparty.trim()) return null;

	return {
		date,
		amount: amount.toFixed(2),
		currency: currency.toUpperCase(),
		counterparty: counterparty.trim().slice(0, 200)
	};
}
