import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const adminProtected = (path === '/admin' || path.startsWith('/admin/'))
    && path !== '/admin/login' && path !== '/admin/non-autorizzato';
  const customer = path.match(/^\/cliente\/([^/]+)(?:\/(.*))?$/);
  const customerProtected = customer && customer[2] !== 'login';

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    redirected.headers.set('Cache-Control', 'private, no-store');
    return redirected;
  }

  if (adminProtected || customerProtected) {
    if (error || !user) {
      return redirectTo(adminProtected ? '/admin/login' : `/cliente/${customer![1]}/login`);
    }
    if (adminProtected) {
      const { data: admin, error: adminError } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (adminError || !admin) return redirectTo('/admin/non-autorizzato');
    }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
