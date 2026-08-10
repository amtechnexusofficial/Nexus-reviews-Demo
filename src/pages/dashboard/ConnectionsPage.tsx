import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link2, Unplug, CheckCircle2, MessageSquare } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { publishApi } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

// Bluesky and Telegram aren't OAuth — Postproxy connects them in one call
// using credentials the owner pastes in, so they get a small form instead of
// a redirect.
type AuthKind = 'oauth' | 'app_password' | 'bot_token';

const PLATFORM_META: Record<
  string,
  { label: string; description: string; dmCapable?: boolean; auth?: AuthKind }
> = {
  google_business: {
    label: 'Google Business',
    description: 'Sync reviews and publish Google Business posts, events, and offers.',
  },
  instagram: {
    label: 'Instagram',
    description: 'Publish posts and carousels, and reply to DMs.',
    dmCapable: true,
  },
  facebook: {
    label: 'Facebook',
    description: 'Publish to your Page and reply to Messenger DMs.',
    dmCapable: true,
  },
  twitter: {
    label: 'Twitter / X',
    description: 'Publish posts with up to 4 images.',
  },
  linkedin: {
    label: 'LinkedIn',
    description: 'Publish company or personal posts.',
  },
  threads: {
    label: 'Threads',
    description: 'Publish text and image posts.',
  },
  pinterest: {
    label: 'Pinterest',
    description: 'Publish pins (requires one image per pin).',
  },
  bluesky: {
    label: 'Bluesky',
    description: 'Publish posts and reply to DMs.',
    dmCapable: true,
    auth: 'app_password',
  },
  telegram: {
    label: 'Telegram',
    description: 'Publish to channels and reply to DMs.',
    dmCapable: true,
    auth: 'bot_token',
  },
};

interface Connection {
  id: string;
  name: string;
  platform: string;
  status: string;
}

export default function ConnectionsPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [postproxyConfigured, setPostproxyConfigured] = useState(false);
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [gbLocationId, setGbLocationId] = useState('');
  const [savingGbLocation, setSavingGbLocation] = useState(false);

  const [facebookPageId, setFacebookPageId] = useState('');
  const [facebookPlacements, setFacebookPlacements] = useState<{ id: string; name?: string }[]>([]);
  const [savingFacebookPage, setSavingFacebookPage] = useState(false);

  const [credentialForm, setCredentialForm] = useState<string | null>(null);
  const [blueskyHandle, setBlueskyHandle] = useState('');
  const [blueskyAppPassword, setBlueskyAppPassword] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [nextStep, setNextStep] = useState<string | null>(null);

  useEffect(() => {
    publishApi.status().then((s) => {
      setPostproxyConfigured(s.postproxyConfigured);
      setSupportedPlatforms(s.supportedPlatforms || Object.keys(PLATFORM_META));
    });
  }, []);

  useEffect(() => {
    if (locationId) loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      const label = PLATFORM_META[connected]?.label || connected;
      showSuccess(`${label} connected.`);
      setSearchParams({}, { replace: true });
      if (locationId) loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadConnections() {
    if (!locationId) return;
    setLoading(true);
    try {
      const { profiles, error, facebookPageId: savedPage, facebookPlacements: pages, googleLocationId } =
        await publishApi.connections(locationId);
      setConnections(profiles);
      setFacebookPlacements(pages || []);
      setFacebookPageId(savedPage || '');
      if (googleLocationId) setGbLocationId(googleLocationId);
      if (error) showError(error);
    } catch (e: any) {
      setConnections([]);
      setFacebookPlacements([]);
      showError(e.message || 'Could not load your connections.');
    } finally {
      setLoading(false);
    }
  }

  function connectionFor(platform: string) {
    return connections.find((c) => c.platform === platform && c.status === 'active');
  }

  async function connect(platform: string) {
    if (!locationId) return;
    const auth = PLATFORM_META[platform]?.auth || 'oauth';

    if (auth !== 'oauth' && credentialForm !== platform) {
      setCredentialForm(platform);
      return;
    }

    setConnecting(platform);
    try {
      const params =
        auth === 'app_password'
          ? { identifier: blueskyHandle.trim(), appPassword: blueskyAppPassword.trim() }
          : auth === 'bot_token'
          ? { botToken: telegramBotToken.trim() }
          : { redirectUrl: `${window.location.origin}/dashboard/connections?connected=${platform}` };

      const { url, connected, nextStep: step } = await publishApi.connect(locationId, platform, params);

      if (url) {
        window.location.href = url;
        return;
      }

      if (connected) {
        showSuccess(`${PLATFORM_META[platform]?.label || platform} connected.`);
        setCredentialForm(null);
        setBlueskyHandle('');
        setBlueskyAppPassword('');
        setTelegramBotToken('');
        setNextStep(step || null);
        await loadConnections();
      } else {
        showError('Postproxy did not return a connection — try again.');
      }
    } catch (e: any) {
      showError(e.message || 'Could not start connection.');
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(platform: string) {
    if (!locationId) return;
    const conn = connectionFor(platform);
    if (!conn) return;
    setDisconnecting(platform);
    try {
      await publishApi.disconnect(locationId, conn.id);
      await loadConnections();
      showSuccess(`Disconnected ${PLATFORM_META[platform]?.label || platform}.`);
    } catch (e: any) {
      showError(e.message || 'Disconnect failed.');
    } finally {
      setDisconnecting(null);
    }
  }

  async function saveGoogleLocationId() {
    if (!locationId || !gbLocationId.trim()) return;
    setSavingGbLocation(true);
    try {
      await publishApi.saveGoogleLocation(locationId, gbLocationId.trim());
      showSuccess('Google location saved.');
    } catch (e: any) {
      showError(e.message || 'Could not save Google location.');
    } finally {
      setSavingGbLocation(false);
    }
  }

  async function saveFacebookPage() {
    if (!locationId || !facebookPageId.trim()) return;
    setSavingFacebookPage(true);
    try {
      await publishApi.saveFacebookPage(locationId, facebookPageId.trim());
      showSuccess('Facebook Page saved.');
    } catch (e: any) {
      showError(e.message || 'Could not save Facebook Page.');
    } finally {
      setSavingFacebookPage(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const connectedCount = supportedPlatforms.filter((p) => connectionFor(p)).length;

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold mb-1">Connections</h1>
        <p className="text-sm text-ink-soft">
          Link your social accounts so you can sync reviews, publish content, and reply to DMs from one place.
        </p>
      </div>

      {!postproxyConfigured && (
        <div className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-lg p-3">
          Publishing isn't configured yet — add <code>POSTPROXY_API_KEY</code> to enable platform connections.
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <Badge tone={connectedCount > 0 ? 'success' : 'neutral'}>
          {connectedCount} of {supportedPlatforms.length} connected
        </Badge>
        {loading && <span>Refreshing…</span>}
      </div>

      {nextStep && (
        <div className="text-xs text-ink bg-white/60 border border-line rounded-lg p-3">{nextStep}</div>
      )}

      <div className="space-y-3">
        {supportedPlatforms.map((platform) => {
          const meta = PLATFORM_META[platform] || {
            label: platform,
            description: 'Connect this account to publish from the Content page.',
          };
          const conn = connectionFor(platform);
          const isConnected = Boolean(conn);

          return (
            <Card key={platform} className="!p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    isConnected
                      ? 'bg-gradient-to-br from-brand/15 to-brand-2/15 text-brand'
                      : 'bg-white/70 text-ink-soft'
                  }`}
                >
                  {isConnected ? <CheckCircle2 className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h2 className="font-semibold text-sm">{meta.label}</h2>
                    {isConnected ? (
                      <Badge tone="success">Connected</Badge>
                    ) : (
                      <Badge tone="neutral">Not connected</Badge>
                    )}
                    {meta.dmCapable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-soft">
                        <MessageSquare className="w-3 h-3" /> DMs
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mb-3">{meta.description}</p>
                  {isConnected && conn?.name && (
                    <p className="text-xs text-ink-soft mb-3 truncate">Account: {conn.name}</p>
                  )}

                  {isConnected ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => disconnect(platform)}
                      loading={disconnecting === platform}
                    >
                      <Unplug className="w-3.5 h-3.5" /> Disconnect
                    </Button>
                  ) : (
                    <>
                      {credentialForm === platform && meta.auth === 'app_password' && (
                        <div className="space-y-2 mb-3">
                          <input
                            value={blueskyHandle}
                            onChange={(e) => setBlueskyHandle(e.target.value)}
                            placeholder="yourname.bsky.social"
                            className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                          />
                          <input
                            type="password"
                            value={blueskyAppPassword}
                            onChange={(e) => setBlueskyAppPassword(e.target.value)}
                            placeholder="App password (xxxx-xxxx-xxxx-xxxx)"
                            className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                          />
                          <p className="text-xs text-ink-soft">
                            Generate one at{' '}
                            <a
                              href="https://bsky.app/settings/app-passwords"
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand underline"
                            >
                              bsky.app/settings/app-passwords
                            </a>{' '}
                            — not your main password.
                          </p>
                        </div>
                      )}

                      {credentialForm === platform && meta.auth === 'bot_token' && (
                        <div className="space-y-2 mb-3">
                          <input
                            type="password"
                            value={telegramBotToken}
                            onChange={(e) => setTelegramBotToken(e.target.value)}
                            placeholder="123456789:ABCdef-GhIJklMnOpQrStUvWxYz"
                            className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                          />
                          <p className="text-xs text-ink-soft">
                            Create a bot with{' '}
                            <a
                              href="https://t.me/BotFather"
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand underline"
                            >
                              @BotFather
                            </a>{' '}
                            and paste its token. Then add the bot as an admin to each channel you post to.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => connect(platform)}
                          loading={connecting === platform}
                          disabled={!postproxyConfigured}
                        >
                          <Link2 className="w-3.5 h-3.5" /> Connect {meta.label}
                        </Button>
                        {credentialForm === platform && (
                          <Button size="sm" variant="ghost" onClick={() => setCredentialForm(null)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </>
                  )}

                  {platform === 'facebook' && isConnected && (
                    <div className="mt-4 pt-3 border-t border-line">
                      <label className="block text-xs font-medium mb-1.5">
                        Facebook Page to publish to{' '}
                        <span className="font-normal text-ink-soft">(required — Postproxy has no default Page)</span>
                      </label>
                      {facebookPlacements.length === 0 ? (
                        <p className="text-xs text-ink-soft">
                          No Pages found yet on this Facebook connection. Make sure you granted access to a Page during
                          OAuth, then refresh. Messenger DMs also only work for Pages with messaging enabled.
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={facebookPageId}
                            onChange={(e) => setFacebookPageId(e.target.value)}
                            className="flex-1 border border-line rounded-lg p-2 text-sm focus:border-brand outline-none bg-white"
                          >
                            <option value="">Select a Page…</option>
                            {facebookPlacements.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name || p.id}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={saveFacebookPage}
                            loading={savingFacebookPage}
                            disabled={!facebookPageId.trim()}
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {platform === 'google_business' && isConnected && (
                    <div className="mt-4 pt-3 border-t border-line">
                      <label className="block text-xs font-medium mb-1.5">
                        Google location resource path{' '}
                        <span className="font-normal text-ink-soft">
                          (from Postproxy placements — looks like{' '}
                          <code className="bg-paper px-1 rounded">accounts/123/locations/456</code>)
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={gbLocationId}
                          onChange={(e) => setGbLocationId(e.target.value)}
                          placeholder="accounts/123456789/locations/987654321"
                          className="flex-1 border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={saveGoogleLocationId}
                          loading={savingGbLocation}
                          disabled={!gbLocationId.trim()}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
