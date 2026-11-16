// Loaded into a test server with NODE_OPTIONS=--import, never into the real one: stands in for
// Google, so Google sign-in can be tested without a Google account or the internet.
// The code "fake:<id>:<email>" signs in that Google account, "fake:<id>:<email>:unverified"
// one whose email isn't verified, and Google refuses anything else, like a made-up code.
import { OAuth2Client } from 'google-auth-library';

OAuth2Client.prototype.getToken = async function getToken(options) {
  const { code, redirect_uri: redirectUri } = typeof options === 'string' ? { code: options } : options;
  if (!code?.startsWith('fake:')) throw new Error('invalid_grant');
  // The test reads this back from the server log: Google only accepts the redirect address
  // the sign-in started with
  console.log(`[fake-google] code exchanged ${JSON.stringify({ redirectUri: redirectUri ?? null })}`);
  return { tokens: { id_token: code } };
};

OAuth2Client.prototype.verifyIdToken = async function verifyIdToken({ idToken }) {
  const [, sub, email, flag] = idToken.split(':');
  return {
    getPayload: () => ({ sub, email, email_verified: flag !== 'unverified', name: `Google ${sub}`, picture: null }),
  };
};
