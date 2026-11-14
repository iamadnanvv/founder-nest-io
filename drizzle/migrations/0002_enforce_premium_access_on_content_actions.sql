-- A profile is created by the trusted sign-up trigger. Members may edit profile details,
-- but cannot create or change rows that grant premium access.
REVOKE INSERT ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, profile_image, bio, startup_name, startup_website, startup_stage, industry, skills, linkedin_url, looking_for, funding_status, location, founder_type, interests) ON TABLE public.profiles TO authenticated;
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;

-- Feed publishing and editing requires verified premium access; members may still remove their own posts.
DROP POLICY IF EXISTS "users create own posts" ON public.posts;
CREATE POLICY "users create own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "users update own posts" ON public.posts;
CREATE POLICY "users update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id AND public.has_premium_access(auth.uid())) WITH CHECK (auth.uid() = user_id AND public.has_premium_access(auth.uid()));

-- Engagement and connections require premium membership to create or change.
DROP POLICY IF EXISTS "users like" ON public.post_likes;
CREATE POLICY "users like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "users follow" ON public.follows;
CREATE POLICY "users follow" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "users bookmark" ON public.post_bookmarks;
CREATE POLICY "users bookmark" ON public.post_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_premium_access(auth.uid()));

-- Comments, discussions, replies, and collaboration posts require premium access to publish/edit.
DROP POLICY IF EXISTS "users comment" ON public.post_comments;
CREATE POLICY "users comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "author update comment" ON public.post_comments;
CREATE POLICY "author update comment" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id AND public.has_premium_access(auth.uid())) WITH CHECK (auth.uid() = author_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "members create discussions" ON public.discussions;
CREATE POLICY "members create discussions" ON public.discussions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "author or admin update discussions" ON public.discussions;
CREATE POLICY "author or admin update discussions" ON public.discussions FOR UPDATE TO authenticated USING ((auth.uid() = author_id AND public.has_premium_access(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((auth.uid() = author_id AND public.has_premium_access(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "members reply" ON public.discussion_replies;
CREATE POLICY "members reply" ON public.discussion_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.has_premium_access(auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.discussions d WHERE d.id = discussion_replies.discussion_id AND d.locked = true));
DROP POLICY IF EXISTS "author create collab" ON public.collab_posts;
CREATE POLICY "author create collab" ON public.collab_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "author or admin update collab" ON public.collab_posts;
CREATE POLICY "author or admin update collab" ON public.collab_posts FOR UPDATE TO authenticated USING ((auth.uid() = author_id AND public.has_premium_access(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((auth.uid() = author_id AND public.has_premium_access(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Community creation/joining and startup submissions require verified premium access.
DROP POLICY IF EXISTS "members create communities" ON public.communities;
CREATE POLICY "members create communities" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "users join" ON public.community_members;
CREATE POLICY "users join" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role = 'member' AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "founder create own startup" ON public.startups;
CREATE POLICY "founder create own startup" ON public.startups FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "founder update own startup" ON public.startups;
CREATE POLICY "founder update own startup" ON public.startups FOR UPDATE TO authenticated USING (auth.uid() = founder_id AND public.has_premium_access(auth.uid())) WITH CHECK (auth.uid() = founder_id AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "user register" ON public.event_registrations;
CREATE POLICY "user register" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_premium_access(auth.uid()));

-- Message content is available only to the conversation participants while their membership is active.
DROP POLICY IF EXISTS "users read own conversations" ON public.messages;
CREATE POLICY "users read own conversations" ON public.messages FOR SELECT TO authenticated USING ((auth.uid() = sender_id OR auth.uid() = receiver_id) AND public.has_premium_access(auth.uid()));
DROP POLICY IF EXISTS "users send messages" ON public.messages;
CREATE POLICY "users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.has_premium_access(auth.uid()));