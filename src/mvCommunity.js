// Data layer for the Community redesign (Fase 1): directory profiles (cover
// photo + bio), posts, follows, swipes (Descubrir), comments, and reports.
// Pure data — no UI. Every call assumes window.mvSupabase (created in auth.js)
// and, where noted, window.mvCurrentUser. RLS on the tables does the real
// access control; these are thin, honest wrappers over it.
//
// Migration: supabase/migrations/20260902220000_community_redesign.sql

const BUCKET = 'community-photos';

function sb(){
  const client = window.mvSupabase;
  if(!client) throw new Error('mvCommunity: Supabase client not ready');
  return client;
}
function currentUid(){
  return window.mvCurrentUser?.id || null;
}
function requireUser(){
  const id = currentUid();
  if(!id) throw new Error('mvCommunity: sign-in required');
  return id;
}
// Postgres unique-violation — used to make follow/swipe idempotent.
function isDuplicate(error){
  return error && (error.code === '23505' || /duplicate key/i.test(error.message || ''));
}
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

/* ---------------------- Translation (Fase 2) ---------------------- */
// Posts and comments are translated into all four platform languages at
// publish time by the community-translate Edge Function (Azure AI Translator),
// and the four versions are stored on the row. Readers get their own language.

const PLATFORM_LANGS = ['es', 'en', 'de', 'fr'];
const POST_MAX_LEN = 2000;
const COMMENT_MAX_LEN = 500;

function normalizeLang(lang){
  return PLATFORM_LANGS.includes(lang) ? lang : 'es';
}

// Ask the Edge Function for { source_lang, body_i18n, status }. Throws on any
// failure so callers can decide whether to publish with the original only.
async function translateForPublish(text, sourceHint){
  const { data, error } = await sb().functions.invoke('community-translate', {
    body: { text, sourceHint: normalizeLang(sourceHint) },
  });
  if(error) throw error;
  if(!data || !data.body_i18n) throw new Error('community-translate: bad response');
  return data;
}

// Build the insert/update fields for a translatable body. Never throws — if the
// provider is unavailable the row still publishes with the original text in the
// author's language and translation_status 'failed' for the backfill job.
async function translatedFields(text, sourceHint){
  const hint = normalizeLang(sourceHint);
  try{
    const r = await translateForPublish(text, hint);
    return {
      body_i18n: r.body_i18n,
      source_lang: normalizeLang(r.source_lang),
      translation_status: r.status === 'skipped' ? 'skipped' : 'done',
    };
  }catch(e){
    return {
      body_i18n: { [hint]: text },
      source_lang: hint,
      translation_status: 'failed',
    };
  }
}

// Pick the best available version of a post/comment body for a reader's language.
function localizeBody(row, lang){
  if(!row) return '';
  const want = normalizeLang(lang);
  const map = row.body_i18n || null;
  if(map && map[want]) return map[want];
  if(map && row.source_lang && map[row.source_lang]) return map[row.source_lang];
  return row.body || (map ? Object.values(map)[0] : '') || '';
}

// True if the reader is seeing an auto-translation rather than the original.
function isTranslated(row, lang){
  if(!row || !row.source_lang) return false;
  return normalizeLang(lang) !== row.source_lang && row.translation_status !== 'failed';
}

/* ---------------------- Directory profiles ---------------------- */
// community_members holds one public row per account: display_name, country,
// profile_type, plus cover_photo_url + bio added by the redesign migration.

async function listMembers({ country = null, type = null, limit = 200 } = {}){
  let q = sb().from('community_members').select('*')
    .order('created_at', { ascending: false }).limit(limit);
  if(country) q = q.eq('country', country);
  if(type) q = q.eq('profile_type', type);
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

async function getMemberProfile(userId){
  const { data, error } = await sb().from('community_members').select('*')
    .eq('user_id', userId).maybeSingle();
  if(error) throw error;
  return data;
}

async function getMyMemberProfile(){
  const id = currentUid();
  return id ? getMemberProfile(id) : null;
}

// Insert or update the current user's directory row. Only the fields passed in
// are touched, so callers can update just a bio or just a cover photo.
// display_name is NOT NULL in the table — include it on first insert.
async function upsertMyMemberProfile(fields = {}){
  const id = requireUser();
  const allowed = ['display_name', 'country', 'profile_type', 'bio', 'cover_photo_url', 'avatar_url'];
  const row = { user_id: id };
  for(const k of allowed) if(k in fields) row[k] = fields[k];
  const { data, error } = await sb().from('community_members')
    .upsert(row, { onConflict: 'user_id' }).select().single();
  if(error) throw error;
  return data;
}

/* ---------------------- Follows ---------------------- */
// One row per (follower, followed). A one-directional follow unlocks the
// followed user's full profile + posts; a mutual follow additionally unlocks
// commenting on their posts.

async function follow(userId){
  const me = requireUser();
  const { error } = await sb().from('community_follows')
    .insert({ follower_id: me, followed_id: userId });
  if(error && !isDuplicate(error)) throw error;
}

async function unfollow(userId){
  const me = requireUser();
  const { error } = await sb().from('community_follows').delete()
    .eq('follower_id', me).eq('followed_id', userId);
  if(error) throw error;
}

// user ids the current user follows.
async function getFollowing(){
  const me = currentUid();
  if(!me) return [];
  const { data, error } = await sb().from('community_follows')
    .select('followed_id').eq('follower_id', me);
  if(error) throw error;
  return (data || []).map(r => r.followed_id);
}

// user ids that follow the current user.
async function getFollowers(){
  const me = currentUid();
  if(!me) return [];
  const { data, error } = await sb().from('community_follows')
    .select('follower_id').eq('followed_id', me);
  if(error) throw error;
  return (data || []).map(r => r.follower_id);
}

// True if the current user and userId follow each other both ways
// (server-side check — the comment box gate).
async function isMutual(userId){
  const me = currentUid();
  if(!me) return false;
  const { data, error } = await sb().rpc('community_is_mutual', { a: me, b: userId });
  if(error) throw error;
  return !!data;
}

// True if the current user may see ownerId's full profile/posts (self or follows them).
async function canView(ownerId){
  const me = currentUid();
  if(!me) return false;
  const { data, error } = await sb().rpc('community_can_view', { viewer: me, owner: ownerId });
  if(error) throw error;
  return !!data;
}

/* ---------------------- Swipes / Descubrir ---------------------- */

async function getSwipedIds(){
  const me = currentUid();
  if(!me) return [];
  const { data, error } = await sb().from('community_swipes')
    .select('swiped_id').eq('swiper_id', me);
  if(error) throw error;
  return (data || []).map(r => r.swiped_id);
}

// Directory members the current user has not swiped on yet (and not themselves).
async function getSwipeCandidates({ limit = 20 } = {}){
  const me = requireUser();
  const exclude = [me, ...(await getSwipedIds())];
  // PostgREST "not in" list — UUIDs quoted so the filter parses reliably.
  const list = exclude.map(id => `"${id}"`).join(',');
  const { data, error } = await sb().from('community_members').select('*')
    .not('user_id', 'in', `(${list})`)
    .order('created_at', { ascending: false }).limit(limit);
  if(error) throw error;
  return data || [];
}

// Record a swipe. A 'right' swipe also creates the follow row via the
// on_community_swipe trigger — no separate follow() call needed here.
async function recordSwipe(userId, direction){
  const me = requireUser();
  if(direction !== 'left' && direction !== 'right'){
    throw new Error("mvCommunity.recordSwipe: direction must be 'left' or 'right'");
  }
  const { error } = await sb().from('community_swipes')
    .insert({ swiper_id: me, swiped_id: userId, direction });
  if(error && !isDuplicate(error)) throw error;
}

/* ---------------------- Posts ---------------------- */
// RLS makes listFeedPosts return only posts the current user may see
// (their own + those of people they follow).

async function listFeedPosts({ limit = 30, before = null } = {}){
  let q = sb().from('community_posts').select('*')
    .order('created_at', { ascending: false }).limit(limit);
  if(before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if(error) throw error;
  return data || [];
}

async function listUserPosts(userId, { limit = 30 } = {}){
  const { data, error } = await sb().from('community_posts').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if(error) throw error;
  return data || [];
}

const POST_TYPES = ['general', 'viajero', 'cultivo', 'diagnostico', 'pregunta'];

// Create a text or photo post. Pass a File in photoFile to upload it first.
// A non-empty body is translated into all four languages before the insert.
// post_type + meta turn a post into a traveler/grow/diagnosis/question report
// (meta holds that type's one extra field, e.g. { country: 'Perú' }) — plain
// posts leave both at their defaults.
async function createPost({ body = null, photoFile = null, sourceHint = 'es', post_type = 'general', meta = null } = {}){
  const me = requireUser();
  let photo_url = null;
  if(photoFile) photo_url = await uploadCommunityPhoto(photoFile, 'posts');
  const kind = photo_url ? 'photo' : 'text';
  const trimmed = body ? body.trim() : null;
  if(kind === 'text' && !trimmed) throw new Error('mvCommunity.createPost: empty post');
  if(trimmed && trimmed.length > POST_MAX_LEN){
    throw new Error('mvCommunity.createPost: body exceeds ' + POST_MAX_LEN + ' chars');
  }
  const row = {
    user_id: me, kind, body: trimmed, photo_url,
    post_type: POST_TYPES.includes(post_type) ? post_type : 'general',
    meta: meta || null,
  };
  if(trimmed){
    Object.assign(row, await translatedFields(trimmed, sourceHint));
  } else {
    row.translation_status = 'skipped';
  }
  const { data, error } = await sb().from('community_posts')
    .insert(row).select().single();
  if(error) throw error;
  return data;
}

// Edit a post's text. Re-translates the new body.
async function updatePost(id, { body = null, sourceHint = 'es' } = {}){
  requireUser();
  const trimmed = body ? body.trim() : null;
  if(!trimmed) throw new Error('mvCommunity.updatePost: empty body');
  if(trimmed.length > POST_MAX_LEN){
    throw new Error('mvCommunity.updatePost: body exceeds ' + POST_MAX_LEN + ' chars');
  }
  const row = { body: trimmed, ...(await translatedFields(trimmed, sourceHint)) };
  const { data, error } = await sb().from('community_posts')
    .update(row).eq('id', id).select().single();
  if(error) throw error;
  return data;
}

async function deletePost(id){
  requireUser();
  const { error } = await sb().from('community_posts').delete().eq('id', id);
  if(error) throw error;
}

/* ---------------------- Comments ---------------------- */
// Insert is allowed only when commenter and post author mutually follow (or
// the commenter is the author) — enforced by RLS, so a failed insert on an
// unlocked post surfaces as an error here.

async function listComments(postId){
  const { data, error } = await sb().from('community_comments').select('*')
    .eq('post_id', postId).order('created_at', { ascending: true });
  if(error) throw error;
  return data || [];
}

async function addComment(postId, body, { sourceHint = 'es' } = {}){
  const me = requireUser();
  const text = (body || '').trim();
  if(!text) throw new Error('mvCommunity.addComment: empty comment');
  if(text.length > COMMENT_MAX_LEN){
    throw new Error('mvCommunity.addComment: comment exceeds ' + COMMENT_MAX_LEN + ' chars');
  }
  const row = {
    post_id: postId, user_id: me, body: text,
    ...(await translatedFields(text, sourceHint)),
  };
  const { data, error } = await sb().from('community_comments')
    .insert(row).select().single();
  if(error) throw error;
  return data;
}

async function deleteComment(id){
  requireUser();
  const { error } = await sb().from('community_comments').delete().eq('id', id);
  if(error) throw error;
}

/* ---------------------- Reports ---------------------- */
// Insert-only from the client. Reviewed manually via the Supabase dashboard —
// there is no automated moderation yet, matching the app's own copy.

async function submitReport({ target_type, target_id, reason } = {}){
  const me = requireUser();
  if(!['profile', 'post', 'comment'].includes(target_type)){
    throw new Error('mvCommunity.submitReport: bad target_type');
  }
  const { error } = await sb().from('community_reports').insert({
    reporter_id: me,
    target_type,
    target_id,
    reason: (reason || '').trim() || 'unspecified',
  });
  if(error) throw error;
}

/* ---------------------- Photo upload ---------------------- */
// Uploads into the public community-photos bucket under <uid>/<folder>/<uuid>.<ext>.
// The leading <uid> folder is what the storage RLS policy checks on write.
// The bucket is public: the returned URL is unguessable but not access-checked.

async function uploadCommunityPhoto(file, folder = 'misc'){
  const me = requireUser();
  const rawExt = (file.name && file.name.includes('.')) ? file.name.split('.').pop() : 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${me}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if(error) throw error;
  return sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Avatar: unlike post photos, one fixed path per user (<uid>/avatar/avatar.jpg)
// so re-uploading replaces the old file instead of accumulating orphans. The
// caller resizes the image client-side first. Returns a cache-busted URL
// (?v=timestamp) so a re-upload under the same path isn't served stale from
// the browser cache; does NOT touch community_members — call
// upsertMyMemberProfile({ avatar_url }) after, same as any other field.
async function uploadAvatar(fileOrBlob){
  const me = requireUser();
  const path = `${me}/avatar/avatar.jpg`;
  const { error } = await sb().storage.from(BUCKET).upload(path, fileOrBlob, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'image/jpeg',
  });
  if(error) throw error;
  const base = sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return `${base}?v=${Date.now()}`;
}

window.mvCommunity = {
  escapeHtml,
  PLATFORM_LANGS, POST_MAX_LEN, COMMENT_MAX_LEN, POST_TYPES,
  localizeBody, isTranslated,
  listMembers, getMemberProfile, getMyMemberProfile, upsertMyMemberProfile,
  uploadAvatar,
  follow, unfollow, getFollowing, getFollowers, isMutual, canView,
  getSwipedIds, getSwipeCandidates, recordSwipe,
  listFeedPosts, listUserPosts, createPost, updatePost, deletePost,
  listComments, addComment, deleteComment,
  submitReport, uploadCommunityPhoto,
};
