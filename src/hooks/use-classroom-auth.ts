import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export function useClassroomAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { const refresh = () => { void supabase.auth.getUser().then(({ data }) => setUser(data.user)); }; refresh(); window.addEventListener('classroom-auth-changed', refresh); return () => window.removeEventListener('classroom-auth-changed', refresh); }, []);
  return user;
}