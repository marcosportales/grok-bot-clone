import { Daytona } from "@daytona/sdk"

const globalForDaytona = globalThis as typeof globalThis & {
  daytona?: Daytona
}

// The dashboard is the origin. The API the SDK calls is under `/api`. A URL of
// the origin makes `GET /sandbox/:id` return dashboard HTML, and the SDK then
// calls `getToolboxProxyUrl` with no sandbox id.
function daytonaApiUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return value
  }

  if (
    url.hostname === "app.daytona.io" &&
    (url.pathname === "/" || url.pathname === "")
  ) {
    url.pathname = "/api"
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  }

  return value
}

export function getDaytona(): Daytona {
  if (!globalForDaytona.daytona) {
    const apiKey = process.env.DAYTONA_API_KEY
    if (!apiKey) {
      throw new Error("DAYTONA_API_KEY is not set")
    }

    // Next loads `.env.local` into the process environment. The SDK refuses to
    // guess an endpoint that is named both there and in that file, so the URL
    // is passed in when this process already has one.
    const apiUrl = daytonaApiUrl(process.env.DAYTONA_API_URL)
    globalForDaytona.daytona = new Daytona({
      apiKey,
      ...(apiUrl ? { apiUrl } : {}),
    })
  }

  return globalForDaytona.daytona
}
