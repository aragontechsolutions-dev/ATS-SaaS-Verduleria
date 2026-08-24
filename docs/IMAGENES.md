# Imágenes — Supabase Storage

Las imágenes que suben las verdulerías (portada de la web y fotos de productos)
se guardan en un **bucket público de Supabase Storage** llamado `landing`. El
Panel las sube directo con la sesión del admin; solo hace falta crear el bucket
una vez.

## 1) Crear el bucket

**Opción A — Dashboard:** Supabase → *Storage* → *New bucket* → nombre `landing`,
**Public bucket: ON**, crear.

**Opción B — SQL** (SQL Editor):
```sql
insert into storage.buckets (id, name, public)
values ('landing', 'landing', true)
on conflict (id) do update set public = true;
```

## 2) Políticas (RLS de storage.objects)

Lectura pública (para que las fotos se vean en la web) y escritura solo para
usuarios autenticados (los admins logueados):

```sql
create policy "landing lectura publica" on storage.objects
  for select using ( bucket_id = 'landing' );

create policy "landing insert auth" on storage.objects
  for insert to authenticated with check ( bucket_id = 'landing' );

create policy "landing update auth" on storage.objects
  for update to authenticated using ( bucket_id = 'landing' );

create policy "landing delete auth" on storage.objects
  for delete to authenticated using ( bucket_id = 'landing' );
```

## 3) Verificar

En el Panel → *Mi web* → Portada → **Subir imagen**, o en *Productos* → editar
→ **Foto del producto**. Si aparece *«Falta crear el bucket "landing"»*, revisá
el paso 1.

## Validaciones (ya en el código)

El Panel valida antes de subir: **JPG, PNG o WebP** y **máximo 3 MB**, y le avisa
al tenant si algo no cumple (`apps/admin/src/lib/storage.ts`).

> Opcional: en el bucket podés fijar un *File size limit* de 3 MB y restringir
> los *Allowed MIME types* a `image/jpeg,image/png,image/webp` como segunda barrera.
