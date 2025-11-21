'use strict';

const { getContactById, deleteContact } = require('../lib/dynamo');

function html(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function sanitize(text) {
  return String(text || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

exports.handler = async (event) => {
  try {
    const qs = (event && event.queryStringParameters) || {};
    const id = typeof qs.id === 'string' ? qs.id.trim() : '';

    if (!id) {
      return html(
        `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe</title></head><body>
				<h2>You're unsubscribed</h2>
				<p>If you keep receiving emails, please contact support.</p>
				</body></html>`
      );
    }

    const contact = await getContactById(id);
    if (contact && contact.id) {
      await deleteContact(id);
    }

    return html(
      `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe</title></head><body>
			<h2>You're unsubscribed</h2>
			<p>We won't send further emails to ${contact && contact.email ? sanitize(contact.email) : 'this contact'}.</p>
			</body></html>`
    );
  } catch (err) {
    console.error('[unsubscribe] error', err);
    return html(
      '<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe</title></head><body><h2>Unsubscribe</h2><p>Something went wrong, but we have recorded your request.</p></body></html>'
    );
  }
};


