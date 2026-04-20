import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

const GITLAB_HOST = 'https://gitlab.com';

interface GitLabUser {
  id: number;
  username: string;
  avatar_url: string;
}

export const gitlabAuth = onRequest(async (req, res): Promise<void> => {
  const { code } = req.query as { code?: string };
  const { GITLAB_CLIENT_ID: CLIENT_ID = '', GITLAB_CLIENT_SECRET: CLIENT_SECRET = '', GITLAB_REDIRECT_URI: REDIRECT_URI = '' } = process.env;

  try {
    if (CLIENT_ID === '' || CLIENT_SECRET === '' || REDIRECT_URI === '') {
      throw new TypeError('GitLab OAuth configuration is missing');
    }

    if (!code) {
      const authUrl = new URL('/oauth/authorize', GITLAB_HOST);
      authUrl.searchParams.set('client_id', CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'read_user');
      const url = authUrl.toString();

      res.redirect(url);
      return;
    }

    const accessToken = await getAccessToken(code);
    const user = await getUserData(accessToken);
    const firebaseToken = await createCustomToken(user);

    res.set('Content-Type', 'text/html');

    res.send(`
      <script>
          window.opener.postMessage({ token: '${firebaseToken}' }, '*');
          window.close();
      </script>
    `);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).send('Authentication failed');
    return;
  }
});

const getAccessToken = async (code: string): Promise<string> => {
  const { GITLAB_CLIENT_ID: CLIENT_ID = '', GITLAB_CLIENT_SECRET: CLIENT_SECRET = '' } = process.env;

  const tokenUrl = new URL('/oauth/token', GITLAB_HOST).toString();

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GITLAB_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const { access_token } = await response.json();

  return access_token;
}

const getUserData = async (accessToken: string) => {
  const userUrl = new URL('/api/v4/user', GITLAB_HOST).toString();

  const response = await fetch(userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user data');
  }

  return await response.json();
};

const createCustomToken = async (user: GitLabUser) => {
  return await admin.auth().createCustomToken(`gitlab:${user.id}`, {
    username: user.username,
    name: user.username,
    avatar: user.avatar_url,
    provider: 'gitlab',
  });
};