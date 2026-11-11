const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';

function getMsConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const port = process.env.PORT || 5001;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${port}/api/auth/microsoft/callback`;

  const configured = Boolean(
    clientId &&
      clientSecret &&
      !clientId.includes('your-azure') &&
      !clientId.includes('your_microsoft')
  );

  return { clientId, clientSecret, redirectUri, tenant: TENANT_ID, configured };
}

export function isMicrosoftOAuthConfigured() {
  return getMsConfig().configured;
}

export function buildMicrosoftAuthUrl(loginHint = '') {
  const { clientId, redirectUri, tenant, configured } = getMsConfig();
  if (!configured) {
    throw new Error('Microsoft OAuth is not configured in server/.env');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email offline_access User.Read Mail.Read',
    prompt: 'select_account',
  });

  if (loginHint && loginHint.includes('@')) {
    params.set('login_hint', loginHint.trim());
  }

  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCodeForTokens(code) {
  const { clientId, clientSecret, redirectUri, tenant, configured } = getMsConfig();
  if (!configured) {
    throw new Error('Microsoft OAuth not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'openid profile email offline_access User.Read Mail.Read',
  });

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await tokenRes.json();
  if (!tokenRes.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Microsoft token exchange failed');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

export async function refreshMicrosoftTokens(refreshToken) {
  const { clientId, clientSecret, redirectUri, tenant, configured } = getMsConfig();
  if (!configured || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    redirect_uri: redirectUri,
    grant_type: 'refresh_token',
    scope: 'openid profile email offline_access User.Read Mail.Read',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) return null;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };
}

export async function fetchMicrosoftProfileEmail(accessToken) {
  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const rawEmail = data.mail || data.userPrincipalName || '';
  return rawEmail ? rawEmail.trim().toLowerCase() : null;
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchMicrosoftMessages(tokens, limit = 15) {
  let activeTokens = { ...tokens };

  // Refresh if near expiry
  if (activeTokens.expiry_date && Date.now() > activeTokens.expiry_date - 60000 && activeTokens.refresh_token) {
    const refreshed = await refreshMicrosoftTokens(activeTokens.refresh_token);
    if (refreshed) activeTokens = refreshed;
  }

  const maxItems = Math.max(1, Math.min(Number(limit) || 15, 25));
  const url = `https://graph.microsoft.com/v1.0/me/messages?$top=${maxItems}&$orderby=receivedDateTime desc&$select=id,internetMessageId,subject,from,toRecipients,receivedDateTime,body,bodyPreview,hasAttachments,isRead`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${activeTokens.access_token}` },
  });

  // One retry after refresh if 401
  if (res.status === 401 && activeTokens.refresh_token) {
    const refreshed = await refreshMicrosoftTokens(activeTokens.refresh_token);
    if (refreshed) {
      activeTokens = refreshed;
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${activeTokens.access_token}` },
      });
    }
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Microsoft Graph API error (${res.status})`);
  }

  const messages = (data.value || []).map((msg) => {
    const senderName = msg.from?.emailAddress?.name || '';
    const senderAddr = msg.from?.emailAddress?.address || 'unknown@outlook.com';
    const sender = senderName ? `${senderName} <${senderAddr}>` : senderAddr;
    const recipient = msg.toRecipients?.[0]?.emailAddress?.address?.toLowerCase() || null;

    let bodyText = msg.bodyPreview || '';
    if (msg.body?.content) {
      bodyText =
        msg.body.contentType === 'html'
          ? stripHtml(msg.body.content)
          : String(msg.body.content).trim();
    }

    return {
      external_id: msg.internetMessageId || msg.id,
      recipient,
      sender,
      senderName: senderName || senderAddr.split('@')[0],
      subject: msg.subject || 'No Subject',
      body: bodyText || 'Empty correspondence body.',
      receivedAt: msg.receivedDateTime || new Date().toISOString(),
      attachments: [],
      is_read: Boolean(msg.isRead),
    };
  });

  return { messages, tokens: activeTokens };
}

