// discord-oauth-start.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const REDIRECT_URI = Deno.env.get('DISCORD_REDIRECT_URI')!;

serve(async (req) => {
  const url = new URL(req.url);
  const monitorId = url.searchParams.get('monitorId');
  
  if (!monitorId) {
    return new Response('Monitor ID is required', { status: 400 });
  }
  
  // Create state parameter with monitorId to prevent CSRF and pass monitorId
  const state = btoa(JSON.stringify({ monitorId }));
  
  // Redirect to Discord OAuth
  const discordUrl = new URL('https://discord.com/oauth2/authorize');
  discordUrl.searchParams.set('client_id', CLIENT_ID);
  discordUrl.searchParams.set('scope', 'webhook.incoming');
  discordUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  discordUrl.searchParams.set('response_type', 'code');
  discordUrl.searchParams.set('state', state);
  
  return new Response('', {
    status: 302,
    headers: {
      'Location': discordUrl.toString()
    }
  });
})
