const { isValidEmail } = require('../src/utils/emailValidation');

describe('Email address validation', () => {
  test.each([
    'person@example.com',
    'first.last+relay@sub.example.co.in',
    ' person@example.com ',
  ])('accepts valid email syntax: %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  test.each([
    'not-an-email',
    'missing-domain@',
    '@missing-local.com',
    'person@localhost',
    'person..name@example.com',
    'person@-example.com',
    null,
  ])('rejects invalid email syntax: %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
