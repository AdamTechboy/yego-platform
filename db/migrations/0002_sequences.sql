-- Reference sequences for human-readable identifiers.
-- Seed data uses explicit IDs, so start above the seeded ranges.
create sequence if not exists application_ref_seq start 260000;
create sequence if not exists incident_ref_seq start 1000;
create sequence if not exists warning_ref_seq start 100;
create sequence if not exists certificate_ref_seq start 1001;

-- The status lookup requires the phone number used to apply; log attempts so
-- repeated failures can be throttled without storing the attempted phone.
create index if not exists audit_log_lookup_idx
  on audit_log (action, ip, created_at desc);
