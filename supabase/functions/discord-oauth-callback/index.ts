// discord-oauth-callback.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!;
const REDIRECT_URI = Deno.env.get('DISCORD_REDIRECT_URI')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }
  
  try {
    // Decode state to get monitorId
    const { monitorId } = JSON.parse(atob(state));
    
    if (!monitorId) {
      return new Response('Invalid state parameter', { status: 400 });
    }
    
    // Exchange code for token and webhook
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.webhook || !tokenData.webhook.url) {
      return new Response('Failed to obtain webhook', { status: 500 });
    }

    // Extract server name and channel name from webhook data
    const serverName = tokenData.webhook.guild_id || 'Unknown Server';
    const channelName = tokenData.webhook.channel_id ? 
      `#${tokenData.webhook.name}` : 'Unknown Channel';
    
    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get current monitor data
    const { data: monitor, error: fetchError } = await supabase
      .from('monitors')
      .select('settings')
      .eq('id', monitorId)
      .single();
    
    if (fetchError) {
      return new Response(`Error fetching monitor: ${fetchError.message}`, { status: 500 });
    }
    
    // Update monitor settings with webhook
    const settings = monitor.settings || {};
    
    // Ensure notifications array exists
    if (!settings.notifications) {
      settings.notifications = [];
    }
    
    // Find existing Discord notification or create new one
    const discordIndex = settings.notifications.findIndex(n => n.method === 'discord');
    
    if (discordIndex >= 0) {
      // Update existing Discord notification
      settings.notifications[discordIndex].webhookUrl = tokenData.webhook.url;
      settings.notifications[discordIndex].serverName = serverName;
      settings.notifications[discordIndex].channelName = channelName;
      settings.notifications[discordIndex].enabled = true;
    } else {
      // Add new Discord notification
      settings.notifications.push({
        method: 'discord',
        enabled: true,
        webhookUrl: tokenData.webhook.url,
        serverName: serverName,
        channelName: channelName
      });
    }
    
    // Make sure notify is enabled
    settings.notify = true;
    
    // Update the monitor
    const { error: updateError } = await supabase
      .from('monitors')
      .update({ settings })
      .eq('id', monitorId);
    
    if (updateError) {
      return new Response(`Error updating monitor: ${updateError.message}`, { status: 500 });
    }
  
  // Redirect to our auto-close page that will close the window and notify the opener
  const hostUrl = new URL(req.url).origin;
  return Response.redirect('http://localhost:8080/auto-close.html', 302);
  } catch (err) {
    console.error('Error in Discord OAuth callback:', err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
})