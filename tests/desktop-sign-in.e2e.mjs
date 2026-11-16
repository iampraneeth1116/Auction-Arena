// End-to-end: Google sign-in for the desktop app, which happens in the person's own browser,
// against a test server with a stand-in for Google (fakeGoogle.mjs). Covers the trip to Google
// and back, the one-time code, the secret only the app holds, the return page's error cases,
// and that the website's own Google popup sign-in still works.
import crypto from 'node:crypto';
import { TestClient, createChecker, startServer } from './helpers.mjs';
import { prisma } from '../server/db.js';
import { issueDesktopCode, redeemDesktopCode, startDesktopSignIn, takeDesktopSignIn } from '../server/auth/desktopSignIn.js';

const { check, failedCount, printSummary } = createChecker();
const FAKE_GOOGLE = new URL('./fakeGoogle.mjs', import.meta.url).href;
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const RUN = Date.now();
const email = (name) => `${name}-${RUN}@example.test`;

// What the app does: a secret (verifier) and the fingerprint it sends (challenge)
const newSecret = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
};

const servers = [];
try {
  const server = await startServer({
    port: 3095,
    env: { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: 'test-secret', NODE_OPTIONS: `--import=${FAKE_GOOGLE}` },
  });
  servers.push(server);
  const CALLBACK = `${server.url}/api/auth/google/desktop/callback`;

  // Where the server sends the browser, without following it
  const visit = async (path) => {
    const res = await fetch(server.url + path, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') ?? '' };
  };
  // The return page's address: its path and what follows the #
  const returnPage = (location) => {
    const [path, hash = ''] = location.split('#');
    return { path, outcome: Object.fromEntries(new URLSearchParams(hash)) };
  };
  const start = async (challenge) => new URL((await visit(`/api/auth/google/desktop?challenge=${challenge}`)).location);
  // The browser's whole trip: to Google, which signs in googleCode's account, and back
  const signInInBrowser = async (challenge, googleCode) => {
    const state = (await start(challenge)).searchParams.get('state');
    return returnPage((await visit(`/api/auth/google/desktop/callback?state=${state}&code=${encodeURIComponent(googleCode)}`)).location);
  };

  // ─── Off to Google ───
  const app = newSecret();
  const first = await visit(`/api/auth/google/desktop?challenge=${app.challenge}`);
  const google = new URL(first.location);
  const params = Object.fromEntries(google.searchParams);
  check('starting sends the browser to Google\'s sign-in page', first.status === 303 && google.origin === 'https://accounts.google.com', first.location);
  check('…for this site\'s Google client, coming back to the desktop callback',
    params.client_id === CLIENT_ID && params.redirect_uri === CALLBACK && params.response_type === 'code', JSON.stringify(params));
  check('…asking only for the account\'s name, email and picture, with an account chooser',
    params.scope?.split(' ').sort().join(' ') === 'email openid profile' && params.prompt === 'select_account', JSON.stringify(params));
  check('…with a one-time state, and never the app\'s challenge', /^[\w-]{43}$/.test(params.state ?? '') && !first.location.includes(app.challenge));

  for (const [label, query] of [['no challenge', ''], ['a challenge of the wrong shape', '?challenge=abc']]) {
    const sent = await visit(`/api/auth/google/desktop${query}`);
    const page = returnPage(sent.location);
    check(`starting with ${label} goes to the return page saying it failed`, sent.status === 303 && page.path === '/desktop-sign-in' && page.outcome.error === 'failed', sent.location);
  }

  // ─── Back from Google, the ways it can go wrong ───
  const madeUp = returnPage((await visit(`/api/auth/google/desktop/callback?state=${'x'.repeat(43)}&code=fake:a:b@example.test`)).location);
  check('coming back with a state the server never gave says the sign-in expired', madeUp.outcome.error === 'expired', JSON.stringify(madeUp));

  const cancelState = (await start(newSecret().challenge)).searchParams.get('state');
  const cancelled = returnPage((await visit(`/api/auth/google/desktop/callback?state=${cancelState}&error=access_denied`)).location);
  check('cancelling at Google says it was cancelled', cancelled.outcome.error === 'cancelled', JSON.stringify(cancelled));
  const again = returnPage((await visit(`/api/auth/google/desktop/callback?state=${cancelState}&code=fake:a:b@example.test`)).location);
  check('a state works once: coming back with it again says expired', again.outcome.error === 'expired', JSON.stringify(again));

  const refused = await signInInBrowser(newSecret().challenge, 'not-a-real-code');
  check('a code Google refuses says it failed', refused.outcome.error === 'failed', JSON.stringify(refused));
  const unverified = await signInInBrowser(newSecret().challenge, `fake:unverified-${RUN}:${email('unverified')}:unverified`);
  check('a Google account with an unverified email says so', unverified.outcome.error === 'unverified', JSON.stringify(unverified));
  check('no account is made for the unverified email', !(await prisma.user.findUnique({ where: { email: email('unverified') } })));

  // ─── Signed in: the code goes back to the app ───
  const googleCode = `fake:desk-${RUN}:${email('desk')}`;
  const back = await signInInBrowser(app.challenge, googleCode);
  check('signing in at Google ends on the return page with a one-time code',
    back.path === '/desktop-sign-in' && /^[\w-]{43}$/.test(back.outcome.code ?? '') && !back.outcome.error, JSON.stringify(back));
  check('the server traded Google\'s code using the same callback address', server.logs().includes(`code exchanged {"redirectUri":"${CALLBACK}"}`), server.logs().slice(-500));

  const desktop = new TestClient(server.url);
  const finish = (client, body) => client.req('POST', '/api/auth/google/desktop/finish', body);

  const stranger = new TestClient(server.url);
  const someoneElse = await finish(stranger, { code: back.outcome.code, verifier: newSecret().verifier });
  check('the code is no use without the app\'s secret: another secret gets 401 and no session',
    someoneElse.status === 401 && someoneElse.setCookies.length === 0, JSON.stringify(someoneElse.data));
  const afterGuess = await finish(desktop, { code: back.outcome.code, verifier: app.verifier });
  check('…and a wrong guess uses the code up, even for the right secret afterwards', afterGuess.status === 401, JSON.stringify(afterGuess.data));

  const fresh = await signInInBrowser(app.challenge, googleCode);
  const signedIn = await finish(desktop, { code: fresh.outcome.code, verifier: app.verifier });
  check('the app trades the code and its secret for the Google account\'s session',
    signedIn.status === 200 && signedIn.data?.user?.email === email('desk') && signedIn.data.user.isGuest === false, JSON.stringify(signedIn.data));
  check('…with the same httpOnly cookies as any sign-in',
    signedIn.setCookies.some(c => c.startsWith('access_token=') && /HttpOnly/i.test(c)) && signedIn.setCookies.some(c => c.startsWith('refresh_token=')));
  const me = await desktop.req('GET', '/api/auth/me');
  check('…so the app is signed in as that account', me.status === 200 && me.data?.user?.id === signedIn.data.user.id, JSON.stringify(me.data));
  const reused = await finish(new TestClient(server.url), { code: fresh.outcome.code, verifier: app.verifier });
  check('a code signs in once only', reused.status === 401 && /expired/i.test(reused.data?.error ?? ''), JSON.stringify(reused.data));

  const twice = await signInInBrowser(app.challenge, googleCode);
  const sameAccount = await finish(new TestClient(server.url), { code: twice.outcome.code, verifier: app.verifier });
  check('the same Google account signs in to the same Auction Arena account', sameAccount.data?.user?.id === signedIn.data.user.id, JSON.stringify(sameAccount.data));

  const malformed = await finish(new TestClient(server.url), { code: 42 });
  check('finishing with a malformed body is refused with 400', malformed.status === 400, JSON.stringify(malformed));

  // ─── The website's popup sign-in, which now shares the Google account step ───
  const web = new TestClient(server.url);
  const popup = await web.req('POST', '/api/auth/google', { code: googleCode });
  check('the website\'s Google popup still signs in, to the same account', popup.status === 200 && popup.data?.user?.id === signedIn.data.user.id, JSON.stringify(popup.data));
  const popupRefused = await web.req('POST', '/api/auth/google', { code: 'not-a-real-code' });
  check('…and still says "Google sign-in failed" for a refused code', popupRefused.status === 401 && /Google sign-in failed/.test(popupRefused.data?.error), JSON.stringify(popupRefused.data));
  const popupUnverified = await web.req('POST', '/api/auth/google', { code: `fake:pu-${RUN}:${email('pu')}:unverified` });
  check('…and "not verified" for an unverified email', popupUnverified.status === 401 && /not verified/.test(popupUnverified.data?.error), JSON.stringify(popupUnverified.data));

  // ─── A server without Google set up ───
  const withoutGoogle = await startServer({ port: 3094, env: { GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' } });
  servers.push(withoutGoogle);
  const off = await fetch(`${withoutGoogle.url}/api/auth/google/desktop?challenge=${app.challenge}`, { redirect: 'manual' });
  check('without Google set up, the return page says it isn\'t available', returnPage(off.headers.get('location') ?? '').outcome.error === 'unavailable', off.headers.get('location'));

  // ─── Timing and limits (the store on its own, with the clock passed in) ───
  const now = 1_000_000;
  const state = startDesktopSignIn(app.challenge, CALLBACK, now);
  check('a sign-in left at Google for over 10 minutes has expired', takeDesktopSignIn(state, now + 10 * 60 * 1000 + 1) === null);
  const lateCode = issueDesktopCode('user-1', app.challenge, now);
  check('a code not used within 5 minutes has expired', redeemDesktopCode(lateCode, app.verifier, now + 5 * 60 * 1000 + 1) === null);
  const onTime = issueDesktopCode('user-1', app.challenge, now);
  check('a code used in time, with the secret, gives its user', redeemDesktopCode(onTime, app.verifier, now + 60 * 1000) === 'user-1');
  const later = now + 60 * 60 * 1000;
  const states = Array.from({ length: 1001 }, () => startDesktopSignIn(app.challenge, CALLBACK, later));
  check('at most 1000 sign-ins wait at once', states.slice(0, 1000).every(Boolean) && states[1000] === null);
  check('…and they make room again once they expire', startDesktopSignIn(app.challenge, CALLBACK, later + 10 * 60 * 1000 + 1) !== null);
} catch (err) {
  check(`unexpected error: ${err.stack}`, false);
} finally {
  for (const server of servers) await server.stop();
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${RUN}@example.test` } } });
  await prisma.$disconnect();
  printSummary();
  if (failedCount()) for (const server of servers) console.log(`\n--- server log ---\n${server.logs().slice(-2000)}`);
  process.exit(failedCount() ? 1 : 0);
}
