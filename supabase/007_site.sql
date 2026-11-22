-- Contatore a parte per la chat "Créer un site internet" (20 messaggi al giorno per i gratuiti).
-- Facoltativo: finché non viene eseguito, il server usa il contatore 'tts' (che i gratuiti non usano).
alter table public.usage drop constraint if exists usage_kind_check;
alter table public.usage add constraint usage_kind_check check (kind in ('chat', 'image', 'voice', 'tts', 'video', 'site'));
