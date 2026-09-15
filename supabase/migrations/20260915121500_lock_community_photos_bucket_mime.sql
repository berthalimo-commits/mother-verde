-- Security fix: the community-photos storage bucket (public, created in
-- 20260902220000) had no MIME-type or size restriction. The app's own upload
-- paths always re-encode through <canvas> to JPEG before uploading (post
-- photos: public/main.js, avatar crop: src/avatarCropper.js), so this was
-- never hit in normal use — but nothing stopped a caller from invoking
-- window.mvCommunity.uploadCommunityPhoto directly from the console with an
-- arbitrary file, landing any content type in a public bucket under this
-- project's domain. Narrowing to what the app actually produces is a no-op
-- for every legitimate upload.
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp'],
    file_size_limit = 8388608  -- 8 MB; real uploads are compressed JPEG, far smaller
where id = 'community-photos';
