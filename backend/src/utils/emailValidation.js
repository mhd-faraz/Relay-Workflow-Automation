const isValidEmail = (email) => {
  if (typeof email !== 'string' || email.length > 254) return false;
  const normalizedEmail = email.trim();
  const [localPart, domain, ...extraParts] = normalizedEmail.split('@');
  if (!localPart || !domain || extraParts.length > 0 || localPart.length > 64) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;

  const validLocalPart = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart);
  const validDomain = domain.length <= 253
    && domain.split('.').length >= 2
    && domain.split('.').every((label) =>
      label.length > 0
      && label.length <= 63
      && /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label)
    );

  return validLocalPart && validDomain;
};

module.exports = { isValidEmail };
