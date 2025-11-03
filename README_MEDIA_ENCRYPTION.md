# Media Encryption & Proxy System

## Overview

This system provides **encryption for media URLs** and a **proxy endpoint** to serve media through the backend, solving CORS issues and securing media access.

## Features

### 1. Media URL Encryption
- All media URLs (from Meta, WAHA) are **encrypted** before being stored in the database
- Uses AES-256-GCM encryption (same as secrets)
- Prevents unauthorized access to raw media URLs

### 2. Media Proxy Endpoint
- Backend serves as a proxy for media files
- Endpoint: `GET /media/proxy?token=<encrypted_token>`
- Solves CORS issues with WAHA API
- Provides centralized access control

### 3. Automatic URL Transformation
- When messages are sent to frontend, URLs are automatically converted to proxy URLs
- Format: `http://your-backend.com/media/proxy?token=<encrypted_token>`
- Frontend can fetch media directly through the backend

## Configuration

Add to your `.env`:

```env
# Backend base URL for proxy (change in production)
BACKEND_BASE_URL=http://localhost:5000

# Encryption key (must be 32 bytes, base64/hex/raw)
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

### Production Example

```env
BACKEND_BASE_URL=https://api.yourdomain.com
ENCRYPTION_KEY=base64:ABCD1234... # 32-byte key in base64
```

## How It Works

### Inbound Flow (Receiving Messages)

1. **Webhook receives message** with media URL (e.g., from WAHA or Meta)
2. **Worker encrypts the URL** using `encryptMediaUrl()`
3. **Encrypted URL is stored** in `chat_messages.media_url`
4. **When sending to frontend**, URL is transformed to proxy format:
   ```
   /media/proxy?token=<encrypted_token>
   ```

### Outbound Flow (Sending Messages)

1. **User uploads media** (existing flow unchanged)
2. **Media URL is encrypted** before storing in database
3. **Socket emission** includes proxy URL for frontend display

### Frontend Access

The frontend simply uses the proxy URL:

```html
<img src="http://localhost:5000/media/proxy?token=abc123..." />
<video src="http://localhost:5000/media/proxy?token=xyz789..." />
<audio src="http://localhost:5000/media/proxy?token=def456..." />
```

The backend:
1. Decrypts the token
2. Fetches media from original source (WAHA/Meta/Storage)
3. Streams it to the frontend
4. Sets proper headers (Content-Type, CORS, Cache-Control)

## API Endpoints

### Media Proxy

**GET** `/media/proxy?token=<encrypted_token>`

**Parameters:**
- `token` (required): Encrypted media URL token

**Response:**
- Success: Streams the media file with appropriate headers
- Error 400: Invalid or missing token
- Error 503: Media source unavailable
- Error 504: Media source timeout

**Headers Set:**
- `Content-Type`: Original media type
- `Content-Length`: File size
- `Access-Control-Allow-Origin: *`
- `Cache-Control: public, max-age=86400` (24 hours)

### Health Check

**GET** `/media/health`

**Response:**
```json
{
  "status": "ok",
  "service": "media-proxy"
}
```

## Security

### Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Size**: 32 bytes (256 bits)
- **IV**: Random 12 bytes per encryption
- **Auth Tag**: 16 bytes

### Benefits
- Media URLs are not exposed in database
- Tokens expire when encryption key changes
- Frontend cannot access original URLs directly
- Centralized access control through backend

## Troubleshooting

### Media not loading

1. **Check BACKEND_BASE_URL**:
   ```bash
   echo $BACKEND_BASE_URL
   ```
   Must match your actual backend URL in production

2. **Check encryption key**:
   ```bash
   echo $ENCRYPTION_KEY
   ```
   Must be 32 bytes (base64, hex, or raw)

3. **Check proxy logs**:
   ```bash
   grep "\[media.proxy\]" backend.log
   ```

4. **Test proxy directly**:
   ```bash
   curl "http://localhost:5000/media/proxy?token=<token>"
   ```

### CORS errors

The proxy automatically adds CORS headers. If you still see CORS errors:

1. Check that requests go through `/media/proxy` endpoint
2. Verify BACKEND_BASE_URL in frontend matches backend URL
3. Ensure nginx/proxy doesn't strip CORS headers

### Encryption errors

If you see `"Failed to decrypt token"` errors:

1. Verify ENCRYPTION_KEY hasn't changed
2. Check key format (must be 32 bytes)
3. Old encrypted URLs won't work after key change

## Migration Notes

### Existing Media URLs

If you have existing unencrypted URLs in database:

1. **They will still work** through proxy (transparent handling)
2. New messages will be encrypted automatically
3. No manual migration needed

### Updating ENCRYPTION_KEY

⚠️ **Warning**: Changing the encryption key will invalidate all existing encrypted URLs

If you need to rotate the key:

1. Deploy code with new key
2. URLs will be re-encrypted on next update
3. Old URLs will be decrypted with fallback (returns original if decrypt fails)

## Performance

### Caching
- Proxy responses are cacheable (24-hour max-age)
- Browser/CDN can cache media files
- Backend doesn't cache (streams directly)

### Timeouts
- Fetch timeout: 30 seconds
- Max redirects: 5
- Handles connection errors gracefully

## Dependencies

### NPM Packages
- `axios`: For HTTP requests to original media sources
- Built-in `crypto`: For AES-256-GCM encryption

### Installation
```bash
npm install axios
```

## Code Structure

### New Files
- `backend/src/lib/crypto.ts`: Encryption functions (`encryptMediaUrl`, `decryptMediaUrl`, `encryptUrl`, `decryptUrl`)
- `backend/src/lib/mediaProxy.ts`: Proxy URL builders (`buildProxyUrl`, `transformMessagesMediaUrls`)
- `backend/src/routes/media.proxy.ts`: Proxy endpoint implementation

### Modified Files
- `backend/src/worker.ts`: Encrypts URLs before storing, builds proxy URLs for socket emission
- `backend/src/services/meta/store.ts`: Encrypts URLs in `upsertChatMessage`
- `backend/src/routes/livechat.chats.ts`: Transforms URLs when returning messages
- `backend/src/index.ts`: Registers media proxy router

## Examples

### Encrypting a URL

```typescript
import { encryptMediaUrl } from './lib/crypto';

const originalUrl = 'https://waha-api.com/files/abc123.jpg';
const encrypted = encryptMediaUrl(originalUrl);
// encrypted = 'SGVsbG8gV29ybGQh...' (base64url token)
```

### Building Proxy URL

```typescript
import { buildProxyUrl } from './lib/mediaProxy';

const encrypted = 'SGVsbG8gV29ybGQh...';
const proxyUrl = buildProxyUrl(encrypted);
// proxyUrl = 'http://localhost:5000/media/proxy?token=SGVsbG8gV29ybGQh...'
```

### Transforming Message List

```typescript
import { transformMessagesMediaUrls } from './lib/mediaProxy';

const messages = [
  { id: '1', body: 'Hello', media_url: 'encrypted_token_1' },
  { id: '2', body: 'World', media_url: 'encrypted_token_2' }
];

const transformed = transformMessagesMediaUrls(messages);
// transformed[0].media_url = 'http://localhost:5000/media/proxy?token=encrypted_token_1'
// transformed[1].media_url = 'http://localhost:5000/media/proxy?token=encrypted_token_2'
```

## Testing

### Local Testing

1. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Send a message with media through WAHA or Meta

3. Check database - media_url should be encrypted:
   ```sql
   SELECT id, media_url FROM chat_messages WHERE media_url IS NOT NULL LIMIT 1;
   ```

4. Frontend should load media through proxy URL

### Production Testing

1. Deploy with BACKEND_BASE_URL set to production URL
2. Send test message with media
3. Verify media loads in frontend
4. Check backend logs for proxy access

## Support

If you encounter issues:

1. Check logs: `[media.proxy]`, `[crypto]` prefixes
2. Verify environment variables
3. Test proxy endpoint directly
4. Check WAHA/Meta API accessibility from backend

---

**Last Updated**: 2025-11-03
**Version**: 1.0.0
