-- Fast cascading lookup for the application form and coordinator tools.
create index if not exists polling_units_lookup_idx
  on polling_units (state_code, lower(lga), lower(ward));
