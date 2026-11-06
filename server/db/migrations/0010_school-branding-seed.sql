UPDATE schools SET
  short_name = 'UW–Madison',
  city = 'Madison, WI',
  campus_name = 'Bascom Hill',
  theme = '{"primary":"#C5050C","primaryDeep":"#9B0000","onPrimary":"#FFFFFF","secondary":"#FFFFFF","onSecondary":"#9B0000","highlight":"#282728","onHighlight":"#FFFFFF","tint":"#FBEDEE","link":"#A8040A"}'::jsonb
WHERE slug = 'uw-madison';
--> statement-breakpoint
UPDATE schools SET
  short_name = 'Michigan',
  city = 'Ann Arbor, MI',
  campus_name = 'the Diag',
  theme = '{"primary":"#00274C","primaryDeep":"#001A33","onPrimary":"#FFFFFF","secondary":"#FFCB05","onSecondary":"#00274C","highlight":"#FFCB05","onHighlight":"#00274C","tint":"#EEF2F7","link":"#00396E"}'::jsonb
WHERE slug = 'umich';
--> statement-breakpoint
UPDATE schools SET
  short_name = 'UCLA',
  city = 'Los Angeles, CA',
  campus_name = 'Royce Quad',
  theme = '{"primary":"#2774AE","primaryDeep":"#005587","onPrimary":"#FFFFFF","secondary":"#FFD100","onSecondary":"#003B5C","highlight":"#FFD100","onHighlight":"#003B5C","tint":"#EDF4FA","link":"#005587"}'::jsonb
WHERE slug = 'ucla';
