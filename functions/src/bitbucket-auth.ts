import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

const BITBUCKET_HOST = 'https://bitbucket.org';
const BITBUCKET_API_HOST = 'https://api.bitbucket.org/2.0';

interface BitbucketUser {
  uuid: string;
  username: string;
  display_name: string;
}

export const bitbucketAuth = onRequest(async (req, res): Promise<void> => {
  const { code } = req.query as { code?: string };

  const {
    BITBUCKET_CLIENT_ID: CLIENT_ID = '',
    BITBUCKET_CLIENT_SECRET: CLIENT_SECRET = '',
    BITBUCKET_REDIRECT_URI: REDIRECT_URI = '',
  } = process.env;

  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new TypeError('Bitbucket OAuth configuration is missing');
    }

    if (!code) {
      const authUrl = new URL('/site/oauth2/authorize', BITBUCKET_HOST);
      authUrl.searchParams.set('client_id', CLIENT_ID);
      authUrl.searchParams.set('response_type', 'code');
      const url = authUrl.toString();

      res.redirect(url);
      return;
    }

    const accessToken = await getAccessToken(code);
    const user = await getUserData(accessToken);
    const firebaseToken = await createCustomToken(user);

    // 🔹 Paso 5: responder al frontend
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
  const { BITBUCKET_CLIENT_ID: CLIENT_ID = '', BITBUCKET_CLIENT_SECRET: CLIENT_SECRET = '' } = process.env;

  const tokenUrl = new URL('/site/oauth2/access_token', BITBUCKET_HOST).toString();

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const { access_token } = await response.json();

  return access_token;
}

const getUserData = async (accessToken: string): Promise<BitbucketUser> => {
  const userUrl = new URL('/user', BITBUCKET_API_HOST).toString();

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

const createCustomToken = async (user: BitbucketUser) => {
  return await admin.auth().createCustomToken(
    `bitbucket:${user.uuid}`,
    {
      username: user.username ?? user.display_name,
      name: user.display_name,
      avatar: `${BITBUCKET_HOST}/account/${user.username}/avatar/`,
      provider: 'bitbucket',
    }
  );
};