-- Keep single-use gift claims intact if a recipient later deletes their account.
begin;
alter table snoozer.owner_gift_links drop constraint owner_gift_links_check1;
alter table snoozer.owner_gift_links add constraint owner_gift_links_claim_lifecycle_check
 check (claimed_by is null or claimed_at is not null);
commit;
