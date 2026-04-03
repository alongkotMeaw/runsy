import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

const LEGACY_ROUTE_MAP = {
  Home: '/',
  Login: '/Login',
  Register: '/Register',
  Dashboard: '/Dashboard',
  Run: '/Run',
  History: '/History',
  Profile: '/Profile',
  EditProfile: '/Profile/EditProfile',
};

function resolveHref(name, params) {
  const pathname = LEGACY_ROUTE_MAP[name];

  if (!pathname) {
    return null;
  }

  return params ? { pathname, params } : pathname;
}

function resolveFallback(pathname) {
  if (
    pathname.startsWith('/Dashboard') ||
    pathname.startsWith('/Run') ||
    pathname.startsWith('/History') ||
    pathname.startsWith('/Profile')
  ) {
    return '/Dashboard';
  }

  return '/';
}

export function withLegacyRoute(ScreenComponent) {
  return function LegacyRouteWrapper() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useLocalSearchParams();

    const route = {
      key: pathname,
      name: pathname,
      params,
      path: pathname,
    };

    const legacyNavigation = {
      navigate: (name, params) => {
        const href = resolveHref(name, params);

        if (href) {
          router.navigate(href);
        }
      },
      push: (name, params) => {
        const href = resolveHref(name, params);

        if (href) {
          router.push(href);
        }
      },
      replace: (name, params) => {
        const href = resolveHref(name, params);

        if (href) {
          router.replace(href);
          return;
        }
      },
      goBack: () => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace(resolveFallback(pathname));
      },
      canGoBack: () => router.canGoBack(),
    };

    return <ScreenComponent navigation={legacyNavigation} route={route} />;
  };
}
