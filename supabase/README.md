# Configuración de Supabase para Ephemera

## Pasos para configurar Supabase

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Elige una región cercana a tus usuarios.
3. Guarda la contraseña de la base de datos en un lugar seguro.

### 2. Obtener credenciales
En el Dashboard de tu proyecto, ve a **Settings > API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 3. Ejecutar el schema
1. Ve a **SQL Editor** en el Dashboard de Supabase.
2. Crea una nueva consulta.
3. Copia y pega el contenido de `schema.sql`.
4. Ejecuta la consulta.

### 4. Crear el bucket de Storage
1. Ve a **Storage** en el Dashboard.
2. Crea un nuevo bucket llamado `media`.
3. Marca la opción **Public bucket**.
4. O ejecuta en el SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

CREATE POLICY "public media read"
  ON storage.objects FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "anon media upload"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');

CREATE POLICY "anon media delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'media');
```

### 5. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (cópialo de `.env.example`):

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GIPHY_API_KEY=        # opcional, para búsqueda de GIFs en Giphy
```

### 6. Crear el primer administrador
1. Registra un usuario normalmente desde la app.
2. En el SQL Editor de Supabase ejecuta:
```sql
UPDATE users SET is_admin = true WHERE alias = 'tu_alias_aqui';
```

---

## Despliegue en Vercel

1. Sube el proyecto a GitHub.
2. Importa el repositorio en [vercel.com](https://vercel.com).
3. En **Settings > Environment Variables**, agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GIPHY_API_KEY` (opcional)
4. Vercel detectará automáticamente que es un proyecto Vite.
5. El archivo `vercel.json` ya configura el enrutamiento SPA.

---

## Notas de seguridad

- Las contraseñas se hashean con SHA-256 + salt aleatorio en el cliente antes de enviarse a Supabase. **Nunca se almacena la contraseña en texto plano.**
- Las políticas RLS actuales son permisivas (para facilitar la configuración). Para producción, considera implementar autenticación con JWT propio o migrar a Supabase Auth.
- La anon key de Supabase es segura para usarse en el frontend — no tiene acceso a datos que no estén habilitados por las políticas RLS.

---

## Estructura de tablas

| Tabla | Descripción |
|-------|-------------|
| `users` | Usuarios con alias y contraseña hasheada |
| `groups` | Grupos de chat |
| `group_members` | Relación usuario-grupo |
| `messages` | Mensajes (texto, audio, video, gif, emoji) |
| `message_views` | Registro de quién ha visto cada mensaje |
| `custom_gifs` | GIFs subidos por los usuarios |
