-- Preserve the Owner-issued gift ledger if the issuing account is erased.
begin;
alter table snoozer.owner_gift_links alter column created_by drop not null;
alter table snoozer.owner_gift_links drop constraint owner_gift_links_created_by_fkey;
alter table snoozer.owner_gift_links add constraint owner_gift_links_created_by_fkey
 foreign key (created_by) references auth.users(id) on delete set null;
commit;
