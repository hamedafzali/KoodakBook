-- KoodakBook — Migration 027: configurable AI provider / model / prompts
-- Move the hardcoded provider, model and prompts out of the code into a single
-- config row so they're selectable/editable from the admin panel. provider is
-- 'anthropic' (native) or 'openai_compatible' (OpenAI + DeepSeek/Kimi/Qwen/Zhipu/
-- OpenRouter/… — anything speaking the OpenAI API, via base_url). The API key for
-- whichever provider is selected always comes from one env var, AI_API_KEY.

create table if not exists ai_settings (
  id                   int primary key default 1 check (id = 1),
  provider             text not null default 'anthropic'
                         check (provider in ('anthropic', 'openai_compatible')),
  model                text not null,
  base_url             text,                 -- required for openai_compatible
  system_prompt        text not null,
  user_prompt_template text not null,
  max_tokens           int  not null default 8000,
  updated_at           timestamptz not null default now(),
  updated_by           text
);

insert into ai_settings (id, provider, model, base_url, max_tokens, system_prompt, user_prompt_template)
values (
  1,
  'anthropic',
  'claude-sonnet-4-6',
  null,
  8000,
  $sys$You are an expert author of Persian (Farsi) children's stories for heritage learners growing up outside Iran. You write warm, wholesome, age-appropriate stories in clear, natural Tehran-standard Persian, with an accurate English translation for each page. Keep vocabulary simple and concrete, reuse the target words naturally, avoid idioms a beginner wouldn't know, and keep sentences short. Never include anything scary or unsafe.$sys$,
  $usr$Write a personalized Persian children's story for {{name}}{{birth}}, who is at learning level {{level}} of 4 (1 = beginner, 4 = reads short stories).
Theme: {{theme}}.
Length: {{pageGuide}}.
Where it reads naturally, weave in some of these words the child is learning: {{vocab}}.
Return a title (Persian + English) and the pages, each with Persian text and its English translation.$usr$
)
on conflict (id) do nothing;

-- Permission to manage AI settings; grant to superadmin role-holders.
insert into permissions (key, description) values
  ('ai.manage', 'Manage AI provider, model and prompts')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
  select r.id, 'ai.manage' from roles r where r.key = 'superadmin'
on conflict do nothing;
