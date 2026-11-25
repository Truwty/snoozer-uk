-- Official Snoozer profile badge catalogue and automatic recognition.
begin;
create table snoozer.badge_catalog(
 slug text primary key check(slug ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
 name text not null check(char_length(name) between 1 and 48),
 description text not null check(char_length(description) between 1 and 240),
 icon text not null check(char_length(icon) between 1 and 24),
 category text not null check(category in('milestone','creator','community','seasonal','premium','staff','unique')),
 rarity text not null check(rarity in('common','uncommon','rare','epic','legendary','mythic')),
 award_mode text not null check(award_mode in('automatic','manual','future')),
 criterion_key text, enabled boolean not null default true,
 unique_profile_id uuid references snoozer.profiles(id) on delete cascade,
 sort_order integer not null default 100, created_at timestamptz not null default now(),
 check((award_mode='automatic')=(criterion_key is not null)),
 check(unique_profile_id is null or award_mode='manual')
);
create index badge_catalog_visible on snoozer.badge_catalog(award_mode,enabled,sort_order);
create table snoozer.profile_badges(
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references snoozer.profiles(id) on delete cascade,
 slug text not null references snoozer.badge_catalog(slug) on update cascade on delete restrict,
 name text not null, description text not null, icon text not null, category text not null, rarity text not null,
 source text not null check(source in('automatic','owner')),
 awarded_by uuid references auth.users(id) on delete set null, award_reason text,
 is_public boolean not null default true, awarded_at timestamptz not null default now(), revoked_at timestamptz,
 unique(profile_id,slug), check(award_reason is null or char_length(award_reason) between 8 and 500)
);
create index profile_badges_public on snoozer.profile_badges(profile_id,awarded_at desc) where revoked_at is null and is_public;
alter table snoozer.badge_catalog enable row level security;
alter table snoozer.profile_badges enable row level security;
revoke all on snoozer.badge_catalog,snoozer.profile_badges from public,anon,authenticated,service_role;
insert into snoozer.badge_catalog(slug,name,description,icon,category,rarity,award_mode,criterion_key,enabled,sort_order)
values
('profile-claimed','First Steps','Your Snoozer profile has been claimed.','✦','milestone','common','automatic','profile_claimed','true','10'),
('first-publish','Now Live','Published your first profile.','↗','milestone','common','automatic','profile_published','true','20'),
('profile-story','Storyteller','Added a bio to introduce yourself.','Aa','creator','common','automatic','bio_added','true','30'),
('avatar-ready','Face of the Place','Added a profile avatar.','◉','creator','common','automatic','avatar_set','true','40'),
('first-link','First Connection','Added your first profile link.','⌁','milestone','common','automatic','links_1','true','50'),
('link-builder','Connector','Added five profile links.','⛓','creator','uncommon','automatic','links_5','true','60'),
('networker','Networker','Added ten profile links.','◎','creator','rare','automatic','links_10','true','70'),
('first-section','More Than a Bio','Added your first profile section.','▤','creator','common','automatic','section_1','true','80'),
('gallery-opener','Gallery Opening','Added an image to your profile gallery.','▧','creator','common','automatic','gallery_1','true','90'),
('getting-noticed','Getting Noticed','Your profile has reached 100 views.','◌','milestone','common','automatic','views_100','true','100'),
('rising-star','Rising Star','Your profile has reached 1,000 views.','✧','milestone','uncommon','automatic','views_1000','true','110'),
('crowd-favourite','Crowd Favourite','Your profile has reached 10,000 views.','★','milestone','rare','automatic','views_10000','true','120'),
('profile-icon','Profile Icon','Your profile has reached 100,000 views.','✹','milestone','epic','automatic','views_100000','true','130'),
('million-views','Million Club','Your profile has reached one million views.','♛','milestone','legendary','automatic','views_1000000','true','140'),
('discovery-ready','Out There','Enabled profile discovery.','⌕','community','common','automatic','discovery_enabled','true','150'),
('own-domain','Own the Address','Verified a custom domain for your profile.','⌂','creator','epic','automatic','custom_domain','true','160'),
('discord-connected','Community Connected','Enabled Discord presence on your profile.','◈','community','uncommon','automatic','discord_presence','true','170'),
('interactive','Made Interactive','Enabled a profile widget.','▣','creator','uncommon','automatic','widget_enabled','true','180'),
('block-builder','Block by Block','Added a custom profile content block.','▦','creator','uncommon','automatic','block_added','true','190'),
('one-week','One Week In','Your profile has been active for seven days.','◷','milestone','common','automatic','active_7_days','true','200'),
('one-month','One Month Strong','Your profile has been active for thirty days.','◴','milestone','uncommon','automatic','active_30_days','true','210'),
('half-thousand','Half a Thousand','Your profile has reached 500 views.','✳','milestone','uncommon','automatic','views_500','true','220'),
('on-the-map','On the Map','Your profile has reached 50,000 views.','✺','milestone','epic','automatic','views_50000','true','230'),
('half-million','Half-Million Club','Your profile has reached 500,000 views.','✪','milestone','legendary','automatic','views_500000','true','240'),
('made-it-yours','Made It Yours','Customised your profile appearance.','◈','creator','common','automatic','appearance_custom','true','250'),
('profile-curator','Profile Curator','Added three profile sections.','▥','creator','rare','automatic','sections_3','true','260'),
('gallery-curator','Gallery Curator','Added five gallery images.','▧','creator','rare','automatic','gallery_5','true','270'),
('people-click','People Click','Your profile links have received 100 clicks.','↗','milestone','uncommon','automatic','clicks_100','true','280'),
('early-creator','Early Creator','Your profile has been active for ninety days.','⌛','milestone','rare','automatic','active_90_days','true','290'),
('founding-member','Founding Member','Recognised as an early member of Snoozer.','♛','community','legendary','manual',null,'true','400'),
('community-helper','Community Helper','Recognised for helping the Snoozer community.','✚','community','rare','manual',null,'true','410'),
('community-champion','Community Champion','Recognised for exceptional community contributions.','★','community','epic','manual',null,'true','420'),
('trusted-creator','Trusted Creator','A Snoozer Owner has recognised this creator.','✓','creator','rare','manual',null,'true','430'),
('staff-member','Snoozer Staff','Official Snoozer staff member.','✦','staff','legendary','manual',null,'true','440'),
('moderator','Snoozer Moderator','Official Snoozer moderation team member.','⚑','staff','epic','manual',null,'true','450'),
('support-team','Support Team','Official Snoozer support team member.','✚','staff','epic','manual',null,'true','460'),
('developer','Snoozer Developer','Recognised for building Snoozer.','⌘','staff','legendary','manual',null,'true','470'),
('partner','Official Partner','Recognised Snoozer partner.','✧','community','epic','manual',null,'true','480'),
('event-winner','Event Winner','Winner of an official Snoozer event.','🏆','community','legendary','manual',null,'true','490'),
('creator-spotlight','Creator Spotlight','Selected for the Snoozer creator spotlight.','✺','creator','epic','manual',null,'true','500'),
('beta-tester','Beta Tester','Helped test an early Snoozer feature.','⚗','community','rare','manual',null,'true','510'),
('bug-hunter','Bug Hunter','Found and responsibly reported a Snoozer bug.','⌖','community','rare','manual',null,'true','520'),
('early-access','Early Access','Invited to try a feature before public release.','⚡','community','rare','manual',null,'true','530'),
('premium-supporter','Premium Supporter','Recognised for supporting Snoozer Premium.','◆','premium','rare','manual',null,'true','540'),
('gift-giver','Gift Giver','Recognised for gifting Premium to another member.','🎁','community','rare','manual',null,'true','550'),
('verified-identity','Verified Identity','Identity checked by the Snoozer team.','✓','community','epic','manual',null,'true','560'),
('winter-creator','Winter Creator','A seasonal winter creator reward.','❄','seasonal','rare','future',null,'true','1000'),
('winter-wonder','Winter Wonder','A special winter community reward.','☃','seasonal','epic','future',null,'true','1010'),
('spring-awakening','Spring Awakening','A seasonal spring creator reward.','✿','seasonal','rare','future',null,'true','1020'),
('blooming-profile','Blooming Profile','A spring profile showcase reward.','❀','seasonal','uncommon','future',null,'true','1030'),
('summer-vibes','Summer Vibes','A seasonal summer community reward.','☀','seasonal','rare','future',null,'true','1040'),
('heatwave','Heatwave','A limited summer event reward.','🔥','seasonal','epic','future',null,'true','1050'),
('autumn-leaves','Autumn Leaves','A seasonal autumn creator reward.','🍂','seasonal','rare','future',null,'true','1060'),
('harvest-gold','Harvest Gold','A limited autumn event reward.','♜','seasonal','epic','future',null,'true','1070'),
('halloween-haunt','Halloween Haunt','A limited Halloween event reward.','☠','seasonal','epic','future',null,'true','1080'),
('spooky-season','Spooky Season','Took part in the Halloween celebration.','☾','seasonal','rare','future',null,'true','1090'),
('new-year','New Year New Page','A limited New Year reward.','✧','seasonal','rare','future',null,'true','1100'),
('anniversary-one','First Anniversary','Celebrated one year of Snoozer.','🎂','seasonal','legendary','future',null,'true','1110'),
('anniversary-five','Five Years of Snoozer','A five-year anniversary reward.','♛','seasonal','mythic','future',null,'true','1120'),
('launch-day','Launch Day','Was part of the official launch celebration.','🚀','seasonal','legendary','future',null,'true','1130'),
('midnight-drop','Midnight Drop','Claimed a limited midnight release.','☾','seasonal','epic','future',null,'true','1140'),
('community-day','Community Day','Participated in Snoozer Community Day.','◎','seasonal','rare','future',null,'true','1150'),
('birthday-club','Birthday Club','Celebrated a Snoozer birthday event.','🎈','seasonal','rare','future',null,'true','1160'),
('easter-egg','Easter Egg','Found a hidden Snoozer surprise.','🥚','seasonal','epic','future',null,'true','1170'),
('click-magnet','Click Magnet','Received 10,000 profile link clicks.','↗','milestone','legendary','future',null,'true','1300'),
('click-legend','Click Legend','Received one million profile link clicks.','✹','milestone','mythic','future',null,'true','1310'),
('audience-builder','Audience Builder','Reached a future audience milestone.','♧','creator','legendary','future',null,'true','1320'),
('audience-icon','Audience Icon','Reached a major future audience milestone.','♛','creator','mythic','future',null,'true','1330'),
('seven-day-streak','Seven Day Streak','Created or updated your page seven days running.','◷','creator','rare','future',null,'true','1340'),
('thirty-day-streak','Thirty Day Streak','Created or updated your page thirty days running.','◴','creator','epic','future',null,'true','1350'),
('daily-featured','Daily Featured','Selected as a daily featured creator.','✦','creator','epic','future',null,'true','1360'),
('weekly-featured','Weekly Featured','Selected as a weekly featured creator.','✺','creator','legendary','future',null,'true','1370'),
('monthly-featured','Monthly Featured','Selected as a monthly featured creator.','♛','creator','mythic','future',null,'true','1380'),
('trending-creator','Trending Creator','Reached a future trending milestone.','↗','creator','legendary','future',null,'true','1390'),
('top-one-percent','Top One Percent','Reached the top one percent of creators.','♜','creator','mythic','future',null,'true','1400'),
('leaderboard-top-ten','Top Ten','Reached the top ten of the Snoozer leaderboard.','🥇','creator','legendary','future',null,'true','1410'),
('leaderboard-number-one','Number One','Ranked first on the Snoozer leaderboard.','🏆','creator','mythic','future',null,'true','1420'),
('domain-pioneer','Domain Pioneer','Added multiple verified custom domains.','⌂','creator','legendary','future',null,'true','1430'),
('portfolio-pro','Portfolio Pro','Created a portfolio with ten projects.','▣','creator','epic','future',null,'true','1440'),
('gallery-master','Gallery Master','Built a large public profile gallery.','▧','creator','epic','future',null,'true','1450'),
('widget-master','Widget Master','Used every future profile widget.','▦','creator','legendary','future',null,'true','1460'),
('design-master','Design Master','Unlocked the full future design toolkit.','✧','creator','legendary','future',null,'true','1470'),
('accessibility-champion','Accessibility Champion','Created an accessible profile experience.','◉','creator','rare','future',null,'true','1480'),
('privacy-first','Privacy First','Completed the future privacy and security checklist.','⬡','milestone','rare','future',null,'true','1490'),
('security-elite','Security Elite','Enabled every future account security control.','⬢','milestone','legendary','future',null,'true','1500'),
('two-factor','Two-Factor Ready','Secured the account with authenticator MFA.','▣','milestone','uncommon','automatic','two_factor','true','1510'),
('google-connected','Google Connected','Linked a Google sign-in identity.','G','milestone','common','automatic','google_connected','true','1520'),
('account-guardian','Account Guardian','Maintained a secure account over time.','⬡','milestone','epic','future',null,'true','1530'),
('gifted-premium','Premium Gifted','Received Premium through a Snoozer gift link.','🎁','premium','rare','automatic','gift_claimed','true','1540'),
('premium-year','Premium Year','Maintained Premium for a full year.','◆','premium','epic','future',null,'true','1550'),
('studio-creator','Studio Creator','Unlocked a future Studio creator milestone.','▤','premium','legendary','future',null,'true','1560'),
('plus-member','Plus Member','A future Plus membership recognition.','✦','premium','common','future',null,'true','1570'),
('pro-member','Pro Member','A future Pro membership recognition.','✧','premium','rare','future',null,'true','1580'),
('studio-member','Studio Member','A future Studio membership recognition.','♛','premium','epic','future',null,'true','1590'),
('first-purchase','First Purchase','Completed a future first-purchase milestone.','◇','premium','common','future',null,'true','1600'),
('community-builder','Community Builder','Built a thriving profile community.','◎','community','epic','future',null,'true','1610'),
('guestbook-host','Guestbook Host','Hosted a future guestbook milestone.','✉','community','uncommon','future',null,'true','1620'),
('poll-master','Poll Master','Ran a future poll milestone.','▦','community','rare','future',null,'true','1630'),
('feedback-friend','Feedback Friend','Helped shape Snoozer through feedback.','✎','community','rare','future',null,'true','1640'),
('reporting-hero','Reporting Hero','Helped keep the community safe.','⚑','community','epic','future',null,'true','1650'),
('kindness-counts','Kindness Counts','Recognised for positive community actions.','♡','community','rare','future',null,'true','1660'),
('helpful-human','Helpful Human','Received multiple community thank-yous.','✚','community','uncommon','future',null,'true','1670'),
('snoozer-original','Snoozer Original','Part of an original creator cohort.','✦','community','legendary','future',null,'true','1680'),
('legacy-creator','Legacy Creator','A long-term Snoozer creator milestone.','♛','community','mythic','future',null,'true','1690'),
('one-hundred-days','100 Days','Profile active for one hundred days.','⌛','milestone','rare','future',null,'true','1700'),
('one-year','One Year','Profile active for one year.','🎂','milestone','legendary','future',null,'true','1710'),
('two-years','Two Years','Profile active for two years.','♜','milestone','legendary','future',null,'true','1720'),
('five-years','Five Years','Profile active for five years.','♛','milestone','mythic','future',null,'true','1730'),
('global-creator','Global Creator','Reached a future global discovery milestone.','◎','creator','legendary','future',null,'true','1740'),
('multi-profile','Multi Profile','Created multiple profile pages.','▤','creator','rare','future',null,'true','1750'),
('brand-builder','Brand Builder','Built a complete profile brand identity.','✧','creator','epic','future',null,'true','1760'),
('ultimate-customiser','Ultimate Customiser','Used all future profile customisation controls.','⚙','creator','legendary','future',null,'true','1770'),
('motion-artist','Motion Artist','Created a future animated profile experience.','✺','creator','epic','future',null,'true','1780'),
('audio-curator','Audio Curator','Added an audio experience to your profile.','♫','creator','rare','future',null,'true','1790'),
('social-butterfly','Social Butterfly','Added a full set of social channels.','❀','creator','uncommon','future',null,'true','1800'),
('night-owl','Night Owl','Participated in a late-night community event.','☾','seasonal','rare','future',null,'true','1810'),
('early-bird','Early Bird','Participated in an early community event.','☀','seasonal','rare','future',null,'true','1820'),
('mystery-box','Mystery Box','Opened a future limited mystery reward.','▣','seasonal','epic','future',null,'true','1830'),
('golden-ticket','Golden Ticket','Received a limited golden ticket.','🎟','unique','mythic','future',null,'true','1840'),
('one-of-one','One of One','Received a unique individually issued badge.','♛','unique','mythic','future',null,'true','1850'),
('snoozer-legend','Snoozer Legend','An exceptional one-off Snoozer recognition.','♕','unique','mythic','future',null,'true','1860'),
('hall-of-fame','Hall of Fame','Entered the Snoozer Hall of Fame.','🏆','unique','mythic','future',null,'true','1870')
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,
 category=excluded.category,rarity=excluded.rarity,award_mode=excluded.award_mode,criterion_key=excluded.criterion_key,
 enabled=excluded.enabled,sort_order=excluded.sort_order;
CREATE OR REPLACE FUNCTION snoozer.award_profile_milestones(p_profile uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p snoozer.profiles; link_count integer; section_count integer; gallery_count integer; view_count bigint; click_count bigint;
begin
 select * into p from snoozer.profiles where id=p_profile; if not found then return; end if;
 select count(*) into link_count from snoozer.links where profile_id=p.id and hidden=false;
 select count(*) into section_count from snoozer.sections where profile_id=p.id and hidden=false;
 select count(*) into gallery_count from snoozer.gallery_items where profile_id=p.id and position is not null and blocked_at is null;
 select coalesce((select total_views from snoozer.profile_view_leaderboard where profile_id=p.id),0) into view_count;
 select coalesce(sum(clicks),0) into click_count from snoozer.profile_view_days where profile_id=p.id;
 insert into snoozer.profile_badges(profile_id,slug,name,description,icon,category,rarity,source)
 select p.id,b.slug,b.name,b.description,b.icon,b.category,b.rarity,'automatic'
 from snoozer.badge_catalog b where b.enabled and b.award_mode='automatic'
 and case b.criterion_key
  when 'profile_claimed' then true
  when 'profile_published' then p.published_revision is not null
  when 'bio_added' then char_length(btrim(p.bio))>=20
  when 'avatar_set' then p.avatar is not null
  when 'links_1' then link_count>=1
  when 'links_5' then link_count>=5
  when 'links_10' then link_count>=10
  when 'section_1' then section_count>=1
  when 'sections_3' then section_count>=3
  when 'gallery_1' then gallery_count>=1
  when 'gallery_5' then gallery_count>=5
  when 'views_100' then view_count>=100
  when 'views_500' then view_count>=500
  when 'views_1000' then view_count>=1000
  when 'views_10000' then view_count>=10000
  when 'views_50000' then view_count>=50000
  when 'views_100000' then view_count>=100000
  when 'views_500000' then view_count>=500000
  when 'views_1000000' then view_count>=1000000
  when 'clicks_100' then click_count>=100
  when 'discovery_enabled' then exists(select 1 from snoozer.profile_discovery_settings d where d.profile_id=p.id and d.directory_enabled)
  when 'custom_domain' then snoozer.ready_profile_domain(p.id) is not null
  when 'discord_presence' then exists(select 1 from snoozer.discord_presence_settings d where d.profile_id=p.id and d.enabled)
  when 'widget_enabled' then coalesce(p.widgets->'guestbook'->>'enabled','false')='true'
   or coalesce(p.widgets->'poll'->>'enabled','false')='true' or coalesce(p.widgets->'faq'->>'enabled','false')='true'
  when 'block_added' then jsonb_array_length(p.blocks)>0
  when 'appearance_custom' then p.appearance is not null and p.appearance<>'{}'::jsonb
  when 'active_7_days' then p.created_at<=now()-interval '7 days'
  when 'active_30_days' then p.created_at<=now()-interval '30 days'
  when 'active_90_days' then p.created_at<=now()-interval '90 days'
  when 'google_connected' then exists(select 1 from auth.identities i where i.user_id=p.owner_id and i.provider='google')
  when 'two_factor' then exists(select 1 from auth.mfa_factors f where f.user_id=p.owner_id and f.factor_type::text='totp' and f.status::text='verified')
  when 'gift_claimed' then exists(select 1 from snoozer.entitlement_grants g where g.owner_id=p.owner_id and g.source='gift' and g.revoked_at is null)
  else false end
 on conflict(profile_id,slug) do nothing;
end $function$

CREATE OR REPLACE FUNCTION snoozer.refresh_profile_badges_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target uuid; rec jsonb;
begin
 rec:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 target:=nullif(coalesce(rec->>'profile_id',rec->>'id'),'')::uuid;
 if target is not null then perform snoozer.award_profile_milestones(target); end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $function$

CREATE OR REPLACE FUNCTION snoozer.public_profile_badges(p_profile uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('slug',b.slug,'name',b.name,'description',b.description,'icon',b.icon,
 'category',b.category,'rarity',b.rarity,'awarded_at',b.awarded_at) order by b.awarded_at,b.slug),'[]'::jsonb)
 from snoozer.profile_badges b where b.profile_id=p_profile and b.revoked_at is null and b.is_public
$function$;

CREATE OR REPLACE FUNCTION public.get_published_profile(p_name text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select snoozer.profile_snapshot(p.id,p.published_revision,true)
  || case when snoozer.ready_profile_domain(p.id) is not null then jsonb_build_object('custom_domain',snoozer.ready_profile_domain(p.id))
   when snoozer.profile_domain_candidate(p.id) is not null then jsonb_build_object('domain_renewal',snoozer.profile_domain_candidate(p.id))
   else '{}'::jsonb end
  || jsonb_build_object('badges',snoozer.public_profile_badges(p.id))
 from snoozer.profiles p where p.username=p_name and p.published_revision is not null
  and not snoozer.public_profile_blocked(p.id,p.owner_id)
$function$;

CREATE OR REPLACE FUNCTION public.get_my_profile_badges(p_profile uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.verified_user(); target uuid;
begin
 select p.id into target from snoozer.profiles p where p.owner_id=actor and (p_profile is null or p.id=p_profile)
 order by (p.id=p_profile) desc,p.created_at,p.id limit 1;
 if target is null then raise exception 'Profile not found' using errcode='P0002'; end if;
 perform snoozer.award_profile_milestones(target);
 return jsonb_build_object('profile_id',target,
  'earned',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'slug',a.slug,'name',a.name,'description',a.description,
   'icon',a.icon,'category',a.category,'rarity',a.rarity,'source',a.source,'awarded_at',a.awarded_at,'award_reason',a.award_reason)
   order by a.awarded_at desc,a.name) from snoozer.profile_badges a where a.profile_id=target and a.revoked_at is null),'[]'::jsonb),
  'catalogue',coalesce((select jsonb_agg(jsonb_build_object('slug',c.slug,'name',c.name,'description',c.description,'icon',c.icon,
   'category',c.category,'rarity',c.rarity,'award_mode',c.award_mode,'enabled',c.enabled,
   'earned',exists(select 1 from snoozer.profile_badges a where a.profile_id=target and a.slug=c.slug and a.revoked_at is null))
   order by c.sort_order,c.name) from snoozer.badge_catalog c where (c.unique_profile_id is null and c.award_mode<>'manual') or c.unique_profile_id=target),'[]'::jsonb));
end $function$

CREATE OR REPLACE FUNCTION public.owner_badge_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor();
begin return coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from snoozer.badge_catalog c where c.unique_profile_id is null),'[]'::jsonb); end $function$

CREATE OR REPLACE FUNCTION public.owner_profile_badges(p_profile uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor();
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile) then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(to_jsonb(b) order by b.awarded_at desc) from snoozer.profile_badges b where b.profile_id=p_profile),'[]'::jsonb);
end $function$

CREATE OR REPLACE FUNCTION public.owner_award_profile_badge(p_profile uuid, p_slug text, p_name text, p_description text, p_icon text, p_category text, p_rarity text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor(true); definition snoozer.badge_catalog; chosen_slug text; award_id uuid;
begin
 if not exists(select 1 from snoozer.profiles where id=p_profile) then raise exception 'Profile not found' using errcode='P0002'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 if p_slug is not null and p_slug<>'' then
  select * into definition from snoozer.badge_catalog where slug=p_slug and unique_profile_id is null and award_mode in('manual','future') and enabled;
  if not found then raise exception 'Badge cannot be awarded' using errcode='22023'; end if; chosen_slug:=definition.slug;
 else
  if length(btrim(coalesce(p_name,''))) not between 2 and 48 or length(btrim(coalesce(p_description,''))) not between 8 and 240
   or length(coalesce(p_icon,'')) not between 1 and 24 or p_category not in('community','creator','staff','unique')
   or p_rarity not in('rare','epic','legendary','mythic') then raise exception 'Invalid custom badge' using errcode='22023'; end if;
  chosen_slug:='owner-'||substr(replace(gen_random_uuid()::text,'-',''),1,24);
  insert into snoozer.badge_catalog(slug,name,description,icon,category,rarity,award_mode,enabled,unique_profile_id,sort_order)
  values(chosen_slug,btrim(p_name),btrim(p_description),p_icon,p_category,p_rarity,'manual',true,p_profile,99999)
  returning * into definition;
 end if;
 insert into snoozer.profile_badges(profile_id,slug,name,description,icon,category,rarity,source,awarded_by,award_reason)
 values(p_profile,chosen_slug,definition.name,definition.description,definition.icon,definition.category,definition.rarity,'owner',actor,btrim(p_reason))
 on conflict(profile_id,slug) do update set revoked_at=null,awarded_by=actor,award_reason=btrim(p_reason),awarded_at=now()
 returning id into award_id;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 select actor,p.owner_id,'badge.award',btrim(p_reason),jsonb_build_object('profile_id',p_profile,'slug',chosen_slug,'badge_id',award_id)
 from snoozer.profiles p where p.id=p_profile;
 return award_id;
end $function$

CREATE OR REPLACE FUNCTION public.owner_revoke_profile_badge(p_badge uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=snoozer.admin_actor(true); target uuid; slug text;
begin
 if length(btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'Reason required' using errcode='22023'; end if;
 update snoozer.profile_badges set revoked_at=now() where id=p_badge and revoked_at is null returning profile_id,profile_badges.slug into target,slug;
 if target is null then return false; end if;
 insert into snoozer.admin_audit_events(actor_id,target_id,action,reason,details)
 select actor,p.owner_id,'badge.revoke',btrim(p_reason),jsonb_build_object('profile_id',target,'slug',slug,'badge_id',p_badge)
 from snoozer.profiles p where p.id=target;
 return true;
end $function$

create trigger badges_profiles_refresh after insert or update of bio,avatar,published_revision,appearance,widgets,blocks on snoozer.profiles for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_links_refresh after insert or update or delete on snoozer.links for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_sections_refresh after insert or update or delete on snoozer.sections for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_gallery_refresh after insert or update or delete on snoozer.gallery_items for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_views_refresh after insert or update of total_views on snoozer.profile_view_leaderboard for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_discovery_refresh after insert or update or delete on snoozer.profile_discovery_settings for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_discord_refresh after insert or update or delete on snoozer.discord_presence_settings for each row execute function snoozer.refresh_profile_badges_trigger();
create trigger badges_domains_refresh after insert or update or delete on snoozer.profile_domains for each row execute function snoozer.refresh_profile_badges_trigger();
revoke all on function snoozer.award_profile_milestones(uuid) from public,anon,authenticated,service_role;

revoke all on function snoozer.refresh_profile_badges_trigger() from public,anon,authenticated,service_role;

revoke all on function snoozer.public_profile_badges(uuid) from public,anon,authenticated,service_role;

revoke all on function public.get_published_profile(text) from public,anon,authenticated,service_role;
grant execute on function public.get_published_profile(text) to anon,authenticated;
revoke all on function public.get_my_profile_badges(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_my_profile_badges(uuid) to authenticated;
revoke all on function public.owner_badge_catalog() from public,anon,authenticated,service_role;
grant execute on function public.owner_badge_catalog() to authenticated;
revoke all on function public.owner_profile_badges(uuid) from public,anon,authenticated,service_role;
grant execute on function public.owner_profile_badges(uuid) to authenticated;
revoke all on function public.owner_award_profile_badge(uuid,text,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_award_profile_badge(uuid,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.owner_revoke_profile_badge(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.owner_revoke_profile_badge(uuid,text) to authenticated;
do $$ declare item record; begin for item in select id from snoozer.profiles loop perform snoozer.award_profile_milestones(item.id); end loop; end $$;
commit;