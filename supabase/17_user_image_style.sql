-- =============================================================================
-- 17. Preferência de Design de Imagens dos Artigos em user_settings
-- Dependências: 01_extensions_and_users.sql
-- =============================================================================

alter table public.user_settings
  add column if not exists estilo_imagem_padrao text not null default 'editorial-flat';

alter table public.user_settings
  drop constraint if exists user_settings_estilo_imagem_padrao_check;

alter table public.user_settings
  add constraint user_settings_estilo_imagem_padrao_check
  check (
    estilo_imagem_padrao in (
      'editorial-flat',
      'fotografia-realista',
      'realismo-cinematografico',
      'render-3d-moderno',
      'aquarela-editorial',
      'minimalista-geometrico'
    )
  );

notify pgrst, 'reload schema';
