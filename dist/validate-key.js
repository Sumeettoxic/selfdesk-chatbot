// validate-key.js - Deploy as serverless function
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key (environment variables)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const { apiKey, domain } = JSON.parse(event.body);
    
    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ valid: false, error: 'API key required' })
      };
    }
    
    // Hash the incoming API key to compare with stored hashes
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashedKey = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Look up the key
    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', hashedKey)
      .single();
    
    if (error || !keyData) {
      return {
        statusCode: 403,
        body: JSON.stringify({ valid: false, error: 'Invalid API key' })
      };
    }
    
    // Check if key is active
    if (!keyData.is_active) {
      return {
        statusCode: 403,
        body: JSON.stringify({ valid: false, error: 'API key is inactive' })
      };
    }
    
    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return {
        statusCode: 403,
        body: JSON.stringify({ valid: false, error: 'API key has expired' })
      };
    }
    
    // Check domain restrictions
    if (domain && keyData.domains && keyData.domains.length > 0) {
      const isAllowed = keyData.domains.some(pattern => {
        if (pattern === '*') return true;
        if (pattern.startsWith('*.')) {
          const suffix = pattern.substring(2);
          return domain.endsWith(suffix);
        }
        return domain === pattern;
      });
      
      if (!isAllowed) {
        return {
          statusCode: 403,
          body: JSON.stringify({ valid: false, error: 'Domain not authorized' })
        };
      }
    }
    
    // Update usage count
    await supabase
      .from('api_keys')
      .update({ usage_count: (keyData.usage_count || 0) + 1 })
      .eq('id', keyData.id);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ valid: false, error: 'Internal server error' })
    };
  }
}
