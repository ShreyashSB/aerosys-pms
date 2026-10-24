-- The five project types from the 24 Oct change list. More are added from the
-- "Add new" option in the project form.
INSERT INTO "project_types" ("name") VALUES
  ('Commissioning'),
  ('TAB (Testing, Adjusting, Balancing)'),
  ('Design'),
  ('Audit'),
  ('Other')
ON CONFLICT ("name") DO NOTHING;
