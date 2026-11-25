export function formatPepChannelRu(channel?: string, verificationMethod?: string): string {
  const ch = String(channel || '').toLowerCase();
  const vm = String(verificationMethod || '').toLowerCase();
  if (ch === 'both' || vm.includes('hybrid')) return 'Email + Telegram OTP';
  if (ch === 'telegram' || vm.includes('telegram')) return 'Telegram OTP';
  return 'Email OTP';
}

export function downloadPepCertificate(sig: {
  id?: string;
  documentTitle?: string;
  documentType?: string;
  lotCode?: string;
  userName?: string;
  userEmail?: string;
  signedAt?: string;
  documentTextHashSha256?: string;
  docHashSha256?: string;
  deliveryChannel?: string;
  verificationMethod?: string;
  ipHash?: string;
}) {
  const docTitle =
    sig.documentTitle ||
    (sig.documentType === 'nda_viewing_act'
      ? 'Акт просмотра и NDA (ПЭП 63-ФЗ)'
      : sig.documentType === 'seller_exclusive_consent'
      ? 'Согласие продавца на сопровождение (ПЭП 63-ФЗ)'
      : 'Оферта бронирования 2.5% (ПЭП 63-ФЗ)');
  const hash = sig.documentTextHashSha256 || sig.docHashSha256 || '—';
  const channelLabel = formatPepChannelRu(sig.deliveryChannel, sig.verificationMethod);
  const signedDate = sig.signedAt ? new Date(sig.signedAt).toLocaleString('ru-RU') : '—';
  const sigId = sig.id || `pep-${sig.lotCode || 'doc'}`;

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Сертификат ПЭП 63-ФЗ — ${sigId}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 32px; }
  .card { max-width: 720px; margin: 0 auto; background: #fff; border: 2px solid #10b981; border-radius: 16px; padding: 28px 32px; box-shadow: 0 10px 30px rgba(15,23,42,.08); }
  .badge { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; letter-spacing: .04em; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 12px 0 4px; }
  .sub { font-size: 13px; color: #475569; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.label { width: 38%; color: #64748b; font-weight: 600; }
  td.val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; word-break: break-all; }
  .note { margin-top: 20px; padding: 14px; background: #f1f5f9; border-radius: 10px; font-size: 12px; color: #334155; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">ПЭП • Федеральный закон № 63-ФЗ</span>
    <h1>Сертификат простой электронной подписи</h1>
    <div class="sub">Платформа безопасных сделок с недвижимостью DomExit</div>
    <table>
      <tr><td class="label">Реестровый ID подписи</td><td class="val">${sigId}</td></tr>
      <tr><td class="label">Документ</td><td class="val">${docTitle}</td></tr>
      <tr><td class="label">Объект / Лот</td><td class="val">#${sig.lotCode || '—'}</td></tr>
      <tr><td class="label">Подписант</td><td class="val">${sig.userName || 'Пользователь DomExit'}${sig.userEmail ? ` (${sig.userEmail})` : ''}</td></tr>
      <tr><td class="label">Дата и время (МСК)</td><td class="val">${signedDate}</td></tr>
      <tr><td class="label">Канал подтверждения OTP</td><td class="val">${channelLabel}</td></tr>
      <tr><td class="label">SHA-256 хеш текста</td><td class="val">${hash}</td></tr>
      ${sig.ipHash ? `<tr><td class="label">Хеш IP-адреса</td><td class="val">${sig.ipHash}</td></tr>` : ''}
    </table>
    <div class="note">
      Настоящий сертификат подтверждает факт подписания электронного документа простой электронной подписью (ПЭП) в соответствии со статьями 5, 6 и 9 Федерального закона № 63-ФЗ «Об электронной подписи». Подпись признаётся равнозначной собственноручной подписи на бумажном носителе.
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PEP_Certificate_${sig.lotCode || 'doc'}_${sigId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
