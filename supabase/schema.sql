-- Connor's Story Builder — run in Supabase SQL Editor
-- Storage: create a public bucket named "story-images" for Phase 5 (images)

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  premise text not null,
  characters jsonb not null default '[]'::jsonb,
  setting text,
  mood text,
  extra_rules text,
  cover_image_url text,
  reading_level text default 'advanced',
  reading_mode text default 'read_to_me',
  current_chapter int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references stories(id) on delete cascade,
  chapter_number int not null,
  title text not null,
  content text not null,
  summary text,
  illustration_url text,
  illustration_prompt text,
  choice_selected text,
  choices jsonb,
  reading_level text,
  created_at timestamptz default now(),
  unique(story_id, chapter_number)
);

create index if not exists chapters_story_id_idx on chapters(story_id);

alter table stories enable row level security;
alter table chapters enable row level security;

create policy "stories_select_all" on stories for select using (true);
create policy "chapters_select_all" on chapters for select using (true);
