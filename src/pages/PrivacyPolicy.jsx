import React from 'react';
import { Cookie, Database, Globe2, Mail, ShieldCheck, Trash2 } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';
import Tag from '../components/ui/Tag';
import Footer from '../components/Footer';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const UPDATED = '19 October 2026';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

const Section = ({ id, icon: Icon, title, children }) => (
  <Panel as="section" id={id} className="scroll-mt-20" bodyClassName="space-y-3 p-5 text-sm leading-relaxed text-mist sm:p-6">
    <h2 className="flex items-center gap-2.5 font-display text-xl font-bold uppercase tracking-wide text-snow">
      <Icon size={18} className="text-signal" /> {title}
    </h2>
    {children}
  </Panel>
);

const Item = ({ label, children }) => (
  <li className="border-l-2 border-ink-600 pl-3">
    <span className="font-semibold text-snow">{label}</span> — {children}
  </li>
);

// What the app stores and shares, written from what the code actually does
const PrivacyPolicy = () => {
  useDocumentTitle('Privacy');

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-5 py-8 sm:py-12">
        <header className="space-y-3">
          <Tag tone="signal" icon={ShieldCheck}>Privacy</Tag>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none sm:text-5xl">Your data in Auction Arena</h1>
          <p className="text-mist">
            Auction Arena is a free game for running IPL auctions with friends. It keeps only what it needs to run your
            auctions, shows no ads, has no analytics or tracking, and never sells data. Last updated {UPDATED}.
          </p>
        </header>

        <Section id="what-we-store" icon={Database} title="What we store">
          <ul className="space-y-2">
            <Item label="Your account">
              your display name. With email sign-in, your email address and a securely hashed password (we never see or
              store the password itself). With Google sign-in, your name, email address, Google account ID and profile
              photo link. Guest accounts store only the name you type.
            </Item>
            <Item label="Your auctions">
              rooms you create or join, the franchise you manage, the players you buy and what you paid, chat messages
              and GIF links you send, your fantasy XI picks, and AI power rankings generated for finished rooms.
            </Item>
            <Item label="Sign-in sessions">
              a record of each active session, stored only as a one-way hash, so we can keep you signed in and let you
              sign out.
            </Item>
          </ul>
          <p>
            Other managers in a room see your display name, franchise, squad and chat messages. If a host lists a room in
            Open rooms, the listing shows only the host&rsquo;s display name, and players bought by people in that room can
            appear in the &ldquo;Just sold&rdquo; strip on the home page (player, franchise and price only). Sales in private
            rooms are never shown publicly.
          </p>
        </Section>

        <Section id="cookies" icon={Cookie} title="Cookies and browser storage">
          <p>
            We use two cookies, both needed to keep you signed in: a sign-in cookie that lasts 15 minutes and a session
            cookie that lasts 7 days and renews it. Both are hidden from page scripts (httpOnly) and are only sent over
            HTTPS on the live site. There are no advertising or tracking cookies.
          </p>
          <p>
            Your browser also remembers a few settings on your device only: voice auctioneer and sound preferences,
            the last dashboard tab you opened, and whether you&rsquo;ve seen the intro. These never leave your device.
          </p>
        </Section>

        <Section id="third-parties" icon={Globe2} title="Services we rely on">
          <ul className="space-y-2">
            <Item label="Google">signs you in if you choose Google. Google shares your name, email and profile photo with us.</Item>
            <Item label="GIPHY">powers GIF search in chat. When you open the GIF picker, your search words go straight from your browser to GIPHY.</Item>
            <Item label="Groq">writes the AI power rankings. It receives only the squads, prices and player stats from the auction — never names, emails or chat.</Item>
            <Item label="CricAPI">supplies real match scorecards for fantasy points. No user data is sent.</Item>
            <Item label="Hosting">the app runs on Render and the database on Neon. Player photos and team logos load from the IPL website, ESPNcricinfo and Wikimedia Commons, and fonts from Google Fonts, so those sites see your IP address when the images and fonts load.</Item>
          </ul>
        </Section>

        <Section id="your-choices" icon={Trash2} title="Keeping and deleting data">
          <p>
            Your data is kept while your account exists so your auction history, squads and fantasy league keep working.
            You can remove any finished auction from your own history at any time from the History tab. To delete your
            account and everything linked to it, contact us using the details below and we&rsquo;ll do it within 30 days.
          </p>
          <p>Auction Arena isn&rsquo;t aimed at children under 13.</p>
        </Section>

        <Section id="contact" icon={Mail} title="Contact">
          {CONTACT_EMAIL ? (
            <p>
              Questions or deletion requests: <a className="font-semibold text-signal hover:text-cyan-300" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          ) : (
            <p>Questions or deletion requests: use the support email shown on the Google sign-in screen, or contact the person who runs this site.</p>
          )}
          <p>If this policy changes, the date at the top will change with it.</p>
        </Section>

        <Footer />
      </div>
    </PageShell>
  );
};

export default PrivacyPolicy;
