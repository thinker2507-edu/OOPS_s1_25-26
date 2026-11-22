import React, { useState, useEffect } from "../lib/react.js";
const NavContext = React.createContext(null);
function useRoute() {
  const current = () => location.pathname.replace(/\/+$/, '') || '/';
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const change = () => setRoute(current());
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  function navigate(to, replace = false) {
    if (to !== location.pathname) {
      history[replace ? 'replaceState' : 'pushState'](null, '', to);
    }
    setRoute(current());
  }
  return [route, navigate];
}
function Link({ to, children, className = '', ...props }) {
  const navigate = React.useContext(NavContext);
  return <a
    href={to}
    className={className}
    {...props}
    onClick={e => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        navigate(to);
      }
    }}
  >
    {children}
  </a>;
}
export { NavContext, useRoute, Link };
