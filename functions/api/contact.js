// Hands a contact card back to the phone the one way an iPhone opens it in Contacts: a vCard
// served from the site, inline, as text/vcard. Safari shows that as the contact itself, with
// "Create New Contact" and "Add to Existing Contact" at the bottom. A card the page builds on
// its own cannot get there: shared, it reaches the share sheet, which has no Contacts in it;
// downloaded, it lands in Files.
//
// It stores nothing and reads nothing. The staff page posts the card it has already built
// (so no rider's details ever sit in a URL or a log line) and gets the same bytes back with
// the headers iOS needs. It answers only the site's own pages, and only a body shaped like a
// vCard, so it cannot be used to serve anything else from this address.
const MAX = 32 * 1024;

export async function onRequestPost({ request }) {
  const self = new URL(request.url).origin;
  const site = request.headers.get('sec-fetch-site');
  if (!(site === 'same-origin' || request.headers.get('origin') === self)) {
    return text('Not allowed', 403);
  }

  let form;
  try { form = await request.formData(); } catch { return text('Bad request', 400); }
  const vcf = String(form.get('vcf') || '').replace(/^\uFEFF/, ''); // a byte-order mark is what several parsers choke on
  if (vcf.length > MAX || !/^BEGIN:VCARD\r?\n[\s\S]*\r?\nEND:VCARD\s*$/.test(vcf)) {
    return text('Not a contact card', 400);
  }

  // The file name Safari shows: the rider's name, letters (Arabic included), digits, spaces,
  // dots and dashes only, and an ASCII copy for the plain filename= parameter.
  const name = String(form.get('name') || '').replace(/[^\w\u0600-\u06FF .-]/g, '').trim().slice(0, 40) || 'contact';
  const ascii = name.replace(/[^\x20-\x7E]/g, '').trim() || 'contact';
  return new Response(vcf, {
    status: 200,
    headers: {
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': `inline; filename="${ascii}.vcf"; filename*=UTF-8''${encodeURIComponent(name)}.vcf`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

function text(body, status) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
