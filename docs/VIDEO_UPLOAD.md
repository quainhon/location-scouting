# Short spot videos

Desktop spot details and mobile capture/details accept MP4 or MOV clips. Each clip must be longer than zero and no more than 15 seconds, up to 20 MB. Each spot has at most four clips. Longer clips are rejected with a request to trim them; the application does not automatically edit or transcode video.

The browser checks size, type and playback duration before upload. The shared server handler independently inspects MP4/MOV movie and video-track timing, checks the payload hash and streamed byte limit, and rejects unsupported or invalid containers. Fragmented files without a finite duration and containers other than MP4/MOV are not supported. Playback depends on the device's codec support; a download link is shown if playback fails.

PUT /api/videos/:sha256 stores immutable binary assets. GET/HEAD support byte ranges for seeking. Video bytes are excluded from workspace JSON; only id, URL, caption and verified duration are attached to a spot. SQLite and Cloudflare D1 use the same protocol. D1 stores assets in 1 MB chunks under the existing database binding; additive tables initialize idempotently. The complete reference schema is database/schema.sql.

Spot edits, archive/restore and route changes preserve video metadata. Permanent deletion removes video associations along with other spot metadata. Immutable binary assets remain retained for safe retries and shared references, as with uploaded photos. Back up the complete database for video bytes; a JSON export includes metadata only.

This feature is local until the updated application and Pages functions are deployed. Tests use isolated test databases, never production spot data.
