/**
 * The cookie SidebarProvider writes on every toggle. It lives outside that client
 * component because the dashboard layout reads it back while rendering on the
 * server, where an import from a "use client" module arrives as a client
 * reference instead of the string.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state"
