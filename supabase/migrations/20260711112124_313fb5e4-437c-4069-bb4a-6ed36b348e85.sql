
CREATE POLICY "attachments_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('attachments','avatars'));
CREATE POLICY "attachments_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('attachments','avatars') AND owner = auth.uid());
CREATE POLICY "attachments_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('attachments','avatars') AND owner = auth.uid());
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('attachments','avatars') AND owner = auth.uid());
